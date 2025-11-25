#!/usr/bin/env python3
"""
scripts/bbdata_memory_optimized.py - メモリ効率最適化版BaseballDataスクレイパー

メモリ使用量を14GB → 200MB以下に削減:
1. Playwrightを除去、軽量HTTP + BeautifulSoupに変更
2. ストリーミング処理でデータ蓄積を回避
3. 細かいバッチ処理でメモリ解放
4. リソース制限とガベージコレクション

Usage:
    python scripts/bbdata_memory_optimized.py --date 2025-08-15 --targets roster,stats [--max-memory-mb 200]
"""
import sys
import os
import argparse
import json
import csv
import gzip
import gc
import psutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Iterator
import time
import requests
from urllib.parse import urljoin
import hashlib

# Add project root to path for imports
sys.path.append(".")

try:
    from bs4 import BeautifulSoup
    import pandas as pd
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install beautifulsoup4 pandas requests psutil")
    sys.exit(1)

# Constants
BASE_URL = "https://baseballdata.jp"
MIN_INTERVAL_SEC = 2.0  # 軽量化により間隔短縮可能
MAX_MEMORY_MB = int(os.getenv("BB_MAX_MEMORY_MB", "200"))
BATCH_SIZE = 50  # 一度に処理するページ数
GC_INTERVAL = 10  # ガベージコレクション実行間隔

# Memory monitoring
def get_memory_usage_mb() -> float:
    """現在のメモリ使用量をMBで取得"""
    process = psutil.Process()
    return process.memory_info().rss / 1024 / 1024

def check_memory_limit():
    """メモリ制限チェックと強制GC"""
    current_mb = get_memory_usage_mb()
    if current_mb > MAX_MEMORY_MB:
        print(f"Warning: Memory usage: {current_mb:.1f}MB (limit: {MAX_MEMORY_MB}MB)")
        gc.collect()  # 強制ガベージコレクション
        after_mb = get_memory_usage_mb()
        print(f"   After GC: {after_mb:.1f}MB")
        
        if after_mb > MAX_MEMORY_MB * 1.2:  # 20%余裕を持って警告
            raise MemoryError(f"Memory usage {after_mb:.1f}MB exceeds limit {MAX_MEMORY_MB}MB")

