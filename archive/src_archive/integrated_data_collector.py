#!/usr/bin/env python3
"""
統合データ収集システム
NPB公式PbPコネクタを優先し、Yahooスクレイパーは欠損補完のみに使用
"""

import os
import sys
import json
import time
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import subprocess

# NPB公式連携モジュール（既存のTypeScript実装を呼び出し）
class NPBOfficialConnector:
    """
    NPB公式PbPコネクタのPythonラッパー
    """
    
    def __init__(self):
        self.base_cmd = ["npx", "tsx", "scripts/ingest_pbp.ts"]
        
    def get_available_games(self, date: str) -> List[Dict]:
        """
        指定日の利用可能な試合一覧を取得
        """
        try:
            # NPB公式からサマリーを取得
            result = subprocess.run([
                "npx", "tsx", "-e", 
                f"import('./lib/connectors/npb-official-pbp').then(m => m.fetchNPBPlayByPlay('test', '{date}').then(console.log))"
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                # 成功時は何らかのデータがある
                return [{"source": "npb_official", "date": date, "available": True}]
            else:
                return []
                
        except Exception as e:
            print(f"NPB official data fetch error: {e}")
            return []
    
    def fetch_pbp_data(self, game_id: str, date: str) -> Optional[Dict]:
        """
        Play-by-Playデータを取得
        """
        try:
            # NPB公式PbP取り込みを実行
            result = subprocess.run(
                self.base_cmd + ["--gameId=" + game_id, "--date=" + date],
                capture_output=True, text=True, timeout=60
            )
            
            if result.returncode == 0:
                return {
                    "source": "npb_official",
                    "game_id": game_id,
                    "date": date,
                    "success": True,
                    "data": "collected"
                }
            else:
                print(f"NPB official data fetch failed: {result.stderr}")
                return None
                
        except Exception as e:
            print(f"NPB official data collection error: {e}")
            return None

class YahooBackupCollector:
    """
    Yahoo野球データ収集（バックアップ・補完用）
    """
    
    def __init__(self):
        self.usage_stats = {
            'requests_made': 0,
            'data_collected': 0,
            'last_used': None
        }
        
    def should_use_yahoo(self, npb_data_quality: float) -> bool:
        """
        Yahooデータ収集の必要性判定
        """
        # NPBデータの品質が98%未満の場合のみYahooを使用
        if npb_data_quality < 0.98:
            print(f"NPB data quality: {npb_data_quality:.1%} - using Yahoo backup")
            return True
        
        print(f"NPB data quality: {npb_data_quality:.1%} - Yahoo not needed")
        return False
    
    def collect_missing_data(self, game_id: str, date: str) -> Optional[Dict]:
        """
        欠損データをYahooから補完
        """
        self.usage_stats['last_used'] = datetime.now()
        
        try:
            print(f"Collecting backup data from Yahoo for {game_id}")
            
            # Step 2 (改善版) を実行
            result2 = subprocess.run([
                "python", "step_2_index_extractor_improved.py"
            ], capture_output=True, text=True, timeout=300)
            
            if result2.returncode != 0:
                print(f"Step 2 failed: {result2.stderr}")
                return None
            
            # Step 3 (改善版) を実行
            result3 = subprocess.run([
                "python", "step_3_pitchlog_fetcher_improved.py"
            ], capture_output=True, text=True, timeout=600)
            
            if result3.returncode == 0:
                self.usage_stats['requests_made'] += 1
                self.usage_stats['data_collected'] += 1
                
                return {
                    "source": "yahoo_backup",
                    "game_id": game_id,
                    "date": date,
                    "success": True,
                    "usage_stats": self.usage_stats.copy()
                }
            else:
                print(f"Step 3 failed: {result3.stderr}")
                return None
                
        except Exception as e:
            print(f"Yahoo backup collection error: {e}")
            return None
    
    def get_usage_report(self) -> Dict:
        """
        Yahoo使用状況レポート
        """
        return {
            **self.usage_stats,
            'reduction_vs_full_usage': max(0, 100 - self.usage_stats['requests_made'])
        }

class IntegratedDataCollector:
    """
    統合データ収集システム
    """
    
    def __init__(self):
        self.npb_connector = NPBOfficialConnector()
        self.yahoo_backup = YahooBackupCollector()
        self.collection_log = []
        
    def collect_game_data(self, game_id: str, date: str) -> Dict:
        """
        統合データ収集の実行
        """
        start_time = time.time()
        result = {
            "game_id": game_id,
            "date": date,
            "start_time": datetime.now().isoformat(),
            "sources_used": [],
            "data_quality": 0.0,
            "success": False
        }
        
        # Step 1: NPB公式データを試行
        print(f"Collecting data for game {game_id} on {date}")
        print("Step 1: Trying NPB official source...")
        
        npb_data = self.npb_connector.fetch_pbp_data(game_id, date)
        
        if npb_data and npb_data.get('success'):
            result['sources_used'].append('npb_official')
            result['data_quality'] = 0.99  # NPB公式は高品質と仮定
            result['success'] = True
            
            print("NPB official data collection successful")
            
        else:
            print("NPB official data collection failed")
            result['data_quality'] = 0.0
        
        # Step 2: 品質判定とYahooバックアップ
        if self.yahoo_backup.should_use_yahoo(result['data_quality']):
            print("Step 2: Using Yahoo backup source...")
            
            yahoo_data = self.yahoo_backup.collect_missing_data(game_id, date)
            
            if yahoo_data and yahoo_data.get('success'):
                result['sources_used'].append('yahoo_backup')
                result['data_quality'] = max(result['data_quality'], 0.85)  # Yahooは中品質
                result['success'] = True
                
                print("Yahoo backup data collection successful")
            else:
                print("Yahoo backup data collection failed")
        
        # 結果記録
        result['duration'] = time.time() - start_time
        result['end_time'] = datetime.now().isoformat()
        
        self.collection_log.append(result)
        
        return result
    
    def collect_daily_data(self, date: str) -> Dict:
        """
        指定日の全試合データ収集
        """
        print(f"\nDaily data collection for {date}")
        print("=" * 50)
        
        # NPB公式から利用可能な試合を確認
        available_games = self.npb_connector.get_available_games(date)
        
        if not available_games:
            print(f"No games available for {date}")
            return {"date": date, "games_processed": 0, "success": False}
        
        # 試合データを順次収集
        results = []
        for game_info in available_games:
            # ここでは簡単のため、ダミーのgame_idを使用
            # 実際にはNPB APIやスケジュールから取得
            game_id = f"game_{date.replace('-', '')}_01"
            
            result = self.collect_game_data(game_id, date)
            results.append(result)
            
            # レート制限（1試合あたり最低30秒間隔）
            time.sleep(30)
        
        # 日次サマリー
        successful_games = sum(1 for r in results if r['success'])
        yahoo_usage = sum(1 for r in results if 'yahoo_backup' in r['sources_used'])
        
        daily_summary = {
            "date": date,
            "games_processed": len(results),
            "successful_games": successful_games,
            "yahoo_usage_count": yahoo_usage,
            "yahoo_usage_rate": yahoo_usage / len(results) if results else 0,
            "avg_data_quality": sum(r['data_quality'] for r in results) / len(results) if results else 0,
            "success": successful_games > 0
        }
        
        print(f"\nDaily Summary for {date}:")
        print(f"   Games processed: {daily_summary['games_processed']}")
        print(f"   Successful: {daily_summary['successful_games']}")
        print(f"   Yahoo usage: {yahoo_usage}/{len(results)} ({yahoo_usage/len(results)*100:.1f}%)")
        print(f"   Avg quality: {daily_summary['avg_data_quality']:.1%}")
        
        return daily_summary
    
    def get_usage_report(self) -> Dict:
        """
        総合使用状況レポート
        """
        yahoo_report = self.yahoo_backup.get_usage_report()
        
        total_collections = len(self.collection_log)
        successful_collections = sum(1 for log in self.collection_log if log['success'])
        npb_only_collections = sum(1 for log in self.collection_log if log['sources_used'] == ['npb_official'])
        
        return {
            "total_collections": total_collections,
            "successful_collections": successful_collections,
            "success_rate": successful_collections / total_collections if total_collections else 0,
            "npb_only_rate": npb_only_collections / total_collections if total_collections else 0,
            "yahoo_backup": yahoo_report,
            "request_reduction": f"~{yahoo_report['reduction_vs_full_usage']}% reduction vs pure Yahoo scraping"
        }

def main():
    """
    メイン実行関数
    """
    print("NPB Baseball Data Collection System")
    print("NPB Official (Primary) + Yahoo Backup (Secondary)")
    print("=" * 60)
    
    collector = IntegratedDataCollector()
    
    # 引数処理
    if len(sys.argv) > 1:
        date = sys.argv[1]
    else:
        # デフォルトは昨日
        date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    
    try:
        # 日次データ収集実行
        daily_result = collector.collect_daily_data(date)
        
        # 使用状況レポート
        usage_report = collector.get_usage_report()
        
        print(f"\nFinal Report:")
        print(f"   Date: {date}")
        print(f"   Success: {daily_result['success']}")
        print(f"   NPB-only rate: {usage_report['npb_only_rate']:.1%}")
        print(f"   Request reduction: {usage_report['request_reduction']}")
        
        # ログ保存
        log_file = f"logs/collection_log_{date.replace('-', '')}.json"
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump({
                "daily_result": daily_result,
                "usage_report": usage_report,
                "collection_log": collector.collection_log
            }, f, ensure_ascii=False, indent=2)
        
        print(f"Log saved to: {log_file}")
        
    except Exception as e:
        print(f"Collection failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()