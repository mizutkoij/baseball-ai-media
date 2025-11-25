/**
 * NPB Baseball AI - Live Feature Extraction
 * 
 * 機能:
 * - リアルタイムゲーム状況から特徴量を抽出
 * - プリゲーム特徴量との統合
 * - 状況変化量の計算
 * - バッチ予測用特徴量整備
 */

import { logger } from './logger';
import { getWinExpectancy, gameStateToWinExpectancyKey, type WinExpectancyKey } from './win-expectancy';
import type { GameState, LivePrediction } from './live-state';
// import type { PregameFeatures } from './predictor';

// 一時的な型定義（後でpredictor.tsから適切にインポート）
interface PregameFeatures {
  [key: string]: any;
}

export interface LiveFeatures {
  // ゲーム識別
  game_id: string;
  date: string;
  timestamp: string;
  event_index: number;
  
  // 現在状況
  inning: number;
  top: boolean;
  outs: 0 | 1 | 2;
  bases: number;
  home_score: number;
  away_score: number;
  score_diff: number;
  
  // 勝率期待値
  win_expectancy: number;
  run_expectancy: number;
  we_confidence: 'high' | 'medium' | 'low';
  
  // ゲーム進行度
  game_progress: number;        // 0.0-1.0 (イニング進行率)
  innings_remaining: number;    // 残りイニング数
  is_late_game: boolean;        // 7回以降
  is_close_game: boolean;       // 3点差以内
  is_extra_innings: boolean;    // 延長戦
  
  // モメンタム指標
  recent_score_change: number;  // 直近3イニングでの得点変化
  momentum_home: number;        // ホームチームのモメンタム (-1 to 1)
  momentum_away: number;        // アウェイチームのモメンタム (-1 to 1)
  
  // 状況変化 (前回状況との比較)
  situation_changed: boolean;
  inning_changed: boolean;
  score_changed: boolean;
  we_delta: number;             // 勝率期待値の変化
  impact_level: 'major' | 'moderate' | 'minor';
  
  // 統計的指標
  expected_final_score_home: number;
  expected_final_score_away: number;
  time_pressure_factor: number;  // 時間的プレッシャー係数
  
  // メタデータ
  feature_version: string;
  extraction_latency_ms: number;
}

export interface CombinedFeatures {
  // プリゲーム特徴量
  pregame: PregameFeatures;
  
  // ライブ特徴量
  live: LiveFeatures;
  
  // 統合指標
  game_context_shift: number;    // ゲーム文脈の変化度
  prediction_confidence: number; // 予測信頼度 (0.0-1.0)
  feature_completeness: number;  // 特徴量完全性 (0.0-1.0)
  
  // ウェイト計算用
  pregame_weight: number;        // プリゲーム予測の重み
  live_weight: number;           // ライブ予測の重み
  
  timestamp: string;
}

export class LiveFeatureExtractor {
  private previousStates = new Map<string, GameState>();
  private gameHistory = new Map<string, GameState[]>();
  
  constructor() {
    logger.info('LiveFeatureExtractor initialized');
  }

