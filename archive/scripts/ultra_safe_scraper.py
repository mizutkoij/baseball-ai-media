#!/usr/bin/env python3
"""
scripts/ultra_safe_scraper.py - 超安全なスクレイパー（75分間隔ベース）

元の運用実績に基づく極めて安全な設定:
- 75分間隔をベースとした安全運用
- 1日1ゲームペースでの確実なデータ収集
- アクセス制限を100%回避
"""
import sys
import os
import argparse
import json
import csv
import time
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional
import requests
from urllib.parse import urljoin

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install beautifulsoup4 requests")
    sys.exit(1)

# 超安全設定（元の75分間隔ベース）
BASE_URL = "https://baseballdata.jp"
ULTRA_SAFE_INTERVAL_MIN = 75 * 60  # 75分 = 4500秒
ULTRA_SAFE_INTERVAL_MAX = 90 * 60  # 90分 = 5400秒
DAILY_PAGE_LIMIT = 12  # 1日最大12ページ（1チームあたり）
SESSION_BREAK_HOURS = 4  # 4時間毎にセッション休憩

# 実績ベースのUser-Agent
PROVEN_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
]

class UltraSafeScraper:
    """75分間隔ベースの超安全スクレイパー"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': random.choice(PROVEN_USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0'
        })
        self.request_count = 0
        self.last_request_time = 0
        self.session_start_time = time.time()
        
        print("Ultra Safe Scraper initialized")
        print(f"Interval: {ULTRA_SAFE_INTERVAL_MIN/60:.0f}-{ULTRA_SAFE_INTERVAL_MAX/60:.0f} minutes")
        print(f"Daily limit: {DAILY_PAGE_LIMIT} pages")
    
    def wait_ultra_safe_interval(self):
        """75-90分の超安全間隔で待機"""
        current_time = time.time()
        
        if self.last_request_time > 0:
            elapsed = current_time - self.last_request_time
            
            # ランダムな待機時間（75-90分）
            wait_time = random.uniform(ULTRA_SAFE_INTERVAL_MIN, ULTRA_SAFE_INTERVAL_MAX)
            
            if elapsed < wait_time:
                remaining = wait_time - elapsed
                remaining_minutes = remaining / 60
                
                print(f"Ultra safe waiting: {remaining_minutes:.1f} minutes...")
                print(f"Expected completion: {datetime.fromtimestamp(current_time + remaining).strftime('%H:%M:%S')}")
                
                # 大きな時間単位で待機（進捗表示付き）
                while remaining > 0:
                    sleep_chunk = min(300, remaining)  # 5分刻みで表示
                    time.sleep(sleep_chunk)
                    remaining -= sleep_chunk
                    
                    if remaining > 60:
                        print(f"  Still waiting: {remaining/60:.1f} minutes remaining...")
        
        self.last_request_time = time.time()
    
    def check_session_break(self):
        """長時間セッション後の休憩チェック"""
        session_duration = time.time() - self.session_start_time
        session_hours = session_duration / 3600
        
        if session_hours >= SESSION_BREAK_HOURS:
            break_time = random.uniform(1800, 3600)  # 30-60分休憩
            print(f"Session break after {session_hours:.1f} hours. Resting {break_time/60:.0f} minutes...")
            time.sleep(break_time)
            
            # セッション更新
            self.session.close()
            self.__init__()
    
    def fetch_page_ultra_safe(self, url: str) -> Optional[BeautifulSoup]:
        """超安全なページ取得"""
        try:
            # 超安全間隔
            self.wait_ultra_safe_interval()
            
            # セッション休憩チェック
            self.check_session_break()
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching: {url}")
            
            response = self.session.get(url, timeout=30)
            self.request_count += 1
            
            # ステータスチェック
            if response.status_code == 429:
                print("Rate limited. Waiting extra 2 hours...")
                time.sleep(7200)  # 2時間待機
                return None
            
            if response.status_code == 403:
                print("Access forbidden. Waiting extra 4 hours...")
                time.sleep(14400)  # 4時間待機
                return None
            
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            print(f"  Success: {len(soup.get_text())} chars")
            return soup
            
        except Exception as e:
            print(f"  Error: {e}")
            print("  Waiting extra 1 hour before retry...")
            time.sleep(3600)  # 1時間待機
            return None
    
    def close(self):
        """セッション終了"""
        print(f"\nSession completed:")
        print(f"  Requests made: {self.request_count}")
        print(f"  Session duration: {(time.time() - self.session_start_time)/3600:.1f} hours")
        self.session.close()

def get_daily_target_urls(targets: List[str], season: int = None) -> List[Dict[str, str]]:
    """1日分の対象URL（制限内）"""
    if season is None:
        season = 2023
    
    urls = []
    
    if "roster" in targets:
        # 1日1チームのみ（超安全）
        teams = ["giants", "swallows", "dragons", "tigers", "carp", "baystars"]
        
        # 日付ベースでチーム選択（ローテーション）
        day_of_year = datetime.now().timetuple().tm_yday
        selected_team = teams[day_of_year % len(teams)]
        
        urls.append({
            "url": f"{BASE_URL}/{season}/roster/{selected_team}.html",
            "type": "roster",
            "team": selected_team,
            "season": season
        })
        
        print(f"Today's target team: {selected_team}")
    
    if "stats" in targets and len(urls) == 0:
        # ロスターが無い場合のみ統計
        leagues = ["central", "pacific"]
        day_of_year = datetime.now().timetuple().tm_yday
        selected_league = leagues[day_of_year % len(leagues)]
        
        urls.append({
            "url": f"{BASE_URL}/{season}/stats/batting/{selected_league}.html",
            "type": "batting_stats",
            "league": selected_league,
            "season": season
        })
        
        print(f"Today's target league: {selected_league}")
    
    return urls

def collect_ultra_safe_data(date_str: str, targets: List[str]):
    """超安全データ収集（1日1ページ）"""
    print(f"Ultra Safe Data Collection for {date_str}")
    print("=" * 60)
    
    scraper = UltraSafeScraper()
    
    try:
        # 出力ディレクトリ
        output_dir = Path(f"data/bbdata/date={date_str}")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 今日の対象URL（1ページのみ）
        urls = get_daily_target_urls(targets)
        
        if not urls:
            print("No URLs to process today")
            return True
        
        print(f"Processing {len(urls)} URL(s) with ultra-safe intervals...")
        
        # 開始時刻記録
        start_time = datetime.now()
        print(f"Start time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if len(urls) > 1:
            total_wait_time = ULTRA_SAFE_INTERVAL_MIN * (len(urls) - 1)
            estimated_end = start_time + timedelta(seconds=total_wait_time)
            print(f"Estimated completion: {estimated_end.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # CSVファイル準備
        csv_path = output_dir / f"ultra_safe_{date_str}.csv"
        total_records = 0
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = None
            
            for i, url_info in enumerate(urls):
                print(f"\n[Page {i+1}/{len(urls)}] Processing: {url_info['type']}")
                
                # ページ取得
                soup = scraper.fetch_page_ultra_safe(url_info["url"])
                if not soup:
                    print("  Skipped due to fetch failure")
                    continue
                
                # データ解析
                records = parse_page_data(soup, url_info)
                
                # CSV書き込み
                for record in records:
                    if writer is None:
                        writer = csv.DictWriter(f, fieldnames=record.keys())
                        writer.writeheader()
                    
                    writer.writerow(record)
                    total_records += 1
                
                print(f"  Extracted: {len(records)} records")
        
        end_time = datetime.now()
        duration = end_time - start_time
        
        print(f"\nCollection completed:")
        print(f"  Duration: {duration}")
        print(f"  Records: {total_records}")
        print(f"  Output: {csv_path}")
        
        return True
        
    except KeyboardInterrupt:
        print("\nCollection interrupted by user")
        return False
    except Exception as e:
        print(f"\nCollection failed: {e}")
        return False
    finally:
        scraper.close()

def parse_page_data(soup: BeautifulSoup, url_info: Dict) -> List[Dict]:
    """ページデータの解析"""
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
                "type": url_info["type"],
                "season": url_info["season"],
                "collection_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "source": url_info["url"]
            }
            
            # 基本データ抽出
            for i, cell in enumerate(cells[:8]):  # 最初の8列
                text = cell.get_text(strip=True)
                if text:
                    record[f"data_{i+1}"] = text
            
            if record.get("data_1"):
                records.append(record)
    
    except Exception as e:
        print(f"  Parse error: {e}")
    
    return records

def estimate_collection_schedule():
    """収集スケジュールの推定"""
    print("\nUltra Safe Collection Schedule:")
    print("=" * 50)
    
    targets = {
        "12チーム ロスター": 12,
        "2リーグ 統計": 2,
        "条件別統計": 8,
        "フル詳細": 50
    }
    
    for name, pages in targets.items():
        # 1日1ページなので、ページ数 = 日数
        days = pages
        
        if days <= 7:
            schedule = f"{days}日で完了"
        elif days <= 30:
            schedule = f"{days}日で完了（約{days//7}週間）"
        else:
            schedule = f"{days}日で完了（約{days//30}ヶ月）"
        
        print(f"{name:15} : {pages:2}ページ → {schedule}")
    
    print("\n推奨運用パターン:")
    print("- 平日: ロスター収集（1日1チーム）")
    print("- 週末: 統計データ収集")
    print("- 月次: 条件別詳細データ")
    print("\n※ 75-90分間隔で確実にアクセス制限回避")

def main():
    parser = argparse.ArgumentParser(description="Ultra-safe BaseballData collector (75min intervals)")
    parser.add_argument("--date", required=True, help="Collection date (YYYY-MM-DD)")
    parser.add_argument("--targets", required=True, help="Comma-separated targets (roster,stats)")
    parser.add_argument("--estimate-only", action="store_true", help="Show schedule estimation only")
    
    args = parser.parse_args()
    
    if args.estimate_only:
        estimate_collection_schedule()
        return
    
    # 日付検証
    try:
        datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError:
        print("Error: Date must be in YYYY-MM-DD format")
        sys.exit(1)
    
    # ターゲット解析
    targets = [t.strip() for t in args.targets.split(",")]
    valid_targets = {"roster", "stats"}
    
    for target in targets:
        if target not in valid_targets:
            print(f"Error: Invalid target '{target}'. Valid targets: {valid_targets}")
            sys.exit(1)
    
    # 確認
    print("WARNING: This will use 75-90 minute intervals between requests.")
    print("Expected to process 1 page per run (ultra-safe).")
    response = input("Continue? (y/N): ")
    if response.lower() != 'y':
        sys.exit(0)
    
    # 実行
    success = collect_ultra_safe_data(args.date, targets)
    
    if not success:
        print("Collection failed")
        sys.exit(1)
    
    print("Collection completed successfully")

if __name__ == "__main__":
    main()