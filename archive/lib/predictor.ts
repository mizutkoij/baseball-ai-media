/**
 * NPB Baseball AI - Prediction Service
 * 
 * 機能:
 * - ONNX Runtime による高速推論
 * - プリゲーム勝率予測
 * - ライブ勝率予測（将来拡張用）
 * - 確率キャリブレーション（0.05-0.95 クリッピング）
 * - バッチ予測対応
 */

import { InferenceSession, Tensor } from 'onnxruntime-node';
import { logger } from './logger';
import { incrementCounter, recordHistogram } from './prometheus-metrics';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ModelMetadata {
  model_name: string;
  model_type: 'binary_classification' | 'regression';
  target_column: string;
  created_at: string;
  preprocessing: {
    categorical_encoders: Record<string, { classes: string[] }>;
    feature_columns: string[];
    excluded_features: string[];
  };
  input_schema: {
    input_name: string;
    output_name: string;
    feature_count: number;
    feature_names: string[];
  };
  calibration: {
    enabled: boolean;
    min_probability: number;
    max_probability: number;
  };
  evaluation_metrics: {
    accuracy: number;
    auc_score: number;
    log_loss: number;
    brier_score: number;
  };
}

export interface PregameFeatures {
  home_team: string;
  away_team: string;
  venue: string;
  home_win_rate_30: number;
  away_win_rate_30: number;
  home_runs_scored_avg_30: number;
  away_runs_scored_avg_30: number;
  home_runs_allowed_avg_30: number;
  away_runs_allowed_avg_30: number;
  home_run_differential_30: number;
  away_run_differential_30: number;
  home_win_rate_10: number;
  away_win_rate_10: number;
  home_runs_scored_avg_10: number;
  away_runs_scored_avg_10: number;
  home_runs_allowed_avg_10: number;
  away_runs_allowed_avg_10: number;
  home_pitcher_era: number;
  away_pitcher_era: number;
  home_pitcher_whip: number;
  away_pitcher_whip: number;
  home_pitcher_wins: number;
  away_pitcher_wins: number;
  home_pitcher_losses: number;
  away_pitcher_losses: number;
  home_pitcher_games_started: number;
  away_pitcher_games_started: number;
  home_pitcher_innings_pitched: number;
  away_pitcher_innings_pitched: number;
  home_pitcher_era_5: number;
  away_pitcher_era_5: number;
  home_pitcher_days_rest: number;
  away_pitcher_days_rest: number;
  venue_home_advantage: number;
  venue_scoring_factor: number;
  head_to_head_home_wins: number;
  head_to_head_total_games: number;
  season_game_number: number;
  home_games_in_last_7_days: number;
  away_games_in_last_7_days: number;
  is_weekend: number;
  is_evening_game: number;
  is_interleague: number;
  month: number;
  day_of_week: number;
  [key: string]: string | number; // カテゴリカル変数のエンコード結果用
}

export interface PredictionResult {
  game_id?: string;
  home_team: string;
  away_team: string;
  home_win_probability: number;
  prediction_confidence: 'high' | 'medium' | 'low';
  model_version: string;
  predicted_at: string;
  features_used: number;
  calibrated: boolean;
}

export interface BatchPredictionResult {
  predictions: PredictionResult[];
  total_predictions: number;
  average_probability: number;
  confidence_distribution: Record<string, number>;
  processing_time_ms: number;
}

class BasePredictor {
  protected session: InferenceSession | null = null;
  protected metadata: ModelMetadata | null = null;
  protected modelPath: string;
  protected metadataPath: string;
  protected initialized = false;

  constructor(modelPath: string, metadataPath: string) {
    this.modelPath = modelPath;
    this.metadataPath = metadataPath;
  }