  /**
   * ゲーム状況からライブ特徴量を抽出
   */
  extract(gameState: GameState): LiveFeatures {
    const startTime = Date.now();
    
    logger.debug('Extracting live features', {
      gameId: gameState.gameId,
      inning: gameState.inning,
      situation: `${gameState.inning}${gameState.top ? '表' : '裏'} ${gameState.outs}死`
    });

    try {
      const features = this.buildLiveFeatures(gameState);
      
      // 履歴を更新
      this.updateGameHistory(gameState);
      
      features.extraction_latency_ms = Date.now() - startTime;
      
      logger.debug('Live features extracted', {
        gameId: gameState.gameId,
        featureCount: Object.keys(features).length,
        latency: features.extraction_latency_ms
      });
      
      return features;
      
    } catch (error) {
      logger.error('Failed to extract live features', {
        gameId: gameState.gameId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // フォールバック: 最小限の特徴量
      return this.createFallbackFeatures(gameState, Date.now() - startTime);
    }
  }

  /**
   * プリゲーム特徴量とライブ特徴量を統合
   */
  combine(
    pregameFeatures: PregameFeatures, 
    liveFeatures: LiveFeatures
  ): CombinedFeatures {
    logger.debug('Combining pregame and live features', {
      gameId: liveFeatures.game_id,
      pregameAvailable: !!pregameFeatures,
      liveProgress: liveFeatures.game_progress
    });

    // ゲーム進行度に基づく重み計算
    const weights = this.calculateFeatureWeights(liveFeatures.game_progress);
    
    // 文脈変化度の計算
    const contextShift = this.calculateContextShift(pregameFeatures, liveFeatures);
    
    // 予測信頼度の計算
    const predictionConfidence = this.calculatePredictionConfidence(liveFeatures, weights);
    
    return {
      pregame: pregameFeatures,
      live: liveFeatures,
      game_context_shift: contextShift,
      prediction_confidence: predictionConfidence,
      feature_completeness: this.calculateFeatureCompleteness(pregameFeatures, liveFeatures),
      pregame_weight: weights.pregame,
      live_weight: weights.live,
      timestamp: liveFeatures.timestamp
    };
  }

  /**
   * バッチ処理用の特徴量抽出
   */
  extractBatch(gameStates: GameState[]): LiveFeatures[] {
    logger.info('Extracting live features in batch', {
      gameCount: gameStates.length
    });

    const features: LiveFeatures[] = [];
    const startTime = Date.now();

    for (const gameState of gameStates) {
      try {
        features.push(this.extract(gameState));
      } catch (error) {
        logger.error('Batch feature extraction failed for game', {
          gameId: gameState.gameId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    logger.info('Batch feature extraction completed', {
      successful: features.length,
      failed: gameStates.length - features.length,
      totalTime: Date.now() - startTime
    });

    return features;
  }

  // プライベートメソッド

  private buildLiveFeatures(gameState: GameState): LiveFeatures {
    const scoreDiff = gameState.homeScore - gameState.awayScore;
    const previousState = this.previousStates.get(gameState.gameId);
    
    // 勝率期待値の計算
    const weKey = gameStateToWinExpectancyKey(gameState, scoreDiff);
    const winExpectancy = getWinExpectancy(weKey);
    
    // ゲーム進行度の計算
    const gameProgress = this.calculateGameProgress(gameState.inning, gameState.top);
    
    // モメンタム指標の計算
    const momentum = this.calculateMomentum(gameState);
    
    // 状況変化の検出
    const situationChange = this.detectSituationChange(previousState, gameState);
    
    return {
      // 基本情報
      game_id: gameState.gameId,
      date: gameState.date,
      timestamp: gameState.timestamp,
      event_index: gameState.eventIndex,
      
      // 現在状況
      inning: gameState.inning,
      top: gameState.top,
      outs: gameState.outs,
      bases: gameState.bases,
      home_score: gameState.homeScore,
      away_score: gameState.awayScore,
      score_diff: scoreDiff,
      
      // 勝率期待値
      win_expectancy: winExpectancy.home_win_probability,
      run_expectancy: winExpectancy.run_expectancy,
      we_confidence: winExpectancy.confidence,
      
      // ゲーム進行度
      game_progress: gameProgress,
      innings_remaining: Math.max(0, 9 - gameState.inning + (gameState.top ? 0.5 : 0)),
      is_late_game: gameState.inning >= 7,
      is_close_game: Math.abs(scoreDiff) <= 3,
      is_extra_innings: gameState.inning > 9,
      
      // モメンタム
      recent_score_change: momentum.recentScoreChange,
      momentum_home: momentum.home,
      momentum_away: momentum.away,
      
      // 状況変化
      situation_changed: situationChange.changed,
      inning_changed: situationChange.inningChanged,
      score_changed: situationChange.scoreChanged,
      we_delta: situationChange.weDelta,
      impact_level: situationChange.impactLevel,
      
      // 予測指標
      expected_final_score_home: this.estimateFinalScore(gameState, true),
      expected_final_score_away: this.estimateFinalScore(gameState, false),
      time_pressure_factor: this.calculateTimePressure(gameState),
      
      // メタデータ
      feature_version: '1.0.0',
      extraction_latency_ms: 0 // 後で設定
    };
  }

  private calculateGameProgress(inning: number, top: boolean): number {
    // 9回裏終了 = 1.0
    const baseProgress = (inning - 1) / 9;
    const halfInningBonus = top ? 0 : 0.5 / 9;
    return Math.min(1.0, baseProgress + halfInningBonus);
  }

  private calculateMomentum(gameState: GameState): {
    recentScoreChange: number;
    home: number;
    away: number;
  } {
    const history = this.gameHistory.get(gameState.gameId) || [];
    
    if (history.length < 2) {
      return {
        recentScoreChange: 0,
        home: 0,
        away: 0
      };
    }

    // 直近3イニングの得点変化を分析
    const recentStates = history.slice(-6); // 最大6半回分
    let homeScoreChange = 0;
    let awayScoreChange = 0;

    for (let i = 1; i < recentStates.length; i++) {
      homeScoreChange += recentStates[i].homeScore - recentStates[i-1].homeScore;
      awayScoreChange += recentStates[i].awayScore - recentStates[i-1].awayScore;
    }

    // モメンタムを-1から1の範囲で正規化
    const totalScoring = homeScoreChange + awayScoreChange;
    const homeMomentum = totalScoring > 0 ? homeScoreChange / (totalScoring + 1) * 2 - 1 : 0;
    const awayMomentum = totalScoring > 0 ? awayScoreChange / (totalScoring + 1) * 2 - 1 : 0;

    return {
      recentScoreChange: homeScoreChange - awayScoreChange,
      home: Math.max(-1, Math.min(1, homeMomentum)),
      away: Math.max(-1, Math.min(1, awayMomentum))
    };
  }

  private detectSituationChange(previous: GameState | undefined, current: GameState): {
    changed: boolean;
    inningChanged: boolean;
    scoreChanged: boolean;
    weDelta: number;
    impactLevel: 'major' | 'moderate' | 'minor';
  } {
    if (!previous) {
      return {
        changed: true,
        inningChanged: false,
        scoreChanged: false,
        weDelta: 0,
        impactLevel: 'minor'
      };
    }

    const inningChanged = previous.inning !== current.inning || previous.top !== current.top;
    const scoreChanged = previous.homeScore !== current.homeScore || previous.awayScore !== current.awayScore;
    const basesChanged = previous.bases !== current.bases || previous.outs !== current.outs;
    
    const changed = inningChanged || scoreChanged || basesChanged;

    // 勝率期待値の変化を計算
    let weDelta = 0;
    let impactLevel: 'major' | 'moderate' | 'minor' = 'minor';

    if (changed) {
      const previousWE = getWinExpectancy(gameStateToWinExpectancyKey(previous));
      const currentWE = getWinExpectancy(gameStateToWinExpectancyKey(current));
      weDelta = currentWE.home_win_probability - previousWE.home_win_probability;
      
      if (Math.abs(weDelta) >= 0.15) {
        impactLevel = 'major';
      } else if (Math.abs(weDelta) >= 0.05) {
        impactLevel = 'moderate';
      }
    }

    return {
      changed,
      inningChanged,
      scoreChanged,
      weDelta,
      impactLevel
    };
  }

  private estimateFinalScore(gameState: GameState, isHome: boolean): number {
    const currentScore = isHome ? gameState.homeScore : gameState.awayScore;
    const progress = this.calculateGameProgress(gameState.inning, gameState.top);
    
    // 残り時間での期待得点を加算
    const remainingProgress = 1.0 - progress;
    const averageRunsPerGame = 4.5; // NPB平均
    const expectedRemainingRuns = averageRunsPerGame * remainingProgress;
    
    return currentScore + expectedRemainingRuns;
  }

  private calculateTimePressure(gameState: GameState): number {
    // 後半イニング + 接戦 = 高プレッシャー
    const lateFactor = gameState.inning >= 7 ? 1.0 : 0.5;
    const closeFactor = Math.abs(gameState.homeScore - gameState.awayScore) <= 2 ? 1.0 : 0.3;
    const extraFactor = gameState.inning > 9 ? 1.5 : 1.0;
    
    return Math.min(2.0, lateFactor * closeFactor * extraFactor);
  }

  private calculateFeatureWeights(gameProgress: number): { pregame: number; live: number } {
    // ゲーム進行に伴い、プリゲーム重みを減らし、ライブ重みを増やす
    const liveWeight = Math.min(0.8, gameProgress * 1.2); // 最大80%
    const pregameWeight = 1.0 - liveWeight;
    
    return {
      pregame: pregameWeight,
      live: liveWeight
    };
  }

  private calculateContextShift(pregame: PregameFeatures, live: LiveFeatures): number {
    // プリゲーム予想と現実の状況変化度
    // これは簡易版で、実際には更に詳細な比較が可能
    const scoreShift = Math.abs(live.score_diff) / 10; // 得点差の変化
    const progressShift = live.game_progress; // 進行度
    
    return Math.min(1.0, (scoreShift + progressShift) / 2);
  }

  private calculatePredictionConfidence(live: LiveFeatures, weights: { pregame: number; live: number }): number {
    // WE信頼度とデータ完全性から予測信頼度を算出
    let confidence = 0.7; // ベース信頼度
    
    if (live.we_confidence === 'high') confidence += 0.2;
    else if (live.we_confidence === 'medium') confidence += 0.1;
    
    if (live.is_late_game) confidence += 0.1; // 後半は状況が明確
    
    return Math.min(0.95, confidence);
  }

  private calculateFeatureCompleteness(pregame: PregameFeatures, live: LiveFeatures): number {
    // 特徴量の完全性スコア
    const pregameScore = pregame ? 0.5 : 0;
    const liveScore = 0.5; // ライブ特徴量は常に利用可能
    
    return pregameScore + liveScore;
  }

  private updateGameHistory(gameState: GameState): void {
    if (!this.gameHistory.has(gameState.gameId)) {
      this.gameHistory.set(gameState.gameId, []);
    }
    
    const history = this.gameHistory.get(gameState.gameId)!;
    history.push(gameState);
    
    // 履歴は最大20エントリーに制限
    if (history.length > 20) {
      history.shift();
    }
    
    // 前回状態を更新
    this.previousStates.set(gameState.gameId, gameState);
  }

  private createFallbackFeatures(gameState: GameState, latency: number): LiveFeatures {
    // エラー時の最小限特徴量
    return {
      game_id: gameState.gameId,
      date: gameState.date,
      timestamp: gameState.timestamp,
      event_index: gameState.eventIndex,
      inning: gameState.inning,
      top: gameState.top,
      outs: gameState.outs,
      bases: gameState.bases,
      home_score: gameState.homeScore,
      away_score: gameState.awayScore,
      score_diff: gameState.homeScore - gameState.awayScore,
      win_expectancy: 0.5,
      run_expectancy: 0.5,
      we_confidence: 'low',
      game_progress: this.calculateGameProgress(gameState.inning, gameState.top),
      innings_remaining: 9 - gameState.inning,
      is_late_game: gameState.inning >= 7,
      is_close_game: Math.abs(gameState.homeScore - gameState.awayScore) <= 3,
      is_extra_innings: gameState.inning > 9,
      recent_score_change: 0,
      momentum_home: 0,
      momentum_away: 0,
      situation_changed: false,
      inning_changed: false,
      score_changed: false,
      we_delta: 0,
      impact_level: 'minor',
      expected_final_score_home: gameState.homeScore + 2,
      expected_final_score_away: gameState.awayScore + 2,
      time_pressure_factor: 1.0,
      feature_version: '1.0.0-fallback',
      extraction_latency_ms: latency
    };
  }

  /**
   * デバッグ用：抽出器の状態情報
   */
  getExtractorStatus(): any {
    return {
      trackedGames: this.previousStates.size,
      historyEntries: Array.from(this.gameHistory.entries()).reduce(
        (total, [gameId, history]) => total + history.length, 
        0
      ),
      memoryUsageMB: Math.round(
        (JSON.stringify(Array.from(this.previousStates) + JSON.stringify(Array.from(this.gameHistory))).length) 
        / 1024 / 1024 * 100
      ) / 100
    };
  }
}

// シングルトンインスタンス
let _liveFeatureExtractor: LiveFeatureExtractor | null = null;

export function getLiveFeatureExtractor(): LiveFeatureExtractor {
  if (!_liveFeatureExtractor) {
    _liveFeatureExtractor = new LiveFeatureExtractor();
  }
  return _liveFeatureExtractor;
}

/**
 * ユーティリティ関数：シンプルなライブ特徴量抽出
 */
export function extractLiveFeatures(gameState: GameState): LiveFeatures {
  return getLiveFeatureExtractor().extract(gameState);
}

export function combinePregameAndLiveFeatures(
  pregame: PregameFeatures, 
  live: LiveFeatures
): CombinedFeatures {
  return getLiveFeatureExtractor().combine(pregame, live);
}