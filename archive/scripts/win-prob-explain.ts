#!/usr/bin/env npx tsx
/**
 * 勝率変化Explainエンドポイント
 * 直近の勝率変化に寄与した要因トップ3（走者/得点/疲労/ブルペン）を分析
 */

import { logger } from "../lib/logger";

const log = logger.child({ component: "win-prob-explain" });

export interface WinProbExplanation {
  gameId: string;
  timestamp: string;
  previousWinProb: number;
  currentWinProb: number;
  change: number; // 変化量
  factors: Array<{
    factor: "runners" | "score" | "fatigue" | "bullpen" | "situation" | "momentum";
    impact: number; // 寄与度 (-1.0 to 1.0)
    description: string;
    details: any;
  }>;
  topFactors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
}

interface GameState {
  inning: number;
  top: boolean;
  outs: number;
  balls: number;
  strikes: number;
  bases: number; // ビットマスク形式
  homeScore: number;
  awayScore: number;
  winProb: number;
  timestamp: string;
}

interface PitcherState {
  id: string;
  pitches: number;
  restDays: number;
  era: number;
  fatigue: number; // 0-100
}

interface BullpenState {
  available: number;
  strength: number; // 0-100
  usage: number; // 0-100
}

/**
 * 走者状況による勝率への影響分析
 */
function analyzeRunnersImpact(
  previousState: GameState,
  currentState: GameState
): { impact: number; description: string; details: any } {
  const prevRunners = countRunners(previousState.bases);
  const currRunners = countRunners(currentState.bases);
  const runnerChange = currRunners - prevRunners;
  
  // 走者増減による基本影響
  let impact = runnerChange * 0.15; // 走者1人あたり約15%の影響
  
  // イニング・状況による重み調整
  const inningWeight = currentState.inning >= 7 ? 1.5 : 1.0;
  const situationWeight = currentState.outs >= 2 ? 1.3 : 1.0;
  
  impact *= inningWeight * situationWeight;
  
  // 得点圏走者の特別扱い
  const prevScoringPos = hasScoringPosition(previousState.bases);
  const currScoringPos = hasScoringPosition(currentState.bases);
  
  if (!prevScoringPos && currScoringPos) {
    impact += 0.12; // 得点圏到達ボーナス
  }
  
  let description = "";
  if (runnerChange > 0) {
    description = `走者${runnerChange}人増加`;
    if (currScoringPos) description += "（得点圏）";
  } else if (runnerChange < 0) {
    description = `走者${Math.abs(runnerChange)}人減少`;
  } else if (prevScoringPos !== currScoringPos) {
    description = currScoringPos ? "得点圏走者出現" : "得点圏走者解消";
  } else {
    description = "走者状況変化なし";
    impact = 0;
  }
  
  return {
    impact: Math.max(-0.4, Math.min(0.4, impact)), // -40%〜+40%で制限
    description,
    details: {
      prevRunners,
      currRunners,
      prevScoringPos,
      currScoringPos,
      inning: currentState.inning,
      outs: currentState.outs
    }
  };
}

/**
 * 得点による勝率への影響分析
 */
function analyzeScoreImpact(
  previousState: GameState,
  currentState: GameState
): { impact: number; description: string; details: any } {
  const prevDiff = previousState.homeScore - previousState.awayScore;
  const currDiff = currentState.homeScore - currentState.awayScore;
  const scoreDiffChange = currDiff - prevDiff;
  
  if (scoreDiffChange === 0) {
    return { impact: 0, description: "得点変化なし", details: {} };
  }
  
  // 基本的な得点影響（1点あたり約20-30%）
  let impact = scoreDiffChange * 0.25;
  
  // イニング後半での重み増加
  const inningWeight = currentState.inning >= 8 ? 1.8 : 
                      currentState.inning >= 6 ? 1.3 : 1.0;
  
  // 接戦での重み増加
  const closenessWeight = Math.abs(prevDiff) <= 2 ? 1.4 : 1.0;
  
  impact *= inningWeight * closenessWeight;
  
  // 逆転・同点のボーナス
  if (prevDiff * currDiff < 0) { // 逆転
    impact += scoreDiffChange > 0 ? 0.15 : -0.15;
  } else if (prevDiff !== 0 && currDiff === 0) { // 同点
    impact += 0.10;
  }
  
  const description = scoreDiffChange > 0 ? 
    `${scoreDiffChange}点獲得` : `${Math.abs(scoreDiffChange)}点失点`;
  
  return {
    impact: Math.max(-0.6, Math.min(0.6, impact)), // -60%〜+60%で制限
    description,
    details: {
      scoreDiffChange,
      prevDiff,
      currDiff,
      inning: currentState.inning,
      isReversal: prevDiff * currDiff < 0
    }
  };
}

/**
 * 投手疲労による勝率への影響分析
 */
function analyzeFatigueImpact(
  pitcherState: PitcherState,
  gameContext: GameState
): { impact: number; description: string; details: any } {
  
  // 投球数による疲労影響
  let fatigueImpact = 0;
  
  if (pitcherState.pitches > 100) {
    fatigueImpact = -(pitcherState.pitches - 100) * 0.003; // 100球超過分
  }
  
  if (pitcherState.pitches > 120) {
    fatigueImpact -= 0.08; // 120球超過ペナルティ
  }
  
  // 休養不足影響
  if (pitcherState.restDays < 3) {
    fatigueImpact -= (3 - pitcherState.restDays) * 0.05;
  }
  
  // イニング進行による疲労蓄積
  if (gameContext.inning >= 7) {
    fatigueImpact -= 0.03;
  }
  
  if (gameContext.inning >= 9) {
    fatigueImpact -= 0.05;
  }
  
  let description = "";
  if (pitcherState.pitches > 100) {
    description = `投球数${pitcherState.pitches}球（疲労蓄積）`;
  } else if (pitcherState.restDays < 3) {
    description = `休養${pitcherState.restDays}日（疲労残存）`;
  } else {
    description = "投手疲労影響軽微";
  }
  
  return {
    impact: Math.max(-0.3, Math.min(0.1, fatigueImpact)), // -30%〜+10%で制限
    description,
    details: {
      pitches: pitcherState.pitches,
      restDays: pitcherState.restDays,
      fatigueScore: pitcherState.fatigue,
      inning: gameContext.inning
    }
  };
}

