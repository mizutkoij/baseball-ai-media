#!/usr/bin/env python3
"""
Comprehensive Baseball Scraper System
総合野球情報スクレイピングシステム
NPB・KBO・MLB選手情報・試合データ・統計情報を収集
"""

import requests
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import logging
from dataclasses import dataclass
import time
import json
import re
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ScrapedPlayer:
    player_id: str
    name: str
    team: str
    position: str
    age: int
    nationality: str
    batting_stats: Dict[str, Any]
    pitching_stats: Dict[str, Any]
    source_url: str
    scraped_at: datetime

@dataclass
class ScrapedGame:
    game_id: str
    date: str
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    inning: int
    status: str
    box_score: Dict[str, Any]
    play_by_play: List[Dict[str, Any]]
    source_url: str

class ComprehensiveBaseballScraper:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        self.session = requests.Session()
        
        # User-Agent設定（ローテーション）
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
        
        # データソース設定
        self.data_sources = {
            'npb': {
                'base_url': 'https://npb.jp',
                'players_url': 'https://npb.jp/teams',
                'games_url': 'https://npb.jp/games',
                'stats_url': 'https://npb.jp/bis'
            },
            'kbo': {
                'base_url': 'https://www.koreabaseball.com',
                'players_url': 'https://www.koreabaseball.com/Player/Search.aspx',
                'games_url': 'https://www.koreabaseball.com/Schedule/Schedule.aspx',
                'stats_url': 'https://www.koreabaseball.com/Record/Player/HitterBasic/Basic.aspx'
            },
            'mlb': {
                'base_url': 'https://www.mlb.com',
                'api_url': 'https://statsapi.mlb.com/api/v1',
                'players_url': 'https://www.mlb.com/players',
                'games_url': 'https://www.mlb.com/schedule'
            }
        }
        
        # レート制限設定
        self.rate_limits = {
            'npb': 2.0,  # 2秒間隔
            'kbo': 3.0,  # 3秒間隔
            'mlb': 1.0   # 1秒間隔
        }
        
        # Seleniumドライバー設定
        self.setup_selenium()
    
    def setup_selenium(self):
        """Seleniumドライバー設定"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            logger.info("Seleniumドライバー初期化完了")
        except Exception as e:
            logger.warning(f"Seleniumドライバー初期化失敗: {e}")
            self.driver = None
    
    def connect_db(self):
        return sqlite3.connect(self.db_path)
    
    def get_random_user_agent(self) -> str:
        """ランダムUser-Agent取得"""
        return random.choice(self.user_agents)
    
    def safe_request(self, url: str, league: str = 'npb', **kwargs) -> Optional[requests.Response]:
        """安全なHTTPリクエスト"""
        try:
            # User-Agent設定
            headers = kwargs.get('headers', {})
            headers['User-Agent'] = self.get_random_user_agent()
            kwargs['headers'] = headers
            
            # タイムアウト設定
            kwargs.setdefault('timeout', 30)
            
            response = self.session.get(url, **kwargs)
            response.raise_for_status()
            
            # レート制限
            time.sleep(self.rate_limits.get(league, 2.0))
            
            return response
        
        except requests.RequestException as e:
            logger.error(f"リクエストエラー ({url}): {e}")
            return None
    
    def scrape_npb_players(self, team_name: str = None) -> List[ScrapedPlayer]:
        """NPB選手情報スクレイピング"""
        logger.info("NPB選手データスクレイピング開始...")
        players = []
        
        try:
            # NPBチーム一覧取得
            teams_response = self.safe_request(self.data_sources['npb']['players_url'], 'npb')
            
            if not teams_response:
                return players
            
            soup = BeautifulSoup(teams_response.text, 'html.parser')
            
            # チームリンク抽出（実際のNPBサイト構造に応じて調整）
            team_links = soup.find_all('a', href=re.compile(r'/teams/[0-9]+'))
            
            for team_link in team_links:
                team_url = self.data_sources['npb']['base_url'] + team_link.get('href')
                
                # 特定チームのみスクレイピング
                if team_name and team_name not in team_link.text:
                    continue
                
                team_players = self.scrape_npb_team_roster(team_url, team_link.text)
                players.extend(team_players)
                
                logger.info(f"NPB {team_link.text}: {len(team_players)}名取得")
        
        except Exception as e:
            logger.error(f"NPB選手スクレイピングエラー: {e}")
        
        logger.info(f"NPB選手データスクレイピング完了: {len(players)}名")
        return players
    
    def scrape_npb_team_roster(self, team_url: str, team_name: str) -> List[ScrapedPlayer]:
        """NPBチームロスタースクレイピング"""
        players = []
        
        try:
            response = self.safe_request(team_url, 'npb')
            if not response:
                return players
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 選手リスト抽出（サンプル構造）
            player_elements = soup.find_all('div', class_='player-info')
            
            for player_elem in player_elements:
                try:
                    # 選手情報抽出
                    name_elem = player_elem.find('span', class_='player-name')
                    position_elem = player_elem.find('span', class_='player-position')
                    
                    if name_elem and position_elem:
                        player = ScrapedPlayer(
                            player_id=f"npb_{hash(name_elem.text)}",
                            name=name_elem.text.strip(),
                            team=team_name,
                            position=position_elem.text.strip(),
                            age=0,  # 別途取得
                            nationality='JPN',
                            batting_stats={},
                            pitching_stats={},
                            source_url=team_url,
                            scraped_at=datetime.now()
                        )
                        
                        # 詳細ページから追加情報取得
                        detail_link = player_elem.find('a')
                        if detail_link:
                            detail_url = self.data_sources['npb']['base_url'] + detail_link.get('href')
                            self.scrape_npb_player_details(player, detail_url)
                        
                        players.append(player)
                
                except Exception as e:
                    logger.warning(f"NPB選手データ抽出エラー: {e}")
        
        except Exception as e:
            logger.error(f"NPBチームロスター取得エラー: {e}")
        
        return players
    
    def scrape_npb_player_details(self, player: ScrapedPlayer, detail_url: str):
        """NPB選手詳細情報スクレイピング"""
        try:
            response = self.safe_request(detail_url, 'npb')
            if not response:
                return
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 基本情報
            age_elem = soup.find('span', class_='player-age')
            if age_elem:
                age_text = re.findall(r'\d+', age_elem.text)
                if age_text:
                    player.age = int(age_text[0])
            
            # 打撃成績
            batting_table = soup.find('table', {'id': 'batting-stats'})
            if batting_table:
                player.batting_stats = self.parse_batting_stats_table(batting_table)
            
            # 投手成績
            pitching_table = soup.find('table', {'id': 'pitching-stats'})
            if pitching_table:
                player.pitching_stats = self.parse_pitching_stats_table(pitching_table)
        
        except Exception as e:
            logger.warning(f"NPB選手詳細取得エラー: {e}")
    
    def parse_batting_stats_table(self, table) -> Dict[str, Any]:
        """打撃成績テーブル解析"""
        stats = {}
        
        try:
            rows = table.find_all('tr')
            
            for row in rows[1:]:  # ヘッダー行をスキップ
                cells = row.find_all(['td', 'th'])
                
                if len(cells) >= 10:  # 最低限の列数チェック
                    stats = {
                        'games': self.safe_int(cells[1].text),
                        'at_bats': self.safe_int(cells[2].text),
                        'runs': self.safe_int(cells[3].text),
                        'hits': self.safe_int(cells[4].text),
                        'doubles': self.safe_int(cells[5].text),
                        'triples': self.safe_int(cells[6].text),
                        'home_runs': self.safe_int(cells[7].text),
                        'rbis': self.safe_int(cells[8].text),
                        'walks': self.safe_int(cells[9].text),
                        'strikeouts': self.safe_int(cells[10].text) if len(cells) > 10 else 0,
                        'batting_avg': self.safe_float(cells[11].text) if len(cells) > 11 else 0.0
                    }
                break
        
        except Exception as e:
            logger.warning(f"打撃成績解析エラー: {e}")
        
        return stats
    
    def parse_pitching_stats_table(self, table) -> Dict[str, Any]:
        """投手成績テーブル解析"""
        stats = {}
        
        try:
            rows = table.find_all('tr')
            
            for row in rows[1:]:  # ヘッダー行をスキップ
                cells = row.find_all(['td', 'th'])
                
                if len(cells) >= 8:
                    stats = {
                        'games': self.safe_int(cells[1].text),
                        'wins': self.safe_int(cells[2].text),
                        'losses': self.safe_int(cells[3].text),
                        'saves': self.safe_int(cells[4].text),
                        'innings_pitched': self.safe_float(cells[5].text),
                        'hits_allowed': self.safe_int(cells[6].text),
                        'earned_runs': self.safe_int(cells[7].text),
                        'era': self.safe_float(cells[8].text) if len(cells) > 8 else 0.0,
                        'strikeouts': self.safe_int(cells[9].text) if len(cells) > 9 else 0,
                        'walks': self.safe_int(cells[10].text) if len(cells) > 10 else 0
                    }
                break
        
        except Exception as e:
            logger.warning(f"投手成績解析エラー: {e}")
        
        return stats
    
    def scrape_kbo_players(self) -> List[ScrapedPlayer]:
        """KBO選手情報スクレイピング"""
        logger.info("KBO選手データスクレイピング開始...")
        players = []
        
        try:
            # KBO選手検索ページ
            search_url = self.data_sources['kbo']['players_url']
            
            if self.driver:
                players = self.scrape_kbo_with_selenium()
            else:
                players = self.scrape_kbo_with_requests()
        
        except Exception as e:
            logger.error(f"KBO選手スクレイピングエラー: {e}")
        
        logger.info(f"KBO選手データスクレイピング完了: {len(players)}名")
        return players
    
    def scrape_kbo_with_selenium(self) -> List[ScrapedPlayer]:
        """SeleniumでKBOスクレイピング"""
        players = []
        
        try:
            self.driver.get(self.data_sources['kbo']['players_url'])
            time.sleep(3)
            
            # 選手検索フォームを操作
            search_button = self.driver.find_element(By.ID, 'btnSearch')
            search_button.click()
            
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, 'player-list'))
            )
            
            # 選手リスト取得
            player_elements = self.driver.find_elements(By.CLASS_NAME, 'player-item')
            
            for player_elem in player_elements:
                try:
                    name = player_elem.find_element(By.CLASS_NAME, 'player-name').text
                    team = player_elem.find_element(By.CLASS_NAME, 'team-name').text
                    position = player_elem.find_element(By.CLASS_NAME, 'position').text
                    
                    player = ScrapedPlayer(
                        player_id=f"kbo_{hash(name)}",
                        name=name,
                        team=team,
                        position=position,
                        age=0,
                        nationality='KOR',
                        batting_stats={},
                        pitching_stats={},
                        source_url=self.data_sources['kbo']['players_url'],
                        scraped_at=datetime.now()
                    )
                    
                    players.append(player)
                
                except Exception as e:
                    logger.warning(f"KBO選手要素解析エラー: {e}")
        
        except Exception as e:
            logger.error(f"KBO Seleniumスクレイピングエラー: {e}")
        
        return players
    
    def scrape_kbo_with_requests(self) -> List[ScrapedPlayer]:
        """RequestsでKBOスクレイピング"""
        players = []
        
        # KBOサイトは動的コンテンツが多いため、Seleniumが推奨
        logger.warning("KBOスクレイピングにはSeleniumが推奨されます")
        
        return players
    
    def scrape_mlb_players(self) -> List[ScrapedPlayer]:
        """MLB選手情報スクレイピング"""
        logger.info("MLB選手データスクレイピング開始...")
        players = []
        
        try:
            # MLB Stats API使用
            api_url = f"{self.data_sources['mlb']['api_url']}/teams"
            response = self.safe_request(api_url, 'mlb')
            
            if response:
                teams_data = response.json()
                
                for team in teams_data.get('teams', []):
                    team_players = self.scrape_mlb_team_roster(team['id'], team['name'])
                    players.extend(team_players)
                    
                    logger.info(f"MLB {team['name']}: {len(team_players)}名取得")
        
        except Exception as e:
            logger.error(f"MLB選手スクレイピングエラー: {e}")
        
        logger.info(f"MLB選手データスクレイピング完了: {len(players)}名")
        return players
    
    def scrape_mlb_team_roster(self, team_id: int, team_name: str) -> List[ScrapedPlayer]:
        """MLBチームロスター取得"""
        players = []
        
        try:
            roster_url = f"{self.data_sources['mlb']['api_url']}/teams/{team_id}/roster"
            response = self.safe_request(roster_url, 'mlb')
            
            if response:
                roster_data = response.json()
                
                for player_info in roster_data.get('roster', []):
                    person = player_info.get('person', {})
                    position = player_info.get('position', {})
                    
                    player = ScrapedPlayer(
                        player_id=f"mlb_{person.get('id')}",
                        name=person.get('fullName', ''),
                        team=team_name,
                        position=position.get('abbreviation', ''),
                        age=person.get('currentAge', 0),
                        nationality=person.get('birthCountry', 'USA'),
                        batting_stats={},
                        pitching_stats={},
                        source_url=roster_url,
                        scraped_at=datetime.now()
                    )
                    
                    # 詳細統計取得
                    self.scrape_mlb_player_stats(player, person.get('id'))
                    players.append(player)
        
        except Exception as e:
            logger.error(f"MLBロスター取得エラー: {e}")
        
        return players
    
    def scrape_mlb_player_stats(self, player: ScrapedPlayer, player_id: int):
        """MLB選手統計取得"""
        try:
            stats_url = f"{self.data_sources['mlb']['api_url']}/people/{player_id}/stats"
            params = {
                'stats': 'season',
                'season': datetime.now().year,
                'group': 'hitting,pitching'
            }
            
            response = self.safe_request(stats_url, 'mlb', params=params)
            
            if response:
                stats_data = response.json()
                
                for stat_group in stats_data.get('stats', []):
                    if stat_group.get('group', {}).get('displayName') == 'hitting':
                        if stat_group.get('splits'):
                            hitting_stats = stat_group['splits'][0]['stat']
                            player.batting_stats = self.convert_mlb_hitting_stats(hitting_stats)
                    
                    elif stat_group.get('group', {}).get('displayName') == 'pitching':
                        if stat_group.get('splits'):
                            pitching_stats = stat_group['splits'][0]['stat']
                            player.pitching_stats = self.convert_mlb_pitching_stats(pitching_stats)
        
        except Exception as e:
            logger.warning(f"MLB選手統計取得エラー: {e}")
    
    def convert_mlb_hitting_stats(self, stats: Dict) -> Dict[str, Any]:
        """MLB打撃統計変換"""
        return {
            'games': stats.get('gamesPlayed', 0),
            'at_bats': stats.get('atBats', 0),
            'runs': stats.get('runs', 0),
            'hits': stats.get('hits', 0),
            'doubles': stats.get('doubles', 0),
            'triples': stats.get('triples', 0),
            'home_runs': stats.get('homeRuns', 0),
            'rbis': stats.get('rbi', 0),
            'walks': stats.get('baseOnBalls', 0),
            'strikeouts': stats.get('strikeOuts', 0),
            'batting_avg': stats.get('avg', 0.0),
            'on_base_pct': stats.get('obp', 0.0),
            'slugging_pct': stats.get('slg', 0.0),
            'ops': stats.get('ops', 0.0)
        }
    
    def convert_mlb_pitching_stats(self, stats: Dict) -> Dict[str, Any]:
        """MLB投手統計変換"""
        return {
            'games': stats.get('gamesPlayed', 0),
            'wins': stats.get('wins', 0),
            'losses': stats.get('losses', 0),
            'saves': stats.get('saves', 0),
            'innings_pitched': stats.get('inningsPitched', 0.0),
            'hits_allowed': stats.get('hits', 0),
            'earned_runs': stats.get('earnedRuns', 0),
            'era': stats.get('era', 0.0),
            'strikeouts': stats.get('strikeOuts', 0),
            'walks': stats.get('baseOnBalls', 0),
            'whip': stats.get('whip', 0.0)
        }
    
    def scrape_today_games(self, league: str = 'all') -> List[ScrapedGame]:
        """本日の試合情報スクレイピング"""
        logger.info(f"本日の試合データスクレイピング開始: {league}")
        games = []
        
        if league in ['npb', 'all']:
            npb_games = self.scrape_npb_games(datetime.now().strftime('%Y-%m-%d'))
            games.extend(npb_games)
        
        if league in ['kbo', 'all']:
            kbo_games = self.scrape_kbo_games(datetime.now().strftime('%Y-%m-%d'))
            games.extend(kbo_games)
        
        if league in ['mlb', 'all']:
            mlb_games = self.scrape_mlb_games(datetime.now().strftime('%Y-%m-%d'))
            games.extend(mlb_games)
        
        logger.info(f"本日の試合データ取得完了: {len(games)}試合")
        return games
    
    def scrape_npb_games(self, date: str) -> List[ScrapedGame]:
        """NPB試合データスクレイピング"""
        games = []
        
        try:
            games_url = f"{self.data_sources['npb']['games_url']}/{date.replace('-', '')}"
            response = self.safe_request(games_url, 'npb')
            
            if response:
                soup = BeautifulSoup(response.text, 'html.parser')
                game_elements = soup.find_all('div', class_='game-card')
                
                for game_elem in game_elements:
                    game = self.parse_npb_game_element(game_elem, date)
                    if game:
                        games.append(game)
        
        except Exception as e:
            logger.error(f"NPB試合データ取得エラー: {e}")
        
        return games
    
    def parse_npb_game_element(self, game_elem, date: str) -> Optional[ScrapedGame]:
        """NPB試合要素解析"""
        try:
            home_team_elem = game_elem.find('span', class_='home-team')
            away_team_elem = game_elem.find('span', class_='away-team')
            score_elem = game_elem.find('div', class_='score')
            
            if not (home_team_elem and away_team_elem):
                return None
            
            home_team = home_team_elem.text.strip()
            away_team = away_team_elem.text.strip()
            
            # スコア解析
            home_score = 0
            away_score = 0
            if score_elem:
                scores = re.findall(r'\d+', score_elem.text)
                if len(scores) >= 2:
                    away_score = int(scores[0])
                    home_score = int(scores[1])
            
            return ScrapedGame(
                game_id=f"npb_{date}_{hash(f'{home_team}_{away_team}')}",
                date=date,
                home_team=home_team,
                away_team=away_team,
                home_score=home_score,
                away_score=away_score,
                inning=9,
                status='final',
                box_score={},
                play_by_play=[],
                source_url=self.data_sources['npb']['games_url']
            )
        
        except Exception as e:
            logger.warning(f"NPB試合要素解析エラー: {e}")
            return None
    
    def scrape_kbo_games(self, date: str) -> List[ScrapedGame]:
        """KBO試合データスクレイピング"""
        games = []
        
        # KBOの試合データスクレイピング実装
        # セレニウムまたは適切なAPIを使用
        
        return games
    
    def scrape_mlb_games(self, date: str) -> List[ScrapedGame]:
        """MLB試合データスクレイピング"""
        games = []
        
        try:
            schedule_url = f"{self.data_sources['mlb']['api_url']}/schedule"
            params = {'sportId': 1, 'date': date}
            
            response = self.safe_request(schedule_url, 'mlb', params=params)
            
            if response:
                schedule_data = response.json()
                
                for game_date in schedule_data.get('dates', []):
                    for game in game_date.get('games', []):
                        mlb_game = self.convert_mlb_game_data(game, date)
                        if mlb_game:
                            games.append(mlb_game)
        
        except Exception as e:
            logger.error(f"MLB試合データ取得エラー: {e}")
        
        return games
    
    def convert_mlb_game_data(self, game_data: Dict, date: str) -> Optional[ScrapedGame]:
        """MLBゲームデータ変換"""
        try:
            teams = game_data.get('teams', {})
            home_team = teams.get('home', {}).get('team', {}).get('name', '')
            away_team = teams.get('away', {}).get('team', {}).get('name', '')
            
            # スコア取得
            home_score = teams.get('home', {}).get('score', 0)
            away_score = teams.get('away', {}).get('score', 0)
            
            status = game_data.get('status', {}).get('detailedState', 'scheduled')
            
            return ScrapedGame(
                game_id=f"mlb_{game_data.get('gamePk')}",
                date=date,
                home_team=home_team,
                away_team=away_team,
                home_score=home_score,
                away_score=away_score,
                inning=game_data.get('linescore', {}).get('currentInning', 9),
                status=status.lower(),
                box_score={},
                play_by_play=[],
                source_url=f"{self.data_sources['mlb']['api_url']}/game/{game_data.get('gamePk')}"
            )
        
        except Exception as e:
            logger.warning(f"MLBゲームデータ変換エラー: {e}")
            return None
    
    def save_scraped_players(self, players: List[ScrapedPlayer]):
        """スクレイピング選手データ保存"""
        conn = self.connect_db()
        cursor = conn.cursor()
        
        # テーブル作成
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scraped_players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id TEXT UNIQUE,
                name TEXT,
                team TEXT,
                position TEXT,
                age INTEGER,
                nationality TEXT,
                batting_stats TEXT,
                pitching_stats TEXT,
                source_url TEXT,
                scraped_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        for player in players:
            try:
                cursor.execute('''
                    INSERT OR REPLACE INTO scraped_players 
                    (player_id, name, team, position, age, nationality, 
                     batting_stats, pitching_stats, source_url, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    player.player_id, player.name, player.team, player.position,
                    player.age, player.nationality,
                    json.dumps(player.batting_stats, ensure_ascii=False),
                    json.dumps(player.pitching_stats, ensure_ascii=False),
                    player.source_url, player.scraped_at
                ))
            except Exception as e:
                logger.warning(f"選手データ保存エラー ({player.name}): {e}")
        
        conn.commit()
        conn.close()
        
        logger.info(f"選手データ保存完了: {len(players)}名")
    
    def save_scraped_games(self, games: List[ScrapedGame]):
        """スクレイピング試合データ保存"""
        conn = self.connect_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scraped_games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT UNIQUE,
                date TEXT,
                home_team TEXT,
                away_team TEXT,
                home_score INTEGER,
                away_score INTEGER,
                inning INTEGER,
                status TEXT,
                box_score TEXT,
                play_by_play TEXT,
                source_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        for game in games:
            try:
                cursor.execute('''
                    INSERT OR REPLACE INTO scraped_games 
                    (game_id, date, home_team, away_team, home_score, away_score,
                     inning, status, box_score, play_by_play, source_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    game.game_id, game.date, game.home_team, game.away_team,
                    game.home_score, game.away_score, game.inning, game.status,
                    json.dumps(game.box_score, ensure_ascii=False),
                    json.dumps(game.play_by_play, ensure_ascii=False),
                    game.source_url
                ))
            except Exception as e:
                logger.warning(f"試合データ保存エラー ({game.game_id}): {e}")
        
        conn.commit()
        conn.close()
        
        logger.info(f"試合データ保存完了: {len(games)}試合")
    
    def safe_int(self, text: str) -> int:
        """安全な整数変換"""
        try:
            return int(re.sub(r'[^\d]', '', str(text)))
        except:
            return 0
    
    def safe_float(self, text: str) -> float:
        """安全な浮動小数点変換"""
        try:
            return float(re.sub(r'[^\d\.]', '', str(text)))
        except:
            return 0.0
    
    def export_scraped_data(self, format: str = 'json') -> str:
        """スクレイピングデータエクスポート"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        conn = self.connect_db()
        
        # 選手データ取得
        players_df = pd.read_sql_query(
            "SELECT * FROM scraped_players ORDER BY scraped_at DESC", conn
        )
        
        # 試合データ取得
        games_df = pd.read_sql_query(
            "SELECT * FROM scraped_games ORDER BY date DESC", conn
        )
        
        conn.close()
        
        if format == 'json':
            filename = f"scraped_baseball_data_{timestamp}.json"
            export_data = {
                'export_date': datetime.now().isoformat(),
                'players': players_df.to_dict('records'),
                'games': games_df.to_dict('records'),
                'summary': {
                    'total_players': len(players_df),
                    'total_games': len(games_df),
                    'leagues_covered': ['NPB', 'KBO', 'MLB']
                }
            }
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False, default=str)
        
        elif format == 'csv':
            filename = f"scraped_baseball_data_{timestamp}.csv"
            # 選手と試合を別々のCSVに
            players_df.to_csv(f"players_{filename}", index=False, encoding='utf-8')
            games_df.to_csv(f"games_{filename}", index=False, encoding='utf-8')
        
        logger.info(f"スクレイピングデータエクスポート完了: {filename}")
        return filename
    
    def cleanup(self):
        """クリーンアップ"""
        if self.driver:
            self.driver.quit()
        
        if self.session:
            self.session.close()

