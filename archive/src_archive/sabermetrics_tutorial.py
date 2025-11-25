#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sabermetrics_tutorial.py
========================
pybaseballを使ったセイバーメトリクス学習チュートリアル

MLBデータでセイバーメトリクスの基本概念を学び、
将来的にNPBデータにも応用できる知識を習得する。
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# pybaseballのインポート
try:
    import pybaseball as pyb
    print("[OK] pybaseball正常にインポートされました")
except ImportError as e:
    print(f"[ERROR] pybaseballのインポートに失敗: {e}")
    exit(1)

# 日本語フォント設定（可視化用）
plt.rcParams['font.family'] = ['DejaVu Sans', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'Takao', 'IPAexGothic', 'IPAPGothic', 'VL PGothic', 'Noto Sans CJK JP']

class SabermetricsAnalyzer:
    """セイバーメトリクス分析クラス"""
    
    def __init__(self):
        """初期化"""
        self.batting_data = None
        self.pitching_data = None
        self.statcast_data = None
        print("[INIT] セイバーメトリクス分析器を初期化しました")
    
    def test_basic_connection(self):
        """基本的な接続テスト"""
        print("\n[TEST] pybaseball接続テスト中...")
        try:
            # 小規模なテストデータを取得
            test_data = pyb.batting_stats(2024, 2024)
            print(f"[OK] 接続成功！2024年打撃データ: {len(test_data)}選手")
            print(f"[INFO] 取得列数: {len(test_data.columns)}")
            print(f"[INFO] 主要列: {list(test_data.columns[:10])}")
            return True
        except Exception as e:
            print(f"[ERROR] 接続失敗: {e}")
            return False
    
    def get_batting_data(self, year=2024):
        """打撃データの取得"""
        print(f"\n[DATA] {year}年の打撃データを取得中...")
        try:
            self.batting_data = pyb.batting_stats(year, year)
            print(f"[OK] 取得完了: {len(self.batting_data)}選手のデータ")
            
            # 基本統計表示
            print(f"[INFO] 主要指標の要約:")
            key_stats = ['Name', 'Team', 'AVG', 'OBP', 'SLG', 'OPS', 'HR', 'RBI', 'wOBA', 'wRC+', 'WAR']
            available_stats = [col for col in key_stats if col in self.batting_data.columns]
            print(f"   利用可能な指標: {available_stats}")
            
            return self.batting_data
        except Exception as e:
            print(f"[ERROR] データ取得失敗: {e}")
            return None
    
    def calculate_woba_manually(self, player_data):
        """wOBAの手動計算（学習目的）"""
        print("\n[CALC] wOBAを手動計算してみます...")
        
        # 2024年のwOBA係数（FanGraphs）
        woba_weights = {
            'wBB': 0.692,    # 四球
            'wHBP': 0.724,   # 死球  
            'w1B': 0.884,    # 単打
            'w2B': 1.257,    # 二塁打
            'w3B': 1.593,    # 三塁打
            'wHR': 2.058     # 本塁打
        }
        
        try:
            # 必要な統計を計算
            df = player_data.copy()
            
            # 各塁打を計算（存在する列のみ）
            if '1B' not in df.columns and 'H' in df.columns:
                df['1B'] = df['H'] - df.get('2B', 0) - df.get('3B', 0) - df.get('HR', 0)
            
            # 故意四球を除く四球
            if 'uBB' not in df.columns and 'BB' in df.columns:
                df['uBB'] = df['BB'] - df.get('IBB', 0)
            
            # wOBA分子の計算
            numerator = (
                df.get('uBB', 0) * woba_weights['wBB'] +
                df.get('HBP', 0) * woba_weights['wHBP'] +
                df.get('1B', 0) * woba_weights['w1B'] +
                df.get('2B', 0) * woba_weights['w2B'] +
                df.get('3B', 0) * woba_weights['w3B'] +
                df.get('HR', 0) * woba_weights['wHR']
            )
            
            # wOBA分母の計算
            denominator = (
                df.get('AB', 0) + 
                df.get('BB', 0) - 
                df.get('IBB', 0) + 
                df.get('SF', 0) + 
                df.get('HBP', 0)
            )
            
            # wOBA計算
            df['calculated_wOBA'] = numerator / denominator.replace(0, np.nan)
            
            # 結果比較
            if 'wOBA' in df.columns:
                comparison = df[['Name', 'wOBA', 'calculated_wOBA']].dropna()
                print(f"✅ wOBA計算完了: {len(comparison)}選手")
                print("📊 計算値と公式値の比較（上位5選手）:")
                print(comparison.head().to_string(index=False))
                
                # 差異の分析
                comparison['diff'] = abs(comparison['wOBA'] - comparison['calculated_wOBA'])
                avg_diff = comparison['diff'].mean()
                print(f"📈 平均差異: {avg_diff:.4f}")
                
            return df
        except Exception as e:
            print(f"❌ wOBA計算エラー: {e}")
            return player_data
    
    def analyze_top_players(self, n=10):
        """トップ選手の分析"""
        if self.batting_data is None:
            print("❌ まず打撃データを取得してください")
            return
        
        print(f"\n🏆 {n}名のトップ選手分析")
        
        # 最低打席数でフィルタリング
        qualified = self.batting_data[self.batting_data['PA'] >= 400].copy()
        print(f"📊 規定打席以上: {len(qualified)}選手")
        
        if len(qualified) == 0:
            print("⚠️ 規定打席以上の選手が見つかりません")
            return
        
        # 各指標でのトップ選手
        analyses = {
            'wOBA': 'weighted On-Base Average',
            'wRC+': 'weighted Runs Created Plus', 
            'WAR': 'Wins Above Replacement',
            'OPS': 'On-base Plus Slugging'
        }
        
        for stat, description in analyses.items():
            if stat in qualified.columns:
                top_players = qualified.nlargest(n, stat)[['Name', 'Team', stat]]
                print(f"\n🥇 {description} ({stat}) トップ{n}:")
                print(top_players.to_string(index=False))
    
    def get_statcast_sample(self, days_back=7):
        """Statcastデータのサンプル取得"""
        print(f"\n⚾ 過去{days_back}日間のStatcastデータを取得中...")
        
        try:
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days_back)
            
            self.statcast_data = pyb.statcast(
                start_dt=start_date.strftime('%Y-%m-%d'),
                end_dt=end_date.strftime('%Y-%m-%d')
            )
            
            if len(self.statcast_data) > 0:
                print(f"✅ Statcast取得成功: {len(self.statcast_data)}球のデータ")
                print(f"📊 含まれる列: {len(self.statcast_data.columns)}個")
                
                # ユニークな選手数
                unique_batters = self.statcast_data['batter'].nunique()
                unique_pitchers = self.statcast_data['pitcher'].nunique()
                print(f"👥 打者: {unique_batters}人, 投手: {unique_pitchers}人")
                
                return self.statcast_data
            else:
                print("⚠️ データが見つかりませんでした（オフシーズンの可能性）")
                return None
                
        except Exception as e:
            print(f"❌ Statcast取得エラー: {e}")
            return None
    
    def analyze_statcast_basics(self):
        """Statcastデータの基本分析"""
        if self.statcast_data is None or len(self.statcast_data) == 0:
            print("❌ Statcastデータがありません")
            return
        
        print("\n⚾ Statcast基本分析")
        
        # 打球に関する分析
        contact_data = self.statcast_data[
            self.statcast_data['type'] == 'X'  # バットに当たった球
        ].copy()
        
        if len(contact_data) > 0:
            print(f"📊 打球データ: {len(contact_data)}球")
            
            # 基本統計
            stats_cols = ['release_speed', 'launch_speed', 'launch_angle', 'hit_distance_sc']
            available_cols = [col for col in stats_cols if col in contact_data.columns]
            
            if available_cols:
                print("\n📈 打球統計:")
                for col in available_cols:
                    if contact_data[col].notna().sum() > 0:
                        mean_val = contact_data[col].mean()
                        print(f"   {col}: 平均 {mean_val:.1f}")
        
        # 投球に関する分析
        pitch_data = self.statcast_data[
            self.statcast_data['release_speed'].notna()
        ].copy()
        
        if len(pitch_data) > 0:
            print(f"\n⚾ 投球データ: {len(pitch_data)}球")
            avg_speed = pitch_data['release_speed'].mean()
            print(f"   平均球速: {avg_speed:.1f} mph")
            
            # 球種別統計
            if 'pitch_type' in pitch_data.columns:
                pitch_types = pitch_data['pitch_type'].value_counts().head()
                print("   球種別投球数:")
                for pitch_type, count in pitch_types.items():
                    print(f"     {pitch_type}: {count}球")

