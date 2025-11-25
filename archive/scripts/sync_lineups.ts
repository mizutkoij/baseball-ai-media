#!/usr/bin/env npx tsx
/**
 * ラインアップ同期スクリプト
 * confirmed_at と source を保存してlineup微調整の信頼度安定化
 */

import fs from "fs/promises";
import path from "path";
import { aggregateGameLineups, updateLineupConfidence, GameLineups } from "../lib/connectors/lineups-aggregator";
import { logger } from "../lib/logger";

const log = logger.child({ job: "sync-lineups" });

interface SyncConfig {
  date: string;
  gameId?: string;
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

/**
 * ラインアップデータの信頼度評価
 */
function evaluateLineupQuality(lineups: GameLineups): {
  score: number; // 0-100
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;
  
  // 基本完成度チェック
  const homeComplete = (lineups.homeTeam?.players?.length || 0) >= 8;
  const awayComplete = (lineups.awayTeam?.players?.length || 0) >= 8;
  
  if (homeComplete) score += 25;
  else issues.push("home_lineup_incomplete");
  
  if (awayComplete) score += 25;
  else issues.push("away_lineup_incomplete");
  
  // 先発投手情報
  if (lineups.homeTeam?.startingPitcher) score += 15;
  else issues.push("home_pitcher_missing");
  
  if (lineups.awayTeam?.startingPitcher) score += 15;
  else issues.push("away_pitcher_missing");
  
  // ソースの信頼度
  if (lineups.sources.includes("official")) score += 20;
  else if (lineups.sources.includes("news")) score += 10;
  else issues.push("low_confidence_source");
  
  // 全体確度
  if (lineups.overallConfidence === "confirmed") score += 0; // already counted
  else if (lineups.overallConfidence === "partial") score -= 10;
  else score -= 20;
  
  return { score: Math.max(0, Math.min(100, score)), issues };
}

/**
 * 指定試合のラインアップを同期
 */
async function syncGameLineups(config: SyncConfig, gameId: string): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    log.info({ date: config.date, gameId }, "Starting lineup sync");
    
    // 既存のラインアップデータを読み込み
    const lineupsDir = path.join("data", "lineups", `date=${config.date}`);
    const lineupPath = path.join(lineupsDir, `${gameId}.json`);
    
    const existingLineups = await readJson<GameLineups>(lineupPath);
    
    // 強制更新でない場合、既に確定済みなら skip
    if (!config.forceUpdate && existingLineups?.overallConfidence === "confirmed") {
      log.debug({ gameId }, "Lineup already confirmed, skipping");
      return true;
    }
    
    // 新しいラインアップデータを取得
    const freshLineups = await aggregateGameLineups(gameId, config.date);
    if (!freshLineups) {
      log.warn({ gameId }, "No fresh lineup data available");
      return false;
    }
    
    // データ品質評価
    const quality = evaluateLineupQuality(freshLineups);
    log.info({ 
      gameId, 
      quality: quality.score,
      confidence: freshLineups.overallConfidence,
      sources: freshLineups.sources,
      issues: quality.issues
    }, "Lineup quality assessment");
    
    // 既存データとマージ
    let finalLineups = freshLineups;
    if (existingLineups) {
      finalLineups = updateLineupConfidence(existingLineups, freshLineups);
    }
    
    // 確定タイムスタンプの設定
    if (finalLineups.overallConfidence === "confirmed" && !existingLineups?.confirmedAt) {
      finalLineups.confirmedAt = new Date().toISOString();
    }
    
    if (config.dryRun) {
      log.info({ 
        gameId,
        existing: existingLineups ? "present" : "none",
        fresh: freshLineups.overallConfidence,
        final: finalLineups.overallConfidence,
        quality: quality.score
      }, "DRY RUN: Lineup sync completed");
      
      return true;
    }
    
    // ラインアップデータを保存
    await writeJson(lineupPath, finalLineups);
    
    // live-state にもラインアップ情報を反映
    const liveDir = path.join("data", "predictions", "live", `date=${config.date}`, gameId);
    const latestPath = path.join(liveDir, "latest.json");
    
    const liveState = await readJson(latestPath);
    if (liveState) {
      liveState.lineups = {
        homeTeam: finalLineups.homeTeam,
        awayTeam: finalLineups.awayTeam,
        confidence: finalLineups.overallConfidence,
        confirmedAt: finalLineups.confirmedAt,
        lastUpdate: finalLineups.lastUpdate
      };
      
      await writeJson(latestPath, liveState);
    }
    
    log.info({ 
      gameId, 
      confidence: finalLineups.overallConfidence,
      quality: quality.score,
      confirmed: Boolean(finalLineups.confirmedAt),
      latency: Date.now() - startTime
    }, "Lineup sync completed");
    
    return true;
    
  } catch (error) {
    log.error({ 
      gameId, 
      error: error.message,
      latency: Date.now() - startTime 
    }, "Lineup sync failed");
    
    return false;
  }
}

/**
 * 指定日の全試合についてラインアップを同期
 */
async function syncDateLineups(config: SyncConfig): Promise<void> {
  let gameIds: string[] = [];
  
  if (config.gameId) {
    gameIds = [config.gameId];
  } else {
    // 予定試合一覧を取得（簡易版）
    try {
      const liveDir = path.join("data", "predictions", "live", `date=${config.date}`);
      const entries = await fs.readdir(liveDir, { withFileTypes: true });
      gameIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch {
      // スケジュールファイルがある場合はそちらを使用
      try {
        const schedulePath = path.join("data", "schedule", `${config.date}.json`);
        const schedule = await readJson<{ games: { gameId: string }[] }>(schedulePath);
        gameIds = schedule?.games?.map(g => g.gameId) || [];
      } catch {
        log.warn({ date: config.date }, "No games found for lineup sync");
        return;
      }
    }
  }
  
  log.info({ 
    date: config.date, 
    games: gameIds.length,
    dryRun: config.dryRun 
  }, "Starting batch lineup sync");
  
  let successCount = 0;
  let totalCount = 0;
  const results: Array<{
    gameId: string;
    success: boolean;
    confidence?: string;
    quality?: number;
  }> = [];
  
  for (const gameId of gameIds) {
    totalCount++;
    
    const success = await syncGameLineups(config, gameId);
    results.push({ gameId, success });
    
    if (success) successCount++;
    
    // レート制限: 1秒間隔
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // サマリーレポート
  const confirmedGames = results.filter(r => r.confidence === "confirmed").length;
  const partialGames = results.filter(r => r.confidence === "partial").length;
  
  log.info({ 
    date: config.date,
    success: successCount,
    total: totalCount,
    confirmed: confirmedGames,
    partial: partialGames,
    rate: Math.round((successCount / totalCount) * 100)
  }, "Batch lineup sync completed");
}

async function main() {
  const args = process.argv.slice(2);
  
  const config: SyncConfig = {
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
  
  log.info(config, "Lineup sync starting");
  
  try {
    await syncDateLineups(config);
    process.exit(0);
  } catch (error) {
    log.error({ error: error.message }, "Lineup sync failed");
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });
}

export { syncGameLineups, syncDateLineups };