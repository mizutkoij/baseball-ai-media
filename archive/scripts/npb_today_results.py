#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced NPB Today Results Scraper
Scrapes NPB official site for today's game results and detailed statistics
Specifically designed for integration with enhanced game results tab
"""

import re, os, sys, time, json, argparse, random
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

JST = timezone(timedelta(hours=9))
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; baseball-ai-media/npb-results; +https://baseball-ai-media.vercel.app)",
    "Accept-Language": "ja,en;q=0.8",
}
TIMEOUT = 20
SLEEP_RANGE = (1.5, 3.0)  # Respectful scraping

def sleep():
    time.sleep(random.uniform(*SLEEP_RANGE))

def get(url):
    resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp

# NPB team code mapping
TEAM_CODE_MAP = {
    's': '阪神', 't': '阪神',  # Tigers
    'g': '巨人', 'y': '巨人',  # Giants  
    'd': '中日', 'c': '中日',  # Dragons
    'db': 'DeNA', 'b': 'DeNA',  # BayStars
    'h': '広島', 'c': '広島',  # Carp
    'ys': 'ヤクルト', 's': 'ヤクルト',  # Swallows
    'f': '日本ハム', 'h': '日本ハム',  # Fighters
    'e': '楽天', 'e': '楽天',  # Eagles
    'm': 'ロッテ', 'm': 'ロッテ',  # Marines
    'l': '西武', 'l': '西武',  # Lions
    'bs': 'オリックス', 'b': 'オリックス',  # Buffaloes
    'h': 'ソフトバンク', 'h': 'ソフトバンク'  # Hawks
}

def parse_team_from_url(url):
    """Extract team names from NPB game URL"""
    # Pattern: /scores/2025/0820/s-g-18/ -> away='ヤクルト', home='巨人'
    m = re.search(r'/scores/\d{4}/\d{4}/([a-z]+)-([a-z]+)-\d+/', url)
    if not m:
        return None, None
    
    away_code, home_code = m.group(1), m.group(2)
    
    # Corrected team mapping based on NPB URL codes
    team_map = {
        # セ・リーグ
        's': 'ヤクルト',   # Swallows
        'g': '巨人',       # Giants
        'd': '中日',       # Dragons  
        'db': 'DeNA',      # DeNA BayStars
        'h': '広島',       # Hiroshima Carp
        't': '阪神',       # Tigers
        # パ・リーグ  
        'f': '日本ハム',   # Fighters
        'e': '楽天',       # Eagles
        'm': 'ロッテ',     # Marines
        'l': '西武',       # Lions
        'b': 'オリックス', # Buffaloes (sometimes 'bs')
        'bs': 'オリックス',
        'h': 'ソフトバンク' # Hawks (note: conflicts with 広島, context needed)
    }
    
    # Handle context conflicts (広島 vs ソフトバンク both use 'h')
    away_team = team_map.get(away_code, away_code)
    home_team = team_map.get(home_code, home_code)
    
    # Manual fixes for known URL patterns from today's schedule
    if away_code == 's' and home_code == 'g':
        return 'ヤクルト', '巨人'
    elif away_code == 'db' and home_code == 'h':
        return 'DeNA', '広島'  
    elif away_code == 't' and home_code == 'd':
        return '阪神', '中日'
    elif away_code == 'f' and home_code == 'b':
        return '日本ハム', 'オリックス'
    elif away_code == 'm' and home_code == 'e':
        return 'ロッテ', '楽天'
    elif away_code == 'h' and home_code == 'l':
        return 'ソフトバンク', '西武'
    
    return away_team, home_team

def scrape_game_box_score(game_url):
    """Scrape detailed box score from NPB game page"""
    try:
        box_url = game_url.replace('/index.html', '/box.html')
        html = get(box_url).text
        sleep()
        soup = BeautifulSoup(html, "lxml")
        
        # Extract basic game info
        game_info = {}
        
        # Try to find score in various locations
        score_elem = soup.find('div', class_='score') or soup.find('table', class_='score')
        if score_elem:
            score_text = score_elem.get_text(strip=True)
            score_match = re.search(r'(\d+)\s*-\s*(\d+)', score_text)
            if score_match:
                # Determine which is away/home from context
                game_info['away_score'] = int(score_match.group(1))
                game_info['home_score'] = int(score_match.group(2))
        
        # Extract inning-by-inning scores
        inning_table = soup.find('table', class_='inning') or soup.find('table', {'id': 'inning'})
        if inning_table:
            rows = inning_table.find_all('tr')
            if len(rows) >= 3:  # Header + Away + Home
                away_innings = []
                home_innings = []
                
                # Extract inning scores
                for cell in rows[1].find_all('td')[1:10]:  # Skip team name, take 9 innings
                    try:
                        away_innings.append(int(cell.get_text(strip=True)))
                    except:
                        away_innings.append(0)
                
                for cell in rows[2].find_all('td')[1:10]:  # Skip team name, take 9 innings
                    try:
                        home_innings.append(int(cell.get_text(strip=True)))
                    except:
                        home_innings.append(0)
                
                game_info['inning_scores'] = {
                    'away': away_innings,
                    'home': home_innings
                }
        
        # Extract batting stats
        batting_tables = soup.find_all('table', class_='batting') or soup.find_all('table', string=re.compile('打者成績'))
        batting_stats = {'away': [], 'home': []}
        
        for i, table in enumerate(batting_tables[:2]):  # Usually away first, then home
            team_key = 'away' if i == 0 else 'home'
            rows = table.find_all('tr')[1:]  # Skip header
            
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 8:
                    try:
                        batting_stats[team_key].append({
                            'player_name': cells[0].get_text(strip=True),
                            'position': cells[1].get_text(strip=True),
                            'at_bats': int(cells[2].get_text(strip=True) or 0),
                            'hits': int(cells[3].get_text(strip=True) or 0),
                            'runs': int(cells[4].get_text(strip=True) or 0),
                            'rbis': int(cells[5].get_text(strip=True) or 0),
                            'home_runs': int(cells[6].get_text(strip=True) or 0),
                            'walks': int(cells[7].get_text(strip=True) or 0),
                            'strikeouts': int(cells[8].get_text(strip=True) or 0) if len(cells) > 8 else 0,
                            'batting_average': float(cells[9].get_text(strip=True) or 0) if len(cells) > 9 else 0,
                            'doubles': 0,  # Not always available
                            'triples': 0,  # Not always available
                            'on_base_percentage': 0,  # Calculate if needed
                            'slugging_percentage': 0  # Calculate if needed
                        })
                    except:
                        continue
        
        # Extract pitching stats
        pitching_tables = soup.find_all('table', class_='pitching') or soup.find_all('table', string=re.compile('投手成績'))
        pitching_stats = {'away': [], 'home': []}
        
        for i, table in enumerate(pitching_tables[:2]):
            team_key = 'away' if i == 0 else 'home'
            rows = table.find_all('tr')[1:]  # Skip header
            
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 6:
                    try:
                        pitching_stats[team_key].append({
                            'player_name': cells[0].get_text(strip=True),
                            'role': '先発' if '先発' in cells[1].get_text() else 'リリーフ',
                            'innings_pitched': float(cells[2].get_text(strip=True) or 0),
                            'hits_allowed': int(cells[3].get_text(strip=True) or 0),
                            'runs_allowed': int(cells[4].get_text(strip=True) or 0),
                            'earned_runs': int(cells[5].get_text(strip=True) or 0),
                            'walks_allowed': int(cells[6].get_text(strip=True) or 0) if len(cells) > 6 else 0,
                            'strikeouts': int(cells[7].get_text(strip=True) or 0) if len(cells) > 7 else 0,
                            'home_runs_allowed': int(cells[8].get_text(strip=True) or 0) if len(cells) > 8 else 0,
                            'pitches_thrown': int(cells[9].get_text(strip=True) or 0) if len(cells) > 9 else 0,
                            'strikes': 0,  # Not always available
                            'era': float(cells[10].get_text(strip=True) or 0) if len(cells) > 10 else 0,
                            'whip': 0,  # Calculate if needed
                            'result': 'no_decision'  # Will be determined separately
                        })
                    except:
                        continue
        
        game_info['batting_stats'] = batting_stats
        game_info['pitching_stats'] = pitching_stats
        
        return game_info
        
    except Exception as e:
        print(f"Error scraping game details: {e}")
        return None

def get_today_npb_results():
    """Get today's NPB game results from official site"""
    today = datetime.now(JST).date()
    year = today.year
    month = today.month
    
    # Scrape today's schedule first
    url = f"https://npb.jp/games/{year}/schedule_{month:02d}_detail.html"
    response = get(url)
    response.encoding = 'utf-8'  # Ensure proper encoding
    html = response.text
    sleep()
    soup = BeautifulSoup(html, "lxml")
    
    games = []
    
    # Find today's games
    for a in soup.select(f'a[href*="/scores/{year}/"]'):
        href = a.get("href", "")
        if not re.search(r"/scores/\d{4}/\d{4}/", href):
            continue
            
        # Extract date from URL
        m = re.search(r"/scores/(\d{4})/(\d{2})(\d{2})/", href)
        if not m:
            continue
            
        game_date = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
        if game_date != today.isoformat():
            continue
        
        full_url = urljoin("https://npb.jp", href)
        away_team, home_team = parse_team_from_url(href)
        
        if not away_team or not home_team:
            continue
        
        # Get detailed game information
        game_details = scrape_game_box_score(full_url)
        if not game_details:
            continue
        
        game_id = f"{today.strftime('%Y%m%d')}-{home_team}-{away_team}-npb"
        
        game_data = {
            'game_id': game_id,
            'date': game_date,
            'away_team': away_team,
            'home_team': home_team,
            'league': 'npb',
            'venue': None,  # Could be extracted if needed
            'status': 'FINAL',  # Assume finished games
            'final_score': {
                'away': game_details.get('away_score', 0),
                'home': game_details.get('home_score', 0)
            },
            'inning_scores': game_details.get('inning_scores', {'away': [], 'home': []}),
            'game_stats': {
                'away_hits': sum(1 for p in game_details.get('batting_stats', {}).get('away', []) if p.get('hits', 0) > 0),
                'home_hits': sum(1 for p in game_details.get('batting_stats', {}).get('home', []) if p.get('hits', 0) > 0),
                'away_errors': 0,  # Not easily available
                'home_errors': 0   # Not easily available
            },
            'away_batting': game_details.get('batting_stats', {}).get('away', []),
            'home_batting': game_details.get('batting_stats', {}).get('home', []),
            'away_pitching': game_details.get('pitching_stats', {}).get('away', []),
            'home_pitching': game_details.get('pitching_stats', {}).get('home', []),
            'winning_pitcher': None,  # Could be determined from stats
            'losing_pitcher': None,   # Could be determined from stats
            'save_pitcher': None,     # Could be determined from stats
            'links': {
                'index': full_url,
                'box': full_url.replace('/index.html', '/box.html'),
                'pbp': full_url.replace('/index.html', '/playbyplay.html')
            }
        }
        
        games.append(game_data)
    
    return {
        'source': 'npb_official',
        'provider': 'npb.jp',
        'updated_at': datetime.now(JST).isoformat(),
        'games': len(games),
        'data': games
    }

def main():
    parser = argparse.ArgumentParser(description='Scrape NPB today results')
    parser.add_argument('--output', '-o', default='snapshots/npb_today_results.json',
                       help='Output JSON file path')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        print("Scraping today's NPB results...")
    
    results = get_today_npb_results()
    
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"Wrote {len(results['data'])} games to {args.output}")

if __name__ == "__main__":
    main()