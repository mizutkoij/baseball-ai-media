// lib/rap.ts
/**
 * RAP (Relief Appearance Points) - NPB中継ぎ投手の連投負荷指標
 * だいぱぱブログの定義に準拠：RAP = 球数 × 連投日数補正
 */

import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

const log = logger.child({ job: 'rap' });

export interface ReliefAppearance {
  date: string;
  pitcher_id: string;
  pitcher_name?: string;
  team: string;
  pitches: number;
  is_starter: boolean;
  leverage_index?: number; // LI_entry（登板時点の局面指数）
  game_state?: {
    inning: number;
    outs: number;
    score_diff: number;
    runners: number;
  };
}

export interface RAPMetrics {
  pitcher_id: string;
  date: string;
  // 基本RAP
  rap_day: number;           // その日のRAP
  rap_7d: number;            // 直近7日累積
  rap_14d: number;           // 直近14日累積
  // レバレッジ補正RAP+
  rap_plus_day: number;      // その日のRAP+
  rap_plus_7d: number;       // 直近7日累積RAP+
  rap_plus_14d: number;      // 直近14日累積RAP+
  // メタ情報
  consecutive_days: number;   // 連投日数
  recent_appearances: number; // 直近14日登板数
  risk_level: 'low' | 'medium' | 'high' | 'danger'; // リスクレベル
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 連投日数補正倍率の計算
 * 前日登板=2倍、2日連続=3倍、3日連続=4倍...
 */
export function consecutiveDaysMultiplier(
  pitcherAppearances: ReliefAppearance[],
  targetDate: string
): number {
  
  // 日付フォーマット正規化（YYYYMMDD → YYYY-MM-DD）
  const normalizeDate = (dateStr: string): string => {
    if (dateStr.length === 8 && !dateStr.includes('-')) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    return dateStr;
  };
  
  const normalizedTarget = normalizeDate(targetDate);
  
  const sorted = pitcherAppearances
    .filter(app => normalizeDate(app.date) <= normalizedTarget)
    .sort((a, b) => normalizeDate(b.date).localeCompare(normalizeDate(a.date))); // 新しい順
  
  if (sorted.length === 0) return 1;
  
  // ターゲット日が登板履歴に含まれているかチェック
  const targetAppearance = sorted.find(app => normalizeDate(app.date) === normalizedTarget);
  if (!targetAppearance) {
    return 1; // その日に登板していなければ1倍
  }
  
  let consecutiveDays = 1;
  let currentDate = new Date(normalizedTarget);
  
  // ターゲット日から逆算して連続登板日数を計算
  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(normalizeDate(sorted[i].date));
    const expectedPrevDate = new Date(currentDate);
    expectedPrevDate.setDate(expectedPrevDate.getDate() - 1);
    
    // 前日に登板があるかチェック
    if (prevDate.getTime() === expectedPrevDate.getTime()) {
      consecutiveDays++;
      currentDate = prevDate;
    } else {
      break; // 連続登板が途切れた
    }
  }
  
  return consecutiveDays;
}

/**
 * Leverage Index (LI) の簡易計算
 * 正式なgmLIがない場合のWE基準近似
 */
export function approximateLeverageIndex(gameState?: RAPMetrics['game_state']): number {
  if (!gameState) return 1.0; // デフォルト
  
  const { inning, outs, score_diff, runners } = gameState;
  
  // 基本LI計算（簡易版）
  let li = 1.0;
  
  // イニング効果（終盤ほど高い）
  if (inning >= 9) li *= 2.0;
  else if (inning >= 7) li *= 1.5;
  else if (inning >= 6) li *= 1.2;
  
  // スコア差効果（接戦ほど高い）
  const absDiff = Math.abs(score_diff);
  if (absDiff === 0) li *= 2.0;
  else if (absDiff === 1) li *= 1.8;
  else if (absDiff === 2) li *= 1.4;
  else if (absDiff >= 3) li *= 0.7;
  
  // ランナー効果
  if (runners >= 3) li *= 1.3; // 満塁近い
  else if (runners >= 1) li *= 1.1;
  
  // アウト数効果（2アウトほど高い）
  if (outs === 2) li *= 1.2;
  
  return Math.max(0.5, Math.min(4.0, li)); // 0.5-4.0でクリップ
}

/**
 * 単日RAP計算
 */
