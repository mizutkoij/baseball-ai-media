#!/usr/bin/env python3
"""
Sabermetrics Learning System
セイバーメトリクス教育システム
野球統計学の学習・計算・教育プログラム
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
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 日本語フォント設定
plt.rcParams['font.family'] = ['Yu Gothic', 'Meiryo', 'DejaVu Sans']

@dataclass
class SabermetricsLesson:
    lesson_id: str
    title: str
    description: str
    difficulty_level: str  # 'beginner', 'intermediate', 'advanced'
    concepts: List[str]
    formulas: Dict[str, str]
    examples: List[Dict[str, Any]]
    quiz_questions: List[Dict[str, Any]]

@dataclass
class StatCalculation:
    stat_name: str
    value: float
    formula_used: str
    explanation: str
    interpretation: str
    league_context: Dict[str, float]

class SabermetricsLearningSystem:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        
        # セイバーメトリクス定義
        self.sabermetrics_definitions = {
            'basic': {
                'AVG': {
                    'name': '打率',
                    'formula': 'H / AB',
                    'description': 'ヒット数を打数で割った値。打者の確実性を示す',
                    'good_value': 0.280,
                    'excellent_value': 0.320
                },
                'OBP': {
                    'name': '出塁率',
                    'formula': '(H + BB + HBP) / (AB + BB + HBP + SF)',
                    'description': 'アウトにならずに塁に出る確率',
                    'good_value': 0.340,
                    'excellent_value': 0.380
                },
                'SLG': {
                    'name': '長打率',
                    'formula': '(1B + 2*2B + 3*3B + 4*HR) / AB',
                    'description': '1打席あたりの塁打数。長打力を示す',
                    'good_value': 0.450,
                    'excellent_value': 0.550
                },
                'OPS': {
                    'name': 'OPS',
                    'formula': 'OBP + SLG',
                    'description': '出塁率と長打率の合計。総合的な攻撃力',
                    'good_value': 0.800,
                    'excellent_value': 0.900
                }
            },
            'advanced': {
                'wOBA': {
                    'name': '重み付け出塁率',
                    'formula': '(uBB*wBB + HBP*wHBP + 1B*w1B + 2B*w2B + 3B*w3B + HR*wHR) / (AB + BB - IBB + SF + HBP)',
                    'description': '各打撃結果に適切な重みを付けた出塁率',
                    'good_value': 0.340,
                    'excellent_value': 0.380,
                    'weights': {
                        'wBB': 0.69, 'wHBP': 0.72, 'w1B': 0.89,
                        'w2B': 1.27, 'w3B': 1.62, 'wHR': 2.10
                    }
                },
                'wRC+': {
                    'name': '重み付き得点創出力+',
                    'formula': '(wRAA/PA + League R/PA) * PA * Park * League * 100',
                    'description': 'リーグ平均を100とした得点創出力',
                    'good_value': 110,
                    'excellent_value': 130
                },
                'WAR': {
                    'name': '勝利数上乗せ',
                    'formula': '(Batting + Baserunning + Fielding + Positional) / Runs per Win',
                    'description': '平均的な代替選手よりどれだけ多くの勝利に貢献したか',
                    'good_value': 3.0,
                    'excellent_value': 6.0
                },
                'FIP': {
                    'name': '守備無関係防御率',
                    'formula': '((13*HR + 3*(BB+HBP) - 2*K) / IP) + FIP_constant',
                    'description': '投手の制御可能な要素のみで計算した防御率',
                    'good_value': 3.50,
                    'excellent_value': 3.00
                }
            },
            'modern': {
                'xwOBA': {
                    'name': '予想重み付け出塁率',
                    'formula': 'Statcast打球データに基づく期待値',
                    'description': '打球の質から算出される期待wOBA',
                    'good_value': 0.340,
                    'excellent_value': 0.380
                },
                'Barrel%': {
                    'name': 'バレル率',
                    'formula': 'バレル打球数 / 打球イベント数',
                    'description': '最適な打球角度と初速の打球の割合',
                    'good_value': 8.0,
                    'excellent_value': 15.0
                },
                'Hard Hit%': {
                    'name': 'ハードヒット率',
                    'formula': '95mph以上の打球 / 打球イベント数',
                    'description': '強い当たりの打球の割合',
                    'good_value': 35.0,
                    'excellent_value': 45.0
                }
            }
        }
        
        # 学習コース定義
        self.learning_courses = {
            'beginner': [
                'basic_stats_introduction',
                'understanding_avg_obp_slg',
                'ops_calculation',
                'era_whip_basics'
            ],
            'intermediate': [
                'advanced_offensive_stats',
                'woba_calculation',
                'park_factors',
                'pitching_peripherals',
                'defensive_metrics_intro'
            ],
            'advanced': [
                'war_calculation',
                'leverage_index',
                'win_probability',
                'statcast_metrics',
                'predictive_analytics'
            ]
        }
    
    def connect_db(self):
        return sqlite3.connect(self.db_path)
    
    def create_lesson(self, lesson_id: str) -> Optional[SabermetricsLesson]:
        """レッスン作成"""
        lesson_definitions = {
            'basic_stats_introduction': {
                'title': 'セイバーメトリクス入門',
                'description': 'セイバーメトリクスの基本概念と歴史を学ぶ',
                'difficulty_level': 'beginner',
                'concepts': ['セイバーメトリクスとは', 'ビル・ジェームズ', '数値化の意義'],
                'formulas': {},
                'examples': [
                    {
                        'scenario': 'なぜ打率だけでは不十分なのか？',
                        'explanation': '打率は四球を考慮しないため、出塁能力を正確に測れない',
                        'data': {'player_a_avg': 0.300, 'player_a_obp': 0.350, 
                                'player_b_avg': 0.280, 'player_b_obp': 0.380}
                    }
                ],
                'quiz_questions': [
                    {
                        'question': 'セイバーメトリクスの父と呼ばれる人物は？',
                        'options': ['A. ビル・ジェームズ', 'B. ヘンリー・チャドウィック', 'C. バイロン・バンタフ'],
                        'correct': 'A',
                        'explanation': 'ビル・ジェームズが現代セイバーメトリクスの基礎を築いた'
                    }
                ]
            },
            'understanding_avg_obp_slg': {
                'title': '基本3指標：打率・出塁率・長打率',
                'description': '野球の基本的な打撃指標を深く理解する',
                'difficulty_level': 'beginner',
                'concepts': ['打率の限界', '出塁率の重要性', '長打率の意味'],
                'formulas': {
                    'AVG': 'H / AB',
                    'OBP': '(H + BB + HBP) / (AB + BB + HBP + SF)',
                    'SLG': '(1B + 2*2B + 3*3B + 4*HR) / AB'
                },
                'examples': [
                    {
                        'scenario': '実際の選手データで計算してみよう',
                        'data': {'AB': 500, 'H': 150, 'BB': 60, 'HBP': 5, 'SF': 4, 
                                '2B': 30, '3B': 2, 'HR': 25},
                        'calculations': {
                            'AVG': 150/500,
                            'OBP': (150+60+5)/(500+60+5+4),
                            'SLG': (93+60+6+100)/500
                        }
                    }
                ],
                'quiz_questions': [
                    {
                        'question': '出塁率が打率よりも重要とされる理由は？',
                        'options': ['A. 計算が簡単', 'B. 四球も得点機会だから', 'C. 歴史が古いから'],
                        'correct': 'B',
                        'explanation': '四球も塁に出ることで得点の機会を作るため'
                    }
                ]
            },
            'woba_calculation': {
                'title': 'wOBA：重み付け出塁率',
                'description': '各打撃結果に適切な価値を付けた最新指標',
                'difficulty_level': 'intermediate',
                'concepts': ['重み付けの概念', 'リニアウェイト', '得点価値'],
                'formulas': {
                    'wOBA': '(uBB*0.69 + HBP*0.72 + 1B*0.89 + 2B*1.27 + 3B*1.62 + HR*2.10) / (AB + BB - IBB + SF + HBP)'
                },
                'examples': [
                    {
                        'scenario': 'wOBA vs OPS の比較',
                        'explanation': 'wOBAは各打撃結果の実際の得点価値に基づく重み付け',
                        'data': {'wOBA': 0.350, 'OPS': 0.820, 'interpretation': 'wOBAの方がより正確'}
                    }
                ],
                'quiz_questions': [
                    {
                        'question': 'wOBAで本塁打の重みが最も大きい理由は？',
                        'options': ['A. 見た目が派手', 'B. 1本で4点入ることがある', 'C. 最も多くの得点を生み出すから'],
                        'correct': 'C',
                        'explanation': '統計的に本塁打が最も得点価値が高いため'
                    }
                ]
            }
        }
        
        if lesson_id not in lesson_definitions:
            return None
        
        lesson_data = lesson_definitions[lesson_id]
        return SabermetricsLesson(
            lesson_id=lesson_id,
            title=lesson_data['title'],
            description=lesson_data['description'],
            difficulty_level=lesson_data['difficulty_level'],
            concepts=lesson_data['concepts'],
            formulas=lesson_data['formulas'],
            examples=lesson_data['examples'],
            quiz_questions=lesson_data['quiz_questions']
        )
    
    def calculate_statistic(self, stat_name: str, player_data: Dict[str, Any]) -> StatCalculation:
        """統計指標計算"""
        stat_name_upper = stat_name.upper()
        
        if stat_name_upper == 'AVG':
            return self.calculate_batting_average(player_data)
        elif stat_name_upper == 'OBP':
            return self.calculate_on_base_percentage(player_data)
        elif stat_name_upper == 'SLG':
            return self.calculate_slugging_percentage(player_data)
        elif stat_name_upper == 'OPS':
            return self.calculate_ops(player_data)
        elif stat_name_upper == 'WOBA':
            return self.calculate_woba(player_data)
        elif stat_name_upper == 'FIP':
            return self.calculate_fip(player_data)
        elif stat_name_upper == 'WAR':
            return self.calculate_war(player_data)
        else:
            return StatCalculation(
                stat_name=stat_name,
                value=0.0,
                formula_used="未対応",
                explanation=f"{stat_name}の計算はまだ実装されていません",
                interpretation="計算できません",
                league_context={}
            )
    
    def calculate_batting_average(self, player_data: Dict[str, Any]) -> StatCalculation:
        """打率計算"""
        hits = player_data.get('H', 0)
        at_bats = player_data.get('AB', 1)
        
        if at_bats == 0:
            avg = 0.0
        else:
            avg = hits / at_bats
        
        # 解釈
        if avg >= 0.320:
            interpretation = "優秀"
        elif avg >= 0.280:
            interpretation = "良好"
        elif avg >= 0.250:
            interpretation = "平均的"
        else:
            interpretation = "改善が必要"
        
        return StatCalculation(
            stat_name="打率 (AVG)",
            value=round(avg, 3),
            formula_used="H / AB",
            explanation=f"{hits}安打 ÷ {at_bats}打数 = {avg:.3f}",
            interpretation=interpretation,
            league_context={'NPB平均': 0.248, 'MLB平均': 0.243}
        )
    
    def calculate_on_base_percentage(self, player_data: Dict[str, Any]) -> StatCalculation:
        """出塁率計算"""
        hits = player_data.get('H', 0)
        walks = player_data.get('BB', 0)
        hbp = player_data.get('HBP', 0)
        at_bats = player_data.get('AB', 0)
        sf = player_data.get('SF', 0)
        
        denominator = at_bats + walks + hbp + sf
        
        if denominator == 0:
            obp = 0.0
        else:
            obp = (hits + walks + hbp) / denominator
        
        # 解釈
        if obp >= 0.380:
            interpretation = "エリート級"
        elif obp >= 0.340:
            interpretation = "優秀"
        elif obp >= 0.320:
            interpretation = "平均以上"
        else:
            interpretation = "改善が必要"
        
        return StatCalculation(
            stat_name="出塁率 (OBP)",
            value=round(obp, 3),
            formula_used="(H + BB + HBP) / (AB + BB + HBP + SF)",
            explanation=f"出塁回数 {hits + walks + hbp} ÷ 打席数 {denominator} = {obp:.3f}",
            interpretation=interpretation,
            league_context={'NPB平均': 0.318, 'MLB平均': 0.317}
        )
    
    def calculate_slugging_percentage(self, player_data: Dict[str, Any]) -> StatCalculation:
        """長打率計算"""
        singles = player_data.get('1B', player_data.get('H', 0) - 
                                 player_data.get('2B', 0) - player_data.get('3B', 0) - player_data.get('HR', 0))
        doubles = player_data.get('2B', 0)
        triples = player_data.get('3B', 0)
        home_runs = player_data.get('HR', 0)
        at_bats = player_data.get('AB', 1)
        
        total_bases = singles + (2 * doubles) + (3 * triples) + (4 * home_runs)
        
        if at_bats == 0:
            slg = 0.0
        else:
            slg = total_bases / at_bats
        
        # 解釈
        if slg >= 0.550:
            interpretation = "強力な長打力"
        elif slg >= 0.450:
            interpretation = "良好な長打力"
        elif slg >= 0.400:
            interpretation = "平均的"
        else:
            interpretation = "長打力不足"
        
        return StatCalculation(
            stat_name="長打率 (SLG)",
            value=round(slg, 3),
            formula_used="(1B + 2*2B + 3*3B + 4*HR) / AB",
            explanation=f"塁打数 {total_bases} ÷ 打数 {at_bats} = {slg:.3f}",
            interpretation=interpretation,
            league_context={'NPB平均': 0.391, 'MLB平均': 0.408}
        )
    
    def calculate_ops(self, player_data: Dict[str, Any]) -> StatCalculation:
        """OPS計算"""
        obp_calc = self.calculate_on_base_percentage(player_data)
        slg_calc = self.calculate_slugging_percentage(player_data)
        
        ops = obp_calc.value + slg_calc.value
        
        # 解釈
        if ops >= 0.900:
            interpretation = "MVP級"
        elif ops >= 0.800:
            interpretation = "オールスター級"
        elif ops >= 0.750:
            interpretation = "良好"
        elif ops >= 0.700:
            interpretation = "平均的"
        else:
            interpretation = "改善が必要"
        
        return StatCalculation(
            stat_name="OPS",
            value=round(ops, 3),
            formula_used="OBP + SLG",
            explanation=f"出塁率 {obp_calc.value:.3f} + 長打率 {slg_calc.value:.3f} = {ops:.3f}",
            interpretation=interpretation,
            league_context={'NPB平均': 0.709, 'MLB平均': 0.725}
        )
    
    def calculate_woba(self, player_data: Dict[str, Any]) -> StatCalculation:
        """wOBA計算"""
        # NPB 2023年の重み
        weights = {
            'wBB': 0.69, 'wHBP': 0.72, 'w1B': 0.89,
            'w2B': 1.27, 'w3B': 1.62, 'wHR': 2.10
        }
        
        ubb = player_data.get('BB', 0) - player_data.get('IBB', 0)
        hbp = player_data.get('HBP', 0)
        singles = player_data.get('1B', 0)
        doubles = player_data.get('2B', 0)
        triples = player_data.get('3B', 0)
        home_runs = player_data.get('HR', 0)
        
        at_bats = player_data.get('AB', 0)
        walks = player_data.get('BB', 0)
        ibb = player_data.get('IBB', 0)
        sf = player_data.get('SF', 0)
        
        numerator = (ubb * weights['wBB'] + hbp * weights['wHBP'] + 
                    singles * weights['w1B'] + doubles * weights['w2B'] + 
                    triples * weights['w3B'] + home_runs * weights['wHR'])
        
        denominator = at_bats + walks - ibb + sf + hbp
        
        if denominator == 0:
            woba = 0.0
        else:
            woba = numerator / denominator
        
        # 解釈
        if woba >= 0.380:
            interpretation = "エリート級"
        elif woba >= 0.340:
            interpretation = "優秀"
        elif woba >= 0.320:
            interpretation = "平均以上"
        else:
            interpretation = "平均以下"
        
        return StatCalculation(
            stat_name="重み付け出塁率 (wOBA)",
            value=round(woba, 3),
            formula_used="重み付け出塁率の複雑な計算式",
            explanation=f"各打撃結果に適切な重みを付けて計算: {woba:.3f}",
            interpretation=interpretation,
            league_context={'NPB平均': 0.320, 'MLB平均': 0.317}
        )
    
    def calculate_fip(self, player_data: Dict[str, Any]) -> StatCalculation:
        """FIP計算"""
        home_runs = player_data.get('HR_allowed', 0)
        walks = player_data.get('BB_allowed', 0)
        hbp = player_data.get('HBP_allowed', 0)
        strikeouts = player_data.get('K', 0)
        innings = player_data.get('IP', 1)
        
        fip_constant = 3.10  # NPB 2023年
        
        if innings == 0:
            fip = 0.0
        else:
            fip = ((13 * home_runs + 3 * (walks + hbp) - 2 * strikeouts) / innings) + fip_constant
        
        # 解釈
        if fip <= 3.00:
            interpretation = "エース級"
        elif fip <= 3.50:
            interpretation = "優秀"
        elif fip <= 4.00:
            interpretation = "平均的"
        else:
            interpretation = "改善が必要"
        
        return StatCalculation(
            stat_name="守備無関係防御率 (FIP)",
            value=round(fip, 2),
            formula_used="((13*HR + 3*(BB+HBP) - 2*K) / IP) + constant",
            explanation=f"投手制御可能な要素のみでの防御率: {fip:.2f}",
            interpretation=interpretation,
            league_context={'NPB平均': 3.82, 'MLB平均': 4.28}
        )
    
    def calculate_war(self, player_data: Dict[str, Any]) -> StatCalculation:
        """簡易WAR計算"""
        # 超簡略版WAR（教育用）
        ops = player_data.get('OPS', 0.700)
        games = player_data.get('G', 100)
        position_adjustment = 0.0  # 簡略化
        
        # OPSベースの簡易計算
        war = ((ops - 0.700) / 0.100) * (games / 162) * 2.0
        war = max(-2.0, min(10.0, war))  # 現実的な範囲に制限
        
        # 解釈
        if war >= 6.0:
            interpretation = "MVP候補"
        elif war >= 4.0:
            interpretation = "オールスター級"
        elif war >= 2.0:
            interpretation = "平均以上"
        elif war >= 0.0:
            interpretation = "平均的"
        else:
            interpretation = "平均以下"
        
        return StatCalculation(
            stat_name="勝利数上乗せ (WAR)",
            value=round(war, 1),
            formula_used="複雑な総合計算（簡略版）",
            explanation=f"代替選手より {war:.1f}勝分の価値",
            interpretation=interpretation,
            league_context={'NPB平均': 2.0, 'MLB平均': 2.0}
        )
    
    def create_interactive_lesson(self, lesson: SabermetricsLesson) -> Dict[str, Any]:
        """インタラクティブレッスン作成"""
        interactive_content = {
            'lesson_info': {
                'title': lesson.title,
                'description': lesson.description,
                'difficulty': lesson.difficulty_level
            },
            'learning_objectives': lesson.concepts,
            'formulas': lesson.formulas,
            'examples': lesson.examples,
            'practice_problems': self.generate_practice_problems(lesson.lesson_id),
            'quiz': lesson.quiz_questions,
            'additional_resources': self.get_additional_resources(lesson.lesson_id)
        }
        
        return interactive_content
    
    def generate_practice_problems(self, lesson_id: str) -> List[Dict[str, Any]]:
        """練習問題生成"""
        practice_problems = []
        
        if lesson_id == 'understanding_avg_obp_slg':
            practice_problems = [
                {
                    'problem_id': 1,
                    'scenario': '選手Aの成績から各指標を計算してください',
                    'data': {
                        'AB': 600, 'H': 180, 'BB': 50, 'HBP': 8, 'SF': 6,
                        '2B': 35, '3B': 5, 'HR': 25
                    },
                    'questions': [
                        {'ask': '打率は？', 'answer': 0.300},
                        {'ask': '出塁率は？', 'answer': 0.361},
                        {'ask': '長打率は？', 'answer': 0.500},
                        {'ask': 'OPSは？', 'answer': 0.861}
                    ]
                }
            ]
        elif lesson_id == 'woba_calculation':
            practice_problems = [
                {
                    'problem_id': 1,
                    'scenario': 'wOBAを計算してみましょう',
                    'data': {
                        'uBB': 40, 'HBP': 5, '1B': 120, '2B': 30, 
                        '3B': 2, 'HR': 20, 'AB': 500, 'SF': 4
                    },
                    'questions': [
                        {'ask': 'wOBAは？', 'answer': 0.340}
                    ]
                }
            ]
        
        return practice_problems
    
    def get_additional_resources(self, lesson_id: str) -> List[Dict[str, str]]:
        """追加リソース取得"""
        resources = [
            {
                'type': 'article',
                'title': 'セイバーメトリクス入門ガイド',
                'description': '基本概念から応用まで',
                'url': '#'
            },
            {
                'type': 'calculator',
                'title': 'セイバーメトリクス計算機',
                'description': '各種指標の自動計算',
                'url': '#'
            },
            {
                'type': 'database',
                'title': 'NPB統計データベース',
                'description': '歴代選手の詳細データ',
                'url': '#'
            }
        ]
        
        return resources
    
    def create_progress_tracking(self) -> Dict[str, Any]:
        """学習進捗追跡"""
        progress = {
            'completed_lessons': [],
            'current_level': 'beginner',
            'quiz_scores': {},
            'practice_accuracy': {},
            'badges_earned': [],
            'total_study_time': 0,
            'favorite_topics': [],
            'weak_areas': []
        }
        
        return progress
    
    def export_learning_report(self, lessons_completed: List[str], 
                             calculations_performed: List[StatCalculation]) -> str:
        """学習レポート出力"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"sabermetrics_learning_report_{timestamp}.json"
        
        report_data = {
            'report_date': datetime.now().isoformat(),
            'learning_summary': {
                'lessons_completed': len(lessons_completed),
                'lesson_list': lessons_completed,
                'calculations_performed': len(calculations_performed),
                'mastered_concepts': []
            },
            'calculation_examples': [],
            'recommendations': [],
            'next_steps': []
        }
        
        # 計算例追加
        for calc in calculations_performed:
            report_data['calculation_examples'].append({
                'statistic': calc.stat_name,
                'value': calc.value,
                'formula': calc.formula_used,
                'interpretation': calc.interpretation
            })
        
        # 推奨事項
        if 'basic_stats_introduction' in lessons_completed:
            report_data['recommendations'].append("中級コースへの進学を検討")
        
        report_data['next_steps'] = [
            "実際のプロ野球データで計算練習",
            "チーム分析レポート作成",
            "予測モデルの学習"
        ]
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"学習レポート保存: {filename}")
        return filename
    
    def visualize_learning_progress(self, progress_data: Dict[str, Any]) -> str:
        """学習進捗可視化"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle('Sabermetrics Learning Progress\nセイバーメトリクス学習進捗', 
                     fontsize=16, fontweight='bold')
        
        # 1. レッスン完了状況
        levels = ['beginner', 'intermediate', 'advanced']
        completed_by_level = [3, 2, 1]  # サンプルデータ
        total_by_level = [4, 5, 5]
        
        x = np.arange(len(levels))
        width = 0.35
        
        axes[0,0].bar(x - width/2, completed_by_level, width, label='完了', color='green', alpha=0.7)
        axes[0,0].bar(x + width/2, total_by_level, width, label='総数', color='lightgray', alpha=0.7)
        axes[0,0].set_title('レベル別レッスン進捗')
        axes[0,0].set_xlabel('レベル')
        axes[0,0].set_ylabel('レッスン数')
        axes[0,0].set_xticks(x)
        axes[0,0].set_xticklabels(['初級', '中級', '上級'])
        axes[0,0].legend()
        
        # 2. クイズスコア推移
        quiz_dates = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']
        scores = [60, 75, 80, 85, 90]
        
        axes[0,1].plot(quiz_dates, scores, 'o-', linewidth=2, markersize=8, color='blue')
        axes[0,1].set_title('クイズスコア推移')
        axes[0,1].set_xlabel('学習日')
        axes[0,1].set_ylabel('スコア (%)')
        axes[0,1].set_ylim(0, 100)
        axes[0,1].grid(True, alpha=0.3)
        
        # 3. 学習時間分布
        topics = ['基本統計', 'OPS', 'wOBA', 'FIP', 'WAR']
        study_times = [120, 90, 150, 100, 80]  # 分
        
        axes[1,0].pie(study_times, labels=topics, autopct='%1.1f%%', startangle=90)
        axes[1,0].set_title('トピック別学習時間')
        
        # 4. 理解度レーダーチャート
        skills = ['計算能力', '理論理解', '実践応用', '解釈力', '比較分析']
        proficiency = [85, 75, 65, 80, 70]
        
        angles = np.linspace(0, 2*np.pi, len(skills), endpoint=False)
        proficiency += proficiency[:1]
        angles = np.concatenate((angles, [angles[0]]))
        
        ax_radar = plt.subplot(2, 2, 4, projection='polar')
        ax_radar.plot(angles, proficiency, 'o-', linewidth=2, color='red')
        ax_radar.fill(angles, proficiency, alpha=0.1, color='red')
        ax_radar.set_xticks(angles[:-1])
        ax_radar.set_xticklabels(skills)
        ax_radar.set_ylim(0, 100)
        ax_radar.set_title('スキル習熟度', y=1.08)
        
        plt.tight_layout()
        
        filename = f'learning_progress_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"学習進捗可視化保存: {filename}")
        return filename

def main():
    """メイン実行"""
    learning_system = SabermetricsLearningSystem()
    
    print("="*80)
    print("SABERMETRICS LEARNING SYSTEM")
    print("セイバーメトリクス教育システム")
    print("="*80)
    
    print("\n1: 基礎レッスン受講")
    print("2: 統計計算練習")
    print("3: インタラクティブクイズ")
    print("4: 学習進捗確認")
    
    choice = input("選択してください (1-4): ").strip()
    
    if choice == '1':
        print("\n利用可能なレッスン:")
        print("1. セイバーメトリクス入門")
        print("2. 基本3指標：打率・出塁率・長打率")
        print("3. wOBA：重み付け出塁率")
        
        lesson_choice = input("レッスンを選択してください (1-3): ").strip()
        lesson_map = {
            '1': 'basic_stats_introduction',
            '2': 'understanding_avg_obp_slg', 
            '3': 'woba_calculation'
        }
        
        if lesson_choice in lesson_map:
            lesson = learning_system.create_lesson(lesson_map[lesson_choice])
            if lesson:
                interactive_lesson = learning_system.create_interactive_lesson(lesson)
                
                print(f"\n=== {lesson.title} ===")
                print(f"難易度: {lesson.difficulty_level}")
                print(f"説明: {lesson.description}")
                
                print(f"\n学習目標:")
                for concept in lesson.concepts:
                    print(f"  • {concept}")
                
                if lesson.formulas:
                    print(f"\n公式:")
                    for name, formula in lesson.formulas.items():
                        print(f"  {name}: {formula}")
                
                print(f"\n例題:")
                for example in lesson.examples:
                    print(f"  {example.get('scenario', '例題')}")
                    if 'explanation' in example:
                        print(f"    説明: {example['explanation']}")
    
    elif choice == '2':
        print("\n統計計算練習")
        print("サンプル選手データで各種指標を計算してみましょう")
        
        sample_data = {
            'AB': 500, 'H': 150, 'BB': 60, 'HBP': 5, 'SF': 4,
            '2B': 30, '3B': 2, 'HR': 25, '1B': 93, 'G': 140
        }
        
        print(f"\n選手データ:")
        for key, value in sample_data.items():
            print(f"  {key}: {value}")
        
        stats_to_calc = ['AVG', 'OBP', 'SLG', 'OPS', 'wOBA']
        calculations = []
        
        for stat in stats_to_calc:
            calc = learning_system.calculate_statistic(stat, sample_data)
            calculations.append(calc)
            
            print(f"\n{calc.stat_name}:")
            print(f"  計算式: {calc.formula_used}")
            print(f"  値: {calc.value}")
            print(f"  説明: {calc.explanation}")
            print(f"  評価: {calc.interpretation}")
            
            if calc.league_context:
                print(f"  リーグ比較:")
                for league, avg in calc.league_context.items():
                    print(f"    {league}: {avg}")
        
        # レポート作成
        report_file = learning_system.export_learning_report(
            ['understanding_avg_obp_slg'], calculations
        )
        print(f"\n学習レポート: {report_file}")
    
    elif choice == '3':
        lesson = learning_system.create_lesson('understanding_avg_obp_slg')
        if lesson and lesson.quiz_questions:
            print(f"\n=== クイズ: {lesson.title} ===")
            
            correct_answers = 0
            total_questions = len(lesson.quiz_questions)
            
            for i, question in enumerate(lesson.quiz_questions, 1):
                print(f"\n問題 {i}: {question['question']}")
                for option in question['options']:
                    print(f"  {option}")
                
                answer = input("答えを選択してください: ").strip().upper()
                
                if answer == question['correct']:
                    print("✓ 正解！")
                    print(f"解説: {question['explanation']}")
                    correct_answers += 1
                else:
                    print("✗ 不正解")
                    print(f"正解は {question['correct']} でした")
                    print(f"解説: {question['explanation']}")
            
            score = (correct_answers / total_questions) * 100
            print(f"\n結果: {correct_answers}/{total_questions} ({score:.1f}%)")
            
            if score >= 80:
                print("素晴らしい！次のレベルに進むことができます")
            elif score >= 60:
                print("良くできました。復習して理解を深めましょう")
            else:
                print("もう一度レッスンを受講することをお勧めします")
    
    elif choice == '4':
        progress_data = learning_system.create_progress_tracking()
        progress_data.update({
            'completed_lessons': ['basic_stats_introduction', 'understanding_avg_obp_slg'],
            'current_level': 'intermediate',
            'quiz_scores': {'basic_quiz': 85, 'ops_quiz': 90}
        })
        
        viz_file = learning_system.visualize_learning_progress(progress_data)
        
        print(f"\n=== 学習進捗 ===")
        print(f"現在のレベル: {progress_data['current_level']}")
        print(f"完了レッスン: {len(progress_data['completed_lessons'])}個")
        print(f"平均クイズスコア: {np.mean(list(progress_data['quiz_scores'].values())):.1f}%")
        print(f"\n進捗可視化: {viz_file}")

if __name__ == "__main__":
    main()