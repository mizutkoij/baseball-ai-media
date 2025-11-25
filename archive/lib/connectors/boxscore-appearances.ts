#!/usr/bin/env npx tsx
/**
 * ボックススコア登板ログ・球数コネクター
 * RAP/疲労システムの一次ソース確実化
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { logger } from "../logger";
import { retryWithBackoff } from "../retry-utils";

const log = logger.child({ component: "boxscore-appearances" });

export interface PitcherAppearance {
  gameId: string;
  date: string;
  pitcherId: string;
  pitcherName: string;
  teamId: string;
  role: "starter" | "reliever" | "closer";
  inningsWorked: number; // 1.0 = 1回, 0.33 = 1/3回
  pitches: number; // 総投球数
  battersFaced: number; // 対戦打者数
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  decision: "W" | "L" | "S" | "H" | "BS" | ""; // Win/Loss/Save/Hold/BlownSave
  gameScore?: number; // Bill James Game Score
  leverage: "low" | "medium" | "high"; // 登板場面の重要度
  restDays: number; // 前回登板からの日数
  consecutiveGames: number; // 連続登板数
  timestamp: string;
  source: "official" | "estimated";
}

export interface TeamBullpenStatus {
  teamId: string;
  date: string;
  pitchers: Array<{
    pitcherId: string;
    pitcherName: string;
    availability: "available" | "tired" | "unavailable";
    restDays: number;
    recentWorkload: number; // 過去7日間の投球数
    rapScore: number; // RAP累積スコア
    fatigueIndex: number; // 疲労指数 (0-100)
  }>;
  overallStrength: number; // ブルペン全体の強度 (0-100)
  lastUpdate: string;
}

/**
 * 投球回数を小数に変換
 */
function parseInnings(inningsStr: string): number {
  const parts = inningsStr.trim().split('.');
  const wholeInnings = parseInt(parts[0]) || 0;
  const fractionalInnings = parts[1] ? parseInt(parts[1]) : 0;
  
  return wholeInnings + (fractionalInnings / 3);
}

/**
 * Game Scoreを計算（Bill James式）
 */
function calculateGameScore(stats: {
  inningsWorked: number;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
}): number {
  let score = 50; // ベース
  score += stats.inningsWorked * 3; // 投球回×3
  score += stats.strikeouts * 1; // 奪三振×1
  score -= stats.hits * 2; // 被安打×2
  score -= stats.runs * 4; // 失点×4
  score -= stats.earnedRuns * 2; // 自責点×2  
  score -= stats.walks * 1; // 四球×1
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * 登板場面の重要度を判定
 */
function assessLeverage(inning: number, scoreDiff: number, runners: number): "low" | "medium" | "high" {
  // 9回以降 + 接戦 + 走者ありなら high
  if (inning >= 9 && Math.abs(scoreDiff) <= 3 && runners > 0) return "high";
  
  // 7-8回の接戦または延長戦
  if ((inning >= 7 && Math.abs(scoreDiff) <= 2) || inning >= 10) return "medium";
  
  // その他
  return "low";
}

/**
 * NPB公式サイトからボックススコアを取得
 */
export async function fetchBoxscoreAppearances(gameId: string, date: string): Promise<PitcherAppearance[] | null> {
  const startTime = Date.now();
  
  try {
    const url = `https://npb.jp/game/${date.replace(/-/g, "")}/${gameId}/box/`;
    
    log.info({ gameId, date, url }, "Fetching boxscore appearances");
    
    const response = await retryWithBackoff(
      () => fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NPB-Data-Collector/1.0)'
        }
      }),
      { maxRetries: 3, baseDelay: 1000 }
    );
    
    if (!response.ok) {
      log.warn({ gameId, status: response.status }, "Boxscore not available");
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const appearances: PitcherAppearance[] = [];
    
    // 投手成績表を解析（ホーム・ビジター両方）
    $('.pitcher-stats table tr, .pitching-stats tr').each((_, element) => {
      const $row = $(element);
      
      // ヘッダー行はスキップ
      if ($row.find('th').length > 0) return;
      
      const cells = $row.find('td');
      if (cells.length < 8) return; // 最低限の列数チェック
      
      try {
        const pitcherName = $(cells[0]).text().trim();
        const inningsStr = $(cells[1]).text().trim();
        const pitches = parseInt($(cells[2]).text().trim()) || 0;
        const battersFaced = parseInt($(cells[3]).text().trim()) || 0;
        const hits = parseInt($(cells[4]).text().trim()) || 0;
        const runs = parseInt($(cells[5]).text().trim()) || 0;
        const earnedRuns = parseInt($(cells[6]).text().trim()) || 0;
        const walks = parseInt($(cells[7]).text().trim()) || 0;
        const strikeouts = parseInt($(cells[8]).text().trim()) || 0;
        const decisionStr = $(cells[9]).text().trim();
        
        if (!pitcherName || !inningsStr) return;
        
        const inningsWorked = parseInnings(inningsStr);
        const gameScore = calculateGameScore({
          inningsWorked, hits, runs, earnedRuns, walks, strikeouts
        });
        
        // 先発/リリーフの判定
        const role: "starter" | "reliever" | "closer" = 
          inningsWorked >= 4.0 ? "starter" :
          decisionStr.includes("S") ? "closer" : 
          "reliever";
        
        // 勝敗記録のパース
        let decision: "W" | "L" | "S" | "H" | "BS" | "" = "";
        if (decisionStr.includes("W")) decision = "W";
        else if (decisionStr.includes("L")) decision = "L";
        else if (decisionStr.includes("S")) decision = "S";
        else if (decisionStr.includes("H")) decision = "H";
        else if (decisionStr.includes("BS")) decision = "BS";
        
        // レバレッジは簡易計算（実際にはイニング情報が必要）
        const leverage = assessLeverage(
          role === "starter" ? 5 : 8, // 推定イニング
          0, // スコア差不明
          0  // 走者不明
        );
        
        const appearance: PitcherAppearance = {
          gameId,
          date,
          pitcherId: `p_${gameId}_${pitcherName.replace(/\s+/g, "")}`,
          pitcherName,
          teamId: $row.closest('.home-team, .away-team').hasClass('home-team') ? 'home' : 'away',
          role,
          inningsWorked,
          pitches,
          battersFaced,
          hits,
          runs,
          earnedRuns,
          walks,
          strikeouts,
          decision,
          gameScore,
          leverage,
          restDays: 0, // 後で計算
          consecutiveGames: 0, // 後で計算
          timestamp: new Date().toISOString(),
          source: "official"
        };
        
        appearances.push(appearance);
        
      } catch (parseError) {
        log.debug({ 
          gameId, 
          row: $row.text(), 
          error: parseError.message 
        }, "Failed to parse pitcher row");
      }
    });
    
    log.info({ 
      gameId, 
      pitchers: appearances.length,
      latency: Date.now() - startTime
    }, "Boxscore appearances extracted");
    
    return appearances.length > 0 ? appearances : null;
    
  } catch (error) {
    log.error({ 
      gameId, 
      error: error.message,
      latency: Date.now() - startTime 
    }, "Boxscore fetch failed");
    
    return null;
  }
}

