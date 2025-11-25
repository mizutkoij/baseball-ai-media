#!/usr/bin/env python3
"""
scripts/bbdata_player_roster.py - 選手ロスター（今年度登録選手）の日次スナップショット

出力: data/bbdata/date=YYYY-MM-DD/players_YYYY-MM-DD.csv
カラム: pid,name,team,level

Usage:
    python scripts/bbdata_player_roster.py --date 2025-08-14 [--discord]
"""
import sys
import os
import argparse
import json
import csv
import gzip
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import time
import re

# Add project root to path for imports
sys.path.append(".")

from lib.polite_http import PoliteHttp
from lib.discord_csv_notifier import send_csv

# BeautifulSoup for HTML parsing
try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: beautifulsoup4 not installed. Run: pip install beautifulsoup4")
    sys.exit(1)

# Constants
BASE_URL = "https://baseballdata.jp"
MIN_INTERVAL_SEC = 15.0

# Team mappings based on existing patterns
TEAM_MAPPINGS = {
    "巨人": "G", "ヤクルト": "YS", "中日": "D", "阪神": "T", "広島": "C", "DeNA": "DB",
    "ソフトバンク": "H", "日本ハム": "F", "西武": "L", "楽天": "E", "ロッテ": "M", "オリックス": "B"
}

def get_current_roster_urls() -> List[str]:
    """Get roster page URLs for current season teams."""
    current_year = datetime.now().year
    urls = []
    
    # Central League teams
    central_teams = ["giants", "swallows", "dragons", "tigers", "carp", "baystars"]
    # Pacific League teams  
    pacific_teams = ["hawks", "fighters", "lions", "eagles", "marines", "buffaloes"]
    
    for team in central_teams + pacific_teams:
        # Main roster page pattern (inferred from baseballdata.jp structure)
        url = f"{BASE_URL}/{current_year}/roster/{team}.html"
        urls.append(url)
    
    return urls

def parse_roster_page(html: str, team_identifier: str) -> List[Dict[str, str]]:
    """
    Parse roster page HTML to extract player information.
    Uses defensive parsing with fallback strategies.
    """
    players = []
    
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Strategy 1: Look for tables with player information
        tables = soup.find_all('table')
        
        for table in tables:
            rows = table.find_all('tr')
            
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) < 2:
                    continue
                
                # Look for player links and extract player ID
                for cell in cells:
                    links = cell.find_all('a', href=True)
                    for link in links:
                        href = link.get('href', '')
                        
                        # Extract player ID from various URL patterns
                        player_id = extract_player_id(href)
                        if player_id:
                            name = link.get_text(strip=True)
                            if name and len(name) > 1:
                                # Determine level (1軍/2軍) from context or default to 1軍
                                level = "1軍"
                                if "2軍" in html or "farm" in href.lower():
                                    level = "2軍"
                                
                                # Map team identifier to standard team code
                                team_code = map_team_identifier(team_identifier)
                                
                                players.append({
                                    "pid": player_id,
                                    "name": name,
                                    "team": team_code,
                                    "level": level
                                })
        
        # Strategy 2: If no players found, try different selectors
        if not players:
            # Look for common player link patterns
            player_links = soup.find_all('a', href=re.compile(r'player[BP]/\d+'))
            
            for link in player_links:
                href = link.get('href', '')
                player_id = extract_player_id(href)
                if player_id:
                    name = link.get_text(strip=True)
                    if name and len(name) > 1:
                        team_code = map_team_identifier(team_identifier)
                        players.append({
                            "pid": player_id,
                            "name": name,
                            "team": team_code,
                            "level": "1軍"
                        })
    
    except Exception as e:
        print(f"Warning: Error parsing roster page for {team_identifier}: {e}")
    
    return players

def extract_player_id(href: str) -> Optional[str]:
    """Extract player ID from various URL patterns."""
    patterns = [
        r'/player[BP]/(\d+)\.html',
        r'/player[BP]/(\d+)_',
        r'/\d+/player[BP]/(\d+)\.html',
        r'player_id=(\d+)',
        r'/(\d{7})\.html'  # 7-digit player IDs
    ]
    
    for pattern in patterns:
        match = re.search(pattern, href)
        if match:
            return match.group(1)
    
    return None

def map_team_identifier(team_identifier: str) -> str:
    """Map team identifier to standard team code."""
    # Team mapping based on URL patterns or identifiers
    team_map = {
        "giants": "G", "swallows": "YS", "dragons": "D", 
        "tigers": "T", "carp": "C", "baystars": "DB",
        "hawks": "H", "fighters": "F", "lions": "L",
        "eagles": "E", "marines": "M", "buffaloes": "B"
    }
    
    return team_map.get(team_identifier, team_identifier.upper())

