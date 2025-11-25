#!/usr/bin/env python3
"""
scripts/benchmark_performance.py - パフォーマンステスト（実行時間 + メモリ使用量）

元プログラムvs最適化版の詳細比較
"""
import time
import psutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

def monitor_execution(command: list, name: str, timeout_sec: int = 600):
    """プロセスの実行時間とメモリ使用量を監視"""
    print(f"\n{'='*60}")
    print(f"🚀 Testing: {name}")
    print(f"Command: {' '.join(command)}")
    print(f"Timeout: {timeout_sec}s")
    print('='*60)
    
    start_time = time.time()
    max_memory_mb = 0
    memory_samples = []
    
    try:
        # プロセス開始
        process = subprocess.Popen(
            command, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
        
        print("⏱️  Progress monitoring:")
        
        # リアルタイム監視
        while process.poll() is None:
            try:
                p = psutil.Process(process.pid)
                memory_mb = p.memory_info().rss / 1024 / 1024
                max_memory_mb = max(max_memory_mb, memory_mb)
                memory_samples.append(memory_mb)
                
                elapsed = time.time() - start_time
                
                # 1秒おきに進捗表示
                print(f"  [{elapsed:5.1f}s] Memory: {memory_mb:6.1f}MB (Peak: {max_memory_mb:6.1f}MB)", end='\r')
                
                # タイムアウトチェック
                if elapsed > timeout_sec:
                    process.terminate()
                    print(f"\n⏰ TIMEOUT after {timeout_sec}s")
                    break
                
                time.sleep(1)
                
            except psutil.NoSuchProcess:
                break
        
        # 結果収集
        total_time = time.time() - start_time
        stdout, stderr = process.communicate()
        exit_code = process.returncode
        
        print(f"\n📊 Results for {name}:")
        print(f"  ⏱️  Total Time: {total_time:.1f}s")
        print(f"  💾 Peak Memory: {max_memory_mb:.1f}MB")
        print(f"  📈 Avg Memory: {sum(memory_samples)/len(memory_samples) if memory_samples else 0:.1f}MB")
        print(f"  ✅ Exit Code: {exit_code}")
        
        # エラー出力（最初の500文字のみ）
        if stderr and exit_code != 0:
            print(f"  ❌ Error Preview: {stderr[:500]}...")
        
        # 成功時の出力サンプル
        if stdout and exit_code == 0:
            lines = stdout.split('\n')
            success_lines = [line for line in lines if 'records' in line or 'completed' in line]
            if success_lines:
                print(f"  📝 Output: {success_lines[-1]}")
        
        return {
            'success': exit_code == 0,
            'time_sec': total_time,
            'peak_memory_mb': max_memory_mb,
            'avg_memory_mb': sum(memory_samples)/len(memory_samples) if memory_samples else 0,
            'timeout': total_time >= timeout_sec
        }
        
    except Exception as e:
        print(f"❌ Error during execution: {e}")
        return {
            'success': False,
            'time_sec': 0,
            'peak_memory_mb': 0,
            'avg_memory_mb': 0,
            'timeout': False,
            'error': str(e)
        }

def estimate_full_execution_time():
    """フル実行時間の推定"""
    print(f"\n{'='*60}")
    print("📋 Full Execution Time Estimation")
    print('='*60)
    
    # 推定パラメータ
    estimates = {
        "軽量版 (roster only)": {
            "pages": 12,  # 12チーム
            "time_per_page": 2.5,  # レート制限込み
            "overhead": 5
        },
        "軽量版 (roster + stats)": {
            "pages": 16,  # 12チーム + 4リーグ統計
            "time_per_page": 2.5,
            "overhead": 5
        },
        "元プログラム (vducp only)": {
            "pages": 100,  # JavaScriptページ多数
            "time_per_page": 15,  # ブラウザ起動+レンダリング
            "overhead": 30
        },
        "元プログラム (full)": {
            "pages": 300,
            "time_per_page": 15,
            "overhead": 60
        }
    }
    
    for name, params in estimates.items():
        total_time = (params["pages"] * params["time_per_page"]) + params["overhead"]
        print(f"{name}:")
        print(f"  Pages: {params['pages']}")
        print(f"  Time per page: {params['time_per_page']}s")
        print(f"  Estimated total: {total_time/60:.1f} minutes ({total_time}s)")
        print()

def run_quick_benchmark():
    """クイックベンチマークテスト"""
    test_date = datetime.now().strftime("%Y-%m-%d")
    
    print("🏃 Quick Performance Benchmark")
    print(f"Test Date: {test_date}")
    
    # テスト1: 軽量版（roster のみ、短時間）
    lightweight_result = monitor_execution([
        "python", "scripts/bbdata_memory_optimized.py",
        "--date", test_date,
        "--targets", "roster",
        "--max-memory-mb", "100"
    ], "Lightweight Scraper (roster only)", timeout_sec=120)
    
    # テスト2: 基本スクレイピングテスト（比較用）
    basic_test_result = monitor_execution([
        "python", "scripts/test_lightweight_scraper.py"
    ], "Basic Scraping Test", timeout_sec=30)
    
    # 結果比較
    print(f"\n{'='*60}")
    print("📊 BENCHMARK SUMMARY")
    print('='*60)
    
    if lightweight_result['success']:
        print(f"✅ Lightweight Scraper:")
        print(f"   Time: {lightweight_result['time_sec']:.1f}s")
        print(f"   Peak Memory: {lightweight_result['peak_memory_mb']:.1f}MB")
        print(f"   Status: {'SUCCESS' if lightweight_result['success'] else 'FAILED'}")
    
    if basic_test_result['success']:
        print(f"✅ Basic Test:")
        print(f"   Time: {basic_test_result['time_sec']:.1f}s")
        print(f"   Peak Memory: {basic_test_result['peak_memory_mb']:.1f}MB")
    
    # パフォーマンス評価
    print(f"\n💡 Performance Assessment:")
    
    if lightweight_result['success']:
        time_per_page = lightweight_result['time_sec'] / 12 if lightweight_result['time_sec'] > 0 else 0
        print(f"   Time per page: ~{time_per_page:.1f}s")
        
        if time_per_page < 5:
            print("   ⚡ EXCELLENT: Very fast processing")
        elif time_per_page < 10:
            print("   ✅ GOOD: Reasonable processing speed")
        elif time_per_page < 20:
            print("   ⚠️  MODERATE: Could be optimized")
        else:
            print("   ❌ SLOW: Needs optimization")
        
        if lightweight_result['peak_memory_mb'] < 100:
            print("   💾 EXCELLENT: Memory usage under control")
        elif lightweight_result['peak_memory_mb'] < 500:
            print("   ✅ GOOD: Acceptable memory usage")
        else:
            print("   ⚠️  HIGH: Memory usage needs attention")

def main():
    print("🔍 Baseball Data Scraper Performance Benchmark")
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # クイックベンチマーク実行
        run_quick_benchmark()
        
        # フル実行時間推定
        estimate_full_execution_time()
        
        print(f"\n🎯 RECOMMENDATIONS:")
        print("1. 軽量版を本番環境で使用")
        print("2. roster + stats で15-20分程度の実行時間を想定")
        print("3. メモリ制限 100MB で安全運用")
        print("4. 必要に応じてバッチサイズを調整")
        
    except KeyboardInterrupt:
        print("\n⏹️  Benchmark interrupted by user")
    except Exception as e:
        print(f"\n❌ Benchmark failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()