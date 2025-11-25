#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_npb_scraper.py
==================
NPB実データ収集のテスト版（少数選手で試行）
"""

import os
import re
import time
from datetime import datetime
from urllib.parse import urljoin
import json
import requests
from bs4 import BeautifulSoup
import pandas as pd
import jaconv

# --- 設定 ---
OUTPUT_DIR = "data/test_npb_real"
PLAYERS_JSON_DIR = os.path.join(OUTPUT_DIR, "players")
os.makedirs(PLAYERS_JSON_DIR, exist_ok=True)
BASE_URL = "https://npb.jp"

def create_kana_map():
    kana_groups = { 
        '0': "あいうえおゔ", 
        '1': "かきくけこがぎぐげご", 
        '2': "さしすせそざじずぜぞ", 
        '3': "たちつてとだぢづでど", 
        '4': "なにぬねの", 
        '5': "はひふへほばびぶべぼぱぴぷぺぽ", 
        '6': "まみむめも", 
        '7': "やゆよ", 
        '8': "らりるれろ", 
        '9': "わをん" 
    }
    kana_map = {}
    for code, chars in kana_groups.items():
        for char in chars: 
            kana_map[char] = code
    return kana_map

KANA_MAP = create_kana_map()

def generate_player_id(info: dict) -> str:
    league_code = '1'  # NPB
    entry_year_code = str(info.get('entry_year', 0))[-3:]
    nationality_code = info.get('nationality_code', '1')
    position_code = info.get('position_code', '2')
    birth_date_obj = info.get('birth_date')
    birth_date_code = birth_date_obj.strftime('%Y%m%d') if birth_date_obj else '00000000'
    name_kana_hira = jaconv.kata2hira(info.get('name_kana', '？'))
    
    initial_code = KANA_MAP.get(name_kana_hira[0], 'X') if name_kana_hira else 'X'
    
    return f"{league_code}{entry_year_code:0>3}{nationality_code}{position_code}{birth_date_code}{initial_code}"

def get_test_player_urls() -> list:
    """テスト用に「あ行」の選手のみ取得"""
    print("Fetching test player URLs from NPB.jp (あ行のみ)...")
    player_urls = []
    
    # 「あ行」のみテスト
    for romaji in ['a']:
        index_url = f"{BASE_URL}/bis/players/all/index_{romaji}.html"
        try:
            print(f"Fetching from: {index_url}")
            res = requests.get(index_url, timeout=10)
            res.raise_for_status()
            soup = BeautifulSoup(res.content, 'html.parser')
            player_list_div = soup.select_one('div.three_column_player')
            if player_list_div:
                for a_tag in player_list_div.select('a'):
                    full_url = urljoin(BASE_URL, a_tag['href'])
                    player_urls.append(full_url)
                    # 最初の5人のみでテスト
                    if len(player_urls) >= 5:
                        break
            print(f"Found {len(player_urls)} test URLs from {index_url}")
            time.sleep(1) 
        except requests.RequestException as e: 
            print(f"Error fetching {index_url}: {e}")
    
    print(f"Total test URLs: {len(player_urls)}")
    return player_urls

def parse_player_page(url: str) -> dict:
    try:
        print(f"  Parsing: {url}")
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        html_content = res.content
        soup = BeautifulSoup(html_content, 'html.parser')
        
        player_data = {'url': url}
        
        # 選手名
        name_elem = soup.select_one('li#pc_v_name')
        if name_elem:
            player_data['name'] = name_elem.get_text(strip=True)
        else:
            print(f"    Warning: Name not found for {url}")
            return None
            
        # 読み仮名
        kana_elem = soup.select_one('li#pc_v_kana')
        player_data['name_kana'] = kana_elem.get_text(strip=True) if kana_elem else ''
        
        # プロフィール情報
        bio_table = soup.select_one('section#pc_bio table')
        profile = {}
        if bio_table:
            for row in bio_table.select('tr'):
                th = row.select_one('th')
                td = row.select_one('td')
                if th and td:
                    header = th.get_text(strip=True)
                    value = td.get_text(strip=True)
                    profile[header] = value
        
        player_data['profile'] = profile
        
        # 生年月日解析
        if '生年月日' in profile:
            dt_match = re.search(r'(\d+)年(\d+)月(\d+)日', profile['生年月日'])
            if dt_match: 
                player_data['birth_date'] = datetime(
                    int(dt_match.group(1)), 
                    int(dt_match.group(2)), 
                    int(dt_match.group(3))
                )
        
        # ドラフト年度
        if 'ドラフト' in profile:
            year_match = re.search(r'(\d{4})年', profile['ドラフト'])
            if year_match: 
                player_data['entry_year'] = int(year_match.group(1))
        
        # 国籍コード推定（外国人選手判定）
        player_data['nationality_code'] = '2' if re.search(r'[a-zA-Z\s\.]', player_data.get('name_kana', '')) else '1'
        
        # ポジションコード（投手かどうか）
        player_data['position_code'] = '1' if '投手' in str(soup) else '2'
        
        # 現役判定のための手がかり
        current_status = "unknown"
        if '現所属' in profile:
            current_status = "active"
        elif '引退' in str(soup).lower() or 'retired' in str(soup).lower():
            current_status = "retired"
        elif profile.get('所属', '') and profile.get('所属', '') != '':
            current_status = "active"
        
        player_data['current_status'] = current_status
        
        print(f"    OK {player_data.get('name', 'Unknown')} ({current_status})")
        return player_data
        
    except Exception as e:
        print(f"    Error processing {url}: {e}")
        return None

def main():
    print("NPB Real Data Scraper - Test Version")
    print("=" * 50)
    
    player_urls = get_test_player_urls()
    if not player_urls:
        print("No player URLs found. Exiting.")
        return

    results = []
    
    print(f"\nProcessing {len(player_urls)} test players...")
    for i, url in enumerate(player_urls):
        print(f"\nPlayer {i+1}/{len(player_urls)}:")
        
        data = parse_player_page(url)
        if not data:
            print(f"  FAILED to parse: {url}")
            continue

        player_id = generate_player_id(data)
        data['player_id'] = player_id
        
        # JSONファイルとして保存
        json_filepath = os.path.join(PLAYERS_JSON_DIR, f"{player_id}.json")
        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
            
        results.append({
            'player_id': player_id,
            'name': data.get('name'),
            'name_kana': data.get('name_kana'),
            'current_status': data.get('current_status'),
            'profile': data.get('profile', {})
        })
        
        time.sleep(2)  # レート制限対応

    # 結果サマリー
    print("\n" + "=" * 50)
    print("SCRAPING RESULTS:")
    print("=" * 50)
    
    for result in results:
        print(f"OK {result['name']} (ID: {result['player_id']})")
        print(f"   Status: {result['current_status']}")
        print(f"   Kana: {result['name_kana']}")
        if result['profile'].get('所属'):
            print(f"   Team: {result['profile']['所属']}")
        print()
    
    # サマリーファイル作成
    summary_file = os.path.join(OUTPUT_DIR, "test_scraping_summary.json")
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump({
            'scraping_date': datetime.now().isoformat(),
            'total_players': len(results),
            'active_players': len([r for r in results if r['current_status'] == 'active']),
            'players': results
        }, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"Results saved to: {OUTPUT_DIR}")
    print(f"Summary: {summary_file}")

if __name__ == "__main__":
    main()