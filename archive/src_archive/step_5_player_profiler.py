# step_final_npb_scraper_v-perfect-fixed.py (ファイル名エラー修正版)

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
OUTPUT_DIR = "data/player_database_npb"
PLAYERS_JSON_DIR = os.path.join(OUTPUT_DIR, "players")
os.makedirs(PLAYERS_JSON_DIR, exist_ok=True)
BASE_URL = "https://npb.jp"

# (KANA_MAPは変更なし)
def create_kana_map():
    kana_groups = { '0': "あいうえおゔ", '1': "かきくけこがぎぐげご", '2': "さしすせそざじずぜぞ", '3': "たちつてとだぢづでど", '4': "なにぬねの", '5': "はひふへほばびぶべぼぱぴぷぺぽ", '6': "まみむめも", '7': "やゆよ", '8': "らりるれろ", '9': "わをん" }
    kana_map = {}
    for code, chars in kana_groups.items():
        for char in chars: kana_map[char] = code
    return kana_map
KANA_MAP = create_kana_map()

def generate_player_id(info: dict) -> str:
    league_code = info.get('league_code', '0')
    entry_year_code = str(info.get('entry_year', 0))[-3:]
    nationality_code = info.get('nationality_code', '0')
    position_code = info.get('position_code', '0')
    birth_date_obj = info.get('birth_date')
    birth_date_code = birth_date_obj.strftime('%Y%m%d') if birth_date_obj else '00000000'
    name_kana_hira = jaconv.kata2hira(info.get('name_kana', '？'))
    
    # ★★★★★ 修正点① ★★★★★
    # 読み仮名がない場合、IDの末尾を'?'ではなく'X'にする
    initial_code = KANA_MAP.get(name_kana_hira[0], 'X') if name_kana_hira else 'X'
    
    return f"{league_code}{entry_year_code:0>3}{nationality_code}{position_code}{birth_date_code}{initial_code}"

def get_all_player_urls() -> set:
    # (この関数は変更なし)
    print("Fetching all player URLs from NPB.jp (Perfect Gojuon)...")
    player_urls = set()
    kana_romaji_list = ['a', 'i', 'u', 'e', 'o', 'ka', 'ki', 'ku', 'ke', 'ko', 'sa', 'si', 'su', 'se', 'so', 'ta', 'ti', 'tu', 'te', 'to', 'na', 'ni', 'nu', 'ne', 'no', 'ha', 'hi', 'hu', 'he', 'ho', 'ma', 'mi', 'mu', 'me', 'mo', 'ya', 'yu', 'yo', 'ra', 'ri', 'ru', 're', 'ro', 'wa']
    for romaji in kana_romaji_list:
        index_url = f"{BASE_URL}/bis/players/all/index_{romaji}.html"
        try:
            res = requests.get(index_url, timeout=10)
            res.raise_for_status()
            soup = BeautifulSoup(res.content, 'html.parser')
            player_list_div = soup.select_one('div.three_column_player')
            if player_list_div:
                for a_tag in player_list_div.select('a'):
                    full_url = urljoin(BASE_URL, a_tag['href'])
                    player_urls.add(full_url)
            print(f"  Successfully fetched URLs from: {index_url}")
            time.sleep(1) 
        except requests.RequestException as e: print(f"Error fetching {index_url}: {e}")
    print(f"Found {len(player_urls)} unique player URLs.")
    return player_urls

def parse_player_page(url: str) -> dict:
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        html_content = res.content
        soup = BeautifulSoup(html_content, 'html.parser')
        player_data = {'url': url}
        player_data['name'] = soup.select_one('li#pc_v_name').get_text(strip=True)
        player_data['name_kana'] = soup.select_one('li#pc_v_kana').get_text(strip=True) if soup.select_one('li#pc_v_kana') else ''
        bio_table = soup.select_one('section#pc_bio table')
        profile = {}
        if bio_table:
            for row in bio_table.select('tr'):
                header = row.select_one('th').get_text(strip=True)
                value = row.select_one('td').get_text(strip=True)
                profile[header] = value
        player_data['profile'] = profile
        if '生年月日' in profile:
            dt_match = re.search(r'(\d+)年(\d+)月(\d+)日', profile['生年月日'])
            if dt_match: player_data['birth_date'] = datetime(int(dt_match.group(1)), int(dt_match.group(2)), int(dt_match.group(3)))
        if 'ドラフト' in profile:
            year_match = re.search(r'(\d{4})年', profile['ドラフト'])
            if year_match: player_data['entry_year'] = int(year_match.group(1))
        player_data['nationality_code'] = '2' if re.search(r'[a-zA-Z\s\.]', player_data.get('name_kana', '')) else '1'
        player_data['position_code'] = '1' if '投手' in str(soup) else '2'
        stats_dfs = []
        for table_id in ['tablefix_b', 'tablefix_p']:
            try:
                dfs = pd.read_html(html_content, attrs={'id': table_id}, flavor='lxml')
                if dfs:
                    df = dfs[0]
                    # ★★★★★ 修正点② ★★★★★
                    # SettingWithCopyWarningを回避するために.copy()を追加
                    df = df[pd.to_numeric(df['年度'], errors='coerce').notna()].copy()
                    df['stats_type'] = 'batting' if table_id == 'tablefix_b' else 'pitching'
                    stats_dfs.append(df)
            except ValueError: continue
        if stats_dfs: player_data['stats_df'] = pd.concat(stats_dfs, ignore_index=True)
        return player_data
    except Exception as e:
        print(f"Error processing {url}: {e}")
        return None

