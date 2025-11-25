#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
npb_schedule_window.py
NPB公式から指定した日程ウィンドウ（±3〜7日または当月全体）のスケジュールを取得し、
DuckDBに格納する。

使い方:
  python3 npb_schedule_window.py --start 2025-07-01 --days 14 --league first
  python3 npb_schedule_window.py --start 2025-07-28 --days 7 --league farm
"""

import re, os, sys, time, json, argparse, random
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import duckdb

JST = timezone(timedelta(hours=9))
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; baseball-ai-media/npb-schedule; +https://baseball-ai-media.vercel.app)",
    "Accept-Language": "ja,en;q=0.8",
}
FIRST_BASE = "https://npb.jp/games"
FARM_BASE = "https://npb.jp/farm"
TIMEOUT = 20
SLEEP_RANGE = (1.2, 2.5)

# Team name normalization dictionary
TEAM_NORMALIZE = {
    "ＤｅＮＡ": "DeNA", "ＤｅＮａ": "DeNA", "横浜": "DeNA", "ベイスターズ": "DeNA",
    "ヤクルト": "ヤクルト", "スワローズ": "ヤクルト",
    "巨人": "巨人", "ジャイアンツ": "巨人", "読売": "巨人",
    "阪神": "阪神", "タイガース": "阪神",
    "広島": "広島", "カープ": "広島", "広島東洋": "広島",
    "中日": "中日", "ドラゴンズ": "中日",
    "日本ハム": "日本ハム", "ファイターズ": "日本ハム", "ハム": "日本ハム", "北海道日本ハム": "日本ハム",
    "楽天": "楽天", "イーグルス": "楽天", "東北楽天": "楽天",
    "ソフトバンク": "ソフトバンク", "ホークス": "ソフトバンク", "福岡ソフトバンク": "ソフトバンク",
    "西武": "西武", "ライオンズ": "西武", "埼玉西武": "西武",
    "ロッテ": "ロッテ", "マリーンズ": "ロッテ", "千葉ロッテ": "ロッテ",
    "オリックス": "オリックス", "バファローズ": "オリックス", "バファロー": "オリックス"
}

def sleep():
    time.sleep(random.uniform(*SLEEP_RANGE))

def get(url):
    resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp

def normalize_team_name(name: str) -> str:
    """Normalize team name using dictionary"""
    clean = (name or "").replace("　", " ").strip()
    return TEAM_NORMALIZE.get(clean, clean)

def normalize_status(text: str):
    """Normalize game status from Japanese text"""
    t = (text or "").strip()
    if "試合終了" in t or re.search(r"終了", t):
        return "FINAL"
    if "中止" in t or "ノーゲーム" in t:
        return "POSTPONED"
    if re.search(r"(回|表|裏)", t) and ("中" in t or "進行" in t):
        return "IN_PROGRESS"
    if "試合前" in t or "予定" in t or "開始" in t:
        return "SCHEDULED"
    if re.search(r"\d+\s*-\s*\d+", t):
        return "IN_PROGRESS"
    return "SCHEDULED"

def to_inning_half(text: str):
    """Parse inning and half from Japanese text"""
    m = re.search(r"(\d+)\s*回\s*(表|裏)", text or "")
    if not m:
        return None, None
    inn = int(m.group(1))
    half = "TOP" if m.group(2) == "表" else "BOTTOM"
    return inn, half

def parse_first_schedule(year: int, month: int, target_dates=None):
    """Parse first team schedule for specific dates in a month"""
    url = f"{FIRST_BASE}/{year}/schedule_{month:02d}_detail.html"
    print(f"Fetching: {url}")
    
    try:
        html = get(url).text
        sleep()
        soup = BeautifulSoup(html, "lxml")
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return []

    games = []
    for a in soup.select(f'a[href*="/scores/{year}/"]'):
        href = a.get("href", "")
        if not re.search(r"/scores/\d{4}/\d{4}/", href):
            continue
        
        full_url = urljoin("https://npb.jp", href)
        
        # Extract date from URL path
        m = re.search(r"/scores/(\d{4})/(\d{2})(\d{2})/", href)
        if not m:
            continue
            
        y, mm, dd = int(m.group(1)), int(m.group(2)), int(m.group(3))
        game_date = f"{y:04d}-{mm:02d}-{dd:02d}"
        
        # Filter by target dates if specified
        if target_dates and game_date not in target_dates:
            continue

        # Extract game key from URL (e.g., "db-s-15")
        key_match = re.search(r"/scores/\d{4}/\d{4}/([^/]+)/?", href)
        game_key = key_match.group(1) if key_match else "unknown"
        
        # Parse team info and score from surrounding text
        parent = a.find_parent(["tr", "li", "div"]) or a.parent
        if not parent:
            continue
            
        text = " ".join(parent.get_text(" ", strip=True).split())
        
        # Try to extract teams and score
        away_team = home_team = "TBD"
        away_score = home_score = None
        
        # Pattern: "team1 X-Y team2" format
        score_m = re.search(r"([^\s]+)\s+(\d+)\s*-\s*(\d+)\s+([^\s]+)", text)
        if score_m:
            away_team = normalize_team_name(score_m.group(1))
            away_score = int(score_m.group(2))
            home_score = int(score_m.group(3))
            home_team = normalize_team_name(score_m.group(4))
        else:
            # Pattern: "team1 vs team2" format
            vs_m = re.search(r"([^\s]+)\s+vs\.?\s+([^\s]+)", text, re.IGNORECASE)
            if vs_m:
                away_team = normalize_team_name(vs_m.group(1))
                home_team = normalize_team_name(vs_m.group(2))

        # Extract game status and inning
        status = normalize_status(text)
        inn, half = to_inning_half(text)
        inning_text = f"{inn}{'表' if half=='TOP' else '裏'}" if inn else None

        # Extract start time and venue
        time_m = re.search(r"(\d{1,2}:\d{2})", text)
        start_time = time_m.group(1) if time_m else None
        
        venue_m = re.search(r"(東京ドーム|ベルーナドーム|横浜スタジアム|甲子園|バンテリンドーム|マツダスタジアム|楽天モバイルパーク|札幌ドーム|PayPayドーム|京セラドーム|神宮|明治神宮)", text)
        venue = venue_m.group(1) if venue_m else None

        # Create game ID
        game_id = f"{y:04d}{mm:02d}{dd:02d}-{game_key}-npb"

        # Create links
        base_url = full_url.rstrip("/")
        links = {
            "index": f"{base_url}/index.html",
            "box": f"{base_url}/box.html",
            "pbp": f"{base_url}/playbyplay.html"
        }

        games.append({
            "game_id": game_id,
            "league": "first",
            "date": game_date,
            "start_time_jst": start_time,
            "venue": venue,
            "status": status,
            "inning": inning_text,
            "away_team": away_team,
            "home_team": home_team,
            "away_score": away_score,
            "home_score": home_score,
            "source": "npb",
            "links": json.dumps(links)
        })

    return games

def parse_farm_schedule(year: int, month: int, target_dates=None):
    """Parse farm team schedule for specific dates in a month"""
    url = f"{FARM_BASE}/{year}/schedule_{month:02d}_detail.html"
    print(f"Fetching: {url}")
    
    try:
        html = get(url).text
        sleep()
        soup = BeautifulSoup(html, "lxml")
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return []

    games = []
    for a in soup.select(f'a[href*="/bis/{year}/games/fs"]'):
        href = a.get("href", "")
        full_url = urljoin("https://npb.jp", href)
        
        # Extract date from farm URL
        m = re.search(r"/bis/(\d{4})/games/fs(\d{4})(\d{2})(\d{2})\d+\.html", href)
        if not m:
            continue
            
        y, mm, dd = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
        game_date = f"{y:04d}-{mm:02d}-{dd:02d}"
        
        # Filter by target dates if specified
        if target_dates and game_date not in target_dates:
            continue

        # Extract game info
        parent = a.find_parent(["tr", "li", "div"]) or a.parent
        if not parent:
            continue
        
        text = " ".join(parent.get_text(" ", strip=True).split())
        
        # Parse teams
        vs_m = re.search(r"([^\s]+)\s+vs\.?\s+([^\s]+)", text)
        away_team = normalize_team_name(vs_m.group(1)) if vs_m else "TBD"
        home_team = normalize_team_name(vs_m.group(2)) if vs_m else "TBD"

        # Extract start time
        time_m = re.search(r"(\d{1,2}:\d{2})", text)
        start_time = time_m.group(1) if time_m else None

        # Create game ID
        game_key = href.split("/")[-1].replace(".html", "")
        game_id = f"{y:04d}{mm:02d}{dd:02d}-{game_key}-farm-npb"

        games.append({
            "game_id": game_id,
            "league": "farm",
            "date": game_date,
            "start_time_jst": start_time,
            "venue": None,
            "status": "SCHEDULED",
            "inning": None,
            "away_team": away_team,
            "home_team": home_team,
            "away_score": None,
            "home_score": None,
            "source": "npb",
            "links": json.dumps({"page": full_url})
        })

    return games

def init_db(db_path: str):
    """Initialize DuckDB with games table"""
    conn = duckdb.connect(db_path)
    
    # Create games table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS games (
            game_id TEXT PRIMARY KEY,
            league TEXT,
            date DATE,
            start_time_jst TIME,
            venue TEXT,
            status TEXT,
            inning TEXT,
            away_team TEXT,
            home_team TEXT,
            away_score INTEGER,
            home_score INTEGER,
            source TEXT,
            links TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    return conn

def upsert_games(conn, games):
    """Upsert games into DuckDB (idempotent)"""
    if not games:
        return 0
    
    # Prepare data for insertion
    data = []
    for game in games:
        data.append((
            game["game_id"],
            game["league"],
            game["date"],
            game["start_time_jst"],
            game["venue"],
            game["status"],
            game["inning"],
            game["away_team"],
            game["home_team"],
            game["away_score"],
            game["home_score"],
            game["source"],
            game["links"]
        ))
    
    # Upsert using INSERT OR REPLACE
    conn.executemany("""
        INSERT OR REPLACE INTO games (
            game_id, league, date, start_time_jst, venue, status, inning,
            away_team, home_team, away_score, home_score, source, links
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, data)
    
    return len(data)

