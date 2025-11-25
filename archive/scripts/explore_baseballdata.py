#!/usr/bin/env python3
"""
BaseballData.jp サイト構造調査スクリプト
サイトのURL構造とデータ形式を理解するため
"""
import sys
sys.path.append(".")

import requests
import time
from bs4 import BeautifulSoup
import re
from pathlib import Path

def explore_baseballdata():
    """BaseballData.jpの構造を調査"""
    base_url = "https://baseballdata.jp"
    
    # Basic site structure
    print("=== BaseballData.jp 構造調査 ===\n")
    
    # 1. Homepage analysis
    print("1. ホームページ構造:")
    try:
        r = requests.get(base_url, timeout=10)
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Find navigation links
        nav_links = soup.find_all('a', href=True)
        unique_patterns = set()
        
        for link in nav_links[:50]:  # First 50 links
            href = link.get('href', '')
            if href.startswith('http://baseballdata.jp/') or href.startswith('/'):
                # Extract patterns
                if '/' in href:
                    parts = href.split('/')
                    if len(parts) >= 2:
                        pattern = '/'.join(parts[:3])  # First 2-3 parts
                        unique_patterns.add(pattern)
        
        for pattern in sorted(unique_patterns):
            print(f"  {pattern}")
    
    except Exception as e:
        print(f"  Error: {e}")
    
    # 2. Try common URL patterns
    print("\n2. 一般的なURLパターンをテスト:")
    
    test_urls = [
        f"{base_url}/2025/",
        f"{base_url}/2024/",
        f"{base_url}/teams/",
        f"{base_url}/players/",
        f"{base_url}/roster/",
        f"{base_url}/2025/teams/",
        f"{base_url}/2025/roster/",
        f"{base_url}/2025/players/",
    ]
    
    for url in test_urls:
        try:
            r = requests.get(url, timeout=5)
            status = "✅" if r.status_code == 200 else f"❌ {r.status_code}"
            print(f"  {status} {url}")
            time.sleep(0.5)
        except Exception as e:
            print(f"  ❌ {url} - {str(e)}")
    
    # 3. Player ID patterns
    print("\n3. 選手IDパターンをテスト:")
    
    # Test different player ID formats
    player_patterns = [
        "playerB/2000001.html",  # Format: YYYY###
        "playerB/2020001.html",
        "playerB/2024001.html", 
        "playerB/2025001.html",
        "2025/playerB/2000001.html",  # Year-specific
        "2025/playerB/2020001.html",
        "2025/playerB/2024001.html",
        "2025/playerB/2025001.html",
    ]
    
    for pattern in player_patterns:
        url = f"{base_url}/{pattern}"
        try:
            r = requests.get(url, timeout=5)
            
            # Check if it's a real player page (not error page)
            if r.status_code == 200:
                # Look for actual player data, not error message
                if "ページが見つかりません" not in r.text and len(r.text) > 1000:
                    print(f"  ✅ {pattern} - 有効な選手ページ")
                    
                    # Extract player name if possible
                    soup = BeautifulSoup(r.text, 'html.parser')
                    title = soup.title.string if soup.title else "No title"
                    print(f"     Title: {title}")
                else:
                    print(f"  ❌ {pattern} - エラーページ")
            else:
                print(f"  ❌ {pattern} - HTTP {r.status_code}")
            
            time.sleep(0.5)
        except Exception as e:
            print(f"  ❌ {pattern} - {str(e)}")
    
    # 4. Team pages
    print("\n4. チームページをテスト:")
    
    team_names = ["giants", "tigers", "dragons", "swallows", "carp", "baystars",
                  "hawks", "fighters", "lions", "eagles", "marines", "buffaloes"]
    
    for team in team_names[:4]:  # Test first 4 teams
        for year in [2024, 2025]:
            for page_type in ["roster", "batting", "pitching"]:
                url = f"{base_url}/{year}/{page_type}/{team}.html"
                try:
                    r = requests.get(url, timeout=5)
                    status = "✅" if r.status_code == 200 else f"❌ {r.status_code}"
                    print(f"  {status} {url}")
                    time.sleep(0.3)
                except:
                    print(f"  ❌ {url} - Error")
    
    print("\n=== 調査完了 ===")

if __name__ == "__main__":
    explore_baseballdata()