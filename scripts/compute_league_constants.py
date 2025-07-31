#!/usr/bin/env python3
"""
compute_league_constants.py
年別リーグ定数の自前推定パイプライン

目的:
1. wOBA係数の年別推定 (RE24ベース)
2. FIP定数Cの年別推定 (ERA整合ベース)  
3. パークファクターの推定
4. league_constants.json の生成・更新
"""

import duckdb
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Tuple
import numpy as np
from dataclasses import dataclass, asdict

@dataclass
class LeagueConstants:
    """年・リーグごとの定数"""
    year: int
    league: str
    
    # wOBA係数 (RE24ベース推定)
    woba_bb: float = 0.69    # unintentional walk
    woba_hbp: float = 0.72   # hit by pitch  
    woba_1b: float = 0.89    # single
    woba_2b: float = 1.27    # double
    woba_3b: float = 1.62    # triple
    woba_hr: float = 2.10    # home run
    woba_scale: float = 1.15 # wOBAスケール
    
    # FIP定数
    fip_constant: float = 3.10
    
    # Run environment
    lg_r_pa: float = 0.10    # リーグ平均 R/PA
    lg_r_g: float = 4.5      # リーグ平均 R/G
    
    # Park factors (中性=1.0)
    park_factors: Dict[str, float] = None
    
    # メタデータ
    sample_games: int = 0
    updated_at: str = ""