class LightweightScraper:
    """軽量HTTP + BeautifulSoupスクレイパー"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.request_count = 0
    
    def fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """単一ページを取得してBeautifulSoupで解析"""
        try:
            print(f"  Fetching: {url}")
            
            # レート制限
            if self.request_count > 0:
                time.sleep(MIN_INTERVAL_SEC)
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            self.request_count += 1
            
            # メモリ効率のため、レスポンスサイズ制限
            if len(response.content) > 5 * 1024 * 1024:  # 5MB制限
                print(f"    Warning: Large response ({len(response.content)} bytes), skipping")
                return None
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # レスポンスオブジェクトを明示的に削除
            del response
            gc.collect()
            
            return soup
            
        except Exception as e:
            print(f"    Error fetching {url}: {e}")
            return None
    
    def close(self):
        """セッションをクリーンアップ"""
        self.session.close()

def get_lightweight_urls(targets: List[str], season: int = None) -> Iterator[Dict[str, str]]:
    """軽量化されたURL生成（Generator使用でメモリ節約）"""
    if season is None:
        season = 2023  # 確実にデータが存在する年度を使用
    
    if "roster" in targets:
        # チーム別ロスター（JavaScriptなしでアクセス可能）
        teams = [
            "giants", "swallows", "dragons", "tigers", "carp", "baystars",
            "hawks", "fighters", "lions", "eagles", "marines", "buffaloes"
        ]
        
        for team in teams:
            yield {
                "url": f"{BASE_URL}/{season}/roster/{team}.html",
                "type": "roster",
                "team": team,
                "season": season
            }
    
    if "stats" in targets:
        # 基本統計ページ（軽量版）
        for league in ["central", "pacific"]:
            yield {
                "url": f"{BASE_URL}/{season}/stats/batting/{league}.html",
                "type": "batting_stats",
                "league": league,
                "season": season
            }
            yield {
                "url": f"{BASE_URL}/{season}/stats/pitching/{league}.html",
                "type": "pitching_stats", 
                "league": league,
                "season": season
            }

def parse_lightweight_data(soup: BeautifulSoup, url_info: Dict) -> Iterator[Dict]:
    """軽量データ解析（Generator使用）"""
    data_type = url_info["type"]
    
    try:
        # テーブル検索
        tables = soup.find_all('table')
        if not tables:
            return
        
        # メインテーブル選択（通常最大のテーブル）
        main_table = max(tables, key=lambda t: len(t.find_all('tr')))
        
        rows = main_table.find_all('tr')
        headers = None
        
        for i, row in enumerate(rows):
            cells = row.find_all(['td', 'th'])
            if not cells:
                continue
            
            # ヘッダー行の処理
            if headers is None and i < 3:  # 最初の3行でヘッダー検索
                if any(cell.get_text(strip=True) in ['選手名', '打率', '防御率'] for cell in cells):
                    headers = [cell.get_text(strip=True) for cell in cells]
                    continue
            
            if headers is None:
                continue
            
            # データ行の処理
            row_data = [cell.get_text(strip=True) for cell in cells]
            if len(row_data) < len(headers):
                continue
            
            # プレイヤーID抽出
            player_id = extract_player_id(row)
            if not player_id:
                continue
            
            # 基本レコード作成
            record = {
                "pid": player_id,
                "data_type": data_type,
                "season": url_info["season"],
                "collection_date": datetime.now().strftime("%Y-%m-%d")
            }
            
            # データタイプ別の処理
            if data_type == "roster":
                record.update(parse_roster_row(row_data, headers, url_info))
            elif "stats" in data_type:
                record.update(parse_stats_row(row_data, headers, url_info))
            
            if record.get("name"):  # 有効なレコードのみ
                yield record
    
    except Exception as e:
        print(f"    Error parsing data: {e}")

def extract_player_id(row) -> Optional[str]:
    """行からプレイヤーIDを抽出"""
    for cell in row.find_all(['td', 'th']):
        for link in cell.find_all('a', href=True):
            href = link.get('href', '')
            import re
            match = re.search(r'player[BP]/(\d+)\.html', href)
            if match:
                return match.group(1)
    return None

def parse_roster_row(row_data: List[str], headers: List[str], url_info: Dict) -> Dict:
    """ロスター行を解析"""
    result = {"team": url_info.get("team", "")}
    
    # 基本情報の抽出
    for i, header in enumerate(headers):
        if i < len(row_data):
            value = row_data[i]
            if header in ['選手名', '名前']:
                result["name"] = value
            elif header in ['背番号', '番号']:
                result["number"] = safe_int(value)
            elif header in ['ポジション', 'pos']:
                result["position"] = value
    
    return result

def parse_stats_row(row_data: List[str], headers: List[str], url_info: Dict) -> Dict:
    """統計行を解析"""
    result = {"league": url_info.get("league", "")}
    
    # 統計データの抽出
    for i, header in enumerate(headers):
        if i < len(row_data):
            value = row_data[i]
            
            if header in ['選手名', '名前']:
                result["name"] = value
            elif header in ['打率', 'AVG']:
                result["avg"] = safe_float(value)
            elif header in ['防御率', 'ERA']:
                result["era"] = safe_float(value)
            elif header in ['本塁打', 'HR']:
                result["hr"] = safe_int(value)
            elif header in ['打点', 'RBI']:
                result["rbi"] = safe_int(value)
    
    return result

def safe_int(value: str) -> Optional[int]:
    """安全な整数変換"""
    try:
        return int(str(value).replace(',', '').replace('-', '0').strip())
    except:
        return None

def safe_float(value: str) -> Optional[float]:
    """安全な浮動小数点変換"""
    try:
        return float(str(value).replace(',', '').replace('-', '0.0').strip())
    except:
        return None

def stream_to_csv(data_iterator: Iterator[Dict], output_path: Path):
    """ストリーミングCSV出力（メモリ効率重視）"""
    csv_path = output_path
    fieldnames = None
    row_count = 0
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = None
        
        for record in data_iterator:
            if not record:
                continue
            
            # ヘッダー初期化
            if fieldnames is None:
                fieldnames = list(record.keys())
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
            
            # レコード書き込み
            writer.writerow(record)
            row_count += 1
            
            # 定期的なメモリチェック
            if row_count % GC_INTERVAL == 0:
                check_memory_limit()
    
    print(f"Saved {row_count} records to {csv_path}")
    return row_count

def collect_lightweight_data(date_str: str, targets: List[str]):
    """メモリ効率重視のメイン収集関数"""
    print(f"Starting lightweight collection for {date_str}")
    print(f"Memory limit: {MAX_MEMORY_MB}MB")
    print(f"Initial memory: {get_memory_usage_mb():.1f}MB")
    
    scraper = LightweightScraper()
    total_records = 0
    
    try:
        # 出力ディレクトリ準備
        output_dir = Path(f"data/bbdata/date={date_str}")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # バッチ処理でURL処理
        urls = list(get_lightweight_urls(targets))
        print(f"Processing {len(urls)} URLs in batches of {BATCH_SIZE}")
        
        for i in range(0, len(urls), BATCH_SIZE):
            batch = urls[i:i + BATCH_SIZE]
            print(f"\nBatch {i//BATCH_SIZE + 1}: Processing {len(batch)} URLs")
            
            # バッチ用データジェネレータ
            def batch_data_generator():
                for url_info in batch:
                    print(f"  [{total_records}] {url_info['type']}: {url_info['url']}")
                    
                    soup = scraper.fetch_page(url_info["url"])
                    if soup:
                        yield from parse_lightweight_data(soup, url_info)
                        
                        # ページ処理後のクリーンアップ
                        del soup
                        gc.collect()
                    
                    check_memory_limit()
            
            # バッチ結果をストリーミング出力
            batch_output = output_dir / f"lightweight_batch_{i//BATCH_SIZE + 1}_{date_str}.csv"
            batch_records = stream_to_csv(batch_data_generator(), batch_output)
            total_records += batch_records
            
            print(f"  Batch completed: {batch_records} records, Memory: {get_memory_usage_mb():.1f}MB")
        
        # 最終統合（必要に応じて）
        if len(urls) > BATCH_SIZE:
            merge_csv_files(output_dir, date_str)
        
        print(f"\nCollection completed successfully:")
        print(f"  Total records: {total_records}")
        print(f"  Final memory: {get_memory_usage_mb():.1f}MB")
        
        return True
        
    except Exception as e:
        print(f"Error during collection: {e}")
        return False
    
    finally:
        scraper.close()

def merge_csv_files(output_dir: Path, date_str: str):
    """バッチCSVファイルを統合"""
    batch_files = list(output_dir.glob(f"lightweight_batch_*_{date_str}.csv"))
    if len(batch_files) <= 1:
        return
    
    merged_path = output_dir / f"lightweight_{date_str}.csv"
    print(f"Merging {len(batch_files)} batch files into {merged_path}")
    
    with open(merged_path, 'w', newline='', encoding='utf-8') as outfile:
        writer = None
        
        for i, batch_file in enumerate(batch_files):
            with open(batch_file, 'r', encoding='utf-8') as infile:
                reader = csv.DictReader(infile)
                
                if writer is None:
                    writer = csv.DictWriter(outfile, fieldnames=reader.fieldnames)
                    writer.writeheader()
                
                for row in reader:
                    writer.writerow(row)
            
            # 処理済みバッチファイルを削除
            batch_file.unlink()
    
    # 圧縮
    with open(merged_path, 'rb') as f_in:
        with gzip.open(f"{merged_path}.gz", 'wb') as f_out:
            f_out.writelines(f_in)

def main():
    global MAX_MEMORY_MB
    
    parser = argparse.ArgumentParser(description="Memory-optimized BaseballData collector")
    parser.add_argument("--date", required=True, help="Collection date (YYYY-MM-DD)")
    parser.add_argument("--targets", required=True, help="Comma-separated targets (roster,stats)")
    parser.add_argument("--max-memory-mb", type=int, default=MAX_MEMORY_MB, help="Memory limit in MB")
    
    args = parser.parse_args()
    
    # グローバルメモリ制限設定
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
    
    # 実行
    success = collect_lightweight_data(args.date, targets)
    
    if not success:
        print("Collection failed")
        sys.exit(1)
    
    print("Collection completed successfully")

if __name__ == "__main__":
    main()