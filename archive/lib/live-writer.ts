// lib/live-writer.ts
import fs from "fs/promises";
import path from "path";
import { sendLiveEventBuffered } from './discord-notifier';

export type LiveEvent = {
  ts: string; gameId: string;
  inning: number; top: boolean; outs: 0|1|2; bases: number;
  homeScore: number; awayScore: number; scoreDiff: number;
  p_pregame: number; p_state: number; w: number;
  p_home_raw: number; p_home: number; p_away: number;
  conf: "high"|"medium"|"low";
};

function dirOf(baseDir: string, date: string, gameId: string) {
  return path.join(baseDir, "predictions", "live", `date=${date}`, gameId);
}

/** 状態が変わっていなければ skip（重複抑止） */
function isSameState(a: LiveEvent, b: LiveEvent) {
  return a.inning === b.inning && a.top === b.top && a.outs === b.outs &&
         a.bases === b.bases && a.scoreDiff === b.scoreDiff &&
         Math.abs(a.p_home - b.p_home) < 1e-4;
}

export async function appendLiveEvent(baseDir: string, date: string, ev: LiveEvent) {
  const d = dirOf(baseDir, date, ev.gameId);
  await fs.mkdir(d, { recursive: true });
  const latestPath = path.join(d, "latest.json");
  const timelinePath = path.join(d, "timeline.jsonl");

  let prev: LiveEvent | null = null;
  try { prev = JSON.parse(await fs.readFile(latestPath, "utf-8")); } catch {}

  if (prev && isSameState(ev, prev)) {
    return { action: "skip", path: latestPath };
  }

  await fs.appendFile(timelinePath, JSON.stringify(ev) + "\n", "utf-8");
  await fs.writeFile(latestPath, JSON.stringify(ev, null, 2), "utf-8");
  
  // Discord通知: ライブ一球を"毎回"バッファリング送信
  sendLiveEventBuffered(ev);
  
  return { action: "write", path: timelinePath };
}

/** 汎用的なJSONL追記ヘルパー */
export async function appendJsonl(baseDir: string, relativePath: string, data: any): Promise<void> {
  const fullPath = path.join(baseDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.appendFile(fullPath, JSON.stringify(data) + "\n", "utf-8");
  
  // Discord通知: 汎用JSONLイベントもバッファリング送信
  sendLiveEventBuffered({ ...data, _path: relativePath });
}

/** 汎用的なlatest.json書き込みヘルパー */
export async function writeLatest(baseDir: string, relativePath: string, data: any): Promise<void> {
  const fullPath = path.join(baseDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), "utf-8");
}