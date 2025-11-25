#!/usr/bin/env python3
"""
KBO Sabermetrics Engine
Advanced baseball statistics calculator for KBO data
Based on research: WAR and other advanced metrics need to be calculated
"""

import math
import sqlite3
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class BattingStats:
    """Batting statistics container"""
    pa: int = 0  # Plate appearances
    ab: int = 0  # At bats
    h: int = 0   # Hits
    bb: int = 0  # Walks
    hbp: int = 0 # Hit by pitch
    sf: int = 0  # Sacrifice flies
    sh: int = 0  # Sacrifice hits
    singles: int = 0
    doubles: int = 0
    triples: int = 0
    hr: int = 0  # Home runs
    r: int = 0   # Runs
    rbi: int = 0 # RBIs
    sb: int = 0  # Stolen bases
    cs: int = 0  # Caught stealing
    k: int = 0   # Strikeouts
    gidp: int = 0 # Grounded into double play

@dataclass
class PitchingStats:
    """Pitching statistics container"""
    ip: float = 0.0  # Innings pitched
    h: int = 0       # Hits allowed
    r: int = 0       # Runs allowed
    er: int = 0      # Earned runs
    bb: int = 0      # Walks
    k: int = 0       # Strikeouts
    hr: int = 0      # Home runs allowed
    hbp: int = 0     # Hit batsmen
    wp: int = 0      # Wild pitches
    bk: int = 0      # Balks
    bf: int = 0      # Batters faced
    wins: int = 0
    losses: int = 0
    saves: int = 0
    holds: int = 0

