#!/usr/bin/env python3
"""
scripts/mlb_data_integration.py - MLB pybaseball統合システム

将来のMLB拡張に向けたpybaseballベースのデータ取得・処理システム
"""

import sys
import os
import json
import pandas as pd
import mysql.connector
from datetime import datetime, date, timedelta
from pathlib import Path
import logging
from typing import Dict, List, Optional
import hashlib

# 将来的にインストールする予定のライブラリ
# pip install pybaseball
try:
    from pybaseball import (
        playerid_lookup, 
        statcast_batter, 
        statcast_pitcher,
        batting_stats,
        pitching_stats,
        team_batting,
        team_pitching
    )
    PYBASEBALL_AVAILABLE = True
except ImportError:
    print("pybaseball not installed. This module will work with mock data.")
    PYBASEBALL_AVAILABLE = False

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/www/baseball-ai/logs/mlb_integration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MLBDataIntegration:
    """MLB pybaseball統合クラス"""
    
    def __init__(self, config_file: str = '/var/www/baseball-ai/config/wordpress.json'):
        self.config = self.load_config(config_file)
        self.mysql_config = self.config['mysql']
        
        # データディレクトリ
        self.data_dir = Path('/var/www/baseball-ai/data/mlb')
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info("MLB Data Integration initialized")
    
    def load_config(self, config_file: str) -> Dict:
        """設定ファイル読み込み"""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                "mysql": {
                    "host": "localhost",
                    "user": "baseball_user", 
                    "password": "secure_password",
                    "database": "baseball_data"
                }
            }
    
    def connect_mysql(self):
        """MySQL接続"""
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            return connection
        except mysql.connector.Error as e:
            logger.error(f"MySQL connection error: {e}")
            return None
    
    def setup_mlb_tables(self):
        """MLBデータ用テーブル作成"""
        connection = self.connect_mysql()
        if not connection:
            return False
        
        cursor = connection.cursor()
        
        # MLB選手IDマスタテーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mlb_players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                mlbam_id INT UNIQUE,
                bbref_id VARCHAR(20),
                fangraphs_id INT,
                first_name VARCHAR(50),
                last_name VARCHAR(50),
                full_name VARCHAR(100),
                birth_date DATE,
                debut_date DATE,
                final_game DATE,
                position VARCHAR(20),
                bats VARCHAR(1),
                throws VARCHAR(1),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_mlbam (mlbam_id),
                INDEX idx_name (last_name, first_name)
            )
        """)
        
        # MLB打撃統計テーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mlb_batting_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                mlbam_id INT,
                season INT,
                team VARCHAR(10),
                games INT,
                plate_appearances INT,
                at_bats INT,
                runs INT,
                hits INT,
                doubles INT,
                triples INT,
                home_runs INT,
                rbis INT,
                stolen_bases INT,
                caught_stealing INT,
                walks INT,
                strikeouts INT,
                batting_average DECIMAL(5,3),
                on_base_percentage DECIMAL(5,3),
                slugging_percentage DECIMAL(5,3),
                ops DECIMAL(5,3),
                ops_plus INT,
                total_bases INT,
                gdp INT,
                hit_by_pitch INT,
                sacrifice_hits INT,
                sacrifice_flies INT,
                intentional_walks INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_player_season (mlbam_id, season),
                INDEX idx_season_team (season, team),
                INDEX idx_season_ops (season, ops)
            )
        """)
        
        # MLB投手統計テーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mlb_pitching_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                mlbam_id INT,
                season INT,
                team VARCHAR(10),
                wins INT,
                losses INT,
                games INT,
                games_started INT,
                complete_games INT,
                shutouts INT,
                saves INT,
                save_opportunities INT,
                holds INT,
                blown_saves INT,
                innings_pitched DECIMAL(5,1),
                hits INT,
                runs INT,
                earned_runs INT,
                home_runs INT,
                walks INT,
                intentional_walks INT,
                strikeouts INT,
                hit_batters INT,
                balks INT,
                wild_pitches INT,
                batters_faced INT,
                era DECIMAL(5,2),
                whip DECIMAL(5,3),
                batting_average_against DECIMAL(5,3),
                fip DECIMAL(5,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_player_season (mlbam_id, season),
                INDEX idx_season_team (season, team),
                INDEX idx_season_era (season, era)
            )
        """)
        
        # Statcastデータテーブル（サンプリング保存用）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mlb_statcast_sample (
                id INT AUTO_INCREMENT PRIMARY KEY,
                game_date DATE,
                batter_id INT,
                pitcher_id INT,
                events VARCHAR(50),
                description TEXT,
                zone INT,
                stand VARCHAR(1),
                p_throws VARCHAR(1),
                home_team VARCHAR(10),
                away_team VARCHAR(10),
                type VARCHAR(1),
                hit_location INT,
                bb_type VARCHAR(20),
                balls INT,
                strikes INT,
                game_year INT,
                pfx_x DECIMAL(6,3),
                pfx_z DECIMAL(6,3),
                plate_x DECIMAL(6,3),
                plate_z DECIMAL(6,3),
                on_3b INT,
                on_2b INT,
                on_1b INT,
                outs_when_up INT,
                inning INT,
                inning_topbot VARCHAR(3),
                hc_x DECIMAL(7,2),
                hc_y DECIMAL(7,2),
                fielder_2 INT,
                vx0 DECIMAL(6,3),
                vy0 DECIMAL(6,3),
                vz0 DECIMAL(6,3),
                ax DECIMAL(6,3),
                ay DECIMAL(6,3),
                az DECIMAL(6,3),
                sz_top DECIMAL(5,3),
                sz_bot DECIMAL(5,3),
                hit_distance_sc INT,
                launch_speed DECIMAL(5,1),
                launch_angle DECIMAL(5,1),
                effective_speed DECIMAL(5,1),
                release_speed DECIMAL(5,1),
                release_pos_x DECIMAL(5,3),
                release_pos_z DECIMAL(5,3),
                release_pos_y DECIMAL(5,3),
                estimated_ba_using_speedangle DECIMAL(5,3),
                estimated_woba_using_speedangle DECIMAL(5,3),
                woba_value DECIMAL(5,3),
                woba_denom INT,
                babip_value INT,
                iso_value DECIMAL(5,3),
                launch_speed_angle INT,
                at_bat_number INT,
                pitch_number INT,
                pitch_name VARCHAR(50),
                home_score INT,
                away_score INT,
                bat_score INT,
                fld_score INT,
                post_away_score INT,
                post_home_score INT,
                post_bat_score INT,
                post_fld_score INT,
                if_fielding_alignment VARCHAR(20),
                of_fielding_alignment VARCHAR(20),
                spin_axis DECIMAL(6,1),
                spin_rate_deprecated DECIMAL(7,1),
                spin_rate_pci_legacy DECIMAL(7,1),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_game_date (game_date),
                INDEX idx_batter (batter_id),
                INDEX idx_pitcher (pitcher_id),
                INDEX idx_events (events)
            )
        """)
        
        connection.commit()
        cursor.close()
        connection.close()
        
        logger.info("MLB database tables created successfully")
        return True
    
    def fetch_and_store_player_ids(self, last_name: str, first_name: str):
        """選手ID検索と保存"""
        if not PYBASEBALL_AVAILABLE:
            logger.warning("pybaseball not available, using mock data")
            return self.create_mock_player_data(last_name, first_name)
        
        try:
            # pybaseballで選手ID検索
            player_df = playerid_lookup(last_name, first_name)
            
            if player_df.empty:
                logger.warning(f"No player found for {first_name} {last_name}")
                return None
            
            connection = self.connect_mysql()
            if not connection:
                return None
            
            cursor = connection.cursor()
            
            for _, player in player_df.iterrows():
                cursor.execute("""
                    INSERT INTO mlb_players (
                        mlbam_id, bbref_id, fangraphs_id, first_name, last_name, 
                        full_name, birth_date, debut_date, final_game
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        bbref_id = VALUES(bbref_id),
                        fangraphs_id = VALUES(fangraphs_id),
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    player.get('key_mlbam'),
                    player.get('key_bbref'),
                    player.get('key_fangraphs'),
                    player.get('name_first'),
                    player.get('name_last'),
                    f"{player.get('name_first')} {player.get('name_last')}",
                    player.get('birth_year'),  # 簡略化
                    player.get('mlb_played_first'),
                    player.get('mlb_played_last')
                ))
            
            connection.commit()
            cursor.close()
            connection.close()
            
            logger.info(f"Stored {len(player_df)} player records for {first_name} {last_name}")
            return player_df
            
        except Exception as e:
            logger.error(f"Error fetching player IDs: {e}")
            return None
    
    def fetch_batting_stats(self, season: int = 2023):
        """シーズン打撃統計取得"""
        if not PYBASEBALL_AVAILABLE:
            logger.warning("pybaseball not available, creating mock batting data")
            return self.create_mock_batting_data(season)
        
        try:
            # FanGraphsから打撃統計を取得
            batting_df = batting_stats(season)
            
            connection = self.connect_mysql()
            if not connection:
                return None
            
            cursor = connection.cursor()
            
            for _, player in batting_df.iterrows():
                # MLBAMIDを取得（pybaseballの列名に依存）
                mlbam_id = player.get('IDfg')  # FanGraphs ID
                
                cursor.execute("""
                    INSERT INTO mlb_batting_stats (
                        mlbam_id, season, team, games, plate_appearances, at_bats,
                        runs, hits, doubles, triples, home_runs, rbis, stolen_bases,
                        caught_stealing, walks, strikeouts, batting_average,
                        on_base_percentage, slugging_percentage, ops, ops_plus
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        games = VALUES(games),
                        plate_appearances = VALUES(plate_appearances),
                        at_bats = VALUES(at_bats),
                        runs = VALUES(runs),
                        hits = VALUES(hits),
                        doubles = VALUES(doubles),
                        triples = VALUES(triples),
                        home_runs = VALUES(home_runs),
                        rbis = VALUES(rbis),
                        stolen_bases = VALUES(stolen_bases),
                        caught_stealing = VALUES(caught_stealing),
                        walks = VALUES(walks),
                        strikeouts = VALUES(strikeouts),
                        batting_average = VALUES(batting_average),
                        on_base_percentage = VALUES(on_base_percentage),
                        slugging_percentage = VALUES(slugging_percentage),
                        ops = VALUES(ops),
                        ops_plus = VALUES(ops_plus),
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    mlbam_id, season, player.get('Team'), player.get('G'),
                    player.get('PA'), player.get('AB'), player.get('R'),
                    player.get('H'), player.get('2B'), player.get('3B'),
                    player.get('HR'), player.get('RBI'), player.get('SB'),
                    player.get('CS'), player.get('BB'), player.get('SO'),
                    player.get('AVG'), player.get('OBP'), player.get('SLG'),
                    player.get('OPS'), player.get('wRC+')
                ))
            
            connection.commit()
            cursor.close()
            connection.close()
            
            logger.info(f"Stored {len(batting_df)} batting records for {season}")
            return batting_df
            
        except Exception as e:
            logger.error(f"Error fetching batting stats: {e}")
            return None
    
    def fetch_pitching_stats(self, season: int = 2023):
        """シーズン投手統計取得"""
        if not PYBASEBALL_AVAILABLE:
            logger.warning("pybaseball not available, creating mock pitching data")
            return self.create_mock_pitching_data(season)
        
        try:
            pitching_df = pitching_stats(season)
            
            connection = self.connect_mysql()
            if not connection:
                return None
            
            cursor = connection.cursor()
            
            for _, pitcher in pitching_df.iterrows():
                mlbam_id = pitcher.get('IDfg')
                
                cursor.execute("""
                    INSERT INTO mlb_pitching_stats (
                        mlbam_id, season, team, wins, losses, games, games_started,
                        complete_games, shutouts, saves, innings_pitched, hits,
                        runs, earned_runs, home_runs, walks, strikeouts,
                        era, whip, fip
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        wins = VALUES(wins),
                        losses = VALUES(losses),
                        games = VALUES(games),
                        games_started = VALUES(games_started),
                        complete_games = VALUES(complete_games),
                        shutouts = VALUES(shutouts),
                        saves = VALUES(saves),
                        innings_pitched = VALUES(innings_pitched),
                        hits = VALUES(hits),
                        runs = VALUES(runs),
                        earned_runs = VALUES(earned_runs),
                        home_runs = VALUES(home_runs),
                        walks = VALUES(walks),
                        strikeouts = VALUES(strikeouts),
                        era = VALUES(era),
                        whip = VALUES(whip),
                        fip = VALUES(fip),
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    mlbam_id, season, pitcher.get('Team'), pitcher.get('W'),
                    pitcher.get('L'), pitcher.get('G'), pitcher.get('GS'),
                    pitcher.get('CG'), pitcher.get('SHO'), pitcher.get('SV'),
                    pitcher.get('IP'), pitcher.get('H'), pitcher.get('R'),
                    pitcher.get('ER'), pitcher.get('HR'), pitcher.get('BB'),
                    pitcher.get('SO'), pitcher.get('ERA'), pitcher.get('WHIP'),
                    pitcher.get('FIP')
                ))
            
            connection.commit()
            cursor.close()
            connection.close()
            
            logger.info(f"Stored {len(pitching_df)} pitching records for {season}")
            return pitching_df
            
        except Exception as e:
            logger.error(f"Error fetching pitching stats: {e}")
            return None
    
    def sample_statcast_data(self, start_date: str, end_date: str, max_records: int = 1000):
        """Statcastデータのサンプリング取得"""
        if not PYBASEBALL_AVAILABLE:
            logger.warning("pybaseball not available, skipping Statcast data")
            return None
        
        try:
            # 期間を区切ってサンプリング
            from datetime import datetime
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            
            # 1週間ずつのサンプリング
            current = start
            all_data = []
            
            while current <= end and len(all_data) < max_records:
                week_end = min(current + timedelta(days=7), end)
                
                # ランダムに選手を選んでサンプリング
                # 実際の実装では、特定の選手やイベントをフィルタリング
                try:
                    sample_data = statcast_batter(
                        current.strftime('%Y-%m-%d'),
                        week_end.strftime('%Y-%m-%d')
                    )
                    
                    if not sample_data.empty:
                        # 最大100レコードまでサンプリング
                        sample_data = sample_data.head(100)
                        all_data.append(sample_data)
                        
                except Exception as e:
                    logger.warning(f"Error sampling Statcast data for {current}: {e}")
                
                current = week_end + timedelta(days=1)
                
                if len(all_data) >= 10:  # 最大10週間分
                    break
            
            if all_data:
                combined_df = pd.concat(all_data, ignore_index=True)
                self.store_statcast_sample(combined_df)
                logger.info(f"Sampled {len(combined_df)} Statcast records")
                return combined_df
            
        except Exception as e:
            logger.error(f"Error sampling Statcast data: {e}")
            return None
    
    def store_statcast_sample(self, statcast_df):
        """Statcastサンプルデータの保存"""
        connection = self.connect_mysql()
        if not connection:
            return
        
        cursor = connection.cursor()
        
        for _, pitch in statcast_df.iterrows():
            try:
                cursor.execute("""
                    INSERT INTO mlb_statcast_sample (
                        game_date, batter_id, pitcher_id, events, zone, stand, p_throws,
                        home_team, away_team, balls, strikes, game_year, launch_speed,
                        launch_angle, release_speed, woba_value
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    pitch.get('game_date'),
                    pitch.get('batter'),
                    pitch.get('pitcher'),
                    pitch.get('events'),
                    pitch.get('zone'),
                    pitch.get('stand'),
                    pitch.get('p_throws'),
                    pitch.get('home_team'),
                    pitch.get('away_team'),
                    pitch.get('balls'),
                    pitch.get('strikes'),
                    pitch.get('game_year'),
                    pitch.get('launch_speed'),
                    pitch.get('launch_angle'),
                    pitch.get('release_speed'),
                    pitch.get('woba_value')
                ))
            except Exception as e:
                logger.warning(f"Error inserting Statcast record: {e}")
                continue
        
        connection.commit()
        cursor.close()
        connection.close()
    
    # =============================================================================
    # モックデータ生成（pybaseball未インストール時用）
    # =============================================================================
    
    def create_mock_player_data(self, last_name: str, first_name: str):
        """モック選手データ生成"""
        import random
        
        mock_data = {
            'name_first': first_name,
            'name_last': last_name,
            'key_mlbam': random.randint(400000, 700000),
            'key_bbref': f"{last_name[:5].lower()}{first_name[:2].lower()}01",
            'key_fangraphs': random.randint(1000, 20000),
            'birth_year': random.randint(1990, 2005),
            'mlb_played_first': random.randint(2015, 2023),
            'mlb_played_last': 2023
        }
        
        logger.info(f"Created mock player data for {first_name} {last_name}")
        return pd.DataFrame([mock_data])
    
    def create_mock_batting_data(self, season: int):
        """モック打撃データ生成"""
        import random
        
        mock_players = []
        teams = ['LAA', 'NYY', 'HOU', 'LAD', 'ATL', 'TB', 'MIL', 'TOR', 'WSN', 'PHI']
        
        for i in range(50):  # 50人の選手データ
            player = {
                'IDfg': random.randint(1000, 20000),
                'Team': random.choice(teams),
                'G': random.randint(100, 162),
                'PA': random.randint(400, 750),
                'AB': random.randint(350, 650),
                'R': random.randint(50, 130),
                'H': random.randint(80, 200),
                '2B': random.randint(15, 50),
                '3B': random.randint(1, 15),
                'HR': random.randint(5, 50),
                'RBI': random.randint(30, 130),
                'SB': random.randint(0, 30),
                'CS': random.randint(0, 10),
                'BB': random.randint(30, 120),
                'SO': random.randint(80, 200),
                'AVG': round(random.uniform(0.200, 0.350), 3),
                'OBP': round(random.uniform(0.280, 0.450), 3),
                'SLG': round(random.uniform(0.350, 0.650), 3),
                'OPS': round(random.uniform(0.650, 1.100), 3),
                'wRC+': random.randint(60, 180)
            }
            mock_players.append(player)
        
        logger.info(f"Created mock batting data for {len(mock_players)} players")
        return pd.DataFrame(mock_players)
    
    def create_mock_pitching_data(self, season: int):
        """モック投手データ生成"""
        import random
        
        mock_pitchers = []
        teams = ['LAA', 'NYY', 'HOU', 'LAD', 'ATL', 'TB', 'MIL', 'TOR', 'WSN', 'PHI']
        
        for i in range(30):  # 30人の投手データ
            pitcher = {
                'IDfg': random.randint(1000, 20000),
                'Team': random.choice(teams),
                'W': random.randint(0, 20),
                'L': random.randint(0, 15),
                'G': random.randint(15, 70),
                'GS': random.randint(10, 35),
                'CG': random.randint(0, 3),
                'SHO': random.randint(0, 2),
                'SV': random.randint(0, 45),
                'IP': round(random.uniform(50.0, 220.0), 1),
                'H': random.randint(50, 250),
                'R': random.randint(25, 120),
                'ER': random.randint(20, 110),
                'HR': random.randint(5, 35),
                'BB': random.randint(20, 80),
                'SO': random.randint(60, 300),
                'ERA': round(random.uniform(2.50, 6.00), 2),
                'WHIP': round(random.uniform(0.900, 1.800), 3),
                'FIP': round(random.uniform(2.80, 5.50), 2)
            }
            mock_pitchers.append(pitcher)
        
        logger.info(f"Created mock pitching data for {len(mock_pitchers)} pitchers")
        return pd.DataFrame(mock_pitchers)

