// lib/data-health.ts
/**
 * データヘルス監視・欠損検知・品質メトリクス
 */

import fs from 'fs/promises';
import path from 'path';
import { GameState } from './live-state';
import { logger } from './logger';
import { Counter, Gauge, register } from 'prom-client';

const log = logger.child({ job: 'data-health' });

// Prometheus メトリクス
const missingFieldsCounter = new Counter({
  name: 'missing_fields_total',
  help: 'Total count of missing data fields',
  labelNames: ['field', 'gameId', 'date'],
  registers: [register]
});

const inferredFieldsCounter = new Counter({
  name: 'inferred_fields_total', 
  help: 'Total count of inferred/estimated data fields',
  labelNames: ['field', 'source', 'gameId', 'date'],
  registers: [register]
});

const dataFreshnessGauge = new Gauge({
  name: 'data_freshness_seconds',
  help: 'Seconds since last data update per game',
  labelNames: ['gameId', 'date'],
  registers: [register]
});

const expectedGamesGauge = new Gauge({
  name: 'expected_games_total',
  help: 'Expected number of games for date',
  labelNames: ['date', 'league'],
  registers: [register]
});

const actualGamesGauge = new Gauge({
  name: 'actual_games_total',
  help: 'Actual number of games found for date', 
  labelNames: ['date', 'league'],
  registers: [register]
});

const dataQualityScore = new Gauge({
  name: 'data_quality_score',
  help: 'Overall data quality score (0-1)',
  labelNames: ['gameId', 'date'],
  registers: [register]
});

export interface DataHealthReport {
  gameId: string;
  date: string;
  timestamp: string;
  
  // 基本フィールド完全性
  completeness: {
    core_fields: number;     // 0-1: inning,outs,bases,scores
    extended_fields: number; // 0-1: lineups,starters,venue
    overall: number;         // weighted average
  };
  
  // 推定・補完状況
  inference: {
    inferred_count: number;
    total_fields: number;
    sources: string[];       // どのソースから補完したか
  };
  
  // 鮮度
  freshness: {
    last_update: string;
    age_seconds: number;
    is_stale: boolean;       // 90秒超過
  };
  
  // 異常検知
  anomalies: {
    impossible_values: string[];  // outs=4, inning=0など
    inconsistent_changes: string[]; // スコア減少など
    missing_sequences: string[];    // イニング飛びなど
  };
  
  // 総合スコア
  quality_score: number; // 0-1
}

/**
 * GameState のヘルス評価
 */
export function assessGameStateHealth(
  state: GameState, 
  previous?: GameState
): DataHealthReport {
  const report: DataHealthReport = {
    gameId: state.gameId,
    date: state.gameId.substring(0, 8), // YYYYMMDD
    timestamp: state.timestamp,
    completeness: calculateCompleteness(state),
    inference: analyzeInference(state),
    freshness: calculateFreshness(state),
    anomalies: detectAnomalies(state, previous),
    quality_score: 0
  };
  
  // 総合スコア計算（重み付き平均）
  report.quality_score = (
    report.completeness.overall * 0.4 +
    (1 - report.inference.inferred_count / Math.max(1, report.inference.total_fields)) * 0.3 +
    (report.freshness.is_stale ? 0 : 1) * 0.2 +
    (report.anomalies.impossible_values.length === 0 ? 1 : 0) * 0.1
  );
  
  // メトリクス更新
  updateMetrics(report);
  
  return report;
}

/**
 * データ完全性評価
 */
