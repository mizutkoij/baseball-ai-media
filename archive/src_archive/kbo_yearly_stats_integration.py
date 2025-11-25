#!/usr/bin/env python3
"""
KBO Yearly Statistics Integration
Generate realistic yearly performance data for expanded KBO players
"""

import sqlite3
import json
import random
import datetime
from typing import Dict, List, Any

class KBOYearlyStatsIntegration:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        
    def get_kbo_players(self) -> List[Dict[str, Any]]:
        """Get all KBO players from the database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT player_id, full_name, primary_position, current_team, 
                   birth_date, debut_date, pro_years, nationality
            FROM detailed_players_master 
            WHERE league = 'kbo'
        """)
        
        players = []
        for row in cursor.fetchall():
            players.append({
                'player_id': row[0],
                'full_name': row[1],
                'position': row[2],
                'team': row[3],
                'birth_date': row[4],
                'debut_date': row[5],
                'pro_years': row[6],
                'nationality': row[7]
            })
        
        conn.close()
        return players
    
    def generate_yearly_performance(self, player: Dict[str, Any], season: int) -> Dict[str, Any]:
        """Generate realistic yearly performance for a player in a given season"""
        position = player['position']
        
        # Calculate player age for the season
        birth_year = int(player['birth_date'].split('-')[0])
        age = season - birth_year
        
        # Age adjustment factor (peak around 27-30)
        if age < 23:
            age_factor = 0.85 + (age - 18) * 0.03  # Young player developing
        elif age <= 30:
            age_factor = 0.98 + random.uniform(-0.05, 0.07)  # Peak years
        elif age <= 35:
            age_factor = 0.95 - (age - 30) * 0.02  # Gradual decline
        else:
            age_factor = max(0.70, 0.85 - (age - 35) * 0.03)  # Veteran decline
        
        # Generate stats based on position
        if position == 'P':  # Pitcher
            # Determine starter vs reliever
            is_starter = random.random() < 0.4  # 40% starters
            
            if is_starter:
                games_started = int(random.uniform(20, 33) * age_factor)
                games_pitched = games_started + random.randint(0, 5)
                innings_pitched = games_started * random.uniform(5.5, 7.2)
                
                wins = max(0, int(games_started * random.uniform(0.3, 0.7)))
                losses = max(0, int(games_started * random.uniform(0.2, 0.6)))
                saves = 0
                holds = random.randint(0, 3)
            else:
                games_pitched = int(random.uniform(40, 70) * age_factor)
                games_started = 0
                innings_pitched = games_pitched * random.uniform(0.8, 1.3)
                
                wins = random.randint(2, 8)
                losses = random.randint(1, 6)
                saves = random.randint(0, 35) if random.random() < 0.3 else 0  # Closer
                holds = random.randint(5, 25) if saves < 10 else random.randint(0, 5)
            
            # ERA and WHIP
            base_era = random.uniform(2.80, 4.50)
            era = max(1.50, base_era * (2.0 - age_factor))
            
            hits_allowed = int(innings_pitched * random.uniform(0.8, 1.3))
            walks_allowed = int(innings_pitched * random.uniform(0.25, 0.45))
            strikeouts_pitched = int(innings_pitched * random.uniform(0.6, 1.2))
            home_runs_allowed = max(0, int(innings_pitched * random.uniform(0.08, 0.15)))
            
            earned_runs = int(innings_pitched * era / 9)
            runs_allowed = int(earned_runs * random.uniform(1.0, 1.15))
            
            whip = (hits_allowed + walks_allowed) / max(innings_pitched, 1)
            
            return {
                'season': season,
                'age': age,
                'team_name': player['team'],
                'league_level': 'KBO',
                'games_pitched': games_pitched,
                'games_started_pitcher': games_started,
                'complete_games': random.randint(0, 3) if is_starter else 0,
                'shutouts': random.randint(0, 2) if is_starter else 0,
                'innings_pitched': round(innings_pitched, 1),
                'hits_allowed': hits_allowed,
                'runs_allowed': runs_allowed,
                'earned_runs': earned_runs,
                'home_runs_allowed': home_runs_allowed,
                'walks_allowed': walks_allowed,
                'strikeouts_pitched': strikeouts_pitched,
                'wins': wins,
                'losses': losses,
                'saves': saves,
                'holds': holds,
                'blown_saves': max(0, int(saves * random.uniform(0.1, 0.25))) if saves > 0 else 0,
                'era': round(era, 2),
                'whip': round(whip, 3),
                
                # Minimal batting stats for pitchers
                'games_played': games_pitched,
                'plate_appearances': random.randint(0, 15),
                'at_bats': random.randint(0, 12),
                'hits': random.randint(0, 3),
                'runs': random.randint(0, 2),
                'rbis': random.randint(0, 2),
                'home_runs': 0,
                'batting_avg': round(random.uniform(0.000, 0.150), 3),
                'on_base_pct': round(random.uniform(0.000, 0.200), 3),
                'slugging_pct': round(random.uniform(0.000, 0.200), 3),
                'ops': round(random.uniform(0.000, 0.400), 3)
            }
        
        else:  # Position player
            # Games played based on position and age
            position_games = {
                'C': 110, '1B': 140, '2B': 135, '3B': 135, 'SS': 130,
                'LF': 130, 'CF': 145, 'RF': 135, 'DH': 120
            }.get(position, 130)
            
            games_played = int(position_games * age_factor * random.uniform(0.8, 1.1))
            games_played = max(20, min(games_played, 144))  # KBO season length
            
            # Batting stats
            plate_appearances = int(games_played * random.uniform(3.8, 4.5))
            at_bats = int(plate_appearances * random.uniform(0.85, 0.92))
            
            # Position-specific batting performance
            position_ba = {
                'C': 0.245, '1B': 0.275, '2B': 0.265, '3B': 0.255, 'SS': 0.250,
                'LF': 0.270, 'CF': 0.260, 'RF': 0.265, 'DH': 0.270
            }.get(position, 0.260)
            
            batting_avg = max(0.180, position_ba * age_factor + random.uniform(-0.040, 0.040))
            hits = int(at_bats * batting_avg)
            
            # Power numbers
            position_power = {
                'C': 0.012, '1B': 0.030, '2B': 0.008, '3B': 0.018, 'SS': 0.010,
                'LF': 0.022, 'CF': 0.015, 'RF': 0.025, 'DH': 0.028
            }.get(position, 0.015)
            
            home_runs = max(0, int(at_bats * position_power * random.uniform(0.5, 2.0)))
            doubles = int(hits * random.uniform(0.15, 0.25))
            triples = random.randint(0, 5) if position in ['CF', 'LF', 'RF'] else random.randint(0, 2)
            
            # Walks and strikeouts
            walks = int(plate_appearances * random.uniform(0.06, 0.15))
            strikeouts = int(plate_appearances * random.uniform(0.12, 0.25))
            
            # Runs and RBIs
            runs = int(hits * random.uniform(0.5, 0.8) + walks * 0.3)
            rbis = max(home_runs, int(hits * random.uniform(0.4, 0.7)))
            
            # Stolen bases (speed positions)
            sb_factor = {
                'C': 0.02, '1B': 0.03, '2B': 0.08, '3B': 0.06, 'SS': 0.07,
                'LF': 0.05, 'CF': 0.09, 'RF': 0.04, 'DH': 0.02
            }.get(position, 0.05)
            
            stolen_bases = max(0, int(games_played * sb_factor * random.uniform(0.5, 2.0)))
            caught_stealing = max(0, int(stolen_bases * random.uniform(0.15, 0.35)))
            
            # Calculate advanced stats
            on_base_pct = (hits + walks) / max(plate_appearances, 1)
            total_bases = hits + doubles + (triples * 2) + (home_runs * 3)
            slugging_pct = total_bases / max(at_bats, 1)
            ops = on_base_pct + slugging_pct
            
            return {
                'season': season,
                'age': age,
                'team_name': player['team'],
                'league_level': 'KBO',
                'games_played': games_played,
                'games_started': int(games_played * random.uniform(0.85, 0.95)),
                'plate_appearances': plate_appearances,
                'at_bats': at_bats,
                'hits': hits,
                'runs': runs,
                'rbis': rbis,
                'doubles': doubles,
                'triples': triples,
                'home_runs': home_runs,
                'walks': walks,
                'strikeouts': strikeouts,
                'stolen_bases': stolen_bases,
                'caught_stealing': caught_stealing,
                'batting_avg': round(batting_avg, 3),
                'on_base_pct': round(on_base_pct, 3),
                'slugging_pct': round(slugging_pct, 3),
                'ops': round(ops, 3),
                
                # No pitching stats for position players
                'games_pitched': 0,
                'wins': 0,
                'losses': 0,
                'saves': 0,
                'era': None,
                'innings_pitched': 0.0
            }
    
    def integrate_yearly_stats(self) -> Dict[str, Any]:
        """Generate and integrate yearly stats for all KBO players"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get all KBO players
            players = self.get_kbo_players()
            
            # Clear existing KBO yearly performance data
            cursor.execute("DELETE FROM yearly_performance WHERE league_level = 'KBO'")
            
            # Generate stats for recent seasons (2020-2024)
            seasons = [2020, 2021, 2022, 2023, 2024]
            
            total_records = 0
            for player in players:
                debut_year = int(player['debut_date'].split('-')[0])
                
                for season in seasons:
                    # Skip if player hadn't debuted yet
                    if season < debut_year:
                        continue
                    
                    # Generate performance for this season
                    performance = self.generate_yearly_performance(player, season)
                    
                    # Insert into database
                    cursor.execute("""
                        INSERT INTO yearly_performance (
                            player_id, season, age, team_name, league_level,
                            games_played, games_started, plate_appearances, at_bats,
                            hits, runs, rbis, doubles, triples, home_runs,
                            walks, strikeouts, stolen_bases, caught_stealing,
                            batting_avg, on_base_pct, slugging_pct, ops,
                            games_pitched, games_started_pitcher, innings_pitched,
                            wins, losses, saves, holds, era, whip,
                            hits_allowed, runs_allowed, earned_runs, strikeouts_pitched
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        player['player_id'], performance['season'], performance['age'],
                        performance['team_name'], performance['league_level'],
                        performance['games_played'], performance.get('games_started', 0),
                        performance.get('plate_appearances', 0), performance.get('at_bats', 0),
                        performance.get('hits', 0), performance.get('runs', 0), performance.get('rbis', 0),
                        performance.get('doubles', 0), performance.get('triples', 0), performance.get('home_runs', 0),
                        performance.get('walks', 0), performance.get('strikeouts', 0),
                        performance.get('stolen_bases', 0), performance.get('caught_stealing', 0),
                        performance.get('batting_avg', 0.0), performance.get('on_base_pct', 0.0),
                        performance.get('slugging_pct', 0.0), performance.get('ops', 0.0),
                        performance.get('games_pitched', 0), performance.get('games_started_pitcher', 0),
                        performance.get('innings_pitched', 0.0), performance.get('wins', 0),
                        performance.get('losses', 0), performance.get('saves', 0), performance.get('holds', 0),
                        performance.get('era'), performance.get('whip'),
                        performance.get('hits_allowed', 0), performance.get('runs_allowed', 0),
                        performance.get('earned_runs', 0), performance.get('strikeouts_pitched', 0)
                    ))
                    
                    total_records += 1
            
            conn.commit()
            
            # Generate summary
            cursor.execute("SELECT COUNT(*) FROM yearly_performance WHERE league_level = 'KBO'")
            total_performance_records = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT season, COUNT(*) 
                FROM yearly_performance 
                WHERE league_level = 'KBO' 
                GROUP BY season 
                ORDER BY season
            """)
            season_distribution = dict(cursor.fetchall())
            
            conn.close()
            
            return {
                'success': True,
                'total_players': len(players),
                'total_performance_records': total_performance_records,
                'seasons_covered': seasons,
                'season_distribution': season_distribution,
                'records_per_player': total_performance_records / len(players) if players else 0
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

def main():
    """Main execution function"""
    print("KBO Yearly Statistics Integration")
    print("=" * 50)
    
    stats_integration = KBOYearlyStatsIntegration()
    
    print("Generating yearly performance data for KBO players...")
    result = stats_integration.integrate_yearly_stats()
    
    if result['success']:
        print("Yearly statistics integration successful!")
        print(f"Total players: {result['total_players']}")
        print(f"Total performance records: {result['total_performance_records']}")
        print(f"Average records per player: {result['records_per_player']:.1f}")
        
        print("\nSeason Distribution:")
        for season, count in result['season_distribution'].items():
            print(f"  {season}: {count} player records")
            
        # Save summary
        with open('kbo_yearly_stats_summary.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print("\nSummary saved to kbo_yearly_stats_summary.json")
        
    else:
        print(f"Integration failed: {result['error']}")

if __name__ == "__main__":
    main()