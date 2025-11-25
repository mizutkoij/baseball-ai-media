#!/usr/bin/env npx tsx
/**
 * セカンダリソース統合による堅牢なライブ状態取得
 * Primary失敗時にSecondaryからフォールバック取得
 */

import { GameState } from '../lib/live-state';
import { fetchSecondaryState, mergeGameState } from '../lib/live-state-from-secondary';
import { assessGameStateHealth } from '../lib/data-health';
import { predictAndPersistLive } from '../lib/live-predictor';
import { logger } from '../lib/logger';
import fs from 'fs/promises';
import path from 'path';

const log = logger.child({ job: 'ingest-live-state' });

interface IngestOptions {
  gameId: string;
  date: string;
  dataDir?: string;
  forcePrimary?: boolean;  // trueなら primary のみ
  forceSecondary?: boolean; // trueなら secondary のみ
}

/**
 * メイン関数：Primary + Secondary から最良の GameState を構築
 */
export async function ingestLiveState(opts: IngestOptions): Promise<GameState | null> {
  const { gameId, date, dataDir = 'data' } = opts;
  
  log.info({ gameId, date }, 'Starting live state ingestion');
  
  let primaryState: Partial<GameState> | null = null;
  let secondaryState: Partial<GameState> | null = null;
  
  // 1) Primary ソース（既存の詳細データ）
  if (!opts.forceSecondary) {
    try {
      primaryState = await fetchPrimaryState(gameId, date, dataDir);
      if (primaryState) {
        log.debug({ gameId, fields: Object.keys(primaryState) }, 'Primary state acquired');
      }
    } catch (error) {
      log.warn({ gameId, error: error.message }, 'Primary state fetch failed');
    }
  }
  
  // 2) Secondary ソース（フォールバック）
  if (!opts.forcePrimary && (!primaryState || hasSignificantGaps(primaryState))) {
    try {
      secondaryState = await fetchSecondaryState(gameId, date);
      if (secondaryState) {
        log.debug({ gameId, fields: Object.keys(secondaryState) }, 'Secondary state acquired');
      }
    } catch (error) {
      log.warn({ gameId, error: error.message }, 'Secondary state fetch failed');
    }
  }
  
  // 3) マージして最終状態を構築
  const finalState = mergeGameState(primaryState, secondaryState);
  if (!finalState) {
    log.error({ gameId, date }, 'No valid state from any source');
    return null;
  }
  
  // 4) データヘルス評価
  const healthReport = assessGameStateHealth(finalState);
  log.info({
    gameId,
    quality_score: healthReport.quality_score,
    completeness: healthReport.completeness.overall,
    inferred_count: healthReport.inference.inferred_count,
    anomalies: healthReport.anomalies.impossible_values.length
  }, 'State health assessed');
  
  // 5) 品質が著しく低い場合は警告
  if (healthReport.quality_score < 0.5) {
    log.error({
      gameId,
      quality_score: healthReport.quality_score,
      issues: healthReport.anomalies
    }, 'Critical data quality issue - prediction may be unreliable');
  }
  
  // 6) 予測パイプラインに投入（オプション）
  if (healthReport.quality_score >= 0.3) { // 最低品質閾値
    try {
      await predictAndPersistLive({
        gameState: finalState,
        baseDir: dataDir,
        date: date
      });
      log.info({ gameId, quality: healthReport.quality_score }, 'Live prediction completed');
    } catch (error) {
      log.error({ gameId, error: error.message }, 'Live prediction failed');
    }
  } else {
    log.warn({ gameId, quality: healthReport.quality_score }, 'Skipping prediction due to low data quality');
  }
  
  return finalState;
}

/**
 * Primary データソース（既存の詳細データ読み込み）
 */
async function fetchPrimaryState(
  gameId: string, 
  date: string, 
  dataDir: string
): Promise<Partial<GameState> | null> {
  try {
    // 既存の latest.json から読み込み
    const latestPath = path.join(dataDir, 'predictions', 'live', `date=${date}`, gameId, 'latest.json');
    const content = await fs.readFile(latestPath, 'utf-8');
    const data = JSON.parse(content);
    
    // GameState に変換
    return {
      gameId: data.gameId,
      inning: data.inning,
      top: data.top,
      outs: data.outs,
      bases: data.bases,
      homeScore: data.homeScore,
      awayScore: data.awayScore,
      timestamp: data.ts,
      _source: 'primary-details'
    };
  } catch (error) {
    // ファイルが存在しない場合は null
    return null;
  }
}

