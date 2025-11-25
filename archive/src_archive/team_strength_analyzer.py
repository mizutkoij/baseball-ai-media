#!/usr/bin/env python3
"""
Team Strength Analyzer System
チーム戦力分析システム
チーム構成・戦力バランス・補強ポイントを分析
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 日本語フォント設定
plt.rcParams['font.family'] = ['Yu Gothic', 'Meiryo', 'DejaVu Sans']

@dataclass
class TeamStrengthProfile:
    team_name: str
    league: str
    overall_strength: float
    batting_strength: float
    pitching_strength: float
    defense_strength: float
    depth_score: float
    age_profile: Dict[str, float]
    weaknesses: List[str]
    strengths: List[str]
    recommended_targets: List[Dict[str, Any]]

@dataclass 
class PlayerContribution:
    player_id: int
    player_name: str
    position: str
    war_contribution: float
    salary_efficiency: float
    age: int
    contract_status: str

class TeamStrengthAnalyzer:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        
        # 各ポジションの重要度重み
        self.position_weights = {
            'C': 1.1,   # キャッチャーは重要
            '1B': 0.9,  # 一塁は守備負担少
            '2B': 1.0,
            '3B': 1.0, 
            'SS': 1.1,  # ショートは重要
            'LF': 0.9,
            'CF': 1.1,  # センターは重要
            'RF': 0.9,
            'DH': 0.8,  # 守備なし
            'P': 1.2    # 投手は最重要
        }
    
    def connect_db(self):
        return sqlite3.connect(self.db_path)
    
    def load_team_data(self, league: str = 'both') -> pd.DataFrame:
        """チームデータ読み込み"""
        conn = self.connect_db()
        
        where_clause = ""
        if league != 'both':
            where_clause = f"WHERE p.league = '{league}'"
        elif league == 'both':
            where_clause = "WHERE p.league IN ('npb', 'kbo')"
        
        query = f"""
        SELECT 
            p.player_id, p.full_name, p.current_team, p.league,
            p.primary_position, p.age, p.nationality,
            p.height_cm, p.weight_kg,
            y.season, y.games_played, y.batting_avg, y.home_runs, y.rbis,
            y.on_base_pct, y.slugging_pct, y.ops,
            y.innings_pitched, y.era, y.whip, y.wins, y.strikeouts_pitched,
            -- 高度統計があれば使用
            COALESCE(a.batting_war, 0) as batting_war,
            COALESCE(a.pitching_war, 0) as pitching_war,
            COALESCE(a.woba, 0) as woba,
            COALESCE(a.fip, 0) as fip
        FROM detailed_players_master p
        LEFT JOIN yearly_performance y ON p.player_id = y.player_id
        LEFT JOIN kbo_advanced_stats a ON p.player_id = a.player_id 
            AND y.season = a.season
        {where_clause}
        AND y.season >= 2023
        ORDER BY p.current_team, p.primary_position, y.season DESC
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        logger.info(f"チームデータ読み込み: {len(df)}レコード")
        return df
    
    def calculate_player_war(self, player_data: pd.Series) -> float:
        """選手WARを計算（簡略版）"""
        try:
            # 既に計算済みのWARがあれば使用
            if player_data.get('batting_war', 0) > 0:
                return float(player_data['batting_war'])
            if player_data.get('pitching_war', 0) > 0:
                return float(player_data['pitching_war'])
            
            # 簡易WAR計算
            if player_data.get('at_bats', 0) > 0:  # 野手
                ops = player_data.get('ops', 0.700)
                games = player_data.get('games_played', 100)
                # OPS基準の簡易WAR
                war = (ops - 0.700) * games / 100 * 5
                return max(0, war)
            
            elif player_data.get('innings_pitched', 0) > 0:  # 投手
                era = player_data.get('era', 4.00)
                ip = player_data.get('innings_pitched', 100)
                # ERA基準の簡易WAR
                war = (4.00 - era) * ip / 150 * 3
                return max(0, war)
            
            return 0.0
            
        except:
            return 0.0
    
    def analyze_team_composition(self, team_name: str, league: str) -> Dict[str, Any]:
        """チーム構成分析"""
        df = self.load_team_data(league)
        team_data = df[df['current_team'] == team_name].copy()
        
        if team_data.empty:
            logger.warning(f"チーム '{team_name}' のデータが見つかりません")
            return {}
        
        # 最新シーズンのデータを使用
        team_data = team_data.groupby('player_id').first().reset_index()
        
        composition = {
            'total_players': len(team_data),
            'position_breakdown': team_data['primary_position'].value_counts().to_dict(),
            'age_distribution': {
                'average_age': team_data['age'].mean(),
                'youngest': team_data['age'].min(),
                'oldest': team_data['age'].max(),
                'age_groups': {
                    'young_23': len(team_data[team_data['age'] <= 23]),
                    'prime_24_30': len(team_data[(team_data['age'] >= 24) & (team_data['age'] <= 30)]),
                    'veteran_31': len(team_data[team_data['age'] >= 31])
                }
            },
            'nationality_breakdown': team_data['nationality'].value_counts().to_dict(),
            'foreign_player_ratio': len(team_data[team_data['nationality'] != 'JPN']) / len(team_data)
        }
        
        return composition
    
    def calculate_team_strength(self, team_name: str, league: str) -> TeamStrengthProfile:
        """チーム戦力総合分析"""
        logger.info(f"{team_name} ({league.upper()}) の戦力分析開始...")
        
        df = self.load_team_data(league)
        team_data = df[df['current_team'] == team_name].copy()
        
        if team_data.empty:
            logger.warning(f"チーム '{team_name}' のデータが見つかりません")
            return None
        
        # 最新データで重複除去
        team_data = team_data.groupby('player_id').last().reset_index()
        
        # WAR計算
        team_data['calculated_war'] = team_data.apply(self.calculate_player_war, axis=1)
        
        # ポジション別戦力
        position_strength = {}
        for pos in team_data['primary_position'].unique():
            pos_players = team_data[team_data['primary_position'] == pos]
            pos_war = pos_players['calculated_war'].sum()
            pos_depth = len(pos_players)
            weight = self.position_weights.get(pos, 1.0)
            position_strength[pos] = {
                'war': pos_war,
                'depth': pos_depth,
                'weighted_strength': pos_war * weight,
                'players': len(pos_players)
            }
        
        # 打撃戦力
        batters = team_data[team_data['primary_position'] != 'P']
        batting_war = batters['calculated_war'].sum()
        batting_ops = batters['ops'].mean() if not batters.empty else 0.700
        
        # 投手戦力
        pitchers = team_data[team_data['primary_position'] == 'P']
        pitching_war = pitchers['calculated_war'].sum()
        pitching_era = pitchers['era'].mean() if not pitchers.empty else 4.00
        
        # 総合戦力計算
        total_war = team_data['calculated_war'].sum()
        
        # 戦力バランス評価
        balance_score = self.calculate_balance_score(position_strength)
        
        # 年齢プロファイル
        age_profile = {
            'average_age': team_data['age'].mean(),
            'age_diversity': team_data['age'].std(),
            'young_core': len(team_data[(team_data['age'] <= 25) & (team_data['calculated_war'] >= 2.0)]),
            'veteran_leaders': len(team_data[(team_data['age'] >= 32) & (team_data['calculated_war'] >= 1.5)])
        }
        
        # 弱点・強み分析
        weaknesses = self.identify_weaknesses(position_strength, team_data)
        strengths = self.identify_strengths(position_strength, team_data)
        
        # 補強推奨ポイント
        recommended_targets = self.recommend_targets(weaknesses, league)
        
        # 総合評価スコア（100点満点）
        overall_strength = min(100, (total_war * 10 + balance_score * 20 + 30))
        batting_strength = min(100, (batting_ops - 0.600) * 250)
        pitching_strength = min(100, (5.00 - pitching_era) * 50)
        defense_strength = balance_score  # バランス＝守備力
        depth_score = min(100, len(team_data) * 2)
        
        return TeamStrengthProfile(
            team_name=team_name,
            league=league.upper(),
            overall_strength=round(overall_strength, 1),
            batting_strength=round(batting_strength, 1),
            pitching_strength=round(pitching_strength, 1),
            defense_strength=round(defense_strength, 1),
            depth_score=round(depth_score, 1),
            age_profile=age_profile,
            weaknesses=weaknesses,
            strengths=strengths,
            recommended_targets=recommended_targets
        )
    
    def calculate_balance_score(self, position_strength: Dict) -> float:
        """戦力バランススコア計算"""
        if not position_strength:
            return 0
        
        # 各ポジションの戦力標準化
        strengths = [pos_data['weighted_strength'] for pos_data in position_strength.values()]
        
        if not strengths:
            return 0
        
        # バランス = 100 - (標準偏差 * 調整係数)
        balance = max(0, 100 - (np.std(strengths) * 10))
        return balance
    
    def identify_weaknesses(self, position_strength: Dict, team_data: pd.DataFrame) -> List[str]:
        """弱点識別"""
        weaknesses = []
        
        for pos, strength in position_strength.items():
            if strength['war'] < 1.0:  # WAR 1.0未満は弱点
                weaknesses.append(f"{pos}の戦力不足 (WAR: {strength['war']:.1f})")
            
            if strength['depth'] == 1:  # 控えなし
                weaknesses.append(f"{pos}の層の薄さ (選手数: {strength['depth']})")
        
        # 年齢構成の問題
        avg_age = team_data['age'].mean()
        if avg_age > 31:
            weaknesses.append(f"高齢化 (平均年齢: {avg_age:.1f}歳)")
        elif avg_age < 24:
            weaknesses.append(f"経験不足 (平均年齢: {avg_age:.1f}歳)")
        
        # 外国人枠の問題
        foreign_count = len(team_data[team_data['nationality'] != 'JPN'])
        if foreign_count < 2:
            weaknesses.append(f"外国人選手活用不足 ({foreign_count}人)")
        
        return weaknesses[:5]  # 上位5つの弱点
    
    def identify_strengths(self, position_strength: Dict, team_data: pd.DataFrame) -> List[str]:
        """強み識別"""
        strengths = []
        
        for pos, strength in position_strength.items():
            if strength['war'] >= 3.0:  # WAR 3.0以上は強み
                strengths.append(f"{pos}の充実 (WAR: {strength['war']:.1f})")
            
            if strength['depth'] >= 3:  # 3人以上は層が厚い
                strengths.append(f"{pos}の層の厚さ (選手数: {strength['depth']})")
        
        # バランスの良い年齢構成
        young = len(team_data[team_data['age'] <= 25])
        prime = len(team_data[(team_data['age'] >= 26) & (team_data['age'] <= 30)])
        veteran = len(team_data[team_data['age'] >= 31])
        
        if young >= 3 and prime >= 5 and veteran >= 2:
            strengths.append("バランスの良い年齢構成")
        
        # 高WAR選手の存在
        star_players = team_data[team_data['calculated_war'] >= 4.0]
        if not star_players.empty:
            strengths.append(f"スター選手の存在 ({len(star_players)}名)")
        
        return strengths[:5]
    
    def recommend_targets(self, weaknesses: List[str], league: str) -> List[Dict[str, Any]]:
        """補強推奨分析"""
        recommendations = []
        
        for weakness in weaknesses:
            if "戦力不足" in weakness:
                pos = weakness.split("の戦力不足")[0]
                recommendations.append({
                    'type': 'player_acquisition',
                    'position': pos,
                    'priority': 'high',
                    'description': f"{pos}の戦力向上が急務"
                })
            
            elif "層の薄さ" in weakness:
                pos = weakness.split("の層の薄さ")[0]
                recommendations.append({
                    'type': 'depth_improvement',
                    'position': pos,
                    'priority': 'medium',
                    'description': f"{pos}の控え選手獲得を検討"
                })
            
            elif "高齢化" in weakness:
                recommendations.append({
                    'type': 'youth_injection',
                    'position': 'all',
                    'priority': 'medium',
                    'description': "若手選手の積極的起用・獲得"
                })
        
        return recommendations[:3]
    
    def compare_teams(self, league: str = 'npb') -> pd.DataFrame:
        """リーグ内チーム比較"""
        df = self.load_team_data(league)
        teams = df['current_team'].unique()
        
        comparison_data = []
        
        for team in teams:
            if pd.isna(team):
                continue
                
            try:
                profile = self.calculate_team_strength(team, league)
                if profile:
                    comparison_data.append({
                        'team': team,
                        'overall': profile.overall_strength,
                        'batting': profile.batting_strength,
                        'pitching': profile.pitching_strength,
                        'defense': profile.defense_strength,
                        'depth': profile.depth_score,
                        'avg_age': profile.age_profile['average_age']
                    })
            except Exception as e:
                logger.error(f"チーム比較エラー ({team}): {e}")
        
        return pd.DataFrame(comparison_data).sort_values('overall', ascending=False)
    
    def create_team_report(self, team_name: str, league: str) -> str:
        """チーム分析レポート作成"""
        profile = self.calculate_team_strength(team_name, league)
        
        if not profile:
            return ""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"team_analysis_{team_name}_{timestamp}.json"
        
        report_data = {
            'team': profile.team_name,
            'league': profile.league,
            'analysis_date': datetime.now().isoformat(),
            'strength_scores': {
                'overall': profile.overall_strength,
                'batting': profile.batting_strength,
                'pitching': profile.pitching_strength,
                'defense': profile.defense_strength,
                'depth': profile.depth_score
            },
            'age_profile': profile.age_profile,
            'strengths': profile.strengths,
            'weaknesses': profile.weaknesses,
            'recommendations': profile.recommended_targets
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)
        
        logger.info(f"チーム分析レポート保存: {filename}")
        return filename
    
    def visualize_team_comparison(self, league: str = 'npb') -> str:
        """チーム比較可視化"""
        comparison_df = self.compare_teams(league)
        
        if comparison_df.empty:
            return ""
        
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        fig.suptitle(f'{league.upper()} Team Strength Analysis\n{league.upper()}チーム戦力分析', 
                     fontsize=16, fontweight='bold')
        
        # 総合戦力ランキング
        axes[0,0].barh(comparison_df['team'], comparison_df['overall'], color='skyblue')
        axes[0,0].set_title('総合戦力ランキング')
        axes[0,0].set_xlabel('戦力スコア')
        
        # 打撃 vs 投手 散布図
        axes[0,1].scatter(comparison_df['batting'], comparison_df['pitching'], 
                         c=comparison_df['overall'], cmap='viridis', s=100)
        axes[0,1].set_xlabel('打撃戦力')
        axes[0,1].set_ylabel('投手戦力')
        axes[0,1].set_title('打撃 vs 投手戦力')
        
        # チーム名をラベル
        for _, row in comparison_df.iterrows():
            axes[0,1].annotate(row['team'][:6], (row['batting'], row['pitching']), 
                             xytext=(5, 5), textcoords='offset points', fontsize=8)
        
        # 年齢分布
        axes[1,0].scatter(comparison_df['avg_age'], comparison_df['overall'], 
                         c=comparison_df['depth'], cmap='plasma', s=100)
        axes[1,0].set_xlabel('平均年齢')
        axes[1,0].set_ylabel('総合戦力')
        axes[1,0].set_title('年齢 vs 戦力関係')
        
        # 戦力バランス
        categories = ['overall', 'batting', 'pitching', 'defense', 'depth']
        top3_teams = comparison_df.head(3)
        
        x = np.arange(len(categories))
        width = 0.25
        
        for i, (_, team) in enumerate(top3_teams.iterrows()):
            values = [team[cat] for cat in categories]
            axes[1,1].bar(x + i*width, values, width, label=team['team'])
        
        axes[1,1].set_xlabel('戦力カテゴリ')
        axes[1,1].set_ylabel('スコア')
        axes[1,1].set_title('上位3チーム戦力比較')
        axes[1,1].set_xticks(x + width)
        axes[1,1].set_xticklabels(['総合', '打撃', '投手', '守備', '層'])
        axes[1,1].legend()
        
        plt.tight_layout()
        
        filename = f'team_comparison_{league}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"チーム比較可視化保存: {filename}")
        return filename

