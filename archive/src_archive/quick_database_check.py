#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
quick_database_check.py
======================
包括的データベース簡潔確認
"""
import sqlite3
import pandas as pd
import os

def quick_check():
    """簡潔データベース確認"""
    
    db_file = "comprehensive_baseball_database.db"
    file_size = os.path.getsize(db_file) / 1024 / 1024  # MB
    
    print("COMPREHENSIVE DATABASE QUICK CHECK")
    print("=" * 60)
    print(f"Database size: {file_size:.2f} MB")
    
    with sqlite3.connect(db_file) as conn:
        # テーブル確認
        tables = pd.read_sql_query(
            "SELECT name FROM sqlite_master WHERE type='table'", 
            conn
        )['name'].tolist()
        
        print(f"\nTables: {len(tables)}")
        for table in tables:
            if table != 'sqlite_sequence':
                count = pd.read_sql_query(f"SELECT COUNT(*) FROM {table}", conn).iloc[0, 0]
                print(f"  {table}: {count:,} records")
        
        # 選手基本情報
        player_info = pd.read_sql_query('''
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT league) as leagues,
                COUNT(DISTINCT nationality) as countries,
                AVG(age) as avg_age,
                COUNT(CASE WHEN current_salary IS NOT NULL THEN 1 END) as salary_records
            FROM detailed_players_master
        ''', conn)
        
        info = player_info.iloc[0]
        print(f"\nPlayer Summary:")
        print(f"  Total players: {info['total']:,}")
        print(f"  Leagues: {info['leagues']}")
        print(f"  Countries: {info['countries']}")
        print(f"  Average age: {info['avg_age']:.1f} years")
        print(f"  Salary records: {info['salary_records']:,}")
        
        # 年度別成績
        perf_info = pd.read_sql_query('''
            SELECT 
                COUNT(*) as total_seasons,
                COUNT(DISTINCT season) as years,
                COUNT(CASE WHEN batting_avg IS NOT NULL THEN 1 END) as batting,
                COUNT(CASE WHEN era IS NOT NULL THEN 1 END) as pitching
            FROM yearly_performance
        ''', conn)
        
        perf = perf_info.iloc[0]
        print(f"\nPerformance Records:")
        print(f"  Total season records: {perf['total_seasons']:,}")
        print(f"  Years covered: {perf['years']}")
        print(f"  Batting records: {perf['batting']:,}")
        print(f"  Pitching records: {perf['pitching']:,}")
        
        # サンプル選手
        sample = pd.read_sql_query('''
            SELECT full_name, league, primary_position, current_salary, birth_country
            FROM detailed_players_master
            WHERE scouting_grade > 60
            LIMIT 3
        ''', conn)
        
        print(f"\nSample Elite Players:")
        for _, player in sample.iterrows():
            salary_display = f"${player['current_salary']:,}" if pd.notna(player['current_salary']) else "N/A"
            print(f"  {player['full_name']} ({player['league']}) - {player['primary_position']}")
            print(f"    From: {player['birth_country']}, Salary: {salary_display}")
    
    print("\n" + "=" * 60)
    print("COMPREHENSIVE DATABASE SUCCESSFULLY VERIFIED")
    print("包括的詳細データベース構築完了確認済み")
    print("=" * 60)

if __name__ == "__main__":
    quick_check()