class KBOSabermetricsEngine:
    """Calculate advanced baseball statistics for KBO"""
    
    def __init__(self):
        # KBO-specific league constants (estimated based on research)
        self.kbo_constants = {
            'woba_weights': {
                'bb': 0.69,
                'hbp': 0.72,
                '1b': 0.89,
                '2b': 1.27,
                '3b': 1.62,
                'hr': 2.10
            },
            'park_factors': {
                # Stadium-specific offensive factors (1.0 = neutral)
                'Jamsil Baseball Stadium': 1.02,  # Slightly hitter-friendly
                'Gwangju Champions Field': 0.98,
                'Sajik Baseball Stadium': 1.01,
                'Daegu Samsung Lions Park': 0.99,
                'Changwon NC Park': 1.03,
                'Incheon SSG Landers Field': 1.00,
                'Suwon KT Wiz Park': 0.97,
                'Gocheok Sky Dome': 1.01,
                'Daejeon Hanwha Life Ballpark': 0.98
            },
            'league_averages': {
                # 2024 KBO estimates
                'avg': 0.270,
                'obp': 0.340,
                'slg': 0.415,
                'woba': 0.325,
                'era': 4.20,
                'fip': 4.10,
                'babip': 0.295
            },
            'fip_constant': 3.20,  # KBO-specific FIP constant
            'replacement_level': {
                'position_players': 20.5,  # WAR per 600 PA
                'pitchers': 22.0          # WAR per 200 IP
            }
        }
    
    def calculate_batting_avg(self, stats: BattingStats) -> float:
        """Calculate batting average"""
        if stats.ab == 0:
            return 0.0
        return round(stats.h / stats.ab, 3)
    
    def calculate_obp(self, stats: BattingStats) -> float:
        """Calculate on-base percentage"""
        if stats.pa == 0:
            return 0.0
        return round((stats.h + stats.bb + stats.hbp) / stats.pa, 3)
    
    def calculate_slg(self, stats: BattingStats) -> float:
        """Calculate slugging percentage"""
        if stats.ab == 0:
            return 0.0
        total_bases = stats.singles + (2 * stats.doubles) + (3 * stats.triples) + (4 * stats.hr)
        return round(total_bases / stats.ab, 3)
    
    def calculate_ops(self, stats: BattingStats) -> float:
        """Calculate OPS (On-base Plus Slugging)"""
        obp = self.calculate_obp(stats)
        slg = self.calculate_slg(stats)
        return round(obp + slg, 3)
    
    def calculate_woba(self, stats: BattingStats) -> float:
        """Calculate weighted On-Base Average"""
        weights = self.kbo_constants['woba_weights']
        
        numerator = (weights['bb'] * stats.bb + 
                    weights['hbp'] * stats.hbp +
                    weights['1b'] * stats.singles +
                    weights['2b'] * stats.doubles +
                    weights['3b'] * stats.triples +
                    weights['hr'] * stats.hr)
        
        denominator = stats.ab + stats.bb + stats.sf + stats.hbp
        
        if denominator == 0:
            return 0.0
        return round(numerator / denominator, 3)
    
    def calculate_wrc_plus(self, stats: BattingStats, park_factor: float = 1.0) -> int:
        """Calculate wRC+ (Weighted Runs Created Plus)"""
        woba = self.calculate_woba(stats)
        league_woba = self.kbo_constants['league_averages']['woba']
        
        if league_woba == 0:
            return 100
        
        # Simplified wRC+ calculation
        wrc_plus = 100 * (woba / league_woba) / park_factor
        return round(wrc_plus)
    
    def calculate_babip(self, stats: BattingStats) -> float:
        """Calculate Batting Average on Balls in Play"""
        balls_in_play = stats.h - stats.hr
        at_bats_minus_hr_k_sf = stats.ab - stats.hr - stats.k - stats.sf
        
        if at_bats_minus_hr_k_sf <= 0:
            return 0.0
        return round(balls_in_play / at_bats_minus_hr_k_sf, 3)
    
    def calculate_era(self, stats: PitchingStats) -> float:
        """Calculate Earned Run Average"""
        if stats.ip == 0:
            return 0.0
        return round((stats.er * 9) / stats.ip, 2)
    
    def calculate_whip(self, stats: PitchingStats) -> float:
        """Calculate Walks plus Hits per Inning Pitched"""
        if stats.ip == 0:
            return 0.0
        return round((stats.h + stats.bb) / stats.ip, 3)
    
    def calculate_fip(self, stats: PitchingStats) -> float:
        """Calculate Fielding Independent Pitching"""
        if stats.ip == 0:
            return 0.0
        
        fip = ((13 * stats.hr) + (3 * stats.bb) - (2 * stats.k)) / stats.ip + self.kbo_constants['fip_constant']
        return round(fip, 2)
    
    def calculate_k_per_9(self, stats: PitchingStats) -> float:
        """Calculate strikeouts per 9 innings"""
        if stats.ip == 0:
            return 0.0
        return round((stats.k * 9) / stats.ip, 1)
    
    def calculate_bb_per_9(self, stats: PitchingStats) -> float:
        """Calculate walks per 9 innings"""
        if stats.ip == 0:
            return 0.0
        return round((stats.bb * 9) / stats.ip, 1)
    
    def calculate_k_bb_ratio(self, stats: PitchingStats) -> float:
        """Calculate strikeout to walk ratio"""
        if stats.bb == 0:
            return stats.k if stats.k > 0 else 0.0
        return round(stats.k / stats.bb, 2)
    
    def estimate_war_batting(self, stats: BattingStats, games: int, position: str) -> float:
        """Estimate batting WAR (simplified calculation)"""
        # This is a simplified WAR calculation
        # Real WAR requires complex positional adjustments and replacement level calculations
        
        woba = self.calculate_woba(stats)
        league_woba = self.kbo_constants['league_averages']['woba']
        
        if stats.pa == 0:
            return 0.0
        
        # Position adjustments (runs per season)
        position_adjustments = {
            'C': 9.0, '1B': -9.5, '2B': 3.0, '3B': 2.0, 'SS': 7.0,
            'LF': -7.0, 'CF': 2.5, 'RF': -7.5, 'DH': -15.0
        }
        
        # Calculate offensive value
        woba_scale = 1.2  # Approximate runs per wOBA point
        offensive_runs = (woba - league_woba) * woba_scale * stats.pa
        
        # Add positional adjustment
        positional_runs = position_adjustments.get(position, 0.0) * (games / 144)
        
        # Convert to WAR (10 runs = 1 WAR approximately)
        war = (offensive_runs + positional_runs) / 10.0
        
        return round(war, 1)
    
    def estimate_war_pitching(self, stats: PitchingStats) -> float:
        """Estimate pitching WAR (simplified calculation)"""
        if stats.ip == 0:
            return 0.0
        
        fip = self.calculate_fip(stats)
        league_era = self.kbo_constants['league_averages']['era']
        
        # Simplified pitching WAR based on FIP vs league average
        runs_prevented = (league_era - fip) * (stats.ip / 9)
        
        # Convert to WAR
        war = runs_prevented / 10.0
        
        return round(war, 1)
    
    def calculate_comprehensive_stats(self, 
                                    batting_stats: Optional[BattingStats] = None,
                                    pitching_stats: Optional[PitchingStats] = None,
                                    player_info: Dict[str, Any] = None) -> Dict[str, Any]:
        """Calculate all sabermetrics for a player"""
        
        result = {
            'player_info': player_info or {},
            'batting_metrics': {},
            'pitching_metrics': {},
            'advanced_metrics': {}
        }
        
        # Calculate batting metrics
        if batting_stats:
            result['batting_metrics'] = {
                'avg': self.calculate_batting_avg(batting_stats),
                'obp': self.calculate_obp(batting_stats),
                'slg': self.calculate_slg(batting_stats),
                'ops': self.calculate_ops(batting_stats),
                'woba': self.calculate_woba(batting_stats),
                'wrc_plus': self.calculate_wrc_plus(batting_stats),
                'babip': self.calculate_babip(batting_stats),
                'war': self.estimate_war_batting(
                    batting_stats, 
                    player_info.get('games', 144), 
                    player_info.get('position', 'RF')
                )
            }
        
        # Calculate pitching metrics
        if pitching_stats:
            result['pitching_metrics'] = {
                'era': self.calculate_era(pitching_stats),
                'whip': self.calculate_whip(pitching_stats),
                'fip': self.calculate_fip(pitching_stats),
                'k_per_9': self.calculate_k_per_9(pitching_stats),
                'bb_per_9': self.calculate_bb_per_9(pitching_stats),
                'k_bb_ratio': self.calculate_k_bb_ratio(pitching_stats),
                'war': self.estimate_war_pitching(pitching_stats)
            }
        
        return result

def test_sabermetrics_engine():
    """Test the sabermetrics calculations"""
    engine = KBOSabermetricsEngine()
    
    # Test batting stats
    test_batting = BattingStats(
        pa=600, ab=520, h=156, bb=65, hbp=5, sf=4,
        singles=95, doubles=35, triples=3, hr=23,
        r=85, rbi=78, sb=12, cs=3, k=110
    )
    
    # Test pitching stats  
    test_pitching = PitchingStats(
        ip=180.0, h=170, r=75, er=68, bb=55, k=165,
        hr=18, wins=12, losses=8, saves=0
    )
    
    player_info = {
        'name': 'Test Player',
        'team': 'DOO',
        'position': 'RF',
        'games': 140
    }
    
    results = engine.calculate_comprehensive_stats(
        batting_stats=test_batting,
        pitching_stats=test_pitching,
        player_info=player_info
    )
    
    print("Sabermetrics Engine Test Results:")
    print("=" * 40)
    print(f"Batting Metrics: {results['batting_metrics']}")
    print(f"Pitching Metrics: {results['pitching_metrics']}")
    
    return results

if __name__ == "__main__":
    test_sabermetrics_engine()