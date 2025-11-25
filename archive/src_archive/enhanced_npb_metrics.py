#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
enhanced_npb_metrics.py
======================
拡張NPB独自指標システム

投手版・守備版・チーム版の包括的指標開発
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
warnings.filterwarnings('ignore')

plt.rcParams['font.family'] = ['DejaVu Sans', 'Hiragino Sans', 'Yu Gothic', 'Meiryo']
plt.rcParams['figure.figsize'] = (16, 12)
sns.set_style("whitegrid")

class EnhancedNPBMetrics:
    """拡張NPB独自指標システム"""
    
    def __init__(self):
        """初期化"""
        print("[INIT] Enhanced NPB Unique Metrics System")
        print("=" * 60)
        
        # NPB特有パラメータ
        self.npb_constants = {
            # 投手指標用
            'pitcher_endurance_factor': 1.15,      # NPB先発投手の耐久性
            'relief_specialization': 0.85,         # 中継ぎ専門化度
            'save_situation_pressure': 1.3,        # セーブ場面プレッシャー
            'foreign_pitcher_adjustment': 0.95,    # 外国人投手環境調整
            
            # 守備指標用
            'infield_coordination': 1.2,           # 内野連携重要度
            'double_play_emphasis': 1.4,           # 併殺重視度
            'small_park_factor': 0.9,              # 狭い球場要因
            'defensive_substitution': 1.1,         # 守備固め頻度
            
            # チーム指標用
            'harmony_factor': 1.25,                # チーム和重要度
            'veteran_respect': 1.15,               # ベテラン重視
            'foreign_player_limit': 4,             # 外国人選手制限
            'season_length_adjustment': 144/162    # シーズン長調整
        }
    
    def create_pitcher_sample_data(self):
        """投手サンプルデータ作成"""
        print("\n[DATA] Creating Pitcher Sample Data...")
        
        pitcher_data = {
            'name': [
                '山本由伸', '佐々木朗希', '今永昇太', '高橋宏斗', '小川泰弘',
                '伊藤大海', '奥川恭伸', '山崎伊織', '大勢', '松井裕樹',
                'ロドリゲス', 'スアレス', 'ジョンソン', 'バンデンハーク', 'ケムナ'
            ],
            'team': [
                'オリックス', 'ロッテ', 'ベイスターズ', '中日', 'ヤクルト',
                '日本ハム', 'ヤクルト', '巨人', '巨人', '楽天',
                '中日', '阪神', '広島', '日本ハム', '日本ハム'
            ],
            'nationality': [
                '日本', '日本', '日本', '日本', '日本',
                '日本', '日本', '日本', '日本', '日本',
                '外国', '外国', '外国', '外国', '外国'
            ],
            'role': [
                '先発', '先発', '先発', '先発', '先発',
                '先発', '先発', '先発', '抑え', '抑え',
                '先発', '先発', '中継ぎ', '先発', 'セットアッパー'
            ],
            'IP': [180.1, 165.2, 175.0, 160.0, 145.0, 155.0, 140.0, 130.0, 65.0, 58.0, 170.0, 162.0, 75.0, 140.0, 62.0],
            'ERA': [2.38, 2.02, 2.91, 3.45, 3.12, 3.78, 3.95, 2.85, 1.85, 2.15, 3.20, 2.95, 2.88, 4.12, 2.45],
            'WHIP': [0.98, 0.89, 1.15, 1.28, 1.22, 1.35, 1.40, 1.18, 0.95, 1.02, 1.25, 1.18, 1.15, 1.45, 1.08],
            'K_9': [11.2, 13.8, 9.5, 8.2, 8.8, 7.9, 8.5, 9.2, 12.5, 11.8, 9.8, 10.2, 10.5, 7.5, 11.0],
            'BB_9': [2.1, 3.2, 2.8, 3.5, 3.1, 3.8, 4.2, 2.9, 2.2, 2.5, 3.0, 2.8, 2.9, 4.1, 2.8],
            'pitch_count_per_game': [105, 98, 102, 95, 88, 92, 87, 89, 15, 18, 101, 99, 22, 88, 20],
            'complete_games': [3, 2, 1, 0, 1, 0, 0, 0, 0, 0, 2, 1, 0, 0, 0],
            'quality_starts': [22, 20, 18, 15, 12, 14, 10, 12, 0, 0, 19, 17, 0, 8, 0],
            'inherited_runners_scored': [0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 0, 0, 8, 0, 5],
            'pressure_situations': [5, 8, 12, 18, 15, 20, 22, 15, 45, 38, 10, 12, 35, 25, 42],
            'late_inning_performance': [0.85, 0.90, 0.75, 0.70, 0.72, 0.68, 0.65, 0.78, 1.15, 1.08, 0.80, 0.82, 0.95, 0.65, 1.05]
        }
        
        df = pd.DataFrame(pitcher_data)
        print(f"[OK] Created pitcher data: {len(df)} pitchers")
        return df
    
    def create_fielding_sample_data(self):
        """守備サンプルデータ作成"""
        print("\n[DATA] Creating Fielding Sample Data...")
        
        fielding_data = {
            'name': [
                '源田壮亮', '菊池涼介', '坂本勇人', '山田哲人', '宮崎敏郎',
                '中村奨吾', '甲斐拓也', '梅野隆太郎', '近本光司', '佐藤輝明',
                '柳田悠岐', '吉田正尚', '丸佳浩', '鈴木誠也', '村上宗隆'
            ],
            'team': [
                '西武', '広島', '巨人', 'ヤクルト', 'ベイスターズ',
                'ロッテ', 'ソフトバンク', '阪神', '阪神', '阪神',
                'ソフトバンク', 'オリックス', '巨人', '広島', 'ヤクルト'
            ],
            'position': [
                'SS', '2B', 'SS', '2B', '3B',
                'C', 'C', 'C', 'CF', '1B',
                'RF', 'LF', 'CF', 'RF', '3B'
            ],
            'games': [135, 140, 138, 142, 139, 130, 125, 128, 144, 140, 135, 130, 142, 125, 140],
            'innings': [1200, 1250, 1230, 1280, 1240, 1150, 1100, 1140, 1300, 1260, 1200, 1150, 1280, 1100, 1250],
            'putouts': [195, 285, 180, 320, 85, 850, 780, 820, 380, 1180, 220, 180, 350, 200, 95],
            'assists': [420, 380, 450, 400, 280, 75, 85, 70, 8, 85, 12, 8, 15, 10, 250],
            'errors': [8, 5, 12, 7, 9, 4, 3, 5, 2, 6, 3, 2, 4, 3, 8],
            'double_plays': [85, 95, 78, 88, 25, 8, 12, 10, 2, 115, 1, 0, 3, 1, 22],
            'range_factor': [5.2, 5.8, 4.9, 5.5, 3.1, 7.8, 7.2, 7.5, 3.2, 9.8, 2.1, 1.8, 3.1, 2.0, 2.8],
            'fielding_pct': [0.987, 0.993, 0.981, 0.990, 0.976, 0.996, 0.997, 0.994, 0.995, 0.991, 0.987, 0.989, 0.989, 0.986, 0.977],
            'defensive_runs_saved': [15, 22, -5, 12, -8, 18, 20, 15, 25, -2, 8, -5, 12, 5, -10],
            'caught_stealing_pct': [0, 0, 0, 0, 0, 0.35, 0.32, 0.28, 0, 0, 0, 0, 0, 0, 0],
            'passed_balls': [0, 0, 0, 0, 0, 3, 2, 4, 0, 0, 0, 0, 0, 0, 0],
            'framing_runs': [0, 0, 0, 0, 0, 12, 8, 5, 0, 0, 0, 0, 0, 0, 0]
        }
        
        df = pd.DataFrame(fielding_data)
        print(f"[OK] Created fielding data: {len(df)} players")
        return df
    
    def create_team_sample_data(self):
        """チームサンプルデータ作成"""
        print("\n[DATA] Creating Team Sample Data...")
        
        team_data = {
            'team': ['阪神', '巨人', 'ヤクルト', '広島', '中日', 'ベイスターズ', 
                    'オリックス', 'ソフトバンク', 'ロッテ', '西武', '楽天', '日本ハム'],
            'league': ['セ', 'セ', 'セ', 'セ', 'セ', 'セ', 'パ', 'パ', 'パ', 'パ', 'パ', 'パ'],
            'wins': [85, 78, 75, 68, 65, 62, 88, 83, 76, 71, 69, 58],
            'losses': [58, 65, 68, 75, 78, 81, 55, 60, 67, 72, 74, 85],
            'runs_scored': [640, 620, 595, 580, 545, 520, 680, 650, 610, 590, 575, 510],
            'runs_allowed': [510, 545, 580, 620, 650, 685, 480, 520, 560, 595, 610, 720],
            'team_avg': [0.265, 0.258, 0.252, 0.248, 0.240, 0.235, 0.275, 0.268, 0.260, 0.255, 0.250, 0.230],
            'team_era': [3.12, 3.45, 3.68, 3.92, 4.15, 4.38, 2.88, 3.25, 3.58, 3.82, 3.95, 4.65],
            'home_record': [45, 42, 40, 38, 35, 32, 48, 45, 41, 38, 37, 30],
            'foreign_players': [4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4],
            'veteran_players_35plus': [8, 12, 15, 10, 14, 9, 6, 11, 13, 9, 8, 7],
            'sacrifice_bunts': [45, 52, 48, 55, 62, 58, 38, 42, 46, 50, 54, 49],
            'stolen_bases': [85, 78, 92, 105, 88, 95, 110, 98, 85, 90, 82, 75],
            'double_plays_turned': [145, 138, 125, 132, 128, 115, 158, 152, 142, 135, 130, 118],
            'team_chemistry_score': [8.5, 7.8, 8.2, 7.5, 7.0, 6.8, 9.2, 8.8, 8.0, 7.7, 7.2, 6.5]
        }
        
        df = pd.DataFrame(team_data)
        print(f"[OK] Created team data: {len(df)} teams")
        return df
    
    def calculate_pitcher_metrics(self, pitcher_df):
        """投手独自指標計算"""
        print("\n[CALC] Calculating Enhanced Pitcher Metrics...")
        
        df = pitcher_df.copy()
        constants = self.npb_constants
        
        # === 1. NPB Endurance Index (NEI) - 先発投手耐久性指標 ===
        print("   [METRIC] NPB Endurance Index (NEI)")
        
        # 先発投手のみ対象
        starter_mask = df['role'] == '先発'
        df['NEI'] = 0.0
        
        if starter_mask.any():
            # 耐久性スコア計算
            starters = df[starter_mask].copy()
            
            # イニング数正規化
            innings_score = (starters['IP'] / starters['IP'].max()) * 40
            
            # 球数効率
            pitch_efficiency = (100 - starters['pitch_count_per_game']) / 20
            
            # 完投能力
            complete_game_bonus = starters['complete_games'] * 5
            
            # クオリティスタート率
            qs_rate = (starters['quality_starts'] / (starters['IP'] / 6)) * 20
            
            endurance_score = innings_score + pitch_efficiency + complete_game_bonus + qs_rate
            df.loc[starter_mask, 'NEI'] = endurance_score * constants['pitcher_endurance_factor']
        
        print(f"     NEI range: {df['NEI'].min():.1f} - {df['NEI'].max():.1f}")
        
        # === 2. Relief Specialization Index (RSI) - 中継ぎ専門化指標 ===
        print("   [METRIC] Relief Specialization Index (RSI)")
        
        relief_mask = df['role'].isin(['中継ぎ', 'セットアッパー', '抑え'])
        df['RSI'] = 0.0
        
        if relief_mask.any():
            relievers = df[relief_mask].copy()
            
            # 短いイニングでの効率性
            short_inning_efficiency = (25 - relievers['pitch_count_per_game']) * 2
            
            # 継承ランナー処理能力
            inherited_runner_skill = (10 - relievers['inherited_runners_scored']) * 3
            
            # プレッシャー場面対応
            pressure_performance = relievers['pressure_situations'] / 5
            
            # 終盤強さ
            late_inning_factor = relievers['late_inning_performance'] * 30
            
            relief_score = short_inning_efficiency + inherited_runner_skill + pressure_performance + late_inning_factor
            df.loc[relief_mask, 'RSI'] = relief_score * constants['relief_specialization']
        
        print(f"     RSI range: {df['RSI'].min():.1f} - {df['RSI'].max():.1f}")
        
        # === 3. Foreign Pitcher Adaptation Index (FPAI) - 外国人投手適応指標 ===
        print("   [METRIC] Foreign Pitcher Adaptation Index (FPAI)")
        
        foreign_mask = df['nationality'] == '外国'
        df['FPAI'] = 0.0
        
        if foreign_mask.any():
            foreign_pitchers = df[foreign_mask].copy()
            
            # 基本成績による適応度
            era_adaptation = (5.0 - foreign_pitchers['ERA']) * 10
            whip_adaptation = (2.0 - foreign_pitchers['WHIP']) * 15
            
            # NPB環境調整
            npb_adjustment = constants['foreign_pitcher_adjustment']
            
            adaptation_score = (era_adaptation + whip_adaptation) * npb_adjustment
            df.loc[foreign_mask, 'FPAI'] = adaptation_score.clip(0, 100)
        
        print(f"     FPAI range: {df['FPAI'].min():.1f} - {df['FPAI'].max():.1f}")
        
        return df
    
    def calculate_fielding_metrics(self, fielding_df):
        """守備独自指標計算"""
        print("\n[CALC] Calculating Enhanced Fielding Metrics...")
        
        df = fielding_df.copy()
        constants = self.npb_constants
        
        # === 1. Infield Coordination Index (ICI) - 内野連携指標 ===
        print("   [METRIC] Infield Coordination Index (ICI)")
        
        infield_mask = df['position'].isin(['1B', '2B', '3B', 'SS'])
        df['ICI'] = 0.0
        
        if infield_mask.any():
            infielders = df[infield_mask].copy()
            
            # 併殺参加能力
            dp_factor = infielders['double_plays'] / infielders['games'] * 50
            
            # 守備率（エラー回避）
            fielding_factor = infielders['fielding_pct'] * 80
            
            # レンジファクター（守備範囲）
            range_factor = infielders['range_factor'] * 8
            
            coordination_score = (dp_factor + fielding_factor + range_factor) * constants['infield_coordination']
            df.loc[infield_mask, 'ICI'] = coordination_score
        
        print(f"     ICI range: {df['ICI'].min():.1f} - {df['ICI'].max():.1f}")
        
        # === 2. Catcher Leadership Index (CLI) - 捕手リーダーシップ指標 ===
        print("   [METRIC] Catcher Leadership Index (CLI)")
        
        catcher_mask = df['position'] == 'C'
        df['CLI'] = 0.0
        
        if catcher_mask.any():
            catchers = df[catcher_mask].copy()
            
            # 盗塁阻止能力
            cs_factor = catchers['caught_stealing_pct'] * 100
            
            # パスボール回避
            pb_factor = (10 - catchers['passed_balls']) * 5
            
            # フレーミング能力
            framing_factor = catchers['framing_runs'] * 3
            
            # 守備走塁サポート
            defensive_support = catchers['assists'] / catchers['games']
            
            leadership_score = cs_factor + pb_factor + framing_factor + defensive_support
            df.loc[catcher_mask, 'CLI'] = leadership_score
        
        print(f"     CLI range: {df['CLI'].min():.1f} - {df['CLI'].max():.1f}")
        
        # === 3. Outfield Coverage Index (OCI) - 外野カバレッジ指標 ===
        print("   [METRIC] Outfield Coverage Index (OCI)")
        
        outfield_mask = df['position'].isin(['LF', 'CF', 'RF'])
        df['OCI'] = 0.0
        
        if outfield_mask.any():
            outfielders = df[outfield_mask].copy()
            
            # 守備範囲
            range_coverage = outfielders['range_factor'] * 15
            
            # 肩の強さ（アシスト能力）
            arm_strength = outfielders['assists'] / outfielders['games'] * 20
            
            # エラー回避
            error_avoidance = (1 - (outfielders['errors'] / outfielders['games'])) * 50
            
            # 狭い球場での調整
            park_adjustment = constants['small_park_factor']
            
            coverage_score = (range_coverage + arm_strength + error_avoidance) * park_adjustment
            df.loc[outfield_mask, 'OCI'] = coverage_score
        
        print(f"     OCI range: {df['OCI'].min():.1f} - {df['OCI'].max():.1f}")
        
        return df
    
    def calculate_team_metrics(self, team_df):
        """チーム独自指標計算"""
        print("\n[CALC] Calculating Enhanced Team Metrics...")
        
        df = team_df.copy()
        constants = self.npb_constants
        
        # === 1. Team Harmony Index (THI) - チーム和指標 ===
        print("   [METRIC] Team Harmony Index (THI)")
        
        # 勝率ベース
        win_rate = df['wins'] / (df['wins'] + df['losses'])
        win_factor = win_rate * 40
        
        # ベテラン配慮
        veteran_factor = (df['veteran_players_35plus'] / 15) * 20
        
        # チームケミストリー
        chemistry_factor = df['team_chemistry_score'] * 5
        
        # 小技戦術
        small_ball_factor = (df['sacrifice_bunts'] / 60) * 15
        
        harmony_score = (win_factor + veteran_factor + chemistry_factor + small_ball_factor) * constants['harmony_factor']
        df['THI'] = harmony_score
        
        print(f"     THI range: {df['THI'].min():.1f} - {df['THI'].max():.1f}")
        
        # === 2. Foreign Player Integration Index (FPII) - 外国人選手統合指標 ===
        print("   [METRIC] Foreign Player Integration Index (FPII)")
        
        # 外国人選手活用効率
        foreign_efficiency = (df['runs_scored'] / 600) * (df['foreign_players'] / 4) * 30
        
        # チーム成績への貢献
        team_performance = ((df['runs_scored'] - df['runs_allowed']) / 100) * 20
        
        # ホーム成績（環境適応）
        home_advantage = (df['home_record'] / 72) * 25
        
        integration_score = foreign_efficiency + team_performance + home_advantage
        df['FPII'] = integration_score.clip(0, 100)
        
        print(f"     FPII range: {df['FPII'].min():.1f} - {df['FPII'].max():.1f}")
        
        # === 3. Tactical Flexibility Index (TFI) - 戦術柔軟性指標 ===
        print("   [METRIC] Tactical Flexibility Index (TFI)")
        
        # 攻撃戦術の多様性
        offensive_diversity = (df['stolen_bases'] / 100) * 15 + (df['sacrifice_bunts'] / 60) * 15
        
        # 守備戦術（併殺）
        defensive_tactics = (df['double_plays_turned'] / 150) * 20
        
        # 得点効率
        scoring_efficiency = (df['runs_scored'] / df['team_avg'] / 1000) * 30
        
        # シーズン調整
        season_adjustment = constants['season_length_adjustment']
        
        flexibility_score = (offensive_diversity + defensive_tactics + scoring_efficiency) * season_adjustment
        df['TFI'] = flexibility_score
        
        print(f"     TFI range: {df['TFI'].min():.1f} - {df['TFI'].max():.1f}")
        
        return df
    
    def create_comprehensive_visualization(self, pitcher_df, fielding_df, team_df):
        """包括的可視化"""
        print("\n[VIZ] Creating Comprehensive NPB Metrics Visualization...")
        
        fig = plt.figure(figsize=(20, 16))
        
        # === 1. 投手指標比較 ===
        ax1 = plt.subplot(3, 3, 1)
        starters = pitcher_df[pitcher_df['role'] == '先発']
        if len(starters) > 0:
            ax1.scatter(starters['ERA'], starters['NEI'], alpha=0.7, s=80, color='#ff6b35', label='Starters')
        
        relievers = pitcher_df[pitcher_df['role'].isin(['中継ぎ', 'セットアッパー', '抑え'])]
        if len(relievers) > 0:
            ax1.scatter(relievers['ERA'], relievers['RSI'], alpha=0.7, s=80, color='#2E86AB', label='Relievers')
        
        ax1.set_xlabel('ERA')
        ax1.set_ylabel('NEI / RSI')
        ax1.set_title('Pitcher Specialization Metrics')
        ax1.legend()
        
        # === 2. 守備ポジション別指標 ===
        ax2 = plt.subplot(3, 3, 2)
        position_metrics = []
        positions = []
        
        for pos in fielding_df['position'].unique():
            pos_data = fielding_df[fielding_df['position'] == pos]
            if pos == 'C' and 'CLI' in pos_data.columns:
                position_metrics.append(pos_data['CLI'].mean())
            elif pos in ['1B', '2B', '3B', 'SS'] and 'ICI' in pos_data.columns:
                position_metrics.append(pos_data['ICI'].mean())
            elif pos in ['LF', 'CF', 'RF'] and 'OCI' in pos_data.columns:
                position_metrics.append(pos_data['OCI'].mean())
            else:
                position_metrics.append(0)
            positions.append(pos)
        
        bars = ax2.bar(positions, position_metrics, color=plt.cm.Set3(np.linspace(0, 1, len(positions))))
        ax2.set_title('Defensive Metrics by Position')
        ax2.set_ylabel('Metric Score')
        ax2.tick_params(axis='x', rotation=45)
        
        # === 3. チーム指標散布図 ===
        ax3 = plt.subplot(3, 3, 3)
        scatter = ax3.scatter(team_df['THI'], team_df['TFI'], 
                            c=team_df['wins'], cmap='RdYlGn', s=100, alpha=0.7)
        ax3.set_xlabel('Team Harmony Index')
        ax3.set_ylabel('Tactical Flexibility Index')
        ax3.set_title('Team Strategy Profile')
        plt.colorbar(scatter, ax=ax3, label='Wins')
        
        # チーム名を注釈
        for i, team in enumerate(team_df['team']):
            ax3.annotate(team, (team_df['THI'].iloc[i], team_df['TFI'].iloc[i]), 
                        xytext=(5, 5), textcoords='offset points', fontsize=8)
        
        # === 4. 外国人選手影響度 ===
        ax4 = plt.subplot(3, 3, 4)
        foreign_pitchers = pitcher_df[pitcher_df['nationality'] == '外国']
        japanese_pitchers = pitcher_df[pitcher_df['nationality'] == '日本']
        
        if len(foreign_pitchers) > 0 and len(japanese_pitchers) > 0:
            ax4.hist([japanese_pitchers['ERA'], foreign_pitchers['ERA']], 
                    bins=8, alpha=0.7, label=['Japanese', 'Foreign'], 
                    color=['#ff6b35', '#2E86AB'])
            ax4.set_xlabel('ERA')
            ax4.set_ylabel('Frequency')
            ax4.set_title('ERA Distribution: Japanese vs Foreign Pitchers')
            ax4.legend()
        
        # === 5. セ・パ比較 ===
        ax5 = plt.subplot(3, 3, 5)
        central_teams = team_df[team_df['league'] == 'セ']
        pacific_teams = team_df[team_df['league'] == 'パ']
        
        if len(central_teams) > 0 and len(pacific_teams) > 0:
            metrics = ['THI', 'FPII', 'TFI']
            central_means = [central_teams[metric].mean() for metric in metrics]
            pacific_means = [pacific_teams[metric].mean() for metric in metrics]
            
            x = np.arange(len(metrics))
            width = 0.35
            
            ax5.bar(x - width/2, central_means, width, label='Central League', color='#ff6b35', alpha=0.8)
            ax5.bar(x + width/2, pacific_means, width, label='Pacific League', color='#2E86AB', alpha=0.8)
            
            ax5.set_ylabel('Average Score')
            ax5.set_title('League Comparison')
            ax5.set_xticks(x)
            ax5.set_xticklabels(metrics)
            ax5.legend()
        
        # === 6. 投手役割別パフォーマンス ===
        ax6 = plt.subplot(3, 3, 6)
        roles = pitcher_df['role'].unique()
        role_performance = []
        
        for role in roles:
            role_data = pitcher_df[pitcher_df['role'] == role]
            # 逆ERA（高い方が良い）として表示
            avg_performance = (6.0 - role_data['ERA'].mean())
            role_performance.append(avg_performance)
        
        bars = ax6.bar(roles, role_performance, color=['#ff6b35', '#f7931e', '#ffd23f', '#06ffa5'][:len(roles)])
        ax6.set_title('Performance by Pitcher Role')
        ax6.set_ylabel('Inverted ERA (Higher = Better)')
        ax6.tick_params(axis='x', rotation=45)
        
        # === 7. 守備効率vs打撃成績 ===
        ax7 = plt.subplot(3, 3, 7)
        ax7.scatter(team_df['double_plays_turned'], team_df['runs_scored'], 
                   s=100, alpha=0.7, color='#2E86AB')
        ax7.set_xlabel('Double Plays Turned')
        ax7.set_ylabel('Runs Scored')
        ax7.set_title('Defense vs Offense Balance')
        
        # === 8. ベテラン効果 ===
        ax8 = plt.subplot(3, 3, 8)
        ax8.scatter(team_df['veteran_players_35plus'], team_df['wins'], 
                   s=team_df['team_chemistry_score']*10, alpha=0.7, color='#f7931e')
        ax8.set_xlabel('Veterans (35+ years)')
        ax8.set_ylabel('Wins')
        ax8.set_title('Veteran Impact on Team Success\n(Size = Team Chemistry)')
        
        # === 9. 総合指標ランキング ===
        ax9 = plt.subplot(3, 3, 9)
        
        # チーム総合スコア
        team_df['total_score'] = team_df['THI'] + team_df['FPII'] + team_df['TFI']
        top_teams = team_df.nlargest(6, 'total_score')
        
        bars = ax9.barh(range(len(top_teams)), top_teams['total_score'], 
                       color=plt.cm.RdYlGn(np.linspace(0.3, 1, len(top_teams))))
        ax9.set_yticks(range(len(top_teams)))
        ax9.set_yticklabels(top_teams['team'])
        ax9.set_xlabel('Total NPB Metrics Score')
        ax9.set_title('Top Teams by NPB Metrics')
        
        plt.tight_layout()
        plt.savefig('C:/Users/mizut/baseball-ai-media/enhanced_npb_metrics.png', 
                   dpi=300, bbox_inches='tight')
        print("[OK] Enhanced NPB metrics visualization saved")
        plt.show()
    
    def generate_metrics_insights(self, pitcher_df, fielding_df, team_df):
        """指標洞察レポート"""
        print("\n[INSIGHTS] Enhanced NPB Metrics Insights")
        print("=" * 60)
        
        # 投手分析
        print("\n[PITCHING] Pitcher Metrics Analysis:")
        if 'NEI' in pitcher_df.columns:
            top_endurance = pitcher_df.nlargest(3, 'NEI')[['name', 'team', 'NEI']]
            print("   Top Endurance (NEI):")
            for _, row in top_endurance.iterrows():
                print(f"     {row['name']} ({row['team']}): {row['NEI']:.1f}")
        
        if 'RSI' in pitcher_df.columns:
            top_relief = pitcher_df.nlargest(3, 'RSI')[['name', 'team', 'RSI']]
            print("   Top Relief Specialists (RSI):")
            for _, row in top_relief.iterrows():
                print(f"     {row['name']} ({row['team']}): {row['RSI']:.1f}")
        
        # 守備分析
        print("\n[FIELDING] Defensive Metrics Analysis:")
        if 'ICI' in fielding_df.columns:
            top_infield = fielding_df.nlargest(3, 'ICI')[['name', 'team', 'position', 'ICI']]
            print("   Top Infield Coordination (ICI):")
            for _, row in top_infield.iterrows():
                print(f"     {row['name']} ({row['team']}, {row['position']}): {row['ICI']:.1f}")
        
        if 'CLI' in fielding_df.columns:
            top_catchers = fielding_df[fielding_df['CLI'] > 0].nlargest(3, 'CLI')[['name', 'team', 'CLI']]
            print("   Top Catcher Leadership (CLI):")
            for _, row in top_catchers.iterrows():
                print(f"     {row['name']} ({row['team']}): {row['CLI']:.1f}")
        
        # チーム分析
        print("\n[TEAM] Team Metrics Analysis:")
        if 'THI' in team_df.columns:
            top_harmony = team_df.nlargest(3, 'THI')[['team', 'league', 'THI']]
            print("   Top Team Harmony (THI):")
            for _, row in top_harmony.iterrows():
                print(f"     {row['team']} ({row['league']}): {row['THI']:.1f}")
        
        if 'TFI' in team_df.columns:
            top_flexibility = team_df.nlargest(3, 'TFI')[['team', 'league', 'TFI']]
            print("   Top Tactical Flexibility (TFI):")
            for _, row in top_flexibility.iterrows():
                print(f"     {row['team']} ({row['league']}): {row['TFI']:.1f}")
        
        # 統合分析
        print("\n[INTEGRATION] Cross-Category Insights:")
        
        # 外国人選手効果
        if 'FPAI' in pitcher_df.columns:
            foreign_pitchers = pitcher_df[pitcher_df['FPAI'] > 0]
            avg_foreign_era = foreign_pitchers['ERA'].mean()
            japanese_pitchers = pitcher_df[pitcher_df['nationality'] == '日本']
            avg_japanese_era = japanese_pitchers['ERA'].mean()
            
            print(f"   Foreign pitcher ERA: {avg_foreign_era:.2f}")
            print(f"   Japanese pitcher ERA: {avg_japanese_era:.2f}")
            print(f"   Foreign pitcher advantage: {avg_japanese_era - avg_foreign_era:.2f}")
        
        # リーグ特性
        if 'THI' in team_df.columns:
            central_harmony = team_df[team_df['league'] == 'セ']['THI'].mean()
            pacific_harmony = team_df[team_df['league'] == 'パ']['THI'].mean()
            
            print(f"   Central League avg harmony: {central_harmony:.1f}")
            print(f"   Pacific League avg harmony: {pacific_harmony:.1f}")
            
            if central_harmony > pacific_harmony:
                print(f"   Central League shows stronger team harmony")
            else:
                print(f"   Pacific League shows stronger team harmony")