  /**
   * モデルとメタデータの初期化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing prediction model', {
      modelPath: this.modelPath,
      metadataPath: this.metadataPath
    });

    const startTime = Date.now();

    try {
      // メタデータ読み込み
      const metadataContent = await fs.readFile(this.metadataPath, 'utf-8');
      this.metadata = JSON.parse(metadataContent);

      // ONNX モデル読み込み
      this.session = await InferenceSession.create(this.modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        executionMode: 'sequential'
      });

      const duration = Date.now() - startTime;

      logger.info('Model initialized successfully', {
        modelName: this.metadata.model_name,
        modelType: this.metadata.model_type,
        featureCount: this.metadata.input_schema.feature_count,
        aucScore: this.metadata.evaluation_metrics.auc_score,
        duration
      });

      recordHistogram('model_initialization_duration_seconds', duration / 1000, {
        model_name: this.metadata.model_name
      });

      this.initialized = true;

    } catch (error) {
      logger.error('Model initialization failed', {
        modelPath: this.modelPath,
        metadataPath: this.metadataPath,
        error: error instanceof Error ? error.message : String(error)
      });

      incrementCounter('model_initialization_errors_total', {
        model_name: path.basename(this.modelPath, '.onnx')
      });

      throw error;
    }
  }

  /**
   * 特徴量ベクトルの変換
   */
  protected transformFeatures(features: Record<string, any>): Float32Array {
    if (!this.metadata) {
      throw new Error('Model not initialized');
    }

    const featureVector = new Float32Array(this.metadata.input_schema.feature_count);
    const featureNames = this.metadata.input_schema.feature_names;

    // カテゴリカル特徴量のエンコーディング
    const encodedFeatures = { ...features };
    
    for (const [column, encoder] of Object.entries(this.metadata.preprocessing.categorical_encoders)) {
      if (features[column] !== undefined) {
        const value = String(features[column]);
        const encodedValue = encoder.classes.indexOf(value);
        encodedFeatures[column + '_encoded'] = encodedValue >= 0 ? encodedValue : 0;
      }
    }

    // 特徴量ベクトルの構築
    for (let i = 0; i < featureNames.length; i++) {
      const featureName = featureNames[i];
      featureVector[i] = encodedFeatures[featureName] ?? 0;
    }

    return featureVector;
  }

  /**
   * 確率のキャリブレーション
   */
  protected calibrateProbability(rawProbability: number): number {
    if (!this.metadata?.calibration.enabled) {
      return rawProbability;
    }

    const { min_probability, max_probability } = this.metadata.calibration;
    return Math.max(min_probability, Math.min(max_probability, rawProbability));
  }

  /**
   * 予測信頼度の計算
   */
  protected calculateConfidence(probability: number): 'high' | 'medium' | 'low' {
    const distance = Math.abs(probability - 0.5);
    
    if (distance >= 0.3) return 'high';      // 0.2 or 0.8 以上
    if (distance >= 0.15) return 'medium';   // 0.35-0.65
    return 'low';                            // 0.45-0.55
  }

  /**
   * 推論実行（基底メソッド）
   */
  protected async runInference(featureVector: Float32Array): Promise<number> {
    if (!this.session || !this.metadata) {
      throw new Error('Model not initialized');
    }

    const startTime = Date.now();

    try {
      // テンソル作成
      const inputTensor = new Tensor('float32', featureVector, [1, featureVector.length]);
      
      // 推論実行
      const results = await this.session.run({
        [this.metadata.input_schema.input_name]: inputTensor
      });

      // 結果抽出
      const outputTensor = results[this.metadata.input_schema.output_name] as Tensor;
      const rawProbability = outputTensor.data[0] as number;

      const duration = Date.now() - startTime;

      recordHistogram('model_inference_duration_seconds', duration / 1000, {
        model_name: this.metadata.model_name
      });

      incrementCounter('model_inference_total', {
        model_name: this.metadata.model_name,
        result: 'success'
      });

      return this.calibrateProbability(rawProbability);

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Model inference failed', {
        modelName: this.metadata.model_name,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      incrementCounter('model_inference_total', {
        model_name: this.metadata.model_name,
        result: 'error'
      });

      throw error;
    }
  }

  /**
   * リソースのクリーンアップ
   */
  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.metadata = null;
    this.initialized = false;

    logger.info('Model resources released');
  }
}

export class PregamePredictor extends BasePredictor {
  constructor(modelsDir: string = './models') {
    const modelPath = path.join(modelsDir, 'pregame_win_probability.onnx');
    const metadataPath = path.join(modelsDir, 'pregame_win_probability_metadata.json');
    super(modelPath, metadataPath);
  }

