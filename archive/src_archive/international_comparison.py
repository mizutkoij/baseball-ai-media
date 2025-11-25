#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
international_comparison.py
===========================
国際野球比較システム - MLB vs KBO vs NPB

三極野球リーグ統合分析プラットフォーム
調整済み指標・選手価値評価・システム分析
"""
import sqlite3
import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class InternationalBaseballComparison:
    """国際野球比較システム"""
    
    def __init__(self):
        # 国際比較用統合データベース
        self.comparison_db = "international_baseball_comparison.db"
        
        # リーグ調整係数（前回の分析結果）
        self.league_adjustments = {
            'MLB': {'base_factor': 1.000, 'war_adjustment': 1.000, 'era_adjustment': 1.000},
            'NPB': {'base_factor': 0.850, 'war_adjustment': 0.865, 'era_adjustment': 1.120},
            'KBO': {'base_factor': 0.780, 'war_adjustment': 0.795, 'era_adjustment': 1.180}
        }
        
        self._setup_comparison_database()
        logger.info("International Baseball Comparison System initialized")
    
    def _setup_comparison_database(self):
        """国際比較データベース初期化"""
        with sqlite3.connect(self.comparison_db) as conn:
            cursor = conn.cursor()
            
            # 統合選手マスター
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS international_players (
                    int_player_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    league TEXT NOT NULL,
                    original_player_id INTEGER,
                    full_name TEXT NOT NULL,
                    position TEXT,
                    team_name TEXT,
                    nationality TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 調整済み指標テーブル
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS adjusted_international_metrics (
                    adjustment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    int_player_id INTEGER,
                    league TEXT NOT NULL,
                    season INTEGER,
                    war_mlb_equivalent REAL,
                    wrc_plus_mlb_equivalent INTEGER,
                    era_mlb_equivalent REAL,
                    adjustment_confidence REAL,
                    FOREIGN KEY (int_player_id) REFERENCES international_players(int_player_id),
                    UNIQUE(int_player_id, season, league)
                )
            ''')
            
            conn.commit()
    
    def import_all_data(self, season: int = 2024) -> bool:
        """全リーグデータインポート"""
        logger.info(f"Importing all league data for {season}")
        
        mlb_success = self._import_mlb_simplified(season)
        kbo_success = self._import_kbo_simplified(season)
        npb_success = self._import_npb_simplified(season)
        
        return mlb_success and kbo_success and npb_success
    
    def _import_mlb_simplified(self, season: int) -> bool:
        """MLB簡易インポート"""
        try:
            with sqlite3.connect(self.comparison_db) as conn:
                cursor = conn.cursor()
                
                # MLB選手データ（デモ）
                mlb_players = [
                    (1, 'MLB', 1, 'Aaron Judge', 'OF', 'Yankees', 'USA'),
                    (2, 'MLB', 2, 'Mike Trout', 'OF', 'Angels', 'USA'),
                    (3, 'MLB', 3, 'Mookie Betts', 'OF', 'Dodgers', 'USA'),
                    (4, 'MLB', 4, 'Ronald Acuna Jr', 'OF', 'Braves', 'VEN'),
                    (5, 'MLB', 5, 'Juan Soto', 'OF', 'Padres', 'DOM'),
                    (6, 'MLB', 6, 'Shohei Ohtani', 'DH', 'Dodgers', 'JPN'),
                    (7, 'MLB', 7, 'Gerrit Cole', 'P', 'Yankees', 'USA'),
                    (8, 'MLB', 8, 'Jacob deGrom', 'P', 'Rangers', 'USA'),
                    (9, 'MLB', 9, 'Shane Bieber', 'P', 'Guardians', 'USA'),
                    (10, 'MLB', 10, 'Spencer Strider', 'P', 'Braves', 'USA')
                ]
                
                for player in mlb_players:
                    cursor.execute('''
                        INSERT OR REPLACE INTO international_players
                        (int_player_id, league, original_player_id, full_name, position, team_name, nationality)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', player)
                
                # MLB高度指標（デモ）
                mlb_metrics = [
                    (1, 'MLB', season, 8.2, 180, None, 0.95),  # Aaron Judge
                    (2, 'MLB', season, 7.8, 165, None, 0.95),  # Mike Trout
                    (3, 'MLB', season, 6.5, 140, None, 0.95),  # Mookie Betts
                    (4, 'MLB', season, 6.1, 155, None, 0.95),  # Acuna Jr
                    (5, 'MLB', season, 5.9, 160, None, 0.95),  # Soto
                    (6, 'MLB', season, 9.6, 185, 2.45, 0.95),  # Ohtani
                    (7, 'MLB', season, 6.8, None, 2.78, 0.95),  # Cole
                    (8, 'MLB', season, 5.2, None, 2.15, 0.95),  # deGrom
                    (9, 'MLB', season, 4.9, None, 2.88, 0.95),  # Bieber
                    (10, 'MLB', season, 4.1, None, 3.02, 0.95)  # Strider
                ]
                
                for metric in mlb_metrics:
                    cursor.execute('''
                        INSERT OR REPLACE INTO adjusted_international_metrics
                        (int_player_id, league, season, war_mlb_equivalent, wrc_plus_mlb_equivalent, era_mlb_equivalent, adjustment_confidence)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', metric)
                
                conn.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error importing MLB data: {e}")
            return False
    
    def _import_kbo_simplified(self, season: int) -> bool:
        """KBO簡易インポート"""
        try:
            with sqlite3.connect(self.comparison_db) as conn:
                cursor = conn.cursor()
                
                # KBO選手データ（デモ）
                kbo_players = [
                    (11, 'KBO', 1, 'Choi Jeong', '3B', 'SK Wyverns', 'KOR'),
                    (12, 'KBO', 2, 'Yang Eui-ji', 'C', 'NC Dinos', 'KOR'),
                    (13, 'KBO', 3, 'Na Sung-bum', 'OF', 'KIA Tigers', 'KOR'),
                    (14, 'KBO', 4, 'Kim Ha-seong', 'SS', 'Kiwoom Heroes', 'KOR'),
                    (15, 'KBO', 5, 'Park Byung-ho', '1B', 'KT Wiz', 'KOR'),
                    (16, 'KBO', 6, 'Carlos Martinez', 'OF', 'Lotte Giants', 'DOM'),
                    (17, 'KBO', 7, 'David Buchanan', 'P', 'Doosan Bears', 'USA'),
                    (18, 'KBO', 8, 'Yang Hyeon-jong', 'P', 'KIA Tigers', 'KOR'),
                    (19, 'KBO', 9, 'Won Tae-in', 'P', 'Samsung Lions', 'KOR'),
                    (20, 'KBO', 10, 'Lim Chan-kyu', 'P', 'LG Twins', 'KOR')
                ]
                
                for player in kbo_players:
                    cursor.execute('''
                        INSERT OR REPLACE INTO international_players
                        (int_player_id, league, original_player_id, full_name, position, team_name, nationality)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', player)
                
                # KBO調整済み指標（KBO → MLB等価変換）
                kbo_raw_wars = [4.2, 3.8, 3.5, 3.1, 2.9, 4.5, 3.2, 2.8, 2.5, 2.1]
                kbo_metrics = []
                
                for i, war in enumerate(kbo_raw_wars):
                    # KBO → MLB等価変換
                    war_mlb_equiv = war / self.league_adjustments['KBO']['war_adjustment']
                    
                    wrc_plus = None
                    era_mlb_equiv = None
                    
                    if i < 6:  # 野手
                        wrc_plus_raw = np.random.randint(110, 140)
                        wrc_plus = int(100 + (wrc_plus_raw - 100) / self.league_adjustments['KBO']['base_factor'])
                    else:  # 投手
                        era_raw = np.random.uniform(3.2, 4.1)
                        era_mlb_equiv = era_raw / self.league_adjustments['KBO']['era_adjustment']
                    
                    kbo_metrics.append((
                        11 + i, 'KBO', season, round(war_mlb_equiv, 1),
                        wrc_plus, round(era_mlb_equiv, 2) if era_mlb_equiv else None,
                        0.78  # KBO信頼度
                    ))
                
                for metric in kbo_metrics:
                    cursor.execute('''
                        INSERT OR REPLACE INTO adjusted_international_metrics
                        (int_player_id, league, season, war_mlb_equivalent, wrc_plus_mlb_equivalent, era_mlb_equivalent, adjustment_confidence)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', metric)
                
                conn.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error importing KBO data: {e}")
            return False
    
    def _import_npb_simplified(self, season: int) -> bool:
        """NPB簡易インポート"""
        try:
            with sqlite3.connect(self.comparison_db) as conn:
                cursor = conn.cursor()
                
                # NPB選手データ（デモ）
                npb_players = [
                    (21, 'NPB', 1, '山田哲人', '2B', 'Swallows', 'JPN'),
                    (22, 'NPB', 2, '村上宗隆', '1B', 'Swallows', 'JPN'),
                    (23, 'NPB', 3, '佐藤輝明', 'OF', 'Tigers', 'JPN'),
                    (24, 'NPB', 4, '近本光司', 'OF', 'Tigers', 'JPN'),
                    (25, 'NPB', 5, '坂本勇人', 'SS', 'Giants', 'JPN'),
                    (26, 'NPB', 6, 'Adam Walker', 'OF', 'Eagles', 'USA'),
                    (27, 'NPB', 7, '山本由伸', 'P', 'Buffaloes', 'JPN'),
                    (28, 'NPB', 8, '今永昇太', 'P', 'BayStars', 'JPN'),
                    (29, 'NPB', 9, '菅野智之', 'P', 'Giants', 'JPN'),
                    (30, 'NPB', 10, '千賀滉大', 'P', 'Hawks', 'JPN')
                ]
                
                for player in npb_players:
                    cursor.execute('''
                        INSERT OR REPLACE INTO international_players
                        (int_player_id, league, original_player_id, full_name, position, team_name, nationality)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', player)
                
                # NPB調整済み指標（NPB → MLB等価変換）
                npb_raw_wars = [3.8, 3.5, 3.2, 2.9, 2.7, 3.1, 3.5, 3.2, 2.8, 2.6]
                npb_metrics = []
                
                for i, war in enumerate(npb_raw_wars):
                    # NPB → MLB等価変換
                    war_mlb_equiv = war / self.league_adjustments['NPB']['war_adjustment']
                    
                    wrc_plus = None
                    era_mlb_equiv = None
                    
                    if i < 6:  # 野手
                        wrc_plus_raw = np.random.randint(105, 135)
                        wrc_plus = int(100 + (wrc_plus_raw - 100) / self.league_adjustments['NPB']['base_factor'])
                    else:  # 投手
                        era_raw = np.random.uniform(2.8, 3.8)
                        era_mlb_equiv = era_raw / self.league_adjustments['NPB']['era_adjustment']
                    
                    npb_metrics.append((
                        21 + i, 'NPB', season, round(war_mlb_equiv, 1),
                        wrc_plus, round(era_mlb_equiv, 2) if era_mlb_equiv else None,
                        0.85  # NPB信頼度
                    ))
                
                for metric in npb_metrics:
                    cursor.execute('''
                        INSERT OR REPLACE INTO adjusted_international_metrics
                        (int_player_id, league, season, war_mlb_equivalent, wrc_plus_mlb_equivalent, era_mlb_equivalent, adjustment_confidence)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', metric)
                
                conn.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error importing NPB data: {e}")
            return False
    
    def generate_international_rankings(self, season: int = 2024) -> Dict[str, Any]:
        """国際ランキング生成"""
        with sqlite3.connect(self.comparison_db) as conn:
            # 総合ランキング
            overall_ranking = pd.read_sql_query('''
                SELECT 
                    p.full_name, p.league, p.position, p.nationality,
                    a.war_mlb_equivalent, a.adjustment_confidence
                FROM international_players p
                JOIN adjusted_international_metrics a ON p.int_player_id = a.int_player_id
                WHERE a.season = ?
                ORDER BY a.war_mlb_equivalent DESC
            ''', conn, params=[season])
            
            # 野手ランキング
            batting_ranking = pd.read_sql_query('''
                SELECT 
                    p.full_name, p.league, p.nationality,
                    a.war_mlb_equivalent, a.wrc_plus_mlb_equivalent
                FROM international_players p
                JOIN adjusted_international_metrics a ON p.int_player_id = a.int_player_id
                WHERE a.season = ? AND p.position != 'P'
                ORDER BY a.war_mlb_equivalent DESC
            ''', conn, params=[season])
            
            # 投手ランキング
            pitching_ranking = pd.read_sql_query('''
                SELECT 
                    p.full_name, p.league, p.nationality,
                    a.war_mlb_equivalent, a.era_mlb_equivalent
                FROM international_players p
                JOIN adjusted_international_metrics a ON p.int_player_id = a.int_player_id
                WHERE a.season = ? AND p.position = 'P'
                ORDER BY a.war_mlb_equivalent DESC
            ''', conn, params=[season])
            
            # リーグ統計
            league_stats = pd.read_sql_query('''
                SELECT 
                    p.league,
                    COUNT(*) as total_players,
                    AVG(a.war_mlb_equivalent) as avg_war_mlb_equiv,
                    MAX(a.war_mlb_equivalent) as max_war_mlb_equiv,
                    AVG(a.adjustment_confidence) as avg_confidence
                FROM international_players p
                JOIN adjusted_international_metrics a ON p.int_player_id = a.int_player_id
                WHERE a.season = ?
                GROUP BY p.league
                ORDER BY avg_war_mlb_equiv DESC
            ''', conn, params=[season])
            
            return {
                'overall_ranking': overall_ranking,
                'batting_ranking': batting_ranking,
                'pitching_ranking': pitching_ranking,
                'league_statistics': league_stats
            }

def main():
    """メイン実行関数"""
    print("=" * 70)
    print("International Baseball Comparison System")
    print("MLB vs KBO vs NPB - Comprehensive Analysis Platform")
    print("=" * 70)
    
    # 国際比較システム初期化
    comparison_system = InternationalBaseballComparison()
    
    print("\n[INTERNATIONAL SYSTEM] Starting three-league data integration...")
    
    # データインポート
    print("\n1. Importing and integrating league data...")
    import_success = comparison_system.import_all_data(2024)
    print(f"   Data integration: {'Success' if import_success else 'Failed'}")
    
    # 国際ランキング生成
    print("\n2. Generating international rankings...")
    rankings = comparison_system.generate_international_rankings(2024)
    
    # 結果表示
    with sqlite3.connect("international_baseball_comparison.db") as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM international_players")
        total_players = cursor.fetchone()[0]
        
        cursor.execute("SELECT league, COUNT(*) FROM international_players GROUP BY league")
        league_counts = cursor.fetchall()
        
        cursor.execute("SELECT COUNT(*) FROM adjusted_international_metrics")
        adjusted_metrics = cursor.fetchone()[0]
    
    print(f"\n[DATABASE] International Comparison Database:")
    print(f"  Total players: {total_players}")
    for league, count in league_counts:
        print(f"  {league} players: {count}")
    print(f"  Adjusted metrics: {adjusted_metrics}")
    
    # 国際ランキング表示
    print(f"\n[WORLD RANKINGS] Top 10 Players (MLB-Equivalent WAR):")
    for i, (_, player) in enumerate(rankings['overall_ranking'].head(10).iterrows(), 1):
        conf_indicator = f"({player['adjustment_confidence']:.2f})" if player['league'] != 'MLB' else ""
        print(f"  {i:2d}. {player['full_name']} ({player['league']}) - {player['war_mlb_equivalent']:.1f} WAR {conf_indicator}")
    
    print(f"\n[BATTING LEADERS] Top 5 Hitters (MLB-Equivalent):")
    for i, (_, hitter) in enumerate(rankings['batting_ranking'].head(5).iterrows(), 1):
        wrc_str = f", wRC+: {int(hitter['wrc_plus_mlb_equivalent'])}" if pd.notna(hitter['wrc_plus_mlb_equivalent']) else ""
        print(f"  {i}. {hitter['full_name']} ({hitter['league']}) - {hitter['war_mlb_equivalent']:.1f} WAR{wrc_str}")
    
    print(f"\n[PITCHING LEADERS] Top 5 Pitchers (MLB-Equivalent):")
    for i, (_, pitcher) in enumerate(rankings['pitching_ranking'].head(5).iterrows(), 1):
        era_str = f", ERA: {pitcher['era_mlb_equivalent']:.2f}" if pd.notna(pitcher['era_mlb_equivalent']) else ""
        print(f"  {i}. {pitcher['full_name']} ({pitcher['league']}) - {pitcher['war_mlb_equivalent']:.1f} WAR{era_str}")
    
    print(f"\n[LEAGUE ANALYSIS] Comparative Strength:")
    for _, league in rankings['league_statistics'].iterrows():
        print(f"  {league['league']}: avg WAR {league['avg_war_mlb_equiv']:.2f} (confidence: {league['avg_confidence']:.2f})")
    
    print(f"\n[SUCCESS] International Baseball Comparison System Complete!")
    print(f"[ACHIEVEMENT] Three-league integration with adjusted metrics")
    print(f"[CAPABILITY] Cross-league player value analysis ready")
    print("=" * 70)

if __name__ == "__main__":
    main()