class LeagueConstantsCalculator:
    """リーグ定数計算エンジン"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = duckdb.connect(db_path)
        
    def get_batting_totals(self, year: int, league: str = 'first') -> Dict:
        """年・リーグ別の打撃集計を取得"""
        query = """
        SELECT 
            COUNT(DISTINCT b.game_id) as games,
            SUM(b.PA) as PA,
            SUM(b.AB) as AB, 
            SUM(b.H) as H,
            SUM(b.H - b."2B" - b."3B" - b.HR) as "1B",
            SUM(b."2B") as "2B",
            SUM(b."3B") as "3B", 
            SUM(b.HR) as HR,
            SUM(b.BB - COALESCE(b.IBB,0)) as uBB,
            SUM(COALESCE(b.IBB,0)) as IBB,
            SUM(COALESCE(b.HBP,0)) as HBP,
            SUM(COALESCE(b.SF,0)) as SF,
            SUM(b.R) as R,
            SUM(b.RBI) as RBI
        FROM box_batting b
        JOIN games g ON b.game_id = g.game_id
        WHERE EXTRACT(year FROM g.date) = ? 
            AND g.league = ?
            AND g.status = 'FINAL'
        """
        
        result = self.conn.execute(query, [year, league]).fetchone()
        if not result or result[0] == 0:
            return None
            
        columns = ['games', 'PA', 'AB', 'H', '_1B', '_2B', '_3B', 'HR', 
                  'uBB', 'IBB', 'HBP', 'SF', 'R', 'RBI']
        return dict(zip(columns, result))
    
    def get_pitching_totals(self, year: int, league: str = 'first') -> Dict:
        """年・リーグ別の投球集計を取得"""
        query = """
        SELECT
            COUNT(DISTINCT p.game_id) as games,
            SUM(p.IP_outs) as IP_outs,
            SUM(p.H) as H,
            SUM(p.R) as R, 
            SUM(p.ER) as ER,
            SUM(p.HR) as HR,
            SUM(p.BB - COALESCE(p.IBB,0)) as uBB,
            SUM(COALESCE(p.IBB,0)) as IBB,
            SUM(COALESCE(p.HBP,0)) as HBP,
            SUM(p.SO) as SO
        FROM box_pitching p
        JOIN games g ON p.game_id = g.game_id  
        WHERE EXTRACT(year FROM g.date) = ?
            AND g.league = ?
            AND g.status = 'FINAL'
        """
        
        result = self.conn.execute(query, [year, league]).fetchone()
        if not result or result[0] == 0:
            return None
            
        columns = ['games', 'IP_outs', 'H', 'R', 'ER', 'HR', 'uBB', 'IBB', 'HBP', 'SO']
        data = dict(zip(columns, result))
        
        # IP_outs を IP に変換
        data['IP'] = data['IP_outs'] / 3.0 if data['IP_outs'] else 0
        
        return data
    
    def estimate_woba_weights(self, batting_data: Dict, years_pool: List[int] = None) -> Dict[str, float]:
        """
        wOBA係数の推定 (簡易版)
        
        理想: RE24テーブルから線形回帰で係数推定
        現実装: 汎用的な係数をベースに、得点環境で微調整
        """
        if not batting_data:
            # デフォルト係数 (汎用的な値)
            return {
                'woba_bb': 0.69,
                'woba_hbp': 0.72,
                'woba_1b': 0.89, 
                'woba_2b': 1.27,
                'woba_3b': 1.62,
                'woba_hr': 2.10,
                'woba_scale': 1.15
            }
        
        # 得点環境による調整
        r_pa = batting_data['R'] / batting_data['PA'] if batting_data['PA'] > 0 else 0.10
        
        # 低得点→係数下げ、高得点→係数上げ (簡易調整)
        adj_factor = r_pa / 0.10  # 0.10 = 標準的なR/PA
        
        base_weights = {
            'woba_bb': 0.69,
            'woba_hbp': 0.72, 
            'woba_1b': 0.89,
            'woba_2b': 1.27,
            'woba_3b': 1.62,
            'woba_hr': 2.10
        }
        
        # 環境係数で調整
        adjusted_weights = {k: v * adj_factor for k, v in base_weights.items()}
        adjusted_weights['woba_scale'] = 1.15 * adj_factor
        
        return adjusted_weights
    
    def estimate_fip_constant(self, pitching_data: Dict) -> float:
        """
        FIP定数Cの推定
        
        FIP = (13*HR + 3*(BB-IBB+HBP) - 2*K)/IP + C
        C = lgERA - ((13*HR + 3*(BB-IBB+HBP) - 2*K)/IP)
        """
        if not pitching_data or pitching_data['IP'] == 0:
            return 3.10  # デフォルト
            
        # リーグERA
        lg_era = pitching_data['ER'] / pitching_data['IP'] * 9.0
        
        # FIP素材部分
        fip_core = (13 * pitching_data['HR'] + 
                   3 * (pitching_data['uBB'] + pitching_data['HBP']) - 
                   2 * pitching_data['SO']) / pitching_data['IP']
        
        # 定数C = ERA - FIP_core 
        fip_constant = lg_era - fip_core
        
        return round(fip_constant, 3)
    
    def estimate_park_factors(self, year: int, league: str = 'first') -> Dict[str, float]:
        """
        パークファクター推定 (簡易版)
        
        理想: 3年ロール、ホーム/アウェイ分析
        現実装: 球場別得点率の基礎計算
        """
        query = """
        SELECT 
            venue,
            COUNT(*) as games,
            AVG(away_score + home_score) as avg_runs
        FROM games 
        WHERE EXTRACT(year FROM date) = ?
            AND league = ?
            AND status = 'FINAL'
            AND venue IS NOT NULL
        GROUP BY venue
        HAVING COUNT(*) >= 10
        """
        
        results = self.conn.execute(query, [year, league]).fetchall()
        if not results:
            return {'default': 1.0}
        
        # リーグ平均得点
        total_runs = sum(r[1] * r[2] for r in results)
        total_games = sum(r[1] for r in results)
        lg_avg = total_runs / total_games if total_games > 0 else 9.0
        
        # 各球場のファクター
        park_factors = {}
        for venue, games, avg_runs in results:
            park_factors[venue] = round(avg_runs / lg_avg, 3)
        
        return park_factors
    
    def compute_year_constants(self, year: int, league: str = 'first') -> LeagueConstants:
        """指定年・リーグの定数を計算"""
        print(f"Computing constants for {year} {league}...")
        
        # データ取得
        batting_data = self.get_batting_totals(year, league)
        pitching_data = self.get_pitching_totals(year, league)
        
        if not batting_data or not pitching_data:
            print(f"  Warning: Insufficient data for {year} {league}")
            return LeagueConstants(
                year=year,
                league=league,
                sample_games=0,
                updated_at=datetime.now().isoformat()
            )
        
        # wOBA係数推定
        woba_weights = self.estimate_woba_weights(batting_data)
        
        # FIP定数推定  
        fip_constant = self.estimate_fip_constant(pitching_data)
        
        # パークファクター推定
        park_factors = self.estimate_park_factors(year, league)
        
        # Run environment
        lg_r_pa = batting_data['R'] / batting_data['PA'] if batting_data['PA'] > 0 else 0.10
        lg_r_g = batting_data['R'] / batting_data['games'] * 2 if batting_data['games'] > 0 else 4.5  # 両チーム分
        
        return LeagueConstants(
            year=year,
            league=league,
            woba_bb=woba_weights['woba_bb'],
            woba_hbp=woba_weights['woba_hbp'],
            woba_1b=woba_weights['woba_1b'],
            woba_2b=woba_weights['woba_2b'],
            woba_3b=woba_weights['woba_3b'],
            woba_hr=woba_weights['woba_hr'],
            woba_scale=woba_weights['woba_scale'],
            fip_constant=fip_constant,
            lg_r_pa=lg_r_pa,
            lg_r_g=lg_r_g,
            park_factors=park_factors,
            sample_games=batting_data['games'],
            updated_at=datetime.now().isoformat()
        )

def main():
    """メイン処理"""
    # パス設定
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'npb_test.db')
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'constants')
    
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        return
    
    # 出力ディレクトリ作成
    os.makedirs(output_path, exist_ok=True)
    
    # 計算エンジン初期化
    calc = LeagueConstantsCalculator(db_path)
    
    # 利用可能年度を検査
    years_query = """
    SELECT DISTINCT EXTRACT(year FROM date) as year
    FROM games 
    WHERE status = 'FINAL'
    ORDER BY year DESC
    """
    available_years = [int(row[0]) for row in calc.conn.execute(years_query).fetchall()]
    
    if not available_years:
        print("No finalized games found in database")
        return
    
    print(f"Available years: {available_years}")
    
    # 各年の定数計算
    all_constants = {}
    
    for year in available_years:
        for league in ['first']:  # 'farm' は後で追加
            constants = calc.compute_year_constants(year, league)
            key = f"{year}_{league}"
            all_constants[key] = asdict(constants)
            
            print(f"  {year} {league}: {constants.sample_games} games, "
                  f"FIP_C={constants.fip_constant:.3f}, "
                  f"wOBA_scale={constants.woba_scale:.3f}")
    
    # JSON出力
    output_file = os.path.join(output_path, 'league_constants.json')
    
    output_data = {
        'meta': {
            'generated_at': datetime.now().isoformat(),
            'version': '1.0',
            'description': 'NPB league constants computed from official game data',
            'methodology': {
                'woba_weights': 'Run environment adjusted from standard coefficients',
                'fip_constant': 'Fitted to match league ERA average',
                'park_factors': 'Simple runs per game ratio vs league average'
            }
        },
        'constants': all_constants
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\nConstants saved to: {output_file}")
    print(f"Total entries: {len(all_constants)}")

if __name__ == '__main__':
    main()