#!/usr/bin/env python3
"""
npb_fetch_game_first.py
NPB一軍の個別試合ページ（index.html, box.html）から
スタメン・ボックススコア・会場情報を取得してDuckDBに格納

使い方:
  python3 npb_fetch_game_first.py --game-url https://npb.jp/scores/2025/0731/db-s-15/ --db data/npb.db
  python3 npb_fetch_game_first.py --from-db --db data/npb.db --date-range 2025-07-29:2025-07-31
"""

import re, os, sys, time, json, argparse, random
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
import duckdb

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; baseball-ai-media/npb-fetch; +https://baseball-ai-media.vercel.app)",
    "Accept-Language": "ja,en;q=0.8",
}
TIMEOUT = 20
SLEEP_RANGE = (1.2, 2.5)

def sleep():
    time.sleep(random.uniform(*SLEEP_RANGE))

def get(url):
    """Fetch URL with error handling"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def safe_int(value, default=0):
    """Safely convert to int"""
    if value is None or value == "" or value == "-":
        return default
    try:
        # Handle cases like "2.0" -> "2"
        if isinstance(value, str):
            value = value.replace(",", "")  # Remove thousands separator
        return int(float(value))
    except (ValueError, TypeError):
        return default

def safe_float(value, default=0.0):
    """Safely convert to float"""
    if value is None or value == "" or value == "-":
        return default
    try:
        if isinstance(value, str):
            value = value.replace(",", "")
        return float(value)
    except (ValueError, TypeError):
        return default

def outs_from_ip(ip_text):
    """Convert IP format (7.1, 7.2) to total outs"""
    if not ip_text or ip_text == "-":
        return 0
    try:
        if "." in str(ip_text):
            whole, frac = str(ip_text).split(".")
            return int(whole) * 3 + {"0": 0, "1": 1, "2": 2}.get(frac, 0)
        return int(float(ip_text)) * 3
    except:
        return 0

def calculate_batting_stats(stats):
    """Calculate derived batting statistics"""
    ab = stats.get('AB', 0)
    h = stats.get('H', 0)
    bb = stats.get('BB', 0)
    hbp = stats.get('HBP', 0)
    sf = stats.get('SF', 0)
    hr = stats.get('HR', 0)
    so = stats.get('SO', 0)
    doubles = stats.get('2B', 0)
    triples = stats.get('3B', 0)
    
    # Basic calculations
    pa = ab + bb + hbp + sf + stats.get('SH', 0)
    avg = h / max(1, ab) if ab > 0 else 0.0
    
    # On-base percentage
    obp_denom = ab + bb + hbp + sf
    obp = (h + bb + hbp) / max(1, obp_denom) if obp_denom > 0 else 0.0
    
    # Slugging percentage  
    singles = h - doubles - triples - hr
    total_bases = singles + 2*doubles + 3*triples + 4*hr
    slg = total_bases / max(1, ab) if ab > 0 else 0.0
    
    # Derived stats
    ops = obp + slg
    iso = slg - avg
    
    # BABIP (Batting Average on Balls In Play)
    babip_denom = ab - so - hr + sf
    babip = (h - hr) / max(1, babip_denom) if babip_denom > 0 else 0.0
    
    return {
        'AVG': round(avg, 3),
        'OBP': round(obp, 3), 
        'SLG': round(slg, 3),
        'OPS': round(ops, 3),
        'ISO': round(iso, 3),
        'BABIP': round(babip, 3)
    }

def calculate_pitching_stats(stats, lg_fip_const=3.20):
    """Calculate derived pitching statistics"""
    ip_outs = stats.get('IP_outs', 0)
    ip = ip_outs / 3.0 if ip_outs > 0 else 0.0
    
    h = stats.get('H', 0)
    bb = stats.get('BB', 0)
    hbp = stats.get('HBP', 0)
    so = stats.get('SO', 0)
    hr = stats.get('HR', 0)
    er = stats.get('ER', 0)
    
    if ip <= 0:
        return {
            'IP': 0.0, 'ERA': 0.0, 'WHIP': 0.0,
            'K9': 0.0, 'BB9': 0.0, 'HR9': 0.0, 'FIP': 0.0
        }
    
    # Rate stats (per 9 innings)
    era = 9 * er / ip
    whip = (bb + h) / ip
    k9 = 9 * so / ip
    bb9 = 9 * bb / ip
    hr9 = 9 * hr / ip
    
    # FIP (Fielding Independent Pitching)
    fip = (13*hr + 3*(bb + hbp) - 2*so) / ip + lg_fip_const
    
    return {
        'IP': round(ip, 1),
        'ERA': round(era, 2),
        'WHIP': round(whip, 3),
        'K9': round(k9, 1),
        'BB9': round(bb9, 1),
        'HR9': round(hr9, 1),
        'FIP': round(fip, 2)
    }

def parse_game_index(base_url):
    """Parse index.html for lineups and game info"""
    index_url = urljoin(base_url, "index.html")
    resp = get(index_url)
    if not resp:
        return None, []
    
    soup = BeautifulSoup(resp.text, "lxml")
    sleep()
    
    # Extract game info
    game_info = {}
    
    # Try multiple selectors for venue
    venue_selectors = [
        ".stadium",
        ".venue",
        "[class*='stadium']",
        "[class*='venue']"
    ]
    
    for selector in venue_selectors:
        venue_elem = soup.select_one(selector)
        if venue_elem:
            game_info['venue'] = venue_elem.get_text(strip=True)
            break
    
    # Fallback: search text for venue
    if 'venue' not in game_info:
        venue_text = soup.find(string=re.compile(r"(ドーム|スタジアム|球場|マリン|甲子園|東京|横浜|札幌|仙台|西武|福岡|広島|倉敷)"))
        if venue_text:
            # Extract venue name more carefully
            venue_match = re.search(r"([^\s]+(?:ドーム|スタジアム|球場))", venue_text)
            if venue_match:
                game_info['venue'] = venue_match.group(1)
            else:
                game_info['venue'] = venue_text.strip()
    
    # Try multiple selectors for start time
    time_selectors = [
        ".time",
        ".start-time",
        "[class*='time']"
    ]
    
    for selector in time_selectors:
        time_elem = soup.select_one(selector)
        if time_elem:
            time_text = time_elem.get_text(strip=True)
            time_match = re.search(r"(\d{1,2}:\d{2})", time_text)
            if time_match:
                game_info['start_time_jst'] = time_match.group(1)
                break
    
    # Fallback: search all text for time
    if 'start_time_jst' not in game_info:
        time_elem = soup.find(string=re.compile(r"\d{1,2}:\d{2}"))
        if time_elem:
            time_match = re.search(r"(\d{1,2}:\d{2})", time_elem)
            if time_match:
                game_info['start_time_jst'] = time_match.group(1)
    
    # Parse lineups with improved selectors
    lineups = []
    
    # Try multiple approaches for lineup tables
    lineup_approaches = [
        # Approach 1: Look for tables with specific classes
        (".lineup-table", "table.lineup"),
        # Approach 2: Look for tables with lineup-related headers
        ("table", None),
        # Approach 3: Look for div-based lineups
        (".lineup", ".starting-lineup")
    ]
    
    for table_selector, _ in lineup_approaches:
        tables = soup.select(table_selector) if table_selector.startswith('.') else soup.select("table")
        
        for table in tables:
            # Check if this looks like a lineup table
            headers = [th.get_text(strip=True) for th in table.select("th")]
            header_text = " ".join(headers).lower()
            
            if any(keyword in header_text for keyword in ["打順", "先発", "lineup", "order", "position"]):
                rows = table.select("tr")[1:]  # Skip header
                team_name = "Unknown"  # Extract from context if possible
                
                for i, row in enumerate(rows[:9], 1):  # Max 9 players
                    cells = row.select("td")
                    if len(cells) >= 2:
                        # Try different cell arrangements
                        if len(cells) >= 3:
                            # Format: Order | Position | Name
                            pos = cells[1].get_text(strip=True)
                            name = cells[2].get_text(strip=True)
                        else:
                            # Format: Position | Name
                            pos = cells[0].get_text(strip=True)
                            name = cells[1].get_text(strip=True)
                        
                        # Clean up name (remove numbers, special chars)
                        name = re.sub(r'^[0-9\s]+', '', name)  # Remove leading numbers
                        name = re.sub(r'[（）()].*$', '', name)  # Remove parentheses and contents
                        name = name.strip()
                        
                        if name and len(name) > 1:  # Valid name
                            lineups.append({
                                'order_no': i,
                                'pos': pos,
                                'player_name': name,
                                'player_id': None,
                                'team': team_name
                            })
                
                if lineups:  # Found lineups, break
                    break
        
        if lineups:  # Found lineups, no need to try other approaches
            break
    
    return game_info, lineups

def parse_game_box(base_url):
    """Parse box.html for batting and pitching stats"""
    box_url = urljoin(base_url, "box.html") 
    resp = get(box_url)
    if not resp:
        return [], []
    
    soup = BeautifulSoup(resp.text, "lxml")
    sleep()
    
    batting_stats = []
    pitching_stats = []
    
    # Debug: save HTML for inspection
    print(f"Box URL: {box_url}")
    print(f"Response status: {resp.status_code}")
    print(f"Content length: {len(resp.text)}")
    
    # Find all tables
    tables = soup.select("table")
    print(f"Found {len(tables)} tables")
    
    # Try multiple approaches to find batting/pitching data
    for i, table in enumerate(tables):
        # Get all text from table for debugging
        table_text = table.get_text()
        
        # Try to identify table type by headers and content
        headers = [th.get_text(strip=True) for th in table.select("th")]
        header_text = " ".join(headers).lower()
        
        print(f"Table {i}: Headers = {headers}")
        
        # More flexible batting table detection
        batting_keywords = ["打数", "安打", "打点", "batting", "ab", "h", "rbi", "avg"]
        pitching_keywords = ["投球", "防御率", "pitching", "ip", "era", "whip", "奪三振"]
        
        is_batting = any(keyword in header_text for keyword in batting_keywords) or \
                    any(keyword in table_text.lower() for keyword in ["打数", "安打", "打点"])
        
        is_pitching = any(keyword in header_text for keyword in pitching_keywords) or \
                     any(keyword in table_text.lower() for keyword in ["防御率", "投球回", "奪三振"])
        
        if is_batting:
            print(f"  -> Identified as batting table")
            # Extract team name from surrounding context
            team = "Unknown"
            team_elem = table.find_previous(string=re.compile(r"(巨人|阪神|中日|広島|ヤクルト|DeNA|ソフトバンク|日本ハム|楽天|西武|ロッテ|オリックス)"))
            if team_elem:
                team = team_elem.strip()
            
            rows = table.select("tr")
            print(f"  -> Found {len(rows)} rows")
            
            for row_idx, row in enumerate(rows[1:]):  # Skip header
                cells = [td.get_text(strip=True) for td in row.select("td")]
                print(f"    Row {row_idx}: {cells}")
                
                if len(cells) < 3:  # Need minimum columns
                    continue
                
                # Parse player name (usually first column)
                name = cells[0] if cells else ""
                name = re.sub(r'^[0-9\s]+', '', name)  # Remove leading numbers
                name = re.sub(r'[（）()].*$', '', name)  # Remove parentheses
                name = name.strip()
                
                if not name or name in ["合計", "Total", "", "計"] or len(name) < 2:
                    continue
                
                # Parse stats based on available columns
                # Common NPB box score format: Name, Position, AB, H, HR, RBI, BB, SO, AVG
                stats = {
                    'player_name': name,
                    'team': team,
                    'order_no': 0,  # Will be updated from lineups
                    'pos': cells[1] if len(cells) > 1 else "",
                    'AB': safe_int(cells[2] if len(cells) > 2 else 0),
                    'H': safe_int(cells[3] if len(cells) > 3 else 0),
                    'HR': safe_int(cells[4] if len(cells) > 4 else 0),
                    'RBI': safe_int(cells[5] if len(cells) > 5 else 0),
                    'BB': safe_int(cells[6] if len(cells) > 6 else 0),
                    'SO': safe_int(cells[7] if len(cells) > 7 else 0),
                    'R': safe_int(cells[8] if len(cells) > 8 else 0),
                    'PA': 0,  # Will be calculated
                    '2B': 0, '3B': 0,  # Often not in basic box score
                    'IBB': 0, 'HBP': 0, 'SF': 0, 'SH': 0,
                    'SB': 0, 'CS': 0
                }
                
                # Calculate derived stats
                derived = calculate_batting_stats(stats)
                stats.update(derived)
                
                batting_stats.append(stats)
                print(f"      -> Added batting stats for {name}")
        
        elif is_pitching:
            print(f"  -> Identified as pitching table")
            # Extract team name
            team = "Unknown"
            team_elem = table.find_previous(string=re.compile(r"(巨人|阪神|中日|広島|ヤクルト|DeNA|ソフトバンク|日本ハム|楽天|西武|ロッテ|オリックス)"))
            if team_elem:
                team = team_elem.strip()
            
            rows = table.select("tr")
            print(f"  -> Found {len(rows)} rows")
            
            for row_idx, row in enumerate(rows[1:]):
                cells = [td.get_text(strip=True) for td in row.select("td")]
                print(f"    Row {row_idx}: {cells}")
                
                if len(cells) < 4:
                    continue
                
                name = cells[0] if cells else ""
                name = re.sub(r'^[0-9\s]+', '', name)
                name = re.sub(r'[（）()].*$', '', name)
                name = name.strip()
                
                if not name or name in ["合計", "Total", "", "計"] or len(name) < 2:
                    continue
                
                # Common format: Name, IP, H, R, ER, BB, SO, HR, ERA
                ip_text = cells[1] if len(cells) > 1 else "0"
                stats = {
                    'player_name': name,
                    'team': team,
                    'IP_outs': outs_from_ip(ip_text),
                    'H': safe_int(cells[2] if len(cells) > 2 else 0),
                    'R': safe_int(cells[3] if len(cells) > 3 else 0),
                    'ER': safe_int(cells[4] if len(cells) > 4 else 0),
                    'BB': safe_int(cells[5] if len(cells) > 5 else 0),
                    'SO': safe_int(cells[6] if len(cells) > 6 else 0),
                    'HR': safe_int(cells[7] if len(cells) > 7 else 0),
                    'BF': 0,  # Often not available
                    'IBB': 0, 'HBP': 0, 'WP': 0, 'BK': 0
                }
                
                # Calculate derived stats
                derived = calculate_pitching_stats(stats)
                stats.update(derived)
                
                pitching_stats.append(stats)
                print(f"      -> Added pitching stats for {name}")
    
    print(f"Total parsed: {len(batting_stats)} batting, {len(pitching_stats)} pitching")
    return batting_stats, pitching_stats

def upsert_game_details(conn, game_id, game_info, lineups, batting_stats, pitching_stats):
    """Upsert game details into database"""
    
    # Update game info if we got additional details
    if game_info:
        updates = []
        params = []
        if 'venue' in game_info:
            updates.append("venue = ?")
            params.append(game_info['venue'])
        if 'start_time_jst' in game_info:
            updates.append("start_time_jst = ?")
            params.append(game_info['start_time_jst'])
        
        if updates:
            params.append(game_id)
            conn.execute(f"""
                UPDATE games 
                SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
                WHERE game_id = ?
            """, params)
    
    # Insert lineups
    if lineups:
        conn.execute("DELETE FROM lineups WHERE game_id = ?", [game_id])
        lineup_data = []
        for lineup in lineups:
            # Determine team from game_id (simplified)
            team = "Unknown"  # In real implementation, derive from game context
            lineup_data.append((
                game_id, team, lineup['order_no'], lineup['pos'],
                lineup['player_name'], lineup['player_id']
            ))
        
        if lineup_data:
            conn.executemany("""
                INSERT INTO lineups (game_id, team, order_no, pos, player_name, player_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, lineup_data)
    
    # Insert batting stats
    if batting_stats:
        conn.execute("DELETE FROM box_batting WHERE game_id = ?", [game_id])
        batting_data = []
        for stats in batting_stats:
            batting_data.append((
                game_id, stats['player_name'], stats.get('player_id'),
                stats['team'], stats['order_no'], stats['pos'],
                stats['PA'], stats['AB'], stats['H'], stats['2B'], stats['3B'], stats['HR'],
                stats['BB'], stats['IBB'], stats['HBP'], stats['SO'], stats['SF'], stats['SH'],
                stats['R'], stats['RBI'], stats['SB'], stats['CS'],
                stats['AVG'], stats['OBP'], stats['SLG'], stats['OPS'], stats['ISO'], stats['BABIP']
            ))
        
        if batting_data:
            conn.executemany("""
                INSERT INTO box_batting (
                    game_id, player_name, player_id, team, order_no, pos,
                    PA, AB, H, "2B", "3B", HR, BB, IBB, HBP, SO, SF, SH,
                    R, RBI, SB, CS, AVG, OBP, SLG, OPS, ISO, BABIP
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batting_data)
    
    # Insert pitching stats
    if pitching_stats:
        conn.execute("DELETE FROM box_pitching WHERE game_id = ?", [game_id])
        pitching_data = []
        for stats in pitching_stats:
            pitching_data.append((
                game_id, stats['player_name'], stats.get('player_id'),
                stats['team'], stats['IP_outs'], stats['BF'],
                stats['H'], stats['R'], stats['ER'], stats['HR'],
                stats['BB'], stats['IBB'], stats['HBP'], stats['SO'], stats['WP'], stats['BK'],
                stats['IP'], stats['ERA'], stats['WHIP'], stats['K9'], stats['BB9'], stats['HR9'], stats['FIP']
            ))
        
        if pitching_data:
            conn.executemany("""
                INSERT INTO box_pitching (
                    game_id, player_name, player_id, team, IP_outs, BF,
                    H, R, ER, HR, BB, IBB, HBP, SO, WP, BK,
                    IP, ERA, WHIP, K9, BB9, HR9, FIP
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, pitching_data)

def fetch_game_details(base_url, game_id, conn):
    """Fetch and store details for a single game"""
    print(f"Fetching game details: {game_id}")
    
    # Parse index.html for lineups and game info
    game_info, lineups = parse_game_index(base_url)
    
    # Parse box.html for stats
    batting_stats, pitching_stats = parse_game_box(base_url)
    
    # Store in database
    upsert_game_details(conn, game_id, game_info, lineups, batting_stats, pitching_stats)
    
    print(f"  Stored: {len(lineups)} lineup entries, {len(batting_stats)} batting, {len(pitching_stats)} pitching")

def main():
    parser = argparse.ArgumentParser(description="Fetch NPB game details")
    parser.add_argument("--game-url", help="Single game URL to fetch")
    parser.add_argument("--from-db", action="store_true", help="Fetch games from database")
    parser.add_argument("--date-range", help="Date range (YYYY-MM-DD:YYYY-MM-DD)")
    parser.add_argument("--db", default="data/npb.db", help="Database path")
    parser.add_argument("--league", default="first", help="League filter")
    
    args = parser.parse_args()
    
    conn = duckdb.connect(args.db)
    
    if args.game_url:
        # Single URL mode
        game_id = f"manual-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        fetch_game_details(args.game_url, game_id, conn)
    
    elif args.from_db:
        # Fetch from database
        query = "SELECT game_id, links FROM games WHERE league = ? AND status != 'POSTPONED'"
        params = [args.league]
        
        if args.date_range:
            start_date, end_date = args.date_range.split(":")
            query += " AND date BETWEEN ? AND ?"
            params.extend([start_date, end_date])
        
        games = conn.execute(query, params).fetchall()
        print(f"Found {len(games)} games to process")
        
        for game_id, links_json in games:
            try:
                links = json.loads(links_json) if links_json else {}
                base_url = links.get('index', '').replace('/index.html', '/')
                if base_url:
                    fetch_game_details(base_url, game_id, conn)
                else:
                    print(f"No base URL for game {game_id}")
            except Exception as e:
                print(f"Error processing game {game_id}: {e}")
                continue
    
    else:
        print("Specify either --game-url or --from-db")
        return
    
    conn.close()

if __name__ == "__main__":
    main()