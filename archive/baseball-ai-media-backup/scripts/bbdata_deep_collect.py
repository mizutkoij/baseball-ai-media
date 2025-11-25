#!/usr/bin/env python3
"""
scripts/bbdata_deep_collect.py - BaseballData.jp ディープデータ収集（CSR/JavaScript必須ページ）

対象：
- VDUCP (勝敗更新機会点) 
- 条件別成績（昼夜・ホーム/ビジター・月別・対戦別）
- セイバーメトリクス詳細

出力: data/bbdata/date=YYYY-MM-DD/deep_YYYY-MM-DD.csv

Usage:
    python scripts/bbdata_deep_collect.py --date 2025-08-15 --targets vducp,conditions [--changed-only] [--discord]
"""
import sys
import os
import argparse
import json
import csv
import gzip
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Set
import time
import asyncio
import hashlib

# Add project root to path for imports
sys.path.append(".")

from lib.polite_http import PoliteHttp
from lib.discord_csv_notifier import send_csv

# Playwright for JavaScript rendering
try:
    from playwright.async_api import async_playwright
    import pandas as pd
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install playwright pandas beautifulsoup4")
    print("Also run: playwright install")
    sys.exit(1)

# Constants
BASE_URL = "https://baseballdata.jp"
MIN_INTERVAL_SEC = int(os.getenv("BB_MIN_INTERVAL_SEC", "15"))
MAX_PAGES_PER_RUN = int(os.getenv("BB_MAX_PAGES_PER_RUN", "300"))
MAX_CONCURRENT = int(os.getenv("BB_MAX_CONCURRENT", "1"))
BACKOFF_429_SEC = int(os.getenv("BB_BACKOFF_429_SEC", "300"))

CURRENT_YEAR = datetime.now().year

def get_deep_urls(targets: List[str], season: int = None) -> List[Dict[str, str]]:
    """Get URLs for deep data collection based on targets."""
    if season is None:
        season = CURRENT_YEAR - 1  # Focus on previous complete season
    
    urls = []
    
    if "vducp" in targets:
        # VDUCP/独自指標ページ
        urls.extend([
            {"url": f"{BASE_URL}/{season}/vducp/central.html", "type": "vducp", "league": "central", "season": season},
            {"url": f"{BASE_URL}/{season}/vducp/pacific.html", "type": "vducp", "league": "pacific", "season": season},
            {"url": f"{BASE_URL}/{season}/sabr/central.html", "type": "sabr", "league": "central", "season": season},
            {"url": f"{BASE_URL}/{season}/sabr/pacific.html", "type": "sabr", "league": "pacific", "season": season},
        ])
    
    if "conditions" in targets:
        # 条件別成績ページ
        conditions = [
            "day", "night", "home", "visitor",  # 昼夜・ホーム/ビジター
            "3-4", "5", "6", "7", "8",  # 月別
        ]
        
        teams = [
            "giants", "swallows", "dragons", "tigers", "carp", "baystars",  # セ・リーグ
            "hawks", "fighters", "lions", "eagles", "marines", "buffaloes"  # パ・リーグ
        ]
        
        for condition in conditions:
            urls.extend([
                {"url": f"{BASE_URL}/{season}/conditions/batting/{condition}.html", 
                 "type": "condition_batting", "condition": condition, "season": season},
                {"url": f"{BASE_URL}/{season}/conditions/pitching/{condition}.html", 
                 "type": "condition_pitching", "condition": condition, "season": season}
            ])
        
        # 対戦相手別（サンプリング - 全チームは重すぎる）
        sample_teams = teams[:6]  # 最初の6チームのみ
        for team in sample_teams:
            urls.extend([
                {"url": f"{BASE_URL}/{season}/vs/{team}/batting.html", 
                 "type": "vs_batting", "team": team, "season": season},
                {"url": f"{BASE_URL}/{season}/vs/{team}/pitching.html", 
                 "type": "vs_pitching", "team": team, "season": season}
            ])
    
    return urls

