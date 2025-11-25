#!/usr/bin/env python3
"""
KBO Database Expansion System
Advanced KBO league data generation with realistic stats, historical depth, and comprehensive coverage
"""

import sqlite3
import json
import random
import datetime
from typing import Dict, List, Any
from dataclasses import dataclass
import math

@dataclass
class KBOPlayer:
    player_id: str
    full_name: str
    name_kana: str
    team: str
    position: str
    nationality: str
    birth_date: str
    height: int
    weight: int
    bat_throw: str
    debut_year: int
    career_stats: Dict[str, Any]

class KBOExpansionSystem:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        self.kbo_teams = {
            'Doosan Bears': {'city': 'Seoul', 'stadium': 'Jamsil Baseball Stadium', 'founded': 1982, 'colors': ['Navy', 'Red']},
            'Hanwha Eagles': {'city': 'Daejeon', 'stadium': 'Daejeon Hanwha Life Ballpark', 'founded': 1985, 'colors': ['Orange', 'Black']},
            'Kia Tigers': {'city': 'Gwangju', 'stadium': 'Gwangju Champions Field', 'founded': 1982, 'colors': ['Red', 'Black']},
            'LG Twins': {'city': 'Seoul', 'stadium': 'Jamsil Baseball Stadium', 'founded': 1982, 'colors': ['Red', 'Gray']},
            'Lotte Giants': {'city': 'Busan', 'stadium': 'Sajik Baseball Stadium', 'founded': 1975, 'colors': ['Blue', 'White']},
            'NC Dinos': {'city': 'Changwon', 'stadium': 'Changwon NC Park', 'founded': 2013, 'colors': ['Blue', 'Gold']},
            'Samsung Lions': {'city': 'Daegu', 'stadium': 'Daegu Samsung Lions Park', 'founded': 1982, 'colors': ['Blue', 'White']},
            'SSG Landers': {'city': 'Incheon', 'stadium': 'Incheon SSG Landers Field', 'founded': 2000, 'colors': ['Red', 'Black']},
            'KT Wiz': {'city': 'Suwon', 'stadium': 'Suwon KT Wiz Park', 'founded': 2015, 'colors': ['Black', 'Red']},
            'Kiwoom Heroes': {'city': 'Seoul', 'stadium': 'Gocheok Sky Dome', 'founded': 2008, 'colors': ['Burgundy', 'Gold']}
        }
        
        # Realistic Korean names (romanized)
        self.korean_surnames = [
            'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim',
            'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'Ahn', 'Song', 'Jeon', 'Hong',
            'Yang', 'Ha', 'Yoo', 'No', 'Jeong', 'Sim', 'Woo', 'Moon', 'Nam', 'Go'
        ]
        
        self.korean_given_names = [
            'MinSoo', 'JiHoon', 'SangHyun', 'DongHyun', 'JaeHyun', 'SeungHo', 'JunHo', 'TaeHyun',
            'HyunWoo', 'SungMin', 'YoungSoo', 'JiWon', 'SeokJin', 'WooJin', 'JiSung', 'MyungHo',
            'KyungHo', 'JinWoo', 'HyeongJun', 'SangWoo', 'DaeHyun', 'SeungWoo', 'JongHyun', 'TaeWoo',
            'HyunSoo', 'ChangHo', 'JaeWon', 'DongWoo', 'SungHo', 'YongJun', 'JiHyun', 'SeungJin'
        ]
        
        # Foreign player names (realistic distribution)
        self.foreign_names = [
            ('Aaron Altherr', 'USA'), ('Mel Rojas Jr.', 'Dominican Republic'), ('Jose Pirela', 'Venezuela'),
            ('Tyler Saladino', 'USA'), ('Ryan McBroom', 'USA'), ('Yasiel Puig', 'Cuba'),
            ('Josh Lindblom', 'USA'), ('Drew Rucinski', 'USA'), ('David Buchanan', 'USA'),
            ('Dan Straily', 'USA'), ('Eric Jokisch', 'USA'), ('William Cuevas', 'Venezuela'),
            ('Ariel Miranda', 'Cuba'), ('Jake Thompson', 'USA'), ('Warwick Saupold', 'Australia'),
            ('Ricardo Pinto', 'Brazil'), ('Chris Flexen', 'USA'), ('Tyler Wilson', 'USA'),
            ('Jake Brigham', 'USA'), ('Ben Lively', 'USA'), ('Raul Alcantara', 'Dominican Republic'),
            ('Felix Hernandez', 'Venezuela'), ('Adrian Sampson', 'USA'), ('Casey Kelly', 'USA')
        ]
        
        self.positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']
        
    def generate_realistic_stats(self, position: str, years_active: int) -> Dict[str, Any]:
        """Generate realistic career statistics based on position and experience"""
        stats = {
            'games_played': 0,
            'at_bats': 0,
            'hits': 0,
            'runs': 0,
            'rbi': 0,
            'home_runs': 0,
            'stolen_bases': 0,
            'batting_average': 0.0,
            'on_base_percentage': 0.0,
            'slugging_percentage': 0.0,
            'ops': 0.0
        }
        
        if position == 'P':  # Pitcher
            # Pitchers have minimal batting stats in KBO
            stats.update({
                'games_played': min(random.randint(15, 45) * years_active, 400),
                'at_bats': random.randint(0, 10) * years_active,
                'wins': random.randint(3, 18) * years_active,
                'losses': random.randint(2, 15) * years_active,
                'era': round(random.uniform(2.50, 5.50), 2),
                'innings_pitched': round(random.uniform(50, 200) * years_active, 1),
                'strikeouts': random.randint(40, 180) * years_active,
                'saves': random.randint(0, 30) * years_active if random.random() < 0.3 else 0
            })
        else:  # Position player
            # Base games per year by position
            base_games = {
                'C': 100, '1B': 130, '2B': 125, '3B': 125, 'SS': 120,
                'LF': 120, 'CF': 135, 'RF': 125, 'DH': 110
            }.get(position, 120)
            
            games = min(random.randint(base_games - 20, base_games + 20) * years_active, 1500)
            at_bats = games * random.randint(3, 5)
            
            # Batting average varies by position
            ba_base = {
                'C': 0.250, '1B': 0.280, '2B': 0.270, '3B': 0.265, 'SS': 0.255,
                'LF': 0.275, 'CF': 0.265, 'RF': 0.270, 'DH': 0.275
            }.get(position, 0.265)
            
            batting_avg = max(0.200, min(0.350, ba_base + random.uniform(-0.040, +0.040)))
            hits = int(at_bats * batting_avg)
            
            # Power numbers vary significantly by position
            hr_rate = {
                'C': 0.015, '1B': 0.035, '2B': 0.012, '3B': 0.020, 'SS': 0.015,
                'LF': 0.025, 'CF': 0.018, 'RF': 0.028, 'DH': 0.032
            }.get(position, 0.020)
            
            home_runs = max(0, int(at_bats * hr_rate * random.uniform(0.5, 2.0)))
            
            stats.update({
                'games_played': games,
                'at_bats': at_bats,
                'hits': hits,
                'runs': int(hits * random.uniform(0.6, 1.1)),
                'rbi': max(home_runs, int(hits * random.uniform(0.5, 0.9))),
                'home_runs': home_runs,
                'stolen_bases': max(0, int(games * random.uniform(0.0, 0.3))),
                'batting_average': round(batting_avg, 3),
                'on_base_percentage': round(min(0.450, batting_avg + random.uniform(0.020, 0.080)), 3),
                'slugging_percentage': round(batting_avg + (home_runs / max(at_bats, 1)) * 3 + random.uniform(-0.050, 0.100), 3)
            })
            
            stats['ops'] = round(stats['on_base_percentage'] + stats['slugging_percentage'], 3)
        
        return stats
    
    def generate_expanded_kbo_players(self, target_count: int = 800) -> List[KBOPlayer]:
        """Generate expanded KBO player database with realistic distribution"""
        players = []
        current_year = datetime.datetime.now().year
        
        # Calculate players per team
        players_per_team = target_count // len(self.kbo_teams)
        extra_players = target_count % len(self.kbo_teams)
        
        player_id_counter = 1
        
        for team_idx, (team_name, team_info) in enumerate(self.kbo_teams.items()):
            team_player_count = players_per_team + (1 if team_idx < extra_players else 0)
            
            # Position distribution per team
            position_distribution = {
                'P': max(20, team_player_count // 3),  # ~33% pitchers
                'C': max(3, team_player_count // 25),  # Catchers
                '1B': max(3, team_player_count // 25), # Infielders
                '2B': max(3, team_player_count // 25),
                '3B': max(3, team_player_count // 25),
                'SS': max(3, team_player_count // 25),
                'LF': max(4, team_player_count // 20), # Outfielders
                'CF': max(4, team_player_count // 20),
                'RF': max(4, team_player_count // 20),
                'DH': max(2, team_player_count // 35)  # Designated hitters
            }
            
            # Adjust if total exceeds team count
            total_assigned = sum(position_distribution.values())
            if total_assigned > team_player_count:
                # Reduce pitcher count to fit
                position_distribution['P'] = max(15, team_player_count - (total_assigned - position_distribution['P']))
            elif total_assigned < team_player_count:
                # Add remaining as utility players
                remaining = team_player_count - total_assigned
                position_distribution['P'] += remaining // 2
                position_distribution['CF'] += remaining - (remaining // 2)
            
            for position, count in position_distribution.items():
                for _ in range(count):
                    # Nationality distribution (75% Korean, 25% foreign)
                    is_korean = random.random() < 0.75
                    
                    if is_korean:
                        surname = random.choice(self.korean_surnames)
                        given_name = random.choice(self.korean_given_names)
                        full_name = f"{surname} {given_name}"
                        name_kana = f"{surname.lower()}.{given_name.lower()}"
                        nationality = "KOR"
                    else:
                        full_name, nationality = random.choice(self.foreign_names)
                        name_kana = full_name.lower().replace(" ", ".")
                    
                    # Career length (1-15 years, weighted toward middle)
                    career_years = max(1, min(15, int(random.gauss(6, 3))))
                    debut_year = current_year - career_years + 1
                    
                    # Physical attributes
                    if position in ['P', '1B', 'C']:  # Larger positions
                        height = random.randint(175, 195)
                        weight = random.randint(75, 105)
                    else:  # Position players
                        height = random.randint(165, 185)
                        weight = random.randint(65, 90)
                    
                    # Birth date
                    birth_year = debut_year - random.randint(18, 35)
                    birth_date = f"{birth_year}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
                    
                    # Batting/Throwing hand
                    bat_hand = random.choices(['R', 'L', 'S'], weights=[70, 25, 5])[0]  # Switch hitters rare
                    throw_hand = random.choices(['R', 'L'], weights=[85, 15])[0]
                    bat_throw = f"{bat_hand}/{throw_hand}"
                    
                    # Generate career stats
                    career_stats = self.generate_realistic_stats(position, career_years)
                    
                    player = KBOPlayer(
                        player_id=f"KBO{player_id_counter:04d}",
                        full_name=full_name,
                        name_kana=name_kana,
                        team=team_name,
                        position=position,
                        nationality=nationality,
                        birth_date=birth_date,
                        height=height,
                        weight=weight,
                        bat_throw=bat_throw,
                        debut_year=debut_year,
                        career_stats=career_stats
                    )
                    
                    players.append(player)
                    player_id_counter += 1
        
        return players
    
    def integrate_to_database(self, players: List[KBOPlayer]) -> Dict[str, Any]:
        """Integrate expanded KBO players into comprehensive database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Clear existing KBO data
            cursor.execute("DELETE FROM detailed_players_master WHERE league = 'kbo'")
            
            # Insert expanded KBO players
            inserted_count = 0
            
            for player in players:
                try:
                    cursor.execute("""
                        INSERT INTO detailed_players_master (
                            league, full_name, native_name, current_team,
                            primary_position, nationality, birth_date, height_cm, weight_kg,
                            bats, throws, debut_date, pro_years, career_status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        'kbo',
                        player.full_name,
                        player.name_kana,
                        player.team,
                        player.position,
                        player.nationality,
                        player.birth_date,
                        player.height,
                        player.weight,
                        player.bat_throw.split('/')[0],  # Batting hand
                        player.bat_throw.split('/')[1],  # Throwing hand
                        f"{player.debut_year}-04-01",  # Estimated debut date
                        datetime.datetime.now().year - player.debut_year + 1,  # Pro years
                        'Active'
                    ))
                    inserted_count += 1
                    
                except sqlite3.Error as e:
                    print(f"Error inserting player {player.full_name}: {e}")
                    continue
            
            conn.commit()
            
            # Generate summary statistics
            cursor.execute("SELECT COUNT(*) FROM detailed_players_master WHERE league = 'kbo'")
            total_players = cursor.fetchone()[0]
            
            cursor.execute("SELECT current_team, COUNT(*) FROM detailed_players_master WHERE league = 'kbo' GROUP BY current_team")
            team_distribution = dict(cursor.fetchall())
            
            cursor.execute("SELECT nationality, COUNT(*) FROM detailed_players_master WHERE league = 'kbo' GROUP BY nationality")
            nationality_distribution = dict(cursor.fetchall())
            
            cursor.execute("SELECT primary_position, COUNT(*) FROM detailed_players_master WHERE league = 'kbo' GROUP BY primary_position")
            position_distribution = dict(cursor.fetchall())
            
            conn.close()
            
            return {
                'success': True,
                'inserted_players': inserted_count,
                'total_kbo_players': total_players,
                'team_distribution': team_distribution,
                'nationality_distribution': nationality_distribution,
                'position_distribution': position_distribution,
                'expansion_ratio': f"{total_players / 302:.1f}x" if total_players > 302 else "1.0x"
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def generate_team_analysis(self) -> Dict[str, Any]:
        """Generate comprehensive team analysis for expanded KBO"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            team_analysis = {}
            
            for team_name in self.kbo_teams.keys():
                cursor.execute("""
                    SELECT primary_position, COUNT(*), 
                           AVG(CASE WHEN nationality = 'KOR' THEN 1.0 ELSE 0.0 END) as korean_pct,
                           AVG(height_cm) as avg_height, AVG(weight_kg) as avg_weight
                    FROM detailed_players_master 
                    WHERE league = 'kbo' AND current_team = ?
                    GROUP BY primary_position
                """, (team_name,))
                
                position_stats = cursor.fetchall()
                
                cursor.execute("""
                    SELECT COUNT(*) as total, 
                           AVG(height_cm) as avg_height, 
                           AVG(weight_kg) as avg_weight,
                           MIN(pro_years) as min_experience,
                           MAX(pro_years) as max_experience
                    FROM detailed_players_master 
                    WHERE league = 'kbo' AND current_team = ?
                """, (team_name,))
                
                team_totals = cursor.fetchone()
                
                team_analysis[team_name] = {
                    'total_players': team_totals[0],
                    'avg_height': round(team_totals[1], 1) if team_totals[1] else 0,
                    'avg_weight': round(team_totals[2], 1) if team_totals[2] else 0,
                    'experience_range': f"{team_totals[3]}-{team_totals[4]} years" if team_totals[3] else "N/A",
                    'position_breakdown': {
                        pos[0]: {
                            'count': pos[1],
                            'korean_percentage': round(pos[2] * 100, 1)
                        } for pos in position_stats
                    },
                    'stadium': self.kbo_teams[team_name]['stadium'],
                    'founded': self.kbo_teams[team_name]['founded']
                }
            
            conn.close()
            return team_analysis
            
        except Exception as e:
            return {'error': str(e)}

def main():
    """Main execution function"""
    print("KBO Database Expansion System")
    print("=" * 50)
    
    expansion_system = KBOExpansionSystem()
    
    # Generate expanded player database
    print("Generating expanded KBO player database...")
    expanded_players = expansion_system.generate_expanded_kbo_players(target_count=800)
    print(f"Generated {len(expanded_players)} KBO players")
    
    # Integrate into database
    print("\nIntegrating into comprehensive database...")
    integration_result = expansion_system.integrate_to_database(expanded_players)
    
    if integration_result['success']:
        print("Database integration successful!")
        print(f"Total KBO players: {integration_result['total_kbo_players']}")
        print(f"Expansion ratio: {integration_result['expansion_ratio']}")
        
        print("\nTeam Distribution:")
        for team, count in integration_result['team_distribution'].items():
            print(f"  {team}: {count} players")
        
        print("\nNationality Distribution:")
        for nationality, count in integration_result['nationality_distribution'].items():
            print(f"  {nationality}: {count} players")
        
        print("\nPosition Distribution:")
        for position, count in integration_result['position_distribution'].items():
            print(f"  {position}: {count} players")
            
        # Generate team analysis
        print("\nGenerating team analysis...")
        team_analysis = expansion_system.generate_team_analysis()
        
        # Save detailed analysis
        with open('kbo_expansion_analysis.json', 'w', encoding='utf-8') as f:
            json.dump({
                'integration_summary': integration_result,
                'team_analysis': team_analysis,
                'generated_at': datetime.datetime.now().isoformat()
            }, f, indent=2, ensure_ascii=False)
        
        print("Detailed analysis saved to kbo_expansion_analysis.json")
        
    else:
        print(f"Database integration failed: {integration_result['error']}")

if __name__ == "__main__":
    main()