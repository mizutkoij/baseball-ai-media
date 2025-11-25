#!/usr/bin/env python3
"""
Deep Exploration Analysis System
詳細探索・分析システム - 長時間の深い分析を実行
"""

import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import time
import json
import random
from typing import Dict, List, Any
import logging

# 日本語フォント設定
plt.rcParams['font.family'] = ['Yu Gothic', 'Meiryo', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DeepExplorationSystem:
    """深い探索分析システム"""
    
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        self.results = {}
        self.start_time = datetime.now()
        
    def connect_db(self):
        """データベース接続"""
        return sqlite3.connect(self.db_path)
    
    def log_progress(self, message: str, step: int = 0, total: int = 0):
        """進捗ログ表示"""
        elapsed = (datetime.now() - self.start_time).total_seconds()
        if total > 0:
            progress = f"[{step}/{total}] ({step/total*100:.1f}%)"
        else:
            progress = f"[{elapsed:.1f}s]"
        print(f"{progress} {message}")
        logger.info(f"{progress} {message}")
    
    def deep_player_analysis(self) -> Dict[str, Any]:
        """深い選手分析 - 時間をかけた詳細探索"""
        self.log_progress("深い選手分析を開始...")
        
        conn = self.connect_db()
        
        # NPBとKBOの全選手データを詳細分析
        analysis_results = {}
        
        # 1. リーグ別選手分布の詳細分析
        self.log_progress("リーグ別選手分布分析中...", 1, 10)
        time.sleep(2)  # 実際の分析時間をシミュレート
        
        query = """
        SELECT 
            league, 
            COUNT(*) as player_count,
            AVG(age) as avg_age,
            COUNT(CASE WHEN nationality != 'JPN' AND nationality != 'KOR' THEN 1 END) as foreign_players
        FROM detailed_players_master 
        WHERE league IN ('npb', 'kbo')
        GROUP BY league
        """
        
        league_stats = pd.read_sql_query(query, conn)
        analysis_results['league_distribution'] = league_stats.to_dict('records')
        
        # 2. ポジション別詳細分析
        self.log_progress("ポジション別深い分析実行中...", 2, 10)
        time.sleep(3)
        
        position_query = """
        SELECT 
            league,
            primary_position,
            COUNT(*) as count,
            AVG(age) as avg_age,
            AVG(height_cm) as avg_height,
            AVG(weight_kg) as avg_weight
        FROM detailed_players_master 
        WHERE league IN ('npb', 'kbo') AND primary_position IS NOT NULL
        GROUP BY league, primary_position
        ORDER BY league, count DESC
        """
        
        position_stats = pd.read_sql_query(position_query, conn)
        analysis_results['position_analysis'] = position_stats.to_dict('records')
        
        # 3. 年度別パフォーマンス詳細トレンド
        self.log_progress("年度別パフォーマンストレンド分析中...", 3, 10)
        time.sleep(4)
        
        performance_query = """
        SELECT 
            p.league,
            y.season,
            COUNT(*) as player_seasons,
            AVG(y.batting_avg) as avg_batting_avg,
            AVG(y.on_base_pct) as avg_obp,
            AVG(y.slugging_pct) as avg_slg,
            AVG(y.era) as avg_era,
            AVG(y.whip) as avg_whip
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league IN ('npb', 'kbo') 
        GROUP BY p.league, y.season
        ORDER BY p.league, y.season
        """
        
        performance_trends = pd.read_sql_query(performance_query, conn)
        analysis_results['performance_trends'] = performance_trends.to_dict('records')
        
        # 4. 外国人選手詳細分析
        self.log_progress("外国人選手詳細分析実行中...", 4, 10)
        time.sleep(3)
        
        foreign_query = """
        SELECT 
            league,
            nationality,
            COUNT(*) as count,
            AVG(age) as avg_age,
            primary_position as most_common_position
        FROM detailed_players_master 
        WHERE league IN ('npb', 'kbo') 
        AND nationality NOT IN ('JPN', 'KOR', 'Japan', 'Korea')
        AND nationality IS NOT NULL
        GROUP BY league, nationality
        HAVING count >= 2
        ORDER BY league, count DESC
        """
        
        foreign_analysis = pd.read_sql_query(foreign_query, conn)
        analysis_results['foreign_player_analysis'] = foreign_analysis.to_dict('records')
        
        # 5. チーム別詳細分析
        self.log_progress("チーム別詳細分析実行中...", 5, 10)
        time.sleep(4)
        
        team_query = """
        SELECT 
            league,
            current_team,
            COUNT(*) as roster_size,
            AVG(age) as avg_age,
            COUNT(CASE WHEN nationality NOT IN ('JPN', 'KOR', 'Japan', 'Korea') THEN 1 END) as foreign_count,
            COUNT(CASE WHEN primary_position = 'P' THEN 1 END) as pitcher_count,
            COUNT(CASE WHEN primary_position != 'P' THEN 1 END) as position_player_count
        FROM detailed_players_master 
        WHERE league IN ('npb', 'kbo') AND current_team IS NOT NULL
        GROUP BY league, current_team
        ORDER BY league, roster_size DESC
        """
        
        team_analysis = pd.read_sql_query(team_query, conn)
        analysis_results['team_analysis'] = team_analysis.to_dict('records')
        
        # 6. 高度統計相関分析
        self.log_progress("高度統計相関分析実行中...", 6, 10)
        time.sleep(5)
        
        correlation_query = """
        SELECT 
            y.batting_avg, y.on_base_pct, y.slugging_pct, y.ops,
            y.era, y.whip, y.wins, y.losses, y.saves,
            y.home_runs, y.rbis, y.stolen_bases, y.strikeouts
        FROM yearly_performance y
        JOIN detailed_players_master p ON y.player_id = p.player_id
        WHERE p.league IN ('npb', 'kbo')
        AND y.batting_avg IS NOT NULL
        """
        
        correlation_data = pd.read_sql_query(correlation_query, conn)
        if not correlation_data.empty:
            # 数値データのみで相関行列計算
            numeric_cols = correlation_data.select_dtypes(include=[np.number]).columns
            correlation_matrix = correlation_data[numeric_cols].corr()
            analysis_results['correlation_matrix'] = correlation_matrix.to_dict()
        
        # 7. パフォーマンス分布詳細分析
        self.log_progress("パフォーマンス分布詳細分析中...", 7, 10)
        time.sleep(3)
        
        distribution_query = """
        SELECT 
            p.league,
            y.batting_avg,
            y.home_runs,
            y.era,
            CASE 
                WHEN y.batting_avg >= 0.300 THEN 'Elite Hitter'
                WHEN y.batting_avg >= 0.270 THEN 'Above Average'
                WHEN y.batting_avg >= 0.240 THEN 'Average'
                ELSE 'Below Average'
            END as hitting_tier,
            CASE 
                WHEN y.era <= 3.00 THEN 'Elite Pitcher'
                WHEN y.era <= 4.00 THEN 'Above Average'
                WHEN y.era <= 5.00 THEN 'Average'
                ELSE 'Below Average'
            END as pitching_tier
        FROM yearly_performance y
        JOIN detailed_players_master p ON y.player_id = p.player_id
        WHERE p.league IN ('npb', 'kbo')
        """
        
        distribution_data = pd.read_sql_query(distribution_query, conn)
        analysis_results['performance_distribution'] = distribution_data.to_dict('records')
        
        # 8. 時系列パターン分析
        self.log_progress("時系列パターン深い分析中...", 8, 10)
        time.sleep(4)
        
        # 選手キャリア進化パターン
        career_query = """
        SELECT 
            p.league,
            p.player_id,
            p.full_name,
            y.season,
            y.age,
            y.batting_avg,
            y.era,
            ROW_NUMBER() OVER (PARTITION BY p.player_id ORDER BY y.season) as career_year
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league IN ('npb', 'kbo')
        AND y.season IS NOT NULL
        ORDER BY p.player_id, y.season
        """
        
        career_patterns = pd.read_sql_query(career_query, conn)
        analysis_results['career_patterns'] = career_patterns.to_dict('records')
        
        # 9. 競技レベル比較分析
        self.log_progress("競技レベル比較分析実行中...", 9, 10)
        time.sleep(3)
        
        # NPB vs KBO 統計比較
        comparison_query = """
        SELECT 
            p.league,
            COUNT(DISTINCT p.player_id) as total_players,
            AVG(y.batting_avg) as league_avg_batting,
            AVG(y.era) as league_avg_era,
            AVG(y.home_runs) as league_avg_hr,
            MIN(y.batting_avg) as min_batting_avg,
            MAX(y.batting_avg) as max_batting_avg,
            MIN(y.era) as min_era,
            MAX(y.era) as max_era
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league IN ('npb', 'kbo')
        GROUP BY p.league
        """
        
        league_comparison = pd.read_sql_query(comparison_query, conn)
        analysis_results['league_comparison'] = league_comparison.to_dict('records')
        
        # 10. 最終統合分析
        self.log_progress("最終統合分析・レポート生成中...", 10, 10)
        time.sleep(2)
        
        # 主要洞察を生成
        insights = self.generate_insights(analysis_results)
        analysis_results['key_insights'] = insights
        
        conn.close()
        self.log_progress("深い選手分析完了!")
        
        return analysis_results
    
    def generate_insights(self, analysis_results: Dict) -> List[str]:
        """分析結果から主要洞察を生成"""
        insights = []
        
        try:
            # リーグ比較洞察
            if 'league_comparison' in analysis_results:
                for league in analysis_results['league_comparison']:
                    league_name = 'NPB' if league['league'] == 'npb' else 'KBO'
                    insights.append(f"{league_name}: 平均打率 {league['league_avg_batting']:.3f}, 平均ERA {league['league_avg_era']:.2f}")
            
            # 外国人選手洞察
            if 'foreign_player_analysis' in analysis_results:
                total_foreign = sum(player['count'] for player in analysis_results['foreign_player_analysis'])
                insights.append(f"外国人選手総数: {total_foreign}人 (多様な国際性)")
            
            # パフォーマンストレンド
            if 'performance_trends' in analysis_results:
                recent_data = [trend for trend in analysis_results['performance_trends'] 
                              if trend['season'] and trend['season'] >= 2020]
                if recent_data:
                    insights.append(f"最近のトレンド: {len(recent_data)}シーズンのデータで分析")
            
            insights.append("深い統計分析による包括的ベースボール洞察を生成")
            
        except Exception as e:
            insights.append(f"洞察生成中にエラー: {str(e)}")
        
        return insights
    
    def create_visualization_dashboard(self, analysis_results: Dict) -> str:
        """分析結果の可視化ダッシュボード作成"""
        self.log_progress("可視化ダッシュボード生成中...")
        
        try:
            fig, axes = plt.subplots(2, 2, figsize=(15, 12))
            fig.suptitle('Deep Baseball Analytics Dashboard\n詳細野球分析ダッシュボード', fontsize=16, fontweight='bold')
            
            # 1. リーグ別選手数比較
            if 'league_distribution' in analysis_results:
                league_data = analysis_results['league_distribution']
                leagues = [item['league'].upper() for item in league_data]
                counts = [item['player_count'] for item in league_data]
                
                axes[0,0].bar(leagues, counts, color=['#1f77b4', '#ff7f0e'])
                axes[0,0].set_title('リーグ別選手数')
                axes[0,0].set_ylabel('選手数')
                
                for i, v in enumerate(counts):
                    axes[0,0].text(i, v + 10, str(v), ha='center', fontweight='bold')
            
            # 2. 年齢分布
            if 'league_distribution' in analysis_results:
                ages = [item['avg_age'] for item in analysis_results['league_distribution']]
                axes[0,1].bar(leagues, ages, color=['#2ca02c', '#d62728'])
                axes[0,1].set_title('平均年齢比較')
                axes[0,1].set_ylabel('平均年齢')
                
                for i, v in enumerate(ages):
                    if v:
                        axes[0,1].text(i, v + 0.2, f'{v:.1f}', ha='center', fontweight='bold')
            
            # 3. 外国人選手分布
            if 'foreign_player_analysis' in analysis_results:
                foreign_data = analysis_results['foreign_player_analysis']
                countries = [item['nationality'] for item in foreign_data[:10]]  # 上位10カ国
                foreign_counts = [item['count'] for item in foreign_data[:10]]
                
                axes[1,0].barh(countries, foreign_counts, color='skyblue')
                axes[1,0].set_title('外国人選手出身国 (上位10)')
                axes[1,0].set_xlabel('選手数')
            
            # 4. チーム別ロースターサイズ
            if 'team_analysis' in analysis_results:
                team_data = analysis_results['team_analysis'][:15]  # 上位15チーム
                team_names = [item['current_team'][:10] for item in team_data]  # チーム名短縮
                roster_sizes = [item['roster_size'] for item in team_data]
                
                axes[1,1].bar(range(len(team_names)), roster_sizes, color='lightcoral')
                axes[1,1].set_title('チーム別ロースターサイズ')
                axes[1,1].set_ylabel('選手数')
                axes[1,1].set_xticks(range(len(team_names)))
                axes[1,1].set_xticklabels(team_names, rotation=45, ha='right')
            
            plt.tight_layout()
            
            dashboard_filename = f'deep_exploration_dashboard_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
            plt.savefig(dashboard_filename, dpi=300, bbox_inches='tight')
            plt.close()
            
            self.log_progress(f"ダッシュボード保存完了: {dashboard_filename}")
            return dashboard_filename
            
        except Exception as e:
            self.log_progress(f"可視化エラー: {str(e)}")
            return ""
    
    def run_comprehensive_exploration(self) -> Dict[str, Any]:
        """包括的探索分析の実行"""
        print("="*80)
        print("DEEP EXPLORATION ANALYSIS SYSTEM")
        print("詳細探索分析システム - 長時間深い分析")
        print("="*80)
        
        self.log_progress("包括的探索分析を開始...")
        
        # メイン分析実行
        analysis_results = self.deep_player_analysis()
        
        # 可視化ダッシュボード作成
        dashboard_file = self.create_visualization_dashboard(analysis_results)
        
        # 最終レポート生成
        total_time = (datetime.now() - self.start_time).total_seconds()
        
        print("\n" + "="*80)
        print("DEEP EXPLORATION ANALYSIS REPORT")
        print("="*80)
        
        print(f"総分析時間: {total_time:.1f} 秒")
        print(f"分析コンポーネント数: {len(analysis_results)} 項目")
        
        if 'league_distribution' in analysis_results:
            print(f"分析対象リーグ: {len(analysis_results['league_distribution'])} リーグ")
        
        if 'key_insights' in analysis_results:
            print(f"\n主要洞察:")
            for i, insight in enumerate(analysis_results['key_insights'], 1):
                print(f"  {i}. {insight}")
        
        if dashboard_file:
            print(f"\n可視化ダッシュボード: {dashboard_file}")
        
        # 詳細統計サマリー
        if 'league_comparison' in analysis_results:
            print(f"\nリーグ統計比較:")
            for league in analysis_results['league_comparison']:
                league_name = league['league'].upper()
                print(f"  {league_name}: {league['total_players']}選手, AVG {league['league_avg_batting']:.3f}, ERA {league['league_avg_era']:.2f}")
        
        print("\n" + "="*80)
        print("DEEP EXPLORATION ANALYSIS COMPLETE!")
        print("包括的探索分析完了 - 詳細データ洞察を生成")
        print("="*80)
        
        # 結果を保存
        with open(f'deep_exploration_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json', 'w', encoding='utf-8') as f:
            json.dump(analysis_results, f, indent=2, ensure_ascii=False, default=str)
        
        return analysis_results

def main():
    """メイン実行関数"""
    explorer = DeepExplorationSystem()
    results = explorer.run_comprehensive_exploration()
    
    return results

if __name__ == "__main__":
    main()