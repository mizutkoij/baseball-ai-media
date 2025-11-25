#!/usr/bin/env python3
"""
scripts/collector_status.py - 継続収集システムの状況確認ツール
"""
import sqlite3
import sys
from datetime import datetime, date, timedelta
from pathlib import Path

STATUS_DB = "collection_status.db"

def print_collection_stats():
    """収集統計を表示"""
    if not Path(STATUS_DB).exists():
        print("Status database not found. Run with --init first.")
        return
    
    conn = sqlite3.connect(STATUS_DB)
    cursor = conn.cursor()
    
    print("=== Collection Status Overview ===")
    
    # 全体統計
    cursor.execute("""
        SELECT status, COUNT(*) as count
        FROM collection_status 
        GROUP BY status
        ORDER BY 
            CASE status 
                WHEN 'completed' THEN 1 
                WHEN 'pending' THEN 2 
                WHEN 'in_progress' THEN 3 
                WHEN 'failed' THEN 4 
            END
    """)
    
    total_tasks = 0
    for row in cursor.fetchall():
        print(f"{row[0].upper():>12}: {row[1]:>6} tasks")
        total_tasks += row[1]
    
    print(f"{'TOTAL':>12}: {total_tasks:>6} tasks")
    print()
    
    # 今日の統計
    today = date.today().strftime('%Y-%m-%d')
    print(f"=== Today's Progress ({today}) ===")
    
    cursor.execute("""
        SELECT status, COUNT(*) as count
        FROM collection_status 
        WHERE date_target = ?
        GROUP BY status
    """, (today,))
    
    today_stats = dict(cursor.fetchall())
    for status in ['completed', 'pending', 'in_progress', 'failed']:
        count = today_stats.get(status, 0)
        print(f"{status.upper():>12}: {count:>6} tasks")
    
    print()
    
    # 最近のアクティビティ
    print("=== Recent Activity ===")
    cursor.execute("""
        SELECT timestamp, action, target, status, duration_sec, message
        FROM execution_log 
        ORDER BY timestamp DESC
        LIMIT 10
    """)
    
    for row in cursor.fetchall():
        timestamp = row[0][:19]  # YYYY-MM-DD HH:MM:SS
        action = row[1]
        target = row[2]
        status = row[3]
        duration = f"{row[4]:.1f}s" if row[4] else "N/A"
        message = row[5] or ""
        
        print(f"{timestamp} | {action:>8} | {target:>15} | {status:>7} | {duration:>8} | {message[:30]}")
    
    print()
    
    # 失敗したタスク
    print("=== Failed Tasks (Last 5) ===")
    cursor.execute("""
        SELECT date_target, data_type, target_detail, attempts, error_message
        FROM collection_status 
        WHERE status = 'failed'
        ORDER BY last_attempt DESC
        LIMIT 5
    """)
    
    failed_tasks = cursor.fetchall()
    if failed_tasks:
        for row in failed_tasks:
            print(f"{row[0]} | {row[1]:>8} | {row[2]:>12} | Attempts: {row[3]} | Error: {row[4][:40]}")
    else:
        print("No failed tasks")
    
    print()
    
    # 次のタスク
    print("=== Next Pending Tasks ===")
    cursor.execute("""
        SELECT date_target, data_type, target_detail
        FROM collection_status 
        WHERE status = 'pending'
        ORDER BY 
            CASE 
                WHEN date_target = date('now') THEN 1  
                WHEN date_target = date('now', '-1 day') THEN 2  
                ELSE 3  
            END,
            date_target DESC
        LIMIT 5
    """)
    
    next_tasks = cursor.fetchall()
    if next_tasks:
        for row in next_tasks:
            print(f"{row[0]} | {row[1]:>8} | {row[2]:>12}")
    else:
        print("No pending tasks")
    
    conn.close()

def print_recent_files():
    """最近作成されたファイルを表示"""
    data_dir = Path("data/continuous_collection")
    if not data_dir.exists():
        print("Data directory not found")
        return
    
    print("\n=== Recent Data Files ===")
    
    # 最近のファイルを取得
    csv_files = []
    for date_dir in data_dir.glob("date=*"):
        for csv_file in date_dir.glob("*.csv"):
            mtime = csv_file.stat().st_mtime
            csv_files.append((csv_file, mtime))
    
    # 新しい順にソート
    csv_files.sort(key=lambda x: x[1], reverse=True)
    
    for csv_file, mtime in csv_files[:10]:
        size = csv_file.stat().st_size
        mtime_str = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
        print(f"{mtime_str} | {size:>8} bytes | {csv_file}")

def cleanup_old_data(days: int = 30):
    """古いデータのクリーンアップ"""
    cutoff_date = date.today() - timedelta(days=days)
    cutoff_str = cutoff_date.strftime('%Y-%m-%d')
    
    conn = sqlite3.connect(STATUS_DB)
    cursor = conn.cursor()
    
    # 古い完了タスクを削除
    cursor.execute("""
        DELETE FROM collection_status 
        WHERE status = 'completed' AND date_target < ?
    """, (cutoff_str,))
    
    deleted = cursor.rowcount
    
    # 古い実行ログを削除
    cursor.execute("""
        DELETE FROM execution_log 
        WHERE timestamp < datetime('now', '-30 days')
    """)
    
    deleted_logs = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    print(f"Cleanup completed:")
    print(f"  Deleted {deleted} old collection records")
    print(f"  Deleted {deleted_logs} old log entries")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Collection status checker")
    parser.add_argument("--stats", action="store_true", help="Show collection statistics")
    parser.add_argument("--files", action="store_true", help="Show recent files")
    parser.add_argument("--cleanup", type=int, metavar="DAYS", help="Cleanup data older than N days")
    parser.add_argument("--all", action="store_true", help="Show all information")
    
    args = parser.parse_args()
    
    if args.all or (not any([args.stats, args.files, args.cleanup])):
        # デフォルトは全て表示
        print_collection_stats()
        print_recent_files()
    else:
        if args.stats:
            print_collection_stats()
        if args.files:
            print_recent_files()
        if args.cleanup:
            cleanup_old_data(args.cleanup)

if __name__ == "__main__":
    main()