#!/usr/bin/env python3
"""
scripts/bbdata_player_stats.py - 年間成績（打撃/投手両方）の日次スナップショット

出力: data/bbdata/date=YYYY-MM-DD/stats_YYYY-MM-DD.csv
カラム: pid,name,team,pos,season,g,pa,ab,h,2b,3b,hr,rbi,bb,so,sb,avg,obp,slg,ops
       (投手の場合: pid,name,team,pos,season,g,w,l,sv,hld,era,ip,h,r,er,bb,so,hr,whip)

Usage:
    python scripts/bbdata_player_stats.py --date 2025-08-14 [--discord]
"""
import sys
import os
import argparse
import json
import csv
import gzip
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Union
import time
import re

# Add project root to path for imports
sys.path.append(".")

from lib.polite_http import PoliteHttp
from lib.discord_csv_notifier import send_csv

# BeautifulSoup for HTML parsing
try:
    from bs4 import BeautifulSoup
    import pandas as pd
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install beautifulsoup4 pandas")
    sys.exit(1)

# Constants
BASE_URL = "https://baseballdata.jp"
MIN_INTERVAL_SEC = 15.0
CURRENT_YEAR = datetime.now().year

def get_player_stats_urls(season: int = None) -> List[Dict[str, str]]:
    """Get player statistics URLs for current season."""
    if season is None:
        season = CURRENT_YEAR
    
    urls = []
    
    # Team-based stats pages for current season
    teams = [
        "giants", "swallows", "dragons", "tigers", "carp", "baystars",  # Central
        "hawks", "fighters", "lions", "eagles", "marines", "buffaloes"  # Pacific
    ]
    
    for team in teams:
        # Batting stats
        batting_url = f"{BASE_URL}/{season}/team/{team}/batting.html"
        urls.append({"url": batting_url, "type": "batting", "team": team, "season": season})
        
        # Pitching stats
        pitching_url = f"{BASE_URL}/{season}/team/{team}/pitching.html"
        urls.append({"url": pitching_url, "type": "pitching", "team": team, "season": season})
    
    # League-wide stats pages
    urls.extend([
        {"url": f"{BASE_URL}/{season}/stats/batting.html", "type": "batting", "team": "league", "season": season},
        {"url": f"{BASE_URL}/{season}/stats/pitching.html", "type": "pitching", "team": "league", "season": season}
    ])
    
    return urls

def parse_batting_stats_table(html: str, team: str, season: int) -> List[Dict[str, Union[str, float, int]]]:
    """Parse batting statistics from HTML table."""
    players = []
    
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Use pandas to parse HTML tables for better reliability
        tables = pd.read_html(html, flavor='bs4')
        
        for table_df in tables:
            # Normalize column names
            if len(table_df.columns) < 5:
                continue
                
            # Look for batting statistics columns
            batting_indicators = ['打率', '安打', 'H', 'AB', 'PA', '打席', '打数', 'AVG']
            has_batting_cols = any(col in str(table_df.columns) for col in batting_indicators)
            
            if not has_batting_cols:
                continue
            
            # Extract player links from the original HTML for player IDs
            table_elements = soup.find_all('table')
            
            for i, table_element in enumerate(table_elements):
                if i >= len(tables):
                    break
                    
                rows = table_element.find_all('tr')
                df = tables[i]
                
                for row_idx, row in enumerate(rows[1:], 1):  # Skip header
                    if row_idx >= len(df):
                        break
                        
                    cells = row.find_all(['td', 'th'])
                    if len(cells) < 3:
                        continue
                    
                    # Extract player ID and name from links
                    player_id = None
                    player_name = None
                    
                    for cell in cells[:2]:  # Usually name is in first few columns
                        links = cell.find_all('a', href=True)
                        for link in links:
                            href = link.get('href', '')
                            extracted_id = extract_player_id(href)
                            if extracted_id:
                                player_id = extracted_id
                                player_name = link.get_text(strip=True)
                                break
                        if player_id:
                            break
                    
                    if not player_id or not player_name:
                        continue
                    
                    # Extract statistics from DataFrame row
                    row_data = df.iloc[row_idx - 1] if row_idx - 1 < len(df) else None
                    if row_data is None:
                        continue
                    
                    # Map common batting statistics
                    stats = {
                        "pid": player_id,
                        "name": player_name,
                        "team": map_team_name(team),
                        "pos": "B",  # Batting
                        "season": season,
                        "g": safe_extract_number(row_data, ['試合', 'G', 'Games']),
                        "pa": safe_extract_number(row_data, ['打席', 'PA']),
                        "ab": safe_extract_number(row_data, ['打数', 'AB']),
                        "h": safe_extract_number(row_data, ['安打', 'H', 'ヒット']),
                        "2b": safe_extract_number(row_data, ['二塁打', '2B', 'Double']),
                        "3b": safe_extract_number(row_data, ['三塁打', '3B', 'Triple']),
                        "hr": safe_extract_number(row_data, ['本塁打', 'HR', 'ホームラン']),
                        "rbi": safe_extract_number(row_data, ['打点', 'RBI']),
                        "bb": safe_extract_number(row_data, ['四球', 'BB', 'Walk']),
                        "so": safe_extract_number(row_data, ['三振', 'SO', 'K']),
                        "sb": safe_extract_number(row_data, ['盗塁', 'SB']),
                        "avg": safe_extract_float(row_data, ['打率', 'AVG', 'BA']),
                        "obp": safe_extract_float(row_data, ['出塁率', 'OBP']),
                        "slg": safe_extract_float(row_data, ['長打率', 'SLG']),
                        "ops": safe_extract_float(row_data, ['OPS'])
                    }
                    
                    # Only add if we have meaningful data
                    if stats["g"] is not None or stats["ab"] is not None:
                        players.append(stats)
    
    except Exception as e:
        print(f"Warning: Error parsing batting stats: {e}")
    
    return players

