#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
collect_npb_current_players.py
==============================
NPB全現役選手の実データ収集システム
現役選手名簿ページ → 詳細プロフィール取得
"""

import os
import re
import time
import json
from datetime import datetime
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
import pandas as pd
import jaconv

# --- 設定 ---
OUTPUT_DIR = "data/npb_current_players"
PLAYERS_JSON_DIR = os.path.join(OUTPUT_DIR, "players")
os.makedirs(PLAYERS_JSON_DIR, exist_ok=True)
BASE_URL = "https://npb.jp"

# NPBチームコード（全12チーム）
TEAM_CODES = ['g', 't', 'c', 'db', 'd', 's', 'h', 'f', 'm', 'l', 'b', 'e']

# チーム名マッピング
TEAM_NAMES = {
    'g': '読売ジャイアンツ',
    't': '阪神タイガース', 
    'c': '広島東洋カープ',
    'db': '横浜DeNAベイスターズ',
    'd': '中日ドラゴンズ',
    's': '東京ヤクルトスワローズ',
    'h': '福岡ソフトバンクホークス',
    'f': '北海道日本ハムファイターズ',
    'm': '千葉ロッテマリーンズ',
    'l': '埼玉西武ライオンズ',
    'b': 'オリックス・バファローズ',
    'e': '東北楽天ゴールデンイーグルス'
}

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

def get_current_roster(team_code):
    """指定チームの現役選手リストを取得"""
    roster_url = f"{BASE_URL}/bis/teams/rst_{team_code}.html"
    print(f"Collecting roster from: {TEAM_NAMES.get(team_code)} ({team_code})")
    
    try:
        response = requests.get(roster_url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        player_links = []
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            if '/bis/players/' in href and href.endswith('.html'):
                player_name = a_tag.get_text(strip=True)
                if player_name:
                    full_url = urljoin(BASE_URL, href)
                    player_links.append({
                        'name': player_name,
                        'url': full_url,
                        'team': TEAM_NAMES.get(team_code),
                        'team_code': team_code
                    })
        
        print(f"  Found {len(player_links)} current players")
        return player_links
        
    except requests.RequestException as e:
        print(f"  Error fetching {roster_url}: {e}")
        return []

def generate_player_id(info: dict) -> str:
    """プレイヤーID生成"""
    league_code = '1'  # NPB
    entry_year_code = str(info.get('entry_year', 0))[-3:]
    nationality_code = info.get('nationality_code', '1')
    position_code = info.get('position_code', '2')
    birth_date_obj = info.get('birth_date')
    birth_date_code = birth_date_obj.strftime('%Y%m%d') if birth_date_obj else '00000000'
    name_kana_hira = jaconv.kata2hira(info.get('name_kana', '？'))
    
    initial_code = KANA_MAP.get(name_kana_hira[0], 'X') if name_kana_hira else 'X'
    
    return f"{league_code}{entry_year_code:0>3}{nationality_code}{position_code}{birth_date_code}{initial_code}"

def parse_player_details(url: str, team_info: dict) -> dict:
    """選手詳細ページから情報を取得"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        html_content = response.content
        soup = BeautifulSoup(html_content, 'html.parser')
        
        player_data = {
            'url': url,
            'team': team_info['team'],
            'team_code': team_info['team_code'],
            'current_status': 'active'  # 現役選手名簿から取得しているため確実に現役
        }
        
        # 選手名
        name_elem = soup.select_one('li#pc_v_name')
        if name_elem:
            player_data['name'] = name_elem.get_text(strip=True)
        else:
            player_data['name'] = team_info['name']  # フォールバック
            
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
        
        # 国籍コード推定
        player_data['nationality_code'] = '2' if re.search(r'[a-zA-Z\s\.]', player_data.get('name_kana', '')) else '1'
        
        # ポジションコード推定
        player_data['position_code'] = '1' if '投手' in str(soup) else '2'
        
        # ポジション詳細
        if '守備位置' in profile:
            player_data['position'] = profile['守備位置']
        elif '投手' in str(soup):
            player_data['position'] = '投手'
        else:
            player_data['position'] = '野手'
        
        return player_data
        
    except Exception as e:
        print(f"    Error parsing {url}: {e}")
        return None

