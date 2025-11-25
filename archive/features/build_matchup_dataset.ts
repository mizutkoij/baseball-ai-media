#!/usr/bin/env npx tsx
/**
 * 対決予測用データセット構築
 * PA（打席）開始時の特徴量 + Binary到達/アウトラベル生成
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../lib/logger';

const log = logger.child({ job: 'matchup-dataset' });

export interface MatchupRow {
  date: string;
  gameId: string;
  pa_seq: number;
  batterId: string;
  pitcherId: string;
  // 特徴量
  b_hand: 0 | 1; // 打者利き手 (L=0, R=1)
  p_hand: 0 | 1; // 投手利き手 (L=0, R=1)
  b_split7: number; // 打者対左右7日移動平均OBP
  b_split30: number; // 打者対左右30日移動平均OBP
  p_split7: number; // 投手被OBP 7日移動平均
  p_split30: number; // 投手被OBP 30日移動平均
  fi: number; // 疲労指数
  rap14: number; // RAP 14日累積
  inning: number;
  top: 0 | 1; // 表=1, 裏=0
  outs: 0 | 1 | 2;
  bases: number; // 0-7 ベースランナー状況
  scoreDiff: number; // ホーム - アウェイ点差
  park_mult: number; // パーク係数
  leverage: number; // レバレッジ指数
  // ラベル
  y: 0 | 1; // 到達=1（BB,HBP,1B,2B,3B,HR,ROE）/ アウト=0
}

/**
 * 利き手を数値化
 */
function handednessToNumber(hand?: string): 0 | 1 {
  return hand === 'L' ? 0 : 1; // Left=0, Right=1
}

/**
 * ベース状況をビット表現に変換（1塁=1, 2塁=2, 3塁=4）
 */
function basesToNumber(bases?: { first?: boolean; second?: boolean; third?: boolean }): number {
  if (!bases) return 0;
  return (bases.first ? 1 : 0) + (bases.second ? 2 : 0) + (bases.third ? 4 : 0);
}

/**
 * レバレッジ指数の簡易計算
 */
function calculateLeverage(inning: number, outs: number, scoreDiff: number, bases: number): number {
  let li = 1.0;
  
  // イニング効果
  if (inning >= 9) li *= 2.0;
  else if (inning >= 7) li *= 1.5;
  else if (inning >= 6) li *= 1.2;
  
  // スコア差効果
  const absDiff = Math.abs(scoreDiff);
  if (absDiff === 0) li *= 2.0;
  else if (absDiff === 1) li *= 1.8;
  else if (absDiff === 2) li *= 1.4;
  else if (absDiff >= 3) li *= 0.7;
  
  // ランナー効果
  if (bases >= 3) li *= 1.3;
  else if (bases >= 1) li *= 1.1;
  
  // アウト数効果
  if (outs === 2) li *= 1.2;
  
  return Math.max(0.5, Math.min(4.0, li));
}

/**
 * 結果がreachかどうか判定
 */
function isReach(result?: string): boolean {
  if (!result) return false;
  const reachResults = ['BB', 'HBP', '1B', '2B', '3B', 'HR', 'ROE'];
  return reachResults.includes(result);
}

/**
 * 移動平均計算（簡易版）
 */
function calculateMovingAverage(
  playerId: string,
  currentDate: string,
  days: number,
  statType: 'obp' | 'whip' = 'obp'
): number {
  // 実装簡易化：固定値を返す（実際は過去データから計算）
  // TODO: 実際のdata/gamesまたはdata/detailsから統計計算
  const hash = playerId.charCodeAt(0) + currentDate.charCodeAt(0);
  const base = statType === 'obp' ? 0.320 : 1.25; // ベース値
  const variance = (hash % 100) / 1000; // ±0.05の範囲
  return Math.max(0.200, Math.min(0.500, base + variance));
}

/**
 * ゲームの詳細データからPAイベントを抽出
 */
