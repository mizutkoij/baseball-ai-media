// lib/fatigue-index.ts
/**
 * 投手疲労指数計算：球数・連投・休養日から疲労度(0-1)を算出
 * 高い値ほど疲労が蓄積している状態
 */

import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

const log = logger.child({ job: 'fatigue-index' });

export interface PitcherAppearance {
  date: string;
  pitcher_id: string;
  pitcher_name?: string;
  team: string;
  is_starter: boolean;
  pitches?: number;
  innings_pitched?: number;
  batters_faced?: number;
  game_result?: 'W' | 'L' | 'ND';
  era?: number;
}

export interface FatigueIndex {
  pitcher_id: string;
  date: string;
  fatigue_index: number; // 0-1, higher = more fatigued
  confidence: 'high' | 'medium' | 'low';
  components: {
    pitch_load: number;      // Recent pitch count load
    rest_deficit: number;    // Rest days vs optimal
    b2b_factor: number;      // Back-to-back penalty
    workload_trend: number;  // Recent workload trend
    rap_chronic: number;     // RAP chronic load component
  };
  recent_appearances: number;
  total_pitches_7d: number;
  days_since_last: number;
}

export interface FatigueParams {
  lookback_days: number;
  pitch_count_weight: number;
  rest_days_weight: number;
  b2b_penalty: number;
  max_daily_pitches: number;
  optimal_rest_days: number;
  default_pitches_per_appearance: number;
}

/**
 * 日付間の日数差を計算
 */
function daysBetween(dateA: string, dateB: string): number {
  return Math.floor((Date.parse(dateA) - Date.parse(dateB)) / 86400000);
}

/**
 * 投手の疲労指数を計算
 */
