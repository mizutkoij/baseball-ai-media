#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
contextual_npb_analytics.py
===========================
コンテキスト調整NPB分析システム

進塁打・一軍二軍統合評価・環境要因・疲労度・調子など
NPBの詳細な状況要因を考慮した包括的分析システム
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# 日本語フォント設定
plt.rcParams['font.family'] = ['DejaVu Sans', 'Hiragino Sans', 'Yu Gothic', 'Meiryo']
plt.rcParams['figure.figsize'] = (14, 10)
sns.set_style("whitegrid")

class ContextualNPBAnalytics:
    """コンテキスト調整NPB分析システム"""
    
    def __init__(self):
        """初期化"""
        print("[INIT] Contextual NPB Analytics System")
        
        # NPB特有パラメータ
        self.npb_contextual_params = {
            # 進塁打価値係数
            'advancement_values': {
                'runner_1st_to_2nd': 0.25,     # 1塁→2塁進塁価値
                'runner_2nd_to_3rd': 0.35,     # 2塁→3塁進塁価値
                'runner_3rd_home': 1.0,        # 3塁→本塁進塁価値
                'sacrifice_bunt': 0.2,         # 犠牲バント価値
                'right_side_hit': 0.15,        # 右打ち進塁価値
                'hit_and_run_success': 0.4     # ヒットエンドラン成功価値
            },
            
            # 一軍二軍レベル調整
            'level_adjustments': {
                'ichigun_baseline': 1.0,       # 一軍ベースライン
                'nigun_to_ichigun': 0.75,      # 二軍→一軍能力換算
                'rookie_adjustment': 0.85,      # ルーキー調整
                'veteran_bonus': 1.05,         # ベテラン補正
                'foreign_player_adj': 1.02     # 外国人選手調整
            },
            
            # 環境要因調整
            'environmental_factors': {
                'dome_vs_outdoor': {
                    'dome_hitting': 1.02,       # ドーム球場打撃補正
                    'dome_pitching': 0.98,      # ドーム球場投球補正
                    'outdoor_wind_factor': 0.95 # 屋外風影響
                },
                'temperature_effects': {
                    'hot_weather_threshold': 30,     # 暑さ閾値（℃）
                    'cold_weather_threshold': 10,    # 寒さ閾値（℃）
                    'hot_weather_fatigue': 0.92,     # 猛暑疲労係数
                    'cold_weather_power': 0.88       # 寒冷パワー減少
                },
                'humidity_effects': {
                    'high_humidity_threshold': 80,    # 高湿度閾値（%）
                    'high_humidity_factor': 0.94     # 高湿度影響係数
                }
            },
            
            # 疲労・連戦要因
            'fatigue_factors': {
                'consecutive_games': {
                    '1_game': 1.0,              # 1試合目
                    '2_games': 0.97,            # 連戦2試合目
                    '3_games': 0.94,            # 連戦3試合目
                    '4_plus_games': 0.90        # 4試合以上連続
                },
                'pitcher_rest': {
                    '0_days': 0.75,             # 連投
                    '1_day': 0.90,              # 中1日
                    '2_days': 0.95,             # 中2日
                    '3_plus_days': 1.0          # 中3日以上
                },
                'travel_games': {
                    'same_city': 1.0,           # 同一都市
                    'domestic_travel': 0.96,    # 国内移動
                    'long_distance': 0.92       # 長距離移動
                }
            }
        }
        
    def create_sample_detailed_data(self):
        """詳細NPBデータサンプルの作成"""
        print("\n[SAMPLE] Creating detailed NPB contextual data...")
        
        # 選手基本データ
        players = [
            {'name': '村上宗隆', 'team': 'ヤクルト', 'level': 'ichigun', 'age': 24, 'experience': 6, 'position': '三塁'},
            {'name': '吉田正尚', 'team': 'オリックス', 'level': 'ichigun', 'age': 30, 'experience': 9, 'position': '外野'},
            {'name': '山田哲人', 'team': 'ヤクルト', 'level': 'ichigun', 'age': 31, 'experience': 13, 'position': '二塁'},
            {'name': '佐藤輝明', 'team': '阪神', 'level': 'ichigun', 'age': 25, 'experience': 4, 'position': '一塁'},
            {'name': '田中太郎', 'team': '巨人', 'level': 'nigun', 'age': 22, 'experience': 2, 'position': '捕手'},
            {'name': '鈴木次郎', 'team': '中日', 'level': 'nigun', 'age': 20, 'experience': 1, 'position': '遊撃'},
            {'name': '高橋三郎', 'team': '広島', 'level': 'nigun', 'age': 19, 'experience': 1, 'position': '投手'},
            {'name': '渡辺四郎', 'team': '西武', 'level': 'nigun', 'age': 23, 'experience': 3, 'position': '外野'}
        ]
        
        # パフォーマンスデータ生成
        detailed_data = []
        for player in players:
            # 基本成績（レベル調整前）
            base_performance = {
                'name': player['name'],
                'team': player['team'],
                'level': player['level'],
                'age': player['age'],
                'experience': player['experience'],
                'position': player['position'],
                
                # 基本打撃成績
                'PA': np.random.randint(400, 600) if player['level'] == 'ichigun' else np.random.randint(200, 400),
                'H': np.random.randint(80, 160) if player['level'] == 'ichigun' else np.random.randint(40, 100),
                'HR': np.random.randint(5, 40) if player['level'] == 'ichigun' else np.random.randint(1, 15),
                'RBI': np.random.randint(30, 100) if player['level'] == 'ichigun' else np.random.randint(15, 60),
                
                # 進塁打関連データ
                'advancement_hits': np.random.randint(15, 35),      # 進塁打数
                'runners_advanced': np.random.randint(20, 50),      # 進塁させたランナー数
                'sacrifice_bunts': np.random.randint(0, 15),        # 犠牲バント
                'hit_and_run_attempts': np.random.randint(5, 20),   # ヒットエンドラン試行
                'hit_and_run_success': np.random.randint(2, 12),    # ヒットエンドラン成功
                'right_side_hits': np.random.randint(10, 30),       # 右方向打撃
                
                # 状況別データ
                'dome_games': np.random.randint(30, 80),            # ドーム試合数
                'outdoor_games': np.random.randint(40, 90),         # 屋外試合数
                'hot_weather_games': np.random.randint(15, 40),     # 猛暑試合
                'cold_weather_games': np.random.randint(10, 30),    # 寒冷試合
                'high_humidity_games': np.random.randint(20, 50),   # 高湿度試合
                
                # 疲労・連戦データ
                'consecutive_game_2': np.random.randint(20, 60),    # 連戦2試合目出場
                'consecutive_game_3': np.random.randint(10, 30),    # 連戦3試合目出場
                'travel_games': np.random.randint(30, 80),          # 移動試合数
                'rest_days_avg': np.random.uniform(0.5, 2.0),      # 平均休養日数
                
                # 調子・コンディション
                'hot_streak_games': np.random.randint(15, 40),      # 好調期間試合数
                'cold_streak_games': np.random.randint(10, 30),     # 不調期間試合数
                'injury_affected_games': np.random.randint(0, 20)   # 怪我影響試合数
            }
            
            detailed_data.append(base_performance)
        
        df = pd.DataFrame(detailed_data)
        print(f"[OK] Created detailed contextual data for {len(df)} players")
        return df
    
    def calculate_advancement_index(self, df):
        """進塁打指標の計算"""
        print("\n[CALC] Calculating Advancement Index...")
        
        try:
            # 進塁打価値の総計算
            adv_values = self.npb_contextual_params['advancement_values']
            
            df['advancement_score'] = (
                df['advancement_hits'] * adv_values['runner_1st_to_2nd'] +
                df['runners_advanced'] * adv_values['runner_2nd_to_3rd'] +
                df['sacrifice_bunts'] * adv_values['sacrifice_bunt'] +
                df['hit_and_run_success'] * adv_values['hit_and_run_success'] +
                df['right_side_hits'] * adv_values['right_side_hit']
            )
            
            # 打席数で正規化
            df['Advancement_Index'] = (df['advancement_score'] / df['PA']) * 100
            
            print(f"   Advancement Index range: {df['Advancement_Index'].min():.1f} - {df['Advancement_Index'].max():.1f}")
            print("   (Higher = Better at advancing runners)")
            
            return df
            
        except Exception as e:
            print(f"[ERROR] Advancement index calculation failed: {e}")
            return df
    
    def calculate_unified_level_rating(self, df):
        """一軍二軍統合評価システム"""
        print("\n[CALC] Calculating Unified Level Rating System...")
        
        try:
            level_adj = self.npb_contextual_params['level_adjustments']
            
            # 基本能力値計算（レベル未調整）
            df['raw_ability'] = (
                (df['H'] / df['PA']) * 50 +           # 打率要素
                (df['HR'] / df['PA']) * 200 +         # 長打要素
                (df['RBI'] / df['PA']) * 100          # 打点要素
            )
            
            # レベル調整係数の適用
            df['level_adjustment'] = df['level'].map({
                'ichigun': level_adj['ichigun_baseline'],
                'nigun': level_adj['nigun_to_ichigun']
            })
            
            # 経験年数調整
            df['experience_adj'] = np.where(
                df['experience'] <= 2, level_adj['rookie_adjustment'],
                np.where(df['experience'] >= 10, level_adj['veteran_bonus'], 1.0)
            )
            
            # 統合レーティング計算
            df['Unified_Rating'] = df['raw_ability'] * df['level_adjustment'] * df['experience_adj']
            
            # レベル換算表示
            df['Equivalent_Level'] = pd.cut(df['Unified_Rating'], 
                                          bins=[0, 30, 50, 70, 90, 100],
                                          labels=['Development', 'Backup', 'Regular', 'Star', 'Elite'])
            
            print(f"   Unified Rating range: {df['Unified_Rating'].min():.1f} - {df['Unified_Rating'].max():.1f}")
            print("   Level distribution:")
            print(df['Equivalent_Level'].value_counts().to_string())
            
            return df
            
        except Exception as e:
            print(f"[ERROR] Unified level rating calculation failed: {e}")
            return df
    
    def calculate_environmental_adjustments(self, df):
        """環境要因調整の計算"""
        print("\n[CALC] Calculating Environmental Adjustments...")
        
        try:
            env_factors = self.npb_contextual_params['environmental_factors']
            
            # ドーム vs 屋外調整
            dome_ratio = df['dome_games'] / (df['dome_games'] + df['outdoor_games'])
            df['venue_adjustment'] = (
                dome_ratio * env_factors['dome_vs_outdoor']['dome_hitting'] +
                (1 - dome_ratio) * env_factors['dome_vs_outdoor']['outdoor_wind_factor']
            )
            
            # 気温調整
            total_games = df['hot_weather_games'] + df['cold_weather_games'] + \
                         (df['dome_games'] + df['outdoor_games'] - df['hot_weather_games'] - df['cold_weather_games'])
            hot_ratio = df['hot_weather_games'] / total_games
            cold_ratio = df['cold_weather_games'] / total_games
            
            df['temperature_adjustment'] = (
                hot_ratio * env_factors['temperature_effects']['hot_weather_fatigue'] +
                cold_ratio * env_factors['temperature_effects']['cold_weather_power'] +
                (1 - hot_ratio - cold_ratio) * 1.0  # 通常気温
            )
            
            # 湿度調整
            humidity_ratio = df['high_humidity_games'] / total_games
            df['humidity_adjustment'] = (
                humidity_ratio * env_factors['humidity_effects']['high_humidity_factor'] +
                (1 - humidity_ratio) * 1.0
            )
            
            # 環境総合調整係数
            df['Environmental_Factor'] = (
                df['venue_adjustment'] * 
                df['temperature_adjustment'] * 
                df['humidity_adjustment']
            )
            
            print(f"   Environmental Factor range: {df['Environmental_Factor'].min():.3f} - {df['Environmental_Factor'].max():.3f}")
            print("   (1.0 = neutral conditions, <1.0 = adverse conditions)")
            
            return df
            
        except Exception as e:
            print(f"[ERROR] Environmental adjustment calculation failed: {e}")
            return df
    
    def calculate_fatigue_condition_index(self, df):
        """疲労度・コンディション指標の計算"""
        print("\n[CALC] Calculating Fatigue & Condition Index...")
        
        try:
            fatigue_factors = self.npb_contextual_params['fatigue_factors']
            
            # 連戦疲労度
            total_games = df['consecutive_game_2'] + df['consecutive_game_3']
            consecutive_fatigue = (
                (df['consecutive_game_2'] * fatigue_factors['consecutive_games']['2_games'] +
                 df['consecutive_game_3'] * fatigue_factors['consecutive_games']['3_games']) / 
                total_games.replace(0, 1)
            )
            
            # 移動疲労度
            travel_fatigue = (df['travel_games'] / (df['dome_games'] + df['outdoor_games'])) * \
                           fatigue_factors['travel_games']['domestic_travel']
            
            # 休養効果
            rest_effect = np.clip(df['rest_days_avg'] / 2.0, 0.9, 1.1)  # 2日間隔をベースに
            
            # コンディション変動
            condition_variance = (
                (df['hot_streak_games'] * 1.1 + df['cold_streak_games'] * 0.9) /
                (df['hot_streak_games'] + df['cold_streak_games']).replace(0, 1)
            )
            
            # 怪我影響
            injury_impact = 1 - (df['injury_affected_games'] / (df['dome_games'] + df['outdoor_games']) * 0.2)
            
            # 総合疲労・コンディション指標
            df['Fatigue_Condition_Index'] = (
                consecutive_fatigue * 0.3 +
                travel_fatigue * 0.2 +
                rest_effect * 0.2 +
                condition_variance * 0.2 +
                injury_impact * 0.1
            )
            
            print(f"   Fatigue & Condition Index range: {df['Fatigue_Condition_Index'].min():.3f} - {df['Fatigue_Condition_Index'].max():.3f}")
            print("   (Higher = Better condition, lower fatigue)")
            
            return df
            
        except Exception as e:
            print(f"[ERROR] Fatigue condition calculation failed: {e}")
            return df
    
    def calculate_contextual_performance_rating(self, df):
        """総合コンテキスト調整パフォーマンス評価"""
        print("\n[CALC] Calculating Contextual Performance Rating...")
        
        try:
            # 基本パフォーマンス（既に計算済みの指標を使用）
            base_performance = df['Unified_Rating']
            
            # コンテキスト調整の適用
            contextual_rating = (
                base_performance *
                df['Environmental_Factor'] *
                df['Fatigue_Condition_Index'] *
                (1 + df['Advancement_Index'] / 100)  # 進塁打ボーナス
            )
            
            df['Contextual_Performance_Rating'] = contextual_rating
            
            # パフォーマンスランク付け
            df['Performance_Rank'] = pd.cut(df['Contextual_Performance_Rating'],
                                          bins=[0, 40, 60, 80, 100, 150],
                                          labels=['Developing', 'Average', 'Good', 'Excellent', 'Elite'])
            
            print(f"   Contextual Performance Rating range: {df['Contextual_Performance_Rating'].min():.1f} - {df['Contextual_Performance_Rating'].max():.1f}")
            print("   Performance distribution:")
            print(df['Performance_Rank'].value_counts().to_string())
            
            return df
            
        except Exception as e:
            print(f"[ERROR] Contextual performance calculation failed: {e}")
            return df
    
    def create_contextual_visualization(self, df):
        """コンテキスト分析可視化"""
        print("\n[VIZ] Creating Contextual Analysis Visualization...")
        
        try:
            fig = plt.figure(figsize=(20, 16))
            
            # === 1. 一軍二軍統合評価散布図 ===
            ax1 = plt.subplot(2, 3, 1)
            colors = {'ichigun': '#ff6b35', 'nigun': '#004e89'}
            for level in df['level'].unique():
                subset = df[df['level'] == level]
                ax1.scatter(subset['raw_ability'], subset['Unified_Rating'], 
                          c=colors[level], label=f'{level.title()}', alpha=0.7, s=80)
            ax1.plot([0, 100], [0, 100], 'k--', alpha=0.5)
            ax1.set_xlabel('Raw Ability (Level Unadjusted)')
            ax1.set_ylabel('Unified Rating (Level Adjusted)')
            ax1.set_title('Farm-Pro Unified Rating System')
            ax1.legend()
            
            # === 2. 進塁打指標 vs パフォーマンス ===
            ax2 = plt.subplot(2, 3, 2)
            scatter = ax2.scatter(df['Advancement_Index'], df['Contextual_Performance_Rating'],
                                c=df['experience'], cmap='viridis', alpha=0.7, s=80)
            ax2.set_xlabel('Advancement Index')
            ax2.set_ylabel('Contextual Performance Rating')
            ax2.set_title('Advancement Skills vs Overall Performance\n(Color = Experience)')
            plt.colorbar(scatter, ax=ax2, label='Experience (years)')
            
            # === 3. 環境要因影響度ヒートマップ ===
            ax3 = plt.subplot(2, 3, 3)
            env_data = df[['venue_adjustment', 'temperature_adjustment', 'humidity_adjustment']].T
            env_data.columns = [f'Player {i+1}' for i in range(len(df))]
            sns.heatmap(env_data, annot=False, cmap='RdBu_r', center=1.0, ax=ax3, cbar_kws={'shrink': 0.8})
            ax3.set_title('Environmental Factor Impact\n(Red=Adverse, Blue=Favorable)')
            ax3.set_ylabel('Environmental Factors')
            
            # === 4. 疲労度・コンディション分析 ===
            ax4 = plt.subplot(2, 3, 4)
            ax4.scatter(df['rest_days_avg'], df['Fatigue_Condition_Index'],
                       c=df['consecutive_game_3'], cmap='Reds', alpha=0.7, s=80)
            ax4.set_xlabel('Average Rest Days')
            ax4.set_ylabel('Fatigue & Condition Index')
            ax4.set_title('Rest vs Condition\n(Color = 3-Game Streaks)')
            
            # === 5. レベル別パフォーマンス比較 ===
            ax5 = plt.subplot(2, 3, 5)
            level_performance = df.groupby('level')['Contextual_Performance_Rating'].agg(['mean', 'std'])
            x = np.arange(len(level_performance))
            bars = ax5.bar(x, level_performance['mean'], yerr=level_performance['std'],
                          color=['#ff6b35', '#004e89'], alpha=0.7, capsize=5)
            ax5.set_xticks(x)
            ax5.set_xticklabels(['Ichigun', 'Nigun'])
            ax5.set_ylabel('Contextual Performance Rating')
            ax5.set_title('Performance by Level\n(With Standard Deviation)')
            
            # === 6. 総合ランキング ===
            ax6 = plt.subplot(2, 3, 6)
            top_performers = df.nlargest(6, 'Contextual_Performance_Rating')
            bars = ax6.barh(range(len(top_performers)), top_performers['Contextual_Performance_Rating'])
            ax6.set_yticks(range(len(top_performers)))
            ax6.set_yticklabels(top_performers['name'])
            ax6.set_xlabel('Contextual Performance Rating')
            ax6.set_title('Top Performers (Context-Adjusted)')
            
            # 色分け（一軍/二軍）
            for i, (idx, row) in enumerate(top_performers.iterrows()):
                color = '#ff6b35' if row['level'] == 'ichigun' else '#004e89'
                bars[i].set_color(color)
            
            plt.tight_layout()
            plt.savefig('C:/Users/mizut/baseball-ai-media/contextual_npb_analysis.png', 
                       dpi=300, bbox_inches='tight')
            print("[OK] Contextual visualization saved as 'contextual_npb_analysis.png'")
            plt.show()
            
        except Exception as e:
            print(f"[ERROR] Visualization creation failed: {e}")
    
    def generate_contextual_insights(self, df):
        """コンテキスト分析洞察レポート"""
        print("\n[INSIGHTS] Contextual NPB Analytics Insights")
        print("=" * 60)
        
        # === 進塁打分析 ===
        print("\n[FINDING 1] Advancement Skills Analysis")
        top_advancement = df.nlargest(3, 'Advancement_Index')
        avg_advancement = df['Advancement_Index'].mean()
        print(f"   Average Advancement Index: {avg_advancement:.1f}")
        print(f"   Top advancement player: {top_advancement.iloc[0]['name']} ({top_advancement.iloc[0]['Advancement_Index']:.1f})")
        
        # 進塁打と総合成績の相関
        correlation = df['Advancement_Index'].corr(df['Contextual_Performance_Rating'])
        print(f"   Advancement-Performance correlation: {correlation:.3f}")
        
        # === 一軍二軍格差分析 ===
        print("\n[FINDING 2] Farm-Pro Level Gap Analysis")
        ichigun_avg = df[df['level'] == 'ichigun']['Unified_Rating'].mean()
        nigun_avg = df[df['level'] == 'nigun']['Unified_Rating'].mean()
        level_gap = ichigun_avg - nigun_avg
        
        print(f"   Ichigun average rating: {ichigun_avg:.1f}")
        print(f"   Nigun average rating: {nigun_avg:.1f}")
        print(f"   Level gap: {level_gap:.1f} points")
        
        # 二軍選手で一軍レベルの選手を特定
        nigun_players = df[df['level'] == 'nigun']
        promotion_candidates = nigun_players[nigun_players['Unified_Rating'] > nigun_avg + 10]
        if len(promotion_candidates) > 0:
            print(f"   Promotion candidates from Nigun: {len(promotion_candidates)} players")
            for _, player in promotion_candidates.iterrows():
                print(f"     - {player['name']}: {player['Unified_Rating']:.1f} rating")
        
        # === 環境要因影響 ===
        print("\n[FINDING 3] Environmental Impact Analysis")
        env_impact = df['Environmental_Factor'].describe()
        print(f"   Environmental factor range: {env_impact['min']:.3f} - {env_impact['max']:.3f}")
        print(f"   Players with adverse conditions (<0.95): {len(df[df['Environmental_Factor'] < 0.95])}")
        print(f"   Players with favorable conditions (>1.05): {len(df[df['Environmental_Factor'] > 1.05])}")
        
        # === 疲労・コンディション分析 ===
        print("\n[FINDING 4] Fatigue & Condition Impact")
        high_fatigue = df[df['Fatigue_Condition_Index'] < 0.95]
        excellent_condition = df[df['Fatigue_Condition_Index'] > 1.05]
        
        print(f"   High fatigue players: {len(high_fatigue)}")
        print(f"   Excellent condition players: {len(excellent_condition)}")
        
        if len(high_fatigue) > 0:
            print(f"   Highest fatigue: {high_fatigue.nsmallest(1, 'Fatigue_Condition_Index').iloc[0]['name']}")
        
        # === 総合推奨事項 ===
        print("\n[RECOMMENDATIONS] NPB Analytics Implementation")
        print("   1. Implement Advancement Index for tactical evaluation")
        print("   2. Create unified Farm-Pro rating system for player development")
        print("   3. Monitor environmental factors for game strategy")
        print("   4. Track fatigue patterns for rotation optimization")
        print("   5. Use contextual adjustments for fair player comparison")
        print("   6. Identify promotion candidates using cross-level metrics")

