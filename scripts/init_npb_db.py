#!/usr/bin/env python3
"""
init_npb_db.py
Initialize NPB DuckDB database with complete schema
"""

import duckdb
import os

def init_complete_db(db_path: str):
    """Initialize DuckDB with complete NPB schema"""
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    conn = duckdb.connect(db_path)
    
    # 1) Games table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS games (
            game_id TEXT PRIMARY KEY,
            league TEXT,                               -- 'first' | 'farm'
            date DATE,
            start_time_jst TIME, 
            venue TEXT,
            status TEXT,                               -- SCHEDULED/IN_PROGRESS/FINAL/POSTPONED
            inning TEXT,                              -- 'TOP 5' | 'BOTTOM 9' etc
            away_team TEXT, 
            home_team TEXT,
            away_score INTEGER, 
            home_score INTEGER,
            source TEXT,                               -- 'npb'
            links TEXT,                                -- JSON string {index,box,pbp}
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 2) Box batting stats (game-level, per player)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS box_batting (
            game_id TEXT,
            player_name TEXT, 
            player_id TEXT,                            -- Will be filled via name matching later
            team TEXT, 
            order_no INTEGER,                          -- Batting order (1-9, 0 for substitutes)
            pos TEXT,                                  -- Position
            PA INTEGER,                                -- Plate appearances 
            AB INTEGER,                                -- At bats
            H INTEGER,                                 -- Hits
            "2B" INTEGER,                              -- Doubles (quoted for DuckDB)
            "3B" INTEGER,                              -- Triples  
            HR INTEGER,                                -- Home runs
            BB INTEGER,                                -- Walks
            IBB INTEGER,                               -- Intentional walks
            HBP INTEGER,                               -- Hit by pitch
            SO INTEGER,                                -- Strikeouts
            SF INTEGER,                                -- Sacrifice flies
            SH INTEGER,                                -- Sacrifice hits
            R INTEGER,                                 -- Runs
            RBI INTEGER,                               -- RBIs
            SB INTEGER,                                -- Stolen bases
            CS INTEGER,                                -- Caught stealing
            -- Derived stats (calculated)
            AVG DOUBLE,                                -- Batting average
            OBP DOUBLE,                                -- On-base percentage
            SLG DOUBLE,                                -- Slugging percentage
            OPS DOUBLE,                                -- OPS
            ISO DOUBLE,                                -- Isolated power
            BABIP DOUBLE,                              -- BABIP
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(game_id, team, player_name)
        )
    """)
    
    # 3) Box pitching stats (game-level, per player)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS box_pitching (
            game_id TEXT,
            player_name TEXT, 
            player_id TEXT,
            team TEXT,
            IP_outs INTEGER,                           -- Innings pitched as outs (39.1 IP = 118 outs)
            BF INTEGER,                                -- Batters faced
            H INTEGER,                                 -- Hits allowed
            R INTEGER,                                 -- Runs allowed
            ER INTEGER,                                -- Earned runs
            HR INTEGER,                                -- Home runs allowed
            BB INTEGER,                                -- Walks
            IBB INTEGER,                               -- Intentional walks
            HBP INTEGER,                               -- Hit batsmen
            SO INTEGER,                                -- Strikeouts
            WP INTEGER,                                -- Wild pitches
            BK INTEGER,                                -- Balks
            -- Derived stats (calculated)
            IP DOUBLE,                                 -- Innings pitched (IP_outs / 3.0)
            ERA DOUBLE,                                -- Earned run average
            WHIP DOUBLE,                               -- Walks + hits per inning
            K9 DOUBLE,                                 -- Strikeouts per 9 innings
            BB9 DOUBLE,                                -- Walks per 9 innings
            HR9 DOUBLE,                                -- Home runs per 9 innings
            FIP DOUBLE,                                -- Fielding independent pitching
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(game_id, team, player_name)
        )
    """)
    
    # 4) Starting lineups and defensive positions
    conn.execute("""
        CREATE TABLE IF NOT EXISTS lineups (
            game_id TEXT, 
            team TEXT,
            order_no INTEGER,                          -- Batting order (1-9)
            pos TEXT,                                  -- Defensive position
            player_name TEXT, 
            player_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (game_id, team, order_no)
        )
    """)
    
    # 5) PBP events (for future expansion)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pbp_events (
            game_id TEXT, 
            seq INTEGER,                               -- Sequence number within game
            inning INTEGER, 
            half TEXT,                                 -- 'TOP'/'BOTTOM'
            batter TEXT, 
            pitcher TEXT,
            result TEXT,                               -- Play result
            count_b INTEGER,                           -- Balls
            count_s INTEGER,                           -- Strikes  
            count_o INTEGER,                           -- Outs
            bases TEXT,                                -- Base situation
            away_runs INTEGER, 
            home_runs INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (game_id, seq)
        )
    """)
    
    # Create useful indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_games_league ON games(league)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_box_batting_game ON box_batting(game_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_box_pitching_game ON box_pitching(game_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_lineups_game ON lineups(game_id)")
    
    print(f"Initialized NPB database at {db_path}")
    print("Tables created: games, box_batting, box_pitching, lineups, pbp_events")
    
    # Show table info
    tables = conn.execute("SHOW TABLES").fetchall()
    for table in tables:
        count = conn.execute(f"SELECT COUNT(*) FROM {table[0]}").fetchone()[0]
        print(f"  {table[0]}: {count} rows")
    
    return conn

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="data/npb.db", help="Database path")
    args = parser.parse_args()
    
    conn = init_complete_db(args.db)
    conn.close()