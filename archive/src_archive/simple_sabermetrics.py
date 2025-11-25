#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
simple_sabermetrics.py
=====================
シンプルなセイバーメトリクス学習スクリプト
"""
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

try:
    import pybaseball as pyb
    print("[OK] pybaseball imported successfully")
except ImportError as e:
    print(f"[ERROR] Failed to import pybaseball: {e}")
    exit(1)

def test_connection():
    """基本接続テスト"""
    print("\n[TEST] Testing pybaseball connection...")
    try:
        data = pyb.batting_stats(2024, 2024)
        print(f"[OK] Connection successful! Got data for {len(data)} players")
        print(f"[INFO] Columns available: {len(data.columns)}")
        return data
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        return None

def analyze_basic_stats(data):
    """基本統計の分析"""
    if data is None:
        return
    
    print("\n[ANALYSIS] Basic statistics analysis")
    
    # 規定打席以上の選手を抽出
    qualified = data[data['PA'] >= 400].copy()
    print(f"[INFO] Qualified players (400+ PA): {len(qualified)}")
    
    if len(qualified) == 0:
        print("[WARNING] No qualified players found")
        return
    
    # 主要指標の表示
    key_stats = ['Name', 'Team', 'AVG', 'OBP', 'SLG', 'OPS']
    available_stats = [col for col in key_stats if col in qualified.columns]
    
    print(f"[INFO] Available stats: {available_stats}")
    
    if len(available_stats) > 2:
        print("\n[TOP10] Top 10 players by OPS:")
        if 'OPS' in qualified.columns:
            top_ops = qualified.nlargest(10, 'OPS')[available_stats]
            print(top_ops.to_string(index=False))

def calculate_simple_woba(data):
    """簡単なwOBA計算"""
    if data is None:
        return
    
    print("\n[CALC] Calculating wOBA manually...")
    
    # 2024 wOBA weights (approximate)
    weights = {
        'BB': 0.69,
        '1B': 0.88, 
        '2B': 1.26,
        '3B': 1.59,
        'HR': 2.06
    }
    
    try:
        df = data.copy()
        
        # Calculate singles if not available
        if '1B' not in df.columns and 'H' in df.columns:
            df['1B'] = df['H'] - df.get('2B', 0) - df.get('3B', 0) - df.get('HR', 0)
        
        # wOBA calculation
        numerator = (
            df.get('BB', 0) * weights['BB'] +
            df.get('1B', 0) * weights['1B'] +
            df.get('2B', 0) * weights['2B'] +
            df.get('3B', 0) * weights['3B'] +
            df.get('HR', 0) * weights['HR']
        )
        
        denominator = (
            df.get('AB', 0) + 
            df.get('BB', 0) + 
            df.get('SF', 0) + 
            df.get('HBP', 0)
        )
        
        df['calc_wOBA'] = numerator / denominator.replace(0, np.nan)
        
        # Compare with official wOBA if available
        if 'wOBA' in df.columns:
            comparison = df[['Name', 'wOBA', 'calc_wOBA']].dropna()
            print(f"[OK] Calculated wOBA for {len(comparison)} players")
            print("\n[COMPARE] Official vs Calculated wOBA (top 5):")
            print(comparison.head().to_string(index=False))
            
            # Calculate average difference
            comparison['diff'] = abs(comparison['wOBA'] - comparison['calc_wOBA'])
            avg_diff = comparison['diff'].mean()
            print(f"[INFO] Average difference: {avg_diff:.4f}")
        else:
            print("[INFO] No official wOBA available for comparison")
            
    except Exception as e:
        print(f"[ERROR] wOBA calculation failed: {e}")

def main():
    """Main function"""
    print("=" * 50)
    print("Pybaseball Sabermetrics Tutorial")
    print("=" * 50)
    
    # Step 1: Test connection
    data = test_connection()
    
    # Step 2: Basic analysis
    analyze_basic_stats(data)
    
    # Step 3: Calculate wOBA
    calculate_simple_woba(data)
    
    print("\n" + "=" * 50)
    print("[DONE] Tutorial completed!")
    print("[NEXT] Try exploring other metrics like FIP, WAR, etc.")

if __name__ == "__main__":
    main()