def parse_pitching_stats_table(html: str, team: str, season: int) -> List[Dict[str, Union[str, float, int]]]:
    """Parse pitching statistics from HTML table."""
    players = []
    
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Use pandas to parse HTML tables
        tables = pd.read_html(html, flavor='bs4')
        
        for table_df in tables:
            if len(table_df.columns) < 5:
                continue
                
            # Look for pitching statistics columns
            pitching_indicators = ['ERA', '防御率', 'W', 'L', '勝', '負', 'IP', '投球回']
            has_pitching_cols = any(col in str(table_df.columns) for col in pitching_indicators)
            
            if not has_pitching_cols:
                continue
            
            # Extract player links from the original HTML for player IDs
            table_elements = soup.find_all('table')
            
            for i, table_element in enumerate(table_elements):
                if i >= len(tables):
                    break
                    
                rows = table_element.find_all('tr')
                df = tables[i]
                
                for row_idx, row in enumerate(rows[1:], 1):  # Skip header
                    if row_idx >= len(df):
                        break
                        
                    cells = row.find_all(['td', 'th'])
                    if len(cells) < 3:
                        continue
                    
                    # Extract player ID and name from links
                    player_id = None
                    player_name = None
                    
                    for cell in cells[:2]:
                        links = cell.find_all('a', href=True)
                        for link in links:
                            href = link.get('href', '')
                            extracted_id = extract_player_id(href)
                            if extracted_id:
                                player_id = extracted_id
                                player_name = link.get_text(strip=True)
                                break
                        if player_id:
                            break
                    
                    if not player_id or not player_name:
                        continue
                    
                    # Extract statistics from DataFrame row
                    row_data = df.iloc[row_idx - 1] if row_idx - 1 < len(df) else None
                    if row_data is None:
                        continue
                    
                    # Map common pitching statistics
                    stats = {
                        "pid": player_id,
                        "name": player_name,
                        "team": map_team_name(team),
                        "pos": "P",  # Pitching
                        "season": season,
                        "g": safe_extract_number(row_data, ['試合', 'G', 'Games']),
                        "w": safe_extract_number(row_data, ['勝', 'W', 'Win']),
                        "l": safe_extract_number(row_data, ['負', 'L', 'Loss']),
                        "sv": safe_extract_number(row_data, ['セーブ', 'SV', 'Save']),
                        "hld": safe_extract_number(row_data, ['ホールド', 'HLD', 'Hold']),
                        "era": safe_extract_float(row_data, ['防御率', 'ERA']),
                        "ip": safe_extract_float(row_data, ['投球回', 'IP', 'Innings']),
                        "h": safe_extract_number(row_data, ['被安打', 'H', 'Hits']),
                        "r": safe_extract_number(row_data, ['失点', 'R', 'Runs']),
                        "er": safe_extract_number(row_data, ['自責点', 'ER']),
                        "bb": safe_extract_number(row_data, ['与四球', 'BB', 'Walk']),
                        "so": safe_extract_number(row_data, ['奪三振', 'SO', 'K']),
                        "hr": safe_extract_number(row_data, ['被本塁打', 'HR']),
                        "whip": safe_extract_float(row_data, ['WHIP'])
                    }
                    
                    # Only add if we have meaningful data
                    if stats["g"] is not None or stats["ip"] is not None:
                        players.append(stats)
    
    except Exception as e:
        print(f"Warning: Error parsing pitching stats: {e}")
    
    return players

