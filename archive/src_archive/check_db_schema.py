import sqlite3

def check_database_schema():
    """Check the comprehensive baseball database schema"""
    try:
        conn = sqlite3.connect("comprehensive_baseball_database.db")
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type=\"table\";")
        tables = cursor.fetchall()
        
        print("Database Tables:")
        for table in tables:
            print(f"  - {table[0]}")
            
            # Get schema for each table
            cursor.execute(f"PRAGMA table_info({table[0]});")
            columns = cursor.fetchall()
            
            print(f"    Columns:")
            for col in columns:
                print(f"      {col[1]} ({col[2]})")
            print()
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_database_schema()
