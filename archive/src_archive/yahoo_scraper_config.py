#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yahoo野球スクレイピング設定ファイル
"""

import os
from datetime import datetime, timedelta

# ===== 基本設定 =====
BASE_URL = "https://baseball.yahoo.co.jp/npb"
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(PROJECT_ROOT, "data", "yahoo_scraping")

# ===== ディレクトリ設定 =====
SCHEDULE_DIR = os.path.join(DATA_DIR, "schedules")
INDEXES_DIR = os.path.join(DATA_DIR, "indexes") 
PITCHES_DIR = os.path.join(DATA_DIR, "pitches")
LOGS_DIR = os.path.join(DATA_DIR, "logs")
DB_DIR = os.path.join(DATA_DIR, "database")

# ディレクトリ作成
for directory in [SCHEDULE_DIR, INDEXES_DIR, PITCHES_DIR, LOGS_DIR, DB_DIR]:
    os.makedirs(directory, exist_ok=True)

# ===== ファイルパス =====
DATABASE_PATH = os.path.join(DB_DIR, "yahoo_baseball.db")
STATE_FILE = os.path.join(DATA_DIR, "scraper_state.json")
LOG_FILE = os.path.join(LOGS_DIR, "scraper.log")
PROGRESS_FILE = os.path.join(DATA_DIR, "progress.json")

# ===== タイミング設定 =====
class TimingConfig:
    # 1試合あたりの処理時間 (45分 = 2700秒)
    GAME_PROCESSING_TIME = 45 * 60  # 2700秒
    
    # リクエスト間隔 (Yahoo向け慎重設定)
    REQUEST_DELAY_MIN = 8    # 最小8秒
    REQUEST_DELAY_MAX = 15   # 最大15秒
    
    # 日程取得間隔
    SCHEDULE_DELAY_MIN = 2   # 最小2秒
    SCHEDULE_DELAY_MAX = 5   # 最大5秒
    
    # エラー時のリトライ設定
    MAX_RETRIES = 3
    RETRY_DELAY = 30         # 30秒
    
    # タイムアウト
    REQUEST_TIMEOUT = 30     # 30秒

# ===== チーム設定 =====
class TeamConfig:
    CENTRAL_TEAMS = {
        "巨人", "阪神", "中日", "DeNA", "広島", "ヤクルト"
    }
    
    PACIFIC_TEAMS = {
        "ロッテ", "ソフトバンク", "楽天", "日本ハム", "オリックス", "西武"
    }
    
    @classmethod
    def detect_league(cls, home_team, away_team):
        """リーグ判定"""
        if home_team in cls.CENTRAL_TEAMS and away_team in cls.CENTRAL_TEAMS:
            return "セ・リーグ"
        elif home_team in cls.PACIFIC_TEAMS and away_team in cls.PACIFIC_TEAMS:
            return "パ・リーグ"
        elif ({home_team, away_team} & cls.CENTRAL_TEAMS) and ({home_team, away_team} & cls.PACIFIC_TEAMS):
            return "交流戦"
        return "その他"

# ===== 日付設定 =====
class DateConfig:
    # デフォルト開始日（初回実行時）
    DEFAULT_START_DATE = datetime(2025, 2, 1)
    
    # 処理対象期間の計算
    @staticmethod
    def get_date_range():
        """処理対象の日付範囲を取得"""
        end_date = datetime.now() - timedelta(days=1)  # 昨日まで
        return DateConfig.DEFAULT_START_DATE, end_date
    
    @staticmethod
    def generate_date_list(start_date, end_date):
        """日付リストを生成"""
        dates = []
        current = start_date
        while current <= end_date:
            dates.append(current)
            current += timedelta(days=1)
        return dates

# ===== User-Agent設定 =====
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/126.0.0.0 Safari/537.36"
]

# ===== HTTP設定 =====
class HTTPConfig:
    HEADERS = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
    }

# ===== データベーススキーマ =====
class DatabaseSchema:
    # ゲーム情報テーブル
    GAMES_TABLE = '''
        CREATE TABLE IF NOT EXISTS games (
            game_id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            home_team TEXT NOT NULL,
            away_team TEXT NOT NULL,
            venue TEXT,
            status TEXT,
            league TEXT,
            url TEXT,
            max_inning INTEGER DEFAULT 9,
            processed BOOLEAN DEFAULT 0,
            indexes_extracted BOOLEAN DEFAULT 0,
            pitches_collected BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    '''
    
    # 打席インデックステーブル
    INDEXES_TABLE = '''
        CREATE TABLE IF NOT EXISTS batting_indexes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id TEXT NOT NULL,
            index_code TEXT NOT NULL,
            inning INTEGER,
            side INTEGER,
            batter_num INTEGER,
            valid BOOLEAN DEFAULT 1,
            processed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES games (game_id),
            UNIQUE(game_id, index_code)
        )
    '''
    
    # 一球速報テーブル
    PITCHES_TABLE = '''
        CREATE TABLE IF NOT EXISTS pitch_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id TEXT NOT NULL,
            index_code TEXT NOT NULL,
            pitch_sequence INTEGER,
            pitcher_name TEXT,
            batter_name TEXT,
            pitch_type TEXT,
            velocity INTEGER,
            zone_x INTEGER,
            zone_y INTEGER,
            zone_name TEXT,
            result TEXT,
            count_balls INTEGER,
            count_strikes INTEGER,
            runners TEXT,
            inning INTEGER,
            side INTEGER,
            outs INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES games (game_id)
        )
    '''
    
    # 処理統計テーブル
    STATS_TABLE = '''
        CREATE TABLE IF NOT EXISTS processing_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            games_processed INTEGER DEFAULT 0,
            indexes_extracted INTEGER DEFAULT 0,
            pitches_collected INTEGER DEFAULT 0,
            errors INTEGER DEFAULT 0,
            processing_time REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    '''

# ===== 処理モード設定 =====
class ProcessingMode:
    SCHEDULE_ONLY = "schedule"      # 日程のみ
    INDEXES_ONLY = "indexes"        # インデックスのみ  
    PITCHES_ONLY = "pitches"        # 一球速報のみ
    FULL_PIPELINE = "full"          # 全工程
    CONTINUOUS = "continuous"       # 24時間連続

# ===== ログ設定 =====
class LogConfig:
    FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    DATE_FORMAT = '%Y-%m-%d %H:%M:%S'
    MAX_LOG_SIZE = 50 * 1024 * 1024  # 50MB
    BACKUP_COUNT = 5

# ===== メトリクス設定 =====
class MetricsConfig:
    # 目標性能指標
    TARGET_GAMES_PER_HOUR = 1.33    # 45分/試合 = 1.33試合/時間
    TARGET_PITCHES_PER_GAME = 300   # 試合あたり平均球数
    
    # アラート閾値
    ERROR_RATE_THRESHOLD = 0.05     # エラー率5%以上でアラート
    DELAY_THRESHOLD = 3600          # 1時間以上の遅延でアラート