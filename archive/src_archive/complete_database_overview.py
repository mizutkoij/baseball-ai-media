#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
complete_database_overview.py
=============================
完全データベース概要システム

全野球データベースの詳細状況・統計・カバレッジ分析
"""
import sqlite3
import pandas as pd
import os
from pathlib import Path

def get_all_database_files():
    """全データベースファイル検索"""
    db_files = []
    
    # メインディレクトリ
    for file in Path('.').glob('*.db'):
        db_files.append(('Main', str(file)))
    
    # dataディレクトリ
    data_dir = Path('./data')
    if data_dir.exists():
        for file in data_dir.glob('*.db'):
            db_files.append(('Data', str(file)))
    
    return db_files

def analyze_database(db_path, category):
    """個別データベース分析"""
    file_size = os.path.getsize(db_path) / 1024  # KB
    
    try:
        with sqlite3.connect(db_path) as conn:
            # テーブル一覧
            tables = pd.read_sql_query(
                "SELECT name FROM sqlite_master WHERE type='table'", 
                conn
            )['name'].tolist()
            
            if not tables:
                return {
                    'file_size': file_size,
                    'tables': 0,
                    'total_records': 0,
                    'table_details': {},
                    'analysis': 'Empty database'
                }
            
            # 各テーブルのレコード数
            table_details = {}
            total_records = 0
            
            for table in tables:
                if table != 'sqlite_sequence':
                    try:
                        count = pd.read_sql_query(f"SELECT COUNT(*) FROM {table}", conn).iloc[0, 0]
                        table_details[table] = count
                        total_records += count
                    except Exception as e:
                        table_details[table] = f"Error: {str(e)[:50]}"
            
            # 特別分析
            analysis = perform_special_analysis(conn, db_path, table_details)
            
            return {
                'file_size': file_size,
                'tables': len(tables),
                'total_records': total_records,
                'table_details': table_details,
                'analysis': analysis
            }
            
    except Exception as e:
        return {
            'file_size': file_size,
            'tables': 0,
            'total_records': 0,
            'table_details': {},
            'analysis': f'Access Error: {str(e)[:100]}'
        }

def perform_special_analysis(conn, db_path, table_details):
    """特別分析実行"""
    db_name = os.path.basename(db_path).lower()
    
    try:
        if 'mlb' in db_name:
            return analyze_mlb_specific(conn, table_details)
        elif 'kbo' in db_name:
            return analyze_kbo_specific(conn, table_details)
        elif 'npb' in db_name or 'baseball' in db_name:
            return analyze_npb_specific(conn, table_details)
        elif 'international' in db_name:
            return analyze_international_specific(conn, table_details)
        else:
            return analyze_general(table_details)
    except Exception as e:
        return f"Analysis error: {str(e)[:100]}"

def analyze_mlb_specific(conn, table_details):
    """MLB特化分析"""
    try:
        analysis = ["MLB Database Analysis:"]
        
        if 'mlb_players_master' in table_details:
            players = table_details['mlb_players_master']
            analysis.append(f"• {players} MLB players")
        
        if 'mlb_teams_master' in table_details:
            teams = table_details['mlb_teams_master']
            analysis.append(f"• {teams} MLB teams")
        
        if 'mlb_advanced_metrics' in table_details:
            advanced = table_details['mlb_advanced_metrics']
            analysis.append(f"• {advanced} advanced metrics")
            
            # WAR統計
            war_stats = pd.read_sql_query("""
                SELECT 
                    COUNT(*) as total,
                    AVG(war) as avg_war,
                    MAX(war) as max_war,
                    MIN(war) as min_war
                FROM mlb_advanced_metrics 
                WHERE war IS NOT NULL
            """, conn)
            
            if not war_stats.empty:
                row = war_stats.iloc[0]
                analysis.append(f"• WAR stats: {row['total']} players, avg {row['avg_war']:.2f}")
        
        return " | ".join(analysis)
        
    except Exception as e:
        return f"MLB analysis error: {str(e)[:50]}"

def analyze_kbo_specific(conn, table_details):
    """KBO特化分析"""
    try:
        analysis = ["KBO Database Analysis:"]
        
        if 'players_master' in table_details:
            players = table_details['players_master']
            analysis.append(f"• {players} KBO players")
        
        if 'team_standings' in table_details:
            teams = table_details['team_standings']
            analysis.append(f"• {teams} team standings")
        
        # 高度指標テーブル確認
        advanced_tables = ['advanced_metrics_offensive', 'advanced_metrics_pitching', 'advanced_metrics_defensive']
        advanced_counts = []
        
        for table in advanced_tables:
            if table in table_details:
                count = table_details[table]
                metric_type = table.replace('advanced_metrics_', '')
                advanced_counts.append(f"{count} {metric_type}")
        
        if advanced_counts:
            analysis.append(f"• Advanced: {', '.join(advanced_counts)}")
        
        # 韓国語対応確認
        if 'players_master' in table_details:
            korean_check = pd.read_sql_query("""
                SELECT COUNT(*) as korean_players
                FROM players_master 
                WHERE korean_name IS NOT NULL
            """, conn)
            
            if not korean_check.empty:
                korean_count = korean_check.iloc[0, 0]
                analysis.append(f"• Korean names: {korean_count}")
        
        return " | ".join(analysis)
        
    except Exception as e:
        return f"KBO analysis error: {str(e)[:50]}"

def analyze_npb_specific(conn, table_details):
    """NPB特化分析"""
    try:
        analysis = ["NPB Database Analysis:"]
        
        # よくあるNPBテーブル名
        common_npb_tables = ['players', 'games', 'teams', 'batting_stats', 'pitching_stats']
        
        for table in common_npb_tables:
            if table in table_details:
                count = table_details[table]
                analysis.append(f"• {table}: {count}")
        
        # 日本語データ確認
        for table in ['players', 'teams']:
            if table in table_details:
                try:
                    sample = pd.read_sql_query(f"SELECT * FROM {table} LIMIT 1", conn)
                    if not sample.empty:
                        analysis.append(f"• {table} structure detected")
                except:
                    pass
        
        return " | ".join(analysis)
        
    except Exception as e:
        return f"NPB analysis error: {str(e)[:50]}"

def analyze_international_specific(conn, table_details):
    """国際比較特化分析"""
    try:
        analysis = ["International Comparison Analysis:"]
        
        if 'international_players' in table_details:
            players = table_details['international_players']
            analysis.append(f"• {players} international players")
            
            # リーグ分布
            league_dist = pd.read_sql_query("""
                SELECT league, COUNT(*) as count
                FROM international_players
                GROUP BY league
                ORDER BY count DESC
            """, conn)
            
            if not league_dist.empty:
                dist_str = ', '.join([f"{row['league']}:{row['count']}" for _, row in league_dist.iterrows()])
                analysis.append(f"• League distribution: {dist_str}")
        
        if 'adjusted_international_metrics' in table_details:
            metrics = table_details['adjusted_international_metrics']
            analysis.append(f"• {metrics} adjusted metrics")
        
        return " | ".join(analysis)
        
    except Exception as e:
        return f"International analysis error: {str(e)[:50]}"

def analyze_general(table_details):
    """汎用分析"""
    if not table_details:
        return "Empty database"
    
    # 最大レコード数のテーブル
    max_table = max(
        [(k, v) for k, v in table_details.items() if isinstance(v, int)],
        key=lambda x: x[1],
        default=('N/A', 0)
    )
    
    return f"Largest table: {max_table[0]} ({max_table[1]:,} records)"

def main():
    """メイン実行"""
    print("=" * 90)
    print("COMPLETE BASEBALL DATABASE OVERVIEW")
    print("完全野球データベース概要レポート")
    print("=" * 90)
    
    # 全データベースファイル取得
    db_files = get_all_database_files()
    
    if not db_files:
        print("No database files found!")
        return
    
    total_size = 0
    total_records = 0
    
    # カテゴリ別集計
    categories = {}
    
    for category, db_path in db_files:
        if category not in categories:
            categories[category] = []
        
        print(f"\n[{category}] {os.path.basename(db_path)}")
        
        analysis_result = analyze_database(db_path, category)
        
        file_size = analysis_result['file_size']
        tables = analysis_result['tables']
        records = analysis_result['total_records']
        analysis = analysis_result['analysis']
        
        print(f"   Size: {file_size:.1f} KB | Tables: {tables} | Records: {records:,}")
        print(f"   Analysis: {analysis}")
        
        # 主要テーブル表示（レコード数上位3つ）
        table_details = analysis_result['table_details']
        if table_details:
            sorted_tables = sorted(
                [(k, v) for k, v in table_details.items() if isinstance(v, int)],
                key=lambda x: x[1],
                reverse=True
            )[:3]
            
            if sorted_tables:
                table_info = ', '.join([f"{name}:{count}" for name, count in sorted_tables])
                print(f"   Top tables: {table_info}")
        
        total_size += file_size
        total_records += records
        categories[category].append({
            'name': os.path.basename(db_path),
            'size': file_size,
            'records': records
        })
    
    # サマリー
    print(f"\n" + "=" * 90)
    print(f"SUMMARY")
    print(f"Total databases: {len(db_files)}")
    print(f"Total size: {total_size:.1f} KB ({total_size/1024:.1f} MB)")
    print(f"Total records: {total_records:,}")
    
    # カテゴリ別サマリー
    print(f"\nCATEGORY BREAKDOWN:")
    for category, dbs in categories.items():
        cat_size = sum(db['size'] for db in dbs)
        cat_records = sum(db['records'] for db in dbs)
        print(f"  {category}: {len(dbs)} databases, {cat_size:.1f} KB, {cat_records:,} records")
    
    print("=" * 90)

if __name__ == "__main__":
    main()