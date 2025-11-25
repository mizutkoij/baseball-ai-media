// lib/eval-metrics.ts
export type LiveRow = {
  ts: string;
  inning: number;
  top: boolean;
  outs: 0|1|2;
  p_home: number; // 0..1 (スムージング後)
  homeScore: number;
  awayScore: number;
};

const EPS = 1e-12;
const clamp = (x:number, lo=EPS, hi=1-EPS)=>Math.min(hi, Math.max(lo, x));

export type EvalReport = {
  final: { homeScore:number; awayScore:number; label:number|"draw" };
  overall: { n:number; brier:number; logloss:number; sharpness:number; volatility:number };
  byPhase: Record<"early"|"mid"|"late", { n:number; brier:number; logloss:number }>;
};

function labelFromFinal(home:number, away:number): number|"draw" {
  if (home > away) return 1;
  if (home < away) return 0;
  return "draw"; // NPB 引き分け考慮
}

function brier(rows:LiveRow[], y:number) {
  if (!rows.length) return NaN;
  const s = rows.reduce((acc,r)=>acc+(r.p_home - y)**2, 0);
  return s / rows.length;
}
function logloss(rows:LiveRow[], y:number) {
  if (!rows.length) return NaN;
  const s = rows.reduce((acc,r)=>{
    const p = clamp(r.p_home);
    return acc - (y*Math.log(p) + (1-y)*Math.log(1-p));
  }, 0);
  return s / rows.length;
}

function phaseOf(r:LiveRow): "early"|"mid"|"late" {
  if (r.inning <= 3) return "early";
  if (r.inning <= 6) return "mid";
  return "late";
}

export function computeEval(rows:LiveRow[]): EvalReport {
  if (!rows.length) {
    return {
      final: { homeScore:0, awayScore:0, label:0 },
      overall: { n:0, brier:NaN, logloss:NaN, sharpness:NaN, volatility:NaN },
      byPhase: { early:{n:0,brier:NaN,logloss:NaN}, mid:{n:0,brier:NaN,logloss:NaN}, late:{n:0,brier:NaN,logloss:NaN} },
    };
  }
  const last = rows[rows.length-1];
  const lbl = labelFromFinal(last.homeScore, last.awayScore);

  // ボラティリティ（連続差の平均）＆シャープネス（0.5からの乖離）
  let vol = 0;
  for (let i=1;i<rows.length;i++) vol += Math.abs(rows[i].p_home - rows[i-1].p_home);
  const volatility = vol / Math.max(1, rows.length-1);
  const sharpness = rows.reduce((a,r)=>a+Math.abs(r.p_home-0.5),0) / rows.length;

  const overall = (typeof lbl === "number")
    ? { n:rows.length, brier:brier(rows,lbl), logloss:logloss(rows,lbl), sharpness, volatility }
    : { n:rows.length, brier:brier(rows,0.5), logloss:logloss(rows,0.5), sharpness, volatility }; // 引き分け=0.5 として評価

  const buckets: Record<"early"|"mid"|"late", LiveRow[]> = { early:[], mid:[], late:[] };
  rows.forEach(r=>buckets[phaseOf(r)].push(r));
  const byPhase = (["early","mid","late"] as const).reduce((acc,k)=>{
    const arr = buckets[k];
    const m = (typeof lbl === "number")
      ? { n:arr.length, brier:brier(arr,lbl), logloss:logloss(arr,lbl) }
      : { n:arr.length, brier:brier(arr,0.5), logloss:logloss(arr,0.5) };
    acc[k]=m; return acc;
  }, {} as EvalReport["byPhase"]);

  return {
    final: { homeScore:last.homeScore, awayScore:last.awayScore, label:lbl },
    overall, byPhase
  };
}