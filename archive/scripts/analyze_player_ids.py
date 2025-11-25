#!/usr/bin/env python3
"""
BaseballData.jp プレイヤーID規則性分析スクリプト
既知のプレイヤーIDから規則性を解析
"""
import sys
sys.path.append(".")

import requests
import time
import re
from bs4 import BeautifulSoup
from collections import defaultdict

def test_player_id(player_id, pos='B'):
    """指定のプレイヤーIDが有効かテスト"""
    url = f"https://baseballdata.jp/player{pos}/{player_id}.html"
    
    try:
        r = requests.get(url, timeout=10)
        
        if r.status_code == 200:
            # エラーページでないかチェック
            if "ページが見つかりません" not in r.text and len(r.text) > 1000:
                # プレイヤー名を抽出を試行
                soup = BeautifulSoup(r.text, 'html.parser')
                title = soup.title.string if soup.title else ""
                
                # エンコーディング問題を避けて基本情報のみ
                return {
                    'valid': True,
                    'url': url,
                    'title_length': len(title),
                    'content_length': len(r.text)
                }
        
        return {'valid': False, 'status': r.status_code}
    
    except Exception as e:
        return {'valid': False, 'error': str(e)}

def analyze_id_patterns():
    """既知IDから規則性を分析"""
    print("=== BaseballData.jp プレイヤーID規則性分析 ===\n")
    
    # 既知の有効なID
    known_ids = [
        "1860140",  # 提供された例
        "1750321",  # 提供された例  
        "2000001",  # 探索で発見
    ]
    
    print("1. 既知IDの詳細分析:")
    valid_ids = []
    
    for player_id in known_ids:
        print(f"\nID: {player_id}")
        result = test_player_id(player_id)
        
        if result['valid']:
            valid_ids.append(player_id)
            print(f"  ✅ 有効 - Content: {result['content_length']} chars")
            
            # ID構造を分析
            if len(player_id) == 7:
                prefix = player_id[:4]
                suffix = player_id[4:]
                print(f"  構造: {prefix}-{suffix}")
                
                # 年号の可能性をチェック
                try:
                    year_candidate = int(prefix)
                    if 1800 <= year_candidate <= 2030:
                        print(f"  可能な年: {year_candidate} (明治{year_candidate-1867}年 or 西暦)")
                except:
                    pass
        else:
            print(f"  ❌ 無効 - {result}")
        
        time.sleep(0.5)
    
    # 2. パターン推測と検証
    print(f"\n2. パターン仮説の検証:")
    
    if valid_ids:
        # 年号パターンを推測
        year_patterns = []
        for vid in valid_ids:
            if len(vid) == 7:
                prefix = vid[:4]
                try:
                    year_num = int(prefix)
                    year_patterns.append(year_num)
                except:
                    pass
        
        if year_patterns:
            print(f"検出された年パターン: {sorted(set(year_patterns))}")
            
            # 近年のパターンを試す
            test_years = [1990, 2000, 2010, 2015, 2020, 2021, 2022, 2023, 2024]
            
            for year in test_years:
                print(f"\n{year}年パターンテスト:")
                found_any = False
                
                # 各年で最初の数個をテスト
                for num in range(1, 6):
                    test_id = f"{year}{num:03d}"
                    result = test_player_id(test_id)
                    
                    if result['valid']:
                        print(f"  ✅ {test_id}")
                        found_any = True
                    
                    time.sleep(0.3)
                
                if not found_any:
                    print(f"  ❌ {year}年パターンで有効なIDなし")
    
    # 3. 数値範囲探索
    print(f"\n3. 有効なID範囲探索:")
    
    # 既知IDの周辺を探索
    for base_id in valid_ids:
        if len(base_id) == 7:
            base_num = int(base_id)
            print(f"\nID {base_id} 周辺探索:")
            
            # 前後10個をテスト
            for offset in range(-5, 6):
                test_num = base_num + offset
                test_id = f"{test_num:07d}"
                
                result = test_player_id(test_id)
                if result['valid']:
                    print(f"  ✅ {test_id}")
                
                time.sleep(0.2)
    
    print("\n=== 分析完了 ===")

if __name__ == "__main__":
    analyze_id_patterns()