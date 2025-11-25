#!/usr/bin/env npx tsx
/**
 * Play-by-Play イベント取り込みスクリプト
 * 既存のlive-state更新ロジックにpitch.eventsを差し込み
 */

import fs from "fs/promises";
import path from "path";
import { fetchNPBPlayByPlay, mergePbPIntoLiveState } from "../lib/connectors/npb-official-pbp";
import { logger } from "../lib/logger";
import { 
  nextPitchPredictEvents, 
  nextPitchPredictLatency,
  coveragePitchesTotal,
  expectedPitchesTotal,
  pbpEventLag,
  missingPitchTypeTotal,
  dataConsistencyErrors
} from "../lib/prometheus-metrics";

const log = logger.child({ job: "ingest-pbp" });

interface IngestConfig {
  date: string;
  gameId?: string; // 指定なしの場合は全試合
  forceUpdate?: boolean;
  dryRun?: boolean;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: any): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function appendJsonl(filePath: string, data: any): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const line = JSON.stringify(data) + "\n";
  await fs.appendFile(filePath, line);
}

/**
 * 指定試合のPlay-by-Playデータを取り込み
 */
async function ingestGamePbP(config: IngestConfig, gameId: string): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    log.info({ date: config.date, gameId }, "Starting PbP ingestion");
    
    // 既存のlive-stateを読み込み
    const liveDir = path.join("data", "predictions", "live", `date=${config.date}`, gameId);
    const latestPath = path.join(liveDir, "latest.json");
    const timelinePath = path.join(liveDir, "timeline.jsonl");
    
    const existingState = await readJson(latestPath);
    if (!existingState && !config.forceUpdate) {
      log.debug({ gameId }, "No existing live state, skipping");
      return false;
    }
    
    // NPB公式からPlay-by-Playデータを取得
    const pbpState = await fetchNPBPlayByPlay(gameId, config.date);
    if (!pbpState) {
      log.warn({ gameId }, "No PbP data available");
      return false;
    }
    
    // データ品質チェック
    const coverage = pbpState.coverage;
    const coverageRate = coverage.captured_pitches / Math.max(coverage.expected_pitches, 1);
    
    if (coverageRate < 0.8) {
      log.warn({ 
        gameId, 
        coverage: coverageRate, 
        captured: coverage.captured_pitches,
        expected: coverage.expected_pitches 
      }, "Low PbP coverage rate");
    }
    
    // 既存stateとマージ
    const baseState = existingState || {
      gameId,
      date: config.date,
      inning: 1,
      top: true,
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: 0,
      homeScore: 0,
      awayScore: 0,
      pitches: []
    };
    
    const mergedState = mergePbPIntoLiveState(baseState, pbpState);
    
    if (config.dryRun) {
      log.info({ 
        gameId, 
        originalPitches: baseState.pitches?.length || 0,
        mergedPitches: mergedState.pitches?.length || 0,
        newEvents: pbpState.events.length,
        coverage: pbpState.coverage
      }, "DRY RUN: PbP merge completed");
      
      return true;
    }
    
    // 更新内容をファイルに保存
    await writeJson(latestPath, mergedState);
    
    // timeline.jsonlに追記（新しいイベントのみ）
    const newEvents = pbpState.events.filter(event => {
      const existing = baseState.pitches?.find((p: any) => p.seq === event.seq);
      return !existing;
    });
    
    for (const event of newEvents) {
      const timelineEvent = {
        ts: event.timestamp,
        gameId,
        type: "pitch_event",
        data: {
          seq: event.seq,
          inning: event.inning,
          top: event.top,
          result: event.result,
          pitchType: event.pitchType,
          balls: event.balls,
          strikes: event.strikes,
          outs: event.outs,
          bases: event.bases,
          confidence: event.source_confidence
        }
      };
      
      await appendJsonl(timelinePath, timelineEvent);
    }
    
    // データ品質メトリクス更新
    coveragePitchesTotal.set({ gameId }, coverage.captured_pitches);
    expectedPitchesTotal.set({ gameId }, coverage.expected_pitches);
    missingPitchTypeTotal.inc(
      { gameId, source: "npb-official" }, 
      coverage.missing_pitch_types
    );
    dataConsistencyErrors.inc(
      { type: "count_progression", gameId }, 
      coverage.consistency_errors
    );
    
    // PbP イベント遅延（簡易計算）
    const avgEventLag = newEvents.length > 0 ? 
      newEvents.reduce((sum, event) => {
        const eventTime = new Date(event.timestamp);
        const now = new Date();
        return sum + (now.getTime() - eventTime.getTime()) / 1000;
      }, 0) / newEvents.length : 0;
    
    if (avgEventLag > 0) {
      pbpEventLag.observe({ gameId }, avgEventLag);
    }
    
    // 処理成功メトリクス
    nextPitchPredictEvents.inc({ result: "success" });
    nextPitchPredictLatency.observe(Date.now() - startTime);
    
    log.info({ 
      gameId, 
      newEvents: newEvents.length,
      totalPitches: mergedState.pitches?.length || 0,
      coverage: Math.round(coverageRate * 100),
      latency: Date.now() - startTime
    }, "PbP ingestion completed");
    
    return true;
    
  } catch (error) {
    nextPitchPredictEvents.inc({ result: "fail" });
    nextPitchPredictLatency.observe(Date.now() - startTime);
    
    log.error({ 
      gameId, 
      error: error.message,
      latency: Date.now() - startTime 
    }, "PbP ingestion failed");
    
    return false;
  }
}

/**
 * 指定日の全試合についてPlay-by-Playデータを取り込み
 */
async function ingestDatePbP(config: IngestConfig): Promise<void> {
  const liveDir = path.join("data", "predictions", "live", `date=${config.date}`);
  
  let gameIds: string[] = [];
  
  if (config.gameId) {
    gameIds = [config.gameId];
  } else {
    try {
      const entries = await fs.readdir(liveDir, { withFileTypes: true });
      gameIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch {
      log.warn({ date: config.date }, "No live games directory found");
      return;
    }
  }
  
  log.info({ 
    date: config.date, 
    games: gameIds.length,
    dryRun: config.dryRun 
  }, "Starting batch PbP ingestion");
  
  let successCount = 0;
  let totalCount = 0;
  
  for (const gameId of gameIds) {
    totalCount++;
    
    const success = await ingestGamePbP(config, gameId);
    if (success) successCount++;
    
    // レート制限: 1秒間隔
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log.info({ 
    date: config.date,
    success: successCount,
    total: totalCount,
    rate: Math.round((successCount / totalCount) * 100)
  }, "Batch PbP ingestion completed");
}

async function main() {
  const args = process.argv.slice(2);
  
  const config: IngestConfig = {
    date: "",
    gameId: undefined,
    forceUpdate: false,
    dryRun: false
  };
  
  // コマンドライン引数の解析
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith("--date=")) {
      config.date = arg.split("=")[1];
    } else if (arg.startsWith("--gameId=")) {
      config.gameId = arg.split("=")[1];
    } else if (arg === "--force") {
      config.forceUpdate = true;
    } else if (arg === "--dry-run") {
      config.dryRun = true;
    } else if (arg.includes("-")) {
      config.date = arg; // YYYY-MM-DD形式
    }
  }
  
  if (!config.date) {
    config.date = new Date().toISOString().slice(0, 10);
  }
  
  log.info(config, "PbP ingestion starting");
  
  try {
    await ingestDatePbP(config);
    process.exit(0);
  } catch (error) {
    log.error({ error: error.message }, "PbP ingestion failed");
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });
}

export { ingestGamePbP, ingestDatePbP };