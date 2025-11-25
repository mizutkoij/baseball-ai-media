/**
 * ライブゲーム状態から対決予測用特徴量への変換
 */

// 簡易レバレッジ計算（WE表からの近似）
export function computeLeverageFromWE(state: any): number {
  let li = 1.0;
  
  // イニング効果
  if (state.inning >= 9) li *= 2.0;
  else if (state.inning >= 7) li *= 1.5;
  else if (state.inning >= 6) li *= 1.2;
  
  // スコア差効果
  const scoreDiff = Math.abs((state.homeScore ?? 0) - (state.awayScore ?? 0));
  if (scoreDiff === 0) li *= 2.0;
  else if (scoreDiff === 1) li *= 1.8;
  else if (scoreDiff === 2) li *= 1.4;
  else if (scoreDiff >= 3) li *= 0.7;
  
  // ランナー効果
  const bases = state.basesCode ?? 0;
  if (bases >= 3) li *= 1.3;
  else if (bases >= 1) li *= 1.1;
  
  // アウト数効果
  if (state.outs === 2) li *= 1.2;
  
  return Math.max(0.5, Math.min(4.0, li));
}

export interface MatchupContext {
  batterId?: string;
  pitcherId?: string;
  b_hand?: 0 | 1;  // 0=L, 1=R
  p_hand?: 0 | 1;  // 0=L, 1=R
  b_split7?: number;   // 打者対左右7日移動平均OBP
  b_split30?: number;  // 打者対左右30日移動平均OBP
  p_split7?: number;   // 投手被OBP 7日移動平均
  p_split30?: number;  // 投手被OBP 30日移動平均
  fi?: number;         // 疲労指数
  rap14?: number;      // RAP 14日累積
  park_mult?: number;  // パーク係数
}

export function makeRowFromLive(state: any, ctx: MatchupContext) {
  // ベース状況をビット表現に変換 (1塁=1, 2塁=2, 3塁=4)
  const basesCode = state.basesCode ?? (
    (state.bases?.first ? 1 : 0) +
    (state.bases?.second ? 2 : 0) +
    (state.bases?.third ? 4 : 0)
  );

  return {
    // 打者・投手特徴量
    b_hand: ctx.b_hand ?? 1,  // デフォルト右打ち
    p_hand: ctx.p_hand ?? 1,  // デフォルト右投げ
    b_split7: ctx.b_split7 ?? 0.320,   // リーグ平均的な値
    b_split30: ctx.b_split30 ?? 0.320,
    p_split7: ctx.p_split7 ?? 1.250,   // リーグ平均WHIP
    p_split30: ctx.p_split30 ?? 1.250,
    
    // 疲労・負荷指標
    fi: ctx.fi ?? 0.0,         // 疲労なし
    rap14: ctx.rap14 ?? 0.0,   // RAP負荷なし
    
    // ゲーム状況
    inning: state.inning ?? 1,
    top: state.top ? 1 : 0,
    outs: state.outs ?? 0,
    bases: basesCode,
    scoreDiff: (state.homeScore ?? 0) - (state.awayScore ?? 0),
    
    // 環境要因
    park_mult: ctx.park_mult ?? 1.0,
    leverage: computeLeverageFromWE(state)
  };
}