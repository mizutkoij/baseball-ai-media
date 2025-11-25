#!/usr/bin/env python3
"""
KBO Integration System
Integrate existing KBO database with advanced sabermetrics calculations
Replace generated data with calculated advanced metrics
"""

import sqlite3
import sys
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging
from kbo_sabermetrics_engine import KBOSabermetricsEngine, BattingStats, PitchingStats

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KBOIntegrationSystem:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        self.sabermetrics_engine = KBOSabermetricsEngine()
        
    def connect_database(self):
        """Connect to the comprehensive baseball database"""
        try:
            return sqlite3.connect(self.db_path)
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise
    
    def get_kbo_players_with_stats(self) -> List[Dict[str, Any]]:
        """Get all KBO players with their basic statistics"""
        conn = self.connect_database()
        cursor = conn.cursor()
        
        # Get players with their yearly statistics
        query = """
        SELECT 
            p.player_id, p.full_name, p.current_team, p.primary_position, p.nationality,
            y.season, y.games_played, y.at_bats, y.hits, y.doubles, y.triples, 
            y.home_runs, y.runs, y.rbis, y.stolen_bases, y.walks, y.strikeouts,
            y.batting_avg, y.on_base_pct, y.slugging_pct, y.ops,
            y.innings_pitched, y.wins, y.losses, y.saves, y.era, y.whip,
            y.hits_allowed, y.runs_allowed, y.earned_runs, y.walks_allowed,
            y.strikeouts_pitched, y.home_runs_allowed
        FROM detailed_players_master p
        LEFT JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league = 'kbo' AND y.season IS NOT NULL
        ORDER BY p.player_id, y.season
        """
        
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Convert to list of dictionaries
        columns = [desc[0] for desc in cursor.description]
        players_data = []
        
        for row in results:
            player_dict = dict(zip(columns, row))
            players_data.append(player_dict)
        
        conn.close()
        logger.info(f"Retrieved {len(players_data)} player-season records")
        return players_data
    
    def calculate_advanced_stats_for_player(self, player_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate advanced statistics for a single player-season"""
        advanced_stats = {
            'player_id': player_data['player_id'],
            'season': player_data['season'],
            'calculated_stats': {}
        }
        
        # Check if player has batting stats
        if player_data['at_bats'] and player_data['at_bats'] > 0:
            # Calculate singles from hits and extra base hits
            singles = (player_data['hits'] or 0) - (player_data['doubles'] or 0) - (player_data['triples'] or 0) - (player_data['home_runs'] or 0)
            
            batting_stats = BattingStats(
                pa=max((player_data['at_bats'] or 0) + (player_data['walks'] or 0), player_data['at_bats'] or 0),
                ab=player_data['at_bats'] or 0,
                h=player_data['hits'] or 0,
                bb=player_data['walks'] or 0,
                hbp=0,  # Not available in current schema
                sf=0,   # Not available in current schema
                sh=0,   # Not available in current schema
                singles=max(singles, 0),
                doubles=player_data['doubles'] or 0,
                triples=player_data['triples'] or 0,
                hr=player_data['home_runs'] or 0,
                r=player_data['runs'] or 0,
                rbi=player_data['rbis'] or 0,
                sb=player_data['stolen_bases'] or 0,
                cs=0,   # Not available
                k=player_data['strikeouts'] or 0,
                gidp=0  # Not available
            )
            
            # Calculate advanced batting metrics
            batting_metrics = self.sabermetrics_engine.calculate_comprehensive_stats(
                batting_stats=batting_stats,
                player_info={
                    'games': player_data['games_played'] or 144,
                    'position': player_data['primary_position'] or 'RF'
                }
            )
            
            advanced_stats['calculated_stats'].update(batting_metrics['batting_metrics'])
        
        # Check if player has pitching stats
        if player_data['innings_pitched'] and player_data['innings_pitched'] > 0:
            pitching_stats = PitchingStats(
                ip=player_data['innings_pitched'] or 0.0,
                h=player_data['hits_allowed'] or 0,
                r=player_data['runs_allowed'] or 0,
                er=player_data['earned_runs'] or 0,
                bb=player_data['walks_allowed'] or 0,
                k=player_data['strikeouts_pitched'] or 0,
                hr=player_data['home_runs_allowed'] or 0,
                hbp=0,  # Not available
                wp=0,   # Not available
                bk=0,   # Not available
                bf=0,   # Not available
                wins=player_data['wins'] or 0,
                losses=player_data['losses'] or 0,
                saves=player_data['saves'] or 0,
                holds=0  # Not available
            )
            
            # Calculate advanced pitching metrics
            pitching_metrics = self.sabermetrics_engine.calculate_comprehensive_stats(
                pitching_stats=pitching_stats
            )
            
            advanced_stats['calculated_stats'].update(pitching_metrics['pitching_metrics'])
        
        return advanced_stats
    
    def create_advanced_stats_table(self):
        """Create table for storing advanced sabermetrics"""
        conn = self.connect_database()
        cursor = conn.cursor()
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS kbo_advanced_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            season INTEGER NOT NULL,
            
            -- Batting advanced stats
            woba REAL,
            wrc_plus INTEGER,
            babip REAL,
            batting_war REAL,
            
            -- Pitching advanced stats
            fip REAL,
            k_per_9 REAL,
            bb_per_9 REAL,
            k_bb_ratio REAL,
            pitching_war REAL,
            
            -- Meta information
            calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_source TEXT DEFAULT 'kbo_sabermetrics_engine',
            
            UNIQUE(player_id, season),
            FOREIGN KEY (player_id) REFERENCES detailed_players_master (player_id)
        )
        """)
        
        conn.commit()
        conn.close()
        logger.info("Advanced stats table created/verified")
    
    def update_advanced_stats(self, advanced_stats: List[Dict[str, Any]]):
        """Update the database with calculated advanced statistics"""
        conn = self.connect_database()
        cursor = conn.cursor()
        
        updated_count = 0
        
        for stats in advanced_stats:
            player_id = stats['player_id']
            season = stats['season']
            calc_stats = stats['calculated_stats']
            
            # Insert or update advanced stats
            cursor.execute("""
            INSERT OR REPLACE INTO kbo_advanced_stats 
            (player_id, season, woba, wrc_plus, babip, batting_war, 
             fip, k_per_9, bb_per_9, k_bb_ratio, pitching_war)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                player_id, season,
                calc_stats.get('woba'),
                calc_stats.get('wrc_plus'),
                calc_stats.get('babip'),
                calc_stats.get('war'),  # batting WAR
                calc_stats.get('fip'),
                calc_stats.get('k_per_9'),
                calc_stats.get('bb_per_9'),
                calc_stats.get('k_bb_ratio'),
                calc_stats.get('war') if 'fip' in calc_stats else None  # pitching WAR
            ))
            
            updated_count += 1
        
        conn.commit()
        conn.close()
        
        logger.info(f"Updated {updated_count} player-season advanced statistics")
        return updated_count
    
    def generate_league_summary(self) -> Dict[str, Any]:
        """Generate comprehensive KBO league summary with advanced stats"""
        conn = self.connect_database()
        cursor = conn.cursor()
        
        # Get basic league statistics
        cursor.execute("""
        SELECT 
            COUNT(DISTINCT p.player_id) as total_players,
            COUNT(DISTINCT p.current_team) as total_teams,
            COUNT(*) as total_player_seasons
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league = 'kbo'
        """)
        
        basic_stats = cursor.fetchone()
        
        # Get advanced stats summary
        cursor.execute("""
        SELECT 
            AVG(woba) as avg_woba,
            AVG(wrc_plus) as avg_wrc_plus,
            AVG(batting_war) as avg_batting_war,
            AVG(fip) as avg_fip,
            AVG(pitching_war) as avg_pitching_war,
            COUNT(*) as advanced_stats_records
        FROM kbo_advanced_stats
        """)
        
        advanced_summary = cursor.fetchone()
        
        # Get top performers
        cursor.execute("""
        SELECT p.full_name, p.current_team, a.season, a.batting_war
        FROM kbo_advanced_stats a
        JOIN detailed_players_master p ON a.player_id = p.player_id
        WHERE a.batting_war IS NOT NULL
        ORDER BY a.batting_war DESC
        LIMIT 5
        """)
        
        top_hitters = cursor.fetchall()
        
        cursor.execute("""
        SELECT p.full_name, p.current_team, a.season, a.pitching_war
        FROM kbo_advanced_stats a
        JOIN detailed_players_master p ON a.player_id = p.player_id
        WHERE a.pitching_war IS NOT NULL
        ORDER BY a.pitching_war DESC
        LIMIT 5
        """)
        
        top_pitchers = cursor.fetchall()
        
        conn.close()
        
        summary = {
            'league_overview': {
                'total_players': basic_stats[0],
                'total_teams': basic_stats[1],
                'total_player_seasons': basic_stats[2]
            },
            'advanced_stats_summary': {
                'avg_woba': round(advanced_summary[0] or 0, 3),
                'avg_wrc_plus': round(advanced_summary[1] or 0, 1),
                'avg_batting_war': round(advanced_summary[2] or 0, 1),
                'avg_fip': round(advanced_summary[3] or 0, 2),
                'avg_pitching_war': round(advanced_summary[4] or 0, 1),
                'records_calculated': advanced_summary[5]
            },
            'top_performers': {
                'hitters': [
                    {
                        'name': row[0],
                        'team': row[1],
                        'season': row[2],
                        'war': round(row[3], 1)
                    } for row in top_hitters
                ],
                'pitchers': [
                    {
                        'name': row[0],
                        'team': row[1],
                        'season': row[2],
                        'war': round(row[3], 1)
                    } for row in top_pitchers
                ]
            }
        }
        
        return summary
    
    def run_full_integration(self):
        """Run the complete integration process"""
        logger.info("Starting KBO advanced statistics integration...")
        
        # Create advanced stats table
        self.create_advanced_stats_table()
        
        # Get all player data
        players_data = self.get_kbo_players_with_stats()
        
        if not players_data:
            logger.warning("No KBO player data found in database")
            return
        
        # Calculate advanced stats for all players
        logger.info("Calculating advanced statistics...")
        advanced_stats = []
        
        for i, player_data in enumerate(players_data):
            if i % 50 == 0:
                logger.info(f"Processing player {i+1}/{len(players_data)}")
            
            try:
                stats = self.calculate_advanced_stats_for_player(player_data)
                if stats['calculated_stats']:  # Only add if we calculated something
                    advanced_stats.append(stats)
            except Exception as e:
                logger.warning(f"Error calculating stats for player {player_data.get('full_name', 'Unknown')}: {e}")
        
        # Update database
        updated_count = self.update_advanced_stats(advanced_stats)
        
        # Generate summary
        summary = self.generate_league_summary()
        
        # Print results
        print("\n" + "="*60)
        print("KBO ADVANCED STATISTICS INTEGRATION COMPLETE")
        print("="*60)
        print(f"Players processed: {len(players_data)}")
        print(f"Advanced stats calculated: {updated_count}")
        print(f"Records in database: {summary['advanced_stats_summary']['records_calculated']}")
        print()
        print("League Averages:")
        print(f"  wOBA: {summary['advanced_stats_summary']['avg_woba']}")
        print(f"  wRC+: {summary['advanced_stats_summary']['avg_wrc_plus']}")
        print(f"  FIP: {summary['advanced_stats_summary']['avg_fip']}")
        print()
        print("Top Hitters by WAR:")
        for hitter in summary['top_performers']['hitters']:
            print(f"  {hitter['name']} ({hitter['team']}, {hitter['season']}): {hitter['war']} WAR")
        print()
        print("Top Pitchers by WAR:")
        for pitcher in summary['top_performers']['pitchers']:
            print(f"  {pitcher['name']} ({pitcher['team']}, {pitcher['season']}): {pitcher['war']} WAR")
        
        return summary

def main():
    """Main execution function"""
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        # Test mode - just verify connection
        integration = KBOIntegrationSystem()
        try:
            players = integration.get_kbo_players_with_stats()
            print(f"Test successful: Found {len(players)} KBO player-season records")
            if players:
                sample = players[0]
                print(f"Sample player: {sample['full_name']} ({sample['current_team']})")
        except Exception as e:
            print(f"Test failed: {e}")
        return
    
    # Full integration
    integration = KBOIntegrationSystem()
    integration.run_full_integration()

if __name__ == "__main__":
    main()