def main():
    """メイン実行関数"""
    print("=" * 70)
    print("Contextual NPB Analytics: Advanced Situational Analysis System")
    print("=" * 70)
    
    analyzer = ContextualNPBAnalytics()
    
    # サンプルデータ作成
    print("\n[PHASE 1] Data Generation")
    df = analyzer.create_sample_detailed_data()
    
    # 各種指標計算
    print("\n[PHASE 2] Advanced Metrics Calculation")
    df = analyzer.calculate_advancement_index(df)
    df = analyzer.calculate_unified_level_rating(df)
    df = analyzer.calculate_environmental_adjustments(df)
    df = analyzer.calculate_fatigue_condition_index(df)
    df = analyzer.calculate_contextual_performance_rating(df)
    
    # 結果表示
    print("\n[RESULTS] Top Contextual Performers:")
    display_cols = ['name', 'team', 'level', 'Advancement_Index', 'Unified_Rating', 
                   'Environmental_Factor', 'Fatigue_Condition_Index', 'Contextual_Performance_Rating']
    top_results = df.nlargest(5, 'Contextual_Performance_Rating')[display_cols]
    print(top_results.to_string(index=False))
    
    # 可視化作成
    print("\n[PHASE 3] Visualization")
    analyzer.create_contextual_visualization(df)
    
    # 洞察レポート
    print("\n[PHASE 4] Insights Generation")
    analyzer.generate_contextual_insights(df)
    
    print("\n" + "=" * 70)
    print("[SUCCESS] Contextual NPB Analytics Complete!")
    print("[INNOVATION] 5+ new contextual metrics developed")
    print("[OUTPUT] Advanced situational analysis dashboard created")

if __name__ == "__main__":
    main()