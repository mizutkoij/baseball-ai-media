#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
database_summary.py
===================
野球データベース統合サマリー

現状各リーグデータベースの簡潔な状況報告
"""
import sqlite3
import pandas as pd
import os
from pathlib import Path

def get_database_summary():
    """データベース統合サマリー"""
    
    print("=" * 70)
    print("BASEBALL DATABASES CURRENT STATUS")
    print("=" * 70)
    
    # 主要データベース定義
    databases = {
        'MLB System': {
            'file': 'mlb_data.db',
            'description': 'MLB complete data system'
        },
        'KBO System': {
            'file': 'kbo_data.db', 
            'description': 'KBO comprehensive system'
        },
        'KBO Complete': {
            'file': 'kbo_complete_data.db',
            'description': 'KBO full coverage (280 players)'
        },
        'International': {
            'file': 'international_baseball_comparison.db',
            'description': 'MLB vs KBO vs NPB comparison'
        },
        'NPB Data': {
            'file': 'data/npb.db',
            'description': 'NPB core database'
        },
        'NPB Enhanced': {
            'file': 'data/db_enhanced.db',
            'description': 'NPB enhanced features'
        },
        'NPB Current': {
            'file': 'data/db_current.db',
            'description': 'NPB current season'
        }
    }
    
    total_size = 0
    total_records = 0
    active_systems = 0
    
    for system_name, info in databases.items():
        db_file = info['file']
        description = info['description']
        
        if os.path.exists(db_file):
            file_size = os.path.getsize(db_file) / 1024  # KB
            
            try:
                with sqlite3.connect(db_file) as conn:
                    # テーブル数取得
                    tables = pd.read_sql_query(
                        "SELECT name FROM sqlite_master WHERE type='table'", 
                        conn
                    )['name'].tolist()
                    
                    # 総レコード数計算
                    total_db_records = 0
                    key_stats = []
                    
                    for table in tables:
                        if table != 'sqlite_sequence':
                            try:
                                count = pd.read_sql_query(f"SELECT COUNT(*) FROM {table}", conn).iloc[0, 0]
                                total_db_records += count
                            except:
                                pass
                    
                    # 特別統計
                    if 'mlb' in db_file.lower():
                        key_stats = get_mlb_stats(conn)
                    elif 'kbo' in db_file.lower():
                        key_stats = get_kbo_stats(conn)
                    elif 'international' in db_file.lower():
                        key_stats = get_international_stats(conn)
                    elif 'npb' in db_file.lower():
                        key_stats = get_npb_stats(conn)
                    
                    print(f"\n[{system_name}]")
                    print(f"  File: {db_file} ({file_size:.1f} KB)")
                    print(f"  Description: {description}")
                    print(f"  Tables: {len(tables)} | Records: {total_db_records:,}")
                    
                    if key_stats:
                        print(f"  Key stats: {' | '.join(key_stats)}")
                    
                    total_size += file_size
                    total_records += total_db_records
                    active_systems += 1
                    
            except Exception as e:
                print(f"\n[{system_name}] - ACCESS ERROR")
                print(f"  File: {db_file} ({file_size:.1f} KB)")
                print(f"  Error: {str(e)[:50]}...")
        else:
            print(f"\n[{system_name}] - NOT FOUND")
            print(f"  Expected: {db_file}")
    
    # 統合サマリー
    print(f"\n" + "=" * 70)
    print(f"INTEGRATION SUMMARY")
    print(f"Active systems: {active_systems}/7")
    print(f"Total database size: {total_size:.1f} KB ({total_size/1024:.2f} MB)")
    print(f"Total records: {total_records:,}")
    print(f"Coverage: MLB ({get_coverage_status('mlb_data.db')}), " +
          f"KBO ({get_coverage_status('kbo_data.db')}), " +
          f"NPB ({get_coverage_status('data/npb.db')})")
    print("=" * 70)

def get_mlb_stats(conn):
    """MLB統計取得"""
    try:
        stats = []
        
        # 選手数
        players = pd.read_sql_query("SELECT COUNT(*) FROM mlb_players_master", conn).iloc[0, 0]
        stats.append(f"{players} players")
        
        # チーム数
        teams = pd.read_sql_query("SELECT COUNT(*) FROM mlb_teams_master", conn).iloc[0, 0]
        stats.append(f"{teams} teams")
        
        # 高度指標
        try:
            advanced = pd.read_sql_query("SELECT COUNT(*) FROM mlb_advanced_metrics", conn).iloc[0, 0]
            stats.append(f"{advanced} advanced metrics")
        except:
            pass
        
        return stats
    except:
        return []

def get_kbo_stats(conn):
    """KBO統計取得"""
    try:
        stats = []
        
        # 選手数
        try:
            players = pd.read_sql_query("SELECT COUNT(*) FROM players_master", conn).iloc[0, 0]
            stats.append(f"{players} players")
        except:
            try:
                players = pd.read_sql_query("SELECT COUNT(*) FROM complete_players_roster", conn).iloc[0, 0]
                stats.append(f"{players} complete players")
            except:
                pass
        
        # 韓国語対応
        try:
            korean = pd.read_sql_query("SELECT COUNT(*) FROM players_master WHERE korean_name IS NOT NULL", conn).iloc[0, 0]
            stats.append(f"{korean} Korean names")
        except:
            pass
        
        # 高度指標
        try:
            advanced = pd.read_sql_query("SELECT COUNT(*) FROM advanced_metrics_offensive", conn).iloc[0, 0]
            stats.append(f"{advanced} advanced offensive")
        except:
            pass
        
        return stats
    except:
        return []

def get_international_stats(conn):
    """国際比較統計取得"""
    try:
        stats = []
        
        # 総選手数
        players = pd.read_sql_query("SELECT COUNT(*) FROM international_players", conn).iloc[0, 0]
        stats.append(f"{players} total players")
        
        # リーグ分布
        leagues = pd.read_sql_query("SELECT COUNT(DISTINCT league) FROM international_players", conn).iloc[0, 0]
        stats.append(f"{leagues} leagues")
        
        # 調整済み指標
        adjusted = pd.read_sql_query("SELECT COUNT(*) FROM adjusted_international_metrics", conn).iloc[0, 0]
        stats.append(f"{adjusted} adjusted metrics")
        
        return stats
    except:
        return []

def get_npb_stats(conn):
    """NPB統計取得"""
    try:
        stats = []
        
        # テーブル構造に基づく推定
        tables = pd.read_sql_query("SELECT name FROM sqlite_master WHERE type='table'", conn)['name'].tolist()
        
        if 'players' in tables:
            players = pd.read_sql_query("SELECT COUNT(*) FROM players", conn).iloc[0, 0]
            stats.append(f"{players} players")
        
        if 'games' in tables:
            games = pd.read_sql_query("SELECT COUNT(*) FROM games", conn).iloc[0, 0]
            stats.append(f"{games} games")
        
        if 'teams' in tables:
            teams = pd.read_sql_query("SELECT COUNT(*) FROM teams", conn).iloc[0, 0]
            stats.append(f"{teams} teams")
        
        return stats[:3]  # 最大3つまで
    except:
        return []

def get_coverage_status(db_file):
    """カバレッジ状況取得"""
    if os.path.exists(db_file):
        file_size = os.path.getsize(db_file) / 1024
        if file_size > 200:
            return "Complete"
        elif file_size > 50:
            return "Partial"
        else:
            return "Basic"
    else:
        return "Missing"

if __name__ == "__main__":
    get_database_summary()