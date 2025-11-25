// scripts/predict_live_once.ts
import { predictAndPersistLive } from "../lib/live-predictor";
import { getWinExpectancy, gameStateToWinExpectancyKey } from "../lib/win-expectancy"; // Day2で作ったやつ
import fs from "fs/promises";
import path from "path";

async function readLatestSmoothed(baseDir: string, date: string, gameId: string) {
  try {
    const p = path.join(baseDir, "predictions", "live", `date=${date}`, gameId, "latest.json");
    const j = JSON.parse(await fs.readFile(p, "utf-8"));
    return j?.p_home as number | undefined;
  } catch { return undefined; }
}

async function readPregame(baseDir: string, date: string, gameId: string) {
  // data/predictions/pregame/date=YYYY-MM-DD/latest.json から gameId を引く設計にしている想定
  try {
    const p = path.join(baseDir, "predictions", "pregame", `date=${date}`, "latest.json");
    const arr = JSON.parse(await fs.readFile(p, "utf-8"));
    const row = arr.find((r: any) => r.gameId === gameId);
    return row?.p_home as number | undefined;
  } catch { return undefined; }
}

function parseArgs() {
  const date = process.argv.find(a => a.startsWith("--date="))?.split("=")[1];
  const gameId = process.argv.find(a => a.startsWith("--gameId="))?.split("=")[1];
  const inning = parseInt(process.argv.find(a => a.startsWith("--inning="))?.split("=")[1] || "3");
  const top = process.argv.find(a => a.startsWith("--top="))?.split("=")[1] === "true";
  const outs = parseInt(process.argv.find(a => a.startsWith("--outs="))?.split("=")[1] || "1") as 0|1|2;
  const bases = parseInt(process.argv.find(a => a.startsWith("--bases="))?.split("=")[1] || "3");
  const homeScore = parseInt(process.argv.find(a => a.startsWith("--homeScore="))?.split("=")[1] || "2");
  const awayScore = parseInt(process.argv.find(a => a.startsWith("--awayScore="))?.split("=")[1] || "1");
  
  if (!date || !gameId) {
    console.error("Usage: tsx scripts/predict_live_once.ts --date=YYYY-MM-DD --gameId=<id> [--inning=3] [--top=false] [--outs=1] [--bases=3] [--homeScore=2] [--awayScore=1]");
    process.exit(2);
  }
  return { date, gameId, inning, top, outs, bases, homeScore, awayScore };
}

async function main() {
  const baseDir = process.env.DATA_DIR ?? "data";
  const { date, gameId, inning, top, outs, bases, homeScore, awayScore } = parseArgs();

  // 状態作成
  const state = { gameId, inning, top, outs, bases, homeScore, awayScore, ts: new Date().toISOString() };

  const pPregame = await readPregame(baseDir, date, gameId);
  const last = await readLatestSmoothed(baseDir, date, gameId);
  
  // Day 2のWE関数を使用
  const weLookup = (s: any) => {
    const weKey = gameStateToWinExpectancyKey(s, s.homeScore - s.awayScore);
    const weValue = getWinExpectancy(weKey);
    return { 
      p_home: weValue.home_win_probability, 
      conf: weValue.confidence 
    };
  };

  console.log(`🎯 Live Prediction for ${gameId}`);
  console.log(`📅 Date: ${date}`);
  console.log(`⚾ State: ${inning}${top ? '表' : '裏'} ${outs}死 bases=${bases} score=${awayScore}-${homeScore}`);
  console.log(`🎲 Pregame prob: ${pPregame?.toFixed(3) || 'N/A'}`);
  console.log(`📈 Last smoothed: ${last?.toFixed(3) || 'N/A'}`);

  const result = await predictAndPersistLive({ 
    date, baseDir, state, weLookup, 
    pregameProb: pPregame, 
    lastSmoothed: last 
  });

  if (result.ok) {
    console.log(`✅ ${result.action}: ${result.path}`);
    console.log(`📊 Result: p_home=${result.latest.p_home.toFixed(3)} conf=${result.latest.conf}`);
  } else {
    console.error(`❌ Failed: ${result.error}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 予測実行エラー:', error);
    process.exit(1);
  });
}