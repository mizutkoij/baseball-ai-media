#!/usr/bin/env python3
"""
scripts/continuous_collector.py - 継続実行データ収集システム

24時間365日常時実行で：
1. 毎日の試合データ（リアルタイム優先）
2. 過去データの段階的補完
3. 75分間隔で確実なアクセス制限回避
4. 自動スケジューリングとエラー回復
"""
import sys
import os
import json
import csv
import time
import random
import sqlite3
import schedule
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import List, Dict, Optional, Set
import requests
from urllib.parse import urljoin
import logging

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install beautifulsoup4 requests schedule")
    sys.exit(1)

# 設定
BASE_URL = "https://baseballdata.jp"
SAFE_INTERVAL_MIN = 75 * 60  # 75分
SAFE_INTERVAL_MAX = 90 * 60  # 90分
DATA_DIR = Path("data/continuous_collection")
LOG_DIR = Path("logs")
STATUS_DB = "collection_status.db"

# ログ設定
def setup_logging():
    LOG_DIR.mkdir(exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(LOG_DIR / 'continuous_collector.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()

class CollectionStatusDB:
    """収集状況管理データベース"""
    
    def __init__(self, db_path: str = STATUS_DB):
        self.db_path = db_path
        self.init_db()
    
    def init_db(self):
        """データベース初期化"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 収集状況テーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS collection_status (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date_target DATE,
                data_type TEXT,
                target_detail TEXT,
                status TEXT,  -- pending, in_progress, completed, failed
                attempts INTEGER DEFAULT 0,
                last_attempt TIMESTAMP,
                completed_at TIMESTAMP,
                file_path TEXT,
                records_count INTEGER,
                error_message TEXT
            )
        """)
        
        # 実行ログテーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS execution_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action TEXT,
                target TEXT,
                status TEXT,
                duration_sec REAL,
                message TEXT
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info("Collection status database initialized")
    
    def add_collection_target(self, date_target: str, data_type: str, target_detail: str):
        """収集対象を追加"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 既存チェック
        cursor.execute("""
            SELECT id FROM collection_status 
            WHERE date_target = ? AND data_type = ? AND target_detail = ?
        """, (date_target, data_type, target_detail))
        
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO collection_status 
                (date_target, data_type, target_detail, status)
                VALUES (?, ?, ?, 'pending')
            """, (date_target, data_type, target_detail))
            conn.commit()
            logger.info(f"Added collection target: {date_target} {data_type} {target_detail}")
        
        conn.close()
    
    def get_next_pending_task(self) -> Optional[Dict]:
        """次の未完了タスクを取得（優先度順）"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 優先度順での取得（今日 > 昨日 > それ以前、失敗回数少ない順）
        cursor.execute("""
            SELECT id, date_target, data_type, target_detail, attempts
            FROM collection_status 
            WHERE status IN ('pending', 'failed')
            ORDER BY 
                CASE 
                    WHEN date_target = date('now') THEN 1  -- 今日最優先
                    WHEN date_target = date('now', '-1 day') THEN 2  -- 昨日次優先
                    ELSE 3  -- それ以前
                END,
                attempts ASC,  -- 失敗回数少ない順
                date_target DESC  -- 新しい日付順
            LIMIT 1
        """)
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                'id': result[0],
                'date_target': result[1],
                'data_type': result[2],
                'target_detail': result[3],
                'attempts': result[4]
            }
        return None
    
    def update_task_status(self, task_id: int, status: str, error_msg: str = None, 
                          file_path: str = None, records_count: int = None):
        """タスク状況更新"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if status == 'in_progress':
            cursor.execute("""
                UPDATE collection_status 
                SET status = ?, last_attempt = CURRENT_TIMESTAMP, attempts = attempts + 1
                WHERE id = ?
            """, (status, task_id))
        elif status == 'completed':
            cursor.execute("""
                UPDATE collection_status 
                SET status = ?, completed_at = CURRENT_TIMESTAMP, file_path = ?, records_count = ?
                WHERE id = ?
            """, (status, file_path, records_count, task_id))
        elif status == 'failed':
            cursor.execute("""
                UPDATE collection_status 
                SET status = ?, error_message = ?
                WHERE id = ?
            """, (status, error_msg, task_id))
        
        conn.commit()
        conn.close()
    
    def log_execution(self, action: str, target: str, status: str, duration: float = None, message: str = None):
        """実行ログ記録"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO execution_log (action, target, status, duration_sec, message)
            VALUES (?, ?, ?, ?, ?)
        """, (action, target, status, duration, message))
        
        conn.commit()
        conn.close()
    
    def get_collection_stats(self) -> Dict:
        """収集統計を取得"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                status,
                COUNT(*) as count,
                COUNT(CASE WHEN date_target = date('now') THEN 1 END) as today_count
            FROM collection_status 
            GROUP BY status
        """)
        
        stats = {}
        for row in cursor.fetchall():
            stats[row[0]] = {'total': row[1], 'today': row[2]}
        
        conn.close()
        return stats