def main():
    """メイン実行"""
    analyzer = TeamStrengthAnalyzer()
    
    print("="*80)
    print("TEAM STRENGTH ANALYZER SYSTEM")
    print("チーム戦力分析システム")
    print("="*80)
    
    print("\n1: 特定チーム分析")
    print("2: NPBリーグ全チーム比較")
    print("3: KBOリーグ全チーム比較")
    print("4: 両リーグ比較")
    
    choice = input("選択してください (1-4): ").strip()
    
    if choice == '1':
        league = input("リーグ (npb/kbo): ").strip().lower()
        team = input("チーム名: ").strip()
        
        profile = analyzer.calculate_team_strength(team, league)
        if profile:
            print(f"\n=== {profile.team_name} ({profile.league}) 戦力分析 ===")
            print(f"総合戦力: {profile.overall_strength}/100")
            print(f"打撃戦力: {profile.batting_strength}/100")
            print(f"投手戦力: {profile.pitching_strength}/100")
            print(f"守備戦力: {profile.defense_strength}/100")
            print(f"選手層: {profile.depth_score}/100")
            
            print(f"\n強み:")
            for strength in profile.strengths:
                print(f"  ✓ {strength}")
            
            print(f"\n弱点:")
            for weakness in profile.weaknesses:
                print(f"  ⚠ {weakness}")
            
            print(f"\n推奨補強:")
            for rec in profile.recommended_targets:
                print(f"  → {rec['description']} (優先度: {rec['priority']})")
            
            report_file = analyzer.create_team_report(team, league)
            print(f"\n詳細レポート: {report_file}")
    
    elif choice in ['2', '3', '4']:
        leagues = {'2': 'npb', '3': 'kbo'}
        
        if choice == '4':
            for league in ['npb', 'kbo']:
                print(f"\n=== {league.upper()} リーグ分析 ===")
                comparison = analyzer.compare_teams(league)
                print(comparison.head(10))
                
                viz_file = analyzer.visualize_team_comparison(league)
                print(f"可視化ファイル: {viz_file}")
        else:
            league = leagues[choice]
            comparison = analyzer.compare_teams(league)
            print(f"\n=== {league.upper()} チーム戦力ランキング ===")
            print(comparison)
            
            viz_file = analyzer.visualize_team_comparison(league)
            print(f"\n可視化ファイル: {viz_file}")

if __name__ == "__main__":
    main()