def main():
    player_urls = get_all_player_urls()
    if not player_urls:
        print("No player URLs found. Exiting.")
        return

    player_index_list = []
    new_players_processed = 0 # 新規処理した選手数をカウントする変数

    print("\nChecking for new players and processing...")
    for i, url in enumerate(list(player_urls)):
        # まずはIDを仮生成して、ファイルの存在チェックを行う
        # URLから選手ページID(数字)を抜き出すのは難しいので、一度ページを読んで情報を得る必要がある
        # そのため、ここでは簡易的なチェックに留めるか、あるいは毎回全件チェックする形になる
        # 今回は、より確実な「ID生成後のファイル存在チェック」を採用する

        # 毎回全選手を処理するのではなく、差分をチェックする
        # このループはURLのリストを回す
        
        # 選手ページの情報をまず取得
        data = parse_player_page(url)
        if not data:
            print(f"  Skipping URL (parse failed): {url}")
            continue

        player_id = generate_player_id(data)
        
        # ★★★★★ 差分更新の核心部分 ★★★★★
        json_filepath = os.path.join(PLAYERS_JSON_DIR, f"{player_id}.json")
        if os.path.exists(json_filepath):
            # ファイルが既に存在する場合、スキップする
            if i % 500 == 0: # 500件ごとに進捗を表示
                 print(f"  Skipping existing player {i+1}/{len(list(player_urls))}: {data.get('name')}")
            continue

        # --- 以下は新規選手だった場合のみ実行される ---
        new_players_processed += 1
        print(f"✨ Found new player! Processing {i+1}/{len(list(player_urls))}: {data.get('name')}")
        
        # 索引リスト用のデータを準備
        index_record = { 'player_id': player_id, 'name': data.get('name'), 'url': data.get('url') }
        player_index_list.append(index_record)
        
        # 個別JSONファイル用のデータを準備
        player_json_data = {
            'player_id': player_id,
            'name': data.get('name'),
            'name_kana': data.get('name_kana'),
            'profile': data.get('profile', {}),
            'url': data.get('url')
        }
        
        if 'stats_df' in data and data['stats_df'] is not None:
            stats_records = data['stats_df'].to_dict('records')
            player_json_data['stats'] = stats_records
        
        # JSONファイルとして保存
        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(player_json_data, f, indent=4, ensure_ascii=False)
            
        time.sleep(1)

    print("\n--- Update Summary ---")
    print(f"✅ New players found and processed: {new_players_processed}")

    # 新規選手がいた場合のみ、索引ファイルを更新する
    if player_index_list:
        print("Updating index file...")
        # 既存の索引ファイルを読み込む
        index_filepath = os.path.join(OUTPUT_DIR, "player_index.csv")
        try:
            existing_df = pd.read_csv(index_filepath)
            new_df = pd.DataFrame(player_index_list)
            # 既存のデータと新しいデータを結合
            updated_df = pd.concat([existing_df, new_df], ignore_index=True)
        except FileNotFoundError:
            # ファイルがなければ、新規作成
            updated_df = pd.DataFrame(player_index_list)
        
        # 重複を削除し、IDでソートして保存
        updated_df.drop_duplicates(subset=['player_id'], keep='last', inplace=True)
        updated_df.sort_values('player_id', inplace=True)
        updated_df.to_csv(index_filepath, index=False, encoding="utf-8-sig")
        print(f"✅ Player index file updated: {index_filepath}")
    else:
        print("No new players to add to the index.")
        
    print("\n🎯 All tasks complete.")
if __name__ == "__main__":
    main()