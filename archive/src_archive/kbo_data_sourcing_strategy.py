#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
kbo_data_sourcing_strategy.py
============================
KBOデータソーシング戦略システム

データ可用性マトリックス基づく最適化収集計画
"""
import pandas as pd
import numpy as np
import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class KBODataSourcingStrategy:
    """KBOデータソーシング戦略システム"""
    
    def __init__(self):
        """初期化"""
        print("[INIT] KBO Data Sourcing Strategy System")
        print("=" * 60)
        
        # データ可用性マトリックス
        self.availability_matrix = {
            # チーム基本統計
            'team_basic_stats': {
                'AVG': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'low', 'reliability': 'high'}
                },
                'OBP': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'low', 'reliability': 'high'}
                },
                'SLG': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'low', 'reliability': 'high'}
                },
                'ERA': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'low', 'reliability': 'high'}
                },
                'WHIP': {
                    'kbo_official': {'available': True, 'method': 'calculated', 'difficulty': 'low', 'reliability': 'high'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'low', 'reliability': 'high'}
                }
            },
            # 個人選手統計
            'player_stats': {
                'OPS': {
                    'kbo_official': {'available': True, 'method': 'calculated', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'low', 'reliability': 'high'}
                },
                'WAR': {
                    'kbo_official': {'available': False, 'method': None, 'difficulty': None, 'reliability': None},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'high', 'reliability': 'definitive'},
                    'mykbo_english': {'available': False, 'method': None, 'difficulty': None, 'reliability': None}
                },
                'wRC+': {
                    'kbo_official': {'available': False, 'method': None, 'difficulty': None, 'reliability': None},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'high', 'reliability': 'definitive'},
                    'mykbo_english': {'available': False, 'method': None, 'difficulty': None, 'reliability': None}
                },
                'FIP': {
                    'kbo_official': {'available': False, 'method': None, 'difficulty': None, 'reliability': None},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'high', 'reliability': 'definitive'},
                    'mykbo_english': {'available': False, 'method': None, 'difficulty': None, 'reliability': None}
                }
            },
            # 試合レベルデータ
            'game_level_data': {
                'schedule_venue': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'low', 'reliability': 'high'}
                },
                'weather': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': False, 'method': None, 'difficulty': None, 'reliability': None},
                    'mykbo_english': {'available': False, 'method': None, 'difficulty': None, 'reliability': None}
                },
                'attendance': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': False, 'method': None, 'difficulty': None, 'reliability': None},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'limited'}
                },
                'inning_scores': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'limited'}
                },
                'stolen_base_attempts': {
                    'kbo_official': {'available': True, 'method': 'aggregation_required', 'difficulty': 'high', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': False, 'method': None, 'difficulty': None, 'reliability': None}
                }
            },
            # 守備データ（「守備データギャップ」対応）
            'defensive_data': {
                'fielding_percentage': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'low', 'reliability': 'high'}
                },
                'errors': {
                    'kbo_official': {'available': True, 'method': 'direct', 'difficulty': 'low', 'reliability': 'definitive'},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'medium', 'reliability': 'high'},
                    'mykbo_english': {'available': True, 'method': 'scraping', 'difficulty': 'low', 'reliability': 'high'}
                },
                'UZR': {
                    'kbo_official': {'available': False, 'method': None, 'difficulty': None, 'reliability': None},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'high', 'reliability': 'definitive'},
                    'mykbo_english': {'available': False, 'method': None, 'difficulty': None, 'reliability': None}
                },
                'DRS': {
                    'kbo_official': {'available': False, 'method': None, 'difficulty': None, 'reliability': None},
                    'statiz': {'available': True, 'method': 'scraping', 'difficulty': 'high', 'reliability': 'definitive'},
                    'mykbo_english': {'available': False, 'method': None, 'difficulty': None, 'reliability': None}
                }
            }
        }
        
        # ソース特性
        self.source_characteristics = {
            'kbo_official': {
                'url': 'https://www.kbo.co.kr',
                'language': 'korean',
                'api_available': False,
                'scraping_difficulty': 'medium',
                'legal_risk': 'low',
                'data_completeness': 85,
                'update_frequency': 'real_time',
                'strengths': ['公式データ', '天候・観客数', '完全な試合データ'],
                'weaknesses': ['高度な指標なし', '韓国語のみ', 'API無し']
            },
            'statiz': {
                'url': 'http://www.statiz.co.kr',
                'language': 'korean',
                'api_available': False,
                'scraping_difficulty': 'high',
                'legal_risk': 'medium',
                'data_completeness': 95,
                'update_frequency': 'daily',
                'strengths': ['WAR・wRC+等高度指標', '守備指標', '詳細分析'],
                'weaknesses': ['スクレイピング必須', '法的リスク', '過去の閉鎖歴']
            },
            'mykbo_english': {
                'url': 'https://mykbo.net/en',
                'language': 'english',
                'api_available': False,
                'scraping_difficulty': 'low',
                'legal_risk': 'low',
                'data_completeness': 70,
                'update_frequency': 'daily',
                'strengths': ['英語対応', '初心者向け', '安定性'],
                'weaknesses': ['限定的データ', '高度指標なし', '詳細度不足']
            }
        }
    
    def analyze_data_requirements(self, required_metrics):
        """データ要件分析"""
        print(f"\n[ANALYSIS] Analyzing data requirements for {len(required_metrics)} metrics...")
        
        analysis_result = {
            'critical_dependencies': {},
            'source_coverage': {},
            'risk_assessment': {},
            'recommended_strategy': {}
        }
        
        # 各メトリクスの分析
        for metric in required_metrics:
            metric_analysis = self._analyze_single_metric(metric)
            if metric_analysis:
                analysis_result['critical_dependencies'][metric] = metric_analysis
        
        # ソース別カバレッジ分析
        for source in ['kbo_official', 'statiz', 'mykbo_english']:
            coverage = self._calculate_source_coverage(source, required_metrics)
            analysis_result['source_coverage'][source] = coverage
        
        # リスク評価
        analysis_result['risk_assessment'] = self._assess_collection_risks(required_metrics)
        
        # 推奨戦略
        analysis_result['recommended_strategy'] = self._generate_collection_strategy(required_metrics)
        
        return analysis_result
    
    def _analyze_single_metric(self, metric):
        """単一メトリクス分析"""
        # メトリクスを各カテゴリから検索
        for category, metrics in self.availability_matrix.items():
            if metric in metrics:
                return {
                    'category': category,
                    'sources': metrics[metric],
                    'best_source': self._find_best_source(metrics[metric]),
                    'backup_sources': self._find_backup_sources(metrics[metric])
                }
        return None
    
    def _find_best_source(self, source_data):
        """最適ソース特定"""
        scores = {}
        for source, data in source_data.items():
            if data['available']:
                score = 0
                if data['reliability'] == 'definitive':
                    score += 10
                elif data['reliability'] == 'high':
                    score += 7
                
                if data['difficulty'] == 'low':
                    score += 5
                elif data['difficulty'] == 'medium':
                    score += 3
                elif data['difficulty'] == 'high':
                    score += 1
                
                scores[source] = score
        
        return max(scores.items(), key=lambda x: x[1])[0] if scores else None
    
    def _find_backup_sources(self, source_data):
        """バックアップソース特定"""
        available_sources = [
            source for source, data in source_data.items() 
            if data['available']
        ]
        best_source = self._find_best_source(source_data)
        return [s for s in available_sources if s != best_source]
    
    def _calculate_source_coverage(self, source, required_metrics):
        """ソース別カバレッジ計算"""
        total_metrics = len(required_metrics)
        covered_metrics = 0
        
        for metric in required_metrics:
            metric_data = self._analyze_single_metric(metric)
            if metric_data and metric_data['sources'].get(source, {}).get('available', False):
                covered_metrics += 1
        
        return {
            'coverage_percentage': (covered_metrics / total_metrics) * 100 if total_metrics > 0 else 0,
            'covered_count': covered_metrics,
            'total_count': total_metrics
        }
    
    def _assess_collection_risks(self, required_metrics):
        """収集リスク評価"""
        risks = {
            'high_difficulty_metrics': [],
            'single_source_dependencies': [],
            'legal_risk_sources': [],
            'reliability_concerns': []
        }
        
        for metric in required_metrics:
            metric_data = self._analyze_single_metric(metric)
            if metric_data:
                available_sources = [
                    source for source, data in metric_data['sources'].items()
                    if data['available']
                ]
                
                # 単一ソース依存リスク
                if len(available_sources) == 1:
                    risks['single_source_dependencies'].append({
                        'metric': metric,
                        'source': available_sources[0]
                    })
                
                # 高難易度メトリクス
                if metric_data['best_source'] and metric_data['sources'][metric_data['best_source']]['difficulty'] == 'high':
                    risks['high_difficulty_metrics'].append(metric)
        
        # 法的リスクソース
        for source, characteristics in self.source_characteristics.items():
            if characteristics['legal_risk'] in ['medium', 'high']:
                risks['legal_risk_sources'].append(source)
        
        return risks
    
    def _generate_collection_strategy(self, required_metrics):
        """収集戦略生成"""
        strategy = {
            'phase_1_foundation': {
                'target': 'mykbo_english',
                'metrics': [],
                'rationale': '英語対応、低リスク、プロトタイピング用'
            },
            'phase_2_official': {
                'target': 'kbo_official',
                'metrics': [],
                'rationale': '公式データ、高信頼性、基本統計'
            },
            'phase_3_advanced': {
                'target': 'statiz',
                'metrics': [],
                'rationale': '高度指標、詳細分析、完全性'
            }
        }
        
        for metric in required_metrics:
            metric_data = self._analyze_single_metric(metric)
            if metric_data:
                best_source = metric_data['best_source']
                
                if best_source == 'mykbo_english':
                    strategy['phase_1_foundation']['metrics'].append(metric)
                elif best_source == 'kbo_official':
                    strategy['phase_2_official']['metrics'].append(metric)
                elif best_source == 'statiz':
                    strategy['phase_3_advanced']['metrics'].append(metric)
        
        return strategy
    
    def create_implementation_roadmap(self, required_metrics):
        """実装ロードマップ作成"""
        print(f"\n[ROADMAP] Creating implementation roadmap...")
        
        analysis = self.analyze_data_requirements(required_metrics)
        
        roadmap = {
            'timeline': {
                'week_1_2': {
                    'phase': 'Foundation & Proof of Concept',
                    'target_source': 'mykbo_english',
                    'objectives': [
                        '英語サイトでの技術検証',
                        '基本的なスクレイピング実装',
                        'データ品質確認',
                        '初期プロトタイプ構築'
                    ],
                    'deliverables': [
                        'MyKBO.net scraper',
                        'Basic data pipeline',
                        'Quality validation framework'
                    ]
                },
                'week_3_4': {
                    'phase': 'Official Source Integration',
                    'target_source': 'kbo_official',
                    'objectives': [
                        'KBO.co.kr 기록실への対応',
                        '韓国語テキスト処理実装',
                        '公式データパイプライン構築',
                        'Rate limiting & 法的遵守'
                    ],
                    'deliverables': [
                        'KBO official scraper',
                        'Korean text processing',
                        'Compliance framework'
                    ]
                },
                'week_5_6': {
                    'phase': 'Advanced Metrics Collection',
                    'target_source': 'statiz',
                    'objectives': [
                        'STATIZ高度指標取得',
                        '守備データギャップ解決',
                        'WAR・wRC+等の収集',
                        'バックアップ戦略実装'
                    ],
                    'deliverables': [
                        'STATIZ scraper',
                        'Advanced metrics pipeline',
                        'Defensive data collection'
                    ]
                },
                'week_7_8': {
                    'phase': 'Integration & Validation',
                    'target_source': 'all_sources',
                    'objectives': [
                        '全ソース統合',
                        'クロス検証実装',
                        'データ品質保証',
                        '国際比較準備'
                    ],
                    'deliverables': [
                        'Unified data pipeline',
                        'Cross-validation system',
                        'International comparison dataset'
                    ]
                }
            },
            'risk_mitigation': {
                'single_source_dependencies': '複数ソースでの検証実装',
                'legal_risks': '学術目的明示、robots.txt遵守',
                'technical_difficulties': '段階的実装、フォールバック機構',
                'data_quality': 'クロス検証、異常値検出'
            },
            'success_metrics': {
                'data_coverage': '>90% of required metrics',
                'data_quality': '<5% discrepancy between sources',
                'update_frequency': 'Daily automated updates',
                'system_reliability': '>95% uptime'
            }
        }
        
        return roadmap
    
    def generate_sourcing_report(self, required_metrics):
        """ソーシングレポート生成"""
        print(f"\n[REPORT] Generating comprehensive sourcing report...")
        
        analysis = self.analyze_data_requirements(required_metrics)
        roadmap = self.create_implementation_roadmap(required_metrics)
        
        report = {
            'executive_summary': {
                'total_metrics': len(required_metrics),
                'fully_available': len([m for m in required_metrics if self._analyze_single_metric(m)]),
                'primary_challenges': [
                    '守備データギャップ',
                    'STATIZ依存の高度指標',
                    '韓国語処理要件'
                ],
                'recommended_approach': '3段階実装戦略'
            },
            'detailed_analysis': analysis,
            'implementation_roadmap': roadmap,
            'source_comparison': self.source_characteristics,
            'data_matrix': self.availability_matrix
        }
        
        return report

def main():
    """メイン実行関数"""
    print("=" * 70)
    print("KBO Data Sourcing Strategy System")
    print("データ可用性マトリックス基づく最適化収集計画")
    print("=" * 70)
    
    # システム初期化
    sourcing_system = KBODataSourcingStrategy()
    
    # 必要メトリクス定義（例）
    required_metrics = [
        'AVG', 'OBP', 'SLG', 'OPS', 'WAR', 'wRC+', 'FIP',
        'ERA', 'WHIP', 'schedule_venue', 'weather', 'attendance',
        'inning_scores', 'stolen_base_attempts', 'fielding_percentage',
        'UZR', 'DRS'
    ]
    
    print(f"\n[INPUT] Required metrics: {len(required_metrics)} items")
    
    # 分析実行
    analysis = sourcing_system.analyze_data_requirements(required_metrics)
    
    # 結果表示
    print(f"\n[RESULTS] Source Coverage Analysis:")
    for source, coverage in analysis['source_coverage'].items():
        print(f"  {source}: {coverage['coverage_percentage']:.1f}% ({coverage['covered_count']}/{coverage['total_count']})")
    
    # リスク評価表示
    print(f"\n[RISKS] Critical Dependencies:")
    for dep in analysis['risk_assessment']['single_source_dependencies']:
        print(f"  {dep['metric']} -> {dep['source']}")
    
    # 推奨戦略表示
    print(f"\n[STRATEGY] Recommended Implementation:")
    for phase, details in analysis['recommended_strategy'].items():
        print(f"  {phase}: {details['target']} ({len(details['metrics'])} metrics)")
    
    # 包括的レポート生成
    comprehensive_report = sourcing_system.generate_sourcing_report(required_metrics)
    
    print(f"\n[SUCCESS] KBO Data Sourcing Strategy Complete!")
    print(f"[COVERAGE] {comprehensive_report['executive_summary']['fully_available']}/{comprehensive_report['executive_summary']['total_metrics']} metrics available")
    print(f"[APPROACH] {comprehensive_report['executive_summary']['recommended_approach']}")
    print("=" * 70)

if __name__ == "__main__":
    main()