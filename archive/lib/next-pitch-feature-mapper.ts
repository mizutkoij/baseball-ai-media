import { NPFeatureRow } from "./next-pitch-predictor";

function computeLeverageFromWE(state: any): number {
  // ざっくり近似: 中盤以降&接戦で上昇
  const we = Number(state.winExp ?? 0.5);
  const d = Math.abs(we - 0.5); 
  return 1 + Math.max(0, 0.8 - d * 1.6); // 0.5付近で~1.8
}

export function makeNextPitchRow(state: any, ctx: any): NPFeatureRow {
  // state: balls,strikes,outs,bases,inning,top,score,winExp,lastPitches[]
  // ctx: handedness & pitchMix for pitcher, batter handedness
  const last1 = mapPitch(ctx.lastPitches?.[0]);
  const last2 = mapPitch(ctx.lastPitches?.[1]);
  const mix = ctx.pitchMix ?? {};
  
  return {
    b_hand: Number(ctx.b_hand ?? 0), 
    p_hand: Number(ctx.p_hand ?? 0),
    balls: Number(state.balls ?? 0), 
    strikes: Number(state.strikes ?? 0),
    outs: Number(state.outs ?? 0), 
    bases: Number(state.bases ?? 0),
    inning: Number(state.inning ?? 1), 
    top: state.top ? 1 : 0,
    scoreDiff: Number((state.homeScore ?? 0) - (state.awayScore ?? 0)),
    leverage: computeLeverageFromWE(state),
    last1, 
    last2,
    mix_ff: Number(mix.FF ?? 0), 
    mix_bb: Number(mix.BB ?? 0), 
    mix_sl: Number(mix.SL ?? 0),
    mix_ch: Number(mix.CH ?? 0),
    mix_fk: Number(mix.SF ?? 0), 
    mix_cv: Number(mix.CU ?? 0), 
    mix_cut: Number(mix.FC ?? 0),
    mix_sin: Number(mix.SI ?? 0),
  };
}

function mapPitch(s?: string): number { 
  // builderと同じ分類規則
  if(!s) return 8; 
  const t = s.toUpperCase();
  if (t.includes("STRA")||t.includes("FF")) return 0;
  if (t.includes("SL")) return 1;
  if (t.includes("CUR")||t.includes("CB")||t.includes("CU")) return 2;
  if (t.includes("CH")) return 3;
  if (t.includes("FORK")||t.includes("SF")||t.includes("SPL")) return 4;
  if (t.includes("CUT")||t.includes("FC")) return 5;
  if (t.includes("SINK")||t.includes("2S")||t.includes("SI")) return 6;
  if (t.includes("SC")) return 7;
  return 8; // OTHER
}