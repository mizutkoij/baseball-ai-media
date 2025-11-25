# step_1_schedule_scraper.py (最終実行日記録・差分更新版)

import pandas as pd
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import os
import re
import time
import glob
from urllib.parse import urljoin

# === 設定 ===
BASE_URL = "https://baseball.yahoo.co.jp/npb"
OUTPUT_DIR = "fetch/data/game_info"
LAST_RUN_FILE = os.path.join(OUTPUT_DIR, "last_run_date.txt") # 最終実行日を記録するファイル
os.makedirs(OUTPUT_DIR, exist_ok=True)

# === デフォルトの取得開始日（初回実行時のみ使用） ===
DEFAULT_START_DATE = datetime(2025, 2, 10)

# === 2軍含む gameKindIds パラメータ ===
GAME_KIND_IDS = "60,61,62,13,11,64,65,66,272"
CENTRAL_TEAMS = {"巨人", "阪神", "中日", "DeNA", "広島", "ヤクルト"}
PACIFIC_TEAMS = {"ロッテ", "ソフトバンク", "楽天", "日本ハム", "オリックス", "西武"}
VALID_STATUS = {"試合終了", "試合中止", "ノーゲーム"}

def detect_league(home, away):
    if home in CENTRAL_TEAMS and away in CENTRAL_TEAMS: return "セ・リーグ"
    if home in PACIFIC_TEAMS and away in PACIFIC_TEAMS: return "パ・リーグ"
    if ({home, away} & CENTRAL_TEAMS) and ({home, away} & PACIFIC_TEAMS): return "交流戦"
    return "その他"

def fetch_daily_schedule(date, game_kind_ids=None):
    url = f"{BASE_URL}/schedule/?date={date:%Y-%m-%d}"
    if game_kind_ids: url += f"&gameKindIds={game_kind_ids}"
    
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        res.encoding = res.apparent_encoding
        soup = BeautifulSoup(res.text, "html.parser")
    except requests.RequestException as e:
        print(f"  Error fetching {url}: {e}")
        return []

    results = []
    for section in soup.select("section.bb-score"):
        match_type = section.select_one("h1.bb-score__title").get_text(strip=True) if section.select_one("h1.bb-score__title") else ""
        for item in section.select("li.bb-score__item"):
            status_tag = item.select_one("p.bb-score__link")
            if not status_tag or status_tag.get_text(strip=True) not in VALID_STATUS: continue
            a = item.select_one("a.bb-score__content")
            if not a or 'href' not in a.attrs: continue
            href = a['href']
            m = re.search(r"/game/(\d+)/", href)
            if not m: continue
            game_id = m.group(1)
            home_team = item.select_one('p.bb-score__homeLogo').get_text(strip=True)
            away_team = item.select_one('p.bb-score__awayLogo').get_text(strip=True)
            results.append({
                "試合日": date.strftime("%Y/%m/%d"),
                "開催地": item.select_one("span.bb-score__venue").get_text(strip=True) if item.select_one("span.bb-score__venue") else None,
                "対戦カード": f"{home_team} vs {away_team}", "game_id": game_id, "URL": urljoin(BASE_URL, href),
                "試合状態": status_tag.get_text(strip=True), "試合種別": match_type, "種別": detect_league(home_team, away_team),
            })
    return results

# === メイン処理 ===
print("▶ Step 1: Scraping game schedules (incremental update)...")

# ★★★★★ 変更点①: 最終実行日を読み込む ★★★★★
try:
    with open(LAST_RUN_FILE, 'r') as f:
        last_run_str = f.read().strip()
        # 最終実行日の翌日からスタート
        start_date = datetime.strptime(last_run_str, "%Y-%m-%d") + timedelta(days=1)
    print(f"Found last run date: {last_run_str}. Starting from {start_date.strftime('%Y-%m-%d')}.")
except FileNotFoundError:
    start_date = DEFAULT_START_DATE
    print(f"No last run date found. Starting from default: {start_date.strftime('%Y-%m-%d')}.")

# 取得終了日は常に「昨日」
end_date = datetime.now() - timedelta(days=1)

if start_date > end_date:
    print("No new dates to process. All data is up to date.")
    print("\n🎯 Step 1 Complete.")
else:
    seen_ids = set()
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        print(f"📅 Fetching data for: {date_str}")
        daily_games = []
        for kinds in (None, GAME_KIND_IDS):
            games = fetch_daily_schedule(current_date, game_kind_ids=kinds)
            for g in games:
                if g['game_id'] not in seen_ids:
                    daily_games.append(g)
                    seen_ids.add(g['game_id'])
        if daily_games:
            df_day = pd.DataFrame(daily_games)
            df_day.to_csv(os.path.join(OUTPUT_DIR, f"{date_str}.csv"), index=False, encoding="utf-8-sig")
            print(f"  ✅ Saved {len(df_day)} games to {date_str}.csv")
        else:
            print(f"  - No games found for {date_str}.")
        time.sleep(1) 
        current_date += timedelta(days=1)

    # ★★★★★ 変更点②: 最終実行日を記録する ★★★★★
    with open(LAST_RUN_FILE, 'w') as f:
        f.write(end_date.strftime("%Y-%m-%d"))
    print(f"\nUpdated last run date to: {end_date.strftime('%Y-%m-%d')}")

    # 全期間のデータを1つのCSVにまとめる（毎回更新）
    print("\nCombining all daily CSVs into a single master file...")
    all_csvs = sorted(glob.glob(os.path.join(OUTPUT_DIR, "*.csv")))
    if all_csvs:
        dfs_to_concat = [pd.read_csv(p) for p in all_csvs if os.path.getsize(p) > 0]
        if dfs_to_concat:
            df_all = pd.concat(dfs_to_concat, ignore_index=True)
            df_all.drop_duplicates(subset=['game_id'], keep='last', inplace=True)
            df_all.to_csv(os.path.join(OUTPUT_DIR, "game_info_all.csv"), index=False, encoding="utf-8-sig")
            print(f"✅ Combined data saved to game_info_all.csv ({len(df_all)} total games).")
        else:
            print("- No data to combine.")
            
    print("\n🎯 Step 1 Complete.")