def main():
    print("NPB Current Players Data Collection")
    print("=" * 50)
    
    # Step 1: 全チームから現役選手リストを取得
    all_current_players = []
    
    print("Step 1: Collecting current player rosters...")
    for team_code in TEAM_CODES:
        roster = get_current_roster(team_code)
        all_current_players.extend(roster)
        time.sleep(1)  # レート制限
    
    print(f"\nTotal current players found: {len(all_current_players)}")
    
    # Step 2: 詳細データ収集
    print(f"\nStep 2: Collecting detailed player data...")
    
    collected_players = []
    failed_count = 0
    
    # 全選手を処理（テスト制限を削除）
    test_limit = None
    players_to_process = all_current_players
    
    for i, player_info in enumerate(players_to_process):
        try:
            print(f"\nProcessing {i+1}/{len(players_to_process)}: {player_info['name']} ({player_info['team_code']})")
        except UnicodeEncodeError:
            print(f"\nProcessing {i+1}/{len(players_to_process)}: [Player {i+1}] ({player_info['team_code']})")
        
        # 詳細データ取得
        detailed_data = parse_player_details(player_info['url'], player_info)
        if not detailed_data:
            try:
                print(f"  FAILED: {player_info['name']}")
            except UnicodeEncodeError:
                print(f"  FAILED: [Player {i+1}]")
            failed_count += 1
            continue
        
        # プレイヤーID生成
        player_id = generate_player_id(detailed_data)
        detailed_data['player_id'] = player_id
        
        # JSONファイル保存
        json_filepath = os.path.join(PLAYERS_JSON_DIR, f"{player_id}.json")
        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(detailed_data, f, indent=2, ensure_ascii=False, default=str)
        
        collected_players.append(detailed_data)
        try:
            print(f"  SUCCESS: {detailed_data['name']} (ID: {player_id})")
        except UnicodeEncodeError:
            print(f"  SUCCESS: [Player {i+1}] (ID: {player_id})")
        
        time.sleep(1)  # レート制限
    
    # Step 3: 結果サマリー
    print("\n" + "=" * 50)
    print("COLLECTION RESULTS:")
    print("=" * 50)
    
    print(f"Total rosters collected: {len(all_current_players)} players")
    print(f"Detailed data collected: {len(collected_players)} players")
    print(f"Failed to parse: {failed_count} players")
    
    # チーム別統計
    team_stats = {}
    for player in collected_players:
        team = player['team_code']
        if team not in team_stats:
            team_stats[team] = 0
        team_stats[team] += 1
    
    print(f"\nTeam breakdown:")
    for team_code, count in team_stats.items():
        print(f"  {TEAM_NAMES[team_code]}: {count} players")
    
    # サマリーファイル作成
    summary_file = os.path.join(OUTPUT_DIR, "collection_summary.json")
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump({
            'collection_date': datetime.now().isoformat(),
            'total_roster_players': len(all_current_players),
            'detailed_data_collected': len(collected_players),
            'failed_count': failed_count,
            'team_stats': team_stats,
            'test_mode': False,
            'test_limit': test_limit
        }, f, indent=2, ensure_ascii=False)
    
    # 現役選手リスト保存
    roster_file = os.path.join(OUTPUT_DIR, "current_roster_list.json")
    with open(roster_file, 'w', encoding='utf-8') as f:
        json.dump(all_current_players, f, indent=2, ensure_ascii=False)
    
    print(f"\nFiles saved:")
    print(f"  Summary: {summary_file}")
    print(f"  Roster list: {roster_file}")
    print(f"  Player details: {PLAYERS_JSON_DIR}")

if __name__ == "__main__":
    main()