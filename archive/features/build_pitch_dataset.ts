#!/usr/bin/env npx tsx
/**
 * 入力: 正規化済 details から投球イベントを抽出
 * 出力: data/ml/nextpitch/train_YYYYMMDD.parquet
 * 特徴量(例): カウント/走者/局面, 直近2球, 投手/打者の利き, 投手配分, レバレッジ
 */
import fs from "fs/promises";
import path from "path";
import { parseArgs } from "node:util";

type Row = {
  date: string;
  gameId: string;
  pitch_seq: number;
  batterId: string;
  pitcherId: string;
  b_hand: number;
  p_hand: number;
  balls: number;
  strikes: number;
  outs: number;
  bases: number;
  inning: number;
  top: number;
  scoreDiff: number;
  leverage: number;
  last1: number;
  last2: number;
  mix_ff: number;
  mix_bb: number;
  mix_sl: number;
  mix_ch: number;
  mix_fk: number;
  mix_cv: number;
  mix_cut: number;
  mix_sin: number;
  y: number; // ラベル: 0..K-1（pitch class）
};

const PITCHES = ["FF","SL","CU","CH","SF","FC","SI","SC","OTHER"] as const;

const mapPitch = (s?: string) => {
  if(!s) return PITCHES.indexOf("OTHER");
  const t = s.toUpperCase();
  if (t.includes("STRA")||t.includes("FF")) return PITCHES.indexOf("FF");
  if (t.includes("SL")) return PITCHES.indexOf("SL");
  if (t.includes("CUR")||t.includes("CB")||t.includes("CU")) return PITCHES.indexOf("CU");
  if (t.includes("CH")) return PITCHES.indexOf("CH");
  if (t.includes("FORK")||t.includes("SF")||t.includes("SPL")) return PITCHES.indexOf("SF");
  if (t.includes("CUT")||t.includes("FC")) return PITCHES.indexOf("FC");
  if (t.includes("SINK")||t.includes("2S")||t.includes("SI")) return PITCHES.indexOf("SI");
  if (t.includes("SC")) return PITCHES.indexOf("SC");
  return PITCHES.indexOf("OTHER");
};

function leverageFromWE(we: number) { 
  // ざっくり近似: 中盤以降&接戦で上昇
  const d = Math.abs(we-0.5); 
  return 1 + Math.max(0, 0.8 - d*1.6); // 0.5付近で~1.8
}

async function loadJson(p: string) { 
  try { 
    return JSON.parse(await fs.readFile(p,"utf-8")); 
  } catch { 
    return null; 
  } 
}

async function main() {
  const { values } = parseArgs({ options: { from:{type:"string"}, to:{type:"string"} }});
  const from = values.from ?? process.argv[2];
  const to = values.to ?? process.argv[3];
  
  if(!from||!to){ 
    console.error("Usage: tsx features/build_pitch_dataset.ts 2025-08-01 2025-08-12"); 
    process.exit(2); 
  }
  
  const outDir = "data/ml/nextpitch"; 
  await fs.mkdir(outDir, {recursive:true});

  const rows: Row[] = [];
  
  // 期間内の日付をループ（簡易）
  for(let d=new Date(from); d<=new Date(to); d.setDate(d.getDate()+1)){
    const ymd = d.toISOString().slice(0,10);
    const base = path.join("data","details",`date=${ymd}`);
    let games: string[] = [];
    try { 
      games = (await fs.readdir(base)).filter(f=>!f.startsWith(".")); 
    } catch {}
    
    for (const gid of games) {
      const latest = await loadJson(path.join(base,gid,"latest.json"));
      if(!latest?.pitches) continue;
      
      const stateBase = latest; // ここでは latest.json に pitch配列がある前提の簡易実装
      const seqs = stateBase.pitches as any[];
      
      // 投手配分(過去 to-date)をざっくり（ない時は0）
      const mix = stateBase.pitchMix?.[stateBase.pitcherId] ?? {};
      const mixVec = {
        mix_ff: Number(mix.FF??0), 
        mix_bb: Number(mix.BB??0), 
        mix_sl: Number(mix.SL??0),
        mix_ch: Number(mix.CH??0),
        mix_fk: Number(mix.SF??0), 
        mix_cv: Number(mix.CU??0), 
        mix_cut: Number(mix.FC??0),
        mix_sin: Number(mix.SI??0),
      };
      
      for (let i=0; i<seqs.length; i++){
        const ev = seqs[i];
        const nextType = ev.nextPitchType ?? ev.pitchType; // ラベル
        if (!nextType) continue;
        
        const balls = Number(ev.balls??0);
        const strikes = Number(ev.strikes??0);
        const last1 = mapPitch(seqs[i-1]?.pitchType);
        const last2 = mapPitch(seqs[i-2]?.pitchType);
        const we = Number(ev.winExp??0.5);
        
        rows.push({
          date: ymd, 
          gameId: gid, 
          pitch_seq: Number(ev.seq ?? i+1),
          batterId: String(ev.batterId??""), 
          pitcherId: String(ev.pitcherId??""),
          b_hand: Number(ev.b_hand ?? 0), 
          p_hand: Number(ev.p_hand ?? 0),
          balls, 
          strikes, 
          outs: Number(ev.outs??0), 
          bases: Number(ev.bases??0),
          inning: Number(ev.inning??1), 
          top: ev.top?1:0, 
          scoreDiff: Number((ev.home??0)-(ev.away??0)),
          leverage: leverageFromWE(we),
          last1, 
          last2, 
          ...mixVec,
          y: mapPitch(nextType)
        });
      }
    }
  }
  
  // Parquet へ（なければ CSV）
  const out = path.join(outDir,"train_latest.parquet");
  try {
    const pa = await import("parquet-wasm"); // or pyarrow on Python side
    await fs.writeFile(out, Buffer.from(JSON.stringify({ schema:"jsonl", rows })));
  } catch {
    await fs.writeFile(out.replace(".parquet",".csv"),
      rows.map(r=>Object.values(r).join(",")).join("\n"));
  }
  
  console.log(`rows=${rows.length} saved to ${out}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });