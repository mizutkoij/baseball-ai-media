#!/usr/bin/env npx tsx
/**
 * 直近の試合 timeline.jsonl を集め、パラメータ探索
 * 目的関数: 重み付き loss = 0.6*LogLoss + 0.4*Brier  （late を 1.5倍）
 */
import fs from "fs/promises";
import path from "path";
import glob from "fast-glob";
import { computeEval } from "../lib/eval-metrics";

function phaseOf(inning: number) { return inning <= 3 ? "early" : inning <= 6 ? "mid" : "late"; }
function clamp(x: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, x)); }

async function loadTimelines(base = "data", days = 7) {
  console.log(`🔍 Searching for timelines in last ${days} days...`);
  
  // Look for all timeline files in predictions/live directory
  const pattern = path.join(base, "predictions/live/date=*/*/timeline.jsonl").replace(/\\/g, '/');
  const files = await glob(pattern, { dot: false });
  
  console.log(`📊 Found ${files.length} timeline files`);
  
  // Limit to reduce processing time
  const selectedFiles = files.slice(-200);
  console.log(`📝 Using ${selectedFiles.length} files for tuning`);
  
  return selectedFiles;
}

type Row = { 
  inning: number; 
  outs: number; 
  p_pregame: number; 
  p_state: number; 
  homeScore: number; 
  awayScore: number; 
};

function parse(lines: string[]): Row[] {
  return lines.map(l => JSON.parse(l)).map(j => ({
    inning: j.inning,
    outs: j.outs,
    p_pregame: j.p_pregame,
    p_state: j.p_state,
    homeScore: j.homeScore,
    awayScore: j.awayScore
  }));
}

function mix(p0: number, ps: number, w: number) {
  const EPS = 1e-6;
  const clampedP0 = clamp(p0, EPS, 1 - EPS);
  const clampedPs = clamp(ps, EPS, 1 - EPS);
  
  const logit = (p: number) => Math.log(p / (1 - p));
  const inv = (z: number) => 1 / (1 + Math.exp(-z));
  
  const z = (1 - w) * logit(clampedP0) + w * logit(clampedPs);
  return inv(z);
}

function simulate(rows: Row[], cfg: any) {
  const a_base = cfg.smooth.alpha_base;
  const a_jump = cfg.smooth.alpha_score_event;
  let prev: number | undefined = undefined;
  let lastScore = 0;
  
  const out = rows.map(r => {
    const prog = clamp((r.inning - 1 + r.outs / 3) / 9, 0, 1);
    
    // Calculate weight based on curve type
    let weightProg = prog;
    if (cfg.mix.curve === "quadratic") weightProg = prog * prog;
    else if (cfg.mix.curve === "cubic") weightProg = prog * prog * prog;
    
    const w = cfg.mix.w_min + (cfg.mix.w_max - cfg.mix.w_min) * weightProg;
    let p = mix(r.p_pregame, r.p_state, w);
    
    // Detect score events for adaptive smoothing
    const currentScore = r.homeScore + r.awayScore;
    const isScoreEvent = currentScore > lastScore;
    lastScore = currentScore;
    
    // Apply smoothing
    const alpha = (isScoreEvent && prev != null && Math.abs(p - prev) > 0.05) ? a_jump : a_base;
    const smoothed = prev == null ? p : clamp(alpha * p + (1 - alpha) * prev, cfg.clip.lo, cfg.clip.hi);
    prev = smoothed;
    
    return { 
      p_home: smoothed, 
      inning: r.inning, 
      homeScore: r.homeScore, 
      awayScore: r.awayScore,
      ts: new Date().toISOString(),
      top: false,
      outs: r.outs as 0|1|2
    };
  });
  
  return out;
}

async function main() {
  const base = process.env.DATA_DIR ?? "data";
  const days = Number(process.argv[2] ?? "14");
  
  console.log('🚀 NPB Live Parameters Tuning');
  console.log('=' * 40);
  
  const files = await loadTimelines(base, days);
  if (!files.length) { 
    console.error("❌ No timelines found"); 
    process.exit(2); 
  }

  console.log('\n🎯 Generating parameter candidates...');
  
  // Random search with good coverage
  const candidates = [];
  for (let i = 0; i < 60; i++) {
    candidates.push({
      mix: { 
        w_min: 0.15 + Math.random() * 0.15, 
        w_max: 0.85 + Math.random() * 0.12, 
        curve: ["linear", "quadratic", "cubic"][Math.floor(Math.random() * 3)] 
      },
      smooth: { 
        alpha_base: 0.20 + Math.random() * 0.20, 
        alpha_score_event: 0.45 + Math.random() * 0.25 
      },
      clip: { 
        lo: 0.01 + Math.random() * 0.02, 
        hi: 0.98 - Math.random() * 0.02 
      },
      calibration: { mode: "none", by_phase: false, params: {} },
      confidence: { high: 0.15, medium: 0.08 }
    });
  }

  console.log(`🔍 Testing ${candidates.length} parameter combinations...`);
  
  let best: any = null;
  let bestLoss = 1e9;
  let summary: any = null;
  let processed = 0;
  
  for (const cfg of candidates) {
    let agg = { n: 0, ll: 0, br: 0, llLate: 0, brLate: 0, games: 0 };
    
    for (const f of files) {
      try {
        const content = await fs.readFile(f, "utf-8");
        const lines = content.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) continue; // Skip files with insufficient data
        
        const rows = parse(lines);
        const sim = simulate(rows, cfg);
        const rep = computeEval(sim as any);
        
        if (!isFinite(rep.overall.logloss) || !isFinite(rep.overall.brier)) continue;
        
        agg.n += rep.overall.n;
        agg.ll += rep.overall.logloss * rep.overall.n; // Weight by sample size
        agg.br += rep.overall.brier * rep.overall.n;
        agg.llLate += (rep.byPhase.late.logloss || rep.overall.logloss) * (rep.byPhase.late.n || rep.overall.n);
        agg.brLate += (rep.byPhase.late.brier || rep.overall.brier) * (rep.byPhase.late.n || rep.overall.n);
        agg.games++;
      } catch (error) {
        // Skip files that can't be processed
        continue;
      }
    }
    
    if (agg.games === 0 || agg.n === 0) continue;
    
    // Calculate weighted averages
    const avgLL = agg.ll / agg.n;
    const avgBR = agg.br / agg.n;
    const avgLLLate = agg.llLate / agg.n;
    const avgBRLate = agg.brLate / agg.n;
    
    // Composite score with late-game emphasis
    const score = 0.6 * avgLL + 0.4 * avgBR + 0.2 * (avgLLLate + avgBRLate);
    
    if (score < bestLoss) { 
      bestLoss = score; 
      best = cfg; 
      summary = { 
        games: agg.games,
        events: agg.n,
        ll: avgLL, 
        br: avgBR, 
        llLate: avgLLLate, 
        brLate: avgBRLate, 
        score 
      }; 
    }
    
    processed++;
    if (processed % 10 === 0) {
      console.log(`📈 Processed ${processed}/${candidates.length} candidates...`);
    }
  }

  if (!best) {
    console.error("❌ No valid parameter combinations found");
    process.exit(1);
  }

  console.log('\n🎉 Tuning completed!');
  console.log('📊 Best parameters found:');
  console.log(`   Games evaluated: ${summary.games}`);
  console.log(`   Total events: ${summary.events}`);
  console.log(`   Log Loss: ${summary.ll.toFixed(4)}`);
  console.log(`   Brier Score: ${summary.br.toFixed(4)}`);
  console.log(`   Late Game LL: ${summary.llLate.toFixed(4)}`);
  console.log(`   Late Game Brier: ${summary.brLate.toFixed(4)}`);
  console.log(`   Composite Score: ${summary.score.toFixed(4)}`);

  console.log('\n⚙️ Parameter values:');
  console.log(`   Mix curve: ${best.mix.curve}`);
  console.log(`   Weight range: ${best.mix.w_min.toFixed(3)} - ${best.mix.w_max.toFixed(3)}`);
  console.log(`   Alpha base: ${best.smooth.alpha_base.toFixed(3)}`);
  console.log(`   Alpha events: ${best.smooth.alpha_score_event.toFixed(3)}`);
  console.log(`   Clipping: ${best.clip.lo.toFixed(3)} - ${best.clip.hi.toFixed(3)}`);

  await fs.mkdir("config", { recursive: true });
  await fs.writeFile("config/live-params.json", JSON.stringify(best, null, 2), "utf-8");
  console.log("\n✅ Optimized parameters written to config/live-params.json");
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Tuning failed:', error);
    process.exit(1);
  });
}