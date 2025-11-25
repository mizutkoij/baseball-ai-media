// lib/we-bullpen-adjust.ts
/**
 * ブルペン強度によるWin Expectancy微調整
 * 7回以降で段階的に効果を増し、±3pt以内の安全な調整
 */

import { logger } from "./logger";

const log = logger.child({ job: 'we-bullpen-adjust' });

export type LateCurve = "linear" | "quadratic" | "cubic";

/**
 * 終盤ファクター計算：7回=0, 9回=1の進行度
 */
export function lateFactor(inning: number, curve: LateCurve = "cubic"): number {
  // 7回以降で効果が出始める設計
  const progression = Math.min(1, Math.max(0, (inning - 6) / 3));
  
  switch (curve) {
    case "linear":
      return progression;
    case "quadratic":
      return progression * progression;
    case "cubic":
      return progression * progression * progression;
    default:
      return progression * progression * progression;
  }
}

/**
 * ブルペン強度でWin Expectancyを微調整
 * 
 * @param p_state 元のWin Expectancy確率 (0-1)
 * @param z_home ホームチームのブルペンz-score
 * @param z_away アウェイチームのブルペンz-score  
 * @param inning 現在のイニング
 * @param beta logit空間での調整強度係数
 * @param maxShift 最大許容変動幅 (±maxShift)
 * @param curve 終盤での効果カーブ
 * @returns 調整後のWin Expectancy確率
 */
export function adjustWEWithBullpen(
  p_state: number,
  z_home: number,
  z_away: number,
  inning: number,
  beta: number = 0.25,
  maxShift: number = 0.03,
  curve: LateCurve = "cubic"
): number {
  
  // 入力値の妥当性チェック
  if (p_state < 0 || p_state > 1) {
    log.warn({ p_state }, 'Invalid p_state value, clamping to 0-1');
    p_state = Math.max(0, Math.min(1, p_state));
  }
  
  // ブルペン強度の差分（正の値はホーム優位）
  const zDelta = z_home - z_away;
  
  // 終盤ファクター（7回以降で効果増）
  const lateFac = lateFactor(inning, curve);
  
  // 早いイニングでは効果なし
  if (lateFac <= 0.001) {
    log.debug({ inning, lateFac }, 'Early inning, no bullpen adjustment');
    return p_state;
  }
  
  // logit変換（数値安定性のため境界値処理）
  const EPS = 1e-6;
  const p_clamped = Math.max(EPS, Math.min(1 - EPS, p_state));
  const logit_original = Math.log(p_clamped / (1 - p_clamped));
  
  // logit空間での調整
  const adjustment = beta * lateFac * zDelta;
  const logit_adjusted = logit_original + adjustment;
  
  // 確率に逆変換
  let p_adjusted = 1 / (1 + Math.exp(-logit_adjusted));
  
  // 安全制限：±maxShift を厳格に適用
  const lowerBound = Math.max(0, p_state - maxShift);
  const upperBound = Math.min(1, p_state + maxShift);
  
  if (p_adjusted < lowerBound) {
    p_adjusted = lowerBound;
  } else if (p_adjusted > upperBound) {
    p_adjusted = upperBound;
  }
  
  const actualShift = p_adjusted - p_state;
  
  log.debug({
    inning,
    p_state: p_state.toFixed(4),
    z_home: z_home.toFixed(3),
    z_away: z_away.toFixed(3),
    z_delta: zDelta.toFixed(3),
    late_factor: lateFac.toFixed(3),
    adjustment: adjustment.toFixed(4),
    p_adjusted: p_adjusted.toFixed(4),
    shift: actualShift.toFixed(4)
  }, 'Bullpen adjustment applied');
  
  return p_adjusted;
}

/**
 * バッチ調整：複数の状況に対してまとめて調整
 */
export function batchAdjustWE(
  scenarios: Array<{
    p_state: number;
    z_home: number;
    z_away: number;
    inning: number;
  }>,
  beta: number = 0.25,
  maxShift: number = 0.03,
  curve: LateCurve = "cubic"
): Array<{ original: number; adjusted: number; shift: number }> {
  
  return scenarios.map(scenario => {
    const adjusted = adjustWEWithBullpen(
      scenario.p_state,
      scenario.z_home,
      scenario.z_away,
      scenario.inning,
      beta,
      maxShift,
      curve
    );
    
    return {
      original: scenario.p_state,
      adjusted,
      shift: adjusted - scenario.p_state
    };
  });
}

/**
 * 調整強度のテスト用ヘルパー
 */
export function testAdjustmentStrength(
  baseProb: number = 0.5,
  zRange: number[] = [-2, -1, 0, 1, 2],
  innings: number[] = [6, 7, 8, 9],
  beta: number = 0.25,
  maxShift: number = 0.03
): void {
  
  console.log('=== Bullpen Adjustment Strength Test ===');
  console.log(`Base probability: ${baseProb}, Beta: ${beta}, Max shift: ±${maxShift}`);
  console.log('');
  
  for (const inning of innings) {
    console.log(`Inning ${inning}:`);
    for (const z of zRange) {
      const adjusted = adjustWEWithBullpen(baseProb, z, 0, inning, beta, maxShift);
      const shift = adjusted - baseProb;
      console.log(`  z=${z >= 0 ? '+' : ''}${z.toFixed(1)}: ${baseProb.toFixed(3)} → ${adjusted.toFixed(3)} (${shift >= 0 ? '+' : ''}${shift.toFixed(3)})`);
    }
    console.log('');
  }
}

/**
 * 安全性チェック：調整が範囲内に収まることを確認
 */
export function validateAdjustmentSafety(
  p_state: number,
  z_home: number,
  z_away: number,
  inning: number,
  maxShift: number = 0.03
): boolean {
  
  const adjusted = adjustWEWithBullpen(p_state, z_home, z_away, inning, 0.25, maxShift);
  const actualShift = Math.abs(adjusted - p_state);
  
  const isValid = actualShift <= maxShift + 1e-6; // 数値誤差を考慮
  
  if (!isValid) {
    log.error({
      p_state,
      z_home,
      z_away,
      inning,
      adjusted,
      actual_shift: actualShift,
      max_shift: maxShift
    }, 'Adjustment safety violation detected');
  }
  
  return isValid;
}

/**
 * デバッグ用：調整効果の可視化
 */
export function debugAdjustmentEffect(
  gameState: {
    inning: number;
    p_state: number;
    home_team: string;
    away_team: string;
    z_home: number;
    z_away: number;
  },
  params: {
    beta: number;
    maxShift: number;
    curve: LateCurve;
  }
): void {
  
  console.log('=== Bullpen Adjustment Debug ===');
  console.log(`Game: ${gameState.away_team} @ ${gameState.home_team}, Inning ${gameState.inning}`);
  console.log(`Original WE: ${gameState.p_state.toFixed(4)}`);
  console.log(`Bullpen z-scores: Home ${gameState.z_home.toFixed(3)}, Away ${gameState.z_away.toFixed(3)}`);
  
  const lateFac = lateFactor(gameState.inning, params.curve);
  const adjusted = adjustWEWithBullpen(
    gameState.p_state,
    gameState.z_home,
    gameState.z_away,
    gameState.inning,
    params.beta,
    params.maxShift,
    params.curve
  );
  
  console.log(`Late factor (${params.curve}): ${lateFac.toFixed(4)}`);
  console.log(`Adjusted WE: ${adjusted.toFixed(4)}`);
  console.log(`Net shift: ${(adjusted - gameState.p_state).toFixed(4)}`);
  console.log('');
}