export async function computePitcherFatigue(
  pitcherId: string,
  currentDate: string,
  appearances: PitcherAppearance[],
  params: FatigueParams
): Promise<FatigueIndex> {
  
  // 期間内の登板のみフィルタ
  const recentApps = appearances
    .filter(app => 
      app.pitcher_id === pitcherId && 
      daysBetween(currentDate, app.date) >= 0 &&
      daysBetween(currentDate, app.date) <= params.lookback_days
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  
  if (recentApps.length === 0) {
    return {
      pitcher_id: pitcherId,
      date: currentDate,
      fatigue_index: 0,
      confidence: 'low',
      components: {
        pitch_load: 0,
        rest_deficit: 0,
        b2b_factor: 0,
        workload_trend: 0,
        rap_chronic: 0
      },
      recent_appearances: 0,
      total_pitches_7d: 0,
      days_since_last: 999
    };
  }
  
  const lastApp = recentApps[recentApps.length - 1];
  const daysSinceLast = daysBetween(currentDate, lastApp.date);
  
  // 1. 球数負荷計算
  let totalPitches = 0;
  let weightedPitchLoad = 0;
  
  for (const app of recentApps) {
    const pitches = app.pitches ?? params.default_pitches_per_appearance;
    const daysAgo = daysBetween(currentDate, app.date);
    const decayWeight = Math.exp(-daysAgo / 3); // 3日半減期
    
    totalPitches += pitches;
    weightedPitchLoad += pitches * decayWeight;
  }
  
  const pitchLoad = Math.min(1, weightedPitchLoad / (params.max_daily_pitches * 0.7));
  
  // 2. 休養不足計算
  const restDeficit = Math.max(0, 
    (params.optimal_rest_days - daysSinceLast) / params.optimal_rest_days
  );
  
  // 3. 連投ペナルティ
  let b2bFactor = 0;
  if (recentApps.length >= 2) {
    for (let i = 1; i < recentApps.length; i++) {
      const prevApp = recentApps[i - 1];
      const currApp = recentApps[i];
      const daysBetweenApps = daysBetween(currApp.date, prevApp.date);
      
      if (daysBetweenApps <= 1) {
        b2bFactor += params.b2b_penalty * Math.exp(-(daysBetween(currentDate, currApp.date) / 2));
      }
    }
  }
  b2bFactor = Math.min(1, b2bFactor);
  
  // 4. ワークロード傾向
  let workloadTrend = 0;
  if (recentApps.length >= 3) {
    const recent3 = recentApps.slice(-3);
    const earlyAvg = recent3.slice(0, 1).reduce((sum, app) => 
      sum + (app.pitches ?? params.default_pitches_per_appearance), 0) / 1;
    const lateAvg = recent3.slice(-2).reduce((sum, app) => 
      sum + (app.pitches ?? params.default_pitches_per_appearance), 0) / 2;
    
    workloadTrend = Math.max(0, (lateAvg - earlyAvg) / params.max_daily_pitches);
  }
  
  // RAP慢性負荷成分の追加
  let rapChronicComponent = 0;
  try {
    // RAP指標を取得して正規化（中継ぎのみ）
    const isReliever = recentApps.some(app => !app.is_starter);
    if (isReliever) {
      // 簡易RAP計算（詳細はlib/rapで実装）
      const totalPitches14d = recentApps.reduce((sum, app) => 
        sum + (app.pitches ?? params.default_pitches_per_appearance), 0);
      
      // RAP近似：14日累積球数 × 平均連投補正（簡易版）
      const avgMultiplier = recentApps.length > 0 ? 1.5 : 1; // 連投多い想定
      const approximateRAP14d = totalPitches14d * avgMultiplier;
      
      // 正規化（1400を基準とした0-1スケール）
      rapChronicComponent = Math.min(1, approximateRAP14d / 1400);
    }
  } catch (error) {
    // RAP計算エラー時は0で継続
    rapChronicComponent = 0;
  }

  // 総合疲労指数計算（RAP成分追加）
  const fatigueIndex = Math.min(1, 
    params.pitch_count_weight * pitchLoad +
    params.rest_days_weight * restDeficit +
    0.2 * b2bFactor +
    0.1 * workloadTrend +
    0.15 * rapChronicComponent  // RAP慢性成分（中継ぎ専用）
  );
  
  // 信頼度評価
  let confidence: 'high' | 'medium' | 'low' = 'low';
  const dataQuality = recentApps.filter(app => app.pitches != null).length / recentApps.length;
  
  if (dataQuality > 0.8 && recentApps.length >= 3) {
    confidence = 'high';
  } else if (dataQuality > 0.5 && recentApps.length >= 2) {
    confidence = 'medium';
  }
  
  return {
    pitcher_id: pitcherId,
    date: currentDate,
    fatigue_index: fatigueIndex,
    confidence,
    components: {
      pitch_load: pitchLoad,
      rest_deficit: restDeficit,
      b2b_factor: b2bFactor,
      workload_trend: workloadTrend,
      rap_chronic: rapChronicComponent
    },
    recent_appearances: recentApps.length,
    total_pitches_7d: totalPitches,
    days_since_last: daysSinceLast
  };
}

/**
 * 登板データを読み込み（既存のdetailsから抽出想定）
 */
async function loadPitcherAppearances(
  date: string,
  baseDir: string
): Promise<PitcherAppearance[]> {
  
  try {
    // まずキャッシュから試行
    const cachePath = path.join(baseDir, "derived", "appearances", `date=${date}`, "pitchers.json");
    const content = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(content);
    
  } catch {
    // キャッシュがない場合は空配列（実際は詳細データから生成）
    log.debug({ date }, 'No pitcher appearance cache found');
    return [];
  }
}

/**
 * 特定投手の疲労指数を取得（キャッシュ機能付き）
 */
export async function getPitcherFatigueIndex(
  pitcherId: string,
  date: string,
  baseDir: string = process.env.DATA_DIR ?? "data",
  params?: FatigueParams
): Promise<FatigueIndex> {
  
  const defaultParams: FatigueParams = {
    lookback_days: 10,
    pitch_count_weight: 0.7,
    rest_days_weight: 0.3,
    b2b_penalty: 1.5,
    max_daily_pitches: 120,
    optimal_rest_days: 4,
    default_pitches_per_appearance: 25
  };
  
  const effectiveParams = params ?? defaultParams;
  
  // キャッシュチェック
  const cacheDir = path.join(baseDir, "derived", "fatigue", `date=${date}`);
  const cachePath = path.join(cacheDir, `${pitcherId}.json`);
  
  try {
    const content = await fs.readFile(cachePath, "utf-8");
    const cached: FatigueIndex = JSON.parse(content);
    
    log.debug({ pitcher_id: pitcherId, date, fatigue: cached.fatigue_index }, 'Fatigue index from cache');
    return cached;
    
  } catch {
    // キャッシュミス - 新規計算
    try {
      const appearances = await loadPitcherAppearances(date, baseDir);
      const fatigueIndex = await computePitcherFatigue(pitcherId, date, appearances, effectiveParams);
      
      // キャッシュに保存
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(fatigueIndex, null, 2), "utf-8");
      
      log.info({ 
        pitcher_id: pitcherId, 
        date, 
        fatigue: fatigueIndex.fatigue_index.toFixed(3),
        confidence: fatigueIndex.confidence
      }, 'Fatigue index computed and cached');
      
      return fatigueIndex;
      
    } catch (error) {
      // 計算エラー時はデフォルト値
      log.warn({ 
        pitcher_id: pitcherId, 
        date, 
        error: error.message 
      }, 'Failed to compute fatigue index, using default');
      
      return {
        pitcher_id: pitcherId,
        date,
        fatigue_index: 0.5, // 中立値
        confidence: 'low',
        components: {
          pitch_load: 0.5,
          rest_deficit: 0.5,
          b2b_factor: 0,
          workload_trend: 0,
          rap_chronic: 0
        },
        recent_appearances: 0,
        total_pitches_7d: 0,
        days_since_last: 999
      };
    }
  }
}