def main():
    """メイン実行関数"""
    print("🏟️ pybaseballセイバーメトリクス学習チュートリアル")
    print("=" * 50)
    
    # アナライザー初期化
    analyzer = SabermetricsAnalyzer()
    
    # Step 1: 接続テスト
    if not analyzer.test_basic_connection():
        print("❌ 基本接続に失敗しました")
        return
    
    # Step 2: 打撃データ取得・分析
    batting_data = analyzer.get_batting_data(2024)
    if batting_data is not None:
        # wOBA手動計算
        analyzer.calculate_woba_manually(batting_data)
        
        # トップ選手分析
        analyzer.analyze_top_players(10)
    
    # Step 3: Statcastデータ分析（オプション）
    print("\n" + "=" * 50)
    print("🤔 Statcastデータも取得しますか？ (y/n): ", end="")
    
    # 自動実行の場合はStatcastもテスト
    try:
        statcast_data = analyzer.get_statcast_sample(3)  # 過去3日間
        if statcast_data is not None:
            analyzer.analyze_statcast_basics()
    except Exception as e:
        print(f"⚠️ Statcastテストスキップ: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 チュートリアル完了！")
    print("📚 次のステップ:")
    print("   1. wOBA計算ロジックの理解")
    print("   2. 他の指標（FIP, WAR等）の計算")
    print("   3. NPBデータへの応用")

if __name__ == "__main__":
    main()