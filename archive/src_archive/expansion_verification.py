#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
expansion_verification.py
=========================
拡張システム検証プログラム

拡張された野球データベースの詳細確認・統計分析
"""
import sqlite3
import pandas as pd
import numpy as np

def verify_expansion_database():
    """拡張データベース検証"""
    
    print("=" * 70)
    print("EXPANSION DATABASE VERIFICATION")
    print("拡張データベース詳細検証レポート")
    print("=" * 70)
    
    db_file = "expanded_baseball_database.db"
    
    try:
        with sqlite3.connect(db_file) as conn:
            # 基本統計
            print("\n[DATABASE OVERVIEW]")
            
            # テーブル構造
            tables = pd.read_sql_query(
                "SELECT name FROM sqlite_master WHERE type='table'", 
                conn
            )['name'].tolist()
            
            print(f"Tables: {len(tables)}")
            for table in tables:
                count = pd.read_sql_query(f"SELECT COUNT(*) FROM {table}", conn).iloc[0, 0]
                print(f"  {table}: {count:,} records")
            
            # 選手統計詳細
            print(f"\n[PLAYER ANALYSIS]")
            
            # リーグ・レベル別詳細
            league_level_stats = pd.read_sql_query('''
                SELECT 
                    league,
                    team_level,
                    status,
                    COUNT(*) as players,
                    AVG(scouting_grade) as avg_grade,
                    COUNT(CASE WHEN prospect_ranking IS NOT NULL THEN 1 END) as ranked_prospects
                FROM expanded_players_master
                GROUP BY league, team_level, status
                ORDER BY league, team_level, status
            ''', conn)
            
            print("League/Level/Status breakdown:")
            for _, row in league_level_stats.iterrows():
                print(f"  {row['league']} {row['team_level']} ({row['status']}): "
                      f"{row['players']} players, grade {row['avg_grade']:.1f}, "
                      f"{row['ranked_prospects']} ranked prospects")
            
            # 国籍分析
            print(f"\n[NATIONALITY ANALYSIS]")
            nationality_stats = pd.read_sql_query('''
                SELECT 
                    nationality,
                    COUNT(*) as players,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM expanded_players_master), 1) as percentage
                FROM expanded_players_master
                GROUP BY nationality
                ORDER BY players DESC
                LIMIT 10
            ''', conn)
            
            print("Top nationalities:")
            for _, row in nationality_stats.iterrows():
                print(f"  {row['nationality']}: {row['players']} players ({row['percentage']}%)")
            
            # ポジション分析
            print(f"\n[POSITION ANALYSIS]")
            position_stats = pd.read_sql_query('''
                SELECT 
                    position,
                    COUNT(*) as players,
                    AVG(scouting_grade) as avg_grade
                FROM expanded_players_master
                GROUP BY position
                ORDER BY players DESC
            ''', conn)
            
            print("Position distribution:")
            for _, row in position_stats.iterrows():
                print(f"  {row['position']}: {row['players']} players (avg grade: {row['avg_grade']:.1f})")
            
            # 成績統計分析
            print(f"\n[PERFORMANCE STATISTICS]")
            
            # 打撃成績サンプル
            batting_sample = pd.read_sql_query('''
                SELECT 
                    AVG(batting_avg) as avg_batting_avg,
                    AVG(ops) as avg_ops,
                    MAX(home_runs) as max_home_runs,
                    COUNT(*) as total_hitters
                FROM expanded_player_stats
                WHERE batting_avg IS NOT NULL
            ''', conn)
            
            if not batting_sample.empty and pd.notna(batting_sample.iloc[0, 0]):
                row = batting_sample.iloc[0]
                print(f"Batting stats (across all levels):")
                print(f"  Average BA: {row['avg_batting_avg']:.3f}")
                print(f"  Average OPS: {row['avg_ops']:.3f}")
                print(f"  Max HR: {int(row['max_home_runs'])}")
                print(f"  Total hitters: {int(row['total_hitters'])}")
            
            # 投手成績サンプル
            pitching_sample = pd.read_sql_query('''
                SELECT 
                    AVG(era) as avg_era,
                    AVG(whip) as avg_whip,
                    MAX(strikeouts_pitched) as max_strikeouts,
                    COUNT(*) as total_pitchers
                FROM expanded_player_stats
                WHERE era IS NOT NULL
            ''', conn)
            
            if not pitching_sample.empty and pd.notna(pitching_sample.iloc[0, 0]):
                row = pitching_sample.iloc[0]
                print(f"Pitching stats (across all levels):")
                print(f"  Average ERA: {row['avg_era']:.2f}")
                print(f"  Average WHIP: {row['avg_whip']:.3f}")
                print(f"  Max Strikeouts: {int(row['max_strikeouts'])}")
                print(f"  Total pitchers: {int(row['total_pitchers'])}")
            
            # プロスペクト分析
            print(f"\n[PROSPECT ANALYSIS]")
            
            prospect_stats = pd.read_sql_query('''
                SELECT 
                    league,
                    COUNT(*) as total_prospects,
                    COUNT(CASE WHEN prospect_ranking IS NOT NULL THEN 1 END) as ranked_prospects,
                    MIN(prospect_ranking) as top_rank,
                    AVG(scouting_grade) as avg_grade
                FROM expanded_players_master
                WHERE status = 'prospect'
                GROUP BY league
                ORDER BY total_prospects DESC
            ''', conn)
            
            print("Prospect breakdown by league:")
            for _, row in prospect_stats.iterrows():
                print(f"  {row['league']}: {row['total_prospects']} total, "
                      f"{row['ranked_prospects']} ranked (top rank: {row['top_rank'] if pd.notna(row['top_rank']) else 'N/A'}), "
                      f"avg grade: {row['avg_grade']:.1f}")
            
            # 比較分析
            print(f"\n[EXPANSION COMPARISON]")
            
            # 元のデータベースとの比較
            original_counts = {
                'MLB': 780,
                'KBO': 280, 
                'NPB': 400
            }
            
            expanded_counts = pd.read_sql_query('''
                SELECT league, COUNT(*) as players
                FROM expanded_players_master
                GROUP BY league
            ''', conn)
            
            print("Expansion achievement:")
            for _, row in expanded_counts.iterrows():
                league = row['league']
                expanded = row['players']
                original = original_counts.get(league, 0)
                expansion_rate = ((expanded - original) / original * 100) if original > 0 else 0
                print(f"  {league}: {original} → {expanded} players (+{expansion_rate:.1f}%)")
            
            total_expanded = expanded_counts['players'].sum()
            total_original = sum(original_counts.values())
            overall_expansion = ((total_expanded - total_original) / total_original * 100)
            
            print(f"  TOTAL: {total_original} → {total_expanded} players (+{overall_expansion:.1f}%)")
            
            # データベースサイズ
            import os
            db_size = os.path.getsize(db_file) / 1024  # KB
            print(f"\nDatabase size: {db_size:.1f} KB ({db_size/1024:.2f} MB)")
            
    except Exception as e:
        print(f"Error accessing expanded database: {e}")
    
    print("\n" + "=" * 70)
    print("VERIFICATION COMPLETE")
    print("=" * 70)

def show_sample_players():
    """サンプル選手表示"""
    print("\n[SAMPLE PLAYERS FROM EACH LEAGUE/LEVEL]")
    
    with sqlite3.connect("expanded_baseball_database.db") as conn:
        # 各レベルからサンプル選手取得
        sample_query = '''
            SELECT 
                league,
                team_level,
                full_name,
                native_name,
                position,
                team_name,
                nationality,
                status,
                scouting_grade,
                prospect_ranking
            FROM expanded_players_master
            WHERE expanded_player_id IN (
                SELECT expanded_player_id 
                FROM expanded_players_master 
                WHERE league = ? AND team_level = ?
                ORDER BY RANDOM() 
                LIMIT 3
            )
            ORDER BY league, team_level, scouting_grade DESC
        '''
        
        levels = [
            ('MLB', 'MLB'),
            ('MLB', 'AAA'),
            ('KBO', 'KBO'),
            ('KBO', 'KBO Futures'),
            ('NPB', 'NPB'),
            ('NPB', 'NPB Farm'),
            ('NPB', 'NPB Academy')
        ]
        
        for league, level in levels:
            players = pd.read_sql_query(sample_query, conn, params=[league, level])
            
            if not players.empty:
                print(f"\n{league} {level} samples:")
                for _, player in players.iterrows():
                    name_display = player['full_name']
                    if pd.notna(player['native_name']) and player['native_name']:
                        name_display += f" ({player['native_name']})"
                    
                    prospect_info = ""
                    if pd.notna(player['prospect_ranking']):
                        prospect_info = f", Rank #{int(player['prospect_ranking'])}"
                    
                    print(f"  {name_display} - {player['position']}, {player['team_name']}")
                    print(f"    {player['nationality']}, {player['status']}, Grade: {player['scouting_grade']:.1f}{prospect_info}")

if __name__ == "__main__":
    verify_expansion_database()
    show_sample_players()