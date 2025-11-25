// scripts/evaluate_live_game.ts
import fs from "fs/promises";
import path from "path";
import { computeEval, LiveRow } from "../lib/eval-metrics";

function getArg(name:string, def?:string){ return process.argv.find(a=>a.startsWith(`--${name}=`))?.split("=")[1] ?? def; }

async function main() {
  const baseDir = process.env.DATA_DIR ?? "data";
  const date = getArg("date");
  const gameId = getArg("gameId");
  if (!date || !gameId) {
    console.error("Usage: tsx scripts/evaluate_live_game.ts --date=YYYY-MM-DD --gameId=<id>");
    process.exit(2);
  }
  
  const dir = path.join(baseDir, "predictions", "live", `date=${date}`, gameId);
  const timelinePath = path.join(dir, "timeline.jsonl");
  
  try {
    const content = await fs.readFile(timelinePath, "utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);

    const rows: LiveRow[] = lines.map(l => JSON.parse(l));
    const report = computeEval(rows);
    const outPath = path.join(dir, "eval.json");
    await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf-8");

    console.log(JSON.stringify({ date, gameId, ...report.overall }, null, 2));
  } catch (error) {
    console.error(`Error evaluating game ${gameId}:`, error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}