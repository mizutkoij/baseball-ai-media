#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NPB Historical Data Scraper - 過去データ包括的収集システム
NPB公式サイトから過去の試合データを効率的に収集する
"""

import re, os, sys, time, json, argparse, random
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
import sqlite3
import threading
from queue import Queue
import logging

JST = timezone(timedelta(hours=9))
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; baseball-ai-media/npb-historical; +https://baseball-ai-media.vercel.app)",
    "Accept-Language": "ja,en;q=0.8",
}
TIMEOUT = 30
SLEEP_RANGE = (2.0, 4.0)  # 丁寧なスクレイピング

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def sleep():
    time.sleep(random.uniform(*SLEEP_RANGE))

def get(url, retries=3):
    """リトライ機能付きHTTPリクエスト"""
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt < retries - 1:
                wait_time = (attempt + 1) * 5
                logger.warning(f"リクエスト失敗 (試行 {attempt+1}/{retries}): {e}, {wait_time}秒後にリトライ...")
                time.sleep(wait_time)
            else:
                raise

def get_date_range_games(start_date, end_date):
    """指定期間のNPB試合データを取得"""
    logger.info(f"期間: {start_date} から {end_date} の試合データ収集開始")
    
    games = []
    current_date = start_date
    
    while current_date <= end_date:
        year = current_date.year
        month = current_date.month
        
        # 月別スケジュールページから試合を取得
        schedule_url = f"https://npb.jp/games/{year}/schedule_{month:02d}_detail.html"
        
        try:
            logger.info(f"{current_date.strftime('%Y-%m')} の試合スケジュール取得中...")
            response = get(schedule_url)
            response.encoding = 'utf-8'
            soup = BeautifulSoup(response.text, "lxml")
            sleep()
            
            # その日の試合URLを検索
            for a in soup.select(f'a[href*="/scores/{year}/"]'):
                href = a.get("href", "")
                if not re.search(r"/scores/\d{4}/\d{4}/", href):
                    continue
                
                # 日付を抽出
                m = re.search(r"/scores/(\d{4})/(\d{2})(\d{2})/", href)
                if not m:
                    continue
                
                game_date = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).date()
                
                # 指定期間内の試合のみ処理
                if start_date <= game_date <= end_date:
                    full_url = urljoin("https://npb.jp", href)
                    games.append({
                        'date': game_date.isoformat(),
                        'url': full_url,
                        'game_id': href.split('/')[-2]  # URL末尾のID部分
                    })
                    
        except Exception as e:
            logger.error(f"スケジュール取得エラー ({current_date.strftime('%Y-%m')}): {e}")
        
        # 次の月へ
        if current_date.month == 12:
            current_date = current_date.replace(year=current_date.year + 1, month=1)
        else:
            current_date = current_date.replace(month=current_date.month + 1)
    
    logger.info(f"総試合数: {len(games)}件")
    return games

def scrape_game_details(game_url):
    """個別試合の詳細データを取得"""
    try:
        response = get(game_url)
        response.encoding = 'utf-8'
        soup = BeautifulSoup(response.text, "lxml")
        sleep()
        
        game_data = {
            'url': game_url,
            'scraped_at': datetime.now(JST).isoformat(),
            'teams': {},
            'score': {},
            'innings': {},
            'batting_stats': {'away': [], 'home': []},
            'pitching_stats': {'away': [], 'home': []},
            'game_info': {}
        }
        
        # チーム名を取得
        team_elements = soup.select('.team-name, .teamName')
        if len(team_elements) >= 2:
            game_data['teams']['away'] = team_elements[0].get_text(strip=True)
            game_data['teams']['home'] = team_elements[1].get_text(strip=True)
        
        # スコアを取得
        score_elements = soup.select('.score, .total-score')
        if len(score_elements) >= 2:
            try:
                game_data['score']['away'] = int(score_elements[0].get_text(strip=True))
                game_data['score']['home'] = int(score_elements[1].get_text(strip=True))
            except:
                pass
        
        # イニング別スコアを取得
        inning_table = soup.find('table', class_='inning-score')
        if inning_table:
            rows = inning_table.find_all('tr')
            if len(rows) >= 3:
                # ビジター
                away_innings = []
                for cell in rows[1].find_all('td')[1:10]:  # チーム名をスキップして9イニング
                    try:
                        away_innings.append(int(cell.get_text(strip=True)))
                    except:
                        away_innings.append(0)
                game_data['innings']['away'] = away_innings
                
                # ホーム
                home_innings = []
                for cell in rows[2].find_all('td')[1:10]:
                    try:
                        home_innings.append(int(cell.get_text(strip=True)))
                    except:
                        home_innings.append(0)
                game_data['innings']['home'] = home_innings
        
        # 試合情報（日付、球場など）
        date_elem = soup.select_one('.game-date, .date')
        if date_elem:
            game_data['game_info']['date'] = date_elem.get_text(strip=True)
        
        venue_elem = soup.select_one('.venue, .stadium')
        if venue_elem:
            game_data['game_info']['venue'] = venue_elem.get_text(strip=True)
        
        return game_data
        
    except Exception as e:
        logger.error(f"試合詳細取得エラー ({game_url}): {e}")
        return None

def setup_database(db_path):
    """データベース初期化"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 試合テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS historical_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id TEXT UNIQUE,
            date TEXT,
            away_team TEXT,
            home_team TEXT,
            away_score INTEGER,
            home_score INTEGER,
            venue TEXT,
            game_data TEXT,  -- JSON形式で全データ保存
            scraped_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    return conn