def main():
    parser = argparse.ArgumentParser(description="Fetch NPB schedule for a date window")
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--days", type=int, default=7, help="Number of days to fetch")
    parser.add_argument("--league", choices=["first", "farm", "both"], default="both")
    parser.add_argument("--db", default="data/npb.db", help="DuckDB database path")
    
    args = parser.parse_args()
    
    # Parse start date
    start_date = datetime.strptime(args.start, "%Y-%m-%d").date()
    
    # Generate target dates
    target_dates = set()
    for i in range(args.days):
        date = start_date + timedelta(days=i)
        target_dates.add(date.strftime("%Y-%m-%d"))
    
    print(f"Fetching schedule for dates: {sorted(target_dates)}")
    
    # Initialize database
    os.makedirs(os.path.dirname(args.db), exist_ok=True)
    conn = init_db(args.db)
    
    all_games = []
    
    # Determine which months to fetch
    months_to_fetch = set()
    for date_str in target_dates:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        months_to_fetch.add((date_obj.year, date_obj.month))
    
    # Fetch games
    for year, month in sorted(months_to_fetch):
        if args.league in ["first", "both"]:
            games = parse_first_schedule(year, month, target_dates)
            all_games.extend(games)
            print(f"Found {len(games)} first team games for {year}-{month:02d}")
        
        if args.league in ["farm", "both"]:
            games = parse_farm_schedule(year, month, target_dates)
            all_games.extend(games)
            print(f"Found {len(games)} farm team games for {year}-{month:02d}")
    
    # Insert into database
    inserted = upsert_games(conn, all_games)
    print(f"Upserted {inserted} games into database")
    
    # Show summary
    result = conn.execute("""
        SELECT league, COUNT(*) as games, 
               MIN(date) as earliest, MAX(date) as latest
        FROM games 
        WHERE date BETWEEN ? AND ?
        GROUP BY league
        ORDER BY league
    """, [args.start, (start_date + timedelta(days=args.days-1)).strftime("%Y-%m-%d")]).fetchall()
    
    print("\nDatabase summary for date range:")
    for row in result:
        print(f"  {row[0]}: {row[1]} games ({row[2]} to {row[3]})")
    
    conn.close()

if __name__ == "__main__":
    main()