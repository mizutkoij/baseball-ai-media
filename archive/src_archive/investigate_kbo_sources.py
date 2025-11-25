#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
investigate_kbo_sources.py
==========================
KBOデータソースの調査・分析
"""

import requests
from bs4 import BeautifulSoup
import time
import json
from urllib.parse import urljoin, urlparse
import re

# KBOデータソース
SOURCES = {
    'mykbostats': 'https://mykbostats.com',
    'koreabaseball_en': 'https://eng.koreabaseball.com',
    'koreabaseball_kr': 'https://www.koreabaseball.com'
}

def investigate_site(name, base_url):
    """サイト構造を調査"""
    print(f"\n{'='*60}")
    print(f"調査中: {name} ({base_url})")
    print(f"{'='*60}")
    
    try:
        # メインページにアクセス
        response = requests.get(base_url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # 基本情報
        title = soup.find('title')
        print(f"タイトル: {title.get_text(strip=True) if title else 'なし'}")
        
        # ナビゲーション・メニュー構造を調査
        nav_elements = soup.find_all(['nav', 'menu', 'ul'])
        
        # リンク収集
        links = []
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            text = a_tag.get_text(strip=True)
            if text and len(text) < 100:  # 長すぎるテキストは除外
                full_url = urljoin(base_url, href)
                links.append({
                    'text': text,
                    'url': full_url,
                    'is_internal': urlparse(full_url).netloc == urlparse(base_url).netloc
                })
        
        # 内部リンクのみ表示
        internal_links = [link for link in links if link['is_internal']]
        
        print(f"\n主要な内部リンク ({len(internal_links)}個中最初の20個):")
        for i, link in enumerate(internal_links[:20]):
            print(f"  {i+1:2d}. {link['text'][:50]} -> {link['url']}")
        
        # 選手・チーム関連のリンクを特定
        player_related = []
        team_related = []
        stats_related = []
        
        keywords_player = ['player', 'roster', '선수', '로스터', 'batter', 'pitcher']
        keywords_team = ['team', 'club', '팀', '구단']  
        keywords_stats = ['stats', 'statistics', '기록', '통계', 'standings', 'ranking']
        
        for link in internal_links:
            text_lower = link['text'].lower()
            url_lower = link['url'].lower()
            
            if any(keyword in text_lower or keyword in url_lower for keyword in keywords_player):
                player_related.append(link)
            elif any(keyword in text_lower or keyword in url_lower for keyword in keywords_team):
                team_related.append(link)
            elif any(keyword in text_lower or keyword in url_lower for keyword in keywords_stats):
                stats_related.append(link)
        
        if player_related:
            print(f"\n🏃‍♂️ 選手関連リンク ({len(player_related)}個):")
            for link in player_related[:10]:
                print(f"  - {link['text']} -> {link['url']}")
        
        if team_related:
            print(f"\n🏟️ チーム関連リンク ({len(team_related)}個):")
            for link in team_related[:10]:
                print(f"  - {link['text']} -> {link['url']}")
                
        if stats_related:
            print(f"\n📊 統計関連リンク ({len(stats_related)}個):")
            for link in stats_related[:10]:
                print(f"  - {link['text']} -> {link['url']}")
        
        return {
            'title': title.get_text(strip=True) if title else None,
            'total_links': len(links),
            'internal_links': len(internal_links),
            'player_links': player_related,
            'team_links': team_related,
            'stats_links': stats_related,
            'sample_links': internal_links[:20]
        }
        
    except requests.RequestException as e:
        print(f"❌ エラー: {e}")
        return None
    except Exception as e:
        print(f"❌ 解析エラー: {e}")
        return None

def investigate_specific_page(url, description=""):
    """特定のページを詳細調査"""
    print(f"\n🔍 詳細調査: {description}")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # テーブル構造を調査
        tables = soup.find_all('table')
        print(f"テーブル数: {len(tables)}")
        
        for i, table in enumerate(tables[:3]):  # 最初の3つのテーブル
            print(f"\nテーブル {i+1}:")
            headers = table.find_all(['th', 'td'])[:10]  # 最初の10カラム
            if headers:
                header_texts = [h.get_text(strip=True) for h in headers]
                print(f"  ヘッダー例: {header_texts}")
        
        # フォーム要素
        forms = soup.find_all('form')
        if forms:
            print(f"\nフォーム数: {len(forms)}")
            for i, form in enumerate(forms[:2]):
                inputs = form.find_all(['input', 'select'])
                if inputs:
                    input_info = [(inp.get('name', 'unnamed'), inp.get('type', 'unknown')) for inp in inputs[:5]]
                    print(f"  フォーム{i+1}の入力項目: {input_info}")
        
        return True
        
    except Exception as e:
        print(f"❌ 詳細調査エラー: {e}")
        return False

def main():
    print("KBO データソース調査開始")
    print("="*60)
    
    results = {}
    
    # 各サイトを調査
    for name, url in SOURCES.items():
        results[name] = investigate_site(name, url)
        time.sleep(2)  # レート制限
    
    # MyKBOstatsの詳細調査
    if results.get('mykbostats'):
        mykbo_data = results['mykbostats']
        
        # 選手関連ページがあれば詳細調査
        if mykbo_data and mykbo_data.get('player_links'):
            player_link = mykbo_data['player_links'][0]
            investigate_specific_page(player_link['url'], f"選手ページ: {player_link['text']}")
            time.sleep(2)
        
        # チーム関連ページがあれば詳細調査
        if mykbo_data and mykbo_data.get('team_links'):
            team_link = mykbo_data['team_links'][0] 
            investigate_specific_page(team_link['url'], f"チームページ: {team_link['text']}")
    
    # 結果をJSONで保存
    output_file = "data/kbo_source_investigation.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n📄 調査結果を保存: {output_file}")
    
    print(f"\n📋 調査サマリー:")
    for name, data in results.items():
        if data:
            print(f"  {name}: {data['total_links']}リンク, 選手関連{len(data.get('player_links', []))}個")
        else:
            print(f"  {name}: アクセス不可")

if __name__ == "__main__":
    main()