  /**
   * プリゲーム勝率予測
   */
  async predict(features: PregameFeatures, gameId?: string): Promise<PredictionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.metadata) {
      throw new Error('Model metadata not loaded');
    }

    logger.debug('Pregame prediction request', {
      gameId,
      homeTeam: features.home_team,
      awayTeam: features.away_team,
      venue: features.venue
    });

    try {
      // 特徴量変換
      const featureVector = this.transformFeatures(features);

      // 推論実行
      const probability = await this.runInference(featureVector);

      // 結果構築
      const result: PredictionResult = {
        game_id: gameId,
        home_team: features.home_team,
        away_team: features.away_team,
        home_win_probability: probability,
        prediction_confidence: this.calculateConfidence(probability),
        model_version: this.metadata.model_name,
        predicted_at: new Date().toISOString(),
        features_used: this.metadata.input_schema.feature_count,
        calibrated: this.metadata.calibration.enabled
      };

      logger.info('Pregame prediction completed', {
        gameId,
        homeTeam: features.home_team,
        awayTeam: features.away_team,
        probability: probability.toFixed(3),
        confidence: result.prediction_confidence
      });

      return result;

    } catch (error) {
      logger.error('Pregame prediction failed', {
        gameId,
        homeTeam: features.home_team,
        awayTeam: features.away_team,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * バッチ予測
   */
  async predictBatch(gameFeatures: Array<{ gameId?: string; features: PregameFeatures }>): Promise<BatchPredictionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    logger.info('Batch prediction started', {
      batchSize: gameFeatures.length
    });

    try {
      const predictions: PredictionResult[] = [];
      
      for (const { gameId, features } of gameFeatures) {
        try {
          const prediction = await this.predict(features, gameId);
          predictions.push(prediction);
        } catch (error) {
          logger.warn('Individual prediction failed in batch', {
            gameId,
            homeTeam: features.home_team,
            awayTeam: features.away_team,
            error: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }

      const processingTime = Date.now() - startTime;
      
      // 統計計算
      const probabilities = predictions.map(p => p.home_win_probability);
      const averageProbability = probabilities.reduce((a, b) => a + b, 0) / probabilities.length;
      
      const confidenceDistribution = predictions.reduce((acc, p) => {
        acc[p.prediction_confidence] = (acc[p.prediction_confidence] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const result: BatchPredictionResult = {
        predictions,
        total_predictions: predictions.length,
        average_probability: averageProbability,
        confidence_distribution: confidenceDistribution,
        processing_time_ms: processingTime
      };

      logger.info('Batch prediction completed', {
        requestedPredictions: gameFeatures.length,
        successfulPredictions: predictions.length,
        averageProbability: averageProbability.toFixed(3),
        processingTime
      });

      recordHistogram('batch_prediction_duration_seconds', processingTime / 1000, {
        batch_size: gameFeatures.length.toString()
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Batch prediction failed', {
        batchSize: gameFeatures.length,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });

      throw error;
    }
  }

  /**
   * モデル情報の取得
   */
  getModelInfo(): ModelMetadata | null {
    return this.metadata;
  }

  /**
   * モデル健全性チェック
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // テスト用特徴量で推論実行
      const testFeatures: PregameFeatures = {
        home_team: 'G',
        away_team: 'T', 
        venue: '東京ドーム',
        home_win_rate_30: 0.6,
        away_win_rate_30: 0.4,
        home_runs_scored_avg_30: 5.0,
        away_runs_scored_avg_30: 4.0,
        home_runs_allowed_avg_30: 4.0,
        away_runs_allowed_avg_30: 5.0,
        home_run_differential_30: 1.0,
        away_run_differential_30: -1.0,
        home_win_rate_10: 0.7,
        away_win_rate_10: 0.3,
        home_runs_scored_avg_10: 5.5,
        away_runs_scored_avg_10: 3.5,
        home_runs_allowed_avg_10: 3.5,
        away_runs_allowed_avg_10: 5.5,
        home_pitcher_era: 2.5,
        away_pitcher_era: 3.5,
        home_pitcher_whip: 1.1,
        away_pitcher_whip: 1.4,
        home_pitcher_wins: 10,
        away_pitcher_wins: 5,
        home_pitcher_losses: 3,
        away_pitcher_losses: 8,
        home_pitcher_games_started: 15,
        away_pitcher_games_started: 13,
        home_pitcher_innings_pitched: 95.0,
        away_pitcher_innings_pitched: 80.0,
        home_pitcher_era_5: 2.2,
        away_pitcher_era_5: 4.0,
        home_pitcher_days_rest: 5,
        away_pitcher_days_rest: 4,
        venue_home_advantage: 0.05,
        venue_scoring_factor: 1.1,
        head_to_head_home_wins: 3,
        head_to_head_total_games: 6,
        season_game_number: 50,
        home_games_in_last_7_days: 4,
        away_games_in_last_7_days: 3,
        is_weekend: 1,
        is_evening_game: 1,
        is_interleague: 0,
        month: 7,
        day_of_week: 6
      };

      const startTime = Date.now();
      const result = await this.predict(testFeatures, 'health_check');
      const duration = Date.now() - startTime;

      return {
        healthy: true,
        details: {
          model_loaded: true,
          test_prediction_probability: result.home_win_probability,
          test_prediction_confidence: result.prediction_confidence,
          inference_time_ms: duration,
          model_version: this.metadata?.model_name,
          feature_count: this.metadata?.input_schema.feature_count
        }
      };

    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : String(error),
          model_loaded: this.initialized,
          session_active: this.session !== null
        }
      };
    }
  }
}

// シングルトンインスタンス
let _pregamePredictor: PregamePredictor | null = null;

export function getPregamePredictor(): PregamePredictor {
  if (!_pregamePredictor) {
    _pregamePredictor = new PregamePredictor();
  }
  return _pregamePredictor;
}