export function calculateDayRAP(
  appearances: ReliefAppearance[],
  pitcherId: string,
  date: string
): { rap: number; rapPlus: number; multiplier: number; leverage: number } {
  
  const pitcherApps = appearances.filter(app => app.pitcher_id === pitcherId);
  const dayApp = pitcherApps.find(app => app.date === date);
  
  if (!dayApp || dayApp.is_starter) {
    // 先発投手またはその日の登板なし
    return { rap: 0, rapPlus: 0, multiplier: 1, leverage: 1 };
  }
  
  const pitches = dayApp.pitches;
  const multiplier = consecutiveDaysMultiplier(pitcherApps, date);
  const leverage = dayApp.leverage_index ?? approximateLeverageIndex(dayApp.game_state);
  
  // RAP = 球数 × 連投補正
  const rap = pitches * multiplier;
  
  // RAP+ = RAP × レバレッジ補正（α=0.3）
  const leverageMultiplier = 1 + 0.3 * (leverage - 1);
  const rapPlus = rap * leverageMultiplier;
  
  log.debug({
    pitcher_id: pitcherId,
    date,
    pitches,
    consecutive_multiplier: multiplier,
    leverage_index: leverage.toFixed(2),
    rap: rap.toFixed(1),
    rap_plus: rapPlus.toFixed(1)
  }, 'RAP calculated for day');
  
  return { rap, rapPlus, multiplier, leverage };
}

/**
 * 期間累積RAP計算
 */
