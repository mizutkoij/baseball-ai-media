#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate mock NPB game data for testing the database integration
"""

import duckdb
import json
from datetime import datetime, date

def generate_mock_game_data():
    """Generate realistic mock NPB game data"""
    
    # Mock game info
    game_id = "20250731-db-s-15"
    
    # Mock lineup data (9 players each team)
    mock_lineups = [
        # DeNA lineup
        {'game_id': game_id, 'team': 'DeNA', 'order_no': 1, 'pos': '中', 'player_name': '桑原将志', 'player_id': None},
        {'game_id': game_id, 'team': 'DeNA', 'order_no': 2, 'pos': '二', 'player_name': '牧秀悟', 'player_id': None},
        {'game_id': game_id, 'team': 'DeNA', 'order_no': 3, 'pos': '一', 'player_name': 'オースティン', 'player_id': None},
        {'game_id': game_id, 'team': 'DeNA', 'order_no': 4, 'pos': '左', 'player_name': '佐野恵太', 'player_id': None},
        {'game_id': game_id, 'team': 'DeNA', 'order_no': 5, 'pos': '三', 'player_name': '宮崎敏郎', 'player_id': None},
        {'game_id': game_id, 'team': 'DeNA', 'order_no': 6, 'pos': '右', 'player_name': '楠本泰史', 'player_id': None},
        {'game_id': game_id, 'team': 'DeNA', 'order_no': 7, 'pos': '遊', 'player_name': '森敬斗', 'player_id': None},
        {'game_id': game_id, 'team': 'DeNA', 'order_no': 8, 'pos': '捕', 'player_name': '山本祐大', 'player_id': None},
        {'game_id': game_id, 'team': 'DeNA', 'order_no': 9, 'pos': '投', 'player_name': '東克樹', 'player_id': None},
        
        # Yakult lineup
        {'game_id': game_id, 'team': 'ヤクルト', 'order_no': 1, 'pos': '中', 'player_name': '塩見泰隆', 'player_id': None},
        {'game_id': game_id, 'team': 'ヤクルト', 'order_no': 2, 'pos': '二', 'player_name': '山田哲人', 'player_id': None},
        {'game_id': game_id, 'team': 'ヤクルト', 'order_no': 3, 'pos': '三', 'player_name': '村上宗隆', 'player_id': None},
        {'game_id': game_id, 'team': 'ヤクルト', 'order_no': 4, 'pos': '一', 'player_name': 'サンタナ', 'player_id': None},
        {'game_id': game_id, 'team': 'ヤクルト', 'order_no': 5, 'pos': '左', 'player_name': '長岡秀樹', 'player_id': None},
        {'game_id': game_id, 'team': 'ヤクルト', 'order_no': 6, 'pos': '右', 'player_name': '並木秀尊', 'player_id': None},
        {'game_id': game_id, 'team': 'ヤクルト', 'order_no': 7, 'pos': '遊', 'player_name': '武岡龍世', 'player_id': None},
        {'game_id': game_id, 'team': 'ヤクルト', 'order_no': 8, 'pos': '捕', 'player_name': '中村悠平', 'player_id': None},
        {'game_id': game_id, 'team': 'ヤクルト', 'order_no': 9, 'pos': '投', 'player_name': '小川泰弘', 'player_id': None},
    ]
    
    # Mock batting stats with realistic numbers
    mock_batting = [
        # DeNA batting
        {'game_id': game_id, 'player_name': '桑原将志', 'player_id': None, 'team': 'DeNA', 'order_no': 1, 'pos': '中', 'PA': 4, 'AB': 4, 'H': 1, '2B': 0, '3B': 0, 'HR': 0, 'BB': 0, 'IBB': 0, 'HBP': 0, 'SO': 1, 'SF': 0, 'SH': 0, 'R': 1, 'RBI': 0, 'SB': 1, 'CS': 0},
        {'game_id': game_id, 'player_name': '牧秀悟', 'player_id': None, 'team': 'DeNA', 'order_no': 2, 'pos': '二', 'PA': 4, 'AB': 3, 'H': 2, '2B': 1, '3B': 0, 'HR': 0, 'BB': 1, 'IBB': 0, 'HBP': 0, 'SO': 0, 'SF': 0, 'SH': 0, 'R': 1, 'RBI': 1, 'SB': 0, 'CS': 0},
        {'game_id': game_id, 'player_name': 'オースティン', 'player_id': None, 'team': 'DeNA', 'order_no': 3, 'pos': '一', 'PA': 4, 'AB': 4, 'H': 2, '2B': 0, '3B': 0, 'HR': 1, 'BB': 0, 'IBB': 0, 'HBP': 0, 'SO': 1, 'SF': 0, 'SH': 0, 'R': 1, 'RBI': 2, 'SB': 0, 'CS': 0},
        {'game_id': game_id, 'player_name': '佐野恵太', 'player_id': None, 'team': 'DeNA', 'order_no': 4, 'pos': '左', 'PA': 4, 'AB': 4, 'H': 1, '2B': 0, '3B': 0, 'HR': 0, 'BB': 0, 'IBB': 0, 'HBP': 0, 'SO': 2, 'SF': 0, 'SH': 0, 'R': 0, 'RBI': 0, 'SB': 0, 'CS': 0},
        
        # Yakult batting  
        {'game_id': game_id, 'player_name': '塩見泰隆', 'player_id': None, 'team': 'ヤクルト', 'order_no': 1, 'pos': '中', 'PA': 4, 'AB': 4, 'H': 2, '2B': 1, '3B': 0, 'HR': 0, 'BB': 0, 'IBB': 0, 'HBP': 0, 'SO': 0, 'SF': 0, 'SH': 0, 'R': 1, 'RBI': 0, 'SB': 0, 'CS': 0},
        {'game_id': game_id, 'player_name': '山田哲人', 'player_id': None, 'team': 'ヤクルト', 'order_no': 2, 'pos': '二', 'PA': 4, 'AB': 3, 'H': 1, '2B': 0, '3B': 0, 'HR': 0, 'BB': 1, 'IBB': 0, 'HBP': 0, 'SO': 1, 'SF': 0, 'SH': 0, 'R': 1, 'RBI': 1, 'SB': 0, 'CS': 0},
        {'game_id': game_id, 'player_name': '村上宗隆', 'player_id': None, 'team': 'ヤクルト', 'order_no': 3, 'pos': '三', 'PA': 4, 'AB': 4, 'H': 1, '2B': 0, '3B': 0, 'HR': 1, 'BB': 0, 'IBB': 0, 'HBP': 0, 'SO': 2, 'SF': 0, 'SH': 0, 'R': 1, 'RBI': 2, 'SB': 0, 'CS': 0},
    ]
    
    # Calculate derived batting stats
    for stats in mock_batting:
        ab = stats['AB']
        h = stats['H']
        bb = stats['BB']
        hbp = stats['HBP']
        sf = stats['SF']
        hr = stats['HR']
        doubles = stats['2B']
        triples = stats['3B']
        
        # Calculate stats
        avg = h / max(1, ab) if ab > 0 else 0.0
        obp_denom = ab + bb + hbp + sf
        obp = (h + bb + hbp) / max(1, obp_denom) if obp_denom > 0 else 0.0
        singles = h - doubles - triples - hr
        total_bases = singles + 2*doubles + 3*triples + 4*hr
        slg = total_bases / max(1, ab) if ab > 0 else 0.0
        
        stats.update({
            'AVG': round(avg, 3),
            'OBP': round(obp, 3),
            'SLG': round(slg, 3),
            'OPS': round(obp + slg, 3),
            'ISO': round(slg - avg, 3),
            'BABIP': round((h - hr) / max(1, ab - stats['SO'] - hr + sf), 3) if (ab - stats['SO'] - hr + sf) > 0 else 0.0
        })
    
    # Mock pitching stats
    mock_pitching = [
        # DeNA pitching
        {'game_id': game_id, 'player_name': '東克樹', 'player_id': None, 'team': 'DeNA', 'IP_outs': 18, 'BF': 25, 'H': 6, 'R': 3, 'ER': 3, 'HR': 1, 'BB': 2, 'IBB': 0, 'HBP': 0, 'SO': 5, 'WP': 0, 'BK': 0},
        {'game_id': game_id, 'player_name': '伊勢大夢', 'player_id': None, 'team': 'DeNA', 'IP_outs': 6, 'BF': 8, 'H': 1, 'R': 0, 'ER': 0, 'HR': 0, 'BB': 1, 'IBB': 0, 'HBP': 0, 'SO': 2, 'WP': 0, 'BK': 0},
        {'game_id': game_id, 'player_name': '康晃', 'player_id': None, 'team': 'DeNA', 'IP_outs': 3, 'BF': 4, 'H': 1, 'R': 0, 'ER': 0, 'HR': 0, 'BB': 0, 'IBB': 0, 'HBP': 0, 'SO': 1, 'WP': 0, 'BK': 0},
        
        # Yakult pitching
        {'game_id': game_id, 'player_name': '小川泰弘', 'player_id': None, 'team': 'ヤクルト', 'IP_outs': 15, 'BF': 23, 'H': 5, 'R': 4, 'ER': 4, 'HR': 1, 'BB': 3, 'IBB': 0, 'HBP': 0, 'SO': 4, 'WP': 1, 'BK': 0},
        {'game_id': game_id, 'player_name': '清水昇', 'player_id': None, 'team': 'ヤクルト', 'IP_outs': 9, 'BF': 12, 'H': 3, 'R': 1, 'ER': 1, 'HR': 0, 'BB': 1, 'IBB': 0, 'HBP': 0, 'SO': 3, 'WP': 0, 'BK': 0},
        {'game_id': game_id, 'player_name': 'マクガフ', 'player_id': None, 'team': 'ヤクルト', 'IP_outs': 3, 'BF': 3, 'H': 0, 'R': 0, 'ER': 0, 'HR': 0, 'BB': 0, 'IBB': 0, 'HBP': 0, 'SO': 2, 'WP': 0, 'BK': 0},
    ]
    
    # Calculate derived pitching stats
    for stats in mock_pitching:
        ip_outs = stats['IP_outs']
        ip = ip_outs / 3.0 if ip_outs > 0 else 0.0
        h = stats['H']
        bb = stats['BB']
        er = stats['ER']
        so = stats['SO']
        hr = stats['HR']
        
        if ip > 0:
            era = 9 * er / ip
            whip = (bb + h) / ip
            k9 = 9 * so / ip
            bb9 = 9 * bb / ip
            hr9 = 9 * hr / ip
            fip = (13*hr + 3*bb - 2*so) / ip + 3.20  # Constant
        else:
            era = whip = k9 = bb9 = hr9 = fip = 0.0
        
        stats.update({
            'IP': round(ip, 1),
            'ERA': round(era, 2),
            'WHIP': round(whip, 3),
            'K9': round(k9, 1),
            'BB9': round(bb9, 1),
            'HR9': round(hr9, 1),
            'FIP': round(fip, 2)
        })
    
    return mock_lineups, mock_batting, mock_pitching

def populate_mock_data(db_path="data/npb_test.db"):
    """Populate database with mock NPB data"""
    
    conn = duckdb.connect(db_path)
    
    # Insert mock game
    game_data = {
        'game_id': '20250731-db-s-15',
        'league': 'first',
        'date': date(2025, 7, 31),
        'start_time_jst': '18:00',
        'venue': '横浜スタジアム',
        'status': 'FINAL',
        'inning': None,
        'away_team': 'ヤクルト',
        'home_team': 'DeNA',
        'away_score': 3,
        'home_score': 5,
        'source': 'npb',
        'links': json.dumps({
            'index': 'https://npb.jp/scores/2025/0731/db-s-15/index.html',
            'box': 'https://npb.jp/scores/2025/0731/db-s-15/box.html',
            'pbp': 'https://npb.jp/scores/2025/0731/db-s-15/playbyplay.html'
        })
    }
    
    conn.execute("""
        INSERT OR REPLACE INTO games 
        (game_id, league, date, start_time_jst, venue, status, inning, away_team, home_team, away_score, home_score, source, links)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        game_data['game_id'], game_data['league'], game_data['date'], game_data['start_time_jst'],
        game_data['venue'], game_data['status'], game_data['inning'], game_data['away_team'],
        game_data['home_team'], game_data['away_score'], game_data['home_score'], 
        game_data['source'], game_data['links']
    ])
    
    # Generate and insert mock data
    lineups, batting_stats, pitching_stats = generate_mock_game_data()
    
    # Insert lineups
    for lineup in lineups:
        conn.execute("""
            INSERT OR REPLACE INTO lineups (game_id, team, order_no, pos, player_name, player_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, [lineup['game_id'], lineup['team'], lineup['order_no'], lineup['pos'], lineup['player_name'], lineup['player_id']])
    
    # Insert batting stats
    for stats in batting_stats:
        conn.execute("""
            INSERT OR REPLACE INTO box_batting (
                game_id, player_name, player_id, team, order_no, pos,
                PA, AB, H, "2B", "3B", HR, BB, IBB, HBP, SO, SF, SH,
                R, RBI, SB, CS, AVG, OBP, SLG, OPS, ISO, BABIP
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            stats['game_id'], stats['player_name'], stats['player_id'], stats['team'],
            stats['order_no'], stats['pos'], stats['PA'], stats['AB'], stats['H'],
            stats['2B'], stats['3B'], stats['HR'], stats['BB'], stats['IBB'],
            stats['HBP'], stats['SO'], stats['SF'], stats['SH'], stats['R'],
            stats['RBI'], stats['SB'], stats['CS'], stats['AVG'], stats['OBP'],
            stats['SLG'], stats['OPS'], stats['ISO'], stats['BABIP']
        ])
    
    # Insert pitching stats
    for stats in pitching_stats:
        conn.execute("""
            INSERT OR REPLACE INTO box_pitching (
                game_id, player_name, player_id, team, IP_outs, BF,
                H, R, ER, HR, BB, IBB, HBP, SO, WP, BK,
                IP, ERA, WHIP, K9, BB9, HR9, FIP
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            stats['game_id'], stats['player_name'], stats['player_id'], stats['team'],
            stats['IP_outs'], stats['BF'], stats['H'], stats['R'], stats['ER'],
            stats['HR'], stats['BB'], stats['IBB'], stats['HBP'], stats['SO'],
            stats['WP'], stats['BK'], stats['IP'], stats['ERA'], stats['WHIP'],
            stats['K9'], stats['BB9'], stats['HR9'], stats['FIP']
        ])
    
    # Show results
    print("Mock data inserted successfully!")
    
    # Verify data
    tables = ['games', 'lineups', 'box_batting', 'box_pitching']
    for table in tables:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table}: {count} rows")
    
    # Show sample data
    print("\n=== Sample Batting Stats ===")
    batting_sample = conn.execute("""
        SELECT player_name, team, AB, H, HR, RBI, AVG, OBP, SLG, OPS
        FROM box_batting 
        WHERE game_id = '20250731-db-s-15'
        ORDER BY team, order_no
        LIMIT 6
    """).fetchall()
    
    for row in batting_sample:
        print(f"  {row[0]:<10} ({row[1]:<6}): {row[2]}AB {row[3]}H {row[4]}HR {row[5]}RBI | .{row[6]:.3f}/.{row[7]:.3f}/.{row[8]:.3f} (.{row[9]:.3f})")
    
    print("\n=== Sample Pitching Stats ===")
    pitching_sample = conn.execute("""
        SELECT player_name, team, IP, H, R, ER, BB, SO, ERA, WHIP
        FROM box_pitching
        WHERE game_id = '20250731-db-s-15'
        ORDER BY team, IP_outs DESC
        LIMIT 4
    """).fetchall()
    
    for row in pitching_sample:
        print(f"  {row[0]:<10} ({row[1]:<6}): {row[2]}IP {row[3]}H {row[4]}R {row[5]}ER {row[6]}BB {row[7]}SO | {row[8]:.2f}ERA {row[9]:.3f}WHIP")
    
    conn.close()
    return db_path

if __name__ == "__main__":
    populate_mock_data()