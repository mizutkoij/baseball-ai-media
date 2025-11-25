#!/usr/bin/env python3
"""
vps/wordpress_integration.py - WordPress統合システム

野球データ収集システムとWordPressの統合:
1. 収集データをMySQLに変換・保存
2. WordPress APIでの自動記事投稿
3. データ可視化用のJSON API
4. リアルタイム更新機能
"""
import sys
import os
import json
import mysql.connector
import requests
from datetime import datetime, date
from pathlib import Path
import csv
import logging
from typing import Dict, List, Optional
import hashlib
import base64

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/www/baseball-ai/logs/wordpress_integration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class WordPressIntegration:
    """WordPress統合クラス"""
    
    def __init__(self, config_file: str = '/var/www/baseball-ai/config/wordpress.json'):
        self.config = self.load_config(config_file)
        self.mysql_config = self.config['mysql']
        self.wp_config = self.config['wordpress']
        
        logger.info("WordPress Integration initialized")
    
    def load_config(self, config_file: str) -> Dict:
        """設定ファイル読み込み"""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            # デフォルト設定
            return {
                "mysql": {
                    "host": "localhost",
                    "user": "baseball_user",
                    "password": "secure_password",
                    "database": "baseball_data"
                },
                "wordpress": {
                    "url": "https://your-domain.com",
                    "username": "admin",
                    "password": "wp_app_password",
                    "auto_post": True
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
    
    def setup_database_tables(self):
        """データベーステーブル初期化"""
        connection = self.connect_mysql()
        if not connection:
            return False
        
        cursor = connection.cursor()
        
        # 試合データテーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS baseball_games (
                id INT AUTO_INCREMENT PRIMARY KEY,
                game_date DATE,
                home_team VARCHAR(50),
                away_team VARCHAR(50),
                home_score INT,
                away_score INT,
                status VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_game (game_date, home_team, away_team)
            )
        """)
        
        # 選手データテーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS baseball_players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                player_id VARCHAR(20) UNIQUE,
                name VARCHAR(100),
                team VARCHAR(50),
                position VARCHAR(20),
                batting_avg DECIMAL(4,3),
                home_runs INT,
                rbis INT,
                era DECIMAL(4,2),
                wins INT,
                losses INT,
                data_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        
        # ロスターデータテーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS baseball_rosters (
                id INT AUTO_INCREMENT PRIMARY KEY,
                team VARCHAR(50),
                player_name VARCHAR(100),
                number INT,
                position VARCHAR(20),
                collection_date DATE,
                source_file VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_roster (team, player_name, collection_date)
            )
        """)
        
        # データ更新ログテーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS data_update_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                update_type VARCHAR(50),
                records_updated INT,
                source_file VARCHAR(255),
                status VARCHAR(20),
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        connection.commit()
        cursor.close()
        connection.close()
        
        logger.info("Database tables initialized")
        return True
    
    def import_csv_to_mysql(self, csv_file: Path, data_type: str):
        """CSVデータをMySQLにインポート"""
        connection = self.connect_mysql()
        if not connection:
            return False
        
        cursor = connection.cursor()
        imported_count = 0
        
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    if data_type == 'roster':
                        success = self.insert_roster_data(cursor, row, csv_file.name)
                    elif data_type == 'stats':
                        success = self.insert_stats_data(cursor, row, csv_file.name)
                    elif data_type == 'game':
                        success = self.insert_game_data(cursor, row, csv_file.name)
                    else:
                        continue
                    
                    if success:
                        imported_count += 1
            
            connection.commit()
            
            # 更新ログ記録
            self.log_update(cursor, data_type, imported_count, csv_file.name, 'success')
            connection.commit()
            
            logger.info(f"Imported {imported_count} records from {csv_file}")
            return True
            
        except Exception as e:
            connection.rollback()
            self.log_update(cursor, data_type, 0, csv_file.name, 'error', str(e))
            connection.commit()
            logger.error(f"Import error: {e}")
            return False
        
        finally:
            cursor.close()
            connection.close()
    
    def insert_roster_data(self, cursor, row: Dict, source_file: str) -> bool:
        """ロスターデータ挿入"""
        try:
            # データ抽出（CSVの列名に対応）
            team = row.get('target_detail', '')
            player_name = row.get('col_1', '') or row.get('col_2', '')
            number = self.safe_int(row.get('col_3', '')) or self.safe_int(row.get('col_1', ''))
            position = row.get('col_4', '') or row.get('col_3', '')
            collection_date = row.get('collection_timestamp', '')[:10]  # YYYY-MM-DD
            
            if not player_name or not team:
                return False
            
            cursor.execute("""
                INSERT INTO baseball_rosters 
                (team, player_name, number, position, collection_date, source_file)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    number = VALUES(number),
                    position = VALUES(position),
                    source_file = VALUES(source_file)
            """, (team, player_name, number, position, collection_date, source_file))
            
            return True
            
        except Exception as e:
            logger.error(f"Roster insert error: {e}")
            return False
    
    def insert_stats_data(self, cursor, row: Dict, source_file: str) -> bool:
        """統計データ挿入"""
        try:
            player_name = row.get('col_1', '')
            team = row.get('target_detail', '')
            batting_avg = self.safe_float(row.get('col_3', ''))
            home_runs = self.safe_int(row.get('col_4', ''))
            rbis = self.safe_int(row.get('col_5', ''))
            data_date = row.get('collection_timestamp', '')[:10]
            
            if not player_name:
                return False
            
            cursor.execute("""
                INSERT INTO baseball_players 
                (name, team, batting_avg, home_runs, rbis, data_date)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    batting_avg = VALUES(batting_avg),
                    home_runs = VALUES(home_runs),
                    rbis = VALUES(rbis),
                    data_date = VALUES(data_date)
            """, (player_name, team, batting_avg, home_runs, rbis, data_date))
            
            return True
            
        except Exception as e:
            logger.error(f"Stats insert error: {e}")
            return False
    
    def insert_game_data(self, cursor, row: Dict, source_file: str) -> bool:
        """試合データ挿入"""
        try:
            # 試合データの構造に応じて調整
            game_date = row.get('col_1', '')
            home_team = row.get('col_2', '')
            away_team = row.get('col_3', '')
            home_score = self.safe_int(row.get('col_4', ''))
            away_score = self.safe_int(row.get('col_5', ''))
            status = row.get('col_6', '') or 'scheduled'
            
            if not game_date or not home_team or not away_team:
                return False
            
            cursor.execute("""
                INSERT INTO baseball_games 
                (game_date, home_team, away_team, home_score, away_score, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    home_score = VALUES(home_score),
                    away_score = VALUES(away_score),
                    status = VALUES(status)
            """, (game_date, home_team, away_team, home_score, away_score, status))
            
            return True
            
        except Exception as e:
            logger.error(f"Game insert error: {e}")
            return False
    
    def log_update(self, cursor, update_type: str, records: int, source_file: str, status: str, error: str = None):
        """更新ログ記録"""
        cursor.execute("""
            INSERT INTO data_update_log 
            (update_type, records_updated, source_file, status, error_message)
            VALUES (%s, %s, %s, %s, %s)
        """, (update_type, records, source_file, status, error))
    
    def safe_int(self, value: str) -> Optional[int]:
        """安全な整数変換"""
        try:
            return int(str(value).replace(',', '').strip()) if value else None
        except:
            return None
    
    def safe_float(self, value: str) -> Optional[float]:
        """安全な浮動小数点変換"""
        try:
            return float(str(value).replace(',', '').strip()) if value else None
        except:
            return None
    
    def create_wordpress_post(self, title: str, content: str, category: str = 'baseball'):
        """WordPress自動記事投稿"""
        if not self.wp_config.get('auto_post', False):
            return False
        
        try:
            wp_url = f"{self.wp_config['url']}/wp-json/wp/v2"
            
            # 認証ヘッダー
            credentials = f"{self.wp_config['username']}:{self.wp_config['password']}"
            auth_header = base64.b64encode(credentials.encode()).decode()
            
            headers = {
                'Authorization': f'Basic {auth_header}',
                'Content-Type': 'application/json'
            }
            
            # 記事データ
            post_data = {
                'title': title,
                'content': content,
                'status': 'publish',
                'categories': [1]  # カテゴリID（要調整）
            }
            
            response = requests.post(f"{wp_url}/posts", 
                                   headers=headers, 
                                   json=post_data,
                                   timeout=30)
            
            if response.status_code == 201:
                logger.info(f"WordPress post created: {title}")
                return True
            else:
                logger.error(f"WordPress post failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"WordPress post error: {e}")
            return False
    
    def generate_daily_report(self, target_date: str = None):
        """日次レポート生成・投稿"""
        if not target_date:
            target_date = date.today().strftime('%Y-%m-%d')
        
        connection = self.connect_mysql()
        if not connection:
            return False
        
        cursor = connection.cursor(dictionary=True)
        
        # データ取得
        cursor.execute("""
            SELECT team, COUNT(*) as player_count
            FROM baseball_rosters 
            WHERE collection_date = %s
            GROUP BY team
            ORDER BY team
        """, (target_date,))
        
        roster_data = cursor.fetchall()
        
        cursor.execute("""
            SELECT update_type, COUNT(*) as count, SUM(records_updated) as total_records
            FROM data_update_log 
            WHERE DATE(created_at) = %s AND status = 'success'
            GROUP BY update_type
        """, (target_date,))
        
        update_data = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # レポート生成
        if roster_data or update_data:
            content = self.format_daily_report(target_date, roster_data, update_data)
            title = f"野球データ収集レポート - {target_date}"
            
            self.create_wordpress_post(title, content, 'report')
            return True
        
        return False
    
    def format_daily_report(self, date_str: str, roster_data: List, update_data: List) -> str:
        """日次レポートフォーマット"""
        content = f"""
<h2>野球データ収集レポート - {date_str}</h2>

<h3>収集データサマリー</h3>
<ul>
"""
        
        for update in update_data:
            content += f"<li>{update['update_type']}: {update['total_records']}件のデータを更新</li>\n"
        
        content += "</ul>\n\n"
        
        if roster_data:
            content += "<h3>チーム別ロスター更新</h3>\n<ul>\n"
            for team in roster_data:
                content += f"<li>{team['team']}: {team['player_count']}名</li>\n"
            content += "</ul>\n\n"
        
        content += f"""
<p><em>データ収集システムにより自動生成されました - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</em></p>
"""
        
        return content
    
    def process_new_data_files(self, data_dir: str = '/var/www/baseball-ai/data/continuous_collection'):
        """新しいデータファイルの処理"""
        data_path = Path(data_dir)
        processed_files = self.get_processed_files()
        
        new_files_count = 0
        
        for date_dir in data_path.glob('date=*'):
            for csv_file in date_dir.glob('*.csv'):
                if str(csv_file) not in processed_files:
                    # ファイル名からデータタイプを判定
                    filename = csv_file.name
                    if 'roster' in filename:
                        data_type = 'roster'
                    elif 'stats' in filename:
                        data_type = 'stats'
                    elif 'game' in filename:
                        data_type = 'game'
                    else:
                        data_type = 'unknown'
                    
                    if data_type != 'unknown':
                        success = self.import_csv_to_mysql(csv_file, data_type)
                        if success:
                            new_files_count += 1
                            self.mark_file_processed(str(csv_file))
        
        if new_files_count > 0:
            logger.info(f"Processed {new_files_count} new data files")
        
        return new_files_count
    
    def get_processed_files(self) -> set:
        """処理済みファイルリスト取得"""
        try:
            processed_file = Path('/var/www/baseball-ai/data/processed_files.txt')
            if processed_file.exists():
                with open(processed_file, 'r') as f:
                    return set(line.strip() for line in f.readlines())
        except:
            pass
        return set()
    
    def mark_file_processed(self, file_path: str):
        """ファイルを処理済みとしてマーク"""
        try:
            processed_file = Path('/var/www/baseball-ai/data/processed_files.txt')
            with open(processed_file, 'a') as f:
                f.write(f"{file_path}\n")
        except Exception as e:
            logger.error(f"Error marking file processed: {e}")

def main():
    """メイン実行"""
    import argparse
    
    parser = argparse.ArgumentParser(description="WordPress Integration System")
    parser.add_argument("--setup", action="store_true", help="Setup database tables")
    parser.add_argument("--process-data", action="store_true", help="Process new data files")
    parser.add_argument("--daily-report", action="store_true", help="Generate daily report")
    parser.add_argument("--import-file", help="Import specific CSV file")
    parser.add_argument("--data-type", help="Data type for import (roster/stats/game)")
    
    args = parser.parse_args()
    
    integration = WordPressIntegration()
    
    if args.setup:
        integration.setup_database_tables()
    
    if args.process_data:
        integration.process_new_data_files()
    
    if args.daily_report:
        integration.generate_daily_report()
    
    if args.import_file and args.data_type:
        csv_file = Path(args.import_file)
        if csv_file.exists():
            integration.import_csv_to_mysql(csv_file, args.data_type)
        else:
            print(f"File not found: {args.import_file}")

if __name__ == "__main__":
    main()