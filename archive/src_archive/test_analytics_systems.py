#!/usr/bin/env python3
"""
Analytics Systems Test Runner
分析システムテスト実行ツール
"""

import sys
from player_performance_predictor import PlayerPerformancePredictor
from team_strength_analyzer import TeamStrengthAnalyzer
from international_baseball_comparison import InternationalBaseballComparison
from career_trajectory_analyzer import CareerTrajectoryAnalyzer
from sabermetrics_learning_system import SabermetricsLearningSystem

def test_player_predictor():
    """選手予測システムテスト"""
    print("\n" + "="*60)
    print("選手パフォーマンス予測システム テスト")
    print("="*60)
    
    try:
        predictor = PlayerPerformancePredictor()
        
        # NPB選手の予測テスト（サンプル）
        predictions = predictor.batch_predict_league('npb', limit=10)
        
        print(f"✅ NPB選手予測テスト完了: {len(predictions)}名")
        
        for i, prediction in enumerate(predictions[:3], 1):
            print(f"\n{i}. {prediction.player_name} ({prediction.league}) - {prediction.prediction_type}")
            print(f"   予測統計:")
            for stat, value in list(prediction.predicted_stats.items())[:3]:
                print(f"     {stat}: {value}")
            print(f"   信頼度: {prediction.confidence_score:.3f}")
        
        # レポート生成
        if predictions:
            report_file = predictor.create_prediction_report(predictions)
            viz_file = predictor.visualize_predictions(predictions)
            print(f"\n📄 予測レポート: {report_file}")
            print(f"📊 可視化ファイル: {viz_file}")
        
        return True
        
    except Exception as e:
        print(f"❌ 選手予測システムエラー: {e}")
        return False

def test_team_analyzer():
    """チーム分析システムテスト"""
    print("\n" + "="*60)
    print("⚖️ チーム戦力分析システム テスト")
    print("="*60)
    
    try:
        analyzer = TeamStrengthAnalyzer()
        
        # NPBリーグ比較テスト
        comparison = analyzer.compare_teams('npb')
        
        print(f"✅ NPBチーム比較テスト完了: {len(comparison)}チーム")
        print("\n🏆 戦力ランキング TOP 5:")
        
        for i, (_, team) in enumerate(comparison.head(5).iterrows(), 1):
            print(f"{i}. {team['team']} - 総合戦力: {team['overall']:.1f}")
            print(f"   打撃: {team['batting']:.1f} | 投手: {team['pitching']:.1f} | 守備: {team['defense']:.1f}")
        
        # 可視化
        viz_file = analyzer.visualize_team_comparison('npb')
        print(f"\n📊 チーム比較可視化: {viz_file}")
        
        return True
        
    except Exception as e:
        print(f"❌ チーム分析システムエラー: {e}")
        return False

def test_international_comparison():
    """国際比較システムテスト"""
    print("\n" + "="*60)
    print("🌏 国際野球比較システム テスト")  
    print("="*60)
    
    try:
        comparator = InternationalBaseballComparison()
        
        # リーグ比較実行
        comparisons = comparator.compare_leagues()
        
        print(f"✅ 国際比較テスト完了: {len(comparisons)}項目")
        
        print("\n🏅 リーグ比較結果:")
        for comp in comparisons[:3]:
            print(f"\n【{comp.metric_name}】")
            print(f"  NPB: {comp.npb_value} | KBO: {comp.kbo_value} | MLB: {comp.mlb_value}")
            print(f"  リーダー: {comp.leader}")
            print(f"  分析: {comp.analysis}")
        
        # 類似性分析
        similarity = comparator.generate_similarity_analysis()
        print(f"\n🔗 リーグ類似性:")
        for pair, data in list(similarity.items())[:2]:
            print(f"  {pair.replace('_', ' vs ').upper()}: {data['score']:.3f}")
        
        # レポート・可視化
        report_file = comparator.create_comparison_report(comparisons, similarity)
        viz_file = comparator.visualize_international_comparison(comparisons)
        
        print(f"\n📄 比較レポート: {report_file}")
        print(f"📊 可視化ファイル: {viz_file}")
        
        return True
        
    except Exception as e:
        print(f"❌ 国際比較システムエラー: {e}")
        return False

