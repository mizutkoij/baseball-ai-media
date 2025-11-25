#!/usr/bin/env python3
"""
scripts/bbdata_player_gamelog.py - 試合別成績（ゲームログ）の日次スナップショット

出力: data/bbdata/date=YYYY-MM-DD/gamelog_YYYY-MM-DD.csv
カラム: pid,name,team,game_date,opponent,h,ab,r,rbi,bb,so,avg_game
       (投手の場合: pid,name,team,game_date,opponent,w,l,sv,ip,h,r,er,bb,so,era_game)

Usage:
    python scripts/bbdata_player_gamelog.py --date 2025-08-14 [--discord]
"""
import sys
import os
import argparse
import json
import csv
import gzip
from datetime import datetime, timedelta
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

def get_recent_player_ids(season: int = None) -> List[str]:
    """Get list of active player IDs from roster or recent data."""
    if season is None:
        season = CURRENT_YEAR
    
    # Try to read from previous roster collection
    roster_files = []
    data_dir = Path("data/bbdata")
    
    if data_dir.exists():
        # Look for recent roster files
        for date_dir in sorted(data_dir.glob("date=*"), reverse=True)[:7]:  # Last 7 days
            roster_file = date_dir / f"players_{date_dir.name.split('=')[1]}.csv"
            if roster_file.exists():
                roster_files.append(roster_file)
    
    player_ids = set()
    
    # Extract player IDs from roster files
    for roster_file in roster_files[:3]:  # Use last 3 files
        try:
            with open(roster_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if 'pid' in row and row['pid']:
                        player_ids.add(row['pid'])
        except Exception as e:
            print(f"Warning: Could not read roster file {roster_file}: {e}")
    
    # If no roster data found, generate common player ID patterns
    if not player_ids:
        print("No roster data found, using fallback player ID generation")
        # Generate recent entry years (last 5 years)
        for year in range(season - 4, season + 1):
            for num in range(1, 151):  # Common range for player numbers
                player_ids.add(f"{year:04d}{num:03d}")
    
    return list(player_ids)

def get_gamelog_urls(player_id: str, season: int = None) -> List[Dict[str, str]]:
    """Get gamelog URLs for a specific player."""
    if season is None:
        season = CURRENT_YEAR
    
    urls = []
    
    # Determine if player is batter or pitcher from ID pattern or try both
    for pos in ['B', 'P']:
        # Main gamelog page (season view)
        gamelog_url = f"{BASE_URL}/{season}/player{pos}/{player_id}S.html"
        urls.append({
            "url": gamelog_url, 
            "type": "gamelog", 
            "player_id": player_id, 
            "pos": pos,
            "season": season
        })
        
        # Alternative URL patterns
        alt_url = f"{BASE_URL}/player{pos}/{player_id}S.html"
        urls.append({
            "url": alt_url, 
            "type": "gamelog", 
            "player_id": player_id, 
            "pos": pos,
            "season": season
        })
    
    return urls

def parse_gamelog_table(html: str, player_id: str, pos: str, season: int) -> List[Dict[str, Union[str, float, int]]]:
    """Parse game-by-game statistics from HTML table."""
    games = []
    
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Extract player name from title or header
        player_name = extract_player_name(soup)
        
        # Use pandas to parse HTML tables
        tables = pd.read_html(html, flavor='bs4')
        
        for table_df in tables:
            if len(table_df.columns) < 5:
                continue
            
            # Look for game log indicators
            gamelog_indicators = ['日付', '対戦', '試合', 'Date', '相手', 'VS']
            has_gamelog_cols = any(col in str(table_df.columns) for col in gamelog_indicators)
            
            if not has_gamelog_cols:
                continue
            
            # Process each row as a game
            for idx, row in table_df.iterrows():
                try:
                    # Extract game date
                    game_date = extract_game_date(row)
                    if not game_date:
                        continue
                    
                    # Extract opponent
                    opponent = extract_opponent(row)
                    
                    if pos == 'B':  # Batting stats
                        game_stats = {
                            "pid": player_id,
                            "name": player_name or f"Player_{player_id}",
                            "team": extract_team_from_opponent(opponent),
                            "game_date": game_date,
                            "opponent": opponent,
                            "h": safe_extract_number(row, ['安打', 'H', 'ヒット']),
                            "ab": safe_extract_number(row, ['打数', 'AB']),
                            "r": safe_extract_number(row, ['得点', 'R', 'Run']),
                            "rbi": safe_extract_number(row, ['打点', 'RBI']),
                            "bb": safe_extract_number(row, ['四球', 'BB', 'Walk']),
                            "so": safe_extract_number(row, ['三振', 'SO', 'K']),
                            "avg_game": safe_extract_float(row, ['打率', 'AVG'])
                        }
                    else:  # Pitching stats
                        game_stats = {
                            "pid": player_id,
                            "name": player_name or f"Player_{player_id}",
                            "team": extract_team_from_opponent(opponent),
                            "game_date": game_date,
                            "opponent": opponent,
                            "w": safe_extract_number(row, ['勝', 'W', 'Win']),
                            "l": safe_extract_number(row, ['負', 'L', 'Loss']),
                            "sv": safe_extract_number(row, ['セーブ', 'SV', 'Save']),
                            "ip": safe_extract_float(row, ['投球回', 'IP', 'Innings']),
                            "h": safe_extract_number(row, ['被安打', 'H', 'Hits']),
                            "r": safe_extract_number(row, ['失点', 'R', 'Runs']),
                            "er": safe_extract_number(row, ['自責点', 'ER']),
                            "bb": safe_extract_number(row, ['与四球', 'BB', 'Walk']),
                            "so": safe_extract_number(row, ['奪三振', 'SO', 'K']),
                            "era_game": safe_extract_float(row, ['防御率', 'ERA'])
                        }
                    
                    # Only add if we have meaningful data
                    if game_stats.get("ab") is not None or game_stats.get("ip") is not None:
                        games.append(game_stats)
                
                except Exception as e:
                    print(f"Warning: Error processing game row for {player_id}: {e}")
                    continue
    
    except Exception as e:
        print(f"Warning: Error parsing gamelog for {player_id}: {e}")
    
    return games

def extract_player_name(soup) -> Optional[str]:
    """Extract player name from page."""
    try:
        # Try title tag
        if soup.title:
            title_text = soup.title.get_text()
            name_match = re.search(r'^([^-\s]+)', title_text)
            if name_match:
                return name_match.group(1).strip()
        
        # Try h1 or h2 tags
        for tag in soup.find_all(['h1', 'h2', 'h3']):
            text = tag.get_text(strip=True)
            if text and len(text) < 20:  # Likely a name
                return text
    
    except Exception:
        pass
    
    return None

def extract_game_date(row) -> Optional[str]:
    """Extract game date from table row."""
    date_columns = ['日付', 'Date', '試合日', 'GameDate']
    
    for col in date_columns:
        if col in row.index:
            try:
                date_val = row[col]
                if pd.isna(date_val):
                    continue
                
                date_str = str(date_val).strip()
                
                # Try various date formats
                date_patterns = [
                    r'(\d{4})/(\d{1,2})/(\d{1,2})',
                    r'(\d{4})-(\d{1,2})-(\d{1,2})',
                    r'(\d{1,2})/(\d{1,2})',  # MM/DD format
                    r'(\d{1,2})-(\d{1,2})'   # MM-DD format
                ]
                
                for pattern in date_patterns:
                    match = re.search(pattern, date_str)
                    if match:
                        if len(match.groups()) == 3:  # Full date
                            year, month, day = match.groups()
                            return f"{year}-{int(month):02d}-{int(day):02d}"
                        elif len(match.groups()) == 2:  # Month/Day only
                            month, day = match.groups()
                            return f"{CURRENT_YEAR}-{int(month):02d}-{int(day):02d}"
            
            except Exception:
                continue
    
    return None

def extract_opponent(row) -> Optional[str]:
    """Extract opponent from table row."""
    opponent_columns = ['対戦', '相手', 'VS', 'Opponent', '対']
    
    for col in opponent_columns:
        if col in row.index:
            try:
                opponent_val = row[col]
                if pd.isna(opponent_val):
                    continue
                
                opponent_str = str(opponent_val).strip()
                if opponent_str and len(opponent_str) < 10:
                    return opponent_str
            
            except Exception:
                continue
    
    return None

def extract_team_from_opponent(opponent: str) -> str:
    """Extract team code from opponent info."""
    if not opponent:
        return "Unknown"
    
    # Team name mappings
    team_mappings = {
        "巨人": "G", "ヤクルト": "YS", "中日": "D", "阪神": "T", 
        "広島": "C", "DeNA": "DB", "ソフトバンク": "H", "日本ハム": "F", 
        "西武": "L", "楽天": "E", "ロッテ": "M", "オリックス": "B"
    }
    
    for team_name, code in team_mappings.items():
        if team_name in opponent:
            return code
    
    return opponent[:3]  # Fallback to first 3 characters

def safe_extract_number(row_data, possible_columns: List[str]) -> Optional[int]:
    """Safely extract integer from pandas row."""
    for col in possible_columns:
        if col in row_data.index:
            try:
                val = row_data[col]
                if pd.isna(val):
                    continue
                
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
                
                val_str = str(val).replace(',', '').replace('-', '0.0').strip()
                if val_str and val_str.replace('.', '').replace('-', '').isdigit():
                    return float(val_str)
            
            except (ValueError, TypeError):
                continue
    
    return None

def save_gamelog_data(all_games: List[Dict], date_str: str, discord_notify: bool = False):
    """Save gamelog data to CSV."""
    output_dir = Path(f"data/bbdata/date={date_str}")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = output_dir / f"gamelog_{date_str}.csv"
    
    try:
        # Remove duplicates
        unique_games = {}
        for game in all_games:
            key = f"{game['pid']}_{game['game_date']}_{game.get('opponent', '')}"
            if key not in unique_games:
                unique_games[key] = game
        
        final_games = list(unique_games.values())
        
        # Define all possible columns
        all_columns = [
            'pid', 'name', 'team', 'game_date', 'opponent',
            # Batting stats
            'h', 'ab', 'r', 'rbi', 'bb', 'so', 'avg_game',
            # Pitching stats
            'w', 'l', 'sv', 'ip', 'er', 'era_game'
        ]
        
        # Write CSV
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            if final_games:
                writer = csv.DictWriter(f, fieldnames=all_columns, extrasaction='ignore')
                writer.writeheader()
                
                for game in final_games:
                    row = {col: game.get(col) for col in all_columns}
                    writer.writerow(row)
            else:
                writer = csv.writer(f)
                writer.writerow(all_columns)
        
        print(f"Saved {len(final_games)} game logs to {csv_path}")
        
        # Create gzipped version
        with open(csv_path, 'rb') as f_in:
            with gzip.open(f"{csv_path}.gz", 'wb') as f_out:
                f_out.writelines(f_in)
        
        # Discord notification
        if discord_notify and final_games:
            try:
                batting_games = len([g for g in final_games if 'ab' in g and g['ab'] is not None])
                pitching_games = len([g for g in final_games if 'ip' in g and g['ip'] is not None])
                
                send_csv(
                    csv_path=str(csv_path),
                    message=f"🎯 Daily Game Log Snapshot {date_str}\n"
                           f"Total game logs: {len(final_games)}\n"
                           f"Batting games: {batting_games}, Pitching games: {pitching_games}\n"
                           f"Season: {CURRENT_YEAR}"
                )
                print("Discord notification sent")
            except Exception as e:
                print(f"Warning: Discord notification failed: {e}")
    
    except Exception as e:
        print(f"Error saving gamelog data: {e}")
        return False
    
    return True

def collect_gamelog_data(date_str: str, discord_notify: bool = False):
    """Main collection function for game logs."""
    print(f"Starting gamelog collection for {date_str}")
    
    http_client = PoliteHttp(min_interval_s=MIN_INTERVAL_SEC)
    all_games = []
    
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
    
    # Get list of player IDs to process
    player_ids = get_recent_player_ids(CURRENT_YEAR)
    print(f"Found {len(player_ids)} player IDs to process")
    
    # Limit to reasonable number for daily collection
    sample_size = min(100, len(player_ids))  # Process up to 100 players daily
    sampled_player_ids = player_ids[:sample_size]
    
    print(f"Processing {len(sampled_player_ids)} players (sampled)")
    
    for player_id in sampled_player_ids:
        print(f"Processing player: {player_id}")
        
        gamelog_urls = get_gamelog_urls(player_id, CURRENT_YEAR)
        
        for url_info in gamelog_urls:
            url = url_info["url"]
            pos = url_info["pos"]
            
            try:
                status_code, html = http_client.polite_get(url, timeout=20)
                
                if status_code == 200 and html:
                    games = parse_gamelog_table(html, player_id, pos, CURRENT_YEAR)
                    all_games.extend(games)
                    
                    print(f"  Found {len(games)} games for {player_id} ({pos})")
                    
                    # Store debug HTML for troubleshooting
                    debug_dir = Path(f"data/bbdata/date={date_str}/debug")
                    debug_dir.mkdir(parents=True, exist_ok=True)
                    
                    debug_file = debug_dir / f"gamelog_{player_id}_{pos}.html"
                    with open(debug_file, 'w', encoding='utf-8') as f:
                        f.write(html)
                    
                    # Break after first successful fetch for this player
                    if games:
                        break
                
                elif status_code == 404:
                    # Expected for many players - not all have gamelog pages
                    pass
                elif status_code == 451:
                    metadata["warnings"].append(f"Blocked by robots.txt: {url}")
                else:
                    metadata["errors"].append(f"HTTP {status_code} for {url}")
            
            except Exception as e:
                error_msg = f"Exception processing {url}: {str(e)}"
                metadata["errors"].append(error_msg)
                continue
    
    # Save metadata
    metadata["total_games"] = len(all_games)
    metadata["players_processed"] = len(sampled_player_ids)
    
    metadata_dir = Path(f"data/bbdata/date={date_str}")
    with open(metadata_dir / f"gamelog_metadata_{date_str}.json", 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    # Save results
    success = save_gamelog_data(all_games, date_str, discord_notify)
    
    print(f"\nGamelog collection complete:")
    print(f"  Total game logs: {len(all_games)}")
    print(f"  Players processed: {len(sampled_player_ids)}")
    print(f"  Errors: {len(metadata['errors'])}")
    print(f"  Warnings: {len(metadata['warnings'])}")
    
    return success

def main():
    parser = argparse.ArgumentParser(description="BaseballData.jp game log collector")
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
    success = collect_gamelog_data(args.date, args.discord)
    
    if not success:
        print("Collection failed")
        sys.exit(1)
    
    print("Collection completed successfully")

if __name__ == "__main__":
    main()