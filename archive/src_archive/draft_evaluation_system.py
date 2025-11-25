#!/usr/bin/env python3
"""
Draft Evaluation System
ドラフト評価システム
ドラフト候補選手の評価・ランキング・スカウティング分析
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
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 日本語フォント設定
plt.rcParams['font.family'] = ['Yu Gothic', 'Meiryo', 'DejaVu Sans']

@dataclass
class DraftProspect:
    prospect_id: int
    player_name: str
    age: int
    position: str
    school_team: str
    draft_eligible_year: int
    overall_grade: float
    hitting_grade: float
    power_grade: float
    speed_grade: float
    fielding_grade: float
    arm_grade: float
    projected_role: str
    ceiling: str
    floor: str
    risk_level: str
    comparable_players: List[str]

@dataclass
class ScoutingReport:
    prospect_id: int
    scout_name: str
    evaluation_date: datetime
    tools_grades: Dict[str, float]  # 20-80スケール
    strengths: List[str]
    weaknesses: List[str]
    development_needs: List[str]
    eta_to_majors: int
    confidence_level: float

class DraftEvaluationSystem:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        
        # ドラフト評価基準（20-80スケール）
        self.grade_scale = {
            20: 'Poor', 25: 'Well Below Average', 30: 'Below Average',
            35: 'Below Average', 40: 'Below Average', 45: 'Average Fringe',
            50: 'Average', 55: 'Above Average', 60: 'Above Average',
            65: 'Well Above Average', 70: 'Plus', 75: 'Plus Plus', 80: 'Elite'
        }
        
        # ポジション別重要度
        self.position_weights = {
            'C': {'hitting': 0.25, 'power': 0.20, 'fielding': 0.30, 'arm': 0.20, 'speed': 0.05},
            '1B': {'hitting': 0.35, 'power': 0.35, 'fielding': 0.20, 'arm': 0.05, 'speed': 0.05},
            '2B': {'hitting': 0.30, 'power': 0.15, 'fielding': 0.25, 'arm': 0.15, 'speed': 0.15},
            '3B': {'hitting': 0.30, 'power': 0.25, 'fielding': 0.25, 'arm': 0.15, 'speed': 0.05},
            'SS': {'hitting': 0.25, 'power': 0.15, 'fielding': 0.30, 'arm': 0.20, 'speed': 0.10},
            'LF': {'hitting': 0.35, 'power': 0.25, 'fielding': 0.15, 'arm': 0.15, 'speed': 0.10},
            'CF': {'hitting': 0.30, 'power': 0.20, 'fielding': 0.25, 'arm': 0.15, 'speed': 0.10},
            'RF': {'hitting': 0.30, 'power': 0.25, 'fielding': 0.20, 'arm': 0.20, 'speed': 0.05},
            'P': {'control': 0.30, 'stuff': 0.30, 'command': 0.25, 'durability': 0.15}
        }
        
        # リスクレベル定義
        self.risk_factors = {
            'injury_history': 15,
            'amateur_competition': 10,
            'age_for_class': 8,
            'body_type': 5,
            'development_time': 12,
            'signability': 20
        }
        
    def connect_db(self):
        return sqlite3.connect(self.db_path)
    
    def create_prospect_database(self):
        """ドラフト候補データベース作成"""
        conn = self.connect_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS draft_prospects (
                prospect_id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT NOT NULL,
                age INTEGER,
                position TEXT,
                school_team TEXT,
                draft_year INTEGER,
                height_cm INTEGER,
                weight_kg INTEGER,
                bats TEXT,
                throws TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scouting_grades (
                grade_id INTEGER PRIMARY KEY AUTOINCREMENT,
                prospect_id INTEGER,
                scout_name TEXT,
                evaluation_date DATE,
                hit_tool REAL,
                power_tool REAL,
                run_tool REAL,
                field_tool REAL,
                arm_tool REAL,
                overall_future_value REAL,
                risk_grade TEXT,
                eta_years INTEGER,
                FOREIGN KEY (prospect_id) REFERENCES draft_prospects (prospect_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS amateur_stats (
                stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
                prospect_id INTEGER,
                season INTEGER,
                level TEXT,
                games INTEGER,
                at_bats INTEGER,
                hits INTEGER,
                doubles INTEGER,
                triples INTEGER,
                home_runs INTEGER,
                rbis INTEGER,
                runs INTEGER,
                walks INTEGER,
                strikeouts INTEGER,
                stolen_bases INTEGER,
                batting_avg REAL,
                on_base_pct REAL,
                slugging_pct REAL,
                FOREIGN KEY (prospect_id) REFERENCES draft_prospects (prospect_id)
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info("ドラフト候補データベース作成完了")
    
    def generate_mock_prospects(self, count: int = 100) -> List[Dict[str, Any]]:
        """模擬ドラフト候補生成"""
        np.random.seed(42)
        
        prospects = []
        positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P']
        schools = ['早稲田大学', '慶應義塾大学', '明治大学', '立教大学', '法政大学', 
                  '日本大学', '東海大学', '亜細亜大学', '青山学院大学', '中央大学']
        
        for i in range(count):
            position = np.random.choice(positions, p=[0.08, 0.08, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12])
            age = np.random.randint(18, 23)
            
            # ツール評価（20-80スケール）
            if position == 'P':
                tools = {
                    'stuff': np.random.normal(45, 12),
                    'control': np.random.normal(45, 10),
                    'command': np.random.normal(40, 8),
                    'durability': np.random.normal(50, 8)
                }
            else:
                tools = {
                    'hit': np.random.normal(45, 10),
                    'power': np.random.normal(45, 12),
                    'run': np.random.normal(45, 8),
                    'field': np.random.normal(45, 8),
                    'arm': np.random.normal(45, 10)
                }
            
            # ツールスコア正規化（20-80範囲）
            for tool, value in tools.items():
                tools[tool] = max(20, min(80, value))
            
            prospects.append({
                'prospect_id': i + 1,
                'player_name': f'候補選手{i+1:03d}',
                'age': age,
                'position': position,
                'school_team': np.random.choice(schools),
                'draft_year': 2025,
                'height_cm': np.random.randint(165, 195),
                'weight_kg': np.random.randint(65, 95),
                'tools': tools
            })
        
        return prospects
    
    def evaluate_prospect_tools(self, tools: Dict[str, float], position: str) -> Dict[str, Any]:
        """候補選手ツール評価"""
        evaluation = {
            'tools_breakdown': {},
            'overall_grade': 0.0,
            'projected_role': '',
            'ceiling': '',
            'floor': '',
            'risk_level': ''
        }
        
        # ポジション別重み付け評価
        if position == 'P':
            weights = {'stuff': 0.30, 'control': 0.30, 'command': 0.25, 'durability': 0.15}
        else:
            weights = self.position_weights.get(position, self.position_weights['CF'])
        
        total_score = 0.0
        tool_count = 0
        
        for tool, grade in tools.items():
            if tool in weights:
                weighted_grade = grade * weights[tool]
                total_score += weighted_grade
                evaluation['tools_breakdown'][tool] = {
                    'grade': round(grade, 1),
                    'description': self.grade_to_description(grade),
                    'weight': weights[tool]
                }
                tool_count += 1
        
        # 総合評価
        if tool_count > 0:
            evaluation['overall_grade'] = round(total_score / sum(weights.values()), 1)
        
        # 役割予測
        evaluation['projected_role'] = self.predict_role(evaluation['overall_grade'], position)
        evaluation['ceiling'] = self.estimate_ceiling(tools, position)
        evaluation['floor'] = self.estimate_floor(tools, position)
        evaluation['risk_level'] = self.assess_risk(tools, position)
        
        return evaluation
    
    def grade_to_description(self, grade: float) -> str:
        """グレードを説明文に変換"""
        grade_int = int(round(grade / 5) * 5)
        return self.grade_scale.get(grade_int, 'Average')
    
    def predict_role(self, overall_grade: float, position: str) -> str:
        """役割予測"""
        if position == 'P':
            if overall_grade >= 60:
                return '先発ローテーション'
            elif overall_grade >= 50:
                return 'リリーフ・スポット先発'
            elif overall_grade >= 40:
                return 'ミドルリリーフ'
            else:
                return '育成・2軍'
        else:
            if overall_grade >= 65:
                return 'スター選手'
            elif overall_grade >= 55:
                return 'レギュラー選手'
            elif overall_grade >= 45:
                return '役割型選手'
            elif overall_grade >= 35:
                return '控え選手'
            else:
                return '育成・2軍'
    
    def estimate_ceiling(self, tools: Dict[str, float], position: str) -> str:
        """上限評価"""
        max_tool = max(tools.values()) if tools else 45
        
        if max_tool >= 70:
            return 'オールスター級'
        elif max_tool >= 60:
            return 'solid starter'
        elif max_tool >= 50:
            return '平均的レギュラー'
        else:
            return '役割型選手'
    
    def estimate_floor(self, tools: Dict[str, float], position: str) -> str:
        """下限評価"""
        min_tool = min(tools.values()) if tools else 45
        
        if min_tool >= 40:
            return '2軍レギュラー'
        elif min_tool >= 30:
            return '育成選手'
        else:
            return 'リリース候補'
    
    def assess_risk(self, tools: Dict[str, float], position: str) -> str:
        """リスク評価"""
        tool_variance = np.var(list(tools.values())) if tools else 0
        avg_grade = np.mean(list(tools.values())) if tools else 45
        
        # 高リスク要因
        risk_score = 0
        
        if tool_variance > 200:  # ツール間のばらつきが大きい
            risk_score += 25
        if avg_grade < 40:  # 全体的に低評価
            risk_score += 30
        if position == 'P':  # 投手は怪我リスク高
            risk_score += 15
        
        if risk_score >= 50:
            return 'High Risk'
        elif risk_score >= 30:
            return 'Medium Risk'
        else:
            return 'Low Risk'
    
    def create_draft_board(self, prospects: List[Dict[str, Any]], 
                          top_n: int = 50) -> pd.DataFrame:
        """ドラフトボード作成"""
        logger.info(f"ドラフトボード作成中... (上位{top_n}名)")
        
        draft_board = []
        
        for prospect in prospects:
            tools = prospect['tools']
            position = prospect['position']
            evaluation = self.evaluate_prospect_tools(tools, position)
            
            # 投手と野手で異なる指標を使用
            if position == 'P':
                primary_tool = max(tools.get('stuff', 45), tools.get('control', 45))
                secondary_skills = (tools.get('command', 40) + tools.get('durability', 50)) / 2
            else:
                primary_tool = max(tools.get('hit', 45), tools.get('power', 45))
                secondary_skills = (tools.get('run', 45) + tools.get('field', 45) + tools.get('arm', 45)) / 3
            
            draft_board.append({
                'rank': 0,  # 後で設定
                'prospect_id': prospect['prospect_id'],
                'player_name': prospect['player_name'],
                'position': position,
                'age': prospect['age'],
                'school': prospect['school_team'],
                'overall_grade': evaluation['overall_grade'],
                'primary_tool': round(primary_tool, 1),
                'secondary_skills': round(secondary_skills, 1),
                'projected_role': evaluation['projected_role'],
                'ceiling': evaluation['ceiling'],
                'risk': evaluation['risk_level'],
                'draft_value': self.calculate_draft_value(evaluation, prospect['age'])
            })
        
        # ドラフト価値でソート
        df = pd.DataFrame(draft_board)
        df = df.sort_values('draft_value', ascending=False)
        df['rank'] = range(1, len(df) + 1)
        
        logger.info(f"ドラフトボード作成完了: {len(df)}名評価")
        return df.head(top_n)
    
    def calculate_draft_value(self, evaluation: Dict[str, Any], age: int) -> float:
        """ドラフト価値計算"""
        base_value = evaluation['overall_grade']
        
        # 年齢調整（若いほど価値高）
        if age <= 19:
            age_bonus = 5
        elif age <= 21:
            age_bonus = 2
        elif age >= 23:
            age_bonus = -3
        else:
            age_bonus = 0
        
        # リスク調整
        risk_penalty = 0
        if evaluation['risk_level'] == 'High Risk':
            risk_penalty = 8
        elif evaluation['risk_level'] == 'Medium Risk':
            risk_penalty = 4
        
        # 上限調整
        ceiling_bonus = 0
        if evaluation['ceiling'] == 'オールスター級':
            ceiling_bonus = 10
        elif evaluation['ceiling'] == 'solid starter':
            ceiling_bonus = 5
        
        draft_value = base_value + age_bonus + ceiling_bonus - risk_penalty
        return max(0, draft_value)
    
    def generate_scouting_report(self, prospect: Dict[str, Any]) -> ScoutingReport:
        """スカウティングレポート生成"""
        tools = prospect['tools']
        position = prospect['position']
        evaluation = self.evaluate_prospect_tools(tools, position)
        
        # 強み・弱み分析
        strengths = []
        weaknesses = []
        development_needs = []
        
        for tool, grade in tools.items():
            if grade >= 55:
                strengths.append(f"{tool}: {self.grade_to_description(grade)}")
            elif grade <= 40:
                weaknesses.append(f"{tool}: {self.grade_to_description(grade)}")
                development_needs.append(f"{tool}の向上が必要")
        
        # ETA計算
        if evaluation['overall_grade'] >= 60:
            eta = 2  # 2年
        elif evaluation['overall_grade'] >= 50:
            eta = 3  # 3年
        elif evaluation['overall_grade'] >= 40:
            eta = 4  # 4年
        else:
            eta = 5  # 5年以上
        
        return ScoutingReport(
            prospect_id=prospect['prospect_id'],
            scout_name="システム評価",
            evaluation_date=datetime.now(),
            tools_grades=tools,
            strengths=strengths[:3],  # 上位3つの強み
            weaknesses=weaknesses[:2],  # 上位2つの弱み
            development_needs=development_needs[:3],
            eta_to_majors=eta,
            confidence_level=0.75 if evaluation['risk_level'] == 'Low Risk' else 0.60
        )
    
    def compare_draft_classes(self, years: List[int]) -> Dict[str, Any]:
        """ドラフト年度比較"""
        comparison = {
            'year_summaries': {},
            'top_prospect_comparison': [],
            'position_depth_analysis': {},
            'overall_class_strength': {}
        }
        
        for year in years:
            # 模擬データ生成（実際は各年のデータを読み込み）
            prospects = self.generate_mock_prospects(100)
            draft_board = self.create_draft_board(prospects, 30)
            
            # 年度サマリー
            comparison['year_summaries'][year] = {
                'top_30_avg_grade': draft_board['overall_grade'].mean(),
                'elite_prospects': len(draft_board[draft_board['overall_grade'] >= 60]),
                'high_upside': len(draft_board[draft_board['ceiling'] == 'オールスター級']),
                'position_breakdown': draft_board['position'].value_counts().to_dict()
            }
            
            # トップ候補比較
            if not draft_board.empty:
                top_prospect = draft_board.iloc[0]
                comparison['top_prospect_comparison'].append({
                    'year': year,
                    'name': top_prospect['player_name'],
                    'position': top_prospect['position'],
                    'grade': top_prospect['overall_grade'],
                    'ceiling': top_prospect['ceiling']
                })
        
        return comparison
    
    def create_draft_strategy(self, team_needs: Dict[str, int], 
                            draft_board: pd.DataFrame) -> Dict[str, Any]:
        """ドラフト戦略作成"""
        strategy = {
            'recommended_picks': [],
            'position_targets': {},
            'value_picks': [],
            'risk_assessment': {},
            'alternative_scenarios': []
        }
        
        # チーム需要に基づく推奨ピック
        for position, priority in team_needs.items():
            position_prospects = draft_board[draft_board['position'] == position]
            
            if not position_prospects.empty:
                best_prospect = position_prospects.iloc[0]
                strategy['recommended_picks'].append({
                    'position': position,
                    'priority': priority,
                    'prospect': best_prospect['player_name'],
                    'rank': best_prospect['rank'],
                    'grade': best_prospect['overall_grade'],
                    'rationale': f"{position}の即戦力候補"
                })
        
        # バリューピック（順位より価値が高い選手）
        draft_board['value_score'] = draft_board['draft_value'] - (100 - draft_board['rank'])
        value_picks = draft_board[draft_board['value_score'] > 5].head(10)
        
        for _, prospect in value_picks.iterrows():
            strategy['value_picks'].append({
                'name': prospect['player_name'],
                'position': prospect['position'],
                'rank': prospect['rank'],
                'value_score': round(prospect['value_score'], 1),
                'rationale': 'ドラフト順位より高い評価'
            })
        
        return strategy
    
    def export_draft_report(self, draft_board: pd.DataFrame, 
                           scouting_reports: List[ScoutingReport]) -> str:
        """ドラフトレポートエクスポート"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"draft_evaluation_report_{timestamp}.json"
        
        report_data = {
            'generation_date': datetime.now().isoformat(),
            'draft_year': 2025,
            'total_prospects_evaluated': len(draft_board),
            'draft_board': draft_board.to_dict('records'),
            'scouting_reports': [],
            'summary_statistics': {
                'avg_overall_grade': float(draft_board['overall_grade'].mean()),
                'elite_prospects': int(len(draft_board[draft_board['overall_grade'] >= 60])),
                'position_breakdown': draft_board['position'].value_counts().to_dict(),
                'risk_distribution': draft_board['risk'].value_counts().to_dict()
            }
        }
        
        # スカウティングレポート追加
        for report in scouting_reports[:20]:  # 上位20名
            report_data['scouting_reports'].append({
                'prospect_id': report.prospect_id,
                'scout_name': report.scout_name,
                'tools_grades': report.tools_grades,
                'strengths': report.strengths,
                'weaknesses': report.weaknesses,
                'eta_to_majors': report.eta_to_majors,
                'confidence_level': report.confidence_level
            })
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"ドラフトレポート保存: {filename}")
        return filename
    
    def visualize_draft_analysis(self, draft_board: pd.DataFrame) -> str:
        """ドラフト分析可視化"""
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        fig.suptitle('Draft Evaluation Analysis 2025\nドラフト候補評価分析 2025', 
                     fontsize=16, fontweight='bold')
        
        # 1. 総合評価分布
        axes[0,0].hist(draft_board['overall_grade'], bins=20, alpha=0.7, color='skyblue')
        axes[0,0].axvline(draft_board['overall_grade'].mean(), color='red', linestyle='--', 
                         label=f'平均: {draft_board["overall_grade"].mean():.1f}')
        axes[0,0].set_title('総合評価分布')
        axes[0,0].set_xlabel('総合グレード (20-80)')
        axes[0,0].set_ylabel('選手数')
        axes[0,0].legend()
        
        # 2. ポジション別評価
        position_avg = draft_board.groupby('position')['overall_grade'].mean().sort_values(ascending=True)
        axes[0,1].barh(position_avg.index, position_avg.values, color='lightgreen')
        axes[0,1].set_title('ポジション別平均評価')
        axes[0,1].set_xlabel('平均グレード')
        
        # 3. 年齢 vs 評価
        scatter = axes[0,2].scatter(draft_board['age'], draft_board['overall_grade'], 
                                   c=draft_board['rank'], cmap='viridis', alpha=0.6)
        axes[0,2].set_title('年齢と評価の関係')
        axes[0,2].set_xlabel('年齢')
        axes[0,2].set_ylabel('総合グレード')
        plt.colorbar(scatter, ax=axes[0,2], label='ドラフト順位')
        
        # 4. リスクレベル分布
        risk_counts = draft_board['risk'].value_counts()
        colors = ['green', 'orange', 'red']
        axes[1,0].pie(risk_counts.values, labels=risk_counts.index, colors=colors[:len(risk_counts)], 
                     autopct='%1.1f%%')
        axes[1,0].set_title('リスクレベル分布')
        
        # 5. 上位30名のツール比較
        top_30 = draft_board.head(30)
        tool_columns = ['primary_tool', 'secondary_skills']
        
        for i, (_, prospect) in enumerate(top_30.head(10).iterrows()):
            axes[1,1].barh(i, prospect['primary_tool'], alpha=0.7, label='Primary Tool' if i == 0 else "")
            axes[1,1].barh(i, prospect['secondary_skills'], left=prospect['primary_tool'], 
                          alpha=0.7, label='Secondary Skills' if i == 0 else "")
        
        axes[1,1].set_title('上位10名ツール比較')
        axes[1,1].set_xlabel('ツールグレード')
        axes[1,1].set_yticks(range(10))
        axes[1,1].set_yticklabels([f"{row['rank']}. {row['player_name'][:10]}" for _, row in top_30.head(10).iterrows()])
        axes[1,1].legend()
        
        # 6. ドラフト価値 vs 順位
        axes[1,2].scatter(draft_board['rank'], draft_board['draft_value'], alpha=0.6, color='purple')
        axes[1,2].plot([1, len(draft_board)], [draft_board['draft_value'].max(), 
                       draft_board['draft_value'].min()], 'r--', alpha=0.5, label='期待値ライン')
        axes[1,2].set_title('ドラフト順位とドラフト価値')
        axes[1,2].set_xlabel('ドラフト順位')
        axes[1,2].set_ylabel('ドラフト価値')
        axes[1,2].legend()
        
        plt.tight_layout()
        
        filename = f'draft_analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"ドラフト分析可視化保存: {filename}")
        return filename

