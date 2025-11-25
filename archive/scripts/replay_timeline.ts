// scripts/replay_timeline.ts
// 既存 timeline.jsonl を別ディレクトリに"徐々に"書き出して SSE を受けやすくする
import fs from "fs/promises";
import path from "path";

function getArg(name:string, def?:string){ 
  const arg = process.argv.find(a=>a.startsWith(`--${name}=`));
  if (!arg) return def;
  return arg.substring(`--${name}=`.length);
}
const sleep = (ms:number)=>new Promise(r=>setTimeout(r, ms));

async function main(){
  const src = getArg("src");
  const date = getArg("date");
  const gameId = getArg("gameId");
  const speed = Number(getArg("speed","1")); // 1=1秒/行, 2=0.5秒/行
  const baseDir = process.env.DATA_DIR ?? "data";
  if (!src || !date || !gameId) {
    console.error("Usage: tsx scripts/replay_timeline.ts --src=path/to/timeline.jsonl --date=YYYY-MM-DD --gameId=<id> [--speed=1]");
    process.exit(2);
  }

  const dstDir = path.join(baseDir, "predictions", "live", `date=${date}`, gameId);
  const latestPath = path.join(dstDir, "latest.json");
  const timelinePath = path.join(dstDir, "timeline.jsonl");
  
  console.log(`🎬 Starting replay: ${src} -> ${timelinePath}`);
  console.log(`⚡ Speed: ${speed}x (${(1000/speed).toFixed(0)}ms per event)`);
  
  await fs.mkdir(dstDir, { recursive: true });
  
  // Clear existing files
  await fs.writeFile(timelinePath, "", "utf-8");
  
  try {
    const content = await fs.readFile(src, "utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    
    console.log(`📊 Found ${lines.length} events to replay`);
    
    for (let i=0;i<lines.length;i++){
      const j = JSON.parse(lines[i]);
      await fs.appendFile(timelinePath, lines[i]+"\n", "utf-8");
      await fs.writeFile(latestPath, JSON.stringify(j, null, 2), "utf-8");
      
      console.log(`📡 Event ${i+1}/${lines.length}: ${j.inning}${j.top ? '表' : '裏'} ${j.outs}死 p_home=${j.p_home.toFixed(3)}`);
      
      await sleep(Math.max(50, 1000 / Math.max(0.1, speed))); // デフォ1秒/行
    }
    console.log(`✅ Replay finished: ${lines.length} events -> ${timelinePath}`);
  } catch (error) {
    console.error(`❌ Replay failed:`, error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}