/**
 * ブルペン状況による勝率への影響分析
 */
function analyzeBullpenImpact(
  bullpenState: BullpenState,
  gameContext: GameState
): { impact: number; description: string; details: any } {
  
  let impact = 0;
  
  // ブルペン利用可能人数
  if (bullpenState.available < 3) {
    impact -= 0.08; // 利用可能投手不足
  } else if (bullpenState.available >= 5) {
    impact += 0.05; // 豊富なブルペン
  }
  
  // ブルペン強度
  const strengthImpact = (bullpenState.strength - 50) * 0.002; // 平均50を基準
  impact += strengthImpact;
  
  // 使い込み度
  if (bullpenState.usage > 80) {
    impact -= 0.06; // 使い込み過ぎ
  }
  
  // 終盤戦での重み増加
  if (gameContext.inning >= 7) {
    impact *= 1.5;
  }
  
  let description = "";
  if (bullpenState.available < 3) {
    description = `ブルペン枯渇気味（${bullpenState.available}人）`;
  } else if (bullpenState.strength > 70) {
    description = `強力ブルペン（強度${bullpenState.strength}）`;
  } else if (bullpenState.usage > 80) {
    description = `ブルペン酷使状態（使用率${bullpenState.usage}%）`;
  } else {
    description = "ブルペン状況標準";
  }
  
  return {
    impact: Math.max(-0.2, Math.min(0.2, impact)), // -20%〜+20%で制限
    description,
    details: {
      available: bullpenState.available,
      strength: bullpenState.strength,
      usage: bullpenState.usage,
      inning: gameContext.inning
    }
  };
}

/**
 * 総合的な勝率変化要因分析
 */
export function explainWinProbChange(
  previousState: GameState,
  currentState: GameState,
  pitcherState: PitcherState,
  bullpenState: BullpenState
): WinProbExplanation {
  
  const change = currentState.winProb - previousState.winProb;
  
  // 各要因の分析
  const runnersAnalysis = analyzeRunnersImpact(previousState, currentState);
  const scoreAnalysis = analyzeScoreImpact(previousState, currentState);
  const fatigueAnalysis = analyzeFatigueImpact(pitcherState, currentState);
  const bullpenAnalysis = analyzeBullpenImpact(bullpenState, currentState);
  
  // 状況要因（カウント、アウトカウント等）
  const situationImpact = analyzeSituationImpact(previousState, currentState);
  
  const factors = [
    { factor: "runners" as const, ...runnersAnalysis },
    { factor: "score" as const, ...scoreAnalysis },
    { factor: "fatigue" as const, ...fatigueAnalysis },
    { factor: "bullpen" as const, ...bullpenAnalysis },
    { factor: "situation" as const, ...situationImpact }
  ];
  
  // 寄与度の高い上位3要因を抽出
  const topFactors = factors
    .filter(f => Math.abs(f.impact) > 0.02) // 2%以上の影響
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 3)
    .map(f => ({
      factor: f.factor,
      impact: f.impact,
      description: f.description
    }));
  
  return {
    gameId: currentState.gameId || "unknown",
    timestamp: currentState.timestamp,
    previousWinProb: previousState.winProb,
    currentWinProb: currentState.winProb,
    change,
    factors,
    topFactors
  };
}

// ヘルパー関数
function countRunners(bases: number): number {
  return (bases & 1 ? 1 : 0) + (bases & 2 ? 1 : 0) + (bases & 4 ? 1 : 0);
}

function hasScoringPosition(bases: number): boolean {
  return (bases & 6) > 0; // 2塁または3塁に走者
}

function analyzeSituationImpact(prev: GameState, curr: GameState): { impact: number; description: string; details: any } {
  let impact = 0;
  let description = "";
  
  // アウトカウント変化
  const outChange = curr.outs - prev.outs;
  if (outChange > 0) {
    impact -= outChange * 0.08; // アウト1つにつき約8%減
    description = `${outChange}アウト増加`;
  }
  
  // カウント状況（ボール・ストライク）
  const favorableCounts = [30, 31, 20, 21]; // 3-0, 3-1, 2-0, 2-1
  const unfavorableCounts = [02, 12, 01, 11]; // 0-2, 1-2, 0-1, 1-1
  
  const prevCount = prev.balls * 10 + prev.strikes;
  const currCount = curr.balls * 10 + curr.strikes;
  
  if (favorableCounts.includes(currCount) && !favorableCounts.includes(prevCount)) {
    impact += 0.05;
    description += description ? "、有利カウント" : "有利カウント到達";
  } else if (unfavorableCounts.includes(currCount) && !unfavorableCounts.includes(prevCount)) {
    impact -= 0.05;
    description += description ? "、不利カウント" : "不利カウント";
  }
  
  if (!description) description = "状況変化軽微";
  
  return {
    impact: Math.max(-0.25, Math.min(0.25, impact)),
    description,
    details: { outChange, prevCount, currCount }
  };
}

export default { explainWinProbChange };