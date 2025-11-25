// lib/prior-lineup-adjust.ts
/**
 * 先発オーダー情報による重み・prior調整
 * 序盤のイニングでlineup確定状況に応じて微調整
 */

import { logger } from "./logger";

const log = logger.child({ job: 'prior-lineup-adjust' });

export type LineupParams = {
  mode: "weight" | "prior" | "both";
  weight: {
    early_inning_max: number;
    w_min_delta_confirmed: number;
    w_min_delta_partial: number;
    w_min_delta_unknown: number;
  };
  prior: {
    max_shift: number;
    per_star_absence: number;
    cap_by_conf: boolean;
  };
};

/**
 * lineup確定状況による重み調整量を計算
 * 序盤のイニングでのみ効果を発揮
 */
export function lineupWeightDelta(
  inning: number, 
  status: "unknown" | "partial" | "confirmed", 
  cfg: LineupParams["weight"]
): number {
  
  // 序盤のイニングを超えた場合は調整なし
  if (inning > cfg.early_inning_max) {
    return 0;
  }
  
  let delta = 0;
  switch (status) {
    case "confirmed":
      delta = cfg.w_min_delta_confirmed;
      break;
    case "partial":
      delta = cfg.w_min_delta_partial;
      break;
    case "unknown":
    default:
      delta = cfg.w_min_delta_unknown;
      break;
  }
  
  log.debug({ 
    inning, 
    status, 
    delta,
    early_max: cfg.early_inning_max 
  }, 'Lineup weight delta calculated');
  
  return delta;
}

/**
 * 先発オーダーの強弱による事前確率シフト
 * スター選手の欠場数などに基づく微調整
 */
export function lineupPriorShift(
  status: "unknown" | "partial" | "confirmed",
  starAbsences: number,
  cfg: LineupParams["prior"],
  completeness: number
): number {
  
  // スター欠場による下げ方向の調整（例）
  let shift = -cfg.per_star_absence * Math.max(0, starAbsences);
  
  // 確定状況による係数調整
  if (cfg.cap_by_conf) {
    let confMultiplier = 1;
    switch (status) {
      case "confirmed":
        confMultiplier = 1;
        break;
      case "partial":
        confMultiplier = Math.max(0.3, completeness);
        break;
      case "unknown":
      default:
        confMultiplier = 0;
        break;
    }
    shift *= confMultiplier;
  }
  
  // 安全上限の適用
  const cap = cfg.max_shift;
  if (shift > cap) shift = cap;
  if (shift < -cap) shift = -cap;
  
  log.debug({
    status,
    starAbsences,
    completeness,
    rawShift: -cfg.per_star_absence * Math.max(0, starAbsences),
    finalShift: shift,
    cap
  }, 'Lineup prior shift calculated');
  
  return shift;
}

/**
 * logit空間での事前確率調整
 */
export function applyPriorShift(probability: number, shift: number): number {
  // logit変換
  const z = Math.log(probability / (1 - probability));
  
  // シフト適用
  const adjustedZ = z + shift;
  
  // 確率に戻す
  const adjustedProbability = 1 / (1 + Math.exp(-adjustedZ));
  
  // 有効範囲に制限
  return Math.max(0.01, Math.min(0.99, adjustedProbability));
}

/**
 * lineup調整のメタデータ
 */
export interface LineupAdjustmentMeta {
  weightDelta: number;
  priorShift: number;
  originalPrior: number;
  adjustedPrior: number;
  lineupStatus: string;
  completeness: number;
  inning: number;
}

/**
 * デバッグ用：lineup調整の詳細表示
 */
export function debugLineupAdjustment(meta: LineupAdjustmentMeta): void {
  console.log('=== Lineup Adjustment Debug ===');
  console.log(`Inning: ${meta.inning}, Status: ${meta.lineupStatus}`);
  console.log(`Completeness: ${meta.completeness.toFixed(3)}`);
  console.log(`Weight Delta: ${meta.weightDelta.toFixed(4)}`);
  console.log(`Prior Shift: ${meta.priorShift.toFixed(4)}`);
  console.log(`Prior: ${meta.originalPrior.toFixed(4)} → ${meta.adjustedPrior.toFixed(4)}`);
  console.log('');
}