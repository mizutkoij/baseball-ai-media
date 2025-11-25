#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_npb_collection.py
=====================
NPB全現役選手の実データ収集システム（バックグラウンド実行版）
"""

import os
import sys
import codecs
import subprocess

# 標準出力をUTF-8に設定
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

def main():
    print("Starting NPB Current Players Data Collection...")
    
    # Pythonスクリプトをバックグラウンドで実行
    try:
        # Python環境でUTF-8を強制設定
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        
        result = subprocess.run([
            sys.executable, 
            'collect_npb_current_players.py'
        ], 
        capture_output=True, 
        text=True, 
        encoding='utf-8',
        env=env,
        timeout=3600  # 1時間のタイムアウト
        )
        
        print(f"Exit code: {result.returncode}")
        
        if result.stdout:
            print("STDOUT:")
            print(result.stdout)
            
        if result.stderr:
            print("STDERR:")
            print(result.stderr)
            
        return result.returncode == 0
        
    except subprocess.TimeoutExpired:
        print("Collection timed out after 1 hour")
        return False
    except Exception as e:
        print(f"Error running collection: {e}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("Collection completed successfully!")
    else:
        print("Collection failed or timed out.")