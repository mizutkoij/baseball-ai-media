#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yahoo野球 24時間連続スクレイピングシステム (軽量版)
45分/試合のペースで過去試合データを効率的に収集
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
import concurrent.futures
import threading
from queue import Queue

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

class YahooContinuousScraper:
    def __init__(self):
        self.session = requests.Session()
        self.setup_session()
        self.init_database()
        self.load_state()
        self.game_queue = Queue()
        self.stats = {
            'games_processed': 0,
            'pitches_collected': 0,
            'errors': 0,
            'start_time': datetime.now()
        }
        
    def setup_session(self):
        """リクエストセッション設定"""
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        ]
        self.session.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })

    def get_random_headers(self):
        """ランダムなUser-Agentヘッダーを返す"""
        return {'User-Agent': random.choice(self.user_agents)}

    def init_database(self):
        """SQLiteデータベース初期化"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # ゲーム情報テーブル
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS games (
                game_id TEXT PRIMARY KEY,
                date TEXT,
                home_team TEXT,
                away_team TEXT,
                venue TEXT,
                status TEXT,
                league TEXT,
                url TEXT,
                processed BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 一球速報テーブル
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pitches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT,
                index_code TEXT,
                inning INTEGER,
                side INTEGER,
                batter_num INTEGER,
                pitch_num INTEGER,
                pitcher TEXT,
                batter TEXT,
                pitch_type TEXT,
                velocity INTEGER,
                zone TEXT,
                result TEXT,
                count_balls INTEGER,
                count_strikes INTEGER,
                runners TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES games (game_id)
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info("データベース初期化完了")

    def load_state(self):
        """前回の処理状態を読み込み"""
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                self.state = json.load(f)
        else:
            self.state = {
                'last_processed_date': '2025-02-01',
                'current_game_id': None,
                'total_games_processed': 0
            }
        logger.info(f"前回処理日: {self.state['last_processed_date']}")

    def save_state(self):
        """処理状態を保存"""
        with open(STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)

    def fetch_daily_schedule(self, date):
        """指定日の試合スケジュールを取得"""
        try:
            url = f"{BASE_URL}/schedule/?date={date.strftime('%Y-%m-%d')}"
            headers = self.get_random_headers()
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            response.encoding = response.apparent_encoding
            
            soup = BeautifulSoup(response.text, 'html.parser')
            games = []
            
            for section in soup.select("section.bb-score"):
                for item in section.select("li.bb-score__item"):
                    status_tag = item.select_one("p.bb-score__link")
                    if not status_tag or status_tag.get_text(strip=True) != "試合終了":
                        continue
                        
                    a = item.select_one("a.bb-score__content")
                    if not a or 'href' not in a.attrs:
                        continue
                        
                    # game_id抽出
                    import re
                    match = re.search(r"/game/(\d+)/", a['href'])
                    if not match:
                        continue
                        
                    game_id = match.group(1)
                    home_team = item.select_one('p.bb-score__homeLogo').get_text(strip=True)
                    away_team = item.select_one('p.bb-score__awayLogo').get_text(strip=True)
                    venue_elem = item.select_one("span.bb-score__venue")
                    venue = venue_elem.get_text(strip=True) if venue_elem else ""
                    
                    games.append({
                        'game_id': game_id,
                        'date': date.strftime('%Y-%m-%d'),
                        'home_team': home_team,
                        'away_team': away_team,
                        'venue': venue,
                        'status': '試合終了',
                        'league': self.detect_league(home_team, away_team),
                        'url': urljoin(BASE_URL, a['href'])
                    })
                    
            return games
            
        except Exception as e:
            logger.error(f"日程取得エラー {date}: {e}")
            return []

    def detect_league(self, home, away):
        """リーグ判定"""
        central = {"巨人", "阪神", "中日", "DeNA", "広島", "ヤクルト"}
        pacific = {"ロッテ", "ソフトバンク", "楽天", "日本ハム", "オリックス", "西武"}
        
        if home in central and away in central:
            return "セ・リーグ"
        elif home in pacific and away in pacific:
            return "パ・リーグ"
        elif ({home, away} & central) and ({home, away} & pacific):
            return "交流戦"
        return "その他"

    def save_games_to_db(self, games):
        """ゲーム情報をDBに保存"""
        if not games:
            return
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        for game in games:
            cursor.execute('''
                INSERT OR REPLACE INTO games 
                (game_id, date, home_team, away_team, venue, status, league, url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                game['game_id'], game['date'], game['home_team'], 
                game['away_team'], game['venue'], game['status'], 
                game['league'], game['url']
            ))
        
        conn.commit()
        conn.close()
        logger.info(f"{len(games)}試合をDBに保存")

    def get_max_inning(self, game_id):
        """試合の最大イニング数を取得"""
        try:
            url = f"{BASE_URL}/game/{game_id}/score"
            headers = self.get_random_headers()
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.encoding = response.apparent_encoding
            soup = BeautifulSoup(response.text, 'html.parser')
            
            ths = soup.select("table.bb-gameScoreTable thead th")
            if ths and len(ths) >= 4:
                return len(ths) - 3  # 先頭3列を除いたイニング数
                
        except Exception as e:
            logger.warning(f"最大イニング取得エラー {game_id}: {e}")
            
        return 9  # デフォルト

    def extract_pitch_data(self, game_id, index_code):
        """一球速報データを抽出"""
        try:
            url = f"{BASE_URL}/game/{game_id}/score?index={index_code}"
            headers = self.get_random_headers()
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.encoding = response.apparent_encoding
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # splitsTableの存在確認
            splits_table = soup.select_one("table.bb-splitsTable")
            if not splits_table:
                return None
                
            # データ抽出（簡略化）
            pitches = []
            for row in splits_table.select("tr")[1:]:  # ヘッダー除く
                cells = row.select("td")
                if len(cells) >= 6:
                    pitch_data = {
                        'game_id': game_id,
                        'index_code': index_code,
                        'pitch_type': cells[1].get_text(strip=True) if len(cells) > 1 else '',
                        'velocity': self.extract_velocity(cells[2].get_text(strip=True)) if len(cells) > 2 else 0,
                        'result': cells[3].get_text(strip=True) if len(cells) > 3 else '',
                        'count': cells[4].get_text(strip=True) if len(cells) > 4 else ''
                    }
                    pitches.append(pitch_data)
                    
            return pitches
            
        except Exception as e:
            logger.warning(f"一球速報抽出エラー {game_id}-{index_code}: {e}")
            return None

    def extract_velocity(self, text):
        """球速を数値で抽出"""
        import re
        match = re.search(r'(\d+)', text)
        return int(match.group(1)) if match else 0

    def process_single_game(self, game_id):
        """1試合分のデータを処理（45分で完了する設計）"""
        start_time = time.time()
        logger.info(f"試合処理開始: {game_id}")
        
        try:
            max_inning = self.get_max_inning(game_id)
            total_pitches = 0
            
            # インデックス生成と処理
            for inning in range(1, max_inning + 1):
                for side in [1, 2]:  # 表=1, 裏=2
                    for batter in range(1, 10):  # 1-9番打者
                        for suffix in ["00", "01"]:
                            index_code = f"{inning:02d}{side}{batter:02d}{suffix}"
                            
                            # 一球速報データ取得
                            pitches = self.extract_pitch_data(game_id, index_code)
                            if pitches:
                                total_pitches += len(pitches)
                                # DB保存は省略（メモリ節約）
                            
                            # 動的ディレイ（残り時間に基づく調整）
                            elapsed = time.time() - start_time
                            remaining_time = GAME_PROCESSING_TIME - elapsed
                            
                            if remaining_time > 0:
                                # 残り処理数を推定してディレイ調整
                                estimated_remaining = (max_inning - inning + 1) * 18 + (9 - batter) * 2 + (1 if suffix == "00" else 0)
                                if estimated_remaining > 0:
                                    adaptive_delay = min(remaining_time / estimated_remaining, PITCH_DELAY_MAX)
                                    adaptive_delay = max(adaptive_delay, PITCH_DELAY_MIN)
                                else:
                                    adaptive_delay = PITCH_DELAY_MIN
                            else:
                                adaptive_delay = PITCH_DELAY_MIN
                                
                            time.sleep(random.uniform(adaptive_delay * 0.8, adaptive_delay * 1.2))
            
            # 試合完了をマーク
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("UPDATE games SET processed = 1 WHERE game_id = ?", (game_id,))
            conn.commit()
            conn.close()
            
            elapsed_total = time.time() - start_time
            logger.info(f"試合処理完了: {game_id}, {total_pitches}球, {elapsed_total:.1f}秒")
            
            self.stats['games_processed'] += 1
            self.stats['pitches_collected'] += total_pitches
            
        except Exception as e:
            logger.error(f"試合処理エラー {game_id}: {e}")
            self.stats['errors'] += 1

    def get_unprocessed_games(self, limit=100):
        """未処理の試合を取得"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT game_id, date, home_team, away_team 
            FROM games 
            WHERE processed = 0 
            ORDER BY date DESC
            LIMIT ?
        ''', (limit,))
        games = cursor.fetchall()
        conn.close()
        return games

    def collect_historical_schedules(self):
        """過去の試合スケジュールを収集"""
        start_date = datetime.strptime(self.state['last_processed_date'], '%Y-%m-%d')
        end_date = datetime.now() - timedelta(days=1)
        
        current_date = start_date
        while current_date <= end_date:
            logger.info(f"日程収集: {current_date.strftime('%Y-%m-%d')}")
            games = self.fetch_daily_schedule(current_date)
            if games:
                self.save_games_to_db(games)
                logger.info(f"{len(games)}試合を発見")
            
            current_date += timedelta(days=1)
            time.sleep(random.uniform(2, 4))  # 日程取得間のディレイ
            
        # 処理日を更新
        self.state['last_processed_date'] = end_date.strftime('%Y-%m-%d')
        self.save_state()

    def run_continuous_processing(self):
        """24時間連続処理メインループ"""
        logger.info("24時間連続処理開始")
        
        while True:
            try:
                # 1. 未処理試合の確認
                unprocessed = self.get_unprocessed_games(50)
                
                if not unprocessed:
                    logger.info("新しい日程データを収集中...")
                    self.collect_historical_schedules()
                    unprocessed = self.get_unprocessed_games(50)
                
                if not unprocessed:
                    logger.info("処理可能な試合がありません。1時間待機...")
                    time.sleep(3600)
                    continue
                
                # 2. 試合を順次処理
                for game_id, date, home, away in unprocessed:
                    logger.info(f"処理開始: {date} {home} vs {away} (ID: {game_id})")
                    self.process_single_game(game_id)
                    
                    # 統計情報表示
                    if self.stats['games_processed'] % 10 == 0:
                        self.print_stats()
                    
                    # 状態保存
                    self.state['current_game_id'] = game_id
                    self.state['total_games_processed'] = self.stats['games_processed']
                    self.save_state()
                
            except KeyboardInterrupt:
                logger.info("手動停止")
                break
            except Exception as e:
                logger.error(f"メインループエラー: {e}")
                time.sleep(300)  # 5分待機後再開

    def print_stats(self):
        """統計情報を表示"""
        elapsed = datetime.now() - self.stats['start_time']
        logger.info(f"""
=== 処理統計 ===
稼働時間: {elapsed}
処理試合数: {self.stats['games_processed']}
収集球数: {self.stats['pitches_collected']}
エラー回数: {self.stats['errors']}
処理レート: {self.stats['games_processed'] / max(elapsed.total_seconds() / 3600, 1):.2f} 試合/時間
""")

def main():
    """メイン実行関数"""
    scraper = YahooContinuousScraper()
    
    try:
        scraper.run_continuous_processing()
    except Exception as e:
        logger.error(f"予期せぬエラー: {e}")
    finally:
        scraper.save_state()
        logger.info("プログラム終了")

if __name__ == "__main__":
    main()