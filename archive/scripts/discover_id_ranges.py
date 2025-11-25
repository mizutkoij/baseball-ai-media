#!/usr/bin/env python3
"""
BaseballData.jp プレイヤーID範囲発見スクリプト
効率的に有効なID範囲を特定
"""
import sys
sys.path.append(".")

import requests
import time
from concurrent.futures import ThreadPoolExecutor
import threading

# スレッドセーフなカウンター
found_count = 0
count_lock = threading.Lock()

def quick_test_id(player_id, pos='B'):
    """高速でIDの有効性をテスト"""
    global found_count
    
    url = f"https://baseballdata.jp/player{pos}/{player_id}.html"
    
    try:
        r = requests.get(url, timeout=5)
        
        if r.status_code == 200 and len(r.text) > 5000:  # エラーページは短い
            with count_lock:
                found_count += 1
            return player_id
        
        return None
    
    except:
        return None

def discover_year_ranges():
    """年代別の有効ID範囲を発見"""
    print("=== BaseballData.jp プレイヤーID範囲発見 ===\n")
    
    # 1. 年代別サンプリング
    print("1. 年代別サンプリング (各年の最初の5個をテスト):")
    
    valid_years = []
    
    # 幅広い年代をテスト
    test_years = list(range(1950, 2025, 5))  # 5年間隔
    
    for year in test_years:
        print(f"年 {year}: ", end="", flush=True)
        
        # 各年の最初の5個をテスト
        test_ids = [f"{year}{i:03d}" for i in range(1, 6)]
        
        with ThreadPoolExecutor(max_workers=3) as executor:
            results = list(executor.map(quick_test_id, test_ids))
        
        valid_in_year = [r for r in results if r is not None]
        
        if valid_in_year:
            print(f"✅ {len(valid_in_year)}個 ({valid_in_year})")
            valid_years.append(year)
        else:
            print("❌")
        
        time.sleep(0.5)
    
    print(f"\n有効な年代: {valid_years}")
    
    # 2. 有効年代の詳細探索
    print(f"\n2. 有効年代の詳細探索:")
    
    all_valid_ids = []
    
    for year in valid_years[:3]:  # 最初の3年代のみ詳細探索
        print(f"\n{year}年の詳細探索 (001-050):")
        
        test_ids = [f"{year}{i:03d}" for i in range(1, 51)]
        
        # バッチで処理
        batch_size = 10
        for i in range(0, len(test_ids), batch_size):
            batch = test_ids[i:i+batch_size]
            
            with ThreadPoolExecutor(max_workers=5) as executor:
                results = list(executor.map(quick_test_id, batch))
            
            valid_batch = [r for r in results if r is not None]
            all_valid_ids.extend(valid_batch)
            
            if valid_batch:
                print(f"  {i+1:03d}-{i+batch_size:03d}: ✅ {valid_batch}")
            else:
                print(f"  {i+1:03d}-{i+batch_size:03d}: ❌")
            
            time.sleep(0.3)
    
    # 3. 特殊パターンの探索
    print(f"\n3. 特殊パターン探索:")
    
    # 3桁以外のパターン
    special_patterns = [
        # 4桁パターン
        [f"20{year}{i:02d}" for year in range(20, 26) for i in range(1, 6)],
        # 年号 + 長い番号
        [f"2000{i:03d}" for i in range(100, 201, 20)],
        # その他の可能性
        [f"195{i}" for i in range(1001, 1021)],
    ]
    
    for pattern_name, pattern_ids in zip(
        ["4桁年号+2桁", "2000+3桁", "195x+4桁"], 
        special_patterns
    ):
        print(f"\n{pattern_name}パターン:")
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(quick_test_id, pattern_ids[:20]))  # 最初の20個のみ
        
        valid_special = [r for r in results if r is not None]
        
        if valid_special:
            print(f"  ✅ {valid_special}")
            all_valid_ids.extend(valid_special)
        else:
            print(f"  ❌ 有効なIDなし")
    
    print(f"\n=== 発見完了 ===")
    print(f"総発見ID数: {len(all_valid_ids)}")
    print(f"発見されたID: {sorted(all_valid_ids)[:20]}...")  # 最初の20個表示

if __name__ == "__main__":
    discover_year_ranges()