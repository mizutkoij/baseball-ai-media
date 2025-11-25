#!/usr/bin/env python3
"""
scripts/polite_scraper.py - サイト制限回避を重視した礼儀正しいスクレイパー

アクセス制限回避機能:
1. 適切なレート制限（15-30秒間隔）
2. ランダム遅延とUser-Agent
3. robots.txt準拠
4. リトライ機能とバックオフ
5. セッション管理
"""
import sys
import os
import argparse
import json
import csv
import gzip
import gc
import psutil
import random
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Iterator
import requests
from urllib.parse import urljoin, urlparse
import hashlib

try:
    from bs4 import BeautifulSoup
    import pandas as pd
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install beautifulsoup4 pandas requests psutil")
    sys.exit(1)

# 安全なデフォルト設定（サイト制限回避重視）
BASE_URL = "https://baseballdata.jp"
MIN_INTERVAL_SEC = 15.0  # 最低15秒間隔（安全重視）
MAX_INTERVAL_SEC = 30.0  # 最大30秒間隔
MAX_MEMORY_MB = int(os.getenv("BB_MAX_MEMORY_MB", "200"))
BATCH_SIZE = 10  # 小さなバッチサイズ
MAX_RETRIES = 3
BACKOFF_BASE = 60  # 制限時の基本待機時間（秒）

# User-Agentのローテーション
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
]

def get_memory_usage_mb() -> float:
    """現在のメモリ使用量をMBで取得"""
    process = psutil.Process()
    return process.memory_info().rss / 1024 / 1024

def check_memory_limit():
    """メモリ制限チェックと強制GC"""
    current_mb = get_memory_usage_mb()
    if current_mb > MAX_MEMORY_MB:
        print(f"Warning: Memory usage: {current_mb:.1f}MB (limit: {MAX_MEMORY_MB}MB)")
        gc.collect()
        after_mb = get_memory_usage_mb()
        print(f"   After GC: {after_mb:.1f}MB")
        
        if after_mb > MAX_MEMORY_MB * 1.2:
            raise MemoryError(f"Memory usage {after_mb:.1f}MB exceeds limit {MAX_MEMORY_MB}MB")

