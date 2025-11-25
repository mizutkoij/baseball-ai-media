#!/usr/bin/env python3
"""
Game Strategy Analyzer System
試合戦略分析システム
打順最適化・投手起用・戦術分析を行う
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import logging
from dataclasses import dataclass
import matplotlib.pyplot as plt
import seaborn as sns
from itertools import permutations, combinations
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 日本語フォント設定
plt.rcParams['font.family'] = ['Yu Gothic', 'Meiryo', 'DejaVu Sans']

@dataclass
class LineupOptimization:
    lineup_id: str
    batting_order: List[str]
    projected_runs: float
    win_probability: float
    strengths: List[str]
    weaknesses: List[str]
    situational_factors: Dict[str, Any]

@dataclass
class PitchingStrategy:
    starter_name: str
    projected_innings: float
    bullpen_usage: Dict[str, float]
    matchup_advantages: List[str]
    risk_factors: List[str]
    optimal_situations: Dict[str, str]

@dataclass
class GameSituation:
    inning: int
    outs: int
    runners_on: List[str]  # ['1B', '2B', '3B']
    score_diff: int
    leverage_index: float

class GameStrategyAnalyzer:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        
        # 打順別重要度重み
        self.batting_order_weights = {
            1: {'obp': 0.40, 'slg': 0.30, 'spd': 0.20, 'avg': 0.10},  # リードオフ
            2: {'obp': 0.35, 'avg': 0.25, 'spd': 0.25, 'slg': 0.15},  # 2番
            3: {'avg': 0.35, 'obp': 0.30, 'slg': 0.25, 'rbi': 0.10},  # 3番
            4: {'slg': 0.40, 'rbi': 0.30, 'hr': 0.20, 'avg': 0.10},   # 4番
            5: {'rbi': 0.35, 'slg': 0.35, 'hr': 0.20, 'avg': 0.10},   # 5番
            6: {'avg': 0.30, 'obp': 0.25, 'slg': 0.25, 'rbi': 0.20},  # 6番
            7: {'obp': 0.30, 'avg': 0.30, 'slg': 0.20, 'spd': 0.20},  # 7番
            8: {'obp': 0.35, 'avg': 0.25, 'def': 0.25, 'spd': 0.15},  # 8番
            9: {'obp': 0.30, 'spd': 0.30, 'avg': 0.25, 'def': 0.15}   # 9番
        }
        
        # 状況別戦略
        self.situational_strategies = {
            'early_innings': {'conservative': 0.7, 'aggressive': 0.3},
            'late_innings_ahead': {'conservative': 0.8, 'aggressive': 0.2},
            'late_innings_behind': {'conservative': 0.3, 'aggressive': 0.7},
            'close_game': {'conservative': 0.6, 'aggressive': 0.4}
        }
        
        # レバレッジインデックス計算用
        self.leverage_matrix = {
            (0, 0): {'bases_empty': 1.0, '1B': 1.3, '2B': 1.5, '3B': 1.8, '1B_2B': 1.6, '1B_3B': 2.0, '2B_3B': 2.2, 'loaded': 2.5},
            (0, 1): {'bases_empty': 0.8, '1B': 1.0, '2B': 1.2, '3B': 1.5, '1B_2B': 1.3, '1B_3B': 1.7, '2B_3B': 1.9, 'loaded': 2.1},
            (0, 2): {'bases_empty': 0.6, '1B': 0.8, '2B': 1.0, '3B': 1.2, '1B_2B': 1.0, '1B_3B': 1.3, '2B_3B': 1.5, 'loaded': 1.7},
            (1, 0): {'bases_empty': 0.9, '1B': 1.2, '2B': 1.4, '3B': 1.6, '1B_2B': 1.5, '1B_3B': 1.8, '2B_3B': 2.0, 'loaded': 2.3},
            (1, 1): {'bases_empty': 0.7, '1B': 0.9, '2B': 1.1, '3B': 1.4, '1B_2B': 1.2, '1B_3B': 1.5, '2B_3B': 1.7, 'loaded': 2.0},
            (1, 2): {'bases_empty': 0.5, '1B': 0.7, '2B': 0.9, '3B': 1.1, '1B_2B': 0.9, '1B_3B': 1.1, '2B_3B': 1.3, 'loaded': 1.5}
        }
    
    def connect_db(self):
        return sqlite3.connect(self.db_path)
    
    def load_team_roster(self, team_name: str, league: str = 'npb') -> pd.DataFrame:
        """チームロスター読み込み"""
        conn = self.connect_db()
        
        query = """
        SELECT 
            p.player_id, p.full_name, p.primary_position, p.age,
            y.season, y.games_played, y.at_bats, y.hits, 
            y.home_runs, y.rbis, y.runs, y.walks, y.strikeouts, y.stolen_bases,
            y.batting_avg, y.on_base_pct, y.slugging_pct, y.ops,
            y.innings_pitched, y.wins, y.losses, y.era, y.whip,
            y.strikeouts_pitched, y.walks_allowed
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.current_team = ? AND p.league = ?
        AND y.season >= 2023
        ORDER BY p.primary_position, y.season DESC
        """
        
        df = pd.read_sql_query(query, conn, params=(team_name, league))
        conn.close()
        
        # 最新シーズンのデータを使用
        df = df.groupby('player_id').first().reset_index()
        
        logger.info(f"{team_name} ロスター読み込み: {len(df)}選手")
        return df
    
    def calculate_player_value(self, player_data: pd.Series, position_in_lineup: int) -> float:
        """選手の打順別価値計算"""
        if position_in_lineup not in self.batting_order_weights:
            return 0.0
        
        weights = self.batting_order_weights[position_in_lineup]
        value = 0.0
        
        # 各指標の正規化と重み付け
        obp = player_data.get('on_base_pct', 0.300)
        slg = player_data.get('slugging_pct', 0.400)
        avg = player_data.get('batting_avg', 0.250)
        hr = player_data.get('home_runs', 10)
        rbi = player_data.get('rbis', 50)
        sb = player_data.get('stolen_bases', 5)
        
        # 正規化（リーグ平均を基準）
        normalized_stats = {
            'obp': (obp - 0.300) / 0.050 + 1.0,
            'slg': (slg - 0.400) / 0.100 + 1.0,
            'avg': (avg - 0.250) / 0.050 + 1.0,
            'hr': hr / 20.0,
            'rbi': rbi / 70.0,
            'spd': min(2.0, sb / 15.0 + 0.5),
            'def': 1.0  # 守備指標は簡略化
        }
        
        for stat, weight in weights.items():
            if stat in normalized_stats:
                value += normalized_stats[stat] * weight * 100
        
        return max(0, value)
    
    def optimize_batting_order(self, roster: pd.DataFrame, 
                              constraints: Dict[str, Any] = None) -> LineupOptimization:
        """打順最適化"""
        logger.info("打順最適化実行中...")
        
        # 野手のみ抽出
        batters = roster[roster['primary_position'] != 'P'].copy()
        
        if len(batters) < 9:
            logger.warning(f"野手が{len(batters)}人しかいません")
            return None
        
        # 制約条件適用（例：特定選手を特定打順に固定）
        fixed_positions = constraints.get('fixed_positions', {}) if constraints else {}
        
        # 各選手の各打順での価値計算
        player_values = {}
        for _, player in batters.iterrows():
            player_name = player['full_name']
            player_values[player_name] = {}
            
            for order in range(1, 10):
                value = self.calculate_player_value(player, order)
                player_values[player_name][order] = value
        
        # 最適打順探索（グリーディ法 + 局所最適化）
        best_lineup = self.find_optimal_lineup(player_values, batters, fixed_positions)
        
        # 予想得点計算
        projected_runs = self.calculate_projected_runs(best_lineup, batters)
        
        # 勝率計算（簡略版）
        win_probability = min(0.95, max(0.05, 0.5 + (projected_runs - 4.5) * 0.1))
        
        # 戦略分析
        strengths, weaknesses = self.analyze_lineup_balance(best_lineup, batters)
        
        return LineupOptimization(
            lineup_id=f"optimal_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            batting_order=best_lineup,
            projected_runs=round(projected_runs, 2),
            win_probability=round(win_probability, 3),
            strengths=strengths,
            weaknesses=weaknesses,
            situational_factors={}
        )
    
    def find_optimal_lineup(self, player_values: Dict[str, Dict[int, float]], 
                          batters: pd.DataFrame, fixed_positions: Dict[int, str]) -> List[str]:
        """最適打順探索"""
        available_players = list(player_values.keys())
        lineup = [None] * 9
        
        # 固定ポジション設定
        for pos, player in fixed_positions.items():
            if player in available_players and 1 <= pos <= 9:
                lineup[pos-1] = player
                available_players.remove(player)
        
        # 残りポジションをグリーディに決定
        for order in range(1, 10):
            if lineup[order-1] is not None:
                continue
                
            best_player = None
            best_value = -1
            
            for player in available_players:
                value = player_values[player][order]
                if value > best_value:
                    best_value = value
                    best_player = player
            
            if best_player:
                lineup[order-1] = best_player
                available_players.remove(best_player)
        
        return lineup
    
    def calculate_projected_runs(self, lineup: List[str], batters: pd.DataFrame) -> float:
        """予想得点計算"""
        total_runs = 0.0
        
        # 各打者の貢献度計算
        for i, player_name in enumerate(lineup):
            player_data = batters[batters['full_name'] == player_name]
            if not player_data.empty:
                player = player_data.iloc[0]
                
                # 打順別期待貢献度
                order_multiplier = [1.1, 1.0, 1.2, 1.3, 1.1, 0.9, 0.8, 0.7, 0.6][i]
                
                # 基本貢献度
                ops = player.get('ops', 0.700)
                runs_contrib = (ops - 0.600) * 5 * order_multiplier
                
                total_runs += max(0, runs_contrib)
        
        # チーム全体の補正
        base_runs = 4.5  # リーグ平均
        return base_runs + total_runs
    
    def analyze_lineup_balance(self, lineup: List[str], 
                             batters: pd.DataFrame) -> Tuple[List[str], List[str]]:
        """打順バランス分析"""
        strengths = []
        weaknesses = []
        
        lineup_stats = []
        for player_name in lineup:
            player_data = batters[batters['full_name'] == player_name]
            if not player_data.empty:
                lineup_stats.append(player_data.iloc[0])
        
        if not lineup_stats:
            return strengths, weaknesses
        
        # 上位打線分析（1-5番）
        top_batters = lineup_stats[:5]
        top_ops = np.mean([p.get('ops', 0.700) for p in top_batters])
        
        if top_ops > 0.800:
            strengths.append("強力な上位打線")
        elif top_ops < 0.650:
            weaknesses.append("上位打線の非力")
        
        # 長打力分析
        total_hr = sum([p.get('home_runs', 0) for p in lineup_stats])
        if total_hr > 150:
            strengths.append("豊富な長打力")
        elif total_hr < 80:
            weaknesses.append("長打力不足")
        
        # 出塁率分析
        avg_obp = np.mean([p.get('on_base_pct', 0.300) for p in lineup_stats])
        if avg_obp > 0.340:
            strengths.append("高い出塁能力")
        elif avg_obp < 0.290:
            weaknesses.append("出塁率の低さ")
        
        # スピード分析
        total_sb = sum([p.get('stolen_bases', 0) for p in lineup_stats])
        if total_sb > 80:
            strengths.append("機動力野球")
        elif total_sb < 20:
            weaknesses.append("スピード不足")
        
        return strengths, weaknesses
    
    def create_pitching_strategy(self, roster: pd.DataFrame, 
                               opponent_strengths: Dict[str, Any]) -> PitchingStrategy:
        """投手起用戦略作成"""
        pitchers = roster[roster['primary_position'] == 'P'].copy()
        
        if pitchers.empty:
            return None
        
        # 先発投手選定
        starters = pitchers[pitchers['innings_pitched'] > 100]  # 先発候補
        
        if not starters.empty:
            best_starter = starters.loc[starters['era'].idxmin()]
            starter_name = best_starter['full_name']
            projected_innings = min(7.0, best_starter.get('innings_pitched', 150) / 30)
        else:
            starter_name = "先発候補なし"
            projected_innings = 5.0
        
        # ブルペン戦略
        relievers = pitchers[pitchers['innings_pitched'] <= 100]
        bullpen_usage = {}
        
        for _, pitcher in relievers.iterrows():
            era = pitcher.get('era', 4.00)
            whip = pitcher.get('whip', 1.30)
            
            # 役割判定
            if era < 2.50 and whip < 1.10:
                role = 'closer'
                usage = 0.9
            elif era < 3.50 and whip < 1.25:
                role = 'setup'
                usage = 0.8
            elif era < 4.00:
                role = 'middle'
                usage = 0.7
            else:
                role = 'long'
                usage = 0.6
            
            bullpen_usage[pitcher['full_name']] = {
                'role': role,
                'usage_rate': usage,
                'era': era
            }
        
        # マッチアップ分析
        matchup_advantages = []
        risk_factors = []
        
        if opponent_strengths.get('power_heavy', False):
            matchup_advantages.append("相手長打重視 → 制球派投手有利")
        if opponent_strengths.get('contact_heavy', False):
            matchup_advantages.append("相手接触重視 → 三振奪取型有利")
        
        return PitchingStrategy(
            starter_name=starter_name,
            projected_innings=round(projected_innings, 1),
            bullpen_usage=bullpen_usage,
            matchup_advantages=matchup_advantages,
            risk_factors=risk_factors,
            optimal_situations={}
        )
    
    def calculate_leverage_index(self, situation: GameSituation) -> float:
        """レバレッジインデックス計算"""
        inning = min(situation.inning, 9)
        outs = min(situation.outs, 2)
        
        # 走者状況判定
        runners_key = self.get_runners_key(situation.runners_on)
        
        # ベースレバレッジ
        base_leverage = self.leverage_matrix.get((inning-1, outs), {}).get(runners_key, 1.0)
        
        # イニング調整
        if inning >= 7:
            inning_multiplier = 1.0 + (inning - 6) * 0.2
        else:
            inning_multiplier = 0.8 + inning * 0.05
        
        # 点差調整
        score_diff = abs(situation.score_diff)
        if score_diff == 0:
            score_multiplier = 1.2
        elif score_diff == 1:
            score_multiplier = 1.1
        elif score_diff == 2:
            score_multiplier = 1.0
        else:
            score_multiplier = max(0.5, 1.0 - (score_diff - 2) * 0.1)
        
        return base_leverage * inning_multiplier * score_multiplier
    
    def get_runners_key(self, runners_on: List[str]) -> str:
        """走者状況キー生成"""
        if not runners_on:
            return 'bases_empty'
        
        runners_set = set(runners_on)
        
        if runners_set == {'1B', '2B', '3B'}:
            return 'loaded'
        elif runners_set == {'2B', '3B'}:
            return '2B_3B'
        elif runners_set == {'1B', '3B'}:
            return '1B_3B'
        elif runners_set == {'1B', '2B'}:
            return '1B_2B'
        elif '3B' in runners_set:
            return '3B'
        elif '2B' in runners_set:
            return '2B'
        elif '1B' in runners_set:
            return '1B'
        else:
            return 'bases_empty'
    
    def analyze_game_situation(self, situation: GameSituation) -> Dict[str, Any]:
        """試合状況分析"""
        leverage = self.calculate_leverage_index(situation)
        
        analysis = {
            'leverage_index': round(leverage, 2),
            'pressure_level': 'high' if leverage > 1.5 else 'medium' if leverage > 1.0 else 'low',
            'recommended_actions': [],
            'strategic_options': {}
        }
        
        # 状況別推奨行動
        if situation.outs < 2 and '3B' in situation.runners_on:
            if situation.score_diff <= 1:
                analysis['recommended_actions'].append("犠牲フライ狙い")
            else:
                analysis['recommended_actions'].append("確実性重視")
        
        if situation.outs == 0 and '1B' in situation.runners_on and situation.inning >= 7:
            analysis['recommended_actions'].append("盗塁・エンドラン検討")
        
        if situation.inning >= 8 and abs(situation.score_diff) <= 1:
            analysis['recommended_actions'].append("代打・代走積極起用")
        
        return analysis
    
    def create_strategy_report(self, team_name: str, lineup_opt: LineupOptimization,
                             pitching_strategy: PitchingStrategy) -> str:
        """戦略レポート作成"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"game_strategy_{team_name}_{timestamp}.json"
        
        report_data = {
            'team': team_name,
            'analysis_date': datetime.now().isoformat(),
            'batting_strategy': {
                'optimal_lineup': lineup_opt.batting_order if lineup_opt else [],
                'projected_runs': lineup_opt.projected_runs if lineup_opt else 0,
                'win_probability': lineup_opt.win_probability if lineup_opt else 0,
                'strengths': lineup_opt.strengths if lineup_opt else [],
                'weaknesses': lineup_opt.weaknesses if lineup_opt else []
            },
            'pitching_strategy': {
                'starter': pitching_strategy.starter_name if pitching_strategy else "",
                'projected_innings': pitching_strategy.projected_innings if pitching_strategy else 0,
                'bullpen_plan': pitching_strategy.bullpen_usage if pitching_strategy else {},
                'matchup_advantages': pitching_strategy.matchup_advantages if pitching_strategy else []
            },
            'strategic_recommendations': []
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"戦略レポート保存: {filename}")
        return filename
    
    def visualize_strategy_analysis(self, lineup_opt: LineupOptimization, 
                                  roster: pd.DataFrame) -> str:
        """戦略分析可視化"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle('Game Strategy Analysis\n試合戦略分析', fontsize=16, fontweight='bold')
        
        if not lineup_opt:
            plt.close()
            return ""
        
        # 1. 最適打順可視化
        batting_order = lineup_opt.batting_order
        batters = roster[roster['primary_position'] != 'P']
        
        lineup_ops = []
        for player_name in batting_order:
            player_data = batters[batters['full_name'] == player_name]
            if not player_data.empty:
                ops = player_data.iloc[0].get('ops', 0.700)
                lineup_ops.append(ops)
            else:
                lineup_ops.append(0.700)
        
        axes[0,0].bar(range(1, 10), lineup_ops, color='lightblue')
        axes[0,0].set_title('最適打順のOPS分布')
        axes[0,0].set_xlabel('打順')
        axes[0,0].set_ylabel('OPS')
        axes[0,0].set_xticks(range(1, 10))
        
        # 各バーに選手名表示
        for i, (ops, name) in enumerate(zip(lineup_ops, batting_order)):
            if name:
                axes[0,0].text(i+1, ops + 0.02, name[:6], ha='center', fontsize=8, rotation=45)
        
        # 2. チーム戦力レーダーチャート
        team_stats = {
            '打率': batters['batting_avg'].mean(),
            '長打率': batters['slugging_pct'].mean(),
            '出塁率': batters['on_base_pct'].mean(),
            'OPS': batters['ops'].mean()
        }
        
        # リーグ平均との比較
        league_averages = {'打率': 0.250, '長打率': 0.400, '出塁率': 0.320, 'OPS': 0.720}
        
        categories = list(team_stats.keys())
        team_values = [team_stats[cat] / league_averages[cat] * 100 for cat in categories]
        league_values = [100] * len(categories)
        
        angles = np.linspace(0, 2*np.pi, len(categories), endpoint=False)
        team_values += team_values[:1]
        league_values += league_values[:1]
        angles = np.concatenate((angles, [angles[0]]))
        
        ax_radar = plt.subplot(2, 2, 2, projection='polar')
        ax_radar.plot(angles, team_values, 'o-', linewidth=2, label='チーム', color='red')
        ax_radar.fill(angles, team_values, alpha=0.1, color='red')
        ax_radar.plot(angles, league_values, '--', alpha=0.7, label='リーグ平均', color='gray')
        ax_radar.set_xticks(angles[:-1])
        ax_radar.set_xticklabels(categories)
        ax_radar.set_ylim(0, 150)
        ax_radar.set_title('チーム打撃能力')
        ax_radar.legend()
        
        # 3. ポジション別戦力分布
        position_ops = batters.groupby('primary_position')['ops'].mean().sort_values(ascending=True)
        axes[1,0].barh(position_ops.index, position_ops.values, color='lightgreen')
        axes[1,0].set_title('ポジション別平均OPS')
        axes[1,0].set_xlabel('OPS')
        
        # 4. 予想得点 vs 実績比較
        historical_runs = [4.2, 4.5, 4.8, 4.1, 4.6]  # 模擬過去5試合
        projected_run = lineup_opt.projected_runs
        
        x = ['過去1', '過去2', '過去3', '過去4', '過去5', '予想']
        y = historical_runs + [projected_run]
        colors = ['lightcoral'] * 5 + ['gold']
        
        axes[1,1].bar(x, y, color=colors)
        axes[1,1].set_title('得点予測')
        axes[1,1].set_ylabel('得点')
        axes[1,1].axhline(y=np.mean(historical_runs), color='red', linestyle='--', 
                         label=f'過去平均: {np.mean(historical_runs):.1f}')
        axes[1,1].legend()
        
        plt.tight_layout()
        
        filename = f'strategy_analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"戦略分析可視化保存: {filename}")
        return filename

def main():
    """メイン実行"""
    analyzer = GameStrategyAnalyzer()
    
    print("="*80)
    print("GAME STRATEGY ANALYZER SYSTEM")
    print("試合戦略分析システム")
    print("="*80)
    
    print("\n1: 打順最適化")
    print("2: 投手起用戦略")
    print("3: 試合状況別戦略分析")
    print("4: 総合戦略レポート")
    
    choice = input("選択してください (1-4): ").strip()
    
    if choice == '1':
        league = input("リーグ (npb/kbo): ").strip().lower()
        team = input("チーム名: ").strip()
        
        roster = analyzer.load_team_roster(team, league)
        
        if not roster.empty:
            # 制約条件（例：4番打者固定）
            constraints = {}
            fixed_player = input("固定したい選手がいれば選手名を入力（なければEnter）: ").strip()
            if fixed_player:
                fixed_order = input("何番に固定しますか (1-9): ").strip()
                try:
                    constraints['fixed_positions'] = {int(fixed_order): fixed_player}
                except:
                    pass
            
            lineup_opt = analyzer.optimize_batting_order(roster, constraints)
            
            if lineup_opt:
                print(f"\n=== {team} 最適打順 ===")
                for i, player in enumerate(lineup_opt.batting_order, 1):
                    print(f"{i}番: {player}")
                
                print(f"\n予想得点: {lineup_opt.projected_runs}点")
                print(f"勝率: {lineup_opt.win_probability:.1%}")
                
                print(f"\n強み:")
                for strength in lineup_opt.strengths:
                    print(f"  ✓ {strength}")
                
                print(f"\n弱点:")
                for weakness in lineup_opt.weaknesses:
                    print(f"  ⚠ {weakness}")
                
                # 可視化
                viz_file = analyzer.visualize_strategy_analysis(lineup_opt, roster)
                print(f"\n可視化ファイル: {viz_file}")
        else:
            print("チームデータが見つかりません")
    
    elif choice == '2':
        league = input("リーグ (npb/kbo): ").strip().lower()
        team = input("チーム名: ").strip()
        
        roster = analyzer.load_team_roster(team, league)
        
        opponent_strengths = {
            'power_heavy': True,  # 相手が長打重視
            'contact_heavy': False  # 相手が接触重視
        }
        
        pitching_strategy = analyzer.create_pitching_strategy(roster, opponent_strengths)
        
        if pitching_strategy:
            print(f"\n=== {team} 投手戦略 ===")
            print(f"先発: {pitching_strategy.starter_name}")
            print(f"予想投球回: {pitching_strategy.projected_innings}回")
            
            print(f"\nブルペン構成:")
            for pitcher, info in pitching_strategy.bullpen_usage.items():
                print(f"  {pitcher}: {info['role']} (ERA: {info['era']:.2f})")
            
            print(f"\nマッチアップ分析:")
            for advantage in pitching_strategy.matchup_advantages:
                print(f"  ✓ {advantage}")
    
    elif choice == '3':
        # サンプル試合状況
        situation = GameSituation(
            inning=8,
            outs=1,
            runners_on=['1B', '3B'],
            score_diff=1,  # 1点リード
            leverage_index=0.0  # 計算される
        )
        
        analysis = analyzer.analyze_game_situation(situation)
        
        print(f"\n=== 試合状況分析 ===")
        print(f"状況: {situation.inning}回{situation.outs}アウト, 走者{situation.runners_on}")
        print(f"点差: {situation.score_diff}点リード")
        print(f"レバレッジ指数: {analysis['leverage_index']}")
        print(f"プレッシャーレベル: {analysis['pressure_level']}")
        
        print(f"\n推奨行動:")
        for action in analysis['recommended_actions']:
            print(f"  → {action}")

if __name__ == "__main__":
    main()