#!/usr/bin/env python3
"""
Automated Data Collector System
自動データ収集システム
野球データの定期的・継続的収集とモニタリング
"""

import schedule
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import logging
from dataclasses import dataclass
import threading
import time
import json
from comprehensive_baseball_scraper import ComprehensiveBaseballScraper
# メール機能は必要時のみインポート
try:
    import smtplib
    from email.mime.text import MimeText
    from email.mime.multipart import MimeMultipart
    EMAIL_AVAILABLE = True
except ImportError:
    EMAIL_AVAILABLE = False

logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class CollectionJob:
    job_id: str
    job_name: str
    job_type: str  # 'players', 'games', 'stats'
    league: str    # 'npb', 'kbo', 'mlb', 'all'
    frequency: str # 'hourly', 'daily', 'weekly'
    enabled: bool
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    success_count: int
    error_count: int

@dataclass
class CollectionResult:
    job_id: str
    start_time: datetime
    end_time: datetime
    status: str  # 'success', 'error', 'partial'
    records_collected: int
    errors: List[str]
    summary: Dict[str, Any]

class AutomatedDataCollector:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        self.scraper = ComprehensiveBaseballScraper(db_path)
        self.jobs: Dict[str, CollectionJob] = {}
        self.running = False
        
        # 通知設定
        self.notification_settings = {
            'email_enabled': False,
            'discord_webhook': None,
            'slack_webhook': None
        }
        
        # データ品質チェック設定
        self.quality_checks = {
            'min_players_per_team': 20,
            'max_age_limit': 50,
            'required_stats': ['games', 'at_bats', 'hits'],
            'duplicate_tolerance': 0.05
        }
        
        self.setup_default_jobs()
    
    def connect_db(self):
        return sqlite3.connect(self.db_path)
    
    def setup_default_jobs(self):
        """デフォルト収集ジョブ設定"""
        default_jobs = [
            CollectionJob(
                job_id='npb_daily_games',
                job_name='NPB日次試合データ収集',
                job_type='games',
                league='npb',
                frequency='daily',
                enabled=True,
                last_run=None,
                next_run=None,
                success_count=0,
                error_count=0
            ),
            CollectionJob(
                job_id='kbo_daily_games',
                job_name='KBO日次試合データ収集',
                job_type='games',
                league='kbo',
                frequency='daily',
                enabled=True,
                last_run=None,
                next_run=None,
                success_count=0,
                error_count=0
            ),
            CollectionJob(
                job_id='mlb_daily_games',
                job_name='MLB日次試合データ収集',
                job_type='games',
                league='mlb',
                frequency='daily',
                enabled=True,
                last_run=None,
                next_run=None,
                success_count=0,
                error_count=0
            ),
            CollectionJob(
                job_id='npb_weekly_players',
                job_name='NPB週次選手データ更新',
                job_type='players',
                league='npb',
                frequency='weekly',
                enabled=True,
                last_run=None,
                next_run=None,
                success_count=0,
                error_count=0
            ),
            CollectionJob(
                job_id='all_hourly_live',
                job_name='全リーグライブデータ取得',
                job_type='live_games',
                league='all',
                frequency='hourly',
                enabled=True,
                last_run=None,
                next_run=None,
                success_count=0,
                error_count=0
            )
        ]
        
        for job in default_jobs:
            self.jobs[job.job_id] = job
        
        logger.info(f"デフォルトジョブ設定完了: {len(default_jobs)}ジョブ")
    
    def schedule_jobs(self):
        """ジョブスケジューリング"""
        for job in self.jobs.values():
            if not job.enabled:
                continue
            
            if job.frequency == 'hourly':
                schedule.every().hour.do(self.run_job, job.job_id)
            elif job.frequency == 'daily':
                schedule.every().day.at("02:00").do(self.run_job, job.job_id)
            elif job.frequency == 'weekly':
                schedule.every().sunday.at("01:00").do(self.run_job, job.job_id)
        
        logger.info(f"ジョブスケジューリング完了: {len([j for j in self.jobs.values() if j.enabled])}ジョブ")
    
    def run_job(self, job_id: str) -> CollectionResult:
        """ジョブ実行"""
        if job_id not in self.jobs:
            logger.error(f"不明なジョブID: {job_id}")
            return None
        
        job = self.jobs[job_id]
        start_time = datetime.now()
        
        logger.info(f"ジョブ実行開始: {job.job_name}")
        
        try:
            result = CollectionResult(
                job_id=job_id,
                start_time=start_time,
                end_time=datetime.now(),
                status='success',
                records_collected=0,
                errors=[],
                summary={}
            )
            
            # ジョブタイプ別実行
            if job.job_type == 'games':
                records = self.collect_game_data(job.league)
                result.records_collected = len(records)
                result.summary['games_collected'] = len(records)
                
            elif job.job_type == 'players':
                records = self.collect_player_data(job.league)
                result.records_collected = len(records)
                result.summary['players_collected'] = len(records)
                
            elif job.job_type == 'live_games':
                records = self.collect_live_game_data(job.league)
                result.records_collected = len(records)
                result.summary['live_games_monitored'] = len(records)
            
            # データ品質チェック
            quality_issues = self.check_data_quality(job.job_type, records)
            if quality_issues:
                result.errors.extend(quality_issues)
                result.status = 'partial' if result.records_collected > 0 else 'error'
            
            # ジョブ統計更新
            job.last_run = start_time
            job.success_count += 1 if result.status == 'success' else 0
            job.error_count += 1 if result.status == 'error' else 0
            
            result.end_time = datetime.now()
            
            # 結果保存
            self.save_collection_result(result)
            
            # 通知
            if result.status == 'error':
                self.send_error_notification(job, result)
            elif result.records_collected > 0:
                self.send_success_notification(job, result)
            
            logger.info(f"ジョブ実行完了: {job.job_name} - {result.status} ({result.records_collected}レコード)")
            
            return result
        
        except Exception as e:
            job.error_count += 1
            error_result = CollectionResult(
                job_id=job_id,
                start_time=start_time,
                end_time=datetime.now(),
                status='error',
                records_collected=0,
                errors=[str(e)],
                summary={}
            )
            
            self.save_collection_result(error_result)
            self.send_error_notification(job, error_result)
            
            logger.error(f"ジョブ実行エラー: {job.job_name} - {e}")
            
            return error_result
    
    def collect_game_data(self, league: str) -> List[Any]:
        """試合データ収集"""
        try:
            games = self.scraper.scrape_today_games(league)
            self.scraper.save_scraped_games(games)
            return games
        except Exception as e:
            logger.error(f"試合データ収集エラー ({league}): {e}")
            return []
    
    def collect_player_data(self, league: str) -> List[Any]:
        """選手データ収集"""
        try:
            players = []
            
            if league in ['npb', 'all']:
                npb_players = self.scraper.scrape_npb_players()
                players.extend(npb_players)
            
            if league in ['kbo', 'all']:
                kbo_players = self.scraper.scrape_kbo_players()
                players.extend(kbo_players)
            
            if league in ['mlb', 'all']:
                mlb_players = self.scraper.scrape_mlb_players()
                players.extend(mlb_players)
            
            self.scraper.save_scraped_players(players)
            return players
            
        except Exception as e:
            logger.error(f"選手データ収集エラー ({league}): {e}")
            return []
    
    def collect_live_game_data(self, league: str) -> List[Any]:
        """ライブ試合データ収集"""
        try:
            # ライブゲーム監視（簡略実装）
            games = self.scraper.scrape_today_games(league)
            live_games = [g for g in games if g.status in ['live', 'in_progress']]
            
            # ライブゲームの詳細情報更新
            for game in live_games:
                self.update_live_game_details(game)
            
            return live_games
            
        except Exception as e:
            logger.error(f"ライブデータ収集エラー ({league}): {e}")
            return []
    
    def update_live_game_details(self, game):
        """ライブ試合詳細更新"""
        # 実装: 試合の詳細スコア、プレイバイプレイ更新
        pass
    
    def check_data_quality(self, job_type: str, records: List[Any]) -> List[str]:
        """データ品質チェック"""
        issues = []
        
        if job_type == 'players':
            issues.extend(self.check_player_data_quality(records))
        elif job_type == 'games':
            issues.extend(self.check_game_data_quality(records))
        
        return issues
    
    def check_player_data_quality(self, players: List[Any]) -> List[str]:
        """選手データ品質チェック"""
        issues = []
        
        if not players:
            issues.append("選手データが空です")
            return issues
        
        # 重複チェック
        names = [p.name for p in players]
        duplicates = len(names) - len(set(names))
        if duplicates > len(players) * self.quality_checks['duplicate_tolerance']:
            issues.append(f"重複選手が多すぎます: {duplicates}人")
        
        # 年齢チェック
        invalid_ages = [p for p in players if p.age > self.quality_checks['max_age_limit'] or p.age < 15]
        if invalid_ages:
            issues.append(f"異常な年齢の選手: {len(invalid_ages)}人")
        
        # 統計データチェック
        missing_stats = [p for p in players if not p.batting_stats and not p.pitching_stats]
        if len(missing_stats) > len(players) * 0.1:
            issues.append(f"統計データ欠損: {len(missing_stats)}人")
        
        return issues
    
    def check_game_data_quality(self, games: List[Any]) -> List[str]:
        """試合データ品質チェック"""
        issues = []
        
        if not games:
            issues.append("試合データが空です")
            return issues
        
        # スコアの妥当性
        invalid_scores = [g for g in games if g.home_score < 0 or g.away_score < 0 or 
                         g.home_score > 30 or g.away_score > 30]
        if invalid_scores:
            issues.append(f"異常なスコアの試合: {len(invalid_scores)}試合")
        
        return issues
    
    def save_collection_result(self, result: CollectionResult):
        """収集結果保存"""
        conn = self.connect_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS collection_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                status TEXT,
                records_collected INTEGER,
                errors TEXT,
                summary TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            INSERT INTO collection_results 
            (job_id, start_time, end_time, status, records_collected, errors, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            result.job_id, result.start_time, result.end_time, result.status,
            result.records_collected, json.dumps(result.errors, ensure_ascii=False),
            json.dumps(result.summary, ensure_ascii=False)
        ))
        
        conn.commit()
        conn.close()
    
    def send_success_notification(self, job: CollectionJob, result: CollectionResult):
        """成功通知送信"""
        message = f"""
        ✅ データ収集成功
        
        ジョブ: {job.job_name}
        レコード数: {result.records_collected}
        実行時間: {(result.end_time - result.start_time).total_seconds():.1f}秒
        時刻: {result.end_time.strftime('%Y-%m-%d %H:%M:%S')}
        """
        
        self.send_notification("データ収集成功", message)
    
    def send_error_notification(self, job: CollectionJob, result: CollectionResult):
        """エラー通知送信"""
        message = f"""
        ❌ データ収集エラー
        
        ジョブ: {job.job_name}
        エラー: {', '.join(result.errors)}
        時刻: {result.end_time.strftime('%Y-%m-%d %H:%M:%S')}
        
        確認が必要です。
        """
        
        self.send_notification("データ収集エラー", message)
    
    def send_notification(self, subject: str, message: str):
        """通知送信"""
        try:
            if self.notification_settings['email_enabled']:
                self.send_email_notification(subject, message)
            
            if self.notification_settings['discord_webhook']:
                self.send_discord_notification(message)
                
            if self.notification_settings['slack_webhook']:
                self.send_slack_notification(message)
                
        except Exception as e:
            logger.error(f"通知送信エラー: {e}")
    
    def send_email_notification(self, subject: str, message: str):
        """メール通知"""
        if not EMAIL_AVAILABLE:
            logger.warning("メール機能は利用できません")
            return
        # メール設定が必要
        pass
    
    def send_discord_notification(self, message: str):
        """Discord通知"""
        import requests
        
        webhook_url = self.notification_settings['discord_webhook']
        if webhook_url:
            payload = {"content": message}
            requests.post(webhook_url, json=payload)
    
    def send_slack_notification(self, message: str):
        """Slack通知"""
        import requests
        
        webhook_url = self.notification_settings['slack_webhook']
        if webhook_url:
            payload = {"text": message}
            requests.post(webhook_url, json=payload)
    
    def get_collection_status(self) -> Dict[str, Any]:
        """収集状況取得"""
        conn = self.connect_db()
        
        # 最近の結果取得
        recent_results = pd.read_sql_query('''
            SELECT job_id, status, records_collected, start_time
            FROM collection_results
            WHERE start_time >= datetime('now', '-24 hours')
            ORDER BY start_time DESC
        ''', conn)
        
        # ジョブ統計
        job_stats = {}
        for job_id, job in self.jobs.items():
            job_stats[job_id] = {
                'name': job.job_name,
                'enabled': job.enabled,
                'last_run': job.last_run.isoformat() if job.last_run else None,
                'success_count': job.success_count,
                'error_count': job.error_count,
                'success_rate': job.success_count / max(1, job.success_count + job.error_count)
            }
        
        conn.close()
        
        return {
            'jobs': job_stats,
            'recent_results': recent_results.to_dict('records'),
            'system_status': 'running' if self.running else 'stopped',
            'last_update': datetime.now().isoformat()
        }
    
    def generate_daily_report(self) -> str:
        """日次レポート生成"""
        status = self.get_collection_status()
        
        conn = self.connect_db()
        
        # 昨日の統計
        yesterday_stats = pd.read_sql_query('''
            SELECT 
                job_id,
                COUNT(*) as runs,
                SUM(records_collected) as total_records,
                AVG(records_collected) as avg_records,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
            FROM collection_results
            WHERE start_time >= date('now', '-1 day') AND start_time < date('now')
            GROUP BY job_id
        ''', conn)
        
        conn.close()
        
        # レポート作成
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"data_collection_daily_report_{timestamp}.json"
        
        report_data = {
            'report_date': datetime.now().isoformat(),
            'period': '24時間',
            'system_status': status,
            'yesterday_stats': yesterday_stats.to_dict('records'),
            'summary': {
                'total_jobs': len(self.jobs),
                'active_jobs': len([j for j in self.jobs.values() if j.enabled]),
                'total_runs': yesterday_stats['runs'].sum() if not yesterday_stats.empty else 0,
                'total_records': yesterday_stats['total_records'].sum() if not yesterday_stats.empty else 0,
                'success_rate': (yesterday_stats['successes'].sum() / max(1, yesterday_stats['runs'].sum())) if not yesterday_stats.empty else 0
            },
            'recommendations': []
        }
        
        # 推奨事項
        if report_data['summary']['success_rate'] < 0.8:
            report_data['recommendations'].append("成功率が低下しています。エラーログを確認してください")
        
        if report_data['summary']['total_records'] == 0:
            report_data['recommendations'].append("データが収集されていません。接続設定を確認してください")
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"日次レポート生成: {filename}")
        return filename
    
    def start_scheduler(self):
        """スケジューラー開始"""
        self.running = True
        self.schedule_jobs()
        
        logger.info("自動データ収集スケジューラー開始")
        
        # 日次レポート生成スケジュール
        schedule.every().day.at("06:00").do(self.generate_daily_report)
        
        try:
            while self.running:
                schedule.run_pending()
                time.sleep(60)  # 1分間隔でチェック
                
        except KeyboardInterrupt:
            logger.info("スケジューラーを停止中...")
            self.running = False
    
    def stop_scheduler(self):
        """スケジューラー停止"""
        self.running = False
        schedule.clear()
        logger.info("自動データ収集スケジューラー停止")
    
    def add_custom_job(self, job: CollectionJob):
        """カスタムジョブ追加"""
        self.jobs[job.job_id] = job
        
        if job.enabled:
            if job.frequency == 'hourly':
                schedule.every().hour.do(self.run_job, job.job_id)
            elif job.frequency == 'daily':
                schedule.every().day.at("02:00").do(self.run_job, job.job_id)
            elif job.frequency == 'weekly':
                schedule.every().sunday.at("01:00").do(self.run_job, job.job_id)
        
        logger.info(f"カスタムジョブ追加: {job.job_name}")
    
    def cleanup(self):
        """クリーンアップ"""
        self.stop_scheduler()
        self.scraper.cleanup()

