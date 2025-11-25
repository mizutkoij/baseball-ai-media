// lib/we-mixer.ts
import { loadLiveParams } from './live-params';

const EPS = 1e-6;
const clamp = (p: number, lo = EPS, hi = 1 - EPS) => Math.min(hi, Math.max(lo, p));
const logit = (p: number) => Math.log(clamp(p) / (1 - clamp(p)));
const inv = (z: number) => 1 / (1 + Math.exp(-z));

/** 進行度に応じた重み w (設定ファイルベース) */
export async function progressWeight(inning: number, outs: number) {
  const params = await loadLiveParams();
  const prog = Math.min(1, Math.max(0, (inning - 1 + outs / 3) / 9));
  
  let weightProg = prog;
  if (params.mix.curve === "quadratic") weightProg = prog * prog;
  else if (params.mix.curve === "cubic") weightProg = prog * prog * prog;
  
  return params.mix.w_min + (params.mix.w_max - params.mix.w_min) * weightProg;
}

/** 事前確率×状態確率の logit 線形合成（ホーム勝率を返す） */
export async function mixPregameState(pPregame: number, pState: number, inning: number, outs: number) {
  const w = await progressWeight(inning, outs);
  const z = (1 - w) * logit(pPregame) + w * logit(pState);
  return { p: clamp(inv(z)), w };
}

/** 重み調整版の事前確率×状態確率の合成（lineup調整用） */
export async function mixPregameStateWithWeightAdjustment(
  pPregame: number, 
  pState: number, 
  inning: number, 
  outs: number, 
  wExtra: number = 0
) {
  const params = await loadLiveParams();
  const baseW = await progressWeight(inning, outs);
  
  // w_minを調整（安全範囲内で）
  const wMinAdjusted = Math.max(0.05, Math.min(params.mix.w_max, params.mix.w_min + wExtra));
  
  // 調整されたw_minでprogressWeightを再計算
  const prog = Math.min(1, Math.max(0, (inning - 1 + outs / 3) / 9));
  let weightProg = prog;
  if (params.mix.curve === "quadratic") weightProg = prog * prog;
  else if (params.mix.curve === "cubic") weightProg = prog * prog * prog;
  
  const adjustedW = wMinAdjusted + (params.mix.w_max - wMinAdjusted) * weightProg;
  
  const z = (1 - adjustedW) * logit(pPregame) + adjustedW * logit(pState);
  return { p: clamp(inv(z)), w: adjustedW };
}

/** 指数移動平均で"点滅"抑制 (設定ファイルベース) */
export async function ewma(prev: number | undefined, next: number, isScoreEvent: boolean = false) {
  const params = await loadLiveParams();
  if (prev == null) return next;
  
  const alpha = isScoreEvent ? params.smooth.alpha_score_event : params.smooth.alpha_base;
  const result = alpha * next + (1 - alpha) * prev;
  
  return clamp(result, params.clip.lo, params.clip.hi);
}

/** 距離とソース信頼度からざっくりな conf ラベル (設定ファイルベース) */
export async function confidence(pState: number, pMixed: number, src: "high" | "medium" | "low") {
  const params = await loadLiveParams();
  const spread = Math.abs(pMixed - 0.5);
  const bump = src === "high" ? 0.05 : src === "medium" ? 0.02 : 0;
  const s = spread + bump;
  
  if (s >= params.confidence.high) return "high";
  if (s >= params.confidence.medium) return "medium";
  return "low";
}