async function extractPAEvents(gameId: string, date: string, baseDir: string): Promise<MatchupRow[]> {
  const detailsPath = path.join(baseDir, 'details', `date=${date}`, gameId, 'latest.json');
  
  try {
    const content = await fs.readFile(detailsPath, 'utf-8');
    const gameData = JSON.parse(content);
    
    if (!gameData.innings || !Array.isArray(gameData.innings)) {
      log.warn({ gameId, date }, 'No innings data found');
      return [];
    }
    
    const rows: MatchupRow[] = [];
    let paSeq = 0;
    
    // パーク係数（簡易版：固定値）
    const parkMult = 1.0; // TODO: 実際の球場係数
    
    for (const inning of gameData.innings) {
      const inningNum = inning.inning || 1;
      
      // 表の攻撃
      if (inning.top && Array.isArray(inning.top.events)) {
        for (const event of inning.top.events) {
          if (event.batterId && event.pitcherId && event.result) {
            const row: MatchupRow = {
              date,
              gameId,
              pa_seq: ++paSeq,
              batterId: event.batterId,
              pitcherId: event.pitcherId,
              b_hand: handednessToNumber(event.batterHand),
              p_hand: handednessToNumber(event.pitcherHand),
              b_split7: calculateMovingAverage(event.batterId, date, 7, 'obp'),
              b_split30: calculateMovingAverage(event.batterId, date, 30, 'obp'),
              p_split7: calculateMovingAverage(event.pitcherId, date, 7, 'whip'),
              p_split30: calculateMovingAverage(event.pitcherId, date, 30, 'whip'),
              fi: Math.random() * 0.6, // TODO: 実際の疲労指数取得
              rap14: Math.random() * 500, // TODO: 実際のRAP取得
              inning: inningNum,
              top: 1,
              outs: event.outs || 0,
              bases: basesToNumber(event.bases),
              scoreDiff: (event.homeScore || 0) - (event.awayScore || 0),
              park_mult: parkMult,
              leverage: calculateLeverage(
                inningNum,
                event.outs || 0,
                (event.homeScore || 0) - (event.awayScore || 0),
                basesToNumber(event.bases)
              ),
              y: isReach(event.result) ? 1 : 0
            };
            rows.push(row);
          }
        }
      }
      
      // 裏の攻撃
      if (inning.bottom && Array.isArray(inning.bottom.events)) {
        for (const event of inning.bottom.events) {
          if (event.batterId && event.pitcherId && event.result) {
            const row: MatchupRow = {
              date,
              gameId,
              pa_seq: ++paSeq,
              batterId: event.batterId,
              pitcherId: event.pitcherId,
              b_hand: handednessToNumber(event.batterHand),
              p_hand: handednessToNumber(event.pitcherHand),
              b_split7: calculateMovingAverage(event.batterId, date, 7, 'obp'),
              b_split30: calculateMovingAverage(event.batterId, date, 30, 'obp'),
              p_split7: calculateMovingAverage(event.pitcherId, date, 7, 'whip'),
              p_split30: calculateMovingAverage(event.pitcherId, date, 30, 'whip'),
              fi: Math.random() * 0.6,
              rap14: Math.random() * 500,
              inning: inningNum,
              top: 0,
              outs: event.outs || 0,
              bases: basesToNumber(event.bases),
              scoreDiff: (event.homeScore || 0) - (event.awayScore || 0),
              park_mult: parkMult,
              leverage: calculateLeverage(
                inningNum,
                event.outs || 0,
                (event.homeScore || 0) - (event.awayScore || 0),
                basesToNumber(event.bases)
              ),
              y: isReach(event.result) ? 1 : 0
            };
            rows.push(row);
          }
        }
      }
    }
    
    return rows;
    
  } catch (error) {
    log.warn({ gameId, date, error: error.message }, 'Failed to process game details');
    return [];
  }
}

/**
 * 期間のデータセットを構築
 */
export async function buildMatchupDataset(
  startDate: string,
  endDate: string,
  baseDir: string = 'data'
): Promise<MatchupRow[]> {
  log.info({ startDate, endDate }, 'Building matchup dataset');
  
  const rows: MatchupRow[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // 日付範囲での処理
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().substring(0, 10).replace(/-/g, '');
    log.debug({ currentDate: currentDate.toISOString(), dateStr }, 'Processing date');
    
    // その日のゲームを取得
    const detailsDir = path.join(baseDir, 'details', `date=${dateStr}`);
    
    try {
      const gameIds = await fs.readdir(detailsDir, { withFileTypes: true });
      const validGameIds = gameIds
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      log.info({ date: dateStr, games: validGameIds.length }, 'Processing date');
      
      if (validGameIds.length === 0) {
        log.debug({ detailsDir }, 'No game directories found');
        continue;
      }
      
      for (const gameId of validGameIds) {
        const gameRows = await extractPAEvents(gameId, dateStr, baseDir);
        rows.push(...gameRows);
      }
      
    } catch (error) {
      log.debug({ date: dateStr, error: error.message }, 'No details found for date');
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  log.info({ totalRows: rows.length }, 'Matchup dataset built');
  return rows;
}

/**
 * データセットをCSVで保存
 */
export async function saveMatchupDataset(rows: MatchupRow[], outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  
  // CSV ヘッダー
  const headers = [
    'date', 'gameId', 'pa_seq', 'batterId', 'pitcherId',
    'b_hand', 'p_hand', 'b_split7', 'b_split30', 'p_split7', 'p_split30',
    'fi', 'rap14', 'inning', 'top', 'outs', 'bases', 'scoreDiff',
    'park_mult', 'leverage', 'y'
  ];
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => [
      row.date, row.gameId, row.pa_seq, row.batterId, row.pitcherId,
      row.b_hand, row.p_hand, row.b_split7.toFixed(3), row.b_split30.toFixed(3),
      row.p_split7.toFixed(3), row.p_split30.toFixed(3), row.fi.toFixed(3),
      row.rap14.toFixed(1), row.inning, row.top, row.outs, row.bases,
      row.scoreDiff, row.park_mult.toFixed(3), row.leverage.toFixed(3), row.y
    ].join(','))
  ].join('\n');
  
  await fs.writeFile(outputPath, csvContent, 'utf-8');
  log.info({ outputPath, rows: rows.length }, 'Matchup dataset saved');
}

/**
 * メイン実行
 */
async function main() {
  const args = process.argv.slice(2);
  const startDate = args[0] || '2025-08-01';
  const endDate = args[1] || '2025-08-12';
  const baseDir = args[2] || 'data';
  
  try {
    console.log('🏗️  対決予測データセット構築');
    console.log(`期間: ${startDate} - ${endDate}`);
    
    const rows = await buildMatchupDataset(startDate, endDate, baseDir);
    
    if (rows.length === 0) {
      console.log('⚠️  データが見つかりませんでした');
      return;
    }
    
    const outputDir = path.join(baseDir, 'ml', 'matchup');
    const outputPath = path.join(outputDir, `train_${endDate.replace(/-/g, '')}.csv`);
    
    await saveMatchupDataset(rows, outputPath);
    
    // サマリー表示
    const reachCount = rows.filter(r => r.y === 1).length;
    const reachRate = (reachCount / rows.length * 100).toFixed(1);
    
    console.log('✅ データセット構築完了');
    console.log(`   総PA数: ${rows.length}`);
    console.log(`   到達数: ${reachCount} (${reachRate}%)`);
    console.log(`   出力: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ データセット構築エラー:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 予期しないエラー:', error);
    process.exit(1);
  });
}