def save_roster_data(players: List[Dict[str, str]], date_str: str, discord_notify: bool = False):
    """Save roster data to CSV with defensive error handling."""
    output_dir = Path(f"data/bbdata/date={date_str}")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = output_dir / f"players_{date_str}.csv"
    
    try:
        # Write CSV with proper encoding
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            if players:
                writer = csv.DictWriter(f, fieldnames=['pid', 'name', 'team', 'level'])
                writer.writeheader()
                writer.writerows(players)
            else:
                # Write empty CSV with headers
                writer = csv.writer(f)
                writer.writerow(['pid', 'name', 'team', 'level'])
        
        print(f"Saved {len(players)} players to {csv_path}")
        
        # Create gzipped version for archival
        with open(csv_path, 'rb') as f_in:
            with gzip.open(f"{csv_path}.gz", 'wb') as f_out:
                f_out.writelines(f_in)
        
        # Discord notification if requested
        if discord_notify and players:
            try:
                send_csv(
                    csv_path=str(csv_path),
                    message=f"📊 Daily Player Roster Snapshot {date_str}\n"
                           f"Total players: {len(players)}\n"
                           f"Teams covered: {len(set(p['team'] for p in players))}"
                )
                print("Discord notification sent")
            except Exception as e:
                print(f"Warning: Discord notification failed: {e}")
    
    except Exception as e:
        print(f"Error saving roster data: {e}")
        return False
    
    return True

def collect_roster_data(date_str: str, discord_notify: bool = False):
    """Main collection function with defensive error handling."""
    print(f"Starting roster collection for {date_str}")
    
    http_client = PoliteHttp(min_interval_s=MIN_INTERVAL_SEC)
    all_players = []
    
    # Metadata for defensive parsing
    metadata = {
        "collection_date": date_str,
        "collection_timestamp": datetime.now().isoformat(),
        "source": "baseballdata.jp",
        "script_version": "1.0",
        "errors": [],
        "warnings": []
    }
    
    roster_urls = get_current_roster_urls()
    print(f"Found {len(roster_urls)} roster URLs to process")
    
    for url in roster_urls:
        print(f"Processing: {url}")
        
        try:
            # Use PoliteHttp for rate-limited requests
            status_code, html = http_client.polite_get(url, timeout=20)
            
            if status_code == 200 and html:
                # Extract team identifier from URL
                team_identifier = url.split('/')[-1].replace('.html', '')
                
                # Parse roster page
                players = parse_roster_page(html, team_identifier)
                all_players.extend(players)
                
                print(f"  Found {len(players)} players for {team_identifier}")
                
                # Store raw HTML for debugging if needed
                debug_dir = Path(f"data/bbdata/date={date_str}/debug")
                debug_dir.mkdir(parents=True, exist_ok=True)
                
                debug_file = debug_dir / f"roster_{team_identifier}.html"
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(html)
                
            elif status_code == 404:
                metadata["warnings"].append(f"URL not found: {url}")
                print(f"  Warning: URL not found (404): {url}")
            elif status_code == 451:
                metadata["warnings"].append(f"Blocked by robots.txt: {url}")
                print(f"  Warning: Blocked by robots.txt: {url}")
            else:
                metadata["errors"].append(f"HTTP {status_code} for {url}")
                print(f"  Error: HTTP {status_code} for {url}")
            
        except Exception as e:
            error_msg = f"Exception processing {url}: {str(e)}"
            metadata["errors"].append(error_msg)
            print(f"  Error: {error_msg}")
            continue
    
    # Remove duplicates based on player ID
    unique_players = {}
    for player in all_players:
        pid = player['pid']
        if pid not in unique_players:
            unique_players[pid] = player
    
    final_players = list(unique_players.values())
    
    # Save metadata
    metadata["total_players"] = len(final_players)
    metadata["duplicate_count"] = len(all_players) - len(final_players)
    
    metadata_dir = Path(f"data/bbdata/date={date_str}")
    with open(metadata_dir / f"roster_metadata_{date_str}.json", 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    # Save final results
    success = save_roster_data(final_players, date_str, discord_notify)
    
    print(f"\nCollection complete:")
    print(f"  Total players collected: {len(final_players)}")
    print(f"  Errors: {len(metadata['errors'])}")
    print(f"  Warnings: {len(metadata['warnings'])}")
    
    return success

def main():
    parser = argparse.ArgumentParser(description="BaseballData.jp player roster collector")
    parser.add_argument("--date", required=True, help="Collection date (YYYY-MM-DD)")
    parser.add_argument("--discord", action="store_true", help="Send Discord notification")
    
    args = parser.parse_args()
    
    # Validate date format
    try:
        datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError:
        print("Error: Date must be in YYYY-MM-DD format")
        sys.exit(1)
    
    # Run collection
    success = collect_roster_data(args.date, args.discord)
    
    if not success:
        print("Collection failed")
        sys.exit(1)
    
    print("Collection completed successfully")

if __name__ == "__main__":
    main()