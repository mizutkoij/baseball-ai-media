#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yahoo野球単発テスト - 修正版データ抽出テスト
"""

import requests
from bs4 import BeautifulSoup
import re

def test_yahoo_extraction():
    """Yahooの一球速報データ抽出をテスト"""
    
    # 実際のYahoo野球ゲームURL（過去の試合）
    test_url = "https://baseball.yahoo.co.jp/npb/game/2025030301/score?index=t1b1"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.5'
    }
    
    try:
        print(f"Testing URL: {test_url}")
        
        response = requests.get(test_url, headers=headers, timeout=30)
        response.encoding = response.apparent_encoding
        soup = BeautifulSoup(response.text, 'html.parser')
        
        print(f"Response status: {response.status_code}")
        print(f"Response encoding: {response.encoding}")
        
        # bb-splitsTableを探す
        all_tables = soup.select("table.bb-splitsTable")
        print(f"Found {len(all_tables)} bb-splitsTable elements")
        
        for i, table in enumerate(all_tables):
            print(f"\n=== Table {i+1} ===")
            
            # ヘッダーをチェック
            headers_in_table = [th.text.strip() for th in table.select("thead th")]
            print(f"Headers: {headers_in_table}")
            
            # 投球数、球種、球速、結果があるかチェック
            required = ["投球数", "球種", "球速", "結果"]
            has_required = all(col in str(headers_in_table) for col in required)
            print(f"Has required columns: {has_required}")
            
            if has_required:
                print("✅ This table has the required pitch data columns!")
                
                # データ行をチェック
                rows = table.select("tbody tr")
                print(f"Data rows: {len(rows)}")
                
                for j, row in enumerate(rows[:3]):  # 最初の3行をチェック
                    cells = [td.text.strip() for td in row.select("td")]
                    print(f"Row {j+1}: {cells}")
                    
                    # 投球アイコンがあるかチェック
                    has_ball_icon = bool(row.select_one("td span.bb-icon__ballCircle"))
                    print(f"  Has ball icon: {has_ball_icon}")
        
        # 詳しい投球内容セクションも探してみる
        pitch_section = soup.select_one("section.bb-splits__item:has(h3.bb-head02__title:-soup-contains('詳しい投球内容'))")
        if pitch_section:
            print("\n✅ Found '詳しい投球内容' section!")
            table = pitch_section.select_one("table.bb-splitsTable")
            if table:
                print("✅ Found table in pitch details section!")
        else:
            print("\n❌ '詳しい投球内容' section not found")
            
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_yahoo_extraction()