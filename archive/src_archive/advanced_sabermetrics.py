#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
advanced_sabermetrics.py
========================
FIPとWAR構成要素の詳細分析
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

try:
    import pybaseball as pyb
    print("[OK] pybaseball imported successfully")
except ImportError as e:
    print(f"[ERROR] Failed to import pybaseball: {e}")
    exit(1)

class AdvancedSabermetrics:
    """高度なセイバーメトリクス分析"""
    
    def __init__(self):
        self.pitching_data = None
        self.batting_data = None
        
    def get_pitching_data(self, year=2024):
        """投手データの取得"""
        print(f"\n[DATA] Getting {year} pitching data...")
        try:
            self.pitching_data = pyb.pitching_stats(year, year)
            print(f"[OK] Retrieved data for {len(self.pitching_data)} pitchers")
            print(f"[INFO] Available columns: {len(self.pitching_data.columns)}")
            
            # 最低投球回数でフィルタリング
            qualified = self.pitching_data[self.pitching_data['IP'] >= 100]
            print(f"[INFO] Qualified pitchers (100+ IP): {len(qualified)}")
            
            return self.pitching_data
        except Exception as e:
            print(f"[ERROR] Failed to get pitching data: {e}")
            return None
    
    def calculate_fip_manually(self):
        """FIPの手動計算"""
        if self.pitching_data is None:
            print("[ERROR] No pitching data available")
            return
        
        print("\n[CALC] Calculating FIP manually...")
        
        # 2024年のFIP定数（おおよその値）
        FIP_CONSTANT = 3.20
        
        try:
            df = self.pitching_data.copy()
            
            # FIP計算式: (13×HR + 3×(BB+HBP) - 2×K) / IP + FIP_CONSTANT
            fip_numerator = (
                13 * df.get('HR', 0) + 
                3 * (df.get('BB', 0) + df.get('HBP', 0)) - 
                2 * df.get('SO', 0)  # SOは奪三振
            )
            
            # 投球回数でゼロ除算を避ける
            df['calc_FIP'] = (fip_numerator / df['IP'].replace(0, np.nan)) + FIP_CONSTANT
            
            # 公式FIPと比較
            if 'FIP' in df.columns:
                comparison = df[['Name', 'Team', 'IP', 'ERA', 'FIP', 'calc_FIP']].dropna()
                comparison = comparison[comparison['IP'] >= 50]  # 50回以上
                
                print(f"[OK] Calculated FIP for {len(comparison)} pitchers")
                print("\n[COMPARE] ERA vs FIP vs Calculated FIP (top 10 by FIP):")
                top_fip = comparison.nsmallest(10, 'FIP')
                print(top_fip.to_string(index=False))
                
                # 差異の分析
                comparison['fip_diff'] = abs(comparison['FIP'] - comparison['calc_FIP'])
                avg_diff = comparison['fip_diff'].mean()
                print(f"\n[INFO] Average FIP calculation difference: {avg_diff:.4f}")
                
                # ERA vs FIP の乖離を分析
                comparison['era_fip_diff'] = comparison['ERA'] - comparison['FIP']
                print(f"[INFO] Average ERA-FIP difference: {comparison['era_fip_diff'].mean():.3f}")
                
                # 最大の乖離を示す投手
                print("\n[ANALYSIS] Pitchers with biggest ERA-FIP differences:")
                print("--- ERA much higher than FIP (unlucky/bad defense) ---")
                unlucky = comparison.nlargest(5, 'era_fip_diff')[['Name', 'Team', 'ERA', 'FIP', 'era_fip_diff']]
                print(unlucky.to_string(index=False))
                
                print("\n--- ERA much lower than FIP (lucky/good defense) ---")
                lucky = comparison.nsmallest(5, 'era_fip_diff')[['Name', 'Team', 'ERA', 'FIP', 'era_fip_diff']]
                print(lucky.to_string(index=False))
                
            else:
                print("[WARNING] No official FIP data available for comparison")
                
        except Exception as e:
            print(f"[ERROR] FIP calculation failed: {e}")
    
    def explain_fip_components(self):
        """FIP構成要素の解説"""
        if self.pitching_data is None:
            return
            
        print("\n[EXPLAIN] FIP Components Analysis")
        print("=" * 50)
        
        # 規定投球回の投手のみ
        qualified = self.pitching_data[self.pitching_data['IP'] >= 100].copy()
        
        if len(qualified) == 0:
            print("[WARNING] No qualified pitchers found")
            return
        
        print("FIP = (13×HR + 3×(BB+HBP) - 2×K) / IP + Constant")
        print("\nWhy these weights?")
        print("- Home Runs (13): Most damaging outcome for pitcher")
        print("- Walks + HBP (3): Give runners free bases")  
        print("- Strikeouts (-2): Best outcome for pitcher")
        print("- Constant: Adjusts scale to match ERA")
        
        # 各構成要素の分析
        components = ['HR', 'BB', 'HBP', 'SO']
        available_components = [c for c in components if c in qualified.columns]
        
        if available_components:
            print(f"\n[STATS] Component averages (qualified pitchers):")
            for comp in available_components:
                avg_val = qualified[comp].mean()
                per_9 = (avg_val / qualified['IP'].mean()) * 9
                print(f"   {comp}: {avg_val:.1f} total, {per_9:.2f} per 9 innings")
    
    def analyze_war_components(self):
        """WAR構成要素の分析"""
        print("\n[WAR] WAR Components Analysis")
        print("=" * 50)
        
        # 打者のWAR分析
        if self.batting_data is None:
            print("[INFO] Getting batting data for WAR analysis...")
            self.batting_data = pyb.batting_stats(2024, 2024)
        
        if self.batting_data is not None:
            qualified_batters = self.batting_data[self.batting_data['PA'] >= 400].copy()
            
            print(f"[INFO] Analyzing WAR for {len(qualified_batters)} qualified batters")
            
            # WAR関連の列を確認
            war_related_cols = [col for col in qualified_batters.columns 
                              if any(term in col.lower() for term in ['war', 'runs', 'off', 'def', 'pos'])]
            
            print(f"[INFO] WAR-related columns available: {len(war_related_cols)}")
            
            if 'WAR' in qualified_batters.columns:
                print("\n[TOP] Top 10 players by WAR:")
                war_leaders = qualified_batters.nlargest(10, 'WAR')
                
                # 表示する列を選択
                display_cols = ['Name', 'Team', 'WAR']
                if 'Off' in qualified_batters.columns:
                    display_cols.append('Off')  # 攻撃貢献
                if 'Def' in qualified_batters.columns:
                    display_cols.append('Def')  # 守備貢献
                
                available_display_cols = [col for col in display_cols if col in qualified_batters.columns]
                print(war_leaders[available_display_cols].to_string(index=False))
                
                # WAR分布の分析
                print(f"\n[STATS] WAR distribution:")
                print(f"   Average WAR: {qualified_batters['WAR'].mean():.2f}")
                print(f"   Median WAR: {qualified_batters['WAR'].median():.2f}")
                print(f"   Max WAR: {qualified_batters['WAR'].max():.2f}")
                print(f"   Min WAR: {qualified_batters['WAR'].min():.2f}")
                
                # WAR tiers
                print(f"\n[TIERS] WAR value interpretation:")
                print(f"   Excellent (6+ WAR): {len(qualified_batters[qualified_batters['WAR'] >= 6])} players")
                print(f"   Great (4-6 WAR): {len(qualified_batters[(qualified_batters['WAR'] >= 4) & (qualified_batters['WAR'] < 6)])} players")
                print(f"   Good (2-4 WAR): {len(qualified_batters[(qualified_batters['WAR'] >= 2) & (qualified_batters['WAR'] < 4)])} players")
                print(f"   Average (0-2 WAR): {len(qualified_batters[(qualified_batters['WAR'] >= 0) & (qualified_batters['WAR'] < 2)])} players")
                print(f"   Below Average (<0 WAR): {len(qualified_batters[qualified_batters['WAR'] < 0])} players")
    
    def explain_war_formula(self):
        """WAR計算式の解説"""
        print("\n[EXPLAIN] WAR Formula Breakdown")
        print("=" * 50)
        
        print("Hitter WAR = (Batting + Baserunning + Fielding + Positional + League + Replacement) / Runs Per Win")
        print("\nComponents:")
        print("1. Batting Runs: Based on wOBA and league context")
        print("2. Baserunning Runs: Stolen bases, advancement, etc.")
        print("3. Fielding Runs: Defensive value (UZR, DRS)")
        print("4. Positional Adjustment: Value by position")
        print("5. League Adjustment: AL vs NL differences")
        print("6. Replacement Level: Baseline for comparison")
        print("7. Runs Per Win: ~10 runs = 1 win")
        
        print("\nWhy WAR is complex:")
        print("- Requires detailed tracking data")
        print("- Multiple methodologies (fWAR, bWAR, etc.)")
        print("- Position and era adjustments")
        print("- Different replacement level assumptions")
        
        print("\nThis is why we usually use pre-calculated WAR values!")

def main():
    """メイン実行関数"""
    print("=" * 60)
    print("Advanced Sabermetrics: FIP and WAR Deep Dive")
    print("=" * 60)
    
    analyzer = AdvancedSabermetrics()
    
    # FIP分析
    print("\n" + "="*30 + " FIP ANALYSIS " + "="*30)
    pitching_data = analyzer.get_pitching_data(2024)
    if pitching_data is not None:
        analyzer.calculate_fip_manually()
        analyzer.explain_fip_components()
    
    # WAR分析  
    print("\n" + "="*30 + " WAR ANALYSIS " + "="*30)
    analyzer.analyze_war_components()
    analyzer.explain_war_formula()
    
    print("\n" + "=" * 60)
    print("[DONE] Advanced analysis completed!")
    print("[INSIGHT] FIP isolates pitcher skill by removing defense/luck")
    print("[INSIGHT] WAR combines all aspects of player value")
    print("[NEXT] Try applying these concepts to NPB data")

if __name__ == "__main__":
    main()