#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
integrate_kbo_to_database.py
============================
生成されたKBOデータをメインデータベースに統合
"""

import json
import sqlite3
from datetime import datetime
import os

# データベースパス
COMPREHENSIVE_DB_PATH = "./comprehensive_baseball_database.db"
KBO_PLAYERS_FILE = "./data/kbo_generated/kbo_players.json"
KBO_TEAMS_FILE = "./data/kbo_generated/kbo_teams.json"

def get_next_player_id(cursor):
    """次のプレイヤーIDを取得"""
    cursor.execute("SELECT MAX(player_id) FROM detailed_players_master")
    max_id = cursor.fetchone()[0]
    return (max_id or 0) + 1

def map_position_to_category(position):
    """ポジションをカテゴリにマッピング"""
    if 'Pitcher' in position or position == 'P':
        return '投手'
    elif 'Catcher' in position or position == 'C':
        return '捕手'
    elif '1st' in position or position == '1B':
        return '内野手'
    elif '2nd' in position or position == '2B':
        return '内野手'
    elif '3rd' in position or position == '3B':
        return '内野手'
    elif 'Short' in position or position == 'SS':
        return '内野手'
    else:
        return '外野手'

def convert_kbo_player_to_db_format(kbo_player, db_player_id):
    """KBOプレイヤーデータをDB形式に変換"""
    return {
        'player_id': db_player_id,
        'league': 'kbo',
        'original_id': kbo_player.get('player_id'),
        'full_name': kbo_player.get('full_name'),
        'current_team': kbo_player.get('current_team'),
        'primary_position': map_position_to_category(kbo_player.get('primary_position', '')),
        'jersey_number': kbo_player.get('jersey_number'),
        'age': kbo_player.get('age'),
        'height_cm': kbo_player.get('height_cm'),
        'weight_kg': kbo_player.get('weight_kg'),
        'bats': kbo_player.get('bats'),
        'throws': kbo_player.get('throws'),
        'nationality': 'Korea' if kbo_player.get('nationality') == 'KOR' else 'International',
        'team_level': kbo_player.get('team_level', 'Pro'),
        'career_status': kbo_player.get('career_status', 'active'),
        'created_at': datetime.now().isoformat(),
        'last_updated': datetime.now().isoformat()
    }

def main():
    print("Integrating KBO Data into Main Database")
    print("="*50)
    
    # KBOデータファイルの存在確認
    if not os.path.exists(KBO_PLAYERS_FILE):
        print(f"ERROR: KBO players file not found: {KBO_PLAYERS_FILE}")
        print("Please run generate_kbo_data_safe.py first")
        return
    
    # KBOデータ読み込み
    with open(KBO_PLAYERS_FILE, 'r', encoding='utf-8') as f:
        kbo_players = json.load(f)
    
    print(f"Loaded {len(kbo_players)} KBO players")
    
    # データベース接続
    conn = sqlite3.connect(COMPREHENSIVE_DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 既存のKBOデータを削除
        cursor.execute("DELETE FROM detailed_players_master WHERE league = 'kbo'")
        deleted_count = cursor.rowcount
        print(f"Deleted {deleted_count} existing KBO players")
        
        # 次のIDを取得
        starting_id = get_next_player_id(cursor)
        print(f"Starting integration from player ID: {starting_id}")
        
        # KBOプレイヤーを挿入
        successful_inserts = 0
        failed_inserts = 0
        
        for i, kbo_player in enumerate(kbo_players):
            db_player_id = starting_id + i
            
            try:
                # DB形式に変換
                db_player = convert_kbo_player_to_db_format(kbo_player, db_player_id)
                
                # データベースに挿入
                cursor.execute("""
                    INSERT INTO detailed_players_master (
                        player_id, league, original_id, full_name, current_team,
                        primary_position, jersey_number, age, height_cm, weight_kg,
                        bats, throws, nationality, team_level, career_status,
                        created_at, last_updated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    db_player['player_id'],
                    db_player['league'],
                    db_player['original_id'],
                    db_player['full_name'],
                    db_player['current_team'],
                    db_player['primary_position'],
                    db_player['jersey_number'],
                    db_player['age'],
                    db_player['height_cm'],
                    db_player['weight_kg'],
                    db_player['bats'],
                    db_player['throws'],
                    db_player['nationality'],
                    db_player['team_level'],
                    db_player['career_status'],
                    db_player['created_at'],
                    db_player['last_updated']
                ))
                
                successful_inserts += 1
                
            except sqlite3.Error as e:
                print(f"Database error for player {kbo_player.get('full_name', 'Unknown')}: {e}")
                failed_inserts += 1
        
        # コミット
        conn.commit()
        
        print(f"\nIntegration Results:")
        print(f"  Successfully inserted: {successful_inserts} players")
        print(f"  Failed: {failed_inserts} players")
        
        # 確認クエリ
        cursor.execute("SELECT COUNT(*) FROM detailed_players_master WHERE league = 'kbo'")
        kbo_count = cursor.fetchone()[0]
        print(f"  Total KBO players in database: {kbo_count}")
        
        # チーム別統計
        cursor.execute("""
            SELECT current_team, COUNT(*) 
            FROM detailed_players_master 
            WHERE league = 'kbo' 
            GROUP BY current_team 
            ORDER BY COUNT(*) DESC
        """)
        
        print(f"\nKBO Team breakdown:")
        for team, count in cursor.fetchall():
            print(f"  {team}: {count} players")
        
        # 全リーグ統計
        cursor.execute("""
            SELECT league, COUNT(*) 
            FROM detailed_players_master 
            GROUP BY league 
            ORDER BY COUNT(*) DESC
        """)
        
        print(f"\nAll leagues in database:")
        for league, count in cursor.fetchall():
            print(f"  {league.upper()}: {count} players")
        
        # サンプルKBO選手を表示
        print(f"\nSample KBO players:")
        cursor.execute("""
            SELECT player_id, full_name, current_team, primary_position, nationality
            FROM detailed_players_master 
            WHERE league = 'kbo' 
            LIMIT 5
        """)
        
        for player in cursor.fetchall():
            print(f"  ID:{player[0]} {player[1]} ({player[2]}) {player[3]} [{player[4]}]")
            
    except Exception as e:
        print(f"Error during integration: {e}")
        conn.rollback()
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()