def main():
    """メイン実行関数"""
    print("=" * 70)
    print("Enhanced NPB Unique Metrics System")
    print("投手版・守備版・チーム版の包括的指標開発")
    print("=" * 70)
    
    # システム初期化
    metrics_system = EnhancedNPBMetrics()
    
    # データ生成
    print("\n[PHASE 1] Sample Data Generation")
    pitcher_df = metrics_system.create_pitcher_sample_data()
    fielding_df = metrics_system.create_fielding_sample_data()
    team_df = metrics_system.create_team_sample_data()
    
    # 指標計算
    print("\n[PHASE 2] Enhanced Metrics Calculation")
    pitcher_enhanced = metrics_system.calculate_pitcher_metrics(pitcher_df)
    fielding_enhanced = metrics_system.calculate_fielding_metrics(fielding_df)
    team_enhanced = metrics_system.calculate_team_metrics(team_df)
    
    # 可視化
    print("\n[PHASE 3] Comprehensive Visualization")
    metrics_system.create_comprehensive_visualization(
        pitcher_enhanced, fielding_enhanced, team_enhanced)
    
    # 洞察生成
    print("\n[PHASE 4] Insights Generation")
    metrics_system.generate_metrics_insights(
        pitcher_enhanced, fielding_enhanced, team_enhanced)
    
    print("\n" + "=" * 70)
    print("[SUCCESS] Enhanced NPB Metrics System Complete!")
    print("[INNOVATION] 9 new NPB-specific metrics developed")
    print("[COVERAGE] Pitcher + Fielding + Team comprehensive analysis")
    print("[UNIQUENESS] Japan-specific baseball culture integration")
    print("=" * 70)

if __name__ == "__main__":
    main()