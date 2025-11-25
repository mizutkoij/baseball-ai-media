#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
comprehensive_sabermetrics.py
============================
包括的なセイバーメトリクス指標の実装と分析

基本指標から高度指標まで、野球分析で使用される
主要なセイバーメトリクス指標を実装・比較する
"""
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

try:
    import pybaseball as pyb
    print("[OK] Comprehensive sabermetrics analysis ready")
except ImportError as e:
    print(f"[ERROR] Failed to import pybaseball: {e}")
    exit(1)

class ComprehensiveSabermetrics:
    """包括的セイバーメトリクス分析クラス"""
    
    def __init__(self):
        """初期化"""
        print("[INIT] Comprehensive Sabermetrics Calculator")
        
        # リーグ環境定数（2024年推定）
        self.league_constants = {
            'mlb': {
                'wOBA_scale': 1.24,
                'lg_wOBA': 0.320,
                'lg_R/PA': 0.115,
                'FIP_constant': 3.20,
                'park_factor': 1.00
            },
            'npb': {
                'wOBA_scale': 1.26,
                'lg_wOBA': 0.315,
                'lg_R/PA': 0.110,
                'FIP_constant': 3.40,
                'park_factor': 1.00
            }
        }
    
    def get_comprehensive_data(self):
        """包括的データの取得"""
        print("\n[DATA] Getting comprehensive MLB data...")
        try:
            # 打撃データ
            batting_data = pyb.batting_stats(2024, 2024)
            qualified_batters = batting_data[batting_data['PA'] >= 400].copy()
            
            # 投手データ
            pitching_data = pyb.pitching_stats(2024, 2024) 
            qualified_pitchers = pitching_data[pitching_data['IP'] >= 100].copy()
            
            print(f"[OK] Batters: {len(qualified_batters)}, Pitchers: {len(qualified_pitchers)}")
            return qualified_batters, qualified_pitchers
            
        except Exception as e:
            print(f"[ERROR] Data retrieval failed: {e}")
            return None, None
    
    def calculate_advanced_batting_metrics(self, batting_data):
        """高度打撃指標の計算"""
        print("\n[CALC] Advanced Batting Metrics")
        print("=" * 40)
        
        df = batting_data.copy()
        lg_constants = self.league_constants['mlb']
        
        try:
            # === Power Metrics ===
            print("[POWER] Power & Contact Metrics")
            
            # ISO (Isolated Power) - 長打力の指標
            if all(col in df.columns for col in ['SLG', 'AVG']):
                df['ISO'] = df['SLG'] - df['AVG']
                print(f"   ISO (Isolated Power): Range {df['ISO'].min():.3f} - {df['ISO'].max():.3f}")
            
            # BABIP (Batting Average on Balls in Play) - 運の指標
            if all(col in df.columns for col in ['H', 'HR', 'AB', 'SO']):
                df['BABIP'] = (df['H'] - df['HR']) / (df['AB'] - df['SO'] - df['HR'])
                print(f"   BABIP (Balls in Play Avg): Range {df['BABIP'].min():.3f} - {df['BABIP'].max():.3f}")
            
            # === Rate Metrics ===
            print("\n[RATE] Plate Discipline Metrics")
            
            # BB% (Walk Rate)
            if all(col in df.columns for col in ['BB', 'PA']):
                df['BB_pct'] = df['BB'] / df['PA'] * 100
                print(f"   BB% (Walk Rate): Range {df['BB_pct'].min():.1f}% - {df['BB_pct'].max():.1f}%")
            
            # K% (Strikeout Rate)
            if all(col in df.columns for col in ['SO', 'PA']):
                df['K_pct'] = df['SO'] / df['PA'] * 100
                print(f"   K% (Strikeout Rate): Range {df['K_pct'].min():.1f}% - {df['K_pct'].max():.1f}%")
            
            # BB/K Ratio
            if all(col in df.columns for col in ['BB', 'SO']):
                df['BB_K_ratio'] = df['BB'] / df['SO'].replace(0, np.nan)
                print(f"   BB/K Ratio: Range {df['BB_K_ratio'].min():.2f} - {df['BB_K_ratio'].max():.2f}")
            
            # === Advanced Value Metrics ===
            print("\n[VALUE] Advanced Value Metrics")
            
            # wRC+ (Weighted Runs Created Plus) - パーク・リーグ調整済み攻撃指標
            if all(col in df.columns for col in ['wOBA', 'PA']):
                wRAA = lg_constants['wOBA_scale'] * (df['wOBA'] - lg_constants['lg_wOBA']) * df['PA']
                league_R_PA = lg_constants['lg_R/PA']
                df['wRC'] = wRAA + (league_R_PA * df['PA'])
                league_wRC = league_R_PA * df['PA']
                df['wRC_plus'] = (df['wRC'] / league_wRC) * 100
                print(f"   wRC+ (Weighted Runs Created+): Range {df['wRC_plus'].min():.0f} - {df['wRC_plus'].max():.0f}")
            
            # === Speed Metrics ===
            print("\n[SPEED] Speed & Baserunning Metrics")
            
            # SB Success Rate
            if all(col in df.columns for col in ['SB', 'CS']):
                total_attempts = df['SB'] + df['CS']
                df['SB_success_rate'] = np.where(total_attempts > 0, df['SB'] / total_attempts, np.nan)
                print(f"   SB Success Rate: Range {df['SB_success_rate'].min():.3f} - {df['SB_success_rate'].max():.3f}")
            
            # Stolen Base Runs (簡易版)
            if all(col in df.columns for col in ['SB', 'CS']):
                df['SB_runs'] = df['SB'] * 0.2 - df['CS'] * 0.4  # 概算値
                print(f"   SB Runs (estimated): Range {df['SB_runs'].min():.1f} - {df['SB_runs'].max():.1f}")
            
            return df
            
        except Exception as e:
            print(f"[ERROR] Advanced batting metrics calculation failed: {e}")
            return batting_data
    
    def calculate_advanced_pitching_metrics(self, pitching_data):
        """高度投手指標の計算"""
        print("\n[CALC] Advanced Pitching Metrics")
        print("=" * 40)
        
        df = pitching_data.copy()
        lg_constants = self.league_constants['mlb']
        
        try:
            # === Expected Performance Metrics ===
            print("[EXPECTED] Expected Performance Metrics")
            
            # xFIP (Expected FIP) - フライボール率を加味したFIP
            if all(col in df.columns for col in ['HR', 'BB', 'HBP', 'SO', 'IP']):
                # MLB平均HR/FB率（約10.5%）を使用
                avg_hr_fb_rate = 0.105
                if 'FB' in df.columns:  # フライボール数がある場合
                    expected_hr = df['FB'] * avg_hr_fb_rate
                else:  # ない場合は簡易推定
                    # 投球回数ベースでフライボール数を推定
                    estimated_fb = df['IP'] * 4.5  # IP当たり約4.5個のフライボール
                    expected_hr = estimated_fb * avg_hr_fb_rate
                
                xfip_numerator = (13 * expected_hr + 3 * (df['BB'] + df['HBP']) - 2 * df['SO'])
                df['xFIP'] = (xfip_numerator / df['IP']) + lg_constants['FIP_constant']
                print(f"   xFIP (Expected FIP): Range {df['xFIP'].min():.2f} - {df['xFIP'].max():.2f}")
            
            # SIERRA (Skill-Interactive ERA) - より高度な予測指標
            if all(col in df.columns for col in ['SO', 'BB', 'IP']):
                # 簡易SIERRA計算
                so_9 = (df['SO'] / df['IP']) * 9
                bb_9 = (df['BB'] / df['IP']) * 9
                df['SIERRA'] = 2.5 + (bb_9 - so_9 * 1.15) * 0.125
                print(f"   SIERRA (Skill-Interactive ERA): Range {df['SIERRA'].min():.2f} - {df['SIERRA'].max():.2f}")
            
            # === Control Metrics ===
            print("\n[CONTROL] Control & Command Metrics")
            
            # K/9 (Strikeouts per 9 innings)
            if all(col in df.columns for col in ['SO', 'IP']):
                df['K_9'] = (df['SO'] / df['IP']) * 9
                print(f"   K/9 (Strikeouts per 9): Range {df['K_9'].min():.1f} - {df['K_9'].max():.1f}")
            
            # BB/9 (Walks per 9 innings)
            if all(col in df.columns for col in ['BB', 'IP']):
                df['BB_9'] = (df['BB'] / df['IP']) * 9
                print(f"   BB/9 (Walks per 9): Range {df['BB_9'].min():.1f} - {df['BB_9'].max():.1f}")
            
            # K/BB Ratio
            if all(col in df.columns for col in ['SO', 'BB']):
                df['K_BB_ratio'] = df['SO'] / df['BB'].replace(0, np.nan)
                print(f"   K/BB Ratio: Range {df['K_BB_ratio'].min():.1f} - {df['K_BB_ratio'].max():.1f}")
            
            # === Efficiency Metrics ===
            print("\n[EFFICIENCY] Efficiency Metrics")
            
            # WHIP (Walks + Hits per Inning Pitched)
            if all(col in df.columns for col in ['BB', 'H', 'IP']):
                df['WHIP'] = (df['BB'] + df['H']) / df['IP']
                print(f"   WHIP: Range {df['WHIP'].min():.2f} - {df['WHIP'].max():.2f}")
            
            # HR/9 (Home Runs per 9 innings)
            if all(col in df.columns for col in ['HR', 'IP']):
                df['HR_9'] = (df['HR'] / df['IP']) * 9
                print(f"   HR/9: Range {df['HR_9'].min():.2f} - {df['HR_9'].max():.2f}")
            
            # LOB% (Left on Base Percentage) - 得点阻止能力
            if all(col in df.columns for col in ['H', 'BB', 'HBP', 'HR', 'ER']):
                runners_on_base = df['H'] + df['BB'] + df['HBP'] - df['HR']
                runs_scored = df['ER']  # 簡易版として自責点を使用
                df['LOB_pct'] = (runners_on_base - runs_scored) / runners_on_base * 100
                df['LOB_pct'] = df['LOB_pct'].clip(0, 100)  # 0-100%の範囲に制限
                print(f"   LOB% (Left on Base %): Range {df['LOB_pct'].min():.1f}% - {df['LOB_pct'].max():.1f}%")
            
            return df
            
        except Exception as e:
            print(f"[ERROR] Advanced pitching metrics calculation failed: {e}")
            return pitching_data
    
    def calculate_situational_metrics(self, batting_data):
        """状況別指標の計算（概念的実装）"""
        print("\n[CALC] Situational Metrics (Conceptual)")
        print("=" * 40)
        
        # 実際にはplay-by-playデータが必要だが、概念を説明
        situational_concepts = {
            'Clutch Hitting': {
                'definition': 'High-leverage situations performance',
                'calculation': 'Performance in close games, late innings',
                'data_needed': 'Play-by-play with game state',
                'npb_feasibility': 'Limited - requires detailed game logs'
            },
            'Leverage Index (LI)': {
                'definition': 'How much a situation affects win probability',
                'calculation': 'Based on inning, score, base/out state',
                'data_needed': 'Win expectancy tables + game state',
                'npb_feasibility': 'Possible with game situation data'
            },
            'Win Probability Added (WPA)': {
                'definition': 'Change in win probability due to player action',
                'calculation': 'Win prob after - win prob before event',
                'data_needed': 'Detailed play-by-play data',
                'npb_feasibility': 'Limited - requires comprehensive PBP'
            },
            'RE24 (Run Expectancy)': {
                'definition': 'Runs above/below expectation in situations',
                'calculation': 'Actual runs - expected runs by base/out state',
                'data_needed': 'Run expectancy matrix + situations',
                'npb_feasibility': 'Possible with basic situation data'
            }
        }
        
        print("[SITUATIONAL] Advanced Situational Metrics:")
        for metric, details in situational_concepts.items():
            print(f"\n   {metric}:")
            print(f"     Definition: {details['definition']}")
            print(f"     NPB Feasibility: {details['npb_feasibility']}")
        
        return situational_concepts
    
    def create_comprehensive_analysis(self, batting_data, pitching_data):
        """包括的分析レポート"""
        print("\n[ANALYSIS] Comprehensive Sabermetrics Analysis")
        print("=" * 50)
        
        # 打者分析
        if batting_data is not None:
            print("\n[BATTING] Top Performers by Different Metrics:")
            
            metrics_to_analyze = {
                'Power': ('ISO', 'Isolated Power'),
                'Plate Discipline': ('BB_K_ratio', 'BB/K Ratio'),
                'Overall Value': ('wRC_plus', 'wRC+'),
                'Speed': ('SB_runs', 'Stolen Base Runs')
            }
            
            for category, (metric, description) in metrics_to_analyze.items():
                if metric in batting_data.columns:
                    top_5 = batting_data.nlargest(5, metric)[['Name', 'Team', metric]]
                    print(f"\n   {category} Leaders ({description}):")
                    print(top_5.to_string(index=False))
        
        # 投手分析
        if pitching_data is not None:
            print("\n[PITCHING] Top Performers by Different Metrics:")
            
            pitching_metrics = {
                'Expected Performance': ('xFIP', 'Expected FIP'),
                'Strikeout Ability': ('K_9', 'K/9'),
                'Control': ('K_BB_ratio', 'K/BB Ratio'),
                'Run Prevention': ('LOB_pct', 'LOB%')
            }
            
            for category, (metric, description) in pitching_metrics.items():
                if metric in pitching_data.columns:
                    if metric in ['xFIP']:  # Lower is better
                        top_5 = pitching_data.nsmallest(5, metric)[['Name', 'Team', metric]]
                    else:  # Higher is better
                        top_5 = pitching_data.nlargest(5, metric)[['Name', 'Team', metric]]
                    print(f"\n   {category} Leaders ({description}):")
                    print(top_5.to_string(index=False))

def main():
    """メイン実行関数"""
    print("=" * 60)
    print("Comprehensive Sabermetrics Analysis")
    print("=" * 60)
    
    analyzer = ComprehensiveSabermetrics()
    
    # データ取得
    batting_data, pitching_data = analyzer.get_comprehensive_data()
    
    if batting_data is not None:
        # 高度打撃指標の計算
        batting_results = analyzer.calculate_advanced_batting_metrics(batting_data)
    else:
        batting_results = None
    
    if pitching_data is not None:
        # 高度投手指標の計算
        pitching_results = analyzer.calculate_advanced_pitching_metrics(pitching_data)
    else:
        pitching_results = None
    
    # 状況別指標の概念
    situational_concepts = analyzer.calculate_situational_metrics(batting_data)
    
    # 包括的分析
    analyzer.create_comprehensive_analysis(batting_results, pitching_results)
    
    print("\n" + "=" * 60)
    print("[SUMMARY] Comprehensive Metrics Overview")
    print("=" * 60)
    print("[POWER] ISO, SLG, HR rate")
    print("[CONTACT] BABIP, K%, BB%") 
    print("[VALUE] wRC+, wRAA, OPS+")
    print("[PITCHING] xFIP, SIERRA, K/BB")
    print("[SITUATIONAL] Clutch, Leverage, WPA")
    print("[NPB POTENTIAL] Most basic metrics feasible with public data")

if __name__ == "__main__":
    main()