def save_game_data(conn, game_id, date, game_data):
    """試合データをデータベースに保存"""
    try:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO historical_games 
            (game_id, date, away_team, home_team, away_score, home_score, venue, game_data, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            game_id,
            date,
            game_data.get('teams', {}).get('away', ''),
            game_data.get('teams', {}).get('home', ''),
            game_data.get('score', {}).get('away', 0),
            game_data.get('score', {}).get('home', 0),
            game_data.get('game_info', {}).get('venue', ''),
            json.dumps(game_data, ensure_ascii=False),
            game_data.get('scraped_at', '')
        ))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"データ保存エラー (game_id: {game_id}): {e}")
        return False

def scrape_historical_data(start_date, end_date, output_db, max_workers=1):
    """歴史データの包括的スクレイピング - シングルスレッド版"""
    logger.info("NPB歴史データスクレイピング開始")
    
    # データベースセットアップ
    conn = setup_database(output_db)
    
    # 既存データチェック
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM historical_games WHERE date BETWEEN ? AND ?", 
                   (start_date.isoformat(), end_date.isoformat()))
    existing_count = cursor.fetchone()[0]
    logger.info(f"既存データ: {existing_count}件")
    
    # 試合リスト取得
    games = get_date_range_games(start_date, end_date)
    
    if not games:
        logger.warning("取得する試合データがありません")
        return
    
    # 既存データをフィルタリング
    cursor.execute("SELECT game_id FROM historical_games")
    existing_game_ids = {row[0] for row in cursor.fetchall()}
    new_games = [game for game in games if game['game_id'] not in existing_game_ids]
    
    logger.info(f"新規取得対象: {len(new_games)}件")
    
    if not new_games:
        logger.info("新規取得対象がありません - 完了")
        conn.close()
        return
    
    # シングルスレッドで順次処理
    completed = 0
    total_games = len(new_games)
    
    for game in new_games:
        try:
            game_data = scrape_game_details(game['url'])
            if game_data:
                success = save_game_data(conn, game['game_id'], game['date'], game_data)
                if success:
                    completed += 1
                    logger.info(f"完了: {completed}/{total_games} ({completed/total_games*100:.1f}%) - {game['date']} {game_data.get('teams', {}).get('away', '')} vs {game_data.get('teams', {}).get('home', '')}")
                else:
                    logger.warning(f"データ保存失敗: {game['game_id']}")
            else:
                logger.warning(f"データ取得失敗: {game['game_id']}")
        except Exception as e:
            logger.error(f"処理エラー ({game['game_id']}): {e}")
    
    logger.info(f"NPB歴史データスクレイピング完了 - {completed}件処理")
    conn.close()

def main():
    parser = argparse.ArgumentParser(description='NPB Historical Data Scraper')
    parser.add_argument('--start-date', required=True, help='開始日 (YYYY-MM-DD)')
    parser.add_argument('--end-date', required=True, help='終了日 (YYYY-MM-DD)')
    parser.add_argument('--output-db', '-o', default='data/npb_historical.db', help='出力データベースファイル')
    parser.add_argument('--workers', '-w', type=int, default=3, help='並列ワーカー数')
    parser.add_argument('--verbose', '-v', action='store_true', help='詳細出力')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        start_date = datetime.strptime(args.start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(args.end_date, '%Y-%m-%d').date()
    except ValueError:
        logger.error("日付形式が正しくありません (YYYY-MM-DD)")
        return
    
    if start_date > end_date:
        logger.error("開始日は終了日より前である必要があります")
        return
    
    # 出力ディレクトリ作成
    os.makedirs(os.path.dirname(args.output_db), exist_ok=True)
    
    scrape_historical_data(start_date, end_date, args.output_db, args.workers)

if __name__ == "__main__":
    main()