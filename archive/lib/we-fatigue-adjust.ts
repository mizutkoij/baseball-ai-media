// lib/we-fatigue-adjust.ts
/**
 * 投手疲労によるWin Expectancy微調整
 * 疲労度が高いほど防御側(投手側)が不利になる調整
 */

import { logger } from "./logger";

const log = logger.child({ job: 'we-fatigue-adjust' });

export type FatigueCurve = "linear" | "quadratic" | "cubic";

/**
 * イニング進行による疲労効果の重み
 * 序盤は疲労の影響小、終盤は影響大
 */
export function fatigueInningWeight(inning: number, curve: FatigueCurve = "quadratic"): number {
  // 4回以降で効果が出始める設計（疲労が顕在化する時期）
  const progression = Math.min(1, Math.max(0, (inning - 3) / 6)); // 4回=0, 9回=1
  
  switch (curve) {
    case "linear":
      return progression;
    case "quadratic":
      return progression * progression;
    case "cubic":
      return progression * progression * progression;
    default:
      return progression * progression;
  }
}

/**
 * 投手疲労でWin Expectancyを微調整
 * 
 * @param p_state 元のWin Expectancy確率 (0-1)
 * @param fatigueIndex 投手の疲労指数 (0-1, 高いほど疲労)
 * @param inning 現在のイニング
 * @param isHomeTeamPitching ホームチームが投球中か
 * @param maxShift 最大許容変動幅 (±maxShift)
 * @param curve イニング別の効果カーブ
 * @returns 調整後のWin Expectancy確率
 */
export function adjustWEWithFatigue(
  p_state: number,
  fatigueIndex: number,
  inning: number,
  isHomeTeamPitching: boolean,
  maxShift: number = 0.02,
  curve: FatigueCurve = "quadratic"
): number {
  
  // 入力値の妥当性チェック
  if (p_state < 0 || p_state > 1) {
    log.warn({ p_state }, 'Invalid p_state value, clamping to 0-1');
    p_state = Math.max(0, Math.min(1, p_state));
  }
  
  if (fatigueIndex < 0 || fatigueIndex > 1) {
    log.warn({ fatigueIndex }, 'Invalid fatigue index, clamping to 0-1');
    fatigueIndex = Math.max(0, Math.min(1, fatigueIndex));
  }
  
  // イニング重み計算
  const inningWeight = fatigueInningWeight(inning, curve);
  
  // 序盤は疲労の影響なし
  if (inningWeight <= 0.001) {
    log.debug({ inning, inningWeight }, 'Early inning, no fatigue adjustment');
    return p_state;
  }
  
  // 疲労による調整量計算
  // 疲労が高い = 投手が不利 = 防御側が不利
  // ホームが投球中: 疲労大 → ホーム勝率下落
  // アウェイが投球中: 疲労大 → ホーム勝率上昇
  const fatigueEffect = fatigueIndex * inningWeight;
  const direction = isHomeTeamPitching ? -1 : 1; // ホーム投球中は負の調整
  
  // logit空間での調整（数値安定性のため）
  const EPS = 1e-6;
  const p_clamped = Math.max(EPS, Math.min(1 - EPS, p_state));
  const logit_original = Math.log(p_clamped / (1 - p_clamped));
  
  // 調整量（疲労が高いほど大きな影響）
  const adjustmentMagnitude = fatigueEffect * maxShift * 5; // logit空間での係数
  const logit_adjusted = logit_original + direction * adjustmentMagnitude;
  
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
    fatigue_index: fatigueIndex.toFixed(3),
    is_home_pitching: isHomeTeamPitching,
    inning_weight: inningWeight.toFixed(3),
    fatigue_effect: fatigueEffect.toFixed(3),
    p_adjusted: p_adjusted.toFixed(4),
    shift: actualShift.toFixed(4)
  }, 'Fatigue adjustment applied');
  
  return p_adjusted;
}

/**
 * バッチ調整：複数シナリオの疲労調整
 */
