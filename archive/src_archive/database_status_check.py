#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
database_status_check.py
========================
野球データベース現状確認システム

各リーグデータベースの詳細状況・統計・カバレッジ分析
"""
import sqlite3
import pandas as pd
from pathlib import Path
import os

def check_database_status():
    """全データベース状況確認"""
    
    # データベースファイル検索
    db_files = {
        'MLB': 'mlb_data.db',
        'KBO': 'kbo_data.db', 
        'KBO_Complete': 'kbo_complete_data.db',
        'KBO_Realtime': 'kbo_realtime_data.db',
        'International': 'international_baseball_comparison.db',
        'NPB_Ecosystem': 'npb_ecosystem.db',
        'Baseball-AI-Media': 'baseball-ai-media.db'  # NPBメインDB
    }
    
    print("=" * 80)
    print("BASEBALL DATABASES STATUS REPORT")
    print("現状各リーグデータベース詳細分析")
    print("=" * 80)
    
    total_records = 0
    
    for league, db_file in db_files.items():
        if os.path.exists(db_file):
            file_size = os.path.getsize(db_file) / 1024  # KB
            print(f"\n[{league}] Database: {db_file} ({file_size:.1f} KB)")
            
            try:
                with sqlite3.connect(db_file) as conn:
                    # テーブル一覧取得
                    tables = pd.read_sql_query(
                        "SELECT name FROM sqlite_master WHERE type='table'", 
                        conn
                    )['name'].tolist()
                    
                    if not tables:
                        print("   No tables found")
                        continue
                    
                    print(f"   Tables: {len(tables)}")
                    
                    # 各テーブルのレコード数
                    table_stats = {}
                    league_total = 0
                    
                    for table in tables:
                        if table != 'sqlite_sequence':
                            try:
                                count_query = f"SELECT COUNT(*) FROM {table}"
                                count = pd.read_sql_query(count_query, conn).iloc[0, 0]
                                table_stats[table] = count
                                league_total += count
                            except Exception as e:
                                table_stats[table] = f"Error: {e}"
                    
                    # 上位5テーブル表示
                    sorted_tables = sorted(
                        [(k, v) for k, v in table_stats.items() if isinstance(v, int)], 
                        key=lambda x: x[1], 
                        reverse=True
                    )[:5]
                    
                    for table_name, record_count in sorted_tables:
                        print(f"     {table_name}: {record_count:,} records")
                    
                    print(f"   TOTAL RECORDS: {league_total:,}")
                    total_records += league_total
                    
                    # 特別な分析
                    if league == 'MLB':
                        analyze_mlb_database(conn)
                    elif league == 'KBO':
                        analyze_kbo_database(conn)
                    elif league == 'International':
                        analyze_international_database(conn)
                        
            except Exception as e:
                print(f"   ERROR accessing database: {e}")
        else:
            print(f"\n[{league}] Database: {db_file} - NOT FOUND")
    
    print(f"\n" + "=" * 80)
    print(f"TOTAL DATABASE RECORDS ACROSS ALL SYSTEMS: {total_records:,}")
    print("=" * 80)

def analyze_mlb_database(conn):
    """MLB データベース詳細分析"""
    try:
        # 選手統計
        players = pd.read_sql_query("SELECT COUNT(*) as count FROM mlb_players_master", conn).iloc[0, 0]
        teams = pd.read_sql_query("SELECT COUNT(*) as count FROM mlb_teams_master", conn).iloc[0, 0]
        
        # 打撃・投手成績
        batting_records = pd.read_sql_query("SELECT COUNT(*) as count FROM mlb_batting_stats", conn).iloc[0, 0]
        pitching_records = pd.read_sql_query("SELECT COUNT(*) as count FROM mlb_pitching_stats", conn).iloc[0, 0]
        
        # 高度指標
        try:
            advanced_metrics = pd.read_sql_query("SELECT COUNT(*) as count FROM mlb_advanced_metrics", conn).iloc[0, 0]
            print(f"     → Players: {players}, Teams: {teams}")
            print(f"     → Batting: {batting_records}, Pitching: {pitching_records}, Advanced: {advanced_metrics}")
            
            # WAR分布
            war_stats = pd.read_sql_query("""
                SELECT 
                    AVG(war) as avg_war, 
                    MAX(war) as max_war, 
                    MIN(war) as min_war
                FROM mlb_advanced_metrics 
                WHERE war IS NOT NULL
            """, conn)
            
            if not war_stats.empty and pd.notna(war_stats.iloc[0, 0]):
                print(f"     → WAR: avg {war_stats.iloc[0, 0]:.2f}, max {war_stats.iloc[0, 1]:.1f}, min {war_stats.iloc[0, 2]:.1f}")
                
        except:
            print(f"     → Players: {players}, Teams: {teams}, Batting: {batting_records}, Pitching: {pitching_records}")
            
    except Exception as e:
        print(f"     → Analysis error: {e}")

def analyze_kbo_database(conn):
    """KBO データベース詳細分析"""
    try:
        # 基本統計
        try:
            players = pd.read_sql_query("SELECT COUNT(*) as count FROM players_master", conn).iloc[0, 0]
            teams = pd.read_sql_query("SELECT COUNT(*) as count FROM team_standings", conn).iloc[0, 0]
            print(f"     → Players: {players}, Team standings: {teams}")
        except:
            pass
        
        # 高度指標確認
        advanced_tables = ['advanced_metrics_offensive', 'advanced_metrics_pitching', 'advanced_metrics_defensive']
        advanced_counts = {}
        
        for table in advanced_tables:
            try:
                count = pd.read_sql_query(f"SELECT COUNT(*) as count FROM {table}", conn).iloc[0, 0]
                advanced_counts[table.replace('advanced_metrics_', '')] = count
            except:
                pass
        
        if advanced_counts:
            print(f"     → Advanced metrics: {advanced_counts}")
            
    except Exception as e:
        print(f"     → Analysis error: {e}")

def analyze_international_database(conn):
    """国際比較データベース詳細分析"""
    try:
        # リーグ別選手数
        league_stats = pd.read_sql_query("""
            SELECT league, COUNT(*) as players
            FROM international_players
            GROUP BY league
            ORDER BY players DESC
        """, conn)
        
        print(f"     → League distribution:")
        for _, row in league_stats.iterrows():
            print(f"       {row['league']}: {row['players']} players")
            
        # 調整済み指標数
        adjusted_metrics = pd.read_sql_query("SELECT COUNT(*) as count FROM adjusted_international_metrics", conn).iloc[0, 0]
        print(f"     → Adjusted metrics: {adjusted_metrics}")
        
    except Exception as e:
        print(f"     → Analysis error: {e}")

def show_npb_status():
    """NPB データベース状況確認"""
    npb_main = 'baseball-ai-media.db'
    
    if os.path.exists(npb_main):
        print(f"\n[NPB MAIN] Database: {npb_main}")
        
        try:
            with sqlite3.connect(npb_main) as conn:
                # NPBメインデータベースの構造確認
                tables = pd.read_sql_query(
                    "SELECT name FROM sqlite_master WHERE type='table'", 
                    conn
                )['name'].tolist()
                
                print(f"   NPB Tables: {len(tables)}")
                for table in tables[:10]:  # 最初の10テーブル表示
                    try:
                        count = pd.read_sql_query(f"SELECT COUNT(*) FROM {table}", conn).iloc[0, 0]
                        print(f"     {table}: {count:,} records")
                    except:
                        print(f"     {table}: [access error]")
                        
        except Exception as e:
            print(f"   ERROR: {e}")
    else:
        print(f"\n[NPB MAIN] Database: {npb_main} - NOT FOUND")

if __name__ == "__main__":
    check_database_status()
    show_npb_status()