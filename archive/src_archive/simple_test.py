#!/usr/bin/env python3
"""
Simple Analytics Test
簡単な分析システムテスト
"""

def test_player_predictor():
    """選手予測テスト"""
    print("\n" + "="*50)
    print("選手パフォーマンス予測システム テスト")
    print("="*50)
    
    try:
        from player_performance_predictor import PlayerPerformancePredictor
        predictor = PlayerPerformancePredictor()
        
        # NPB選手予測（少数）
        predictions = predictor.batch_predict_league('npb', limit=5)
        
        print(f"NPB選手予測完了: {len(predictions)}名")
        
        for prediction in predictions[:2]:
            print(f"- {prediction.player_name} ({prediction.league})")
            print(f"  予測タイプ: {prediction.prediction_type}")
            print(f"  信頼度: {prediction.confidence_score:.3f}")
        
        return True
        
    except Exception as e:
        print(f"エラー: {e}")
        return False

def test_team_analyzer():
    """チーム分析テスト"""
    print("\n" + "="*50)
    print("チーム戦力分析システム テスト")
    print("="*50)
    
    try:
        from team_strength_analyzer import TeamStrengthAnalyzer
        analyzer = TeamStrengthAnalyzer()
        
        # NPBチーム比較
        comparison = analyzer.compare_teams('npb')
        
        print(f"NPBチーム比較完了: {len(comparison)}チーム")
        
        if not comparison.empty:
            print("戦力ランキング TOP 3:")
            for i, (_, team) in enumerate(comparison.head(3).iterrows(), 1):
                print(f"{i}. {team['team']}: {team['overall']:.1f}点")
        
        return True
        
    except Exception as e:
        print(f"エラー: {e}")
        return False

def test_international_comparison():
    """国際比較テスト"""
    print("\n" + "="*50)
    print("国際野球比較システム テスト")
    print("="*50)
    
    try:
        from international_baseball_comparison import InternationalBaseballComparison
        comparator = InternationalBaseballComparison()
        
        # リーグ比較
        comparisons = comparator.compare_leagues()
        
        print(f"国際比較完了: {len(comparisons)}項目")
        
        for comp in comparisons[:2]:
            print(f"- {comp.metric_name}")
            print(f"  NPB: {comp.npb_value}, KBO: {comp.kbo_value}, MLB: {comp.mlb_value}")
            print(f"  リーダー: {comp.leader}")
        
        return True
        
    except Exception as e:
        print(f"エラー: {e}")
        return False

def test_sabermetrics_learning():
    """学習システムテスト"""
    print("\n" + "="*50)
    print("セイバーメトリクス学習システム テスト")
    print("="*50)
    
    try:
        from sabermetrics_learning_system import SabermetricsLearningSystem
        learning_system = SabermetricsLearningSystem()
        
        # 統計計算テスト
        sample_data = {
            'AB': 500, 'H': 150, 'BB': 60, 'HBP': 5, 'SF': 4,
            '2B': 30, '3B': 2, 'HR': 25, '1B': 93
        }
        
        print("統計計算テスト:")
        
        # 基本統計計算
        avg_calc = learning_system.calculate_statistic('AVG', sample_data)
        obp_calc = learning_system.calculate_statistic('OBP', sample_data)
        ops_calc = learning_system.calculate_statistic('OPS', sample_data)
        
        print(f"- 打率: {avg_calc.value} ({avg_calc.interpretation})")
        print(f"- 出塁率: {obp_calc.value} ({obp_calc.interpretation})")
        print(f"- OPS: {ops_calc.value} ({ops_calc.interpretation})")
        
        return True
        
    except Exception as e:
        print(f"エラー: {e}")
        return False

def main():
    """メインテスト"""
    print("野球分析システム 簡単テスト")
    print("="*60)
    
    tests = [
        ("選手予測システム", test_player_predictor),
        ("チーム分析システム", test_team_analyzer),
        ("国際比較システム", test_international_comparison),
        ("学習システム", test_sabermetrics_learning)
    ]
    
    results = []
    
    for name, test_func in tests:
        print(f"\n{name} テスト実行中...")
        try:
            result = test_func()
            results.append((name, result))
            
            if result:
                print(f"{name}: 成功")
            else:
                print(f"{name}: 失敗")
                
        except Exception as e:
            print(f"{name}: 例外 - {e}")
            results.append((name, False))
    
    # 結果サマリー
    print("\n" + "="*60)
    print("テスト結果")
    print("="*60)
    
    success_count = 0
    for name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{status}: {name}")
        if result:
            success_count += 1
    
    print(f"\n総合結果: {success_count}/{len(results)} システムが正常動作")
    
    if success_count == len(results):
        print("全システム正常動作確認！")
    elif success_count > 0:
        print("一部システムが動作しています")
    else:
        print("システムに問題があります")

if __name__ == "__main__":
    main()