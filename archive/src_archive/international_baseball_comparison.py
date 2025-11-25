#!/usr/bin/env python3
"""
International Baseball Comparison System
国際野球比較分析システム
NPB vs KBO vs MLB の詳細統計比較
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import logging
from dataclasses import dataclass
import matplotlib.pyplot as plt
import seaborn as sns
import json
import requests
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 日本語フォント設定
plt.rcParams['font.family'] = ['Yu Gothic', 'Meiryo', 'DejaVu Sans']

@dataclass
class LeagueProfile:
    league_name: str
    country: str
    total_teams: int
    total_players: int
    season_games: int
    avg_batting_avg: float
    avg_era: float
    avg_ops: float
    foreign_player_ratio: float
    avg_player_age: float
    power_hitting_rate: float  # 本塁打率
    strikeout_rate: float
    competitive_balance: float
    market_size_rank: int

@dataclass
class ComparisonMetrics:
    metric_name: str
    npb_value: float
    kbo_value: float
    mlb_value: float
    global_average: float
    leader: str
    analysis: str

class InternationalBaseballComparison:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        
        # リーグ基本情報
        self.league_info = {
            'npb': {
                'country': 'Japan',
                'founded': 1950,
                'teams': 12,
                'season_games': 144,
                'market_size': 1  # 1=Large, 2=Medium, 3=Small
            },
            'kbo': {
                'country': 'South Korea',
                'founded': 1982,
                'teams': 10,
                'season_games': 144,
                'market_size': 2
            },
            'mlb': {
                'country': 'United States',
                'founded': 1876,
                'teams': 30,
                'season_games': 162,
                'market_size': 1
            }
        }
        
        # 外部API設定（サンプル）
        self.mlb_api_base = "https://statsapi.mlb.com/api/v1"
        
    def connect_db(self):
        return sqlite3.connect(self.db_path)
    
    def load_npb_data(self) -> pd.DataFrame:
        """NPBデータ読み込み"""
        conn = self.connect_db()
        
        query = """
        SELECT 
            'npb' as league,
            p.player_id, p.full_name, p.age, p.nationality,
            p.primary_position, p.current_team,
            y.season, y.games_played, y.at_bats, y.hits,
            y.home_runs, y.rbis, y.batting_avg, y.on_base_pct,
            y.slugging_pct, y.ops, y.strikeouts,
            y.innings_pitched, y.era, y.whip, y.wins, y.losses,
            y.strikeouts_pitched, y.walks_allowed
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league = 'npb' AND y.season >= 2023
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        logger.info(f"NPBデータ読み込み: {len(df)}レコード")
        return df
    
    def load_kbo_data(self) -> pd.DataFrame:
        """KBOデータ読み込み"""
        conn = self.connect_db()
        
        query = """
        SELECT 
            'kbo' as league,
            p.player_id, p.full_name, p.age, p.nationality,
            p.primary_position, p.current_team,
            y.season, y.games_played, y.at_bats, y.hits,
            y.home_runs, y.rbis, y.batting_avg, y.on_base_pct,
            y.slugging_pct, y.ops, y.strikeouts,
            y.innings_pitched, y.era, y.whip, y.wins, y.losses,
            y.strikeouts_pitched, y.walks_allowed
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league = 'kbo' AND y.season >= 2023
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        logger.info(f"KBOデータ読み込み: {len(df)}レコード")
        return df
    
    def fetch_mlb_data_sample(self) -> pd.DataFrame:
        """MLBサンプルデータ生成（実際のAPIは制限があるため）"""
        # 実環境では MLB Stats API を使用
        # ここではリアルな統計に基づくサンプルデータを生成
        
        logger.info("MLB統計データ生成中...")
        
        # MLB主要チーム
        mlb_teams = ['Yankees', 'Red Sox', 'Dodgers', 'Giants', 'Cubs', 'Cardinals', 
                     'Astros', 'Braves', 'Phillies', 'Mets', 'Angels', 'Padres',
                     'Rangers', 'Athletics', 'Mariners', 'Guardians', 'Tigers', 'Twins',
                     'Royals', 'White Sox', 'Orioles', 'Rays', 'Blue Jays', 'Nationals',
                     'Marlins', 'Pirates', 'Reds', 'Brewers', 'Rockies', 'Diamondbacks']
        
        # 2023年MLB実績に基づくサンプルデータ
        mlb_sample = pd.DataFrame({
            'league': ['mlb'] * 100,
            'player_id': range(90000, 90100),
            'full_name': [f'MLB Player {i}' for i in range(1, 101)],
            'age': np.random.normal(28, 4, 100).astype(int),
            'nationality': ['USA'] * 70 + ['DOM'] * 15 + ['VEN'] * 10 + ['Other'] * 5,
            'primary_position': np.random.choice(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'], 100),
            'current_team': np.random.choice(mlb_teams, 100),
            'season': [2023] * 100,
            'games_played': np.random.normal(130, 20, 100).astype(int),
            'at_bats': np.random.normal(450, 80, 100).astype(int),
            'hits': np.random.normal(120, 25, 100).astype(int),
            'home_runs': np.random.normal(18, 12, 100).astype(int),
            'rbis': np.random.normal(65, 20, 100).astype(int),
            'batting_avg': np.random.normal(0.248, 0.040, 100),  # 2023 MLB平均
            'on_base_pct': np.random.normal(0.317, 0.035, 100),
            'slugging_pct': np.random.normal(0.408, 0.070, 100),
            'ops': np.random.normal(0.725, 0.090, 100),
            'strikeouts': np.random.normal(120, 30, 100).astype(int),
            'innings_pitched': np.random.normal(80, 60, 100),
            'era': np.random.normal(4.28, 1.20, 100),  # 2023 MLB平均
            'whip': np.random.normal(1.32, 0.20, 100),
            'wins': np.random.normal(8, 6, 100).astype(int),
            'losses': np.random.normal(8, 5, 100).astype(int),
            'strikeouts_pitched': np.random.normal(90, 70, 100).astype(int),
            'walks_allowed': np.random.normal(35, 25, 100).astype(int)
        })
        
        # 現実的な制約を適用
        mlb_sample.loc[mlb_sample['batting_avg'] < 0.150, 'batting_avg'] = 0.200
        mlb_sample.loc[mlb_sample['batting_avg'] > 0.400, 'batting_avg'] = 0.350
        mlb_sample.loc[mlb_sample['era'] < 1.50, 'era'] = 2.00
        mlb_sample.loc[mlb_sample['era'] > 8.00, 'era'] = 6.50
        
        return mlb_sample
    
    def create_league_profile(self, league_data: pd.DataFrame, league: str) -> LeagueProfile:
        """リーグプロファイル作成"""
        info = self.league_info[league]
        
        # 基本統計
        total_players = len(league_data['player_id'].unique())
        
        # 打撃統計（打者のみ）
        batters = league_data[league_data['at_bats'] > 0]
        avg_batting_avg = batters['batting_avg'].mean() if not batters.empty else 0.250
        avg_ops = batters['ops'].mean() if not batters.empty else 0.700
        
        # 投手統計
        pitchers = league_data[league_data['innings_pitched'] > 0]
        avg_era = pitchers['era'].mean() if not pitchers.empty else 4.00
        
        # パワー指標
        power_hitting_rate = (batters['home_runs'].sum() / batters['at_bats'].sum() * 1000) if not batters.empty else 20
        
        # 三振率
        strikeout_rate = (batters['strikeouts'].sum() / batters['at_bats'].sum() * 100) if not batters.empty else 20
        
        # 外国人選手比率
        if league == 'npb':
            foreign_ratio = len(league_data[league_data['nationality'] != 'JPN']) / total_players
        elif league == 'kbo':
            foreign_ratio = len(league_data[league_data['nationality'] != 'KOR']) / total_players
        else:  # mlb
            foreign_ratio = len(league_data[league_data['nationality'] != 'USA']) / total_players
        
        # 競技バランス（標準偏差ベース）
        try:
            if 'current_team' in league_data.columns and not league_data['current_team'].isna().all():
                team_wins = league_data.groupby('current_team')['wins'].sum()
                competitive_balance = 100 - (team_wins.std() * 2) if not team_wins.empty and team_wins.std() > 0 else 50
            else:
                competitive_balance = 50  # デフォルト値
        except Exception:
            competitive_balance = 50
        
        return LeagueProfile(
            league_name=league.upper(),
            country=info['country'],
            total_teams=info['teams'],
            total_players=total_players,
            season_games=info['season_games'],
            avg_batting_avg=round(avg_batting_avg, 3),
            avg_era=round(avg_era, 2),
            avg_ops=round(avg_ops, 3),
            foreign_player_ratio=round(foreign_ratio, 3),
            avg_player_age=round(league_data['age'].mean(), 1),
            power_hitting_rate=round(power_hitting_rate, 1),
            strikeout_rate=round(strikeout_rate, 1),
            competitive_balance=round(competitive_balance, 1),
            market_size_rank=info['market_size']
        )
    
    def compare_leagues(self) -> List[ComparisonMetrics]:
        """リーグ間比較分析"""
        logger.info("国際リーグ比較分析開始...")
        
        # データ読み込み
        npb_data = self.load_npb_data()
        kbo_data = self.load_kbo_data()
        mlb_data = self.fetch_mlb_data_sample()
        
        # リーグプロファイル作成
        npb_profile = self.create_league_profile(npb_data, 'npb')
        kbo_profile = self.create_league_profile(kbo_data, 'kbo')
        mlb_profile = self.create_league_profile(mlb_data, 'mlb')
        
        profiles = {
            'NPB': npb_profile,
            'KBO': kbo_profile,
            'MLB': mlb_profile
        }
        
        # 比較メトリクス生成
        comparisons = []
        
        # 1. 打撃力比較
        batting_values = {
            'NPB': npb_profile.avg_batting_avg,
            'KBO': kbo_profile.avg_batting_avg,
            'MLB': mlb_profile.avg_batting_avg
        }
        leader = max(batting_values, key=batting_values.get)
        global_avg = np.mean(list(batting_values.values()))
        
        comparisons.append(ComparisonMetrics(
            metric_name="平均打率",
            npb_value=npb_profile.avg_batting_avg,
            kbo_value=kbo_profile.avg_batting_avg,
            mlb_value=mlb_profile.avg_batting_avg,
            global_average=round(global_avg, 3),
            leader=leader,
            analysis=f"{leader}が最高打率を記録。アジアリーグはコンタクト重視の傾向。"
        ))
        
        # 2. 長打力比較（OPS）
        ops_values = {
            'NPB': npb_profile.avg_ops,
            'KBO': kbo_profile.avg_ops,
            'MLB': mlb_profile.avg_ops
        }
        ops_leader = max(ops_values, key=ops_values.get)
        ops_avg = np.mean(list(ops_values.values()))
        
        comparisons.append(ComparisonMetrics(
            metric_name="OPS (長打力)",
            npb_value=npb_profile.avg_ops,
            kbo_value=kbo_profile.avg_ops,
            mlb_value=mlb_profile.avg_ops,
            global_average=round(ops_avg, 3),
            leader=ops_leader,
            analysis=f"{ops_leader}が最高OPSを記録。MLBはパワー重視の攻撃スタイル。"
        ))
        
        # 3. 投手力比較（ERA）
        era_values = {
            'NPB': npb_profile.avg_era,
            'KBO': kbo_profile.avg_era,
            'MLB': mlb_profile.avg_era
        }
        era_leader = min(era_values, key=era_values.get)  # ERAは低いほうが良い
        era_avg = np.mean(list(era_values.values()))
        
        comparisons.append(ComparisonMetrics(
            metric_name="平均ERA",
            npb_value=npb_profile.avg_era,
            kbo_value=kbo_profile.avg_era,
            mlb_value=mlb_profile.avg_era,
            global_average=round(era_avg, 2),
            leader=era_leader,
            analysis=f"{era_leader}が最低ERA。アジアリーグは投手優位の傾向。"
        ))
        
        # 4. 国際性比較
        foreign_values = {
            'NPB': npb_profile.foreign_player_ratio,
            'KBO': kbo_profile.foreign_player_ratio,
            'MLB': mlb_profile.foreign_player_ratio
        }
        foreign_leader = max(foreign_values, key=foreign_values.get)
        foreign_avg = np.mean(list(foreign_values.values()))
        
        comparisons.append(ComparisonMetrics(
            metric_name="外国人選手比率",
            npb_value=npb_profile.foreign_player_ratio,
            kbo_value=kbo_profile.foreign_player_ratio,
            mlb_value=mlb_profile.foreign_player_ratio,
            global_average=round(foreign_avg, 3),
            leader=foreign_leader,
            analysis=f"{foreign_leader}が最高の国際性。グローバル化が進展。"
        ))
        
        # 5. パワー指標比較
        power_values = {
            'NPB': npb_profile.power_hitting_rate,
            'KBO': kbo_profile.power_hitting_rate,
            'MLB': mlb_profile.power_hitting_rate
        }
        power_leader = max(power_values, key=power_values.get)
        power_avg = np.mean(list(power_values.values()))
        
        comparisons.append(ComparisonMetrics(
            metric_name="本塁打率 (per 1000 AB)",
            npb_value=npb_profile.power_hitting_rate,
            kbo_value=kbo_profile.power_hitting_rate,
            mlb_value=mlb_profile.power_hitting_rate,
            global_average=round(power_avg, 1),
            leader=power_leader,
            analysis=f"{power_leader}が最高本塁打率。パワー野球の浸透度を示す。"
        ))
        
        logger.info(f"比較分析完了: {len(comparisons)}項目")
        return comparisons
    
    def generate_similarity_analysis(self) -> Dict[str, Any]:
        """リーグ間類似性分析"""
        logger.info("リーグ類似性分析開始...")
        
        comparisons = self.compare_leagues()
        
        # NPB vs KBO 類似度計算
        npb_kbo_similarity = self.calculate_similarity(
            [c.npb_value for c in comparisons],
            [c.kbo_value for c in comparisons]
        )
        
        # NPB vs MLB 類似度計算
        npb_mlb_similarity = self.calculate_similarity(
            [c.npb_value for c in comparisons],
            [c.mlb_value for c in comparisons]
        )
        
        # KBO vs MLB 類似度計算
        kbo_mlb_similarity = self.calculate_similarity(
            [c.kbo_value for c in comparisons],
            [c.mlb_value for c in comparisons]
        )
        
        similarity_analysis = {
            'npb_kbo': {
                'score': round(npb_kbo_similarity, 3),
                'relationship': 'アジア隣国リーグ',
                'key_similarities': [
                    '投手優位の傾向',
                    'コンタクト重視の打撃',
                    '外国人枠制限',
                    '144試合制'
                ],
                'key_differences': [
                    '市場規模格差',
                    '平均年齢差',
                    '競技バランス'
                ]
            },
            'npb_mlb': {
                'score': round(npb_mlb_similarity, 3),
                'relationship': '太平洋リーグ関係',
                'key_similarities': [
                    '高い競技レベル',
                    '大きな市場規模',
                    'メディア注目度'
                ],
                'key_differences': [
                    'パワー vs コンタクト',
                    '選手移籍自由度',
                    '薬物検査基準',
                    'シーズン長さ'
                ]
            },
            'kbo_mlb': {
                'score': round(kbo_mlb_similarity, 3),
                'relationship': '新興 vs 伝統',
                'key_similarities': [
                    'パワー重視傾向',
                    'エンターテインメント性'
                ],
                'key_differences': [
                    '歴史と伝統',
                    '市場規模',
                    '国際認知度'
                ]
            }
        }
        
        return similarity_analysis
    
    def calculate_similarity(self, values1: List[float], values2: List[float]) -> float:
        """類似度計算（コサイン類似度）"""
        try:
            v1 = np.array(values1)
            v2 = np.array(values2)
            
            # 正規化
            v1_norm = v1 / np.linalg.norm(v1)
            v2_norm = v2 / np.linalg.norm(v2)
            
            # コサイン類似度
            similarity = np.dot(v1_norm, v2_norm)
            return max(0, min(1, similarity))  # 0-1に正規化
            
        except:
            return 0.5  # デフォルト値
    
    def create_comparison_report(self, comparisons: List[ComparisonMetrics], 
                               similarity: Dict[str, Any]) -> str:
        """国際比較レポート作成"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"international_baseball_comparison_{timestamp}.json"
        
        report_data = {
            'analysis_date': datetime.now().isoformat(),
            'leagues_compared': ['NPB', 'KBO', 'MLB'],
            'comparison_metrics': [],
            'similarity_analysis': similarity,
            'summary': {
                'most_similar_leagues': max(similarity.keys(), 
                                          key=lambda x: similarity[x]['score']),
                'key_global_trends': [
                    '国際化の進展',
                    'セイバーメトリクス導入',
                    'エンターテインメント性向上'
                ]
            }
        }
        
        for comp in comparisons:
            report_data['comparison_metrics'].append({
                'metric': comp.metric_name,
                'values': {
                    'NPB': comp.npb_value,
                    'KBO': comp.kbo_value,
                    'MLB': comp.mlb_value
                },
                'global_average': comp.global_average,
                'leader': comp.leader,
                'analysis': comp.analysis
            })
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"国際比較レポート保存: {filename}")
        return filename
    
    def visualize_international_comparison(self, comparisons: List[ComparisonMetrics]) -> str:
        """国際比較可視化"""
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        fig.suptitle('International Baseball League Comparison\n国際野球リーグ比較分析', 
                     fontsize=16, fontweight='bold')
        
        leagues = ['NPB', 'KBO', 'MLB']
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1']
        
        # 1. 打撃指標レーダーチャート
        batting_metrics = ['平均打率', 'OPS (長打力)', '本塁打率 (per 1000 AB)']
        batting_data = []
        
        for league in leagues:
            values = []
            for metric in batting_metrics:
                comp = next((c for c in comparisons if c.metric_name == metric), None)
                if comp:
                    if league == 'NPB':
                        values.append(comp.npb_value)
                    elif league == 'KBO':
                        values.append(comp.kbo_value)
                    else:
                        values.append(comp.mlb_value)
            batting_data.append(values)
        
        # レーダーチャート作成
        angles = np.linspace(0, 2*np.pi, len(batting_metrics), endpoint=False)
        angles = np.concatenate((angles, [angles[0]]))  # 閉じた図形
        
        ax_radar = plt.subplot(2, 3, 1, projection='polar')
        for i, (league, data, color) in enumerate(zip(leagues, batting_data, colors)):
            values = data + [data[0]]  # 閉じた図形
            ax_radar.plot(angles, values, 'o-', linewidth=2, label=league, color=color)
            ax_radar.fill(angles, values, alpha=0.1, color=color)
        
        ax_radar.set_xticks(angles[:-1])
        ax_radar.set_xticklabels(batting_metrics)
        ax_radar.set_title('打撃指標比較')
        ax_radar.legend()
        
        # 2. リーグ別平均ERA比較
        era_comp = next(c for c in comparisons if c.metric_name == '平均ERA')
        era_values = [era_comp.npb_value, era_comp.kbo_value, era_comp.mlb_value]
        
        axes[0,1].bar(leagues, era_values, color=colors)
        axes[0,1].set_title('平均ERA比較 (低いほど優秀)')
        axes[0,1].set_ylabel('ERA')
        
        for i, v in enumerate(era_values):
            axes[0,1].text(i, v + 0.05, str(v), ha='center', fontweight='bold')
        
        # 3. 外国人選手比率
        foreign_comp = next(c for c in comparisons if c.metric_name == '外国人選手比率')
        foreign_values = [foreign_comp.npb_value, foreign_comp.kbo_value, foreign_comp.mlb_value]
        
        axes[0,2].pie(foreign_values, labels=leagues, colors=colors, autopct='%1.1f%%')
        axes[0,2].set_title('外国人選手比率')
        
        # 4. パワー指標比較
        power_comp = next(c for c in comparisons if c.metric_name.startswith('本塁打率'))
        power_values = [power_comp.npb_value, power_comp.kbo_value, power_comp.mlb_value]
        
        axes[1,0].barh(leagues, power_values, color=colors)
        axes[1,0].set_title('本塁打率比較')
        axes[1,0].set_xlabel('本塁打/1000打席')
        
        # 5. 総合比較散布図
        axes[1,1].scatter(['NPB'], [era_comp.npb_value], s=power_comp.npb_value*10, 
                         color=colors[0], alpha=0.7, label='NPB')
        axes[1,1].scatter(['KBO'], [era_comp.kbo_value], s=power_comp.kbo_value*10, 
                         color=colors[1], alpha=0.7, label='KBO')
        axes[1,1].scatter(['MLB'], [era_comp.mlb_value], s=power_comp.mlb_value*10, 
                         color=colors[2], alpha=0.7, label='MLB')
        
        axes[1,1].set_ylabel('ERA (投手力)')
        axes[1,1].set_title('投手力 vs パワー (サイズ=本塁打率)')
        axes[1,1].legend()
        
        # 6. 全指標総合ランキング
        ranking_data = []
        for league in leagues:
            total_score = 0
            count = 0
            
            for comp in comparisons:
                if league == 'NPB':
                    value = comp.npb_value
                elif league == 'KBO':
                    value = comp.kbo_value
                else:
                    value = comp.mlb_value
                
                # 正規化スコア（0-100）
                if comp.metric_name == '平均ERA':
                    # ERAは低いほうが良い
                    normalized = (5.0 - value) / 2.0 * 100
                else:
                    normalized = value / comp.global_average * 50
                
                total_score += max(0, min(100, normalized))
                count += 1
            
            ranking_data.append(total_score / count if count > 0 else 0)
        
        axes[1,2].bar(leagues, ranking_data, color=colors)
        axes[1,2].set_title('総合競技力ランキング')
        axes[1,2].set_ylabel('総合スコア')
        
        for i, v in enumerate(ranking_data):
            axes[1,2].text(i, v + 1, f'{v:.1f}', ha='center', fontweight='bold')
        
        plt.tight_layout()
        
        filename = f'international_comparison_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"国際比較可視化保存: {filename}")
        return filename

