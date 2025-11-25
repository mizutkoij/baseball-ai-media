#!/usr/bin/env python3
import sqlite3
import os

db_path = "data/yahoo_continuous/yahoo_games.db"
print(f"Database file exists: {os.path.exists(db_path)}")
print(f"Database file size: {os.path.getsize(db_path) if os.path.exists(db_path) else 0} bytes")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print(f"Tables: {tables}")

# Check pitch_data table structure
cursor.execute("PRAGMA table_info(pitch_data);")
columns = cursor.fetchall()
print(f"pitch_data columns: {[col[1] for col in columns]}")

# Count records in all tables
cursor.execute("SELECT COUNT(*) FROM pitch_data;")
pitch_count = cursor.fetchone()[0]
print(f"Records in pitch_data: {pitch_count}")

cursor.execute("SELECT COUNT(*) FROM games;")
game_count = cursor.fetchone()[0]
print(f"Records in games: {game_count}")

# Test manual insert
try:
    cursor.execute('''
        INSERT INTO pitch_data 
        (game_id, index_code, pitcher_name, batter_name, pitch_sequence,
         pitch_type, velocity, result, count_data, zone)
        VALUES ('TEST123', 'TEST456', 'TestPitcher', 'TestBatter', 1,
                'ストレート', '144km/h', '見逃し', '1/1', '真ん中')
    ''')
    conn.commit()
    print("✅ Manual insert successful")
    
    # Check if inserted
    cursor.execute("SELECT COUNT(*) FROM pitch_data;")
    new_count = cursor.fetchone()[0]
    print(f"Records after insert: {new_count}")
    
except Exception as e:
    print(f"❌ Manual insert failed: {e}")

conn.close()