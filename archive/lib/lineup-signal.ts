// lib/lineup-signal.ts
/**
 * 先発オーダー確定状況の抽出
 * lineupデータまたはdetailsの観測打者数から判定
 */

import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

const log = logger.child({ job: 'lineup-signal' });

export type LineupSignal = { 
  status: "unknown" | "partial" | "confirmed"; 
  completeness: number; 
};

/**
 * 先発オーダーの確定状況を取得
 */
export async function getLineupSignal(
  baseDir: string, 
  date: string, 
  gameId: string
): Promise<LineupSignal> {
  
  // 1) 公式または自前のlineup保存（存在すればそれが最優先）
  const lineupPath = path.join(baseDir, "lineups", `date=${date}`, gameId, "latest.json");
  try {
    const lineupContent = await fs.readFile(lineupPath, "utf-8");
    const lineupData = JSON.parse(lineupContent);
    
    const battingOrderCount = Array.isArray(lineupData?.battingOrder) 
      ? lineupData.battingOrder.filter(Boolean).length 
      : 0;
    
    if (battingOrderCount >= 9) {
      log.debug({ gameId, date, source: 'lineup', count: battingOrderCount }, 'Confirmed lineup from lineup data');
      return { status: "confirmed", completeness: 1 };
    }
    
    if (battingOrderCount > 0) {
      const completeness = Math.min(1, battingOrderCount / 9);
      log.debug({ gameId, date, source: 'lineup', count: battingOrderCount, completeness }, 'Partial lineup from lineup data');
      return { status: "partial", completeness };
    }
  } catch (error) {
    // ファイルが存在しない場合は無視
    log.debug({ gameId, date, error: error.message }, 'No lineup data found');
  }

  // 2) 代替：detailsから"第1打席観測数"で暫定（先頭～数人が入れば partial）
  const detailsPath = path.join(baseDir, "details", `date=${date}`, gameId, "latest.json");
  try {
    const detailsContent = await fs.readFile(detailsPath, "utf-8");
    const detailsData = JSON.parse(detailsContent);
    
    const observedBatters = Number(detailsData?.observedBatters ?? 0);
    
    if (observedBatters >= 9) {
      log.debug({ gameId, date, source: 'details', observed: observedBatters }, 'Confirmed lineup from observed batters');
      return { status: "confirmed", completeness: 1 };
    }
    
    if (observedBatters > 0) {
      const completeness = Math.min(1, observedBatters / 9);
      log.debug({ gameId, date, source: 'details', observed: observedBatters, completeness }, 'Partial lineup from observed batters');
      return { status: "partial", completeness };
    }
  } catch (error) {
    // ファイルが存在しない場合は無視
    log.debug({ gameId, date, error: error.message }, 'No details data found');
  }

  log.debug({ gameId, date }, 'Unknown lineup status');
  return { status: "unknown", completeness: 0 };
}

/**
 * チーム別のlineup状況を取得（デバッグ用）
 */
export async function getTeamLineupSignals(
  baseDir: string,
  date: string,
  homeTeam: string,
  awayTeam: string,
  gameId: string
): Promise<{ home: LineupSignal; away: LineupSignal }> {
  
  // 現在の実装では両チーム共通の情報を返す
  // 将来的にはチーム別のlineupデータから個別に判定可能
  const signal = await getLineupSignal(baseDir, date, gameId);
  
  return {
    home: signal,
    away: signal
  };
}