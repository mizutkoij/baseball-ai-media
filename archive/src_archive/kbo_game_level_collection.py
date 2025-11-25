#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
kbo_game_level_collection.py
============================
KBO試合レベルデータ収集システム

試合基本情報から戦術データまでの包括的収集戦略
"""
import pandas as pd
import numpy as np
import json
import time
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class KBOGameLevelCollection:
    """KBO試合レベルデータ収集システム"""
    
    def __init__(self):
        """初期化"""
        print("[INIT] KBO Game Level Data Collection System")
        print("=" * 60)
        
        # 試合レベルデータ分類
        self.game_data_categories = {
            'basic_game_info': {
                'description': '基本試合情報（公式サイトで完全利用可能）',
                'priority': 'highest',
                'availability': {
                    'kbo_official': 'complete',
                    'statiz': 'available',
                    'mykbo_english': 'available'
                },
                'metrics': {
                    'game_date': {'format': 'YYYY-MM-DD', 'reliability': 'definitive'},
                    'game_time': {'format': 'HH:MM', 'reliability': 'definitive'},
                    'venue': {'format': 'stadium_name', 'reliability': 'definitive'},
                    'home_team': {'format': 'team_code', 'reliability': 'definitive'},
                    'away_team': {'format': 'team_code', 'reliability': 'definitive'},
                    'final_score': {'format': 'home_away_runs', 'reliability': 'definitive'},
                    'game_status': {'format': 'completed/suspended/postponed', 'reliability': 'definitive'}
                }
            },
            'environmental_data': {
                'description': '環境・コンディションデータ（KBO公式独占）',
                'priority': 'high',
                'availability': {
                    'kbo_official': 'complete',
                    'statiz': 'unavailable',
                    'mykbo_english': 'unavailable'
                },
                'metrics': {
                    'weather_condition': {'format': 'clear/cloudy/rain', 'reliability': 'definitive'},
                    'temperature': {'format': 'celsius', 'reliability': 'definitive'},
                    'humidity': {'format': 'percentage', 'reliability': 'definitive'},
                    'wind_speed': {'format': 'km_per_hour', 'reliability': 'limited'},
                    'wind_direction': {'format': 'cardinal_direction', 'reliability': 'limited'},
                    'attendance': {'format': 'number', 'reliability': 'definitive'},
                    'game_duration': {'format': 'minutes', 'reliability': 'definitive'}
                }
            },
            'inning_progression': {
                'description': 'イニング別進行データ',
                'priority': 'high',
                'availability': {
                    'kbo_official': 'complete',
                    'statiz': 'available',
                    'mykbo_english': 'limited'
                },
                'metrics': {
                    'inning_scores': {'format': 'inning_by_inning_array', 'reliability': 'definitive'},
                    'hits_by_inning': {'format': 'inning_by_inning_array', 'reliability': 'high'},
                    'errors_by_inning': {'format': 'inning_by_inning_array', 'reliability': 'high'},
                    'lob_by_inning': {'format': 'left_on_base_array', 'reliability': 'medium'},
                    'pitching_changes': {'format': 'pitcher_inning_mapping', 'reliability': 'high'}
                }
            },
            'tactical_events': {
                'description': '戦術的イベント（集計・分析要）',
                'priority': 'medium',
                'availability': {
                    'kbo_official': 'aggregation_required',
                    'statiz': 'available',
                    'mykbo_english': 'unavailable'
                },
                'metrics': {
                    'stolen_base_attempts': {'format': 'count_success_failure', 'reliability': 'high'},
                    'caught_stealing': {'format': 'count_by_runner', 'reliability': 'high'},
                    'sacrifice_bunts': {'format': 'count_success_failure', 'reliability': 'high'},
                    'sacrifice_flies': {'format': 'count_with_situation', 'reliability': 'high'},
                    'hit_and_run': {'format': 'attempts_and_outcomes', 'reliability': 'medium'},
                    'intentional_walks': {'format': 'count_with_situation', 'reliability': 'high'},
                    'double_plays': {'format': 'type_and_participants', 'reliability': 'high'},
                    'defensive_substitutions': {'format': 'timing_and_reason', 'reliability': 'medium'}
                }
            },
            'kbo_cultural_factors': {
                'description': 'KBO特有の文化的要因',
                'priority': 'medium',
                'availability': {
                    'kbo_official': 'partial',
                    'statiz': 'limited',
                    'mykbo_english': 'unavailable'
                },
                'metrics': {
                    'foreign_player_usage': {'format': 'innings_and_roles', 'reliability': 'medium'},
                    'crowd_energy_level': {'format': 'subjective_assessment', 'reliability': 'low'},
                    'fan_interference_events': {'format': 'count_and_impact', 'reliability': 'medium'},
                    'ceremonial_elements': {'format': 'opening_closing_events', 'reliability': 'low'},
                    'broadcast_viewership': {'format': 'tv_online_numbers', 'reliability': 'external_source'}
                }
            }
        }
        
        # 収集戦略マッピング
        self.collection_strategies = {
            'direct_scraping': {
                'applicable_to': ['basic_game_info', 'environmental_data', 'inning_progression'],
                'implementation': {
                    'primary_source': 'KBO.co.kr',
                    'method': 'structured_page_scraping',
                    'frequency': 'post_game',
                    'reliability': 'very_high'
                }
            },
            'aggregation_analysis': {
                'applicable_to': ['tactical_events'],
                'implementation': {
                    'primary_source': 'KBO.co.kr + STATIZ',
                    'method': 'play_by_play_aggregation',
                    'frequency': 'daily_batch',
                    'reliability': 'high'
                }
            },
            'custom_tracking': {
                'applicable_to': ['kbo_cultural_factors'],
                'implementation': {
                    'primary_source': 'multiple_sources',
                    'method': 'manual_observation_automation',
                    'frequency': 'selective_games',
                    'reliability': 'variable'
                }
            }
        }
    
    def assess_game_data_requirements(self, target_categories):
        """試合データ要件評価"""
        print(f"\n[ASSESSMENT] Evaluating game data requirements...")
        
        assessment = {
            'coverage_analysis': {},
            'source_mapping': {},
            'complexity_breakdown': {},
            'collection_feasibility': {}
        }
        
        # カバレッジ分析
        for category in target_categories:
            if category in self.game_data_categories:
                cat_data = self.game_data_categories[category]
                assessment['coverage_analysis'][category] = {
                    'metric_count': len(cat_data['metrics']),
                    'priority': cat_data['priority'],
                    'description': cat_data['description']
                }
        
        # ソースマッピング
        sources = ['kbo_official', 'statiz', 'mykbo_english']
        for source in sources:
            available_categories = []
            for category in target_categories:
                if category in self.game_data_categories:
                    availability = self.game_data_categories[category]['availability'].get(source, 'unavailable')
                    if availability != 'unavailable':
                        available_categories.append({
                            'category': category,
                            'availability': availability
                        })
            assessment['source_mapping'][source] = available_categories
        
        # 複雑さ分析
        complexity_levels = {
            'low': [],
            'medium': [],
            'high': [],
            'very_high': []
        }
        
        for category in target_categories:
            if category in self.game_data_categories:
                availability = self.game_data_categories[category]['availability']
                if 'complete' in availability.values():
                    complexity_levels['low'].append(category)
                elif 'aggregation_required' in availability.values():
                    complexity_levels['high'].append(category)
                elif 'partial' in availability.values():
                    complexity_levels['medium'].append(category)
                else:
                    complexity_levels['very_high'].append(category)
        
        assessment['complexity_breakdown'] = complexity_levels
        
        # 実現可能性評価
        for category in target_categories:
            if category in self.game_data_categories:
                cat_data = self.game_data_categories[category]
                feasibility_score = self._calculate_feasibility_score(cat_data)
                assessment['collection_feasibility'][category] = {
                    'score': feasibility_score,
                    'rating': self._get_feasibility_rating(feasibility_score)
                }
        
        return assessment
    
    def _calculate_feasibility_score(self, category_data):
        """実現可能性スコア計算"""
        score = 0
        
        # 可用性スコア
        availability = category_data['availability']
        if 'complete' in availability.values():
            score += 30
        elif 'available' in availability.values():
            score += 20
        elif 'partial' in availability.values():
            score += 10
        
        # 優先度スコア
        priority = category_data['priority']
        if priority == 'highest':
            score += 25
        elif priority == 'high':
            score += 20
        elif priority == 'medium':
            score += 15
        elif priority == 'low':
            score += 10
        
        # 信頼性スコア
        reliability_scores = []
        for metric_data in category_data['metrics'].values():
            if metric_data['reliability'] == 'definitive':
                reliability_scores.append(5)
            elif metric_data['reliability'] == 'high':
                reliability_scores.append(4)
            elif metric_data['reliability'] == 'medium':
                reliability_scores.append(3)
            elif metric_data['reliability'] == 'limited':
                reliability_scores.append(2)
            else:
                reliability_scores.append(1)
        
        if reliability_scores:
            score += np.mean(reliability_scores) * 9  # Max 45 points
        
        return min(score, 100)
    
    def _get_feasibility_rating(self, score):
        """実現可能性評価"""
        if score >= 80:
            return 'Excellent'
        elif score >= 60:
            return 'Good'
        elif score >= 40:
            return 'Fair'
        else:
            return 'Challenging'
    
    def design_collection_pipeline(self, target_categories):
        """収集パイプライン設計"""
        print(f"\n[PIPELINE] Designing game-level collection pipeline...")
        
        assessment = self.assess_game_data_requirements(target_categories)
        
        pipeline = {
            'phase_1_immediate': {
                'timeline': 'Week 1-2',
                'target': 'Basic game information',
                'categories': assessment['complexity_breakdown']['low'],
                'implementation': {
                    'primary_source': 'KBO.co.kr',
                    'method': 'Direct scraping',
                    'automation_level': 'Full',
                    'expected_success': '95%'
                }
            },
            'phase_2_structured': {
                'timeline': 'Week 3-4',
                'target': 'Environmental and progression data',
                'categories': assessment['complexity_breakdown']['medium'],
                'implementation': {
                    'primary_source': 'KBO.co.kr + validation',
                    'method': 'Structured extraction',
                    'automation_level': 'High',
                    'expected_success': '85%'
                }
            },
            'phase_3_analytical': {
                'timeline': 'Week 5-6',
                'target': 'Tactical events and aggregations',
                'categories': assessment['complexity_breakdown']['high'],
                'implementation': {
                    'primary_source': 'KBO.co.kr + STATIZ',
                    'method': 'Analysis and aggregation',
                    'automation_level': 'Medium',
                    'expected_success': '70%'
                }
            },
            'phase_4_experimental': {
                'timeline': 'Week 7+',
                'target': 'Cultural factors and custom metrics',
                'categories': assessment['complexity_breakdown']['very_high'],
                'implementation': {
                    'primary_source': 'Multiple sources',
                    'method': 'Custom development',
                    'automation_level': 'Low',
                    'expected_success': '50%'
                }
            }
        }
        
        # データ品質保証
        pipeline['quality_assurance'] = {
            'validation_rules': {
                'date_format': 'ISO 8601 compliance',
                'score_consistency': 'Inning totals match final score',
                'attendance_bounds': 'Stadium capacity validation',
                'weather_logic': 'Temperature/humidity correlation'
            },
            'cross_validation': {
                'multiple_sources': 'When available',
                'historical_patterns': 'Anomaly detection',
                'manual_spot_checks': 'Random sampling'
            },
            'data_completeness': {
                'minimum_threshold': '90% of expected fields',
                'missing_data_handling': 'Interpolation or flagging',
                'update_frequency': 'Post-game immediate'
            }
        }
        
        return pipeline
    
    def create_kbo_specific_collectors(self):
        """KBO特有コレクター作成"""
        print(f"\n[COLLECTORS] Creating KBO-specific data collectors...")
        
        collectors = {
            'environmental_collector': {
                'description': 'Weather and stadium condition collector',
                'target_url_pattern': 'https://www.kbo.co.kr/Game/CatcherBox.aspx?gameId={game_id}',
                'extraction_points': {
                    'weather': 'div.weather-info',
                    'temperature': 'span.temp-value',
                    'humidity': 'span.humidity-value', 
                    'attendance': 'div.attendance-count'
                },
                'parsing_strategy': 'CSS selector + regex',
                'update_frequency': 'Post-game',
                'reliability': 'Very High'
            },
            'tactical_aggregator': {
                'description': 'Tactical event aggregation from play-by-play',
                'target_url_pattern': 'https://www.kbo.co.kr/Game/PlayByPlay.aspx?gameId={game_id}',
                'extraction_points': {
                    'stolen_bases': 'event-type="SB"',
                    'sacrifice_bunts': 'event-type="SH"',
                    'double_plays': 'event-type="DP"',
                    'substitutions': 'event-type="SUB"'
                },
                'parsing_strategy': 'Event parsing + aggregation',
                'update_frequency': 'Daily batch',
                'reliability': 'High'
            },
            'cultural_tracker': {
                'description': 'KBO cultural factor tracking',
                'target_sources': [
                    'KBO.co.kr game reports',
                    'Team official websites',
                    'Sports news outlets'
                ],
                'extraction_points': {
                    'foreign_player_impact': 'Player stats + nationality',
                    'fan_events': 'News reports + social media',
                    'ceremonial_elements': 'Game reports + photos'
                },
                'parsing_strategy': 'Multi-source aggregation',
                'update_frequency': 'Weekly analysis',
                'reliability': 'Variable'
            }
        }
        
        # 技術仕様
        collectors['technical_specifications'] = {
            'rate_limiting': {
                'base_delay': 2,
                'game_data_delay': 5,
                'respect_peak_hours': True
            },
            'error_handling': {
                'retry_attempts': 3,
                'exponential_backoff': True,
                'graceful_degradation': True
            },
            'data_storage': {
                'format': 'JSON + SQLite',
                'backup_frequency': 'Daily',
                'compression': 'gzip for historical data'
            }
        }
        
        return collectors
    
    def generate_game_collection_report(self, target_categories):
        """試合収集レポート生成"""
        print(f"\n[REPORT] Generating game-level collection report...")
        
        assessment = self.assess_game_data_requirements(target_categories)
        pipeline = self.design_collection_pipeline(target_categories)
        collectors = self.create_kbo_specific_collectors()
        
        report = {
            'executive_summary': {
                'target_categories': len(target_categories),
                'total_metrics': sum(len(self.game_data_categories[cat]['metrics']) 
                                   for cat in target_categories 
                                   if cat in self.game_data_categories),
                'high_feasibility': len([cat for cat in target_categories 
                                       if assessment['collection_feasibility'].get(cat, {}).get('rating') in ['Excellent', 'Good']]),
                'kbo_exclusive_data': ['environmental_data'],
                'implementation_complexity': 'Medium to High'
            },
            'detailed_assessment': assessment,
            'collection_pipeline': pipeline,
            'specialized_collectors': collectors,
            'success_factors': {
                'kbo_official_access': 'Critical for environmental data',
                'consistent_scraping': 'Essential for game progression',
                'tactical_analysis': 'Requires aggregation expertise',
                'cultural_insights': 'Needs manual curation'
            },
            'deliverables_timeline': {
                'week_2': 'Basic game info collection (Date, Score, Venue)',
                'week_4': 'Environmental data integration (Weather, Attendance)',
                'week_6': 'Tactical event tracking (SB, Bunts, DP)',
                'week_8': 'Cultural factor analysis (Foreign players, Fan culture)'
            }
        }
        
        return report

def main():
    """メイン実行関数"""
    print("=" * 70)
    print("KBO Game Level Data Collection System")
    print("試合レベルデータ包括収集戦略")
    print("=" * 70)
    
    # システム初期化
    game_collection = KBOGameLevelCollection()
    
    # 対象カテゴリ
    target_categories = [
        'basic_game_info',
        'environmental_data', 
        'inning_progression',
        'tactical_events',
        'kbo_cultural_factors'
    ]
    
    print(f"\n[INPUT] Target categories: {len(target_categories)} categories")
    
    # 要件評価
    assessment = game_collection.assess_game_data_requirements(target_categories)
    
    # 結果表示
    print(f"\n[ASSESSMENT] Collection Feasibility:")
    for category, data in assessment['collection_feasibility'].items():
        print(f"  {category}: {data['rating']} ({data['score']:.0f}/100)")
    
    print(f"\n[COMPLEXITY] Implementation Complexity:")
    for level, categories in assessment['complexity_breakdown'].items():
        print(f"  {level}: {len(categories)} categories")
    
    # 包括的レポート生成
    comprehensive_report = game_collection.generate_game_collection_report(target_categories)
    
    print(f"\n[PIPELINE] Implementation Timeline:")
    for phase, details in comprehensive_report['collection_pipeline'].items():
        if phase != 'quality_assurance':
            print(f"  {phase}: {details['timeline']} - {len(details['categories'])} categories")
    
    print(f"\n[SUCCESS] Game Level Collection Strategy Complete!")
    print(f"[METRICS] {comprehensive_report['executive_summary']['total_metrics']} total metrics")
    print(f"[FEASIBILITY] {comprehensive_report['executive_summary']['high_feasibility']}/{len(target_categories)} high feasibility")
    print("=" * 70)

if __name__ == "__main__":
    main()