/**
 * 全投手の疲労指数をバッチ計算
 */
export async function computeAllPitcherFatigue(
  date: string,
  baseDir: string = process.env.DATA_DIR ?? "data"
): Promise<FatigueIndex[]> {
  
  const appearances = await loadPitcherAppearances(date, baseDir);
  const pitcherIds = Array.from(new Set(appearances.map(app => app.pitcher_id)));
  
  const results: FatigueIndex[] = [];
  
  for (const pitcherId of pitcherIds) {
    try {
      const fatigueIndex = await getPitcherFatigueIndex(pitcherId, date, baseDir);
      results.push(fatigueIndex);
    } catch (error) {
      log.error({ pitcher_id: pitcherId, error: error.message }, 'Failed to compute fatigue for pitcher');
    }
  }
  
  log.info({ date, pitchers_computed: results.length }, 'Batch fatigue computation completed');
  return results;
}

/**
 * デバッグ用：疲労指数の詳細表示
 */
export function debugFatigueIndex(fatigue: FatigueIndex): void {
  console.log('=== Pitcher Fatigue Debug ===');
  console.log(`Pitcher: ${fatigue.pitcher_id}, Date: ${fatigue.date}`);
  console.log(`Overall Fatigue: ${fatigue.fatigue_index.toFixed(3)} (${fatigue.confidence})`);
  console.log('Components:');
  console.log(`  Pitch Load: ${fatigue.components.pitch_load.toFixed(3)}`);
  console.log(`  Rest Deficit: ${fatigue.components.rest_deficit.toFixed(3)}`);
  console.log(`  B2B Factor: ${fatigue.components.b2b_factor.toFixed(3)}`);
  console.log(`  Workload Trend: ${fatigue.components.workload_trend.toFixed(3)}`);
  console.log(`  RAP Chronic: ${fatigue.components.rap_chronic.toFixed(3)}`);
  console.log('Recent Activity:');
  console.log(`  Appearances (10d): ${fatigue.recent_appearances}`);
  console.log(`  Total Pitches (7d): ${fatigue.total_pitches_7d}`);
  console.log(`  Days Since Last: ${fatigue.days_since_last}`);
  console.log('');
}