class ContinuousCollector:
    """継続実行収集システム"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
            'Connection': 'keep-alive'
        })
        self.db = CollectionStatusDB()
        self.last_request_time = 0
        
        # データディレクトリ作成
        DATA_DIR.mkdir(exist_ok=True)
        
        logger.info("Continuous Collector initialized")
    
    def wait_safe_interval(self):
        """安全間隔待機"""
        current_time = time.time()
        if self.last_request_time > 0:
            elapsed = current_time - self.last_request_time
            wait_time = random.uniform(SAFE_INTERVAL_MIN, SAFE_INTERVAL_MAX)
            
            if elapsed < wait_time:
                remaining = wait_time - elapsed
                logger.info(f"Safe interval waiting: {remaining/60:.1f} minutes")
                time.sleep(remaining)
        
        self.last_request_time = time.time()
    
    def fetch_data_safely(self, url: str) -> Optional[BeautifulSoup]:
        """安全なデータ取得"""
        try:
            self.wait_safe_interval()
            
            logger.info(f"Fetching: {url}")
            response = self.session.get(url, timeout=30)
            
            if response.status_code == 429:
                logger.warning("Rate limited. Waiting 2 hours...")
                time.sleep(7200)
                return None
            
            if response.status_code == 403:
                logger.warning("Access forbidden. Waiting 4 hours...")
                time.sleep(14400)
                return None
            
            response.raise_for_status()
            return BeautifulSoup(response.content, 'html.parser')
            
        except Exception as e:
            logger.error(f"Fetch error: {e}")
            return None
    
    def process_single_task(self, task: Dict) -> bool:
        """単一タスクの処理"""
        task_id = task['id']
        date_target = task['date_target']
        data_type = task['data_type']
        target_detail = task['target_detail']
        
        start_time = time.time()
        logger.info(f"Processing task: {date_target} {data_type} {target_detail}")
        
        # 進行中にマーク
        self.db.update_task_status(task_id, 'in_progress')
        
        try:
            # URL構築
            if data_type == 'roster':
                url = f"{BASE_URL}/2023/roster/{target_detail}.html"
            elif data_type == 'game':
                url = f"{BASE_URL}/2023/game/{target_detail}.html"
            elif data_type == 'stats':
                url = f"{BASE_URL}/2023/stats/batting/{target_detail}.html"
            else:
                raise ValueError(f"Unknown data type: {data_type}")
            
            # データ取得
            soup = self.fetch_data_safely(url)
            if not soup:
                raise Exception("Failed to fetch data")
            
            # データ解析
            records = self.parse_data(soup, data_type, target_detail)
            
            # ファイル保存
            file_path = self.save_data(records, date_target, data_type, target_detail)
            
            # 成功マーク
            duration = time.time() - start_time
            self.db.update_task_status(task_id, 'completed', file_path=str(file_path), records_count=len(records))
            self.db.log_execution('collect', f"{data_type}:{target_detail}", 'success', duration)
            
            logger.info(f"Task completed: {len(records)} records in {duration:.1f}s")
            return True
            
        except Exception as e:
            duration = time.time() - start_time
            error_msg = str(e)
            self.db.update_task_status(task_id, 'failed', error_msg=error_msg)
            self.db.log_execution('collect', f"{data_type}:{target_detail}", 'failed', duration, error_msg)
            
            logger.error(f"Task failed: {error_msg}")
            return False
    
    def parse_data(self, soup: BeautifulSoup, data_type: str, target_detail: str) -> List[Dict]:
        """データ解析"""
        records = []
        
        try:
            tables = soup.find_all('table')
            if not tables:
                return records
            
            main_table = max(tables, key=lambda t: len(t.find_all('tr')))
            rows = main_table.find_all('tr')
            
            for row in rows[1:]:  # ヘッダースキップ
                cells = row.find_all(['td', 'th'])
                if len(cells) < 2:
                    continue
                
                record = {
                    'collection_timestamp': datetime.now().isoformat(),
                    'data_type': data_type,
                    'target_detail': target_detail,
                    'source_url': soup.title.string if soup.title else ''
                }
                
                # セルデータ抽出
                for i, cell in enumerate(cells[:10]):
                    text = cell.get_text(strip=True)
                    if text:
                        record[f'col_{i+1}'] = text
                
                if record.get('col_1'):
                    records.append(record)
        
        except Exception as e:
            logger.error(f"Parse error: {e}")
        
        return records
    
    def save_data(self, records: List[Dict], date_target: str, data_type: str, target_detail: str) -> Path:
        """データ保存"""
        # ファイルパス構築
        date_dir = DATA_DIR / f"date={date_target}"
        date_dir.mkdir(exist_ok=True)
        
        filename = f"{data_type}_{target_detail}_{date_target}.csv"
        file_path = date_dir / filename
        
        # CSV書き込み
        if records:
            fieldnames = list(records[0].keys())
            with open(file_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(records)
        
        return file_path
    
    def run_single_cycle(self):
        """1サイクル実行"""
        logger.info("Starting collection cycle")
        
        # 次のタスク取得
        task = self.db.get_next_pending_task()
        if not task:
            logger.info("No pending tasks")
            return
        
        # タスク実行
        success = self.process_single_task(task)
        
        # 統計表示
        stats = self.db.get_collection_stats()
        logger.info(f"Collection stats: {stats}")
        
        return success

def initialize_collection_targets():
    """収集対象の初期化"""
    db = CollectionStatusDB()
    
    # 今日から過去30日分の日付生成
    today = date.today()
    date_range = [today - timedelta(days=i) for i in range(31)]
    
    # チーム一覧
    teams = [
        "giants", "swallows", "dragons", "tigers", "carp", "baystars",
        "hawks", "fighters", "lions", "eagles", "marines", "buffaloes"
    ]
    
    logger.info("Initializing collection targets...")
    
    # ロスターターゲット追加
    for target_date in date_range:
        for team in teams:
            db.add_collection_target(
                target_date.strftime('%Y-%m-%d'),
                'roster',
                team
            )
    
    # 統計ターゲット追加
    for target_date in date_range[::7]:  # 週1回
        for league in ["central", "pacific"]:
            db.add_collection_target(
                target_date.strftime('%Y-%m-%d'),
                'stats',
                league
            )
    
    logger.info("Collection targets initialized")

def setup_scheduler():
    """スケジューラ設定"""
    
    def daily_maintenance():
        """日次メンテナンス"""
        logger.info("Running daily maintenance")
        
        # 新しい日のターゲット追加
        db = CollectionStatusDB()
        today = date.today().strftime('%Y-%m-%d')
        
        teams = ["giants", "swallows", "dragons", "tigers", "carp", "baystars",
                "hawks", "fighters", "lions", "eagles", "marines", "buffaloes"]
        
        for team in teams:
            db.add_collection_target(today, 'roster', team)
        
        # 統計情報ログ
        stats = db.get_collection_stats()
        logger.info(f"Daily stats: {stats}")
    
    # 毎日午前6時にメンテナンス
    schedule.every().day.at("06:00").do(daily_maintenance)
    
    logger.info("Scheduler configured")

def main():
    """メイン実行関数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Continuous baseball data collector")
    parser.add_argument("--init", action="store_true", help="Initialize collection targets")
    parser.add_argument("--single", action="store_true", help="Run single cycle only")
    parser.add_argument("--daemon", action="store_true", help="Run as daemon (continuous)")
    
    args = parser.parse_args()
    
    if args.init:
        initialize_collection_targets()
        return
    
    collector = ContinuousCollector()
    
    if args.single:
        # 1回だけ実行
        collector.run_single_cycle()
        return
    
    if args.daemon:
        # デーモン実行
        setup_scheduler()
        logger.info("Starting continuous collection daemon")
        
        try:
            while True:
                # スケジュール実行
                schedule.run_pending()
                
                # 1サイクル実行
                collector.run_single_cycle()
                
                # 少し休憩（次のタスクは75分後だが、スケジュール確認のため）
                time.sleep(300)  # 5分待機
                
        except KeyboardInterrupt:
            logger.info("Daemon stopped by user")
        except Exception as e:
            logger.error(f"Daemon error: {e}")
    else:
        print("Use --init, --single, or --daemon option")

if __name__ == "__main__":
    main()