def main():
    """メイン実行"""
    import argparse
    
    parser = argparse.ArgumentParser(description="MLB Data Integration System")
    parser.add_argument("--setup", action="store_true", help="Setup MLB database tables")
    parser.add_argument("--fetch-batting", type=int, metavar="SEASON", help="Fetch batting stats for season")
    parser.add_argument("--fetch-pitching", type=int, metavar="SEASON", help="Fetch pitching stats for season")
    parser.add_argument("--sample-statcast", nargs=2, metavar=("START", "END"), help="Sample Statcast data between dates")
    parser.add_argument("--lookup-player", nargs=2, metavar=("LAST", "FIRST"), help="Lookup player by name")
    
    args = parser.parse_args()
    
    mlb_integration = MLBDataIntegration()
    
    if args.setup:
        mlb_integration.setup_mlb_tables()
    
    if args.fetch_batting:
        mlb_integration.fetch_batting_stats(args.fetch_batting)
    
    if args.fetch_pitching:
        mlb_integration.fetch_pitching_stats(args.fetch_pitching)
    
    if args.sample_statcast:
        mlb_integration.sample_statcast_data(args.sample_statcast[0], args.sample_statcast[1])
    
    if args.lookup_player:
        mlb_integration.fetch_and_store_player_ids(args.lookup_player[0], args.lookup_player[1])

if __name__ == "__main__":
    main()