export function calculateRollingRAP(
  appearances: ReliefAppearance[],
  pitcherId: string,
  endDate: string,
  days: number
): { rap: number; rapPlus: number; appearances: number } {
  
  // 日付フォーマット正規化
  const normalizeDate = (dateStr: string): string => {
    if (dateStr.length === 8 && !dateStr.includes('-')) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    return dateStr;
  };
  
  const normalizedEndDate = normalizeDate(endDate);
  const endDateObj = new Date(normalizedEndDate);
  const startDateObj = new Date(endDateObj);
  startDateObj.setDate(startDateObj.getDate() - days + 1);
  
  let totalRAP = 0;
  let totalRAPPlus = 0;
  let appCount = 0;
  
  // 期間内の各日をチェック
  const currentDate = new Date(startDateObj);
  while (currentDate <= endDateObj) {
    const dateStr = currentDate.toISOString().substring(0, 10).replace(/-/g, '');
    const dayResult = calculateDayRAP(appearances, pitcherId, dateStr);
    
    if (dayResult.rap > 0) {
      totalRAP += dayResult.rap;
      totalRAPPlus += dayResult.rapPlus;
      appCount++;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    rap: totalRAP,
    rapPlus: totalRAPPlus,
    appearances: appCount
  };
}

/**
 * リスクレベル判定
 */
export function assessRiskLevel(rap14d: number, rapPlus14d: number): RAPMetrics['risk_level'] {
  // だいぱぱブログ基準（初期値、後でNPB分布で校正）
  if (rapPlus14d >= 1700) return 'danger';   // 非常に危険
  if (rapPlus14d >= 1200) return 'high';     // 高リスク
  if (rapPlus14d >= 800) return 'medium';    // 中リスク
  return 'low';                              // 低リスク
}

/**
 * 投手のRAP指標を計算
 */
export async function computePitcherRAP(
  pitcherId: string,
  date: string,
  appearances: ReliefAppearance[]
): Promise<RAPMetrics> {
  
  // その日のRAP
  const dayResult = calculateDayRAP(appearances, pitcherId, date);
  
  // 期間累積RAP
  const rap7d = calculateRollingRAP(appearances, pitcherId, date, 7);
  const rap14d = calculateRollingRAP(appearances, pitcherId, date, 14);
  
  // リスクレベル判定
  const riskLevel = assessRiskLevel(rap14d.rap, rap14d.rapPlus);
  
  // 信頼度評価（登板データの質による）
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  const recentApps = appearances.filter(app => 
    app.pitcher_id === pitcherId && !app.is_starter &&
    app.date <= date && 
    new Date(date).getTime() - new Date(app.date).getTime() <= 14 * 24 * 60 * 60 * 1000
  );
  
  const dataQuality = recentApps.filter(app => app.pitches > 0).length / Math.max(1, recentApps.length);
  if (dataQuality > 0.8 && recentApps.length >= 3) {
    confidence = 'high';
  } else if (dataQuality < 0.5 || recentApps.length < 2) {
    confidence = 'low';
  }
  
  return {
    pitcher_id: pitcherId,
    date,
    rap_day: dayResult.rap,
    rap_7d: rap7d.rap,
    rap_14d: rap14d.rap,
    rap_plus_day: dayResult.rapPlus,
    rap_plus_7d: rap7d.rapPlus,
    rap_plus_14d: rap14d.rapPlus,
    consecutive_days: dayResult.multiplier,
    recent_appearances: rap14d.appearances,
    risk_level: riskLevel,
    confidence
  };
}

/**
 * チーム全体の中継ぎRAP計算
 */
export async function computeTeamRAP(
  team: string,
  date: string,
  appearances: ReliefAppearance[]
): Promise<RAPMetrics[]> {
  
  // チームの中継ぎ投手一覧
  const relievers = Array.from(new Set(
    appearances
      .filter(app => app.team === team && !app.is_starter)
      .map(app => app.pitcher_id)
  ));
  
  const results: RAPMetrics[] = [];
  
  for (const pitcherId of relievers) {
    try {
      const rapMetrics = await computePitcherRAP(pitcherId, date, appearances);
      results.push(rapMetrics);
    } catch (error) {
      log.warn({ pitcher_id: pitcherId, error: error.message }, 'Failed to compute RAP for pitcher');
    }
  }
  
  log.info({
    team,
    date,
    relievers_analyzed: results.length,
    high_risk: results.filter(r => r.risk_level === 'high' || r.risk_level === 'danger').length
  }, 'Team RAP computation completed');
  
  return results;
}

/**
 * RAP履歴の読み込み（キャッシュ機能）
 */
export async function loadRAPHistory(
  date: string,
  baseDir: string = process.env.DATA_DIR ?? "data"
): Promise<ReliefAppearance[]> {
  
  try {
    // キャッシュから読み込み
    const cachePath = path.join(baseDir, "derived", "rap", `date=${date}`, "appearances.json");
    const content = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(content);
    
  } catch {
    // キャッシュがない場合は既存のappearanceデータから変換
    try {
      const appsPath = path.join(baseDir, "derived", "appearances", `date=${date}`, "apps.json");
      const apps = JSON.parse(await fs.readFile(appsPath, "utf-8"));
      
      // ReliefAppearance形式に変換
      return apps
        .filter(app => !app.is_starter) // 中継ぎのみ
        .map(app => ({
          date: app.date,
          pitcher_id: app.pitcher_id ?? `${app.team}_pitcher_${Math.random()}`,
          pitcher_name: app.pitcher_name,
          team: app.team,
          pitches: app.pitches ?? 25, // デフォルト球数
          is_starter: false,
          leverage_index: app.leverage_index
        }));
        
    } catch {
      log.warn({ date }, 'No appearance data found for RAP calculation');
      return [];
    }
  }
}

/**
 * RAP指標のキャッシュ保存
 */
export async function saveRAPMetrics(
  date: string,
  metrics: RAPMetrics[],
  baseDir: string = process.env.DATA_DIR ?? "data"
): Promise<void> {
  
  const outputDir = path.join(baseDir, "derived", "rap", `date=${date}`);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, "rap_metrics.json");
  const output = {
    date,
    generated_at: new Date().toISOString(),
    total_pitchers: metrics.length,
    risk_distribution: {
      low: metrics.filter(m => m.risk_level === 'low').length,
      medium: metrics.filter(m => m.risk_level === 'medium').length,
      high: metrics.filter(m => m.risk_level === 'high').length,
      danger: metrics.filter(m => m.risk_level === 'danger').length
    },
    metrics
  };
  
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
  
  log.info({
    date,
    pitchers: metrics.length,
    high_risk: output.risk_distribution.high + output.risk_distribution.danger
  }, 'RAP metrics cached');
}

/**
 * デバッグ用：RAP指標の表示
 */
export function debugRAPMetrics(rap: RAPMetrics): void {
  console.log('=== RAP Metrics Debug ===');
  console.log(`Pitcher: ${rap.pitcher_id}, Date: ${rap.date}`);
  console.log(`Risk Level: ${rap.risk_level.toUpperCase()} (${rap.confidence})`);
  console.log('Basic RAP:');
  console.log(`  Day: ${rap.rap_day.toFixed(1)}`);
  console.log(`  7d:  ${rap.rap_7d.toFixed(1)}`);
  console.log(`  14d: ${rap.rap_14d.toFixed(1)}`);
  console.log('RAP+ (Leverage-adjusted):');
  console.log(`  Day: ${rap.rap_plus_day.toFixed(1)}`);
  console.log(`  7d:  ${rap.rap_plus_7d.toFixed(1)}`);
  console.log(`  14d: ${rap.rap_plus_14d.toFixed(1)}`);
  console.log('Activity:');
  console.log(`  Consecutive Days: ${rap.consecutive_days}`);
  console.log(`  Recent Appearances: ${rap.recent_appearances}`);
  console.log('');
}