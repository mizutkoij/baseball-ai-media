#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yahoo野球 24時間連続スクレイピングシステム メイン実行スクリプト
45分/試合ペースで効率的にデータ収集
"""

import sys
import time
import signal
import argparse
from datetime import datetime, timedelta
from yahoo_scraper_config import *
from yahoo_scraper_utils import *
from yahoo_continuous_scraper import YahooContinuousScraper

class YahooScrapingOrchestrator:
    """Yahoo野球スクレイピング統合管理"""
    
    def __init__(self, mode=ProcessingMode.CONTINUOUS):
        self.mode = mode
        self.db_manager = DatabaseManager()
        self.state_manager = StateManager()
        self.request_manager = RequestManager()
        self.performance_monitor = PerformanceMonitor()
        self.logger = Logger()
        self.running = False
        
        # シグナルハンドラー設定
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
    
    def signal_handler(self, signum, frame):
        """シグナルハンドラー（優雅な停止）"""
        self.logger.info(f"シグナル {signum} を受信。優雅に停止中...")
        self.running = False
    
    def collect_schedules(self, start_date=None, end_date=None):
        """試合スケジュール収集"""
        if not start_date:
            start_date = datetime.strptime(
                self.state_manager.state['last_processed_date'], 
                '%Y-%m-%d'
            )
        if not end_date:
            end_date = datetime.now() - timedelta(days=1)
        
        self.logger.info(f"スケジュール収集: {start_date.strftime('%Y-%m-%d')} 〜 {end_date.strftime('%Y-%m-%d')}")
        
        scraper = YahooContinuousScraper()
        total_games = 0
        
        current_date = start_date
        while current_date <= end_date and self.running:
            try:
                games = scraper.fetch_daily_schedule(current_date)
                if games:
                    count = self.db_manager.insert_games(games)
                    total_games += count
                    self.logger.info(f"{current_date.strftime('%Y-%m-%d')}: {count}試合追加")
                
                current_date += timedelta(days=1)
                self.request_manager.smart_delay(
                    random.uniform(
                        TimingConfig.SCHEDULE_DELAY_MIN,
                        TimingConfig.SCHEDULE_DELAY_MAX
                    )
                )
                
            except Exception as e:
                self.logger.error(f"スケジュール収集エラー {current_date}: {e}")
                self.performance_monitor.record_error("schedule_collection", str(e))
        
        # 状態更新
        self.state_manager.update_progress(
            last_processed_date=end_date.strftime('%Y-%m-%d'),
            total_games_discovered=self.state_manager.state.get('total_games_discovered', 0) + total_games
        )
        
        self.logger.info(f"スケジュール収集完了: {total_games}試合")
        return total_games
    
    def process_games_continuous(self):
        """24時間連続試合処理"""
        self.logger.info("24時間連続処理開始")
        self.running = True
        
        scraper = YahooContinuousScraper()
        games_in_session = 0
        
        while self.running:
            try:
                # 未処理試合取得
                unprocessed_games = self.db_manager.get_unprocessed_games(20)
                
                if not unprocessed_games:
                    self.logger.info("未処理試合なし。新しいスケジュールを収集...")
                    self.collect_schedules()
                    unprocessed_games = self.db_manager.get_unprocessed_games(20)
                
                if not unprocessed_games:
                    self.logger.info("処理可能な試合がありません。1時間待機...")
                    time.sleep(3600)
                    continue
                
                # 試合処理
                for game in unprocessed_games:
                    if not self.running:
                        break
                    
                    game_start_time = time.time()
                    self.logger.info(f"試合処理開始: {game['date']} {game['home_team']} vs {game['away_team']} (ID: {game['game_id']})")
                    
                    try:
                        # 45分で1試合を処理
                        scraper.process_single_game(game['game_id'])
                        
                        # 処理完了マーク
                        self.db_manager.mark_game_processed(game['game_id'])
                        
                        processing_time = time.time() - game_start_time
                        self.performance_monitor.record_game_time(game['game_id'], processing_time)
                        
                        games_in_session += 1
                        self.logger.info(f"試合処理完了: {game['game_id']} ({processing_time:.1f}秒)")
                        
                        # 状態更新
                        self.state_manager.update_progress(
                            current_game_id=game['game_id'],
                            total_games_processed=self.state_manager.state.get('total_games_processed', 0) + 1
                        )
                        
                        # 10試合ごとに統計表示
                        if games_in_session % 10 == 0:
                            self.print_session_stats()
                        
                        # パフォーマンスチェック
                        if not self.performance_monitor.is_performance_healthy():
                            self.logger.warning("パフォーマンス低下を検出。処理間隔を調整...")
                            time.sleep(300)  # 5分追加待機
                        
                    except Exception as e:
                        self.logger.error(f"試合処理エラー {game['game_id']}: {e}")
                        self.performance_monitor.record_error("game_processing", str(e))
                        time.sleep(60)  # エラー時は1分待機
                
            except Exception as e:
                self.logger.error(f"メインループエラー: {e}")
                self.performance_monitor.record_error("main_loop", str(e))
                time.sleep(300)  # 重大エラー時は5分待機
        
        self.logger.info("24時間連続処理終了")
    
    def print_session_stats(self):
        """セッション統計表示"""
        stats = self.db_manager.get_stats()
        perf_metrics = self.performance_monitor.get_performance_metrics()
        
        self.logger.info(f"""
=== セッション統計 ===
稼働時間: {perf_metrics.get('uptime_hours', 0):.2f}時間
処理済み試合: {stats['processed_games']}/{stats['total_games']}
未処理試合: {stats['pending_games']}
処理レート: {perf_metrics.get('games_per_hour', 0):.2f}試合/時間
平均処理時間: {perf_metrics.get('avg_game_time', 0):.1f}秒/試合
収集球数: {stats.get('total_pitches', 0)}
エラー率: {perf_metrics.get('error_rate', 0):.3f}
""")
    
    def run_maintenance(self):
        """メンテナンス実行"""
        self.logger.info("メンテナンス開始")
        
        # データベース統計更新
        stats = self.db_manager.get_stats()
        self.logger.info(f"データベース統計: {stats}")
        
        # 古いログファイルクリーンアップ
        # パフォーマンスメトリクス出力
        metrics = self.performance_monitor.get_performance_metrics()
        self.logger.info(f"パフォーマンスメトリクス: {metrics}")
        
        self.logger.info("メンテナンス完了")
    
    def run(self):
        """メイン実行"""
        try:
            if self.mode == ProcessingMode.SCHEDULE_ONLY:
                self.collect_schedules()
            elif self.mode == ProcessingMode.CONTINUOUS:
                self.process_games_continuous()
            else:
                self.logger.error(f"未対応モード: {self.mode}")
                
        except KeyboardInterrupt:
            self.logger.info("ユーザーによる停止")
        except Exception as e:
            self.logger.error(f"予期せぬエラー: {e}")
        finally:
            self.state_manager.save_state()
            self.logger.info("プログラム終了")

def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description='Yahoo野球スクレイピングシステム')
    parser.add_argument('--mode', 
                        choices=[ProcessingMode.SCHEDULE_ONLY, ProcessingMode.CONTINUOUS],
                        default=ProcessingMode.CONTINUOUS,
                        help='実行モード')
    parser.add_argument('--maintenance', action='store_true', help='メンテナンス実行')
    
    args = parser.parse_args()
    
    orchestrator = YahooScrapingOrchestrator(args.mode)
    
    if args.maintenance:
        orchestrator.run_maintenance()
    else:
        orchestrator.run()

if __name__ == "__main__":
    main()