#!/usr/bin/env python3
"""
Sample Data Generator for Baseball Analytics
野球分析用サンプルデータ生成ツール
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

def create_sample_database(db_path="comprehensive_baseball_database.db"):
    """包括的なサンプルデータベース作成"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # テーブル作成
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS detailed_players_master (
            player_id INTEGER PRIMARY KEY,
            full_name TEXT,
            league TEXT,
            current_team TEXT,
            primary_position TEXT,
            age INTEGER,
            nationality TEXT,
            height_cm INTEGER,
            weight_kg INTEGER
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS yearly_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER,
            season INTEGER,
            age INTEGER,
            games_played INTEGER,
            at_bats INTEGER,
            hits INTEGER,
            doubles INTEGER,
            triples INTEGER,
            home_runs INTEGER,
            runs INTEGER,
            rbis INTEGER,
            walks INTEGER,
            strikeouts INTEGER,
            stolen_bases INTEGER,
            batting_avg REAL,
            on_base_pct REAL,
            slugging_pct REAL,
            ops REAL,
            innings_pitched REAL,
            hits_allowed INTEGER,
            runs_allowed INTEGER,
            earned_runs INTEGER,
            walks_allowed INTEGER,
            strikeouts_pitched INTEGER,
            home_runs_allowed INTEGER,
            wins INTEGER,
            losses INTEGER,
            saves INTEGER,
            era REAL,
            whip REAL,
            FOREIGN KEY (player_id) REFERENCES detailed_players_master (player_id)
        )
    ''')
    
    # NPB選手データ生成
    npb_teams = ['Giants', 'Tigers', 'Dragons', 'BayStars', 'Carp', 'Swallows', 
                 'Lions', 'Hawks', 'Marines', 'Eagles', 'Fighters', 'Buffaloes']
    
    npb_players = []
    player_id = 1
    
    for team in npb_teams:
        # 各チーム30人
        for i in range(30):
            position = random.choice(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'])
            
            player_data = (
                player_id,
                f'NPB選手{player_id:03d}',
                'npb',
                team,
                position,
                random.randint(20, 38),
                'JPN' if random.random() < 0.85 else random.choice(['USA', 'DOM', 'VEN', 'CUB']),
                random.randint(165, 195),
                random.randint(65, 95)
            )
            npb_players.append(player_data)
            player_id += 1
    
    # KBO選手データ生成
    kbo_teams = ['Giants', 'Tigers', 'Lions', 'Bears', 'Eagles', 
                 'Heroes', 'Dinos', 'Wiz', 'Twins', 'Wyverns']
    
    kbo_players = []
    
    for team in kbo_teams:
        # 各チーム28人
        for i in range(28):
            position = random.choice(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'])
            
            player_data = (
                player_id,
                f'KBO선수{player_id:03d}',
                'kbo',
                team,
                position,
                random.randint(20, 36),
                'KOR' if random.random() < 0.80 else random.choice(['USA', 'JPN', 'DOM', 'VEN']),
                random.randint(168, 192),
                random.randint(68, 92)
            )
            kbo_players.append(player_data)
            player_id += 1
    
    # 選手マスターデータ挿入
    all_players = npb_players + kbo_players
    cursor.executemany('''
        INSERT OR REPLACE INTO detailed_players_master 
        (player_id, full_name, league, current_team, primary_position, age, nationality, height_cm, weight_kg)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', all_players)
    
    print(f"選手マスターデータ作成: {len(all_players)}名")
    
    # 年次成績データ生成（過去5年分）
    performance_data = []
    
    for player in all_players:
        player_id, name, league, team, position, age, nationality, height, weight = player
        
        # 各選手の過去3-5年分のデータ
        seasons = random.randint(3, 5)
        current_year = 2023
        
        for season_num in range(seasons):
            season = current_year - season_num
            season_age = age - season_num
            
            if position == 'P':  # 投手
                # 投手成績生成
                games = random.randint(15, 35)
                ip = random.uniform(50.0, 200.0)
                era = random.uniform(2.50, 5.50)
                wins = random.randint(3, 15)
                losses = random.randint(2, 12)
                saves = random.randint(0, 30) if random.random() < 0.3 else 0
                
                # 計算値
                earned_runs = int(era * ip / 9)
                hits_allowed = int(ip * random.uniform(0.8, 1.3))
                strikeouts_pitched = int(ip * random.uniform(0.6, 1.2))
                walks_allowed = int(ip * random.uniform(0.2, 0.6))
                whip = (hits_allowed + walks_allowed) / ip if ip > 0 else 1.50
                
                perf_data = (
                    player_id, season, season_age, games,
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  # 打撃データは0
                    0.000, 0.000, 0.000, 0.000,    # 打撃率も0
                    ip, hits_allowed, earned_runs + random.randint(0, 5), earned_runs,
                    walks_allowed, strikeouts_pitched, random.randint(0, int(ip/20)),
                    wins, losses, saves, era, whip
                )
            
            else:  # 野手
                # 野手成績生成
                games = random.randint(80, 144)
                ab = random.randint(200, 600)
                avg = random.uniform(0.220, 0.350)
                hits = int(ab * avg)
                
                # 長打内訳
                hr = random.randint(5, 40)
                doubles = random.randint(10, 35)
                triples = random.randint(0, 8)
                singles = hits - doubles - triples - hr
                
                runs = random.randint(30, 100)
                rbis = random.randint(25, 120)
                walks = random.randint(20, 80)
                strikeouts = random.randint(50, 150)
                sb = random.randint(0, 30)
                
                # 計算値
                total_bases = singles + (2*doubles) + (3*triples) + (4*hr)
                slg = total_bases / ab if ab > 0 else 0.300
                obp = (hits + walks) / (ab + walks) if (ab + walks) > 0 else 0.300
                ops = obp + slg
                
                perf_data = (
                    player_id, season, season_age, games,
                    ab, hits, doubles, triples, hr, runs, rbis, walks, strikeouts, sb,
                    avg, obp, slg, ops,
                    0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.000, 0.000  # 投手データは0
                )
            
            performance_data.append(perf_data)
    
    # 成績データ挿入
    cursor.executemany('''
        INSERT OR REPLACE INTO yearly_performance 
        (player_id, season, age, games_played, at_bats, hits, doubles, triples, home_runs, 
         runs, rbis, walks, strikeouts, stolen_bases, batting_avg, on_base_pct, slugging_pct, ops,
         innings_pitched, hits_allowed, runs_allowed, earned_runs, walks_allowed, strikeouts_pitched,
         home_runs_allowed, wins, losses, saves, era, whip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', performance_data)
    
    conn.commit()
    conn.close()
    
    print(f"年次成績データ作成: {len(performance_data)}レコード")
    print(f"サンプルデータベース作成完了: {db_path}")

def verify_sample_data(db_path="comprehensive_baseball_database.db"):
    """サンプルデータ確認"""
    conn = sqlite3.connect(db_path)
    
    # 選手数確認
    players_count = pd.read_sql_query("""
        SELECT league, COUNT(*) as player_count 
        FROM detailed_players_master 
        GROUP BY league
    """, conn)
    
    print("\n=== 選手数確認 ===")
    print(players_count)
    
    # 成績データ確認
    performance_count = pd.read_sql_query("""
        SELECT p.league, COUNT(*) as record_count
        FROM yearly_performance y
        JOIN detailed_players_master p ON y.player_id = p.player_id
        GROUP BY p.league
    """, conn)
    
    print("\n=== 成績レコード数確認 ===")
    print(performance_count)
    
    # 最小シーズン数確認
    min_seasons = pd.read_sql_query("""
        SELECT p.league, MIN(season_count) as min_seasons, MAX(season_count) as max_seasons
        FROM (
            SELECT p.player_id, p.league, COUNT(*) as season_count
            FROM yearly_performance y
            JOIN detailed_players_master p ON y.player_id = p.player_id
            GROUP BY p.player_id, p.league
        ) s
        GROUP BY s.league
    """, conn)
    
    print("\n=== シーズン数確認 ===")
    print(min_seasons)
    
    conn.close()

if __name__ == "__main__":
    print("野球分析用サンプルデータ生成開始...")
    
    # サンプルデータ生成
    create_sample_database()
    
    # データ確認
    verify_sample_data()
    
    print("\nサンプルデータ生成完了！")
    print("次のコマンドで分析システムを試せます:")
    print("python player_performance_predictor.py")
    print("python team_strength_analyzer.py")
    print("python international_baseball_comparison.py")