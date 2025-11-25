#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
integrate_npb_real_data.py
==========================
NPB現役選手の実データをデータベースに統合
"""

import os
import json
import sqlite3
from datetime import datetime
import re

# データベースパス
COMPREHENSIVE_DB_PATH = "./comprehensive_baseball_database.db"
NPB_PLAYERS_DIR = "./data/npb_current_players/players"

def get_next_player_id(cursor):
    """次のプレイヤーIDを取得"""
    cursor.execute("SELECT MAX(player_id) FROM detailed_players_master")
    max_id = cursor.fetchone()[0]
    return (max_id or 0) + 1
    
def parse_height_weight(profile_data):
    """身長・体重情報を解析"""
    height_weight = profile_data.get('身長／体重', '')
    height_cm = None
    weight_kg = None
    
    if height_weight:
        # 183cm／86kg のような形式を解析
        height_match = re.search(r'(\d+)cm', height_weight)
        weight_match = re.search(r'(\d+)kg', height_weight)
        
        if height_match:
            height_cm = int(height_match.group(1))
        if weight_match:
            weight_kg = int(weight_match.group(1))
    
    return height_cm, weight_kg

def parse_batting_throwing(profile_data):
    """投打情報を解析"""
    toda = profile_data.get('投打', '')
    throwing = None
    batting = None
    
    if toda:
        if '左投' in toda:
            throwing = '左'
        elif '右投' in toda:
            throwing = '右'
            
        if '左打' in toda:
            batting = '左'
        elif '右打' in toda:
            batting = '右'
        elif '両打' in toda or 'スイッチ' in toda:
            batting = '両'
    
    return batting, throwing

def calculate_age(birth_date_str):
    """年齢を計算"""
    if not birth_date_str:
        return None
    
    try:
        birth_date = datetime.strptime(birth_date_str, '%Y-%m-%d %H:%M:%S')
        today = datetime.now()
        age = today.year - birth_date.year
        if today.month < birth_date.month or (today.month == birth_date.month and today.day < birth_date.day):
            age -= 1
        return age
    except:
        return None

def determine_nationality(player_data):
    """国籍を判定"""
    name = player_data.get('name', '')
    name_kana = player_data.get('name_kana', '')
    nationality_code = player_data.get('nationality_code', '1')
    
    # 外国人選手の判定
    if nationality_code == '2' or re.search(r'[A-Za-z]', name):
        return '外国'
    else:
        return '日本'

def process_player_file(filepath):
    """個別プレイヤーファイルを処理"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            player_data = json.load(f)
        
        profile = player_data.get('profile', {})
        
        # 基本情報
        player_id = player_data.get('player_id')
        full_name = player_data.get('name', '')
        name_kana = player_data.get('name_kana', '')
        current_team = player_data.get('team', '')
        team_code = player_data.get('team_code', '')
        position = player_data.get('position', profile.get('ポジション', ''))
        
        # 身長・体重
        height_cm, weight_kg = parse_height_weight(profile)
        
        # 投打
        batting_stance, throwing_arm = parse_batting_throwing(profile)
        
        # 年齢
        birth_date_str = player_data.get('birth_date', '')
        age = calculate_age(birth_date_str)
        
        # 国籍
        nationality = determine_nationality(player_data)
        
        # その他の情報
        career_info = profile.get('経歴', '')
        draft_info = profile.get('ドラフト', '')
        url = player_data.get('url', '')
        current_status = player_data.get('current_status', 'active')
        
        # 生年月日を正しい形式に変換
        if birth_date_str and ' ' in birth_date_str:
            birth_date_str = birth_date_str.split(' ')[0]  # 日付部分のみ
        
        return {
            'original_npb_id': player_id,  # NPBの元のID
            'full_name': full_name,
            'native_name': name_kana,  # name_kanaをnative_nameに
            'current_team': current_team,
            'primary_position': position,
            'jersey_number': None,  # 今のデータには含まれていない
            'age': age,
            'birth_date': birth_date_str,
            'nationality': nationality,
            'league': 'npb',
            'team_level': 'Pro',  # NPBはプロリーグ
            'bats': batting_stance,  # batting_stanceをbatsに
            'throws': throwing_arm,  # throwing_armをthrowsに
            'height_cm': height_cm,
            'weight_kg': weight_kg,
            'career_info': career_info,
            'draft_info': draft_info,
            'career_status': current_status,  # current_statusをcareer_statusに
            'url': url
        }
    
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return None

def main():
    print("NPB Real Data Integration")
    print("=" * 50)
    
    # データベース接続
    conn = sqlite3.connect(COMPREHENSIVE_DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 既存のNPB選手データを削除（実データで置き換えるため）
        cursor.execute("DELETE FROM detailed_players_master WHERE league = 'npb'")
        print(f"Deleted existing NPB players from database")
        
        # 次のID取得用の開始ID
        starting_id = get_next_player_id(cursor)
        
        # プレイヤーファイルを処理
        players_dir = NPB_PLAYERS_DIR
        if not os.path.exists(players_dir):
            print(f"Players directory not found: {players_dir}")
            return
        
        player_files = [f for f in os.listdir(players_dir) if f.endswith('.json')]
        print(f"Found {len(player_files)} player files to process")
        
        successful_inserts = 0
        failed_inserts = 0
        current_id = starting_id
        
        for filename in player_files:
            filepath = os.path.join(players_dir, filename)
            player_record = process_player_file(filepath)
            
            if player_record:
                try:
                    # データベースに挿入（既存スキーマに合わせて）
                    cursor.execute("""
                        INSERT INTO detailed_players_master (
                            player_id, league, full_name, native_name, current_team,
                            primary_position, jersey_number, age, birth_date, nationality,
                            team_level, bats, throws, height_cm, weight_kg,
                            career_status, created_at, last_updated
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        current_id,
                        player_record['league'],
                        player_record['full_name'],
                        player_record['native_name'],
                        player_record['current_team'],
                        player_record['primary_position'],
                        player_record['jersey_number'],
                        player_record['age'],
                        player_record['birth_date'],
                        player_record['nationality'],
                        player_record['team_level'],
                        player_record['bats'],
                        player_record['throws'],
                        player_record['height_cm'],
                        player_record['weight_kg'],
                        player_record['career_status'],
                        datetime.now().isoformat(),
                        datetime.now().isoformat()
                    ))
                    successful_inserts += 1
                    current_id += 1
                    
                except sqlite3.Error as e:
                    print(f"Database error for {filename}: {e}")
                    failed_inserts += 1
            else:
                failed_inserts += 1
        
        # コミット
        conn.commit()
        
        print(f"\\nIntegration Results:")
        print(f"  Successfully inserted: {successful_inserts} players")
        print(f"  Failed: {failed_inserts} players")
        
        # 確認クエリ
        cursor.execute("SELECT COUNT(*) FROM detailed_players_master WHERE league = 'npb'")
        npb_count = cursor.fetchone()[0]
        print(f"  Total NPB players in database: {npb_count}")
        
        # チーム別統計
        cursor.execute("""
            SELECT current_team, COUNT(*) 
            FROM detailed_players_master 
            WHERE league = 'npb' 
            GROUP BY current_team 
            ORDER BY COUNT(*) DESC
        """)
        
        print(f"\\nTeam breakdown:")
        for team, count in cursor.fetchall():
            print(f"  {team}: {count} players")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()