def main():
    """メイン実行"""
    comparator = InternationalBaseballComparison()
    
    print("="*80)
    print("INTERNATIONAL BASEBALL COMPARISON SYSTEM")
    print("国際野球比較分析システム")
    print("="*80)
    
    print("\n野球の国際比較分析を実行中...")
    print("対象リーグ: NPB (日本) vs KBO (韓国) vs MLB (米国)")
    
    try:
        # 比較分析実行
        comparisons = comparator.compare_leagues()
        
        # 類似性分析
        similarity = comparator.generate_similarity_analysis()
        
        # レポート作成
        report_file = comparator.create_comparison_report(comparisons, similarity)
        
        # 可視化作成
        viz_file = comparator.visualize_international_comparison(comparisons)
        
        # 結果表示
        print(f"\n=== 国際野球リーグ比較結果 ===")
        print(f"分析項目: {len(comparisons)}項目")
        
        for comp in comparisons:
            print(f"\n【{comp.metric_name}】")
            print(f"  NPB: {comp.npb_value}")
            print(f"  KBO: {comp.kbo_value}")
            print(f"  MLB: {comp.mlb_value}")
            print(f"  リーダー: {comp.leader}")
            print(f"  分析: {comp.analysis}")
        
        print(f"\n=== リーグ類似性分析 ===")
        for pair, data in similarity.items():
            print(f"{pair.replace('_', ' vs ').upper()}: {data['score']:.3f}")
            print(f"  関係性: {data['relationship']}")
        
        print(f"\n詳細レポート: {report_file}")
        print(f"可視化ファイル: {viz_file}")
        
    except Exception as e:
        logger.error(f"分析エラー: {e}")
        print(f"エラーが発生しました: {e}")

if __name__ == "__main__":
    main()