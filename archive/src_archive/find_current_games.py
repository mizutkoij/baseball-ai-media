#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Find current Yahoo baseball game IDs
"""

import requests
from bs4 import BeautifulSoup
import re

def find_current_games():
    # Get today's and recent game schedules
    urls = [
        "https://baseball.yahoo.co.jp/npb/schedule/",
        "https://baseball.yahoo.co.jp/npb/schedule/?date=2025/08/19",
        "https://baseball.yahoo.co.jp/npb/schedule/?date=2025/08/18"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    found_games = []
    
    for url in urls:
        try:
            print(f"Checking: {url}")
            response = requests.get(url, headers=headers, timeout=30)
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Look for game links
            for link in soup.select("a"):
                href = link.get("href", "")
                if "/game/" in href and re.search(r'/game/(\d+)/', href):
                    game_id = re.search(r'/game/(\d+)/', href).group(1)
                    full_url = f"https://baseball.yahoo.co.jp{href}" if href.startswith('/') else href
                    found_games.append((game_id, full_url))
                    print(f"Found game: {game_id} -> {full_url}")
            
        except Exception as e:
            print(f"Error checking {url}: {e}")
    
    # Remove duplicates
    unique_games = list(set(found_games))
    print(f"\nFound {len(unique_games)} unique games:")
    
    for game_id, url in unique_games[:5]:  # Show first 5
        print(f"Game ID: {game_id}")
        print(f"URL: {url}")
        
        # Test one game for pitch data
        test_url = f"https://baseball.yahoo.co.jp/npb/game/{game_id}/score?index=t1b1"
        try:
            test_response = requests.get(test_url, headers=headers, timeout=20)
            print(f"Test URL {test_url} -> Status: {test_response.status_code}")
            
            if test_response.status_code == 200:
                test_soup = BeautifulSoup(test_response.text, "html.parser")
                tables = test_soup.select("table.bb-splitsTable")
                print(f"  Found {len(tables)} bb-splitsTable elements")
                
                for table in tables:
                    headers_in_table = [th.text.strip() for th in table.select("thead th")]
                    if "投球数" in str(headers_in_table) and "球種" in str(headers_in_table):
                        print(f"  ✅ Found pitch data table with headers: {headers_in_table[:5]}")
                        rows = table.select("tbody tr")
                        print(f"  Data rows: {len(rows)}")
                        
                        if rows:
                            first_row_cells = [td.text.strip() for td in rows[0].select("td")]
                            print(f"  First row sample: {first_row_cells[:5]}")
                        break
                else:
                    print("  ❌ No valid pitch data table found")
            
        except Exception as e:
            print(f"  Error testing: {e}")
        
        print("")
        break  # Test only the first game

if __name__ == "__main__":
    find_current_games()