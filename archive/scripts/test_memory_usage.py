#!/usr/bin/env python3
"""
scripts/test_memory_usage.py - メモリ使用量テストスクリプト

新旧スクレイパーのメモリ使用量を比較
"""
import subprocess
import psutil
import time
import sys
from datetime import datetime

def monitor_process_memory(command: list, name: str, timeout_sec: int = 300):
    """プロセスのメモリ使用量を監視"""
    print(f"\n🔍 Testing {name}")
    print(f"Command: {' '.join(command)}")
    
    try:
        # プロセス開始
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # メモリ監視
        max_memory_mb = 0
        start_time = time.time()
        
        while process.poll() is None:
            try:
                p = psutil.Process(process.pid)
                memory_mb = p.memory_info().rss / 1024 / 1024
                max_memory_mb = max(max_memory_mb, memory_mb)
                
                print(f"  Memory: {memory_mb:.1f}MB (Peak: {max_memory_mb:.1f}MB)", end='\r')
                
                # タイムアウトチェック
                if time.time() - start_time > timeout_sec:
                    process.terminate()
                    print(f"\n  ⏰ Timeout after {timeout_sec}s")
                    break
                
                time.sleep(1)
                
            except psutil.NoSuchProcess:
                break
        
        # 結果取得
        stdout, stderr = process.communicate()
        exit_code = process.returncode
        
        print(f"\n  ✅ Peak Memory: {max_memory_mb:.1f}MB")
        print(f"  Exit Code: {exit_code}")
        
        if exit_code != 0:
            print(f"  Error Output: {stderr.decode()[:200]}")
        
        return max_memory_mb, exit_code == 0
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return 0, False

def main():
    test_date = datetime.now().strftime("%Y-%m-%d")
    
    print("🧪 Memory Usage Comparison Test")
    print("=" * 50)
    
    # テスト1: 軽量版スクレイパー
    lightweight_memory, lightweight_success = monitor_process_memory([
        "python", "scripts/bbdata_memory_optimized.py",
        "--date", test_date,
        "--targets", "roster,stats",
        "--max-memory-mb", "200"
    ], "Lightweight Scraper", timeout_sec=120)
    
    # テスト2: 元のスクレイパー（短時間テスト）
    print("\n" + "=" * 50)
    print("⚠️  Original scraper test (limited time to prevent memory issues)")
    
    original_memory, original_success = monitor_process_memory([
        "python", "baseball-ai-media-backup/scripts/bbdata_deep_collect.py",
        "--date", test_date,
        "--targets", "vducp"
    ], "Original Scraper (Limited)", timeout_sec=60)
    
    # 結果比較
    print("\n" + "=" * 50)
    print("📊 COMPARISON RESULTS")
    print("=" * 50)
    
    print(f"Lightweight Scraper:")
    print(f"  Peak Memory: {lightweight_memory:.1f}MB")
    print(f"  Success: {'✅' if lightweight_success else '❌'}")
    
    print(f"\nOriginal Scraper:")
    print(f"  Peak Memory: {original_memory:.1f}MB")
    print(f"  Success: {'✅' if original_success else '❌'}")
    
    if lightweight_memory > 0 and original_memory > 0:
        reduction = ((original_memory - lightweight_memory) / original_memory) * 100
        print(f"\n🎯 Memory Reduction: {reduction:.1f}%")
        print(f"   ({original_memory:.1f}MB → {lightweight_memory:.1f}MB)")
    
    # 推奨事項
    print("\n💡 RECOMMENDATIONS")
    print("=" * 50)
    
    if lightweight_memory < 200:
        print("✅ Lightweight version meets memory requirements")
    else:
        print("⚠️  Lightweight version needs further optimization")
    
    if original_memory > 1000:
        print("❌ Original version has severe memory issues")
    elif original_memory > 500:
        print("⚠️  Original version has moderate memory issues")
    
    print(f"\n🔧 Next steps:")
    print("1. Use lightweight version for production")
    print("2. Set memory limit with --max-memory-mb flag")
    print("3. Monitor with system metrics")

if __name__ == "__main__":
    main()