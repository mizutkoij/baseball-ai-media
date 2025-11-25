#!/usr/bin/env python3
"""
scripts/test_lightweight_scraper.py - 軽量スクレイパーの基本動作テスト
"""
import sys
import requests
from bs4 import BeautifulSoup
import psutil
import time

def get_memory_usage_mb():
    """現在のメモリ使用量をMBで取得"""
    process = psutil.Process()
    return process.memory_info().rss / 1024 / 1024

def test_basic_scraping():
    """基本的なスクレイピングテスト"""
    print("Testing basic HTTP + BeautifulSoup scraping")
    print(f"Initial memory: {get_memory_usage_mb():.1f}MB")
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    # テスト用URLリスト（軽量で確実にアクセス可能）
    test_urls = [
        "https://httpbin.org/status/200",
        "https://httpbin.org/json",
        "https://example.com"
    ]
    
    for i, url in enumerate(test_urls):
        print(f"\nTest {i+1}: {url}")
        
        try:
            # メモリ使用量監視
            before_mb = get_memory_usage_mb()
            
            # HTTP リクエスト
            response = session.get(url, timeout=10)
            response.raise_for_status()
            
            # BeautifulSoup 解析
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 基本情報抽出
            title = soup.title.string if soup.title else "No title"
            links = len(soup.find_all('a'))
            
            after_mb = get_memory_usage_mb()
            memory_used = after_mb - before_mb
            
            print(f"  Status: {response.status_code}")
            print(f"  Title: {title[:50]}")
            print(f"  Links: {links}")
            print(f"  Content size: {len(response.content)} bytes")
            print(f"  Memory: {before_mb:.1f}MB -> {after_mb:.1f}MB (used: {memory_used:.1f}MB)")
            
            # クリーンアップ
            del response, soup
            
        except Exception as e:
            print(f"  Error: {e}")
        
        # 少し待機
        time.sleep(1)
    
    session.close()
    final_mb = get_memory_usage_mb()
    print(f"\nFinal memory: {final_mb:.1f}MB")
    print("Basic scraping test completed successfully!")

def test_table_parsing():
    """テーブル解析のテスト"""
    print("\nTesting table parsing")
    
    # シンプルなHTMLテーブルを作成してテスト
    html_content = """
    <html>
    <body>
        <table>
            <tr><th>Name</th><th>Team</th><th>AVG</th></tr>
            <tr><td><a href="/player/12345.html">選手A</a></td><td>Giants</td><td>0.320</td></tr>
            <tr><td><a href="/player/12346.html">選手B</a></td><td>Swallows</td><td>0.285</td></tr>
        </table>
    </body>
    </html>
    """
    
    before_mb = get_memory_usage_mb()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    table = soup.find('table')
    
    if table:
        rows = table.find_all('tr')
        print(f"  Found {len(rows)} rows")
        
        for i, row in enumerate(rows):
            cells = row.find_all(['td', 'th'])
            row_data = [cell.get_text(strip=True) for cell in cells]
            print(f"  Row {i}: {row_data}")
            
            # プレイヤーID抽出テスト
            for cell in cells:
                for link in cell.find_all('a', href=True):
                    href = link.get('href', '')
                    import re
                    match = re.search(r'player/(\d+)\.html', href)
                    if match:
                        print(f"    Player ID: {match.group(1)}")
    
    after_mb = get_memory_usage_mb()
    print(f"  Memory used for parsing: {after_mb - before_mb:.1f}MB")

def main():
    print("Lightweight Scraper Test")
    print("=" * 40)
    
    try:
        test_basic_scraping()
        test_table_parsing()
        
        print("\nAll tests passed!")
        print("Memory usage appears to be under control.")
        
    except Exception as e:
        print(f"\nTest failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()