async def fetch_with_playwright(browser, url_info: Dict[str, str], changed_only: bool = False) -> Optional[Dict]:
    """Playwright経由でJavaScript必須ページを取得"""
    url = url_info["url"]
    
    # 差分チェック用のキャッシュパス
    cache_dir = Path("data/bbdata/cache/deep")
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    url_hash = hashlib.md5(url.encode()).hexdigest()
    cache_file = cache_dir / f"{url_hash}.json"
    
    try:
        page = await browser.new_page()
        
        # User agent設定 (ボット検知回避)
        await page.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        })
        
        print(f"  Fetching: {url}")
        
        # ページロード（JavaScriptが実行されるまで待機）
        await page.goto(url, wait_until="networkidle", timeout=30000)
        
        # JavaScript実行完了を待機（テーブルが表示されるまで）
        try:
            await page.wait_for_selector("table", timeout=10000)
        except:
            print(f"    Warning: No tables found in {url}")
        
        # ページコンテンツ取得
        html_content = await page.content()
        await page.close()
        
        # 差分チェック
        content_hash = hashlib.md5(html_content.encode()).hexdigest()
        
        if changed_only and cache_file.exists():
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
                if cached_data.get("content_hash") == content_hash:
                    print(f"    Skipped: No changes detected")
                    return None
        
        # キャッシュ更新
        cache_data = {
            "url": url,
            "content_hash": content_hash,
            "last_updated": datetime.now().isoformat(),
            "content_length": len(html_content)
        }
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2, ensure_ascii=False)
        
        return {
            "url_info": url_info,
            "html_content": html_content,
            "content_hash": content_hash
        }
    
    except Exception as e:
        print(f"    Error fetching {url}: {e}")
        if 'page' in locals():
            await page.close()
        return None

def parse_deep_data(fetch_result: Dict) -> List[Dict]:
    """HTMLからディープデータを抽出"""
    if not fetch_result:
        return []
    
    url_info = fetch_result["url_info"]
    html_content = fetch_result["html_content"]
    data_type = url_info["type"]
    
    rows = []
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # pandas HTML parser を使用
        tables = pd.read_html(html_content, flavor='bs4')
        
        if not tables:
            return []
        
        # メインテーブル（通常最初または最大のテーブル）
        main_table = max(tables, key=len) if len(tables) > 1 else tables[0]
        
        # プレイヤーリンクを抽出（元のHTMLから）
        player_links = extract_player_links(soup)
        
        for idx, row in main_table.iterrows():
            try:
                # プレイヤーIDの抽出
                player_id = None
                player_name = None
                
                if idx < len(player_links):
                    player_id = player_links[idx].get("id")
                    player_name = player_links[idx].get("name")
                
                if not player_id:
                    continue
                
                # データタイプ別の処理
                if data_type in ["vducp", "sabr"]:
                    parsed_row = parse_advanced_stats(row, url_info, player_id, player_name)
                elif data_type.startswith("condition_"):
                    parsed_row = parse_conditional_stats(row, url_info, player_id, player_name)
                elif data_type.startswith("vs_"):
                    parsed_row = parse_vs_stats(row, url_info, player_id, player_name)
                else:
                    continue
                
                if parsed_row:
                    rows.append(parsed_row)
            
            except Exception as e:
                print(f"      Warning: Error parsing row {idx}: {e}")
                continue
    
    except Exception as e:
        print(f"    Error parsing deep data from {url_info['url']}: {e}")
    
    return rows

def extract_player_links(soup) -> List[Dict[str, str]]:
    """HTMLからプレイヤーリンクとIDを抽出"""
    links = []
    
    # テーブル内のプレイヤーリンクを探索
    for table in soup.find_all('table'):
        for row in table.find_all('tr'):
            for cell in row.find_all(['td', 'th']):
                for link in cell.find_all('a', href=True):
                    href = link.get('href', '')
                    
                    # プレイヤーIDパターンをマッチ
                    import re
                    player_match = re.search(r'player[BP]/(\d+)\.html', href)
                    if player_match:
                        player_id = player_match.group(1)
                        player_name = link.get_text(strip=True)
                        
                        links.append({
                            "id": player_id,
                            "name": player_name,
                            "href": href
                        })
    
    return links

def parse_advanced_stats(row, url_info: Dict, player_id: str, player_name: str) -> Optional[Dict]:
    """VDUCP/セイバーメトリクス統計を解析"""
    try:
        result = {
            "pid": player_id,
            "name": player_name,
            "league": url_info.get("league", ""),
            "season": url_info.get("season", CURRENT_YEAR),
            "data_type": url_info["type"]
        }
        
        # VDUCP特有の指標
        if url_info["type"] == "vducp":
            result.update({
                "vducp": safe_extract_float(row, ["VDUCP", "勝敗更新機会点"]),
                "leverage": safe_extract_float(row, ["Leverage", "レバレッジ"]),
                "wpa": safe_extract_float(row, ["WPA", "勝利貢献"]),
            })
        
        # セイバーメトリクス共通指標
        result.update({
            "ops": safe_extract_float(row, ["OPS"]),
            "whip": safe_extract_float(row, ["WHIP"]),
            "fip": safe_extract_float(row, ["FIP"]),
            "babip": safe_extract_float(row, ["BABIP"]),
            "iso": safe_extract_float(row, ["ISO", "IsoP"]),
        })
        
        return result
    
    except Exception as e:
        print(f"      Error parsing advanced stats: {e}")
        return None