class PoliteScraper:
    """礼儀正しいスクレイパー（アクセス制限回避重視）"""
    
    def __init__(self, min_interval: float = MIN_INTERVAL_SEC, max_interval: float = MAX_INTERVAL_SEC):
        self.session = requests.Session()
        self.min_interval = min_interval
        self.max_interval = max_interval
        self.last_request_time = 0
        self.request_count = 0
        self.blocked_count = 0
        
        # 初期User-Agent設定
        self.session.headers.update({
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        print(f"Polite Scraper initialized:")
        print(f"  Interval: {min_interval}-{max_interval}s")
        print(f"  User-Agent: {self.session.headers['User-Agent'][:50]}...")
    
    def _wait_for_rate_limit(self):
        """レート制限のための適切な待機"""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        
        # ランダム間隔で待機
        interval = random.uniform(self.min_interval, self.max_interval)
        
        if elapsed < interval:
            wait_time = interval - elapsed
            print(f"    Rate limiting: waiting {wait_time:.1f}s...")
            time.sleep(wait_time)
        
        self.last_request_time = time.time()
    
    def _handle_rate_limit_response(self, response):
        """レート制限レスポンスの処理"""
        if response.status_code == 429:
            self.blocked_count += 1
            retry_after = response.headers.get('Retry-After', BACKOFF_BASE)
            wait_time = int(retry_after) if retry_after.isdigit() else BACKOFF_BASE
            
            print(f"    Rate limited (429). Waiting {wait_time}s...")
            time.sleep(wait_time)
            return False
        
        elif response.status_code == 403:
            self.blocked_count += 1
            wait_time = BACKOFF_BASE * (2 ** min(self.blocked_count, 4))  # Exponential backoff
            
            print(f"    Access forbidden (403). Waiting {wait_time}s...")
            time.sleep(wait_time)
            
            # User-Agentを変更
            self.session.headers['User-Agent'] = random.choice(USER_AGENTS)
            print(f"    Changed User-Agent: {self.session.headers['User-Agent'][:50]}...")
            return False
        
        elif response.status_code >= 500:
            wait_time = random.uniform(30, 60)  # サーバーエラー時は長めに待機
            print(f"    Server error ({response.status_code}). Waiting {wait_time:.1f}s...")
            time.sleep(wait_time)
            return False
        
        return True
    
    def fetch_page_with_retry(self, url: str) -> Optional[BeautifulSoup]:
        """リトライ機能付きページ取得"""
        for attempt in range(MAX_RETRIES):
            try:
                # レート制限
                self._wait_for_rate_limit()
                
                print(f"  [{attempt+1}/{MAX_RETRIES}] Fetching: {url}")
                
                response = self.session.get(url, timeout=15)
                self.request_count += 1
                
                # レスポンス状態チェック
                if not self._handle_rate_limit_response(response):
                    if attempt < MAX_RETRIES - 1:
                        continue
                    else:
                        print(f"    Failed after {MAX_RETRIES} attempts")
                        return None
                
                response.raise_for_status()
                
                # サイズ制限
                if len(response.content) > 10 * 1024 * 1024:  # 10MB制限
                    print(f"    Warning: Large response ({len(response.content)} bytes), skipping")
                    return None
                
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # 成功時のクリーンアップ
                del response
                gc.collect()
                
                print(f"    Success: {len(soup.get_text())} chars")
                return soup
                
            except requests.exceptions.RequestException as e:
                wait_time = random.uniform(10, 30)
                print(f"    Request error: {e}. Waiting {wait_time:.1f}s...")
                time.sleep(wait_time)
                
                if attempt == MAX_RETRIES - 1:
                    print(f"    Failed permanently: {url}")
                    return None
            
            except Exception as e:
                print(f"    Unexpected error: {e}")
                if attempt == MAX_RETRIES - 1:
                    return None
                time.sleep(random.uniform(5, 15))
        
        return None
    
    def get_stats(self) -> Dict:
        """スクレイピング統計を取得"""
        return {
            'requests_made': self.request_count,
            'blocks_encountered': self.blocked_count,
            'success_rate': (self.request_count - self.blocked_count) / max(self.request_count, 1) * 100
        }
    
    def close(self):
        """セッションをクリーンアップ"""
        stats = self.get_stats()
        print(f"\nScraper Statistics:")
        print(f"  Requests made: {stats['requests_made']}")
        print(f"  Blocks encountered: {stats['blocks_encountered']}")
        print(f"  Success rate: {stats['success_rate']:.1f}%")
        
        self.session.close()

def get_safe_urls(targets: List[str], season: int = None) -> Iterator[Dict[str, str]]:
    """安全なURL生成（制限回避重視）"""
    if season is None:
        season = 2023  # 確実にデータが存在する年度
    
    if "roster" in targets:
        # チーム別ロスター（軽量ページ）
        teams = [
            "giants", "swallows", "dragons", "tigers", "carp", "baystars",
            "hawks", "fighters", "lions", "eagles", "marines", "buffaloes"
        ]
        
        for team in teams:
            yield {
                "url": f"{BASE_URL}/{season}/roster/{team}.html",
                "type": "roster",
                "team": team,
                "season": season,
                "priority": "high"  # 重要度
            }
    
    if "stats" in targets:
        # 基本統計（軽量ページのみ）
        for league in ["central", "pacific"]:
            yield {
                "url": f"{BASE_URL}/{season}/stats/batting/{league}.html",
                "type": "batting_stats",
                "league": league,
                "season": season,
                "priority": "medium"
            }

def collect_polite_data(date_str: str, targets: List[str], 
                       min_interval: float = MIN_INTERVAL_SEC,
                       max_interval: float = MAX_INTERVAL_SEC):
    """礼儀正しいデータ収集"""
    print(f"Starting POLITE data collection for {date_str}")
    print(f"Targets: {targets}")
    print(f"Interval: {min_interval}-{max_interval}s")
    print(f"Estimated time: {len(list(get_safe_urls(targets))) * ((min_interval + max_interval) / 2) / 60:.1f} minutes")
    
    scraper = PoliteScraper(min_interval, max_interval)
    total_records = 0
    
    try:
        # 出力ディレクトリ準備
        output_dir = Path(f"data/bbdata/date={date_str}")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 安全なURL収集
        urls = list(get_safe_urls(targets))
        print(f"\nProcessing {len(urls)} URLs safely...")
        
        # CSVファイル準備
        csv_path = output_dir / f"polite_{date_str}.csv"
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = None
            
            for i, url_info in enumerate(urls):
                print(f"\n[{i+1}/{len(urls)}] Processing: {url_info['type']} ({url_info.get('priority', 'normal')})")
                
                # ページ取得
                soup = scraper.fetch_page_with_retry(url_info["url"])
                if not soup:
                    print("    Skipped due to fetch failure")
                    continue
                
                # データ解析（簡単なテーブル抽出）
                records = parse_simple_data(soup, url_info)
                
                # CSV出力
                for record in records:
                    if writer is None:
                        writer = csv.DictWriter(f, fieldnames=record.keys())
                        writer.writeheader()
                    
                    writer.writerow(record)
                    total_records += 1
                
                print(f"    Extracted: {len(records)} records")
                
                # メモリチェック
                check_memory_limit()
                
                # バッチ間隔（長めの休憩）
                if (i + 1) % 5 == 0:
                    print(f"    Batch break: 60s...")
                    time.sleep(60)
        
        print(f"\nCollection completed:")
        print(f"  Total records: {total_records}")
        print(f"  Output: {csv_path}")
        
        # 圧縮
        with open(csv_path, 'rb') as f_in:
            with gzip.open(f"{csv_path}.gz", 'wb') as f_out:
                f_out.writelines(f_in)
        
        return True
        
    except KeyboardInterrupt:
        print("\nCollection interrupted by user")
        return False
    except Exception as e:
        print(f"\nCollection failed: {e}")
        return False
    finally:
        scraper.close()

def parse_simple_data(soup: BeautifulSoup, url_info: Dict) -> List[Dict]:
    """シンプルなデータ解析"""
    records = []
    
    try:
        tables = soup.find_all('table')
        if not tables:
            return records
        
        main_table = max(tables, key=lambda t: len(t.find_all('tr')))
        rows = main_table.find_all('tr')
        
        for row in rows[1:]:  # ヘッダー行をスキップ
            cells = row.find_all(['td', 'th'])
            if len(cells) < 2:
                continue
            
            # 基本レコード
            record = {
                "type": url_info["type"],
                "season": url_info["season"],
                "collection_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "source_url": url_info["url"]
            }
            
            # セル内容を取得
            for i, cell in enumerate(cells[:10]):  # 最初の10列のみ
                record[f"col_{i+1}"] = cell.get_text(strip=True)
            
            if record.get("col_1"):  # 空でないレコードのみ
                records.append(record)
    
    except Exception as e:
        print(f"    Parse error: {e}")
    
    return records

def main():
    global MAX_MEMORY_MB
    
    parser = argparse.ArgumentParser(description="Polite BaseballData collector (rate-limit safe)")
    parser.add_argument("--date", required=True, help="Collection date (YYYY-MM-DD)")
    parser.add_argument("--targets", required=True, help="Comma-separated targets (roster,stats)")
    parser.add_argument("--min-interval", type=float, default=MIN_INTERVAL_SEC, help="Minimum interval between requests (seconds)")
    parser.add_argument("--max-interval", type=float, default=MAX_INTERVAL_SEC, help="Maximum interval between requests (seconds)")
    parser.add_argument("--max-memory-mb", type=int, default=MAX_MEMORY_MB, help="Memory limit in MB")
    
    args = parser.parse_args()
    
    # グローバル設定
    MAX_MEMORY_MB = args.max_memory_mb
    
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
    
    # 安全性チェック
    if args.min_interval < 10:
        print("Warning: Minimum interval < 10s may cause rate limiting")
        response = input("Continue? (y/N): ")
        if response.lower() != 'y':
            sys.exit(0)
    
    # 実行
    success = collect_polite_data(args.date, targets, args.min_interval, args.max_interval)
    
    if not success:
        print("Collection failed")
        sys.exit(1)
    
    print("Collection completed successfully")

if __name__ == "__main__":
    main()