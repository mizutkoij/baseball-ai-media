#!/usr/bin/env npx tsx
/**
 * 「次の1球」を出すワンショット。live-predictor の "1球前フック" でこれを呼ぶ想定。
 * 出力: data/predictions/next-pitch/date=YYYY-MM-DD/<gameId>/timeline.jsonl
 * SSE: event: nextpitch
 */
import { predictNextPitch } from "../lib/next-pitch-predictor";
import { makeNextPitchRow } from "../lib/next-pitch-feature-mapper";
import { nextPitchPredictEvents, nextPitchPredictLatency } from "../lib/prometheus-metrics";
import fs from "fs/promises";
import path from "path";

async function appendJsonl(baseDir: string, filePath: string, data: any) {
  const fullPath = path.join(baseDir, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  const line = JSON.stringify(data) + "\n";
  await fs.appendFile(fullPath, line);
}

async function writeLatest(baseDir: string, filePath: string, data: any) {
  const fullPath = path.join(baseDir, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
}

const args = Object.fromEntries(process.argv.slice(2).map(s=>s.split("=")));
const date = args["--date"] || new Date().toISOString().slice(0,10);
const gameId = args["--gameId"]; 

if(!gameId){ 
  console.error("Usage: tsx scripts/predict_next_pitch.ts --date=YYYY-MM-DD --gameId=<id>"); 
  process.exit(2); 
}

async function main(){
  const startTime = Date.now();
  
  try {
    // ↓ 実運用では LiveStateStore 等から直近状態と文脈(ctx)を取得
    const state = { 
      inning: 9, 
      top: false, 
      balls: 0, 
      strikes: 0, 
      outs: 2, 
      bases: 0, 
      homeScore: 3,
      awayScore: 2, 
      winExp: 0.68 
    };
    
    const ctx = { 
      b_hand: 1, 
      p_hand: 0, 
      lastPitches: ["FF","SL"], 
      pitchMix: {
        FF: 0.52, 
        SL: 0.21,
        CU: 0.08, 
        CH: 0.06, 
        SF: 0.07, 
        FC: 0.03, 
        SI: 0.03
      } 
    };

    const row = makeNextPitchRow(state, ctx);
    const [res] = await predictNextPitch([row]);
    
    const ev = {
      ts: new Date().toISOString(),
      gameId, 
      pitch_seq: 1234,
      pitcherId: "p_001", 
      batterId: "b_999",
      top1: res.top1, 
      top3: res.top3, 
      probs: res.probs
    };
    
    const baseDir = process.env.DATA_DIR ?? "data";
    await appendJsonl(baseDir, `predictions/next-pitch/date=${date}/${gameId}/timeline.jsonl`, ev);
    await writeLatest(baseDir, `predictions/next-pitch/date=${date}/${gameId}/latest.json`, ev);
    
    console.log(`nextpitch: Top1=${ev.top1.pitch}@${(ev.top1.prob*100).toFixed(1)}%`);
    
    // メトリクス記録：成功
    nextPitchPredictEvents.inc({ result: "success" });
    nextPitchPredictLatency.observe(Date.now() - startTime);
    
  } catch (error) {
    // メトリクス記録：失敗
    nextPitchPredictEvents.inc({ result: "fail" });
    nextPitchPredictLatency.observe(Date.now() - startTime);
    
    console.error("Pitch prediction failed:", error.message);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });