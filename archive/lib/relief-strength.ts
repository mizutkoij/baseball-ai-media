// lib/relief-strength.ts
/**
 * ブルペン強度指標：直近リリーフ成績からチーム別レーティング(0-1)を計算
 * K-BB%またはFIP proxyベースで時間減衰付き加重平均
 */

import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

const log = logger.child({ job: 'relief-strength' });

export type AppRow = {
  date: string;
  team: string;
  isRelief: boolean;
  bf?: number;      // 打者数
  k?: number;       // 奪三振
  bb?: number;      // 四球
  h?: number;       // 被安打
  hr?: number;      // 被本塁打
  ip_outs?: number; // 投球回×3
};

export type BullpenRating = {
  team: string;
  date: string;
  rating01: number; // 0-1正規化後の評価
  z: number;        // z-score
  n: number;        // サンプル数
  raw_metric: number; // 生メトリクス値
};

export type ReliefParams = {
  lookback_days: number;
  min_app: number;
  half_life_days: number;
  metric: "kbb_pct" | "fip_proxy";
  league_zscore_cap: number;
};

/**
 * 時間減衰重み計算（指数減衰）
 */
function decayWeight(days: number, halfLife: number): number {
  const lambda = Math.log(2) / Math.max(1e-6, halfLife);
  return Math.exp(-lambda * days);
}

/**
 * 日付間の日数差計算
 */
function daysBetween(dateA: string, dateB: string): number {
  return Math.floor((Date.parse(dateA) - Date.parse(dateB)) / 86400000);
}

/**
 * 登板データからメトリクス値を計算
 */
function metricOf(row: AppRow, kind: ReliefParams["metric"]): number | null {
  if (kind === "kbb_pct") {
    const bf = row.bf ?? 0;
    const k = row.k ?? 0;
    const bb = row.bb ?? 0;
    
    if (bf <= 0) return null;
    return (k - bb) / bf; // K-BB率：-1..1程度の範囲
  } else if (kind === "fip_proxy") {
    const ip = (row.ip_outs ?? 0) / 3;
    if (ip <= 0) return null;
    
    const k = row.k ?? 0;
    const bb = row.bb ?? 0;
    const hr = row.hr ?? 0;
    
    // 簡易FIP: (13*HR + 3*BB - 2*K)/IP
    // 「低いほど良い」ので符号反転して「高いほど良い」にする
    return -((13 * hr + 3 * bb - 2 * k) / ip);
  }
  
  return null;
}

/**
 * z-scoreを0-1範囲に正規化
 */
function normalizeZScore(z: number, cap: number = 3): number {
  const clampedZ = Math.max(-cap, Math.min(cap, z));
  return (clampedZ + cap) / (2 * cap);
}

/**
 * ブルペン評価を計算
 */
export async function computeBullpenRatings(opts: {
  date: string;
  baseDir?: string;
  params: ReliefParams;
}): Promise<BullpenRating[]> {
  
  const { date, params } = opts;
  const baseDir = opts.baseDir ?? process.env.DATA_DIR ?? "data";
  
  log.info({ date, lookback_days: params.lookback_days }, 'Computing bullpen ratings');
  
  // 登板データを読み込み（簡易版：apps.jsonから）
  const appsPath = path.join(baseDir, "derived", "appearances", `date=${date}`, "apps.json");
  let rows: AppRow[] = [];
  
  try {
    const content = await fs.readFile(appsPath, "utf-8");
    rows = JSON.parse(content);
    log.debug({ total_appearances: rows.length }, 'Loaded appearance data');
  } catch (error) {
    log.warn({ error: error.message }, 'Could not load appearance data, using empty dataset');
    return [];
  }
  
  // チーム別に集計
  const teams = Array.from(new Set(rows.map(r => r.team)));
  const teamRatings: BullpenRating[] = [];
  
  for (const team of teams) {
    const reliefApps = rows.filter(r => r.team === team && r.isRelief);
    
    if (reliefApps.length === 0) {
      log.debug({ team }, 'No relief appearances found');
      continue;
    }
    
    let weightedSum = 0;
    let totalWeight = 0;
    let validAppearances = 0;
    
    for (const app of reliefApps) {
      const age = daysBetween(date, app.date);
      
      // 期間外は除外
      if (age < 0 || age > params.lookback_days) continue;
      
      const metric = metricOf(app, params.metric);
      if (metric === null) continue;
      
      const weight = decayWeight(age, params.half_life_days);
      weightedSum += weight * metric;
      totalWeight += weight;
      validAppearances++;
    }
    
    // 最小登板数チェック
    if (validAppearances < params.min_app || totalWeight <= 0) {
      log.debug({ team, appearances: validAppearances, min_required: params.min_app }, 'Insufficient appearances for rating');
      continue;
    }
    
    const rawScore = weightedSum / totalWeight;
    
    teamRatings.push({
      team,
      date,
      rating01: 0, // 後でz-score正規化後に設定
      z: rawScore, // 一時的に生スコアを保存
      n: validAppearances,
      raw_metric: rawScore
    });
  }
  
  // リーグ全体でz-score正規化
  if (teamRatings.length === 0) {
    log.warn({ date }, 'No teams have sufficient relief data for ratings');
    return [];
  }
  
  const scores = teamRatings.map(r => r.z);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / Math.max(1, scores.length - 1);
  const stdDev = Math.sqrt(variance) || 1;
  
  log.debug({ 
    teams: teamRatings.length, 
    mean: mean.toFixed(4), 
    stdDev: stdDev.toFixed(4) 
  }, 'League statistics computed');
  
  // z-scoreを計算し、0-1に正規化
  for (const rating of teamRatings) {
    const zScore = (rating.raw_metric - mean) / stdDev;
    const cappedZ = Math.max(-params.league_zscore_cap, Math.min(params.league_zscore_cap, zScore));
    
    rating.z = cappedZ;
    rating.rating01 = normalizeZScore(cappedZ, params.league_zscore_cap);
  }
  
  log.info({ 
    date, 
    teams_rated: teamRatings.length, 
    metric: params.metric 
  }, 'Bullpen ratings computed successfully');
  
  return teamRatings;
}

/**
 * 特定チームのブルペン評価を取得（キャッシュ機能付き）
 */
export async function getBullpenRating(opts: {
  date: string;
  team: string;
  baseDir?: string;
  params: ReliefParams;
}): Promise<BullpenRating | null> {
  
  const { date, team, params } = opts;
  const baseDir = opts.baseDir ?? process.env.DATA_DIR ?? "data";
  
  // キャッシュファイルパス
  const cacheDir = path.join(baseDir, "derived", "bullpen", `date=${date}`);
  const cachePath = path.join(cacheDir, "ratings.json");
  
  try {
    // キャッシュから読み込み
    const content = await fs.readFile(cachePath, "utf-8");
    const ratings: BullpenRating[] = JSON.parse(content);
    const teamRating = ratings.find(r => r.team === team);
    
    if (teamRating) {
      log.debug({ team, date, rating: teamRating.rating01 }, 'Bullpen rating retrieved from cache');
      return teamRating;
    } else {
      log.debug({ team, date }, 'Team not found in cached ratings');
      return null;
    }
    
  } catch (error) {
    // キャッシュがない場合は新規計算
    log.debug({ date, error: error.message }, 'Cache miss, computing bullpen ratings');
    
    try {
      const ratings = await computeBullpenRatings({ date, baseDir, params });
      
      // キャッシュに保存
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(ratings, null, 2), "utf-8");
      
      const teamRating = ratings.find(r => r.team === team);
      if (teamRating) {
        log.info({ team, date, rating: teamRating.rating01 }, 'Bullpen rating computed and cached');
      }
      
      return teamRating || null;
      
    } catch (computeError) {
      log.error({ 
        date, 
        team, 
        error: computeError.message 
      }, 'Failed to compute bullpen ratings');
      return null;
    }
  }
}

/**
 * デフォルトパラメータを使用してブルペン評価を取得
 */
export async function getBullpenRatingDefault(
  date: string, 
  team: string, 
  baseDir?: string
): Promise<BullpenRating | null> {
  
  const defaultParams: ReliefParams = {
    lookback_days: 14,
    min_app: 6,
    half_life_days: 7,
    metric: "kbb_pct",
    league_zscore_cap: 2.0
  };
  
  return getBullpenRating({ date, team, baseDir, params: defaultParams });
}

/**
 * 全チームの評価をまとめて取得
 */
export async function getAllBullpenRatings(
  date: string, 
  baseDir?: string
): Promise<BullpenRating[]> {
  
  const defaultParams: ReliefParams = {
    lookback_days: 14,
    min_app: 6,
    half_life_days: 7,
    metric: "kbb_pct",
    league_zscore_cap: 2.0
  };
  
  return computeBullpenRatings({ date, baseDir, params: defaultParams });
}