def extract_player_id(href: str) -> Optional[str]:
    """Extract player ID from URL."""
    patterns = [
        r'/player[BP]/(\d+)\.html',
        r'/player[BP]/(\d+)_',
        r'/\d+/player[BP]/(\d+)\.html',
        r'player_id=(\d+)',
        r'/(\d{7})\.html'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, href)
        if match:
            return match.group(1)
    
    return None

def safe_extract_number(row_data, possible_columns: List[str]) -> Optional[int]:
    """Safely extract integer from pandas row."""
    for col in possible_columns:
        if col in row_data.index:
            try:
                val = row_data[col]
                if pd.isna(val):
                    continue
                # Clean the value
                val_str = str(val).replace(',', '').replace('-', '0').strip()
                if val_str and val_str.replace('.', '').isdigit():
                    return int(float(val_str))
            except (ValueError, TypeError):
                continue
    return None

def safe_extract_float(row_data, possible_columns: List[str]) -> Optional[float]:
    """Safely extract float from pandas row."""
    for col in possible_columns:
        if col in row_data.index:
            try:
                val = row_data[col]
                if pd.isna(val):
                    continue
                # Clean the value
                val_str = str(val).replace(',', '').replace('-', '0.0').strip()
                if val_str and val_str.replace('.', '').replace('-', '').isdigit():
                    return float(val_str)
            except (ValueError, TypeError):
                continue
    return None

def map_team_name(team: str) -> str:
    """Map team identifier to standard team code."""
    team_map = {
        "giants": "G", "swallows": "YS", "dragons": "D", 
        "tigers": "T", "carp": "C", "baystars": "DB",
        "hawks": "H", "fighters": "F", "lions": "L",
        "eagles": "E", "marines": "M", "buffaloes": "B",
        "league": "NPB"
    }
    
    return team_map.get(team, team.upper())

def save_stats_data(batting_players: List[Dict], pitching_players: List[Dict], 
                   date_str: str, discord_notify: bool = False):
    """Save combined statistics data to CSV."""
    output_dir = Path(f"data/bbdata/date={date_str}")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = output_dir / f"stats_{date_str}.csv"
    
    try:
        # Combine batting and pitching data
        all_players = batting_players + pitching_players
        
        # Remove duplicates (prefer more complete records)
        unique_players = {}
        for player in all_players:
            key = f"{player['pid']}_{player['pos']}"
            if key not in unique_players:
                unique_players[key] = player
            else:
                # Keep the record with more non-null values
                current = unique_players[key]
                if count_non_null(player) > count_non_null(current):
                    unique_players[key] = player
        
        final_players = list(unique_players.values())
        
        # Define all possible columns for comprehensive output
        all_columns = [
            'pid', 'name', 'team', 'pos', 'season',
            # Batting stats
            'g', 'pa', 'ab', 'h', '2b', '3b', 'hr', 'rbi', 'bb', 'so', 'sb', 'avg', 'obp', 'slg', 'ops',
            # Pitching stats  
            'w', 'l', 'sv', 'hld', 'era', 'ip', 'r', 'er', 'whip'
        ]
        
        # Write CSV
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            if final_players:
                writer = csv.DictWriter(f, fieldnames=all_columns, extrasaction='ignore')
                writer.writeheader()
                
                # Fill missing columns with None for cleaner output
                for player in final_players:
                    row = {col: player.get(col) for col in all_columns}
                    writer.writerow(row)
            else:
                writer = csv.writer(f)
                writer.writerow(all_columns)
        
        print(f"Saved {len(final_players)} player stats to {csv_path}")
        
        # Create gzipped version
        with open(csv_path, 'rb') as f_in:
            with gzip.open(f"{csv_path}.gz", 'wb') as f_out:
                f_out.writelines(f_in)
        
        # Discord notification
        if discord_notify and final_players:
            try:
                batting_count = len([p for p in final_players if p['pos'] == 'B'])
                pitching_count = len([p for p in final_players if p['pos'] == 'P'])
                
                send_csv(
                    csv_path=str(csv_path),
                    message=f"📈 Daily Player Stats Snapshot {date_str}\n"
                           f"Total players: {len(final_players)}\n"
                           f"Batters: {batting_count}, Pitchers: {pitching_count}\n"
                           f"Season: {CURRENT_YEAR}"
                )
                print("Discord notification sent")
            except Exception as e:
                print(f"Warning: Discord notification failed: {e}")
    
    except Exception as e:
        print(f"Error saving stats data: {e}")
        return False
    
    return True

