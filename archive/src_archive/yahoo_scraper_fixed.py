#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yahoo野球 24時間連続スクレイピングシステム (修正版)
データ抽出ロジック修正 - 過去の成功パターンに基づく
"""

import requests
import pandas as pd
from bs4 import BeautifulSoup
import time
import random
import os
import json
import sqlite3
from datetime import datetime, timedelta
import logging
from urllib.parse import urljoin
import re
from contextlib import contextmanager

# ===== 設定 =====
BASE_URL = "https://baseball.yahoo.co.jp/npb"
DATA_DIR = "data/yahoo_continuous"
DB_PATH = os.path.join(DATA_DIR, "yahoo_games.db")
LOG_PATH = os.path.join(DATA_DIR, "scraper.log")
STATE_FILE = os.path.join(DATA_DIR, "scraper_state.json")

# タイミング設定（45分/試合 = 2700秒/試合）
GAME_PROCESSING_TIME = 2700  # 45分 = 2700秒
PITCH_DELAY_MIN = 8   # 最小8秒間隔
PITCH_DELAY_MAX = 15  # 最大15秒間隔
REQUEST_TIMEOUT = 30  # リクエストタイムアウト

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

class YahooScraperFixed:
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
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        ]
        return {
            'User-Agent': random.choice(user_agents),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    
    def init_database(self):
        """データベース初期化"""
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
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS pitch_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id TEXT,
                    index_code TEXT,
                    pitcher_name TEXT,
                    batter_name TEXT,
                    pitch_sequence INTEGER,
                    pitch_type TEXT,
                    velocity INTEGER,
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
    
    def extract_pitch_data_fixed(self, game_id, index_code):
        """修正版: 一球速報データ抽出"""
        try:
            url = f"{BASE_URL}/game/{game_id}/score?index={index_code}"
            headers = self.get_random_headers()
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.encoding = response.apparent_encoding
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 成功パターンに基づく抽出ロジック
            pitches = []
            
            # まず詳しい投球内容セクションを探す
            pitch_details_section = soup.select_one("section.bb-splits__item:has(h3.bb-head02__title:-soup-contains('詳しい投球内容'))")
            
            table = None
            if pitch_details_section:
                table = pitch_details_section.select_one("table.bb-splitsTable:has(thead)")
            
            # フォールバック: すべてのsplitsTableから適切なものを探す
            if not table:
                all_tables = soup.select("table.bb-splitsTable")
                for tbl in all_tables:
                    headers = [th.text.strip() for th in tbl.select("thead th")]
                    if "投球数" in headers and "球種" in headers and "球速" in headers and "結果" in headers:
                        table = tbl
                        break
            
            if not table:
                logger.debug(f"投球テーブル見つからず: {url}")
                return []
            
            # ヘッダー解析
            header_row = table.select_one("thead tr")
            if not header_row:
                return []
            
            headers = []
            for th in header_row.select("th.bb-splitsTable__head"):
                th_text = th.text.strip()
                colspan = int(th.get('colspan', 1))
                
                if colspan > 1:
                    if th_text == "投球数":
                        headers.append("投球数_打席内")
                        headers.append("投球数_合計")
                    else:
                        for i in range(colspan):
                            headers.append(f"{th_text}_{i+1}")
                else:
                    headers.append(th_text)
            
            # 必要なカラムの確認
            required_cols = ["球種", "球速", "結果"]
            if not all(col in headers for col in required_cols):
                logger.debug(f"必要なヘッダーなし: {headers}")
                return []
            
            # データ行の解析
            rows = table.select("tbody tr")
            for i, tr in enumerate(rows, start=1):
                # 投球アイコンがある行のみ処理
                if not tr.select_one("td span.bb-icon__ballCircle"):
                    continue
                
                cells = [td.text.strip() for td in tr.select("td")]
                
                if len(cells) != len(headers):
                    logger.debug(f"セル数不一致: {len(cells)} vs {len(headers)}")
                    continue
                
                # データ辞書作成
                pitch_data = dict(zip(headers, cells))
                
                # 球速処理
                velocity = 0
                if '球速' in pitch_data and pitch_data['球速'] != '-':
                    velocity_match = re.search(r'(\d+)', pitch_data['球速'])
                    if velocity_match:
                        velocity = int(velocity_match.group(1))
                
                pitch_record = {
                    'game_id': game_id,
                    'index_code': index_code,
                    'pitch_sequence': pitch_data.get('投球数_打席内', str(i)),
                    'pitch_type': pitch_data.get('球種', ''),
                    'velocity': velocity,
                    'result': pitch_data.get('結果', ''),
                    'count': f"{pitch_data.get('ボール', '0')}-{pitch_data.get('ストライク', '0')}" if 'ボール' in pitch_data else '',
                    'zone': pitch_data.get('コース', ''),
                    'runners': '',  # 後で追加可能
                    'pitcher_name': '',  # 後で追加可能 
                    'batter_name': ''   # 後で追加可能
                }
                
                pitches.append(pitch_record)
            
            logger.info(f"抽出完了: {len(pitches)}球 ({game_id}-{index_code})")
            return pitches
            
        except Exception as e:
            logger.error(f"一球速報抽出エラー {game_id}-{index_code}: {e}")
            return []
    
    def process_game_indexes(self, game_id):
        """試合の全打席インデックス処理"""
        try:
            # スコアページから打席インデックスを取得
            url = f"{BASE_URL}/game/{game_id}/score"
            headers = self.get_random_headers()
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.encoding = response.apparent_encoding
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 打席インデックスを抽出
            indexes = set()
            for link in soup.select('a[href*="score?index="]'):
                href = link.get('href', '')
                match = re.search(r'index=([^&]+)', href)
                if match:
                    indexes.add(match.group(1))
            
            total_pitches = 0
            processed_indexes = 0
            
            for index_code in sorted(indexes):
                # 一球速報データ抽出
                pitches = self.extract_pitch_data_fixed(game_id, index_code)
                
                if pitches:
                    # データベースに保存
                    with self.get_connection() as conn:
                        cursor = conn.cursor()
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
                                    pitch['velocity'], pitch['result'], pitch['count'],
                                    pitch['zone'], pitch['runners']
                                ))
                            except sqlite3.Error as e:
                                logger.warning(f"データ保存エラー: {e}")
                        conn.commit()
                    
                    total_pitches += len(pitches)
                    processed_indexes += 1
                
                # 遅延
                delay = random.uniform(PITCH_DELAY_MIN, PITCH_DELAY_MAX)
                time.sleep(delay)
            
            logger.info(f"試合処理完了 {game_id}: {processed_indexes}打席, {total_pitches}球")
            
            # 統計更新
            self.state['total_pitches_collected'] += total_pitches
            self.save_state()
            
            return processed_indexes, total_pitches
            
        except Exception as e:
            logger.error(f"試合処理エラー {game_id}: {e}")
            return 0, 0
    
    def get_recent_games(self, days_back=30):
        """最近の試合一覧取得"""
        games = []
        current_date = datetime.now()
        
        for i in range(days_back):
            target_date = current_date - timedelta(days=i)
            date_str = target_date.strftime('%Y/%m/%d')
            
            try:
                url = f"{BASE_URL}/schedule/?date={date_str}"
                headers = self.get_random_headers()
                
                response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
                response.encoding = response.apparent_encoding
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # 試合リンクを抽出
                for link in soup.select('a[href*="/game/"]'):
                    href = link.get('href', '')
                    game_id_match = re.search(r'/game/(\d+)/', href)
                    if game_id_match:
                        game_id = game_id_match.group(1)
                        
                        # チーム名を抽出
                        team_names = link.select('.team-name, .bb-gameCard__team')
                        home_team = team_names[0].text.strip() if len(team_names) > 0 else ''
                        away_team = team_names[1].text.strip() if len(team_names) > 1 else ''
                        
                        games.append({
                            'game_id': game_id,
                            'date': target_date.strftime('%Y-%m-%d'),
                            'home_team': home_team,
                            'away_team': away_team,
                            'status': '終了'
                        })
                
                # 遅延
                time.sleep(random.uniform(2, 5))
                
            except Exception as e:
                logger.warning(f"試合一覧取得エラー ({date_str}): {e}")
        
        return games
    
    def run_continuous_scraping(self):
        """連続スクレイピング実行"""
        logger.info("Yahoo野球連続スクレイピング開始 (修正版)")
        
        while True:
            try:
                # 新しい試合を取得
                recent_games = self.get_recent_games(30)
                
                # データベースに未処理試合を保存
                with self.get_connection() as conn:
                    cursor = conn.cursor()
                    for game in recent_games:
                        cursor.execute('''
                            INSERT OR IGNORE INTO games 
                            (game_id, date, home_team, away_team, status)
                            VALUES (?, ?, ?, ?, ?)
                        ''', (game['game_id'], game['date'], game['home_team'], 
                              game['away_team'], game['status']))
                    conn.commit()
                
                # 未処理試合を取得
                with self.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT game_id, date, home_team, away_team 
                        FROM games 
                        WHERE processed = 0 
                        ORDER BY date DESC 
                        LIMIT 10
                    ''')
                    pending_games = cursor.fetchall()
                
                if not pending_games:
                    logger.info("新しい未処理試合なし - 30分待機")
                    time.sleep(1800)  # 30分待機
                    continue
                
                # 試合処理
                for game_id, date, home_team, away_team in pending_games:
                    logger.info(f"処理開始: {game_id} ({date}) {away_team} vs {home_team}")
                    
                    start_time = time.time()
                    indexes_processed, pitches_collected = self.process_game_indexes(game_id)
                    processing_time = time.time() - start_time
                    
                    # 処理完了マーク
                    with self.get_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute('''
                            UPDATE games 
                            SET processed = 1 
                            WHERE game_id = ?
                        ''', (game_id,))
                        conn.commit()
                    
                    # 統計更新
                    self.state['total_games_processed'] += 1
                    self.save_state()
                    
                    logger.info(f"完了: {game_id} - {indexes_processed}打席, {pitches_collected}球 ({processing_time:.1f}秒)")
                    
                    # 45分間隔の調整
                    remaining_time = GAME_PROCESSING_TIME - processing_time
                    if remaining_time > 0:
                        logger.info(f"次の試合まで {remaining_time:.0f}秒待機")
                        time.sleep(remaining_time)
                
            except KeyboardInterrupt:
                logger.info("スクレイピング停止")
                break
            except Exception as e:
                logger.error(f"メインループエラー: {e}")
                time.sleep(300)  # 5分待機してリトライ

def main():
    """メイン実行"""
    scraper = YahooScraperFixed()
    scraper.run_continuous_scraping()

if __name__ == "__main__":
    main()