def main():
    """メイン実行"""
    collector = AutomatedDataCollector()
    
    print("="*80)
    print("AUTOMATED DATA COLLECTOR SYSTEM")
    print("自動データ収集システム")
    print("="*80)
    
    print("\n1: スケジューラー開始（継続実行）")
    print("2: 手動ジョブ実行")
    print("3: 収集状況確認")
    print("4: 日次レポート生成")
    print("5: 設定変更")
    
    try:
        choice = input("選択してください (1-5): ").strip()
        
        if choice == '1':
            print("自動データ収集スケジューラーを開始します...")
            print("停止するにはCtrl+Cを押してください")
            collector.start_scheduler()
        
        elif choice == '2':
            print("\n実行可能なジョブ:")
            for i, (job_id, job) in enumerate(collector.jobs.items(), 1):
                status = "有効" if job.enabled else "無効"
                print(f"{i}. {job.job_name} ({job.league}) - {status}")
            
            try:
                job_num = int(input("ジョブ番号を選択: ")) - 1
                job_ids = list(collector.jobs.keys())
                if 0 <= job_num < len(job_ids):
                    job_id = job_ids[job_num]
                    result = collector.run_job(job_id)
                    
                    if result:
                        print(f"\nジョブ実行完了:")
                        print(f"ステータス: {result.status}")
                        print(f"収集レコード: {result.records_collected}")
                        print(f"実行時間: {(result.end_time - result.start_time).total_seconds():.1f}秒")
                        
                        if result.errors:
                            print(f"エラー: {', '.join(result.errors)}")
                else:
                    print("無効なジョブ番号です")
            except ValueError:
                print("無効な入力です")
        
        elif choice == '3':
            status = collector.get_collection_status()
            
            print(f"\n=== データ収集状況 ===")
            print(f"システム状態: {status['system_status']}")
            print(f"最終更新: {status['last_update']}")
            
            print(f"\n=== ジョブ状況 ===")
            for job_id, stats in status['jobs'].items():
                print(f"{stats['name']}:")
                print(f"  状態: {'有効' if stats['enabled'] else '無効'}")
                print(f"  最終実行: {stats['last_run'] or 'なし'}")
                print(f"  成功率: {stats['success_rate']:.1%}")
                print(f"  実行回数: {stats['success_count'] + stats['error_count']}")
            
            if status['recent_results']:
                print(f"\n=== 直近の実行結果 ===")
                for result in status['recent_results'][:5]:
                    print(f"{result['start_time']}: {result['job_id']} - {result['status']} ({result['records_collected']}レコード)")
        
        elif choice == '4':
            print("日次レポートを生成しています...")
            report_file = collector.generate_daily_report()
            print(f"日次レポート生成完了: {report_file}")
        
        elif choice == '5':
            print("設定変更（未実装）")
        
        else:
            print("無効な選択です")
    
    except KeyboardInterrupt:
        print("\n処理を中断しました")
    
    except Exception as e:
        logger.error(f"実行エラー: {e}")
        print(f"エラーが発生しました: {e}")
    
    finally:
        collector.cleanup()

if __name__ == "__main__":
    main()