def main():
    """メイン実行"""
    draft_system = DraftEvaluationSystem()
    
    print("="*80)
    print("DRAFT EVALUATION SYSTEM")
    print("ドラフト評価システム")
    print("="*80)
    
    print("\n1: 2025年ドラフト候補評価")
    print("2: ドラフトボード作成")
    print("3: チーム別ドラフト戦略")
    print("4: 年度別ドラフトクラス比較")
    
    choice = input("選択してください (1-4): ").strip()
    
    if choice == '1':
        # 模擬ドラフト候補生成・評価
        print("ドラフト候補評価実行中...")
        prospects = draft_system.generate_mock_prospects(150)
        draft_board = draft_system.create_draft_board(prospects, 50)
        
        print(f"\n=== 2025年ドラフト候補評価結果 ===")
        print(f"評価対象: {len(prospects)}名")
        print(f"上位候補: {len(draft_board)}名")
        
        print(f"\n=== TOP 10 ドラフト候補 ===")
        for _, prospect in draft_board.head(10).iterrows():
            print(f"{prospect['rank']:2d}. {prospect['player_name']} ({prospect['position']}) "
                  f"- 評価: {prospect['overall_grade']:.1f} | {prospect['projected_role']}")
        
        # スカウティングレポート生成
        scouting_reports = []
        for prospect in prospects[:20]:
            report = draft_system.generate_scouting_report(prospect)
            scouting_reports.append(report)
        
        # レポート・可視化作成
        report_file = draft_system.export_draft_report(draft_board, scouting_reports)
        viz_file = draft_system.visualize_draft_analysis(draft_board)
        
        print(f"\n詳細レポート: {report_file}")
        print(f"可視化ファイル: {viz_file}")
    
    elif choice == '2':
        print("ドラフトボード作成中...")
        prospects = draft_system.generate_mock_prospects(200)
        draft_board = draft_system.create_draft_board(prospects, 100)
        
        print(f"\n=== ドラフトボード (上位30名) ===")
        print(draft_board.head(30).to_string(index=False))
    
    elif choice == '3':
        # チーム需要例
        team_needs = {
            'SS': 9,    # 高優先度
            'CF': 8,    # 高優先度
            'P': 7,     # 中優先度
            '3B': 6,    # 中優先度
            'C': 5      # 低優先度
        }
        
        prospects = draft_system.generate_mock_prospects(100)
        draft_board = draft_system.create_draft_board(prospects, 50)
        strategy = draft_system.create_draft_strategy(team_needs, draft_board)
        
        print(f"\n=== ドラフト戦略提案 ===")
        print("推奨ピック:")
        for pick in strategy['recommended_picks']:
            print(f"  {pick['position']} - {pick['prospect']} (順位{pick['rank']}, "
                  f"評価{pick['grade']:.1f}) - {pick['rationale']}")
        
        print(f"\nバリューピック候補:")
        for pick in strategy['value_picks'][:5]:
            print(f"  {pick['position']} - {pick['name']} (順位{pick['rank']}, "
                  f"価値+{pick['value_score']:.1f})")

if __name__ == "__main__":
    main()