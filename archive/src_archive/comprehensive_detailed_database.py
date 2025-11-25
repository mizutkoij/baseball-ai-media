#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
comprehensive_detailed_database.py
==================================
包括的詳細野球データベースシステム

個人成績、出身地、経歴、年度別成績を含む完全なデータベース
"""
import sqlite3
import pandas as pd
import random
from datetime import datetime, date, timedelta
import json

class ComprehensiveBaseballDatabase:
    def __init__(self):
        self.db_file = "comprehensive_baseball_database.db"
        self.cities_data = self._initialize_cities_data()
        self.colleges_data = self._initialize_colleges_data()
        self.awards_data = self._initialize_awards_data()
        
    def _initialize_cities_data(self):
        """都市・出身地データ初期化"""
        return {
            'USA': {
                'cities': ['Los Angeles, CA', 'New York, NY', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 
                          'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'Miami, FL',
                          'Atlanta, GA', 'Boston, MA', 'Seattle, WA', 'Denver, CO', 'Detroit, MI'],
                'states': ['California', 'Texas', 'Florida', 'New York', 'Pennsylvania', 'Illinois', 
                          'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'Arizona', 'Washington']
            },
            'JPN': {
                'cities': ['東京都', '大阪府', '愛知県', '神奈川県', '埼玉県', '千葉県', '兵庫県', '福岡県', 
                          '北海道', '静岡県', '茨城県', '広島県', '京都府', '新潟県', '宮城県'],
                'prefectures': ['東京都', '大阪府', '愛知県', '神奈川県', '埼玉県', '千葉県', '兵庫県']
            },
            'KOR': {
                'cities': ['서울특별시', '부산광역시', '인천광역시', '대구광역시', '대전광역시', '광주광역시', 
                          '울산광역시', '경기도', '강원도', '충청북도', '충청남도', '전라북도', '전라남도'],
                'provinces': ['경기도', '강원도', '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도']
            },
            'DOM': {'cities': ['Santo Domingo', 'Santiago', 'La Vega', 'San Cristóbal', 'Puerto Plata']},
            'VEN': {'cities': ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Ciudad Guayana']},
            'CUB': {'cities': ['Havana', 'Santiago de Cuba', 'Holguín', 'Camagüey', 'Santa Clara']},
            'MEX': {'cities': ['Mexico City', 'Guadalajara', 'Monterrey', 'Tijuana', 'León']},
            'PR': {'cities': ['San Juan', 'Bayamón', 'Carolina', 'Ponce', 'Caguas']},
            'CAN': {'cities': ['Toronto, ON', 'Vancouver, BC', 'Montreal, QC', 'Calgary, AB']},
            'COL': {'cities': ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena']}
        }
    
    def _initialize_colleges_data(self):
        """大学・高校データ初期化"""
        return {
            'USA': {
                'colleges': ['University of California Los Angeles', 'Stanford University', 'University of Texas',
                           'Arizona State University', 'Vanderbilt University', 'University of Miami',
                           'Florida State University', 'Louisiana State University', 'University of Southern California'],
                'high_schools': ['Cypress High School', 'Mater Dei High School', 'Harvard-Westlake School']
            },
            'JPN': {
                'colleges': ['早稲田大学', '慶應義塾大学', '明治大学', '法政大学', '立教大学', '東京大学', '日本大学'],
                'high_schools': ['智辯和歌山高校', 'PL学園高校', '横浜高校', '大阪桐蔭高校', '仙台育英高校']
            },
            'KOR': {
                'colleges': ['연세대학교', '고려대학교', '서울대학교', '건국대학교', '동국대학교'],
                'high_schools': ['경기고등학교', '배재고등학교', '청주고등학교']
            }
        }
    
    def _initialize_awards_data(self):
        """賞・受賞歴データ初期化"""
        return {
            'MLB': ['MVP', 'Rookie of the Year', 'Cy Young Award', 'Gold Glove', 'Silver Slugger', 
                   'All-Star Selection', 'World Series Champion', 'Batting Title', 'ERA Title'],
            'NPB': ['最優秀選手賞', '新人王', '沢村賞', 'ゴールデングラブ賞', 'ベストナイン', 
                   '首位打者', '本塁打王', '打点王', '最優秀防御率', '最多勝利', '最多奪三振'],
            'KBO': ['MVP', '신인왕', '골든글러브', '타격왕', '홈런왕', '타점왕', '방어율왕', '최다승']
        }

    def create_comprehensive_schema(self):
        """包括的データベーススキーマ作成"""
        
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            
            # 1. 詳細選手マスター
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS detailed_players_master (
                    player_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    league TEXT NOT NULL,
                    original_id INTEGER,
                    
                    -- 基本情報
                    full_name TEXT NOT NULL,
                    first_name TEXT,
                    last_name TEXT,
                    native_name TEXT,
                    nickname TEXT,
                    jersey_number INTEGER,
                    
                    -- 身体情報
                    birth_date DATE,
                    age INTEGER,
                    height_cm INTEGER,
                    weight_kg INTEGER,
                    bats TEXT,
                    throws TEXT,
                    
                    -- 出身地詳細
                    birth_city TEXT,
                    birth_state_province TEXT,
                    birth_country TEXT,
                    nationality TEXT,
                    
                    -- ポジション・チーム
                    primary_position TEXT,
                    secondary_positions TEXT,
                    current_team TEXT,
                    team_level TEXT,
                    
                    -- キャリア情報
                    debut_date DATE,
                    debut_age INTEGER,
                    pro_years INTEGER,
                    career_status TEXT,
                    
                    -- ドラフト・契約
                    draft_year INTEGER,
                    draft_round INTEGER,
                    draft_position INTEGER,
                    draft_team TEXT,
                    signing_bonus INTEGER,
                    
                    -- 現在契約
                    contract_status TEXT,
                    contract_length INTEGER,
                    contract_value INTEGER,
                    current_salary INTEGER,
                    salary_tier TEXT,
                    
                    -- 評価
                    scouting_grade REAL,
                    prospect_ranking INTEGER,
                    prospect_status TEXT,
                    overall_future_value INTEGER,
                    
                    -- メタデータ
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 2. 学歴・経歴
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS player_background (
                    background_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER,
                    
                    -- 学歴
                    high_school TEXT,
                    high_school_country TEXT,
                    high_school_graduation_year INTEGER,
                    college_university TEXT,
                    college_country TEXT,
                    college_graduation_year INTEGER,
                    college_major TEXT,
                    
                    -- アマチュア経歴
                    amateur_teams TEXT,
                    youth_achievements TEXT,
                    
                    -- 代表歴
                    national_team_history TEXT,
                    international_tournaments TEXT,
                    
                    -- 家族・個人
                    family_info TEXT,
                    languages_spoken TEXT,
                    hobbies_interests TEXT,
                    charity_work TEXT,
                    social_media_handles TEXT,
                    
                    FOREIGN KEY (player_id) REFERENCES detailed_players_master (player_id)
                )
            ''')
            
            # 3. 年度別成績 (詳細)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS yearly_performance (
                    performance_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER,
                    season INTEGER NOT NULL,
                    age INTEGER,
                    team_name TEXT,
                    league_level TEXT,
                    
                    -- 出場情報
                    games_played INTEGER,
                    games_started INTEGER,
                    innings_played REAL,
                    plate_appearances INTEGER,
                    at_bats INTEGER,
                    
                    -- 打撃成績
                    hits INTEGER,
                    runs INTEGER,
                    rbis INTEGER,
                    doubles INTEGER,
                    triples INTEGER,
                    home_runs INTEGER,
                    walks INTEGER,
                    intentional_walks INTEGER,
                    strikeouts INTEGER,
                    hit_by_pitch INTEGER,
                    sacrifice_flies INTEGER,
                    sacrifice_bunts INTEGER,
                    
                    -- 走塁
                    stolen_bases INTEGER,
                    caught_stealing INTEGER,
                    
                    -- 打撃指標
                    batting_avg REAL,
                    on_base_pct REAL,
                    slugging_pct REAL,
                    ops REAL,
                    ops_plus INTEGER,
                    
                    -- 投手成績
                    games_pitched INTEGER,
                    games_started_pitcher INTEGER,
                    complete_games INTEGER,
                    shutouts INTEGER,
                    innings_pitched REAL,
                    hits_allowed INTEGER,
                    runs_allowed INTEGER,
                    earned_runs INTEGER,
                    home_runs_allowed INTEGER,
                    walks_allowed INTEGER,
                    strikeouts_pitched INTEGER,
                    wins INTEGER,
                    losses INTEGER,
                    saves INTEGER,
                    holds INTEGER,
                    blown_saves INTEGER,
                    
                    -- 投手指標
                    era REAL,
                    whip REAL,
                    era_plus INTEGER,
                    
                    -- 守備成績
                    games_fielded INTEGER,
                    innings_fielded REAL,
                    chances INTEGER,
                    putouts INTEGER,
                    assists INTEGER,
                    errors INTEGER,
                    double_plays INTEGER,
                    passed_balls INTEGER,
                    fielding_pct REAL,
                    
                    -- 特記事項
                    injuries TEXT,
                    transactions TEXT,
                    notes TEXT,
                    
                    FOREIGN KEY (player_id) REFERENCES detailed_players_master (player_id)
                )
            ''')
            
            # 4. セイバーメトリクス年度別
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS yearly_sabermetrics (
                    sabermetric_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER,
                    season INTEGER NOT NULL,
                    
                    -- 打撃セイバーメトリクス
                    war_batting REAL,
                    wrc_plus INTEGER,
                    woba REAL,
                    babip REAL,
                    iso REAL,
                    bb_pct REAL,
                    k_pct REAL,
                    bb_k_ratio REAL,
                    contact_pct REAL,
                    zone_pct REAL,
                    swing_pct REAL,
                    
                    -- 投手セイバーメトリクス
                    war_pitching REAL,
                    fip REAL,
                    xfip REAL,
                    siera REAL,
                    k_minus_bb_pct REAL,
                    k_9 REAL,
                    bb_9 REAL,
                    hr_9 REAL,
                    lob_pct REAL,
                    gb_pct REAL,
                    fb_pct REAL,
                    
                    -- 守備セイバーメトリクス
                    war_fielding REAL,
                    uzr REAL,
                    drs INTEGER,
                    range_factor REAL,
                    zone_rating REAL,
                    
                    -- 総合指標
                    war_total REAL,
                    war_per_162 REAL,
                    wins_above_average REAL,
                    
                    FOREIGN KEY (player_id) REFERENCES detailed_players_master (player_id)
                )
            ''')
            
            # 5. 受賞歴・実績
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS awards_achievements (
                    award_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER,
                    award_year INTEGER,
                    award_name TEXT,
                    award_type TEXT,
                    league TEXT,
                    rank_position INTEGER,
                    vote_count INTEGER,
                    vote_percentage REAL,
                    notes TEXT,
                    
                    FOREIGN KEY (player_id) REFERENCES detailed_players_master (player_id)
                )
            ''')
            
            # 6. 月別・状況別成績
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS situational_stats (
                    situational_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER,
                    season INTEGER,
                    
                    -- 月別成績
                    april_ops REAL,
                    may_ops REAL,
                    june_ops REAL,
                    july_ops REAL,
                    august_ops REAL,
                    september_ops REAL,
                    
                    -- 対戦相手別
                    vs_left_ops REAL,
                    vs_right_ops REAL,
                    vs_division_ops REAL,
                    
                    -- 場面別
                    bases_empty_ops REAL,
                    runners_on_ops REAL,
                    risp_ops REAL,
                    high_leverage_ops REAL,
                    
                    -- 球場別
                    home_ops REAL,
                    away_ops REAL,
                    day_ops REAL,
                    night_ops REAL,
                    
                    -- クラッチ成績
                    clutch_avg REAL,
                    late_close_ops REAL,
                    walk_off_hits INTEGER,
                    
                    FOREIGN KEY (player_id) REFERENCES detailed_players_master (player_id)
                )
            ''')
            
            # 7. 怪我・故障歴
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS injury_history (
                    injury_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER,
                    injury_date DATE,
                    injury_type TEXT,
                    body_part TEXT,
                    severity TEXT,
                    games_missed INTEGER,
                    return_date DATE,
                    surgery_required BOOLEAN,
                    recovery_notes TEXT,
                    
                    FOREIGN KEY (player_id) REFERENCES detailed_players_master (player_id)
                )
            ''')
            
            # 8. チーム移籍履歴
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS team_history (
                    team_history_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER,
                    team_name TEXT,
                    league TEXT,
                    start_date DATE,
                    end_date DATE,
                    transaction_type TEXT,
                    seasons_played INTEGER,
                    jersey_numbers TEXT,
                    notable_achievements TEXT,
                    
                    FOREIGN KEY (player_id) REFERENCES detailed_players_master (player_id)
                )
            ''')
            
            # インデックス作成
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_player_league ON detailed_players_master (league)",
                "CREATE INDEX IF NOT EXISTS idx_player_position ON detailed_players_master (primary_position)",
                "CREATE INDEX IF NOT EXISTS idx_player_team ON detailed_players_master (current_team)",
                "CREATE INDEX IF NOT EXISTS idx_yearly_season ON yearly_performance (season)",
                "CREATE INDEX IF NOT EXISTS idx_yearly_player ON yearly_performance (player_id, season)",
                "CREATE INDEX IF NOT EXISTS idx_sabermetrics_season ON yearly_sabermetrics (season)",
                "CREATE INDEX IF NOT EXISTS idx_awards_year ON awards_achievements (award_year)"
            ]
            
            for index in indexes:
                cursor.execute(index)
            
            conn.commit()
            print("包括的データベーススキーマを作成しました")

    def generate_detailed_player_data(self, base_player):
        """詳細選手データ生成"""
        nationality = base_player.get('nationality', 'USA')
        
        # 出身地生成
        birth_info = self._generate_birth_info(nationality)
        
        # 学歴生成
        education_info = self._generate_education_info(nationality)
        
        # ドラフト情報生成
        draft_info = self._generate_draft_info(base_player)
        
        # 契約情報生成
        contract_info = self._generate_contract_info(base_player)
        
        return {
            'basic': {
                'league': base_player.get('league'),
                'original_id': base_player.get('expanded_player_id'),
                'full_name': base_player.get('full_name'),
                'first_name': base_player.get('first_name'),
                'last_name': base_player.get('last_name'),
                'native_name': base_player.get('native_name'),
                'nickname': self._generate_nickname(base_player.get('full_name')),
                'jersey_number': random.randint(1, 99),
                'birth_date': base_player.get('birth_date'),
                'age': self._calculate_age(base_player.get('birth_date')),
                'height_cm': base_player.get('height_cm'),
                'weight_kg': base_player.get('weight_kg'),
                'bats': base_player.get('bats'),
                'throws': base_player.get('throws'),
                'nationality': nationality
            },
            'birth_info': birth_info,
            'education': education_info,
            'draft': draft_info,
            'contract': contract_info,
            'career': {
                'debut_date': base_player.get('debut_date'),
                'debut_age': self._calculate_debut_age(base_player.get('birth_date'), base_player.get('debut_date')),
                'pro_years': self._calculate_pro_years(base_player.get('debut_date')),
                'career_status': base_player.get('status'),
                'primary_position': base_player.get('position'),
                'secondary_positions': self._generate_secondary_positions(base_player.get('position')),
                'current_team': base_player.get('team_name'),
                'team_level': base_player.get('team_level'),
                'scouting_grade': base_player.get('scouting_grade'),
                'prospect_ranking': base_player.get('prospect_ranking'),
                'prospect_status': 'Top Prospect' if base_player.get('prospect_ranking') and base_player.get('prospect_ranking') <= 50 else 'Regular Prospect' if base_player.get('status') == 'prospect' else 'Active Player'
            }
        }

    def _generate_birth_info(self, nationality):
        """出身地情報生成"""
        if nationality in self.cities_data:
            city = random.choice(self.cities_data[nationality]['cities'])
            if nationality == 'USA':
                state = random.choice(self.cities_data[nationality]['states'])
                return {'city': city.split(',')[0], 'state': state, 'country': 'United States'}
            elif nationality == 'JPN':
                prefecture = random.choice(self.cities_data[nationality]['prefectures'])
                return {'city': city, 'state': prefecture, 'country': 'Japan'}
            elif nationality == 'KOR':
                province = random.choice(self.cities_data[nationality]['provinces'])
                return {'city': city, 'state': province, 'country': 'South Korea'}
            else:
                return {'city': city, 'state': '', 'country': self._get_country_name(nationality)}
        else:
            return {'city': 'Unknown', 'state': '', 'country': self._get_country_name(nationality)}

    def _get_country_name(self, nationality):
        """国籍コードから国名取得"""
        country_names = {
            'USA': 'United States', 'JPN': 'Japan', 'KOR': 'South Korea',
            'DOM': 'Dominican Republic', 'VEN': 'Venezuela', 'CUB': 'Cuba',
            'MEX': 'Mexico', 'PR': 'Puerto Rico', 'CAN': 'Canada', 'COL': 'Colombia'
        }
        return country_names.get(nationality, nationality)

    def _generate_education_info(self, nationality):
        """学歴情報生成"""
        if nationality in self.colleges_data:
            college = random.choice(self.colleges_data[nationality]['colleges'])
            high_school = random.choice(self.colleges_data[nationality]['high_schools'])
            return {
                'high_school': high_school,
                'high_school_country': self._get_country_name(nationality),
                'college': college,
                'college_country': self._get_country_name(nationality),
                'college_major': random.choice(['Sports Science', 'Business', 'Communications', 'Kinesiology', 'Education'])
            }
        else:
            return {
                'high_school': f"{self._get_country_name(nationality)} High School",
                'high_school_country': self._get_country_name(nationality),
                'college': f"{self._get_country_name(nationality)} University",
                'college_country': self._get_country_name(nationality),
                'college_major': 'General Studies'
            }

    def _generate_draft_info(self, player):
        """ドラフト情報生成"""
        debut_year = None
        if player.get('debut_date'):
            debut_year = int(player.get('debut_date').split('-')[0])
        
        draft_year = debut_year - random.randint(1, 3) if debut_year else 2020
        draft_round = random.randint(1, 40)
        signing_bonus = self._calculate_signing_bonus(draft_round)
        
        return {
            'draft_year': draft_year,
            'draft_round': draft_round,
            'draft_position': random.randint(1, 30),
            'draft_team': player.get('team_name', 'Unknown Team'),
            'signing_bonus': signing_bonus
        }

    def _calculate_signing_bonus(self, draft_round):
        """サイニングボーナス計算"""
        if draft_round <= 5:
            return random.randint(500000, 2000000)
        elif draft_round <= 15:
            return random.randint(100000, 500000)
        else:
            return random.randint(10000, 100000)

    def _generate_contract_info(self, player):
        """契約情報生成"""
        salary_tier = player.get('salary_tier', 'rookie')
        
        salary_ranges = {
            'rookie': (500000, 750000),
            'veteran': (1000000, 5000000),
            'star': (5000000, 15000000),
            'superstar': (15000000, 40000000)
        }
        
        salary_range = salary_ranges.get(salary_tier, (500000, 750000))
        current_salary = random.randint(salary_range[0], salary_range[1])
        
        return {
            'contract_status': random.choice(['Active', 'Arbitration Eligible', 'Free Agent']),
            'contract_length': random.randint(1, 7),
            'contract_value': current_salary * random.randint(2, 5),
            'current_salary': current_salary,
            'salary_tier': salary_tier
        }

    def _generate_nickname(self, full_name):
        """ニックネーム生成"""
        if not full_name:
            return None
        
        nicknames = ['Jr.', 'Big', 'Flash', 'Ace', 'Rocket', 'Iron', 'Golden', 'Thunder']
        return random.choice(nicknames) if random.random() < 0.3 else None

    def _generate_secondary_positions(self, primary_position):
        """セカンダリポジション生成"""
        position_groups = {
            'C': ['1B'],
            '1B': ['DH', '3B'],
            '2B': ['SS', '3B'],
            '3B': ['1B', '2B', 'SS'],
            'SS': ['2B', '3B'],
            'OF': ['DH'],
            'DH': ['1B', 'OF'],
            'P': []
        }
        
        if primary_position in position_groups:
            secondaries = position_groups[primary_position]
            if secondaries and random.random() < 0.4:
                return random.choice(secondaries)
        return None

    def _calculate_age(self, birth_date):
        """年齢計算"""
        if not birth_date:
            return None
        try:
            birth = datetime.strptime(birth_date, '%Y-%m-%d').date()
            today = date.today()
            return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        except:
            return None

    def _calculate_debut_age(self, birth_date, debut_date):
        """デビュー時年齢計算"""
        if not birth_date or not debut_date:
            return None
        try:
            birth = datetime.strptime(birth_date, '%Y-%m-%d').date()
            debut = datetime.strptime(debut_date, '%Y-%m-%d').date()
            return debut.year - birth.year - ((debut.month, debut.day) < (birth.month, birth.day))
        except:
            return None

    def _calculate_pro_years(self, debut_date):
        """プロ年数計算"""
        if not debut_date:
            return None
        try:
            debut = datetime.strptime(debut_date, '%Y-%m-%d').date()
            today = date.today()
            return today.year - debut.year
        except:
            return None

    def populate_comprehensive_database(self):
        """包括的データベース投入"""
        
        print("包括的詳細データベースを構築中...")
        
        # 既存の拡張データベースから選手データ取得
        source_db = "expanded_baseball_database.db"
        
        with sqlite3.connect(source_db) as source_conn:
            players_df = pd.read_sql_query(
                "SELECT * FROM expanded_players_master", 
                source_conn
            )
        
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            
            print(f"選手データ処理中: {len(players_df)} 選手")
            
            for idx, player in players_df.iterrows():
                # 詳細選手データ生成
                detailed_data = self.generate_detailed_player_data(player.to_dict())
                
                # 詳細選手マスター挿入
                cursor.execute('''
                    INSERT INTO detailed_players_master (
                        league, original_id, full_name, first_name, last_name, native_name,
                        nickname, jersey_number, birth_date, age, height_cm, weight_kg,
                        bats, throws, birth_city, birth_state_province, birth_country, 
                        nationality, primary_position, secondary_positions, current_team,
                        team_level, debut_date, debut_age, pro_years, career_status,
                        draft_year, draft_round, draft_position, draft_team, signing_bonus,
                        contract_status, contract_length, contract_value, current_salary,
                        salary_tier, scouting_grade, prospect_ranking, prospect_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    detailed_data['basic']['league'],
                    detailed_data['basic']['original_id'],
                    detailed_data['basic']['full_name'],
                    detailed_data['basic']['first_name'],
                    detailed_data['basic']['last_name'],
                    detailed_data['basic']['native_name'],
                    detailed_data['basic']['nickname'],
                    detailed_data['basic']['jersey_number'],
                    detailed_data['basic']['birth_date'],
                    detailed_data['basic']['age'],
                    detailed_data['basic']['height_cm'],
                    detailed_data['basic']['weight_kg'],
                    detailed_data['basic']['bats'],
                    detailed_data['basic']['throws'],
                    detailed_data['birth_info']['city'],
                    detailed_data['birth_info']['state'],
                    detailed_data['birth_info']['country'],
                    detailed_data['basic']['nationality'],
                    detailed_data['career']['primary_position'],
                    detailed_data['career']['secondary_positions'],
                    detailed_data['career']['current_team'],
                    detailed_data['career']['team_level'],
                    detailed_data['career']['debut_date'],
                    detailed_data['career']['debut_age'],
                    detailed_data['career']['pro_years'],
                    detailed_data['career']['career_status'],
                    detailed_data['draft']['draft_year'],
                    detailed_data['draft']['draft_round'],
                    detailed_data['draft']['draft_position'],
                    detailed_data['draft']['draft_team'],
                    detailed_data['draft']['signing_bonus'],
                    detailed_data['contract']['contract_status'],
                    detailed_data['contract']['contract_length'],
                    detailed_data['contract']['contract_value'],
                    detailed_data['contract']['current_salary'],
                    detailed_data['contract']['salary_tier'],
                    detailed_data['career']['scouting_grade'],
                    detailed_data['career']['prospect_ranking'],
                    detailed_data['career']['prospect_status']
                ))
                
                player_id = cursor.lastrowid
                
                # 学歴・経歴挿入
                self._insert_background_data(cursor, player_id, detailed_data)
                
                # 年度別成績生成・挿入
                self._generate_yearly_performance(cursor, player_id, detailed_data)
                
                # セイバーメトリクス生成・挿入
                self._generate_sabermetrics(cursor, player_id, detailed_data)
                
                # 受賞歴生成・挿入
                self._generate_awards(cursor, player_id, detailed_data)
                
                if (idx + 1) % 100 == 0:
                    print(f"  処理完了: {idx + 1}/{len(players_df)} 選手")
                    conn.commit()
            
            conn.commit()
        
        print("包括的詳細データベース構築完了!")

    def _insert_background_data(self, cursor, player_id, detailed_data):
        """学歴・経歴データ挿入"""
        education = detailed_data['education']
        
        cursor.execute('''
            INSERT INTO player_background (
                player_id, high_school, high_school_country, college_university,
                college_country, college_major, languages_spoken, hobbies_interests
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            player_id,
            education['high_school'],
            education['high_school_country'],
            education['college'],
            education['college_country'],
            education['college_major'],
            self._generate_languages(detailed_data['basic']['nationality']),
            self._generate_hobbies()
        ))

    def _generate_languages(self, nationality):
        """言語生成"""
        language_map = {
            'USA': 'English',
            'JPN': 'Japanese, English',
            'KOR': 'Korean, English',
            'DOM': 'Spanish, English',
            'VEN': 'Spanish, English',
            'CUB': 'Spanish, English',
            'MEX': 'Spanish, English',
            'PR': 'Spanish, English',
            'CAN': 'English, French',
            'COL': 'Spanish, English'
        }
        return language_map.get(nationality, 'English')

    def _generate_hobbies(self):
        """趣味生成"""
        hobbies = ['Golf', 'Fishing', 'Video Games', 'Music', 'Cooking', 'Reading', 
                  'Basketball', 'Soccer', 'Swimming', 'Photography', 'Travel']
        return ', '.join(random.sample(hobbies, random.randint(2, 4)))

    def _generate_yearly_performance(self, cursor, player_id, detailed_data):
        """年度別成績生成"""
        current_year = 2024
        debut_year = 2020
        
        if detailed_data['career']['debut_date']:
            try:
                debut_year = int(detailed_data['career']['debut_date'].split('-')[0])
            except:
                pass
        
        # 過去5年間の成績生成
        for year in range(max(debut_year, current_year - 4), current_year + 1):
            age = detailed_data['basic']['age'] - (current_year - year) if detailed_data['basic']['age'] else None
            
            # 打撃成績生成
            batting_stats = self._generate_batting_stats(detailed_data['career']['primary_position'])
            
            # 投手成績生成
            pitching_stats = self._generate_pitching_stats(detailed_data['career']['primary_position'])
            
            # 守備成績生成
            fielding_stats = self._generate_fielding_stats()
            
            cursor.execute('''
                INSERT INTO yearly_performance (
                    player_id, season, age, team_name, league_level,
                    games_played, at_bats, hits, runs, rbis, doubles, triples, home_runs,
                    walks, strikeouts, stolen_bases, caught_stealing,
                    batting_avg, on_base_pct, slugging_pct, ops,
                    games_pitched, innings_pitched, wins, losses, saves, era, whip, strikeouts_pitched,
                    games_fielded, chances, putouts, assists, errors, fielding_pct
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                player_id, year, age, detailed_data['career']['current_team'], detailed_data['career']['team_level'],
                batting_stats['games'], batting_stats['at_bats'], batting_stats['hits'], 
                batting_stats['runs'], batting_stats['rbis'], batting_stats['doubles'], 
                batting_stats['triples'], batting_stats['home_runs'], batting_stats['walks'], 
                batting_stats['strikeouts'], batting_stats['stolen_bases'], batting_stats['caught_stealing'],
                batting_stats['avg'], batting_stats['obp'], batting_stats['slg'], batting_stats['ops'],
                pitching_stats['games'], pitching_stats['innings'], pitching_stats['wins'],
                pitching_stats['losses'], pitching_stats['saves'], pitching_stats['era'],
                pitching_stats['whip'], pitching_stats['strikeouts'],
                fielding_stats['games'], fielding_stats['chances'], fielding_stats['putouts'],
                fielding_stats['assists'], fielding_stats['errors'], fielding_stats['fielding_pct']
            ))

    def _generate_batting_stats(self, position):
        """打撃成績生成"""
        if position == 'P':
            # 投手の打撃成績
            games = random.randint(20, 50)
            at_bats = random.randint(10, 50)
        else:
            # 野手の打撃成績
            games = random.randint(80, 162)
            at_bats = random.randint(200, 650)
        
        hits = int(at_bats * random.uniform(0.200, 0.350))
        doubles = int(hits * random.uniform(0.15, 0.25))
        triples = random.randint(0, max(1, int(hits * 0.02)))
        home_runs = int(hits * random.uniform(0.05, 0.20))
        walks = int(at_bats * random.uniform(0.05, 0.15))
        strikeouts = int(at_bats * random.uniform(0.10, 0.30))
        
        avg = hits / at_bats if at_bats > 0 else 0
        obp = (hits + walks) / (at_bats + walks) if (at_bats + walks) > 0 else 0
        total_bases = hits + doubles + (triples * 2) + (home_runs * 3)
        slg = total_bases / at_bats if at_bats > 0 else 0
        ops = obp + slg
        
        return {
            'games': games, 'at_bats': at_bats, 'hits': hits, 'runs': random.randint(10, 120),
            'rbis': random.randint(10, 130), 'doubles': doubles, 'triples': triples,
            'home_runs': home_runs, 'walks': walks, 'strikeouts': strikeouts,
            'stolen_bases': random.randint(0, 40), 'caught_stealing': random.randint(0, 10),
            'avg': round(avg, 3), 'obp': round(obp, 3), 'slg': round(slg, 3), 'ops': round(ops, 3)
        }

    def _generate_pitching_stats(self, position):
        """投手成績生成"""
        if position != 'P':
            return {'games': 0, 'innings': 0, 'wins': 0, 'losses': 0, 'saves': 0, 
                   'era': 0, 'whip': 0, 'strikeouts': 0}
        
        games = random.randint(15, 70)
        innings = random.uniform(50, 220)
        wins = random.randint(2, 20)
        losses = random.randint(2, 15)
        saves = random.randint(0, 45)
        era = random.uniform(2.50, 5.50)
        whip = random.uniform(1.00, 1.70)
        strikeouts = int(innings * random.uniform(6, 12))
        
        return {
            'games': games, 'innings': round(innings, 1), 'wins': wins, 'losses': losses,
            'saves': saves, 'era': round(era, 2), 'whip': round(whip, 3), 'strikeouts': strikeouts
        }

    def _generate_fielding_stats(self):
        """守備成績生成"""
        games = random.randint(50, 150)
        chances = random.randint(100, 600)
        putouts = int(chances * random.uniform(0.3, 0.8))
        assists = int(chances * random.uniform(0.1, 0.4))
        errors = random.randint(0, 20)
        fielding_pct = (putouts + assists) / chances if chances > 0 else 0
        
        return {
            'games': games, 'chances': chances, 'putouts': putouts, 
            'assists': assists, 'errors': errors, 'fielding_pct': round(fielding_pct, 3)
        }

    def _generate_sabermetrics(self, cursor, player_id, detailed_data):
        """セイバーメトリクス生成"""
        current_year = 2024
        
        for year in range(current_year - 2, current_year + 1):
            war_total = random.uniform(-1.0, 8.0)
            
            cursor.execute('''
                INSERT INTO yearly_sabermetrics (
                    player_id, season, war_total, wrc_plus, woba, babip, iso,
                    bb_pct, k_pct, fip, uzr, drs
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                player_id, year, round(war_total, 1), random.randint(70, 150),
                round(random.uniform(0.280, 0.400), 3), round(random.uniform(0.250, 0.350), 3),
                round(random.uniform(0.100, 0.300), 3), round(random.uniform(5.0, 15.0), 1),
                round(random.uniform(15.0, 30.0), 1), round(random.uniform(3.00, 5.00), 2),
                round(random.uniform(-15.0, 15.0), 1), random.randint(-20, 20)
            ))

    def _generate_awards(self, cursor, player_id, detailed_data):
        """受賞歴生成"""
        league = detailed_data['basic']['league']
        position = detailed_data['career']['primary_position']
        
        # 優秀な選手には受賞歴を追加
        if detailed_data['career']['scouting_grade'] and detailed_data['career']['scouting_grade'] > 60:
            for year in range(2020, 2025):
                if random.random() < 0.3:  # 30%の確率で受賞
                    award_name = random.choice(self.awards_data.get(league, ['All-Star Selection']))
                    
                    cursor.execute('''
                        INSERT INTO awards_achievements (
                            player_id, award_year, award_name, award_type, league
                        ) VALUES (?, ?, ?, ?, ?)
                    ''', (
                        player_id, year, award_name, 'Individual', league
                    ))

def main():
    """メイン実行"""
    db_system = ComprehensiveBaseballDatabase()
    
    print("包括的詳細野球データベースシステム構築開始")
    
    # スキーマ作成
    db_system.create_comprehensive_schema()
    
    # データ投入
    db_system.populate_comprehensive_database()
    
    print("包括的詳細野球データベースシステム構築完了!")

if __name__ == "__main__":
    main()