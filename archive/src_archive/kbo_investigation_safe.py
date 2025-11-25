#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
kbo_investigation_safe.py
=========================
KBOデータソースの安全な調査
"""

import requests
from bs4 import BeautifulSoup
import time
import json
from urllib.parse import urljoin, urlparse
import re

# 丁寧なUser-Agent
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}

# KBOデータソース
SOURCES = {
    'mykbostats': 'https://mykbostats.com',
    'koreabaseball_en': 'https://eng.koreabaseball.com', 
    'koreabaseball_kr': 'https://www.koreabaseball.com'
}

def safe_request(url, timeout=10):
    """安全なHTTPリクエスト"""
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        
        response = session.get(url, timeout=timeout)
        response.raise_for_status()
        return response
        
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error {e.response.status_code}: {url}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Request Error: {e}")
        return None

def investigate_site_safe(name, base_url):
    """サイト構造を安全に調査"""
    print(f"\n" + "="*60)
    print(f"Investigating: {name} ({base_url})")
    print("="*60)
    
    response = safe_request(base_url)
    if not response:
        return None
    
    try:
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # 基本情報
        title = soup.find('title')
        title_text = title.get_text(strip=True) if title else 'No title'
        print(f"Title: {title_text}")
        
        # リンク収集（最初の50個まで）
        links = []
        for a_tag in soup.find_all('a', href=True)[:50]:
            href = a_tag['href']
            text = a_tag.get_text(strip=True)
            if text and len(text) < 100:
                full_url = urljoin(base_url, href)
                links.append({
                    'text': text,
                    'url': full_url,
                    'is_internal': urlparse(full_url).netloc == urlparse(base_url).netloc
                })
        
        # 内部リンク
        internal_links = [link for link in links if link['is_internal']]
        print(f"\nInternal links found: {len(internal_links)}")
        
        # カテゴリ分類
        player_links = []
        team_links = []
        stats_links = []
        
        # より広範囲なキーワード
        player_keywords = ['player', 'roster', 'batter', 'pitcher', 'stats', 'leaders', 'players']
        team_keywords = ['team', 'club', 'teams', 'standings', 'schedule']
        stats_keywords = ['statistics', 'stats', 'standings', 'records', 'leaders', 'rankings']
        
        for link in internal_links:
            text_lower = link['text'].lower()
            url_lower = link['url'].lower()
            
            if any(keyword in text_lower or keyword in url_lower for keyword in player_keywords):
                player_links.append(link)
            elif any(keyword in text_lower or keyword in url_lower for keyword in team_keywords):
                team_links.append(link)
            elif any(keyword in text_lower or keyword in url_lower for keyword in stats_keywords):
                stats_links.append(link)
        
        # 結果表示
        print(f"\nPlayer-related links ({len(player_links)}):")
        for link in player_links[:5]:
            print(f"  - {link['text'][:30]} -> {link['url']}")
            
        print(f"\nTeam-related links ({len(team_links)}):")
        for link in team_links[:5]:
            print(f"  - {link['text'][:30]} -> {link['url']}")
            
        print(f"\nStats-related links ({len(stats_links)}):")
        for link in stats_links[:5]:
            print(f"  - {link['text'][:30]} -> {link['url']}")
        
        # 特徴的なURLパターンを探す
        url_patterns = {}
        for link in internal_links:
            path = urlparse(link['url']).path
            if path and path != '/':
                segments = path.strip('/').split('/')
                if segments:
                    first_segment = segments[0]
                    if first_segment not in url_patterns:
                        url_patterns[first_segment] = []
                    url_patterns[first_segment].append(link['text'][:30])
        
        print(f"\nURL patterns found:")
        for pattern, examples in list(url_patterns.items())[:10]:
            print(f"  /{pattern}/: {', '.join(examples[:3])}")
        
        return {
            'title': title_text,
            'accessible': True,
            'total_links': len(links),
            'internal_links': len(internal_links),
            'player_links': player_links,
            'team_links': team_links,
            'stats_links': stats_links,
            'url_patterns': url_patterns
        }
        
    except Exception as e:
        print(f"Parsing error: {e}")
        return {'accessible': False, 'error': str(e)}

def test_specific_endpoints(base_url):
    """一般的なエンドポイントをテスト"""
    common_endpoints = [
        '/players',
        '/teams',
        '/stats',
        '/standings',
        '/schedule',
        '/roster',
        '/leaders'
    ]
    
    print(f"\nTesting common endpoints for {base_url}:")
    accessible_endpoints = []
    
    for endpoint in common_endpoints:
        url = base_url + endpoint
        response = safe_request(url)
        if response:
            print(f"  ✓ {endpoint} - accessible")
            accessible_endpoints.append(endpoint)
        else:
            print(f"  ✗ {endpoint} - not accessible")
        time.sleep(1)
    
    return accessible_endpoints

def main():
    print("KBO Data Source Investigation")
    print("="*60)
    
    results = {}
    
    # 各サイトを調査
    for name, url in SOURCES.items():
        print(f"\nProcessing: {name}")
        result = investigate_site_safe(name, url)
        
        if result and result.get('accessible'):
            # 追加エンドポイントテスト
            endpoints = test_specific_endpoints(url)
            result['accessible_endpoints'] = endpoints
        
        results[name] = result
        time.sleep(3)  # レート制限
    
    # 結果保存
    output_file = "data/kbo_investigation_results.json"
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False, default=str)
        print(f"\nResults saved to: {output_file}")
    except Exception as e:
        print(f"Could not save results: {e}")
    
    # サマリー
    print(f"\n" + "="*60)
    print("INVESTIGATION SUMMARY")
    print("="*60)
    
    for name, data in results.items():
        if data and data.get('accessible'):
            player_count = len(data.get('player_links', []))
            team_count = len(data.get('team_links', []))
            print(f"{name}:")
            print(f"  - Accessible: YES")
            print(f"  - Player links: {player_count}")
            print(f"  - Team links: {team_count}")
            print(f"  - Common endpoints: {len(data.get('accessible_endpoints', []))}")
        else:
            print(f"{name}: NOT ACCESSIBLE")

if __name__ == "__main__":
    main()