/**
 * Primary データに重大な欠損があるかチェック
 */
function hasSignificantGaps(state: Partial<GameState>): boolean {
  const criticalFields = ['inning', 'outs', 'homeScore', 'awayScore'];
  const missingCritical = criticalFields.filter(field => 
    state[field] === undefined || state[field] === null
  ).length;
  
  return missingCritical > 1; // 2個以上の重要フィールドが欠損
}

/**
 * 単発実行：指定ゲームの状態を一回だけ取得
 */
export async function ingestOnce(gameId: string, date?: string): Promise<void> {
  const targetDate = date ?? new Date().toISOString().substring(0, 10).replace(/-/g, '');
  
  try {
    const state = await ingestLiveState({
      gameId,
      date: targetDate
    });
    
    if (state) {
      console.log(`✅ ${gameId}: Successfully ingested state`);
      console.log(`   Inning: ${state.inning}${state.top ? 'T' : 'B'}, Outs: ${state.outs}`);
      console.log(`   Score: ${state.awayScore}-${state.homeScore}, Bases: ${state.bases}`);
      console.log(`   Source: ${state._source || 'unknown'}`);
    } else {
      console.log(`❌ ${gameId}: Failed to ingest state`);
    }
  } catch (error) {
    console.error(`💥 ${gameId}: Error during ingestion:`, error.message);
  }
}

/**
 * バッチ処理：今日の全ゲームを処理
 */
export async function ingestAllToday(dataDir: string = 'data'): Promise<void> {
  const today = new Date().toISOString().substring(0, 10).replace(/-/g, '');
  
  try {
    // 今日のゲーム一覧を取得
    const liveDir = path.join(dataDir, 'predictions', 'live', `date=${today}`);
    const dirs = await fs.readdir(liveDir, { withFileTypes: true });
    const gameIds = dirs.filter(d => d.isDirectory()).map(d => d.name);
    
    log.info({ date: today, games: gameIds.length }, 'Starting batch ingestion');
    
    let successful = 0;
    let failed = 0;
    
    for (const gameId of gameIds) {
      try {
        const state = await ingestLiveState({
          gameId,
          date: today,
          dataDir
        });
        
        if (state) {
          successful++;
          log.debug({ gameId }, 'Game ingestion successful');
        } else {
          failed++;
          log.warn({ gameId }, 'Game ingestion failed');
        }
      } catch (error) {
        failed++;
        log.error({ gameId, error: error.message }, 'Game ingestion error');
      }
      
      // レート制限（セカンダリソースへの負荷軽減）
      await new Promise(r => setTimeout(r, 250));
    }
    
    log.info({
      date: today,
      total: gameIds.length,
      successful,
      failed
    }, 'Batch ingestion completed');
    
  } catch (error) {
    log.error({ date: today, error: error.message }, 'Batch ingestion failed');
  }
}

// CLI実行
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'once':
      const gameId = process.argv[3];
      const date = process.argv[4];
      if (!gameId) {
        console.error('Usage: npx tsx scripts/ingest_live_state.ts once <gameId> [date]');
        process.exit(1);
      }
      ingestOnce(gameId, date);
      break;
      
    case 'batch':
      const dataDir = process.argv[3] || 'data';
      ingestAllToday(dataDir);
      break;
      
    default:
      console.log('NPB Live State Ingestion with Secondary Sources');
      console.log('');
      console.log('Commands:');
      console.log('  once <gameId> [date]     Ingest single game state');
      console.log('  batch [dataDir]          Ingest all games for today');
      console.log('');
      console.log('Examples:');
      console.log('  npx tsx scripts/ingest_live_state.ts once 20250812_G-T_01');
      console.log('  npx tsx scripts/ingest_live_state.ts once 20250812_G-T_01 20250812');
      console.log('  npx tsx scripts/ingest_live_state.ts batch');
      process.exit(1);
  }
}