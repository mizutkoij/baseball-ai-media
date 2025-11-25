#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
npb_sabermetrics.py
==================
NPBデータを使ったセイバーメトリクス計算の実装

Yahoo Sports等の公開データを使用して、
どこまでMLB水準のセイバーメトリクスを再現できるかを検証
"""
import pandas as pd
import numpy as np
import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class NPBSabermetrics:
    """NPB用セイバーメトリクス計算クラス"""
    
    def __init__(self):
        """初期化"""
        print("[INIT] NPB Sabermetrics Calculator initialized")
        
        # NPB環境に調整された係数
        self.npb_constants = {
            'wOBA_weights_2024': {
                'wBB': 0.72,    # NPBは投高環境のため若干高め
                'wHBP': 0.74,   
                'w1B': 0.91,    # 単打の価値がMLBより高い
                'w2B': 1.28,    
                'w3B': 1.61,    
                'wHR': 2.15     # パークファクター考慮
            },
            'FIP_constant_2024': 3.40,  # NPBの防御率環境に合わせて
            'runs_per_win': 9.5,        # NPBでの得点と勝利の関係
            'league_avg_woba': 0.315,   # NPB平均wOBA（推定）
            'woba_scale': 1.24          # wOBAスケール（推定）
        }
        
        self.data_sources = {
            'yahoo_sports': 'https://baseball.yahoo.co.jp/npb/',
            'npb_official': 'https://npb.jp/',
            'baseballdata_jp': 'https://baseballdata.jp/'
        }
        
    def analyze_available_data_sources(self):
        """利用可能なデータソースの分析"""
        print("\n[ANALYSIS] NPB Data Sources Analysis")
        print("=" * 50)
        
        data_source_analysis = {
            'Yahoo Sports NPB': {
                'url': 'https://baseball.yahoo.co.jp/npb/',
                'available_stats': {
                    'batting': ['AVG', 'HR', 'RBI', 'H', 'AB', 'R', 'BB', 'SO', '2B', '3B'],
                    'pitching': ['ERA', 'W', 'L', 'SV', 'IP', 'H', 'ER', 'BB', 'SO', 'HR'],
                    'fielding': ['E', 'PO', 'A', 'FPCT']
                },
                'missing_for_sabermetrics': ['HBP', 'SF', 'IBB', 'SB', 'CS', 'GIDP'],
                'accessibility': 'Public, but requires scraping',
                'update_frequency': 'Real-time during season'
            },
            'NPB Official': {
                'url': 'https://npb.jp/',
                'available_stats': {
                    'batting': ['Basic stats', 'Some advanced stats'],
                    'pitching': ['Basic stats', 'QS', 'CG'],
                    'team_stats': ['Comprehensive team data']
                },
                'missing_for_sabermetrics': ['Detailed plate appearance outcomes'],
                'accessibility': 'Public, structured data limited',
                'update_frequency': 'Daily during season'
            },
            'Baseball-data.jp': {
                'url': 'https://baseballdata.jp/',
                'available_stats': {
                    'batting': ['wOBA', 'wRC+', 'Basic stats'],
                    'pitching': ['FIP', 'WHIP', 'Advanced stats'],
                    'sabermetrics': ['Pre-calculated advanced metrics']
                },
                'missing_for_sabermetrics': ['Raw play-by-play data'],
                'accessibility': 'Public, educational use',
                'update_frequency': 'Periodic updates'
            }
        }
        
        for source, details in data_source_analysis.items():
            print(f"\n[SOURCE] {source}")
            print(f"   URL: {details['url']}")
            print(f"   Accessibility: {details['accessibility']}")
            print(f"   Update: {details['update_frequency']}")
            if 'available_stats' in details:
                for stat_type, stats in details['available_stats'].items():
                    print(f"   {stat_type.title()}: {', '.join(stats)}")
            if 'missing_for_sabermetrics' in details:
                print(f"   Missing: {', '.join(details['missing_for_sabermetrics'])}")
        
        return data_source_analysis
    
    def create_sample_npb_data(self):
        """NPBサンプルデータの作成（実際のデータ構造を模擬）"""
        print("\n[SAMPLE] Creating NPB sample data...")
        
        # 2024年NPB主力選手のサンプルデータ（実際の成績に近似）
        sample_batting_data = {
            'Name': [
                '村上宗隆', '吉田正尚', '山田哲人', '佐藤輝明', '外崎修汰',
                'オコエ瑠偉', '源田壮亮', '山川穂高', '柳田悠岐', '今宮健太'
            ],
            'Team': [
                'ヤクルト', 'オリックス', 'ヤクルト', '阪神', '西武',
                '楽天', '西武', '西武', 'ソフトバンク', 'ソフトバンク'
            ],
            'PA': [600, 550, 580, 520, 480, 450, 490, 510, 470, 440],
            'AB': [520, 480, 500, 460, 420, 400, 430, 450, 410, 390],
            'H': [156, 144, 150, 138, 126, 108, 129, 135, 123, 117],
            'HR': [39, 21, 15, 24, 18, 12, 8, 29, 20, 6],
            '2B': [24, 28, 35, 22, 24, 18, 20, 19, 25, 22],
            '3B': [2, 3, 1, 2, 4, 5, 6, 1, 2, 3],
            'BB': [65, 55, 70, 45, 50, 40, 48, 52, 48, 42],
            'SO': [120, 85, 110, 115, 95, 105, 80, 125, 100, 75],
            'SB': [8, 5, 12, 3, 15, 20, 25, 2, 8, 10],
            'CS': [3, 2, 4, 1, 5, 6, 8, 1, 3, 4],
            'SF': [4, 6, 3, 5, 3, 2, 4, 3, 4, 3],
            'HBP': [8, 4, 5, 6, 4, 3, 5, 2, 4, 2],
            'GIDP': [12, 8, 10, 11, 6, 5, 7, 14, 9, 8]
        }
        
        # DataFrameに変換
        batting_df = pd.DataFrame(sample_batting_data)
        
        # 基本統計の計算
        batting_df['AVG'] = batting_df['H'] / batting_df['AB']
        batting_df['OBP'] = (batting_df['H'] + batting_df['BB'] + batting_df['HBP']) / batting_df['PA']
        
        # 長打率計算のために単打を算出
        batting_df['1B'] = batting_df['H'] - batting_df['2B'] - batting_df['3B'] - batting_df['HR']
        total_bases = batting_df['1B'] + batting_df['2B']*2 + batting_df['3B']*3 + batting_df['HR']*4
        batting_df['SLG'] = total_bases / batting_df['AB']
        batting_df['OPS'] = batting_df['OBP'] + batting_df['SLG']
        
        print(f"[OK] Created sample data for {len(batting_df)} players")
        return batting_df
    
    def calculate_npb_woba(self, batting_data):
        """NPB用wOBA計算"""
        print("\n[CALC] Calculating NPB-adjusted wOBA...")
        
        try:
            df = batting_data.copy()
            weights = self.npb_constants['wOBA_weights_2024']
            
            # 故意四球を除く四球（データがない場合は全四球の95%と仮定）
            df['uBB'] = df['BB'] * 0.95  # NPBでは故意四球が少ない傾向
            
            # wOBA分子の計算
            numerator = (
                df['uBB'] * weights['wBB'] +
                df['HBP'] * weights['wHBP'] +
                df['1B'] * weights['w1B'] +
                df['2B'] * weights['w2B'] +
                df['3B'] * weights['w3B'] +
                df['HR'] * weights['wHR']
            )
            
            # wOBA分母の計算
            denominator = df['AB'] + df['BB'] + df['SF'] + df['HBP']
            
            # wOBA計算
            df['NPB_wOBA'] = numerator / denominator
            
            print(f"[OK] Calculated NPB wOBA for {len(df)} players")
            return df
            
        except Exception as e:
            print(f"[ERROR] NPB wOBA calculation failed: {e}")
            return batting_data
    
    def calculate_npb_wraa(self, batting_data):
        """NPB用wRAA計算"""
        print("\n[CALC] Calculating NPB-adjusted wRAA...")
        
        try:
            df = batting_data.copy()
            
            if 'NPB_wOBA' not in df.columns:
                df = self.calculate_npb_woba(df)
            
            # wRAA = wOBA_scale × (wOBA - lg_wOBA) × PA
            lg_woba = self.npb_constants['league_avg_woba']
            woba_scale = self.npb_constants['woba_scale']
            
            df['NPB_wRAA'] = woba_scale * (df['NPB_wOBA'] - lg_woba) * df['PA']
            
            print(f"[OK] Calculated NPB wRAA for {len(df)} players")
            return df
            
        except Exception as e:
            print(f"[ERROR] NPB wRAA calculation failed: {e}")
            return batting_data
    
    def estimate_simple_npb_war(self, batting_data):
        """簡易NPB WAR推定（利用可能データのみ）"""
        print("\n[CALC] Estimating simplified NPB WAR...")
        
        try:
            df = batting_data.copy()
            
            if 'NPB_wRAA' not in df.columns:
                df = self.calculate_npb_wraa(df)
            
            # 簡易WAR = (wRAA + 走塁推定 + ポジション調整推定 + 代替レベル調整) / runs_per_win
            
            # 走塁価値の簡易推定（盗塁成功率ベース）
            sb_success_rate = df['SB'] / (df['SB'] + df['CS'])
            sb_value = np.where(sb_success_rate > 0.75, df['SB'] * 0.2, df['SB'] * 0.1 - df['CS'] * 0.4)
            
            # ポジション調整（データがないので打席数ベースで簡易推定）
            positional_adj = np.where(df['PA'] > 500, 5, 2)  # レギュラー選手は+5点
            
            # 代替レベル調整（打席数に比例）
            replacement_adj = df['PA'] * 0.02  # PA当たり0.02点の代替レベル調整
            
            # 簡易WAR計算
            total_runs = df['NPB_wRAA'] + sb_value + positional_adj + replacement_adj
            df['Simple_NPB_WAR'] = total_runs / self.npb_constants['runs_per_win']
            
            print(f"[OK] Estimated simplified NPB WAR for {len(df)} players")
            return df
            
        except Exception as e:
            print(f"[ERROR] NPB WAR estimation failed: {e}")
            return batting_data
    
    def create_sample_npb_pitching_data(self):
        """NPB投手サンプルデータの作成"""
        print("\n[SAMPLE] Creating NPB pitching sample data...")
        
        sample_pitching_data = {
            'Name': [
                '山本由伸', '佐々木朗希', '今永昇太', '高橋宏斗', '小川泰弘',
                '伊藤大海', '奥川恭伸', '山崎伊織', '大勢', '岡本和真'
            ],
            'Team': [
                'オリックス', 'ロッテ', 'ベイスターズ', '中日', 'ヤクルト',
                '日本ハム', 'ヤクルト', '巨人', '巨人', '巨人'
            ],
            'IP': [180.1, 165.2, 175.0, 160.0, 145.0, 155.0, 140.0, 130.0, 65.0, 0.0],
            'H': [145, 128, 152, 148, 135, 142, 130, 125, 52, 0],
            'ER': [42, 38, 48, 52, 45, 48, 44, 42, 18, 0],
            'HR': [15, 12, 18, 16, 14, 15, 13, 12, 5, 0],
            'BB': [35, 42, 38, 45, 48, 40, 52, 38, 15, 0],
            'SO': [185, 195, 165, 145, 140, 150, 135, 125, 75, 0],
            'HBP': [8, 6, 5, 7, 6, 8, 9, 4, 2, 0],
            'W': [15, 13, 14, 10, 9, 11, 8, 9, 4, 0],
            'L': [6, 7, 8, 10, 11, 9, 12, 8, 2, 0],
            'SV': [0, 0, 0, 0, 0, 0, 0, 0, 25, 0]
        }
        
        pitching_df = pd.DataFrame(sample_pitching_data)
        
        # 基本統計の計算
        pitching_df['ERA'] = (pitching_df['ER'] * 9) / pitching_df['IP']
        pitching_df['WHIP'] = (pitching_df['H'] + pitching_df['BB']) / pitching_df['IP']
        
        # 先発投手のみフィルタリング（IP > 100）
        pitching_df = pitching_df[pitching_df['IP'] > 100].copy()
        
        print(f"[OK] Created pitching sample data for {len(pitching_df)} pitchers")
        return pitching_df
    
    def calculate_npb_fip(self, pitching_data):
        """NPB用FIP計算"""
        print("\n[CALC] Calculating NPB-adjusted FIP...")
        
        try:
            df = pitching_data.copy()
            
            # NPB用FIP計算
            fip_constant = self.npb_constants['FIP_constant_2024']
            
            fip_numerator = (
                13 * df['HR'] +
                3 * (df['BB'] + df['HBP']) -
                2 * df['SO']
            )
            
            df['NPB_FIP'] = (fip_numerator / df['IP']) + fip_constant
            
            print(f"[OK] Calculated NPB FIP for {len(df)} pitchers")
            return df
            
        except Exception as e:
            print(f"[ERROR] NPB FIP calculation failed: {e}")
            return pitching_data
    
    def analyze_data_limitations(self):
        """データ制約の分析"""
        print("\n[ANALYSIS] Data Limitations for NPB Sabermetrics")
        print("=" * 55)
        
        limitations = {
            'Available with Yahoo/NPB data': {
                'batting': ['wOBA (basic)', 'wRAA (basic)', 'Basic WAR estimation'],
                'pitching': ['FIP', 'Basic rate stats', 'WHIP'],
                'limitations': ['No UZR/DRS', 'No detailed PBP', 'No Statcast equivalent']
            },
            'Requires additional sources': {
                'advanced_fielding': ['UZR', 'DRS', 'Fielding runs'],
                'baserunning': ['UBR', 'Detailed baserunning value'],
                'contextual': ['Leverage index', 'Win probability added'],
                'tracking_data': ['Exit velocity', 'Launch angle', 'Spin rate']
            },
            'NPB-specific adjustments needed': {
                'environment': ['Park factors', 'League offensive levels'],
                'rules': ['DH usage differences', 'Extra innings rules'],
                'cultural': ['Bunting frequency', 'Pitching philosophy'],
                'replacement_level': ['Farm system differences', 'Foreign player limits']
            }
        }
        
        for category, details in limitations.items():
            print(f"\n[{category.upper()}]")
            for subcategory, items in details.items():
                print(f"   {subcategory.title()}: {', '.join(items)}")
        
        return limitations

def main():
    """メイン実行関数"""
    print("=" * 60)
    print("NPB Sabermetrics Implementation Analysis")
    print("=" * 60)
    
    calculator = NPBSabermetrics()
    
    # データソース分析
    calculator.analyze_available_data_sources()
    
    # サンプルデータでのテスト
    print("\n" + "="*25 + " BATTING ANALYSIS " + "="*25)
    batting_data = calculator.create_sample_npb_data()
    
    # NPBセイバーメトリクス計算
    batting_results = calculator.calculate_npb_woba(batting_data)
    batting_results = calculator.calculate_npb_wraa(batting_results)
    batting_results = calculator.estimate_simple_npb_war(batting_results)
    
    # 結果表示
    print("\n[RESULTS] NPB Sabermetrics Results (Top 5 by Simple WAR):")
    display_cols = ['Name', 'Team', 'AVG', 'OPS', 'NPB_wOBA', 'NPB_wRAA', 'Simple_NPB_WAR']
    top_results = batting_results.nlargest(5, 'Simple_NPB_WAR')[display_cols]
    print(top_results.to_string(index=False))
    
    print("\n" + "="*25 + " PITCHING ANALYSIS " + "="*25)
    pitching_data = calculator.create_sample_npb_pitching_data()
    pitching_results = calculator.calculate_npb_fip(pitching_data)
    
    print("\n[RESULTS] NPB Pitching Results (Top 5 by FIP):")
    pitch_display_cols = ['Name', 'Team', 'IP', 'ERA', 'NPB_FIP', 'WHIP']
    top_pitchers = pitching_results.nsmallest(5, 'NPB_FIP')[pitch_display_cols]
    print(top_pitchers.to_string(index=False))
    
    # データ制約分析
    calculator.analyze_data_limitations()
    
    print("\n" + "=" * 60)
    print("[CONCLUSION] NPB Sabermetrics Feasibility Assessment")
    print("=" * 60)
    print("[FEASIBLE] Basic sabermetrics (wOBA, FIP, simple WAR)")
    print("[LIMITED] Advanced metrics require additional data sources")
    print("[NEEDED] NPB-specific parameter adjustments")
    print("[OPPORTUNITY] Significant value in creating NPB sabermetrics tools")

if __name__ == "__main__":
    main()