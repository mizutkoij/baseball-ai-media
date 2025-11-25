#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
kbo_alternative_sources.py
===========================
KBOデータの代替ソース調査
"""

import requests
from bs4 import BeautifulSoup
import time
import json

# 丁寧なUser-Agent
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
}

# 代替KBOデータソース
ALTERNATIVE_SOURCES = {
    'wikipedia_kbo': 'https://en.wikipedia.org/wiki/KBO_League',
    'wikipedia_kbo_teams': 'https://en.wikipedia.org/wiki/List_of_KBO_League_teams',
    'wikipedia_kbo_2024': 'https://en.wikipedia.org/wiki/2024_KBO_League_season',
    'baseball_reference_kbo': 'https://www.baseball-reference.com/register/league.cgi?code=KBO',
    'fangraphs_intl': 'https://www.fangraphs.com/international',
    'espn_kbo': 'https://www.espn.com/baseball/leagues',
}

def safe_request(url, timeout=15):
    """安全なHTTPリクエスト"""
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        
        response = session.get(url, timeout=timeout)
        response.raise_for_status()
        return response
        
    except requests.exceptions.RequestException as e:
        print(f"Request failed for {url}: {e}")
        return None

def extract_kbo_info_from_wikipedia(url, page_type):
    """Wikipediaからの情報抽出"""
    print(f"\nChecking Wikipedia: {page_type}")
    print(f"URL: {url}")
    
    response = safe_request(url)
    if not response:
        return None
    
    try:
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # タイトル
        title = soup.find('h1', {'class': 'firstHeading'})
        title_text = title.get_text(strip=True) if title else 'No title'
        print(f"Page title: {title_text}")
        
        # テーブル抽出
        tables = soup.find_all('table', {'class': 'wikitable'})
        print(f"Tables found: {len(tables)}")
        
        extracted_data = {'title': title_text, 'tables': []}
        
        for i, table in enumerate(tables[:3]):  # 最初の3つのテーブル
            print(f"\nTable {i+1}:")
            
            # ヘッダー行
            headers = []
            header_row = table.find('tr')
            if header_row:
                for th in header_row.find_all(['th', 'td']):
                    header_text = th.get_text(strip=True)
                    headers.append(header_text)
                print(f"  Headers: {headers[:6]}")  # 最初の6カラム
            
            # データ行（最初の5行）
            rows = table.find_all('tr')[1:6]  # ヘッダーをスキップして5行
            table_data = []
            
            for row in rows:
                cells = []
                for td in row.find_all(['td', 'th']):
                    cell_text = td.get_text(strip=True)
                    cells.append(cell_text)
                if cells:
                    table_data.append(cells)
                    print(f"  Row: {cells[:6]}")  # 最初の6カラム
            
            extracted_data['tables'].append({
                'headers': headers,
                'data': table_data[:5]  # 最初の5行のみ保存
            })
        
        # KBOチーム名を探す
        kbo_teams = []
        team_patterns = [
            'Doosan Bears', 'KT Wiz', 'LG Twins', 'NC Dinos', 'Samsung Lions',
            'SSG Landers', 'Lotte Giants', 'Hanwha Eagles', 'Kia Tigers', 'KIA Tigers'
        ]
        
        page_text = soup.get_text()
        for pattern in team_patterns:
            if pattern in page_text:
                kbo_teams.append(pattern)
        
        print(f"KBO teams mentioned: {kbo_teams}")
        extracted_data['teams_found'] = kbo_teams
        
        return extracted_data
        
    except Exception as e:
        print(f"Error parsing Wikipedia page: {e}")
        return None

def check_baseball_reference_kbo():
    """Baseball Referenceの国際リーグページをチェック"""
    print(f"\nChecking Baseball Reference International")
    
    # より一般的なURLを試す
    urls_to_try = [
        'https://www.baseball-reference.com/register/',
        'https://www.baseball-reference.com/international/',
        'https://www.baseball-reference.com/leagues/'
    ]
    
    for url in urls_to_try:
        print(f"Trying: {url}")
        response = safe_request(url)
        if response:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # "KBO"を含むリンクを探す
            kbo_links = []
            for a_tag in soup.find_all('a', href=True):
                text = a_tag.get_text(strip=True)
                if 'KBO' in text.upper() or 'Korea' in text:
                    kbo_links.append({
                        'text': text,
                        'url': a_tag['href']
                    })
            
            if kbo_links:
                print(f"Found KBO-related links:")
                for link in kbo_links[:5]:
                    print(f"  - {link['text']} -> {link['url']}")
                return kbo_links
            else:
                print("No KBO-related content found")
        
        time.sleep(2)
    
    return None

def main():
    print("KBO Alternative Data Sources Investigation")
    print("="*60)
    
    results = {}
    
    # Wikipedia調査
    wiki_sources = {
        'wikipedia_kbo': ('https://en.wikipedia.org/wiki/KBO_League', 'KBO League main page'),
        'wikipedia_teams': ('https://en.wikipedia.org/wiki/List_of_KBO_League_teams', 'KBO teams list'),
        'wikipedia_2024': ('https://en.wikipedia.org/wiki/2024_KBO_League_season', '2024 season page')
    }
    
    for key, (url, description) in wiki_sources.items():
        result = extract_kbo_info_from_wikipedia(url, description)
        results[key] = result
        time.sleep(3)
    
    # Baseball Reference調査
    print(f"\n" + "="*60)
    br_result = check_baseball_reference_kbo()
    results['baseball_reference'] = br_result
    
    # 結果保存
    try:
        output_file = "data/kbo_alternative_investigation.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False, default=str)
        print(f"\nResults saved to: {output_file}")
    except Exception as e:
        print(f"Could not save results: {e}")
    
    # サマリー
    print(f"\n" + "="*60)
    print("ALTERNATIVE SOURCES SUMMARY")
    print("="*60)
    
    for source, data in results.items():
        if data:
            if isinstance(data, dict) and 'teams_found' in data:
                teams_count = len(data['teams_found'])
                tables_count = len(data.get('tables', []))
                print(f"{source}: {teams_count} teams, {tables_count} tables")
            elif isinstance(data, list):
                print(f"{source}: {len(data)} KBO-related links found")
            else:
                print(f"{source}: Data available")
        else:
            print(f"{source}: No data retrieved")

if __name__ == "__main__":
    main()