/**
 * 過去の登板データから休養日・連続登板を計算
 */
export async function calculatePitcherWorkload(
  pitcherId: string, 
  currentDate: string,
  appearances: PitcherAppearance[]
): Promise<{ restDays: number; consecutiveGames: number; recentWorkload: number }> {
  
  // 該当投手の過去30日間の登板を時系列順に取得
  const cutoffDate = new Date(currentDate);
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  
  const pitcherAppearances = appearances
    .filter(app => 
      app.pitcherId === pitcherId && 
      new Date(app.date) >= cutoffDate &&
      new Date(app.date) < new Date(currentDate)
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (pitcherAppearances.length === 0) {
    return { restDays: 10, consecutiveGames: 0, recentWorkload: 0 }; // デフォルト値
  }
  
  // 最後の登板からの休養日
  const lastAppearance = pitcherAppearances[pitcherAppearances.length - 1];
  const lastDate = new Date(lastAppearance.date);
  const current = new Date(currentDate);
  const restDays = Math.floor((current.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // 連続登板数（直近から遡って連続している日数）
  let consecutiveGames = 0;
  const checkDate = new Date(currentDate);
  checkDate.setDate(checkDate.getDate() - 1); // 昨日から開始
  
  while (consecutiveGames < 10) { // 最大10日チェック
    const dateStr = checkDate.toISOString().slice(0, 10);
    const hasAppearance = pitcherAppearances.some(app => app.date === dateStr);
    
    if (hasAppearance) {
      consecutiveGames++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  // 過去7日間の投球数
  const sevenDaysAgo = new Date(currentDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentWorkload = pitcherAppearances
    .filter(app => new Date(app.date) >= sevenDaysAgo)
    .reduce((total, app) => total + app.pitches, 0);
  
  return { restDays, consecutiveGames, recentWorkload };
}

/**
 * チームのブルペン状況を評価
 */
export function assessBullpenStatus(
  teamId: string,
  date: string,
  pitchers: Array<{
    pitcherId: string;
    pitcherName: string;
    restDays: number;
    recentWorkload: number;
    role: string;
  }>
): TeamBullpenStatus {
  
  const bullpenPitchers = pitchers.map(p => {
    // 疲労指数計算 (0-100)
    let fatigueIndex = 0;
    
    // 休養日が少ないほど疲労増
    if (p.restDays === 0) fatigueIndex += 40;
    else if (p.restDays === 1) fatigueIndex += 25;
    else if (p.restDays === 2) fatigueIndex += 15;
    
    // 最近の投球数による疲労
    fatigueIndex += Math.min(40, p.recentWorkload / 2);
    
    // 可用性判定
    let availability: "available" | "tired" | "unavailable" = "available";
    if (fatigueIndex >= 70) availability = "unavailable";
    else if (fatigueIndex >= 40) availability = "tired";
    
    // 簡易RAP計算（詳細な実装は別途）
    const rapScore = Math.max(0, 100 - fatigueIndex);
    
    return {
      pitcherId: p.pitcherId,
      pitcherName: p.pitcherName,
      availability,
      restDays: p.restDays,
      recentWorkload: p.recentWorkload,
      rapScore,
      fatigueIndex
    };
  });
  
  // ブルペン全体の強度計算
  const availablePitchers = bullpenPitchers.filter(p => p.availability === "available").length;
  const totalPitchers = bullpenPitchers.length;
  const avgRap = bullpenPitchers.reduce((sum, p) => sum + p.rapScore, 0) / totalPitchers;
  
  const overallStrength = Math.round(
    (availablePitchers / Math.max(totalPitchers, 1)) * 50 + avgRap * 0.5
  );
  
  return {
    teamId,
    date,
    pitchers: bullpenPitchers,
    overallStrength,
    lastUpdate: new Date().toISOString()
  };
}

export default {
  fetchBoxscoreAppearances,
  calculatePitcherWorkload,
  assessBullpenStatus,
  parseInnings,
  calculateGameScore
};