def parse_conditional_stats(row, url_info: Dict, player_id: str, player_name: str) -> Optional[Dict]:
    """条件別成績を解析"""
    try:
        result = {
            "pid": player_id,
            "name": player_name,
            "condition": url_info.get("condition", ""),
            "season": url_info.get("season", CURRENT_YEAR),
            "data_type": url_info["type"]
        }
        
        # 共通統計
        result.update({
            "g": safe_extract_number(row, ["試合", "G"]),
            "avg": safe_extract_float(row, ["打率", "AVG"]),
            "obp": safe_extract_float(row, ["出塁率", "OBP"]),
            "slg": safe_extract_float(row, ["長打率", "SLG"]),
            "ops": safe_extract_float(row, ["OPS"]),
        })
        
        if "batting" in url_info["type"]:
            result.update({
                "pa": safe_extract_number(row, ["打席", "PA"]),
                "ab": safe_extract_number(row, ["打数", "AB"]),
                "h": safe_extract_number(row, ["安打", "H"]),
                "hr": safe_extract_number(row, ["本塁打", "HR"]),
                "rbi": safe_extract_number(row, ["打点", "RBI"]),
            })
        else:  # pitching
            result.update({
                "era": safe_extract_float(row, ["防御率", "ERA"]),
                "ip": safe_extract_float(row, ["投球回", "IP"]),
                "so": safe_extract_number(row, ["奪三振", "SO", "K"]),
                "bb": safe_extract_number(row, ["与四球", "BB"]),
            })
        
        return result
    
    except Exception as e:
        print(f"      Error parsing conditional stats: {e}")
        return None

def parse_vs_stats(row, url_info: Dict, player_id: str, player_name: str) -> Optional[Dict]:
    """対戦相手別成績を解析"""
    try:
        result = {
            "pid": player_id,
            "name": player_name,
            "vs_team": url_info.get("team", ""),
            "season": url_info.get("season", CURRENT_YEAR),
            "data_type": url_info["type"]
        }
        
        # 基本成績
        result.update({
            "g": safe_extract_number(row, ["試合", "G"]),
            "avg": safe_extract_float(row, ["打率", "AVG"]),
            "ops": safe_extract_float(row, ["OPS"]),
        })
        
        return result
    
    except Exception as e:
        print(f"      Error parsing vs stats: {e}")
        return None

def safe_extract_number(row_data, possible_columns: List[str]) -> Optional[int]:
    """安全に整数を抽出"""
    for col in possible_columns:
        try:
            if hasattr(row_data, 'index') and col in row_data.index:
                val = row_data[col]
                if pd.isna(val):
                    continue
                val_str = str(val).replace(',', '').replace('-', '0').strip()
                if val_str and val_str.replace('.', '').isdigit():
                    return int(float(val_str))
        except:
            continue
    return None

def safe_extract_float(row_data, possible_columns: List[str]) -> Optional[float]:
    """安全に浮動小数点数を抽出"""
    for col in possible_columns:
        try:
            if hasattr(row_data, 'index') and col in row_data.index:
                val = row_data[col]
                if pd.isna(val):
                    continue
                val_str = str(val).replace(',', '').replace('-', '0.0').strip()
                if val_str and val_str.replace('.', '').replace('-', '').isdigit():
                    return float(val_str)
        except:
            continue
    return None

