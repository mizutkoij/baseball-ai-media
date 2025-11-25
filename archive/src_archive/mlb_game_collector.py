#!/usr/bin/env python3
"""
MLB Game Data Collector
MLB試合情報収集システム
"""

import sqlite3
import requests
import json
from datetime import datetime, timedelta
import random
import time

def create_mlb_games_table():
    """MLB試合データ用テーブル作成"""
    conn = sqlite3.connect('comprehensive_baseball_database.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mlb_games (
            game_id TEXT PRIMARY KEY,
            game_date DATE,
            home_team TEXT,
            away_team TEXT,
            home_team_code TEXT,
            away_team_code TEXT,
            venue TEXT,
            game_time TEXT,
            home_score INTEGER,
            away_score INTEGER,
            status TEXT,
            inning INTEGER,
            inning_half TEXT,
            league_type TEXT,
            attendance INTEGER,
            game_duration TEXT,
            weather_condition TEXT,
            temperature TEXT,
            wind_speed TEXT,
            home_pitcher TEXT,
            away_pitcher TEXT,
            home_hits INTEGER,
            away_hits INTEGER,
            home_errors INTEGER,
            away_errors INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print("MLB試合データテーブル作成完了")

def generate_mlb_sample_games():
    """MLBサンプル試合データ生成"""
    
    # MLB チーム情報
    mlb_teams = {
        # アメリカン リーグ東地区
        'NYY': {'name': 'ニューヨーク・ヤンキース', 'city': 'New York', 'stadium': 'ヤンキー・スタジアム'},
        'BOS': {'name': 'ボストン・レッドソックス', 'city': 'Boston', 'stadium': 'フェンウェイ・パーク'},
        'TB': {'name': 'タンパベイ・レイズ', 'city': 'Tampa Bay', 'stadium': 'トロピカーナ・フィールド'},
        'TOR': {'name': 'トロント・ブルージェイズ', 'city': 'Toronto', 'stadium': 'ロジャース・センター'},
        'BAL': {'name': 'ボルチモア・オリオールズ', 'city': 'Baltimore', 'stadium': 'オリオール・パーク'},
        
        # アメリカン リーグ中地区
        'CLE': {'name': 'クリーブランド・ガーディアンズ', 'city': 'Cleveland', 'stadium': 'プログレッシブ・フィールド'},
        'MIN': {'name': 'ミネソタ・ツインズ', 'city': 'Minneapolis', 'stadium': 'ターゲット・フィールド'},
        'DET': {'name': 'デトロイト・タイガース', 'city': 'Detroit', 'stadium': 'コメリカ・パーク'},
        'KC': {'name': 'カンザスシティ・ロイヤルズ', 'city': 'Kansas City', 'stadium': 'カウフマン・スタジアム'},
        'CWS': {'name': 'シカゴ・ホワイトソックス', 'city': 'Chicago', 'stadium': 'ギャランティード・レート・フィールド'},
        
        # アメリカン リーグ西地区
        'HOU': {'name': 'ヒューストン・アストロズ', 'city': 'Houston', 'stadium': 'ミニッツメイド・パーク'},
        'TEX': {'name': 'テキサス・レンジャーズ', 'city': 'Arlington', 'stadium': 'グローブライフ・フィールド'},
        'SEA': {'name': 'シアトル・マリナーズ', 'city': 'Seattle', 'stadium': 'T-モバイル・パーク'},
        'LAA': {'name': 'ロサンゼルス・エンゼルス', 'city': 'Anaheim', 'stadium': 'エンゼル・スタジアム'},
        'OAK': {'name': 'オークランド・アスレチックス', 'city': 'Oakland', 'stadium': 'オークランド・コロシアム'},
        
        # ナショナル リーグ東地区
        'NYM': {'name': 'ニューヨーク・メッツ', 'city': 'New York', 'stadium': 'シティ・フィールド'},
        'ATL': {'name': 'アトランタ・ブレーブス', 'city': 'Atlanta', 'stadium': 'トゥルーイスト・パーク'},
        'PHI': {'name': 'フィラデルフィア・フィリーズ', 'city': 'Philadelphia', 'stadium': 'シチズンズ・バンク・パーク'},
        'MIA': {'name': 'マイアミ・マーリンズ', 'city': 'Miami', 'stadium': 'ローンデポ・パーク'},
        'WSH': {'name': 'ワシントン・ナショナルズ', 'city': 'Washington', 'stadium': 'ナショナルズ・パーク'},
        
        # ナショナル リーグ中地区
        'CHC': {'name': 'シカゴ・カブス', 'city': 'Chicago', 'stadium': 'リグリー・フィールド'},
        'MIL': {'name': 'ミルウォーキー・ブリュワーズ', 'city': 'Milwaukee', 'stadium': 'アメリカン・ファミリー・フィールド'},
        'STL': {'name': 'セントルイス・カージナルス', 'city': 'St. Louis', 'stadium': 'ブッシュ・スタジアム'},
        'CIN': {'name': 'シンシナティ・レッズ', 'city': 'Cincinnati', 'stadium': 'グレート・アメリカン・ボール・パーク'},
        'PIT': {'name': 'ピッツバーグ・パイレーツ', 'city': 'Pittsburgh', 'stadium': 'PNCパーク'},
        
        # ナショナル リーグ西地区
        'LAD': {'name': 'ロサンゼルス・ドジャース', 'city': 'Los Angeles', 'stadium': 'ドジャー・スタジアム'},
        'SD': {'name': 'サンディエゴ・パドレス', 'city': 'San Diego', 'stadium': 'ペトコ・パーク'},
        'SF': {'name': 'サンフランシスコ・ジャイアンツ', 'city': 'San Francisco', 'stadium': 'オラクル・パーク'},
        'COL': {'name': 'コロラド・ロッキーズ', 'city': 'Denver', 'stadium': 'クアーズ・フィールド'},
        'ARI': {'name': 'アリゾナ・ダイヤモンドバックス', 'city': 'Phoenix', 'stadium': 'チェース・フィールド'}
    }
    
    # 有名MLB投手名（カタカナ + 英語）
    pitchers = [
        ('ゲリット・コール', 'Gerrit Cole'),
        ('ジェイコブ・デグロム', 'Jacob deGrom'),
        ('マックス・シャーザー', 'Max Scherzer'),
        ('シェーン・ビーバー', 'Shane Bieber'),
        ('アーロン・ノラ', 'Aaron Nola'),
        ('ザック・ウィーラー', 'Zack Wheeler'),
        ('サンディ・アルカンタラ', 'Sandy Alcantara'),
        ('コービン・バーンズ', 'Corbin Burnes'),
        ('フランシス・ベイダー', 'Framber Valdez'),
        ('ルーカス・ジオリト', 'Lucas Giolito')
    ]
    
    games = []
    team_codes = list(mlb_teams.keys())
    
    # 過去2週間の試合データ生成
    for days_ago in range(14, 0, -1):
        game_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        
        # 1日あたり8-12試合
        daily_games = random.randint(8, 12)
        
        # その日の対戦カードを生成
        used_teams = set()
        for game_num in range(daily_games):
            # ホーム・アウェイチーム選択（重複なし）
            available_teams = [t for t in team_codes if t not in used_teams]
            if len(available_teams) < 2:
                break
                
            home_code = random.choice(available_teams)
            available_teams.remove(home_code)
            away_code = random.choice(available_teams)
            
            used_teams.add(home_code)
            used_teams.add(away_code)
            
            home_team = mlb_teams[home_code]
            away_team = mlb_teams[away_code]
            
            # スコア生成（リアルな範囲）
            home_score = random.randint(0, 12)
            away_score = random.randint(0, 12)
            
            # ゲーム時間
            game_hours = random.randint(2, 4)
            game_minutes = random.randint(15, 45)
            game_duration = f"{game_hours}時間{game_minutes}分"
            
            # 投手選択
            home_pitcher_jp, home_pitcher_en = random.choice(pitchers)
            away_pitcher_jp, away_pitcher_en = random.choice(pitchers)
            
            # 観客数
            attendance = random.randint(15000, 45000)
            
            # 天候
            weather_conditions = ['晴れ', '曇り', '小雨', 'ドーム（屋内）']
            weather = random.choice(weather_conditions)
            
            game = {
                'game_id': f"MLB_{game_date}_{home_code}_{away_code}",
                'game_date': game_date,
                'home_team': home_team['name'],
                'away_team': away_team['name'],
                'home_team_code': home_code,
                'away_team_code': away_code,
                'venue': home_team['stadium'],
                'game_time': f"{random.randint(12, 19)}:{random.choice(['00', '05', '10', '15', '30', '35'])}",
                'home_score': home_score,
                'away_score': away_score,
                'status': 'finished',
                'inning': 9,
                'inning_half': 'final',
                'league_type': 'regular',
                'attendance': attendance,
                'game_duration': game_duration,
                'weather_condition': weather,
                'temperature': f"{random.randint(18, 32)}°C",
                'wind_speed': f"{random.randint(5, 25)}km/h",
                'home_pitcher': f"{home_pitcher_jp} ({home_pitcher_en})",
                'away_pitcher': f"{away_pitcher_jp} ({away_pitcher_en})",
                'home_hits': random.randint(4, 15),
                'away_hits': random.randint(4, 15),
                'home_errors': random.randint(0, 3),
                'away_errors': random.randint(0, 3)
            }
            
            games.append(game)
    
    return games

def save_mlb_games(games):
    """MLB試合データをデータベースに保存"""
    conn = sqlite3.connect('comprehensive_baseball_database.db')
    cursor = conn.cursor()
    
    for game in games:
        cursor.execute('''
            INSERT OR REPLACE INTO mlb_games (
                game_id, game_date, home_team, away_team, home_team_code, away_team_code,
                venue, game_time, home_score, away_score, status, inning, inning_half,
                league_type, attendance, game_duration, weather_condition, temperature,
                wind_speed, home_pitcher, away_pitcher, home_hits, away_hits,
                home_errors, away_errors
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            game['game_id'], game['game_date'], game['home_team'], game['away_team'],
            game['home_team_code'], game['away_team_code'], game['venue'], game['game_time'],
            game['home_score'], game['away_score'], game['status'], game['inning'],
            game['inning_half'], game['league_type'], game['attendance'], game['game_duration'],
            game['weather_condition'], game['temperature'], game['wind_speed'],
            game['home_pitcher'], game['away_pitcher'], game['home_hits'], game['away_hits'],
            game['home_errors'], game['away_errors']
        ))
    
    conn.commit()
    conn.close()
    print(f"MLB試合データ保存完了: {len(games)}試合")

def verify_mlb_games():
    """MLB試合データ確認"""
    conn = sqlite3.connect('comprehensive_baseball_database.db')
    cursor = conn.cursor()
    
    # 試合数確認
    cursor.execute("SELECT COUNT(*) FROM mlb_games")
    total_games = cursor.fetchone()[0]
    
    # 最新試合確認
    cursor.execute("""
        SELECT game_date, home_team, away_team, home_score, away_score 
        FROM mlb_games 
        ORDER BY game_date DESC 
        LIMIT 5
    """)
    recent_games = cursor.fetchall()
    
    print(f"\n=== MLB試合データ確認 ===")
    print(f"総試合数: {total_games}試合")
    print(f"\n最新試合:")
    for game_date, home_team, away_team, home_score, away_score in recent_games:
        print(f"  {game_date}: {away_team} {away_score} - {home_score} {home_team}")
    
    conn.close()

if __name__ == "__main__":
    print("MLB試合データ収集開始...")
    
    # テーブル作成
    create_mlb_games_table()
    
    # サンプル試合データ生成
    games = generate_mlb_sample_games()
    
    # データベースに保存
    save_mlb_games(games)
    
    # 確認
    verify_mlb_games()
    
    print("\n✅ MLB試合データ収集完了！")
    print("localhost:3000/api/games で確認できます")