export function batchAdjustWEFatigue(
  scenarios: Array<{
    p_state: number;
    fatigueIndex: number;
    inning: number;
    isHomeTeamPitching: boolean;
  }>,
  maxShift: number = 0.02,
  curve: FatigueCurve = "quadratic"
): Array<{ original: number; adjusted: number; shift: number }> {
  
  return scenarios.map(scenario => {
    const adjusted = adjustWEWithFatigue(
      scenario.p_state,
      scenario.fatigueIndex,
      scenario.inning,
      scenario.isHomeTeamPitching,
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
 * 疲労調整強度のテスト用ヘルパー
 */
export function testFatigueAdjustmentStrength(
  baseProb: number = 0.5,
  fatigueRange: number[] = [0, 0.25, 0.5, 0.75, 1.0],
  innings: number[] = [3, 5, 7, 9],
  maxShift: number = 0.02
): void {
  
  console.log('=== Fatigue Adjustment Strength Test ===');
  console.log(`Base probability: ${baseProb}, Max shift: ±${maxShift}`);
  console.log('');
  
  for (const inning of innings) {
    console.log(`Inning ${inning} (Home pitching):`);
    for (const fatigue of fatigueRange) {
      const adjusted = adjustWEWithFatigue(baseProb, fatigue, inning, true, maxShift);
      const shift = adjusted - baseProb;
      console.log(`  fatigue=${fatigue.toFixed(2)}: ${baseProb.toFixed(3)} → ${adjusted.toFixed(3)} (${shift >= 0 ? '+' : ''}${shift.toFixed(3)})`);
    }
    console.log('');
  }
}

/**
 * 安全性チェック：調整が範囲内に収まることを確認
 */
export function validateFatigueAdjustmentSafety(
  p_state: number,
  fatigueIndex: number,
  inning: number,
  isHomeTeamPitching: boolean,
  maxShift: number = 0.02
): boolean {
  
  const adjusted = adjustWEWithFatigue(p_state, fatigueIndex, inning, isHomeTeamPitching, maxShift);
  const actualShift = Math.abs(adjusted - p_state);
  
  const isValid = actualShift <= maxShift + 1e-6; // 数値誤差を考慮
  
  if (!isValid) {
    log.error({
      p_state,
      fatigueIndex,
      inning,
      isHomeTeamPitching,
      adjusted,
      actual_shift: actualShift,
      max_shift: maxShift
    }, 'Fatigue adjustment safety violation detected');
  }
  
  return isValid;
}

/**
 * デバッグ用：疲労調整効果の可視化
 */
export function debugFatigueAdjustmentEffect(
  gameState: {
    inning: number;
    p_state: number;
    home_pitcher_fatigue: number;
    away_pitcher_fatigue: number;
    home_team_pitching: boolean;
  },
  params: {
    maxShift: number;
    curve: FatigueCurve;
  }
): void {
  
  console.log('=== Fatigue Adjustment Debug ===');
  console.log(`Game State: Inning ${gameState.inning}, ${gameState.home_team_pitching ? 'Home' : 'Away'} pitching`);
  console.log(`Original WE: ${gameState.p_state.toFixed(4)}`);
  
  const currentPitcherFatigue = gameState.home_team_pitching 
    ? gameState.home_pitcher_fatigue 
    : gameState.away_pitcher_fatigue;
  
  console.log(`Current Pitcher Fatigue: ${currentPitcherFatigue.toFixed(3)}`);
  
  const inningWeight = fatigueInningWeight(gameState.inning, params.curve);
  const adjusted = adjustWEWithFatigue(
    gameState.p_state,
    currentPitcherFatigue,
    gameState.inning,
    gameState.home_team_pitching,
    params.maxShift,
    params.curve
  );
  
  console.log(`Inning weight (${params.curve}): ${inningWeight.toFixed(4)}`);
  console.log(`Adjusted WE: ${adjusted.toFixed(4)}`);
  console.log(`Net shift: ${(adjusted - gameState.p_state).toFixed(4)}`);
  console.log('');
}

/**
 * 投手交代時の疲労インデックス更新ヘルパー
 */
export function handlePitcherChange(
  newPitcherFatigue: number,
  gameContext: {
    inning: number;
    situation: 'normal' | 'pressure' | 'blowout';
  }
): { adjustedFatigue: number; confidence: 'high' | 'medium' | 'low' } {
  
  let adjustedFatigue = newPitcherFatigue;
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  
  // 状況による疲労調整
  if (gameContext.situation === 'pressure' && gameContext.inning >= 7) {
    // プレッシャー状況では疲労の影響が増大
    adjustedFatigue = Math.min(1, newPitcherFatigue * 1.2);
    confidence = 'high';
  } else if (gameContext.situation === 'blowout') {
    // 大差ゲームでは疲労の影響が軽減
    adjustedFatigue = newPitcherFatigue * 0.8;
    confidence = 'medium';
  }
  
  return { adjustedFatigue, confidence };
}