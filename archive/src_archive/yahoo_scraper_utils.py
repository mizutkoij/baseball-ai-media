#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yahoo野球スクレイピング ユーティリティクラス
効率的なデータ処理とエラーハンドリング
"""

import sqlite3
import json
import logging
import time
import random
import requests
from datetime import datetime, timedelta
from contextlib import contextmanager
from yahoo_scraper_config import *

class DatabaseManager:
    """軽量SQLiteデータベース管理"""
    
    def __init__(self, db_path=DATABASE_PATH):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """データベース初期化"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(DatabaseSchema.GAMES_TABLE)
            cursor.execute(DatabaseSchema.INDEXES_TABLE)
            cursor.execute(DatabaseSchema.PITCHES_TABLE)
            cursor.execute(DatabaseSchema.STATS_TABLE)
            conn.commit()
    
    @contextmanager
    def get_connection(self):
        """コネクション管理（自動クローズ）"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # 辞書形式でアクセス可能
        try:
            yield conn
        finally:
            conn.close()
    
    def insert_games(self, games_data):
        """試合データの一括挿入"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany('''
                INSERT OR REPLACE INTO games 
                (game_id, date, home_team, away_team, venue, status, league, url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', [
                (g['game_id'], g['date'], g['home_team'], g['away_team'], 
                 g['venue'], g['status'], g['league'], g['url'])
                for g in games_data
            ])
            conn.commit()
            return cursor.rowcount
    
    def get_unprocessed_games(self, limit=50):
        """未処理試合の取得"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM games 
                WHERE processed = 0 
                ORDER BY date ASC 
                LIMIT ?
            ''', (limit,))
            return [dict(row) for row in cursor.fetchall()]
    
    def mark_game_processed(self, game_id):
        """試合を処理済みにマーク"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE games 
                SET processed = 1, updated_at = CURRENT_TIMESTAMP 
                WHERE game_id = ?
            ''', (game_id,))
            conn.commit()
    
    def insert_indexes(self, indexes_data):
        """打席インデックスの一括挿入"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany('''
                INSERT OR IGNORE INTO batting_indexes 
                (game_id, index_code, inning, side, batter_num)
                VALUES (?, ?, ?, ?, ?)
            ''', indexes_data)
            conn.commit()
            return cursor.rowcount
    
    def get_unprocessed_indexes(self, game_id=None, limit=100):
        """未処理インデックスの取得"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if game_id:
                cursor.execute('''
                    SELECT * FROM batting_indexes 
                    WHERE game_id = ? AND processed = 0 
                    ORDER BY inning, side, batter_num
                    LIMIT ?
                ''', (game_id, limit))
            else:
                cursor.execute('''
                    SELECT * FROM batting_indexes 
                    WHERE processed = 0 
                    ORDER BY game_id, inning, side, batter_num
                    LIMIT ?
                ''', (limit,))
            return [dict(row) for row in cursor.fetchall()]
    
    def insert_pitches(self, pitches_data):
        """一球速報データの一括挿入"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany('''
                INSERT INTO pitch_data 
                (game_id, index_code, pitch_sequence, pitcher_name, batter_name,
                 pitch_type, velocity, zone_name, result, count_balls, count_strikes,
                 runners, inning, side, outs)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', pitches_data)
            conn.commit()
            return cursor.rowcount
    
    def get_stats(self, days=7):
        """統計情報取得"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 基本統計
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_games,
                    COUNT(CASE WHEN processed = 1 THEN 1 END) as processed_games,
                    COUNT(CASE WHEN processed = 0 THEN 1 END) as pending_games
                FROM games
                WHERE date >= date('now', '-{} days')
            '''.format(days))
            
            stats = dict(cursor.fetchone())
            
            # 球数統計
            cursor.execute('''
                SELECT COUNT(*) as total_pitches
                FROM pitch_data p
                JOIN games g ON p.game_id = g.game_id
                WHERE g.date >= date('now', '-{} days')
            '''.format(days))
            
            pitch_stats = dict(cursor.fetchone())
            stats.update(pitch_stats)
            
            return stats

class StateManager:
    """処理状態管理"""
    
    def __init__(self, state_file=STATE_FILE):
        self.state_file = state_file
        self.state = self.load_state()
    
    def load_state(self):
        """状態ファイル読み込み"""
        try:
            with open(self.state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                'last_processed_date': DateConfig.DEFAULT_START_DATE.strftime('%Y-%m-%d'),
                'current_game_id': None,
                'total_games_processed': 0,
                'total_pitches_collected': 0,
                'session_start_time': datetime.now().isoformat(),
                'processing_mode': ProcessingMode.FULL_PIPELINE
            }
    
    def save_state(self):
        """状態ファイル保存"""
        self.state['last_updated'] = datetime.now().isoformat()
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)
    
    def update_progress(self, **kwargs):
        """進捗更新"""
        self.state.update(kwargs)
        self.save_state()

class RequestManager:
    """HTTP リクエスト管理"""
    
    def __init__(self):
        self.session = requests.Session()
        self.setup_session()
        self.request_count = 0
        self.error_count = 0
    
    def setup_session(self):
        """セッション設定"""
        self.session.headers.update(HTTPConfig.HEADERS)
    
    def get_random_headers(self):
        """ランダムヘッダー生成"""
        return {'User-Agent': random.choice(USER_AGENTS)}
    
    def smart_delay(self, base_delay=None):
        """スマートディレイ（エラー率に応じて調整）"""
        if base_delay is None:
            base_delay = random.uniform(
                TimingConfig.REQUEST_DELAY_MIN, 
                TimingConfig.REQUEST_DELAY_MAX
            )
        
        # エラー率が高い場合は長めに待機
        error_rate = self.error_count / max(self.request_count, 1)
        if error_rate > 0.1:  # 10%以上のエラー率
            base_delay *= 2
        elif error_rate > 0.05:  # 5%以上のエラー率
            base_delay *= 1.5
        
        time.sleep(base_delay)
    
    def safe_request(self, url, max_retries=TimingConfig.MAX_RETRIES):
        """安全なリクエスト実行（リトライ機能付き）"""
        for attempt in range(max_retries):
            try:
                headers = self.get_random_headers()
                response = self.session.get(
                    url, 
                    headers=headers, 
                    timeout=TimingConfig.REQUEST_TIMEOUT
                )
                response.raise_for_status()
                response.encoding = response.apparent_encoding
                
                self.request_count += 1
                return response
                
            except requests.exceptions.RequestException as e:
                self.error_count += 1
                if attempt == max_retries - 1:
                    raise e
                
                # リトライ前の待機
                wait_time = TimingConfig.RETRY_DELAY * (2 ** attempt)
                time.sleep(wait_time)
        
        return None

class PerformanceMonitor:
    """パフォーマンス監視"""
    
    def __init__(self):
        self.start_time = datetime.now()
        self.game_times = []
        self.error_log = []
    
    def record_game_time(self, game_id, processing_time):
        """試合処理時間記録"""
        self.game_times.append({
            'game_id': game_id,
            'processing_time': processing_time,
            'timestamp': datetime.now()
        })
        
        # 直近50試合のみ保持
        if len(self.game_times) > 50:
            self.game_times = self.game_times[-50:]
    
    def record_error(self, error_type, details):
        """エラー記録"""
        self.error_log.append({
            'error_type': error_type,
            'details': details,
            'timestamp': datetime.now()
        })
        
        # 直近100エラーのみ保持
        if len(self.error_log) > 100:
            self.error_log = self.error_log[-100:]
    
    def get_performance_metrics(self):
        """パフォーマンスメトリクス取得"""
        if not self.game_times:
            return {}
        
        recent_times = [g['processing_time'] for g in self.game_times[-10:]]
        
        return {
            'total_games': len(self.game_times),
            'avg_game_time': sum(recent_times) / len(recent_times),
            'games_per_hour': len(self.game_times) / max((datetime.now() - self.start_time).total_seconds() / 3600, 1),
            'total_errors': len(self.error_log),
            'error_rate': len(self.error_log) / max(len(self.game_times), 1),
            'uptime_hours': (datetime.now() - self.start_time).total_seconds() / 3600
        }
    
    def is_performance_healthy(self):
        """パフォーマンス健全性チェック"""
        metrics = self.get_performance_metrics()
        
        if not metrics:
            return True
        
        # 目標値との比較
        healthy = True
        
        if metrics['games_per_hour'] < MetricsConfig.TARGET_GAMES_PER_HOUR * 0.8:
            healthy = False
        
        if metrics['error_rate'] > MetricsConfig.ERROR_RATE_THRESHOLD:
            healthy = False
            
        return healthy

class DataValidator:
    """データ検証"""
    
    @staticmethod
    def validate_game_data(game_data):
        """試合データ検証"""
        required_fields = ['game_id', 'date', 'home_team', 'away_team']
        return all(field in game_data and game_data[field] for field in required_fields)
    
    @staticmethod
    def validate_pitch_data(pitch_data):
        """一球速報データ検証"""
        required_fields = ['game_id', 'index_code']
        return all(field in pitch_data and pitch_data[field] for field in required_fields)
    
    @staticmethod
    def clean_text(text):
        """テキストクリーニング"""
        if not text:
            return ""
        return text.strip().replace('\n', ' ').replace('\t', ' ')
    
    @staticmethod
    def extract_velocity(text):
        """球速抽出"""
        import re
        if not text:
            return 0
        match = re.search(r'(\d+)(?:km/h|キロ)?', text)
        return int(match.group(1)) if match else 0

class Logger:
    """カスタムロガー"""
    
    def __init__(self, name="YahooScraper"):
        self.logger = logging.getLogger(name)
        self.setup_logger()
    
    def setup_logger(self):
        """ロガー設定"""
        self.logger.setLevel(logging.INFO)
        
        # ファイルハンドラー
        file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
        file_handler.setFormatter(logging.Formatter(LogConfig.FORMAT))
        
        # コンソールハンドラー  
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(logging.Formatter(LogConfig.FORMAT))
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
    
    def info(self, message):
        self.logger.info(message)
    
    def error(self, message):
        self.logger.error(message)
    
    def warning(self, message):
        self.logger.warning(message)