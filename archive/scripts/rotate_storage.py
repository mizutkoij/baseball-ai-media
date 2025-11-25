#!/usr/bin/env python3
"""
ストレージローテーション: JSON → Parquet変換 + 古いファイル削除
- latest.jsonは残す
- timeline.jsonlをgzip → Parquet（40-70%縮小）
- 30日超の古いファイルを削除
"""

import os
import json
import gzip
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any
import argparse
import sys

try:
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError as e:
    print(f"❌ Required packages not installed: {e}")
    print("💡 Install: pip install pandas pyarrow")
    sys.exit(1)

def log(level: str, message: str, **kwargs):
    """Simple logging"""
    timestamp = datetime.now().isoformat()
    extras = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"{timestamp} [{level}] {message} {extras}")

def parse_date_dir(dir_name: str) -> datetime:
    """Parse date=YYYY-MM-DD directory name"""
    if dir_name.startswith("date="):
        date_str = dir_name[5:]  # Remove "date=" prefix
        return datetime.strptime(date_str, "%Y-%m-%d")
    raise ValueError(f"Invalid date directory: {dir_name}")

def read_jsonl_file(file_path: Path) -> List[Dict[Any, Any]]:
    """Read JSONL file (with optional gzip compression)"""
    data = []
    
    try:
        if file_path.suffix == '.gz':
            with gzip.open(file_path, 'rt', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data.append(json.loads(line))
        else:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data.append(json.loads(line))
    except Exception as e:
        log("WARN", f"Failed to read {file_path}: {e}")
        return []
    
    return data

def jsonl_to_parquet(jsonl_path: Path, parquet_path: Path) -> tuple[bool, int, int]:
    """Convert JSONL to Parquet format"""
    try:
        # Read JSONL data
        data = read_jsonl_file(jsonl_path)
        
        if not data:
            log("DEBUG", f"No data in {jsonl_path}")
            return False, 0, 0
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Ensure output directory exists
        parquet_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write Parquet with compression
        df.to_parquet(
            parquet_path,
            engine='pyarrow',
            compression='snappy',  # Good balance of speed/compression
            index=False
        )
        
        # Calculate compression ratio
        original_size = jsonl_path.stat().st_size
        compressed_size = parquet_path.stat().st_size
        
        log("INFO", f"Converted {jsonl_path.name} → {parquet_path.name}",
            original_mb=f"{original_size/1024/1024:.2f}MB",
            compressed_mb=f"{compressed_size/1024/1024:.2f}MB",
            ratio=f"{compressed_size/original_size*100:.1f}%")
        
        return True, original_size, compressed_size
        
    except Exception as e:
        log("ERROR", f"Conversion failed for {jsonl_path}: {e}")
        return False, 0, 0

def process_game_directory(game_dir: Path, analytics_dir: Path, date: datetime) -> Dict[str, Any]:
    """Process a single game directory"""
    stats = {
        "game_id": game_dir.name,
        "files_processed": 0,
        "files_converted": 0,
        "original_size": 0,
        "compressed_size": 0,
        "files_skipped": []
    }
    
    # Find timeline files
    timeline_files = list(game_dir.glob("timeline.jsonl*"))
    
    if not timeline_files:
        stats["files_skipped"].append("no_timeline")
        return stats
    
    for timeline_file in timeline_files:
        stats["files_processed"] += 1
        
        # Determine output path
        # data/predictions/live/date=2025-08-12/game123/timeline.jsonl
        # → analytics/parquet/date=2025-08-12/live/game123.parquet
        
        date_str = date.strftime("%Y-%m-%d")
        kind = game_dir.parent.parent.name  # e.g., "live" from path structure
        
        parquet_dir = analytics_dir / "parquet" / f"date={date_str}" / kind
        parquet_file = parquet_dir / f"{game_dir.name}.parquet"
        
        success, orig_size, comp_size = jsonl_to_parquet(timeline_file, parquet_file)
        
        if success:
            stats["files_converted"] += 1
            stats["original_size"] += orig_size
            stats["compressed_size"] += comp_size
            
            # Remove original JSONL (keep latest.json)
            if timeline_file.name == "timeline.jsonl":  # Don't remove .gz files yet
                timeline_file.unlink()
                log("DEBUG", f"Removed original {timeline_file}")
        else:
            stats["files_skipped"].append(timeline_file.name)
    
    return stats

def rotate_storage(data_dir: str, analytics_dir: str, cutoff_date: datetime, dry_run: bool = False) -> Dict[str, Any]:
    """Main storage rotation function"""
    data_path = Path(data_dir)
    analytics_path = Path(analytics_dir)
    
    summary = {
        "processed_dates": 0,
        "processed_games": 0,
        "converted_files": 0,
        "deleted_files": 0,
        "total_original_size": 0,
        "total_compressed_size": 0,
        "compression_ratio": 0,
        "errors": []
    }
    
    # Process predictions directory
    predictions_dir = data_path / "predictions"
    if not predictions_dir.exists():
        summary["errors"].append(f"Predictions directory not found: {predictions_dir}")
        return summary
    
    # Find all prediction types (live, matchup, etc.)
    for pred_type_dir in predictions_dir.iterdir():
        if not pred_type_dir.is_dir():
            continue
            
        log("INFO", f"Processing prediction type: {pred_type_dir.name}")
        
        # Find date directories
        for date_dir in pred_type_dir.iterdir():
            if not date_dir.is_dir() or not date_dir.name.startswith("date="):
                continue
            
            try:
                dir_date = parse_date_dir(date_dir.name)
            except ValueError as e:
                log("WARN", f"Skipping invalid date directory: {e}")
                continue
            
            # Skip recent dates (within cutoff)
            if dir_date >= cutoff_date:
                log("DEBUG", f"Skipping recent date: {date_dir.name}")
                continue
            
            log("INFO", f"Processing date directory: {date_dir.name}")
            summary["processed_dates"] += 1
            
            # Process each game in the date
            for game_dir in date_dir.iterdir():
                if not game_dir.is_dir():
                    continue
                
                if dry_run:
                    log("INFO", f"[DRY-RUN] Would process {game_dir.relative_to(data_path)}")
                    continue
                
                try:
                    game_stats = process_game_directory(game_dir, analytics_path, dir_date)
                    
                    summary["processed_games"] += 1
                    summary["converted_files"] += game_stats["files_converted"]
                    summary["total_original_size"] += game_stats["original_size"]
                    summary["total_compressed_size"] += game_stats["compressed_size"]
                    
                    if game_stats["files_skipped"]:
                        log("DEBUG", f"Skipped files in {game_dir.name}: {game_stats['files_skipped']}")
                
                except Exception as e:
                    error_msg = f"Error processing {game_dir}: {e}"
                    summary["errors"].append(error_msg)
                    log("ERROR", error_msg)
            
            # Remove empty date directory if all games were processed
            if not dry_run:
                try:
                    remaining_items = list(date_dir.iterdir())
                    if not remaining_items:
                        date_dir.rmdir()
                        log("INFO", f"Removed empty date directory: {date_dir.name}")
                        summary["deleted_files"] += 1
                except OSError:
                    log("DEBUG", f"Date directory not empty: {date_dir.name}")
    
    # Calculate compression ratio
    if summary["total_original_size"] > 0:
        summary["compression_ratio"] = summary["total_compressed_size"] / summary["total_original_size"]
    
    return summary

def main():
    parser = argparse.ArgumentParser(description='NPB Data Storage Rotation')
    parser.add_argument('--date', 
                       help='Process data older than this date (YYYY-MM-DD). Default: yesterday')
    parser.add_argument('--data-dir', default='data',
                       help='Data directory path (default: data)')
    parser.add_argument('--analytics-dir', default='analytics',
                       help='Analytics output directory (default: analytics)')
    parser.add_argument('--retention-days', type=int, default=30,
                       help='Retention period in days (default: 30)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be done without making changes')
    
    args = parser.parse_args()
    
    # Determine cutoff date
    if args.date:
        cutoff_date = datetime.strptime(args.date, "%Y-%m-%d")
    else:
        cutoff_date = datetime.now() - timedelta(days=args.retention_days)
    
    log("INFO", f"Storage rotation starting",
        cutoff_date=cutoff_date.strftime("%Y-%m-%d"),
        data_dir=args.data_dir,
        analytics_dir=args.analytics_dir,
        dry_run=args.dry_run)
    
    try:
        summary = rotate_storage(
            args.data_dir, 
            args.analytics_dir, 
            cutoff_date, 
            args.dry_run
        )
        
        # Print summary
        print("\n📊 Storage Rotation Summary")
        print("=" * 40)
        print(f"📅 Processed dates: {summary['processed_dates']}")
        print(f"🎮 Processed games: {summary['processed_games']}")
        print(f"📄 Converted files: {summary['converted_files']}")
        print(f"🗑️  Deleted items: {summary['deleted_files']}")
        
        if summary['total_original_size'] > 0:
            original_mb = summary['total_original_size'] / 1024 / 1024
            compressed_mb = summary['total_compressed_size'] / 1024 / 1024
            ratio_pct = summary['compression_ratio'] * 100
            
            print(f"💾 Original size: {original_mb:.1f} MB")
            print(f"🗜️  Compressed size: {compressed_mb:.1f} MB")
            print(f"📉 Compression ratio: {ratio_pct:.1f}%")
            print(f"💰 Space saved: {original_mb - compressed_mb:.1f} MB")
        
        if summary['errors']:
            print(f"\n⚠️  Errors encountered: {len(summary['errors'])}")
            for error in summary['errors']:
                print(f"   ❌ {error}")
        
        if summary['compression_ratio'] > 0 and summary['compression_ratio'] <= 0.7:
            print(f"\n🎉 Compression target achieved: {summary['compression_ratio']*100:.1f}% ≤ 70%")
        elif summary['compression_ratio'] > 0.7:
            print(f"\n📈 Compression: {summary['compression_ratio']*100:.1f}% (target: ≤70%)")
        
        exit_code = 1 if summary['errors'] else 0
        
    except Exception as e:
        log("ERROR", f"Storage rotation failed: {e}")
        exit_code = 1
    
    log("INFO", "Storage rotation completed", exit_code=exit_code)
    sys.exit(exit_code)

if __name__ == "__main__":
    main()