async def collect_deep_data(date_str: str, targets: List[str], changed_only: bool = False, discord_notify: bool = False):
    """メイン収集関数"""
    print(f"Starting deep data collection for {date_str}")
    print(f"Targets: {targets}")
    print(f"Changed only: {changed_only}")
    
    all_data = []
    
    # メタデータ
    metadata = {
        "collection_date": date_str,
        "collection_timestamp": datetime.now().isoformat(),
        "source": "baseballdata.jp",
        "script_version": "1.0",
        "targets": targets,
        "changed_only": changed_only,
        "errors": [],
        "warnings": [],
        "pages_processed": 0,
        "pages_changed": 0
    }
    
    # URL収集
    all_urls = []
    for target in targets:
        urls = get_deep_urls([target])
        all_urls.extend(urls)
    
    # 制限適用
    if len(all_urls) > MAX_PAGES_PER_RUN:
        print(f"Limiting to {MAX_PAGES_PER_RUN} pages (from {len(all_urls)})")
        all_urls = all_urls[:MAX_PAGES_PER_RUN]
    
    print(f"Processing {len(all_urls)} deep URLs")
    
    # Playwright セッション
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        try:
            # 順次処理（並列度=1で安全に）
            for i, url_info in enumerate(all_urls):
                print(f"[{i+1}/{len(all_urls)}] Processing: {url_info['type']}")
                
                try:
                    # レート制限
                    if i > 0:
                        await asyncio.sleep(MIN_INTERVAL_SEC)
                    
                    # データ取得
                    fetch_result = await fetch_with_playwright(browser, url_info, changed_only)
                    metadata["pages_processed"] += 1
                    
                    if fetch_result:
                        metadata["pages_changed"] += 1
                        
                        # データ解析
                        parsed_data = parse_deep_data(fetch_result)
                        all_data.extend(parsed_data)
                        
                        print(f"    Extracted {len(parsed_data)} records")
                    
                except Exception as e:
                    error_msg = f"Error processing {url_info['url']}: {str(e)}"
                    metadata["errors"].append(error_msg)
                    print(f"    Error: {error_msg}")
                    continue
        
        finally:
            await browser.close()
    
    # 結果保存
    metadata["total_records"] = len(all_data)
    success = save_deep_data(all_data, date_str, metadata, discord_notify)
    
    print(f"\nDeep collection complete:")
    print(f"  Pages processed: {metadata['pages_processed']}")
    print(f"  Pages changed: {metadata['pages_changed']}")
    print(f"  Total records: {len(all_data)}")
    print(f"  Errors: {len(metadata['errors'])}")
    
    return success

def save_deep_data(data: List[Dict], date_str: str, metadata: Dict, discord_notify: bool = False):
    """ディープデータをCSV保存"""
    output_dir = Path(f"data/bbdata/date={date_str}")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = output_dir / f"deep_{date_str}.csv"
    
    try:
        # CSV書き込み
        if data:
            # 全カラムを収集
            all_columns = set()
            for row in data:
                all_columns.update(row.keys())
            
            all_columns = sorted(all_columns)
            
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=all_columns)
                writer.writeheader()
                writer.writerows(data)
        else:
            # 空ファイル
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['pid', 'name', 'data_type', 'season'])
        
        print(f"Saved {len(data)} deep records to {csv_path}")
        
        # gzip圧縮
        with open(csv_path, 'rb') as f_in:
            with gzip.open(f"{csv_path}.gz", 'wb') as f_out:
                f_out.writelines(f_in)
        
        # メタデータ保存
        metadata_path = output_dir / f"deep_metadata_{date_str}.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        # Discord通知
        if discord_notify and data:
            try:
                vducp_count = len([d for d in data if d.get("data_type") == "vducp"])
                condition_count = len([d for d in data if "condition" in d.get("data_type", "")])
                
                send_csv(
                    csv_path=str(csv_path),
                    message=f"🔍 BaseballData Deep Collection {date_str}\n"
                           f"Total records: {len(data)}\n"
                           f"VDUCP: {vducp_count}, Conditions: {condition_count}\n"
                           f"Pages changed: {metadata.get('pages_changed', 0)}/{metadata.get('pages_processed', 0)}"
                )
                print("Discord notification sent")
            except Exception as e:
                print(f"Warning: Discord notification failed: {e}")
    
    except Exception as e:
        print(f"Error saving deep data: {e}")
        return False
    
    return True

async def main():
    parser = argparse.ArgumentParser(description="BaseballData.jp deep data collector")
    parser.add_argument("--date", required=True, help="Collection date (YYYY-MM-DD)")
    parser.add_argument("--targets", required=True, help="Comma-separated targets (vducp,conditions)")
    parser.add_argument("--changed-only", action="store_true", help="Only collect changed pages")
    parser.add_argument("--discord", action="store_true", help="Send Discord notification")
    
    args = parser.parse_args()
    
    # 日付検証
    try:
        datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError:
        print("Error: Date must be in YYYY-MM-DD format")
        sys.exit(1)
    
    # ターゲット解析
    targets = [t.strip() for t in args.targets.split(",")]
    valid_targets = {"vducp", "conditions"}
    
    for target in targets:
        if target not in valid_targets:
            print(f"Error: Invalid target '{target}'. Valid targets: {valid_targets}")
            sys.exit(1)
    
    # 実行
    success = await collect_deep_data(args.date, targets, args.changed_only, args.discord)
    
    if not success:
        print("Deep collection failed")
        sys.exit(1)
    
    print("Deep collection completed successfully")

if __name__ == "__main__":
    asyncio.run(main())