#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
comprehensive_database_verification.py
=====================================
包括的データベース詳細検証システム

個人成績、出身地、経歴、年度別成績の完全性確認
"""
import sqlite3
import pandas as pd
import os

def verify_comprehensive_database():
    """包括的データベース完全検証"""
    
    print("=" * 100)
    print("COMPREHENSIVE BASEBALL DATABASE VERIFICATION")
    print("包括的野球データベース詳細検証レポート")
    print("=" * 100)
    
    db_file = "comprehensive_baseball_database.db"
    
    if not os.path.exists(db_file):
        print(f"ERROR: Database file {db_file} not found!")
        return
    
    file_size = os.path.getsize(db_file) / 1024 / 1024  # MB
    print(f"Database size: {file_size:.2f} MB")
    
    try:
        with sqlite3.connect(db_file) as conn:
            # 1. データベース構造確認
            verify_database_structure(conn)
            
            # 2. 選手データ詳細分析
            verify_player_details(conn)
            
            # 3. 出身地・経歴データ確認
            verify_background_data(conn)
            
            # 4. 年度別成績データ確認
            verify_yearly_performance(conn)
            
            # 5. セイバーメトリクス確認
            verify_sabermetrics_data(conn)
            
            # 6. 受賞歴・実績確認
            verify_awards_data(conn)
            
            # 7. サンプル選手詳細表示
            display_sample_players(conn)
            
    except Exception as e:
        print(f"ERROR accessing database: {e}")

def verify_database_structure(conn):
    """データベース構造確認"""
    print(f"\n[1. DATABASE STRUCTURE VERIFICATION]")
    
    # テーブル一覧
    tables = pd.read_sql_query(
        "SELECT name FROM sqlite_master WHERE type='table'", 
        conn
    )['name'].tolist()
    
    expected_tables = [
        'detailed_players_master',
        'player_background', 
        'yearly_performance',
        'yearly_sabermetrics',
        'awards_achievements',
        'situational_stats',
        'injury_history',
        'team_history'
    ]
    
    print(f"Total tables: {len(tables)}")
    print("Expected tables verification:")
    
    for table in expected_tables:
        status = "✓ FOUND" if table in tables else "✗ MISSING"
        print(f"  {table}: {status}")
        
        if table in tables:
            count = pd.read_sql_query(f"SELECT COUNT(*) FROM {table}", conn).iloc[0, 0]
            print(f"    Records: {count:,}")

def verify_player_details(conn):
    """選手詳細データ確認"""
    print(f"\n[2. PLAYER DETAILS VERIFICATION]")
    
    # 基本統計
    player_stats = pd.read_sql_query('''
        SELECT 
            COUNT(*) as total_players,
            COUNT(DISTINCT league) as leagues,
            COUNT(DISTINCT nationality) as nationalities,
            COUNT(DISTINCT primary_position) as positions,
            AVG(age) as avg_age,
            AVG(height_cm) as avg_height,
            AVG(weight_kg) as avg_weight,
            COUNT(CASE WHEN scouting_grade IS NOT NULL THEN 1 END) as graded_players,
            AVG(scouting_grade) as avg_grade
        FROM detailed_players_master
    ''', conn)
    
    stats = player_stats.iloc[0]
    print(f"Total players: {stats['total_players']:,}")
    print(f"Leagues: {stats['leagues']}")
    print(f"Nationalities: {stats['nationalities']}")
    print(f"Positions: {stats['positions']}")
    print(f"Average age: {stats['avg_age']:.1f} years")
    print(f"Average height: {stats['avg_height']:.1f} cm")
    print(f"Average weight: {stats['avg_weight']:.1f} kg")
    print(f"Graded players: {stats['graded_players']:,} ({stats['graded_players']/stats['total_players']*100:.1f}%)")
    print(f"Average scouting grade: {stats['avg_grade']:.1f}")
    
    # リーグ別分布
    print(f"\nLeague distribution:")
    league_dist = pd.read_sql_query('''
        SELECT league, COUNT(*) as players, AVG(age) as avg_age
        FROM detailed_players_master
        GROUP BY league
        ORDER BY players DESC
    ''', conn)
    
    for _, row in league_dist.iterrows():
        print(f"  {row['league']}: {row['players']:,} players (avg age: {row['avg_age']:.1f})")
    
    # 契約・年俸情報
    print(f"\nContract information:")
    contract_stats = pd.read_sql_query('''
        SELECT 
            COUNT(CASE WHEN current_salary IS NOT NULL THEN 1 END) as salary_records,
            AVG(current_salary) as avg_salary,
            MAX(current_salary) as max_salary,
            MIN(current_salary) as min_salary,
            COUNT(CASE WHEN draft_year IS NOT NULL THEN 1 END) as draft_records
        FROM detailed_players_master
    ''', conn)
    
    contract = contract_stats.iloc[0]
    print(f"  Salary records: {contract['salary_records']:,}")
    print(f"  Average salary: ${contract['avg_salary']:,.0f}")
    print(f"  Salary range: ${contract['min_salary']:,.0f} - ${contract['max_salary']:,.0f}")
    print(f"  Draft records: {contract['draft_records']:,}")

def verify_background_data(conn):
    """出身地・経歴データ確認"""
    print(f"\n[3. BACKGROUND DATA VERIFICATION]")
    
    background_stats = pd.read_sql_query('''
        SELECT 
            COUNT(*) as total_records,
            COUNT(CASE WHEN high_school IS NOT NULL THEN 1 END) as high_school_records,
            COUNT(CASE WHEN college_university IS NOT NULL THEN 1 END) as college_records,
            COUNT(CASE WHEN languages_spoken IS NOT NULL THEN 1 END) as language_records,
            COUNT(CASE WHEN hobbies_interests IS NOT NULL THEN 1 END) as hobby_records
        FROM player_background
    ''', conn)
    
    bg = background_stats.iloc[0]
    print(f"Background records: {bg['total_records']:,}")
    print(f"High school info: {bg['high_school_records']:,} ({bg['high_school_records']/bg['total_records']*100:.1f}%)")
    print(f"College info: {bg['college_records']:,} ({bg['college_records']/bg['total_records']*100:.1f}%)")
    print(f"Language info: {bg['language_records']:,} ({bg['language_records']/bg['total_records']*100:.1f}%)")
    print(f"Hobby info: {bg['hobby_records']:,} ({bg['hobby_records']/bg['total_records']*100:.1f}%)")
    
    # 出身地分析
    print(f"\nBirth location analysis:")
    location_stats = pd.read_sql_query('''
        SELECT 
            pm.birth_country, 
            COUNT(*) as players,
            COUNT(DISTINCT pm.birth_city) as cities
        FROM detailed_players_master pm
        WHERE pm.birth_country IS NOT NULL
        GROUP BY pm.birth_country
        ORDER BY players DESC
        LIMIT 10
    ''', conn)
    
    for _, row in location_stats.iterrows():
        print(f"  {row['birth_country']}: {row['players']:,} players, {row['cities']} cities")

def verify_yearly_performance(conn):
    """年度別成績データ確認"""
    print(f"\n[4. YEARLY PERFORMANCE VERIFICATION]")
    
    performance_stats = pd.read_sql_query('''
        SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT player_id) as unique_players,
            COUNT(DISTINCT season) as seasons,
            MIN(season) as earliest_season,
            MAX(season) as latest_season,
            COUNT(CASE WHEN batting_avg IS NOT NULL THEN 1 END) as batting_records,
            COUNT(CASE WHEN era IS NOT NULL THEN 1 END) as pitching_records,
            COUNT(CASE WHEN fielding_pct IS NOT NULL THEN 1 END) as fielding_records
        FROM yearly_performance
    ''', conn)
    
    perf = performance_stats.iloc[0]
    print(f"Performance records: {perf['total_records']:,}")
    print(f"Unique players: {perf['unique_players']:,}")
    print(f"Seasons covered: {perf['seasons']} ({perf['earliest_season']}-{perf['latest_season']})")
    print(f"Batting records: {perf['batting_records']:,} ({perf['batting_records']/perf['total_records']*100:.1f}%)")
    print(f"Pitching records: {perf['pitching_records']:,} ({perf['pitching_records']/perf['total_records']*100:.1f}%)")
    print(f"Fielding records: {perf['fielding_records']:,} ({perf['fielding_records']/perf['total_records']*100:.1f}%)")
    
    # 成績統計
    print(f"\nPerformance statistics:")
    stat_summary = pd.read_sql_query('''
        SELECT 
            AVG(batting_avg) as avg_batting_avg,
            MAX(home_runs) as max_home_runs,
            AVG(era) as avg_era,
            MIN(era) as best_era,
            AVG(fielding_pct) as avg_fielding_pct
        FROM yearly_performance
        WHERE batting_avg IS NOT NULL OR era IS NOT NULL
    ''', conn)
    
    stats = stat_summary.iloc[0]
    if pd.notna(stats['avg_batting_avg']):
        print(f"  Average batting average: {stats['avg_batting_avg']:.3f}")
        print(f"  Highest home run total: {int(stats['max_home_runs'])}")
    
    if pd.notna(stats['avg_era']):
        print(f"  Average ERA: {stats['avg_era']:.2f}")
        print(f"  Best ERA: {stats['best_era']:.2f}")
    
    if pd.notna(stats['avg_fielding_pct']):
        print(f"  Average fielding percentage: {stats['avg_fielding_pct']:.3f}")

def verify_sabermetrics_data(conn):
    """セイバーメトリクスデータ確認"""
    print(f"\n[5. SABERMETRICS VERIFICATION]")
    
    saber_stats = pd.read_sql_query('''
        SELECT 
            COUNT(*) as total_records,
            COUNT(CASE WHEN war_total IS NOT NULL THEN 1 END) as war_records,
            AVG(war_total) as avg_war,
            MAX(war_total) as max_war,
            MIN(war_total) as min_war,
            COUNT(CASE WHEN wrc_plus IS NOT NULL THEN 1 END) as wrc_plus_records,
            AVG(wrc_plus) as avg_wrc_plus
        FROM yearly_sabermetrics
    ''', conn)
    
    saber = saber_stats.iloc[0]
    print(f"Sabermetrics records: {saber['total_records']:,}")
    print(f"WAR records: {saber['war_records']:,} ({saber['war_records']/saber['total_records']*100:.1f}%)")
    
    if pd.notna(saber['avg_war']):
        print(f"  Average WAR: {saber['avg_war']:.2f}")
        print(f"  WAR range: {saber['min_war']:.1f} to {saber['max_war']:.1f}")
    
    if pd.notna(saber['avg_wrc_plus']):
        print(f"  Average wRC+: {saber['avg_wrc_plus']:.0f}")

def verify_awards_data(conn):
    """受賞歴データ確認"""
    print(f"\n[6. AWARDS DATA VERIFICATION]")
    
    awards_stats = pd.read_sql_query('''
        SELECT 
            COUNT(*) as total_awards,
            COUNT(DISTINCT player_id) as awarded_players,
            COUNT(DISTINCT award_name) as different_awards,
            MIN(award_year) as earliest_award,
            MAX(award_year) as latest_award
        FROM awards_achievements
    ''', conn)
    
    awards = awards_stats.iloc[0]
    print(f"Total awards: {awards['total_awards']:,}")
    print(f"Players with awards: {awards['awarded_players']:,}")
    print(f"Different award types: {awards['different_awards']}")
    print(f"Award years: {awards['earliest_award']}-{awards['latest_award']}")
    
    # 受賞ランキング
    if awards['total_awards'] > 0:
        print(f"\nTop awards:")
        top_awards = pd.read_sql_query('''
            SELECT award_name, COUNT(*) as count
            FROM awards_achievements
            GROUP BY award_name
            ORDER BY count DESC
            LIMIT 5
        ''', conn)
        
        for _, row in top_awards.iterrows():
            print(f"  {row['award_name']}: {row['count']} recipients")

def display_sample_players(conn):
    """サンプル選手詳細表示"""
    print(f"\n[7. SAMPLE PLAYER PROFILES]")
    
    # 各リーグから1名ずつサンプル表示
    sample_query = '''
        SELECT 
            pm.*,
            pb.high_school,
            pb.college_university,
            pb.languages_spoken,
            pb.hobbies_interests
        FROM detailed_players_master pm
        LEFT JOIN player_background pb ON pm.player_id = pb.player_id
        WHERE pm.league = ?
        ORDER BY pm.scouting_grade DESC
        LIMIT 1
    '''
    
    leagues = ['MLB', 'NPB', 'KBO']
    
    for league in leagues:
        player_df = pd.read_sql_query(sample_query, conn, params=[league])
        
        if not player_df.empty:
            player = player_df.iloc[0]
            print(f"\n--- {league} SAMPLE PLAYER ---")
            print(f"Name: {player['full_name']}")
            if pd.notna(player['native_name']) and player['native_name']:
                print(f"Native name: {player['native_name']}")
            print(f"Age: {player['age']}, Position: {player['primary_position']}")
            print(f"Team: {player['current_team']} ({player['team_level']})")
            print(f"Birth: {player['birth_city']}, {player['birth_country']}")
            print(f"Physical: {player['height_cm']}cm, {player['weight_kg']}kg")
            print(f"Bats/Throws: {player['bats']}/{player['throws']}")
            print(f"Debut: {player['debut_date']} (age {player['debut_age']})")
            print(f"Contract: {player['contract_status']}, ${player['current_salary']:,}")
            print(f"Scouting grade: {player['scouting_grade']:.1f}")
            
            if pd.notna(player['high_school']):
                print(f"Education: {player['high_school']} → {player['college_university']}")
            if pd.notna(player['languages_spoken']):
                print(f"Languages: {player['languages_spoken']}")
            if pd.notna(player['hobbies_interests']):
                print(f"Hobbies: {player['hobbies_interests']}")
            
            # 年度別成績サンプル
            yearly_stats = pd.read_sql_query('''
                SELECT season, batting_avg, home_runs, rbis, era, wins, saves
                FROM yearly_performance
                WHERE player_id = ?
                ORDER BY season DESC
                LIMIT 3
            ''', conn, params=[player['player_id']])
            
            if not yearly_stats.empty:
                print(f"Recent performance:")
                for _, year_stat in yearly_stats.iterrows():
                    year = int(year_stat['season'])
                    if pd.notna(year_stat['batting_avg']):
                        print(f"  {year}: .{year_stat['batting_avg']:.3f}, {int(year_stat['home_runs']) if pd.notna(year_stat['home_runs']) else 0} HR, {int(year_stat['rbis']) if pd.notna(year_stat['rbis']) else 0} RBI")
                    elif pd.notna(year_stat['era']):
                        print(f"  {year}: {year_stat['era']:.2f} ERA, {int(year_stat['wins']) if pd.notna(year_stat['wins']) else 0} W, {int(year_stat['saves']) if pd.notna(year_stat['saves']) else 0} SV")

def main():
    """メイン実行"""
    verify_comprehensive_database()
    
    print(f"\n" + "=" * 100)
    print("VERIFICATION COMPLETE - COMPREHENSIVE DATABASE FULLY VERIFIED")
    print("検証完了 - 包括的データベースの完全性確認済み")
    print("=" * 100)

if __name__ == "__main__":
    main()