def count_non_null(player_dict: Dict) -> int:
    """Count non-null values in player dictionary."""
    return sum(1 for v in player_dict.values() if v is not None and v != '')

def collect_stats_data(date_str: str, discord_notify: bool = False):
    """Main collection function for player statistics."""
    print(f"Starting stats collection for {date_str}")
    
    http_client = PoliteHttp(min_interval_s=MIN_INTERVAL_SEC)
    all_batting_players = []
    all_pitching_players = []
    
    # Metadata
    metadata = {
        "collection_date": date_str,
        "collection_timestamp": datetime.now().isoformat(),
        "source": "baseballdata.jp",
        "script_version": "1.0",
        "season": CURRENT_YEAR,
        "errors": [],
        "warnings": []
    }
    
    stats_urls = get_player_stats_urls(CURRENT_YEAR)
    print(f"Found {len(stats_urls)} stats URLs to process")
    
    for url_info in stats_urls:
        url = url_info["url"]
        stats_type = url_info["type"]
        team = url_info["team"]
        
        print(f"Processing {stats_type} stats for {team}: {url}")
        
        try:
            status_code, html = http_client.polite_get(url, timeout=20)
            
            if status_code == 200 and html:
                if stats_type == "batting":
                    players = parse_batting_stats_table(html, team, CURRENT_YEAR)
                    all_batting_players.extend(players)
                elif stats_type == "pitching":
                    players = parse_pitching_stats_table(html, team, CURRENT_YEAR)
                    all_pitching_players.extend(players)
                
                print(f"  Found {len(players)} {stats_type} players")
                
                # Store debug HTML
                debug_dir = Path(f"data/bbdata/date={date_str}/debug")
                debug_dir.mkdir(parents=True, exist_ok=True)
                
                debug_file = debug_dir / f"stats_{team}_{stats_type}.html"
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
    
    # Save metadata
    metadata["batting_players"] = len(all_batting_players)
    metadata["pitching_players"] = len(all_pitching_players)
    
    metadata_dir = Path(f"data/bbdata/date={date_str}")
    with open(metadata_dir / f"stats_metadata_{date_str}.json", 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    # Save results
    success = save_stats_data(all_batting_players, all_pitching_players, date_str, discord_notify)
    
    print(f"\nStats collection complete:")
    print(f"  Batting players: {len(all_batting_players)}")
    print(f"  Pitching players: {len(all_pitching_players)}")
    print(f"  Errors: {len(metadata['errors'])}")
    print(f"  Warnings: {len(metadata['warnings'])}")
    
    return success

def main():
    parser = argparse.ArgumentParser(description="BaseballData.jp player statistics collector")
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
    success = collect_stats_data(args.date, args.discord)
    
    if not success:
        print("Collection failed")
        sys.exit(1)
    
    print("Collection completed successfully")

if __name__ == "__main__":
    main()