def test_career_analyzer():
    """キャリア分析システムテスト"""
    print("\n" + "="*60)
    print("📈 キャリア軌跡分析システム テスト")
    print("="*60)
    
    try:
        analyzer = CareerTrajectoryAnalyzer()
        
        # パターン分析
        df = analyzer.load_career_data()
        if not df.empty:
            pattern_analysis = analyzer.cluster_career_patterns(df)
            
            print(f"✅ キャリアパターン分析完了: {len(pattern_analysis['patterns'])}パターン")
            
            print("\n🎯 キャリアパターン:")
            for pattern_name, pattern_info in list(pattern_analysis['patterns'].items())[:3]:
                print(f"  {pattern_name}: {pattern_info['player_count']}名")
            
            # 個別選手分析（最初の選手）
            if len(df) > 0:
                first_player_id = df.iloc[0]['player_id']
                trajectory = analyzer.analyze_player_trajectory(first_player_id)
                
                if trajectory:
                    print(f"\n👤 個別分析例: {trajectory.player_name}")
                    print(f"   キャリア段階: {trajectory.career_phase}")
                    print(f"   パターン: {trajectory.career_pattern}")
                    print(f"   軌跡スコア: {trajectory.trajectory_score}/100")
                    print(f"   予測残り年数: {trajectory.projected_remaining_years}年")
                    
                    # レポート・可視化
                    milestones = analyzer.analyze_milestones(first_player_id)
                    report_file = analyzer.create_trajectory_report(trajectory, milestones)
                    viz_file = analyzer.visualize_career_trajectory(first_player_id)
                    
                    print(f"\n📄 軌跡レポート: {report_file}")
                    print(f"📊 可視化ファイル: {viz_file}")
        else:
            print("⚠️ キャリアデータが不足しています")
        
        return True
        
    except Exception as e:
        print(f"❌ キャリア分析システムエラー: {e}")
        return False

def test_sabermetrics_learning():
    """セイバーメトリクス学習システムテスト"""
    print("\n" + "="*60)
    print("📚 セイバーメトリクス学習システム テスト")
    print("="*60)
    
    try:
        learning_system = SabermetricsLearningSystem()
        
        # レッスン作成テスト
        lesson = learning_system.create_lesson('basic_stats_introduction')
        if lesson:
            print(f"✅ レッスン作成テスト完了: {lesson.title}")
            print(f"   難易度: {lesson.difficulty_level}")
            print(f"   概念数: {len(lesson.concepts)}")
            print(f"   クイズ数: {len(lesson.quiz_questions)}")
        
        # 統計計算テスト
        sample_data = {
            'AB': 500, 'H': 150, 'BB': 60, 'HBP': 5, 'SF': 4,
            '2B': 30, '3B': 2, 'HR': 25, '1B': 93, 'G': 140
        }
        
        print(f"\n🧮 統計計算テスト:")
        stats_to_calc = ['AVG', 'OBP', 'SLG', 'OPS', 'wOBA']
        calculations = []
        
        for stat in stats_to_calc:
            calc = learning_system.calculate_statistic(stat, sample_data)
            calculations.append(calc)
            print(f"   {calc.stat_name}: {calc.value} ({calc.interpretation})")
        
        # レポート生成
        report_file = learning_system.export_learning_report(['basic_stats_introduction'], calculations)
        
        # 進捗可視化
        progress_data = learning_system.create_progress_tracking()
        viz_file = learning_system.visualize_learning_progress(progress_data)
        
        print(f"\n📄 学習レポート: {report_file}")
        print(f"📊 進捗可視化: {viz_file}")
        
        return True
        
    except Exception as e:
        print(f"❌ セイバーメトリクス学習システムエラー: {e}")
        return False

def main():
    """メインテスト実行"""
    print("🚀 野球分析システム統合テスト開始")
    print("="*80)
    
    test_results = []
    
    # 各システムをテスト
    systems = [
        ("選手予測システム", test_player_predictor),
        ("チーム分析システム", test_team_analyzer), 
        ("国際比較システム", test_international_comparison),
        ("キャリア分析システム", test_career_analyzer),
        ("学習システム", test_sabermetrics_learning)
    ]
    
    for system_name, test_func in systems:
        try:
            print(f"\n🧪 {system_name} テスト実行中...")
            result = test_func()
            test_results.append((system_name, result))
            
            if result:
                print(f"✅ {system_name} テスト成功")
            else:
                print(f"❌ {system_name} テスト失敗")
                
        except Exception as e:
            print(f"❌ {system_name} テスト例外: {e}")
            test_results.append((system_name, False))
    
    # 結果サマリー
    print("\n" + "="*80)
    print("📊 テスト結果サマリー")
    print("="*80)
    
    success_count = 0
    for system_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {system_name}")
        if result:
            success_count += 1
    
    print(f"\n🎯 総合結果: {success_count}/{len(test_results)} システムが正常動作")
    
    if success_count == len(test_results):
        print("🎉 全システム正常動作確認！")
    elif success_count > len(test_results) // 2:
        print("👍 大部分のシステムが動作しています")
    else:
        print("⚠️ 複数のシステムに問題があります")
    
    print("\n✨ 分析システムテスト完了")

if __name__ == "__main__":
    main()