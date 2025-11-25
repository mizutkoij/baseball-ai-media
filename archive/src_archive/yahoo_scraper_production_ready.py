#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yahoo野球スクレイピング本番運用版
データベーススキーマ整合性修正済み
"""

import requests
import sqlite3
from bs4 import BeautifulSoup
import time
import random
import os
import json
import logging
from datetime import datetime, timedelta
from contextlib import contextmanager
import re

# ===== 設定 =====
BASE_URL = "https://baseball.yahoo.co.jp/npb"
DATA_DIR = "data/yahoo_continuous"
DB_PATH = os.path.join(DATA_DIR, "yahoo_games.db")
LOG_PATH = os.path.join(DATA_DIR, "scraper.log")
STATE_FILE = os.path.join(DATA_DIR, "scraper_state.json")

# タイミング設定
GAME_PROCESSING_TIME = 2700  # 45分 = 2700秒
PITCH_DELAY_MIN = 20   # 最小20秒間隔
PITCH_DELAY_MAX = 30   # 最大30秒間隔
REQUEST_TIMEOUT = 30

# ディレクトリ作成
os.makedirs(DATA_DIR, exist_ok=True)

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_PATH, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class YahooScraperProductionReady:
    def __init__(self):
        self.session = requests.Session()
        self.setup_session()
        self.db_path = DB_PATH
        self.state_file = STATE_FILE
        self.init_database()
        self.load_state()
        
    def setup_session(self):
        """セッション初期化"""
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
    
    def get_random_headers(self):
        """ランダムヘッダー生成"""
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        ]
        return {
            'User-Agent': random.choice(user_agents),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en;q=0.5'
        }
    
    def init_database(self):
        """データベース初期化 - 既存スキーマに合わせる"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS games (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id TEXT UNIQUE,
                    date TEXT,
                    home_team TEXT,
                    away_team TEXT,
                    status TEXT,
                    processed INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 既存のスキーマに合わせる: count_data -> count, zone -> zone
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS pitch_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id TEXT,
                    index_code TEXT,
                    pitcher_name TEXT,
                    batter_name TEXT,
                    pitch_sequence INTEGER,
                    pitch_type TEXT,
                    velocity TEXT,
                    result TEXT,
                    count TEXT,
                    zone TEXT,
                    runners TEXT,
                    scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(game_id, index_code, pitch_sequence)
                )
            ''')
            conn.commit()
    
    @contextmanager
    def get_connection(self):
        """データベース接続管理"""
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()
    
    def load_state(self):
        """状態ファイル読み込み"""
        try:
            with open(self.state_file, 'r', encoding='utf-8') as f:
                self.state = json.load(f)
        except FileNotFoundError:
            self.state = {
                'last_processed_date': (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'),
                'total_games_processed': 0,
                'total_pitches_collected': 0,
                'session_start_time': datetime.now().isoformat()
            }
            self.save_state()
    
    def save_state(self):
        """状態保存"""
        self.state['last_updated'] = datetime.now().isoformat()
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)
    
    def extract_pitch_data_production(self, game_id, index_code):
        """本番用一球速報データ抽出"""
        try:
            url = f"{BASE_URL}/game/{game_id}/score?index={index_code}"
            headers = self.get_random_headers()
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.encoding = response.apparent_encoding
            soup = BeautifulSoup(response.text, 'html.parser')
            
            if response.status_code != 200:
                logger.debug(f"HTTP {response.status_code}: {url}")
                return []
            
            # 成功パターン: bb-splitsTableから正しいテーブルを特定
            all_tables = soup.select("table.bb-splitsTable")
            
            target_table = None
            for table in all_tables:
                headers_in_table = [th.text.strip() for th in table.select("thead th")]
                
                # 必要なヘッダーを含むテーブルを探す
                if len(headers_in_table) >= 4:
                    required_headers = ['投球数', '球種', '球速', '結果']
                    if all(header in headers_in_table for header in required_headers):
                        target_table = table
                        break
            
            if not target_table:
                return []
            
            # データ行を処理
            pitches = []
            rows = target_table.select("tbody tr")
            
            for row in rows:
                # 投球アイコンがある行のみ処理
                if not row.select_one("td span.bb-icon__ballCircle"):
                    continue
                
                cells = [td.text.strip() for td in row.select("td")]
                
                # 5セル形式: ['1', '1', 'ストレート', '144km/h', '見逃し']
                if len(cells) >= 5:
                    pitch_record = {
                        'game_id': game_id,
                        'index_code': index_code,
                        'pitch_sequence': int(cells[0]) if cells[0].isdigit() else 1,  # 投球数_打席内
                        'pitch_type': cells[2],      # 球種
                        'velocity': cells[3],        # 球速
                        'result': cells[4],          # 結果
                        'count': f"{cells[0]}/{cells[1]}",  # 打席内/合計 -> 既存スキーマのcount列
                        'zone': '',  # 後で座標から計算可能
                        'runners': '',
                        'pitcher_name': '',
                        'batter_name': ''
                    }
                    pitches.append(pitch_record)
            
            if pitches:
                logger.info(f"✅ 抽出成功: {len(pitches)}球 ({game_id}-{index_code})")
            
            return pitches
            
        except Exception as e:
            logger.error(f"一球速報抽出エラー {game_id}-{index_code}: {e}")
            return []
    
    def get_game_indexes(self, game_id):
        """試合の打席インデックス一覧を取得"""
        try:
            url = f"{BASE_URL}/game/{game_id}/score"
            headers = self.get_random_headers()
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.encoding = response.apparent_encoding
            soup = BeautifulSoup(response.text, 'html.parser')
            
            if response.status_code != 200:
                return []
            
            # 打席インデックスを抽出
            indexes = set()
            for link in soup.select('a[href*="score?index="]'):
                href = link.get('href', '')
                match = re.search(r'index=([^&]+)', href)
                if match:
                    indexes.add(match.group(1))
            
            logger.info(f"Found {len(indexes)} indexes for game {game_id}")
            return sorted(indexes)
            
        except Exception as e:
            logger.error(f"インデックス取得エラー {game_id}: {e}")
            return []
    
    def process_single_game(self, game_id):
        """1試合を完全処理"""
        logger.info(f"🎾 処理開始: {game_id}")
        
        indexes = self.get_game_indexes(game_id)
        if not indexes:
            logger.warning(f"❌ インデックス未取得: {game_id}")
            return 0, 0
        
        total_pitches = 0
        processed_indexes = 0
        
        for index_code in indexes:
            pitches = self.extract_pitch_data_production(game_id, index_code)
            
            if pitches:
                # データベースに保存 - 既存スキーマに合わせる
                with self.get_connection() as conn:
                    cursor = conn.cursor()
                    saved_count = 0
                    for pitch in pitches:
                        try:
                            cursor.execute('''
                                INSERT OR IGNORE INTO pitch_data 
                                (game_id, index_code, pitcher_name, batter_name, pitch_sequence,
                                 pitch_type, velocity, result, count, zone, runners)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                pitch['game_id'], pitch['index_code'], pitch['pitcher_name'],
                                pitch['batter_name'], pitch['pitch_sequence'], pitch['pitch_type'],
                                pitch['velocity'], pitch['result'], pitch['count'], pitch['zone'], pitch['runners']
                            ))
                            saved_count += 1
                        except sqlite3.Error as e:
                            logger.debug(f"保存エラー: {e}")
                    conn.commit()
                
                total_pitches += len(pitches)
                processed_indexes += 1
                logger.info(f"  📊 {index_code}: {len(pitches)}球保存")
            
            # 遅延（丁寧なスクレイピング）
            delay = random.uniform(PITCH_DELAY_MIN, PITCH_DELAY_MAX)
            time.sleep(delay)
        
        logger.info(f"✅ 完了: {game_id} - {processed_indexes}打席, {total_pitches}球")
        return processed_indexes, total_pitches
    
    def run_continuous_scraping(self):
        """連続スクレイピング実行"""
        logger.info("🚀 Yahoo野球連続スクレイピング開始 (本番版)")
        
        # テスト: 成功例で動作確認
        test_game_id = "2021030362"
        logger.info(f"🧪 テスト実行: {test_game_id}")
        test_indexes, test_pitches = self.process_single_game(test_game_id)
        
        if test_pitches > 0:
            logger.info(f"✅ テスト成功! {test_pitches}球収集")
            
            # データベース確認
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM pitch_data")
                db_count = cursor.fetchone()[0]
                logger.info(f"📊 データベース内総球数: {db_count}")
        else:
            logger.warning("❌ テスト失敗 - スクレイピングロジック確認要")
            return
        
        # 本格スクレイピング開始
        target_games = [
            "2021030362", "2021030302", "2021030322", "2021030342", 
            "2021030401", "2021030402", "2021030421", "2021030441",
            "2021030501", "2021030521", "2021030541", "2021030561"
        ]
        
        while True:
            try:
                for game_id in target_games:
                    # 既に処理済みかチェック
                    with self.get_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute('SELECT COUNT(*) FROM pitch_data WHERE game_id = ?', (game_id,))
                        existing_count = cursor.fetchone()[0]
                    
                    if existing_count > 0:
                        logger.info(f"⏭️  スキップ: {game_id} (既に{existing_count}球収集済み)")
                        continue
                    
                    # 試合を処理
                    start_time = time.time()
                    indexes_processed, pitches_collected = self.process_single_game(game_id)
                    processing_time = time.time() - start_time
                    
                    # 統計更新
                    if pitches_collected > 0:
                        self.state['total_games_processed'] += 1
                        self.state['total_pitches_collected'] += pitches_collected
                        self.save_state()
                        
                        logger.info(f"📈 累計: {self.state['total_games_processed']}試合, {self.state['total_pitches_collected']}球")
                    
                    # 45分間隔の調整
                    remaining_time = GAME_PROCESSING_TIME - processing_time
                    if remaining_time > 0:
                        logger.info(f"⏳ 次の試合まで {remaining_time:.0f}秒待機")
                        time.sleep(remaining_time)
                
                # 全試合処理後は新しい試合を探す
                logger.info("🔄 処理完了 - 新しい試合を検索中...")
                time.sleep(1800)  # 30分待機
                
            except KeyboardInterrupt:
                logger.info("🛑 スクレイピング停止")
                break
            except Exception as e:
                logger.error(f"❌ メインループエラー: {e}")
                time.sleep(300)  # 5分待機してリトライ

def main():
    """メイン実行"""
    scraper = YahooScraperProductionReady()
    scraper.run_continuous_scraping()

if __name__ == "__main__":
    main()