def main():
    """メイン実行"""
    scraper = ComprehensiveBaseballScraper()
    
    print("="*80)
    print("COMPREHENSIVE BASEBALL SCRAPER SYSTEM")
    print("総合野球情報スクレイピングシステム")
    print("="*80)
    
    print("\n1: NPB選手データ取得")
    print("2: KBO選手データ取得")  
    print("3: MLB選手データ取得")
    print("4: 本日の試合データ取得")
    print("5: 全リーグデータ一括取得")
    print("6: データエクスポート")
    
    try:
        choice = input("選択してください (1-6): ").strip()
        
        if choice == '1':
            team = input("特定チーム名（全チームの場合はEnter）: ").strip()
            players = scraper.scrape_npb_players(team if team else None)
            scraper.save_scraped_players(players)
            print(f"NPB選手データ取得完了: {len(players)}名")
        
        elif choice == '2':
            players = scraper.scrape_kbo_players()
            scraper.save_scraped_players(players)
            print(f"KBO選手データ取得完了: {len(players)}名")
        
        elif choice == '3':
            players = scraper.scrape_mlb_players()
            scraper.save_scraped_players(players)
            print(f"MLB選手データ取得完了: {len(players)}名")
        
        elif choice == '4':
            league = input("リーグ選択 (npb/kbo/mlb/all): ").strip().lower()
            games = scraper.scrape_today_games(league)
            scraper.save_scraped_games(games)
            print(f"本日の試合データ取得完了: {len(games)}試合")
        
        elif choice == '5':
            print("全リーグデータ一括取得開始...")
            
            # NPB
            print("NPB選手データ取得中...")
            npb_players = scraper.scrape_npb_players()
            scraper.save_scraped_players(npb_players)
            
            # KBO  
            print("KBO選手データ取得中...")
            kbo_players = scraper.scrape_kbo_players()
            scraper.save_scraped_players(kbo_players)
            
            # MLB
            print("MLB選手データ取得中...")
            mlb_players = scraper.scrape_mlb_players()
            scraper.save_scraped_players(mlb_players)
            
            # 本日の試合
            print("本日の試合データ取得中...")
            games = scraper.scrape_today_games('all')
            scraper.save_scraped_games(games)
            
            total_players = len(npb_players) + len(kbo_players) + len(mlb_players)
            print(f"全データ取得完了: {total_players}名, {len(games)}試合")
        
        elif choice == '6':
            format_choice = input("エクスポート形式 (json/csv): ").strip().lower()
            filename = scraper.export_scraped_data(format_choice)
            print(f"データエクスポート完了: {filename}")
        
        else:
            print("無効な選択です")
    
    except KeyboardInterrupt:
        print("\n処理を中断しました")
    
    except Exception as e:
        logger.error(f"実行エラー: {e}")
        print(f"エラーが発生しました: {e}")
    
    finally:
        scraper.cleanup()

if __name__ == "__main__":
    main()