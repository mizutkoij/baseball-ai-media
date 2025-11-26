#!/usr/bin/env python3
"""
update_constants_batch.py
定数の定期更新バッチスクリプト

日次0:30 JST実行想定:
1. 前日までのデータでリーグ定数を再計算
2. league_constants.json を更新
3. 品質チェック・アラート
4. ログ出力
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List
import subprocess

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('constants_update.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ConstantsUpdateBatch:
    """定数更新バッチ処理"""
    
    def __init__(self):
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.project_dir = os.path.dirname(self.script_dir)
        self.constants_path = os.path.join(self.project_dir, 'public', 'data', 'constants', 'league_constants.json')
        
    def backup_current_constants(self) -> bool:
        """現在の定数をバックアップ"""
        try:
            if os.path.exists(self.constants_path):
                backup_path = f"{self.constants_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                subprocess.run(['copy', self.constants_path, backup_path], shell=True, check=True)
                logger.info(f"Constants backed up to: {backup_path}")
                return True
        except Exception as e:
            logger.error(f"Failed to backup constants: {e}")
            return False
        return True
    
    def run_constants_calculation(self) -> bool:
        """定数計算スクリプトを実行"""
        try:
            compute_script = os.path.join(self.script_dir, 'compute_league_constants.py')
            result = subprocess.run([
                sys.executable, compute_script
            ], capture_output=True, text=True, cwd=self.script_dir)
            
            if result.returncode == 0:
                logger.info("Constants calculation completed successfully")
                logger.info(f"Output: {result.stdout}")
                return True
            else:
                logger.error(f"Constants calculation failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to run constants calculation: {e}")
            return False
    
    def validate_constants(self) -> Dict[str, bool]:
        """定数の品質検証"""
        validation_results = {
            'file_exists': False,
            'json_valid': False,
            'has_data': False,
            'reasonable_values': False,
            'recent_update': False
        }
        
        try:
            # ファイル存在チェック
            if not os.path.exists(self.constants_path):
                logger.error("Constants file does not exist")
                return validation_results
            validation_results['file_exists'] = True
            
            # JSON形式チェック
            with open(self.constants_path, 'r', encoding='utf-8') as f:
                constants_data = json.load(f)
            validation_results['json_valid'] = True
            
            # データ存在チェック
            if 'constants' in constants_data and constants_data['constants']:
                validation_results['has_data'] = True
                
                # 値の妥当性チェック
                reasonable = True
                for key, constants in constants_data['constants'].items():
                    # wOBA係数が妥当な範囲内か
                    if not (0.3 <= constants.get('woba_1b', 0) <= 2.0):
                        reasonable = False
                        logger.warning(f"Unreasonable woba_1b in {key}: {constants.get('woba_1b')}")
                    
                    # FIP定数が妥当な範囲内か  
                    if not (2.0 <= constants.get('fip_constant', 0) <= 5.0):
                        reasonable = False
                        logger.warning(f"Unreasonable fip_constant in {key}: {constants.get('fip_constant')}")
                    
                    # サンプルゲーム数チェック
                    if constants.get('sample_games', 0) < 10:
                        logger.warning(f"Low sample games in {key}: {constants.get('sample_games')}")
                
                validation_results['reasonable_values'] = reasonable
            
            # 更新時刻チェック
            if 'meta' in constants_data and 'generated_at' in constants_data['meta']:
                generated_at = datetime.fromisoformat(constants_data['meta']['generated_at'].replace('Z', '+00:00'))
                if (datetime.now() - generated_at.replace(tzinfo=None)).total_seconds() < 86400:  # 24時間以内
                    validation_results['recent_update'] = True
            
        except Exception as e:
            logger.error(f"Constants validation failed: {e}")
        
        return validation_results
    
    def send_alert_if_needed(self, validation_results: Dict[str, bool]) -> None:
        """品質問題があればアラートを送信"""
        issues = []
        
        for check, passed in validation_results.items():
            if not passed:
                issues.append(check)
        
        if issues:
            logger.error(f"Constants quality issues detected: {', '.join(issues)}")
            # 実際の運用では、Slack/Discord/メール等でアラート送信
            # self.send_slack_alert(f"⚠️ NPB Constants Update Issues: {', '.join(issues)}")
        else:
            logger.info("✅ All constants quality checks passed")
    
    def cleanup_old_backups(self, keep_days: int = 7) -> None:
        """古いバックアップファイルを削除"""
        try:
            constants_dir = os.path.dirname(self.constants_path)
            cutoff_date = datetime.now() - timedelta(days=keep_days)
            
            for filename in os.listdir(constants_dir):
                if filename.startswith('league_constants.json.backup.'):
                    filepath = os.path.join(constants_dir, filename)
                    file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
                    
                    if file_time < cutoff_date:
                        os.remove(filepath)
                        logger.info(f"Removed old backup: {filename}")
                        
        except Exception as e:
            logger.error(f"Failed to cleanup old backups: {e}")
    
    def run(self) -> bool:
        """バッチ処理のメイン実行"""
        logger.info("=== NPB Constants Update Batch Started ===")
        
        success = True
        
        # 1. バックアップ
        if not self.backup_current_constants():
            success = False
        
        # 2. 定数計算実行
        if not self.run_constants_calculation():
            success = False
        
        # 3. 品質検証
        validation_results = self.validate_constants()
        self.send_alert_if_needed(validation_results)
        
        if not all(validation_results.values()):
            success = False
        
        # 4. クリーンアップ
        self.cleanup_old_backups()
        
        if success:
            logger.info("=== NPB Constants Update Batch Completed Successfully ===")
        else:
            logger.error("=== NPB Constants Update Batch Completed with Errors ===")
        
        return success

def main():
    """メイン処理"""
    batch = ConstantsUpdateBatch()
    success = batch.run()
    
    # 終了コード
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()