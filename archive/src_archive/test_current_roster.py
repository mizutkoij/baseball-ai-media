#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_current_roster.py
=====================
NPB現役選手名簿からの実データ収集テスト
"""

import requests
from bs4 import BeautifulSoup
import time
import json
from urllib.parse import urljoin

BASE_URL = "https://npb.jp"

# NPBチームコード（提供された情報）
TEAM_CODES = ['g', 't', 'c', 'db', 'd', 's', 'h', 'f', 'm', 'l', 'b', 'e']

# チーム名マッピング
TEAM_NAMES = {
    'g': '読売ジャイアンツ',
    't': '阪神タイガース', 
    'c': '広島東洋カープ',
    'db': '横浜DeNAベイスターズ',
    'd': '中日ドラゴンズ',
    's': '東京ヤクルトスワローズ',
    'h': '福岡ソフトバンクホークス',
    'f': '北海道日本ハムファイターズ',
    'm': '千葉ロッテマリーンズ',
    'l': '埼玉西武ライオンズ',
    'b': 'オリックス・バファローズ',
    'e': '東北楽天ゴールデンイーグルス'
}

def test_roster_page(team_code):
    """指定チームの名簿ページをテスト"""
    roster_url = f"{BASE_URL}/bis/teams/rst_{team_code}.html"
    print(f"\nTesting roster page: {roster_url}")
    print(f"Team: {TEAM_NAMES.get(team_code, 'Unknown')} ({team_code})")
    
    try:
        response = requests.get(roster_url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # ページタイトル確認
        title = soup.find('title')
        if title:
            print(f"Page title: {title.get_text(strip=True)}")
        
        # 選手名を含む可能性のある要素を探す
        player_links = []
        
        # 一般的な選手リンクパターンを探す
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            if '/bis/players/' in href and href.endswith('.html'):
                player_name = a_tag.get_text(strip=True)
                if player_name:  # 空でない名前
                    full_url = urljoin(BASE_URL, href)
                    player_links.append({
                        'name': player_name,
                        'url': full_url,
                        'team': TEAM_NAMES.get(team_code, team_code)
                    })
        
        print(f"Found {len(player_links)} player links")
        
        # 最初の5人を表示
        for i, player in enumerate(player_links[:5]):
            print(f"  {i+1}. {player['name']} -> {player['url']}")
        
        if len(player_links) > 5:
            print(f"  ... and {len(player_links) - 5} more players")
            
        return player_links
        
    except requests.RequestException as e:
        print(f"Error fetching {roster_url}: {e}")
        return []

def main():
    print("NPB Current Roster Data Collection Test")
    print("=" * 50)
    
    all_current_players = []
    
    # 最初のいくつかのチームをテスト
    test_teams = ['g', 't', 'h']  # ジャイアンツ、タイガース、ホークス
    
    for team_code in test_teams:
        players = test_roster_page(team_code)
        for player in players:
            player['team_code'] = team_code
        all_current_players.extend(players)
        time.sleep(2)  # レート制限
    
    print(f"\n" + "=" * 50)
    print("SUMMARY:")
    print(f"Total current players found: {len(all_current_players)}")
    
    # チーム別サマリー
    for team_code in test_teams:
        team_players = [p for p in all_current_players if p['team_code'] == team_code]
        print(f"  {TEAM_NAMES.get(team_code)}: {len(team_players)} players")
    
    # 結果をJSONで保存
    output_file = "data/test_current_roster_results.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'collection_date': '2025-08-17',
            'teams_tested': test_teams,
            'total_players': len(all_current_players),
            'players': all_current_players
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\nResults saved to: {output_file}")

if __name__ == "__main__":
    main()