function calculateCompleteness(state: GameState): DataHealthReport['completeness'] {
  const coreFields = ['gameId', 'inning', 'outs', 'bases', 'homeScore', 'awayScore'];
  const extendedFields = ['timestamp']; // 将来: venue, starters, lineups
  
  const coreComplete = coreFields.filter(field => 
    state[field] !== undefined && state[field] !== null
  ).length;
  
  const extendedComplete = extendedFields.filter(field =>
    state[field] !== undefined && state[field] !== null && state[field] !== ''
  ).length;
  
  const coreScore = coreComplete / coreFields.length;
  const extendedScore = extendedComplete / Math.max(1, extendedFields.length);
  
  // 欠損フィールドをメトリクスに記録
  coreFields.forEach(field => {
    if (state[field] === undefined || state[field] === null) {
      missingFieldsCounter.inc({ 
        field, 
        gameId: state.gameId, 
        date: state.gameId.substring(0, 8) 
      });
    }
  });
  
  return {
    core_fields: coreScore,
    extended_fields: extendedScore,
    overall: coreScore * 0.8 + extendedScore * 0.2
  };
}

/**
 * 推定データ分析
 */
function analyzeInference(state: GameState): DataHealthReport['inference'] {
  const totalFields = 6; // core fields count
  let inferredCount = 0;
  const sources: string[] = [];
  
  // _source や _inferred プロパティをチェック
  if (state._inferred) {
    inferredCount = 1; // 簡易版：全体が推定
    if (state._source) {
      sources.push(state._source);
    }
    
    // 推定メトリクス記録
    inferredFieldsCounter.inc({
      field: 'gamestate',
      source: state._source || 'unknown',
      gameId: state.gameId,
      date: state.gameId.substring(0, 8)
    });
  }
  
  return {
    inferred_count: inferredCount,
    total_fields: totalFields,
    sources: [...new Set(sources)]
  };
}

/**
 * データ鮮度計算
 */
function calculateFreshness(state: GameState): DataHealthReport['freshness'] {
  const now = new Date();
  const lastUpdate = new Date(state.timestamp);
  const ageSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
  const isStale = ageSeconds > 90; // 90秒でstale判定
  
  // 鮮度メトリクス更新
  dataFreshnessGauge.set(
    { gameId: state.gameId, date: state.gameId.substring(0, 8) },
    ageSeconds
  );
  
  return {
    last_update: state.timestamp,
    age_seconds: ageSeconds,
    is_stale: isStale
  };
}

/**
 * 異常値検知
 */
function detectAnomalies(
  state: GameState, 
  previous?: GameState
): DataHealthReport['anomalies'] {
  const impossibleValues: string[] = [];
  const inconsistentChanges: string[] = [];
  const missingSequences: string[] = [];
  
  // 不可能な値
  if (state.outs < 0 || state.outs > 3) {
    impossibleValues.push(`outs=${state.outs}`);
  }
  if (state.inning < 1 || state.inning > 20) {
    impossibleValues.push(`inning=${state.inning}`);
  }
  if (state.bases < 0 || state.bases > 7) {
    impossibleValues.push(`bases=${state.bases}`);
  }
  if (state.homeScore < 0 || state.awayScore < 0) {
    impossibleValues.push(`negative_score`);
  }
  
  // 前回との比較
  if (previous) {
    // スコア減少（通常ありえない）
    if (state.homeScore < previous.homeScore || state.awayScore < previous.awayScore) {
      inconsistentChanges.push('score_decrease');
    }
    
    // イニング飛び
    if (state.inning > previous.inning + 1) {
      missingSequences.push(`inning_jump_${previous.inning}_to_${state.inning}`);
    }
    
    // 異常なタイムスタンプ（未来や大幅過去）
    const timeDiff = new Date(state.timestamp).getTime() - new Date(previous.timestamp).getTime();
    if (timeDiff < 0) {
      inconsistentChanges.push('timestamp_backwards');
    }
    if (timeDiff > 1800000) { // 30分以上の差
      missingSequences.push('large_time_gap');
    }
  }
  
  return {
    impossible_values: impossibleValues,
    inconsistent_changes: inconsistentChanges,
    missing_sequences: missingSequences
  };
}

/**
 * Prometheusメトリクス更新
 */
