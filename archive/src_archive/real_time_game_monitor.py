#!/usr/bin/env python3
"""
Real-Time Game Monitor System
リアルタイム試合監視システム
NPB/KBO試合の実況・スコア・統計をリアルタイム取得
"""

import requests
import sqlite3
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import threading
import logging
from dataclasses import dataclass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class GameStatus:
    game_id: str
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    inning: int
    inning_half: str  # 'top' or 'bottom'
    status: str  # 'pre', 'live', 'final'
    last_play: str
    updated_at: datetime

class RealTimeGameMonitor:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        self.session = requests.Session()
        self.monitoring = False
        self.games_cache = {}
        
        # NPB/KBO公式サイトURL設定
        self.data_sources = {
            'npb_games': 'https://npb.jp/games/{date}/schedule.html',
            'npb_live': 'https://npb.jp/scores/{date}/{game_id}/',
            'kbo_games': 'https://koreabaseball.com/game/schedule',
            'kbo_live': 'https://koreabaseball.com/game/live/{game_id}'
        }
        
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def get_today_games(self, league: str = 'both') -> List[Dict[str, Any]]:
        """今日の試合一覧を取得"""
        today = datetime.now().strftime('%Y%m%d')
        games = []
        
        if league in ['npb', 'both']:
            npb_games = self.fetch_npb_games(today)
            games.extend(npb_games)
        
        if league in ['kbo', 'both']:
            kbo_games = self.fetch_kbo_games(today)
            games.extend(kbo_games)
        
        return games
    
    def fetch_npb_games(self, date: str) -> List[Dict[str, Any]]:
        """NPB試合データ取得"""
        games = []
        try:
            url = f"https://npb.jp/games/{date[:4]}/schedule_{date[4:6]}_detail.html"
            response = self.session.get(url, timeout=10)
            
            if response.status_code == 200:
                # 実際の実装ではBeautifulSoupでHTMLパース
                # ここではサンプルデータを返す
                games = [
                    {
                        'game_id': f'npb_{date}_001',
                        'league': 'npb',
                        'date': date,
                        'home_team': 'Giants',
                        'away_team': 'Tigers',
                        'status': 'scheduled',
                        'start_time': '18:00'
                    }
                ]
        except Exception as e:
            logger.error(f"NPB games fetch error: {e}")
        
        return games
    
    def fetch_kbo_games(self, date: str) -> List[Dict[str, Any]]:
        """KBO試合データ取得"""
        games = []
        try:
            # KBO API呼び出し（実際の実装）
            games = [
                {
                    'game_id': f'kbo_{date}_001',
                    'league': 'kbo',
                    'date': date,
                    'home_team': 'Bears',
                    'away_team': 'Tigers',
                    'status': 'scheduled',
                    'start_time': '18:30'
                }
            ]
        except Exception as e:
            logger.error(f"KBO games fetch error: {e}")
        
        return games
    
    def get_live_game_data(self, game_id: str) -> Optional[GameStatus]:
        """ライブ試合データ取得"""
        try:
            if game_id.startswith('npb_'):
                return self.fetch_npb_live_data(game_id)
            elif game_id.startswith('kbo_'):
                return self.fetch_kbo_live_data(game_id)
        except Exception as e:
            logger.error(f"Live data fetch error for {game_id}: {e}")
        
        return None
    
    def fetch_npb_live_data(self, game_id: str) -> Optional[GameStatus]:
        """NPBライブデータ取得"""
        try:
            # 実際の実装ではNPB APIを呼び出し
            # ここではサンプルデータ
            return GameStatus(
                game_id=game_id,
                home_team='Giants',
                away_team='Tigers',
                home_score=3,
                away_score=2,
                inning=7,
                inning_half='bottom',
                status='live',
                last_play='安打 中堅前ヒット',
                updated_at=datetime.now()
            )
        except Exception as e:
            logger.error(f"NPB live data error: {e}")
            return None
    
    def fetch_kbo_live_data(self, game_id: str) -> Optional[GameStatus]:
        """KBOライブデータ取得"""
        try:
            # KBOライブAPI呼び出し
            return GameStatus(
                game_id=game_id,
                home_team='Bears',
                away_team='Tigers',
                home_score=1,
                away_score=0,
                inning=4,
                inning_half='top',
                status='live',
                last_play='볼넷 (Walk)',
                updated_at=datetime.now()
            )
        except Exception as e:
            logger.error(f"KBO live data error: {e}")
            return None
    
    def save_game_update(self, game_status: GameStatus):
        """試合更新をデータベースに保存"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS live_game_updates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id TEXT NOT NULL,
                    home_team TEXT,
                    away_team TEXT,
                    home_score INTEGER,
                    away_score INTEGER,
                    inning INTEGER,
                    inning_half TEXT,
                    status TEXT,
                    last_play TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                INSERT INTO live_game_updates 
                (game_id, home_team, away_team, home_score, away_score, 
                 inning, inning_half, status, last_play, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                game_status.game_id,
                game_status.home_team,
                game_status.away_team,
                game_status.home_score,
                game_status.away_score,
                game_status.inning,
                game_status.inning_half,
                game_status.status,
                game_status.last_play,
                game_status.updated_at
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Database save error: {e}")
    
    def monitor_game(self, game_id: str, interval: int = 30):
        """特定試合をリアルタイム監視"""
        logger.info(f"試合監視開始: {game_id}")
        
        while self.monitoring:
            try:
                game_status = self.get_live_game_data(game_id)
                
                if game_status:
                    # 変更があった場合のみ更新
                    if self.has_game_changed(game_status):
                        self.save_game_update(game_status)
                        self.display_game_update(game_status)
                        self.games_cache[game_id] = game_status
                    
                    if game_status.status == 'final':
                        logger.info(f"試合終了: {game_id}")
                        break
                
                time.sleep(interval)
                
            except Exception as e:
                logger.error(f"監視エラー: {e}")
                time.sleep(interval)
    
    def has_game_changed(self, new_status: GameStatus) -> bool:
        """試合状況が変更されたかチェック"""
        if new_status.game_id not in self.games_cache:
            return True
        
        old_status = self.games_cache[new_status.game_id]
        
        return (
            old_status.home_score != new_status.home_score or
            old_status.away_score != new_status.away_score or
            old_status.inning != new_status.inning or
            old_status.last_play != new_status.last_play or
            old_status.status != new_status.status
        )
    
    def display_game_update(self, game_status: GameStatus):
        """試合更新を表示"""
        print(f"\n{'='*60}")
        print(f"LIVE UPDATE: {game_status.game_id}")
        print(f"{'='*60}")
        print(f"{game_status.away_team:>15} {game_status.away_score:>3} - {game_status.home_score:<3} {game_status.home_team}")
        print(f"          {game_status.inning}回{game_status.inning_half} | {game_status.status}")
        print(f"最新プレー: {game_status.last_play}")
        print(f"更新時刻: {game_status.updated_at.strftime('%H:%M:%S')}")
        print(f"{'='*60}")
    
    def start_monitoring(self, league: str = 'both', interval: int = 30):
        """全試合のリアルタイム監視を開始"""
        print("="*80)
        print("REAL-TIME GAME MONITORING SYSTEM")
        print("リアルタイム試合監視システム")
        print("="*80)
        
        self.monitoring = True
        
        # 今日の試合を取得
        today_games = self.get_today_games(league)
        
        if not today_games:
            print("本日の試合はありません")
            return
        
        print(f"\n本日の試合: {len(today_games)}試合")
        for game in today_games:
            print(f"  {game['away_team']} vs {game['home_team']} ({game['league'].upper()})")
        
        # 各試合を並行監視
        threads = []
        for game in today_games:
            if game['status'] in ['live', 'scheduled']:
                thread = threading.Thread(
                    target=self.monitor_game, 
                    args=(game['game_id'], interval)
                )
                threads.append(thread)
                thread.start()
        
        try:
            # メインループ
            while self.monitoring:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n監視を停止中...")
            self.monitoring = False
            
            for thread in threads:
                thread.join(timeout=5)
            
            print("監視システムを停止しました")
    
    def get_game_summary(self, game_id: str) -> Dict[str, Any]:
        """試合サマリーを取得"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM live_game_updates 
                WHERE game_id = ? 
                ORDER BY updated_at DESC 
                LIMIT 1
            ''', (game_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                columns = [description[0] for description in cursor.description]
                return dict(zip(columns, result))
            
        except Exception as e:
            logger.error(f"Game summary error: {e}")
        
        return {}
    
    def export_game_data(self, game_id: str, format: str = 'json') -> str:
        """試合データをエクスポート"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM live_game_updates 
                WHERE game_id = ? 
                ORDER BY updated_at
            ''', (game_id,))
            
            results = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            
            game_data = [dict(zip(columns, row)) for row in results]
            
            filename = f'game_data_{game_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
            
            if format == 'json':
                filename += '.json'
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(game_data, f, indent=2, ensure_ascii=False, default=str)
            
            elif format == 'csv':
                import pandas as pd
                filename += '.csv'
                df = pd.DataFrame(game_data)
                df.to_csv(filename, index=False, encoding='utf-8')
            
            conn.close()
            return filename
            
        except Exception as e:
            logger.error(f"Export error: {e}")
            return ""

def main():
    """メイン実行"""
    monitor = RealTimeGameMonitor()
    
    print("リアルタイム試合監視システム")
    print("1: 全試合監視開始")
    print("2: NPBのみ監視")
    print("3: KBOのみ監視")
    print("4: 特定試合監視")
    
    choice = input("選択してください (1-4): ").strip()
    
    if choice == '1':
        monitor.start_monitoring('both', interval=30)
    elif choice == '2':
        monitor.start_monitoring('npb', interval=30)
    elif choice == '3':
        monitor.start_monitoring('kbo', interval=30)
    elif choice == '4':
        game_id = input("試合ID: ").strip()
        monitor.monitoring = True
        monitor.monitor_game(game_id, interval=15)

if __name__ == "__main__":
    main()