function updateMetrics(report: DataHealthReport): void {
  // 品質スコア
  dataQualityScore.set(
    { gameId: report.gameId, date: report.date },
    report.quality_score
  );
  
  // ログ出力（異常時）
  if (report.quality_score < 0.7) {
    log.warn({
      gameId: report.gameId,
      quality_score: report.quality_score,
      completeness: report.completeness.overall,
      anomalies: report.anomalies,
      freshness_age: report.freshness.age_seconds
    }, 'Low data quality detected');
  }
}

/**
 * 日次ゲーム数チェック
 */
export async function checkExpectedGames(date: string, dataDir: string = 'data'): Promise<void> {
  try {
    // 予想試合数（NPBスケジュール基準）
    const expectedCL = getExpectedGamesForDate(date, 'CL');
    const expectedPL = getExpectedGamesForDate(date, 'PL');
    
    // 実際の取得試合数
    const liveDir = path.join(dataDir, 'predictions', 'live', `date=${date}`);
    const dirs = await fs.readdir(liveDir, { withFileTypes: true });
    const gameIds = dirs.filter(d => d.isDirectory()).map(d => d.name);
    
    const actualCL = gameIds.filter(id => id.includes('_C-') || id.includes('_G-') || id.includes('_D-') || id.includes('_T-') || id.includes('_S-') || id.includes('_YB-')).length;
    const actualPL = gameIds.filter(id => id.includes('_L-') || id.includes('_H-') || id.includes('_F-') || id.includes('_M-') || id.includes('_E-') || id.includes('_B-')).length;
    
    // メトリクス更新
    expectedGamesGauge.set({ date, league: 'CL' }, expectedCL);
    expectedGamesGauge.set({ date, league: 'PL' }, expectedPL);
    actualGamesGauge.set({ date, league: 'CL' }, actualCL);
    actualGamesGauge.set({ date, league: 'PL' }, actualPL);
    
    // 差異が大きい場合は警告
    if (Math.abs(actualCL - expectedCL) > 1 || Math.abs(actualPL - expectedPL) > 1) {
      log.warn({
        date,
        expected: { CL: expectedCL, PL: expectedPL },
        actual: { CL: actualCL, PL: actualPL },
        missing: { 
          CL: Math.max(0, expectedCL - actualCL),
          PL: Math.max(0, expectedPL - actualPL)
        }
      }, 'Game count mismatch detected');
    }
    
  } catch (error) {
    log.error({ date, error: error.message }, 'Failed to check expected games');
  }
}

/**
 * 日付・リーグ別の予想試合数
 */
function getExpectedGamesForDate(date: string, league: 'CL' | 'PL'): number {
  const dayOfWeek = new Date(date).getDay();
  
  // 簡易スケジュール（実際はマスタデータから取得）
  if (dayOfWeek === 0) return 0; // 日曜は休み
  if (dayOfWeek === 6) return 3; // 土曜は3試合
  return 3; // 平日は3試合（実際は変動）
}

/**
 * データヘルス集計レポート生成
 */
export async function generateHealthSummary(date: string, dataDir: string = 'data'): Promise<any> {
  try {
    const liveDir = path.join(dataDir, 'predictions', 'live', `date=${date}`);
    const dirs = await fs.readdir(liveDir, { withFileTypes: true });
    const gameIds = dirs.filter(d => d.isDirectory()).map(d => d.name);
    
    const summary = {
      date,
      total_games: gameIds.length,
      quality_distribution: { high: 0, medium: 0, low: 0 },
      common_issues: {},
      recommendations: []
    };
    
    for (const gameId of gameIds) {
      const latestPath = path.join(liveDir, gameId, 'latest.json');
      try {
        const latest = JSON.parse(await fs.readFile(latestPath, 'utf-8'));
        // ここで品質評価を実施し、集計に加える
        // 簡易版では省略
      } catch {
        // ファイルが存在しない場合はスキップ
      }
    }
    
    return summary;
  } catch (error) {
    log.error({ date, error: error.message }, 'Failed to generate health summary');
    return null;
  }
}