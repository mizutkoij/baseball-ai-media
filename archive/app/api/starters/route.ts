import { NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs/promises";

export const runtime = "nodejs"; // FS読み込みのため

type Pitcher = {
  name: string;
  hand?: "R" | "L";
  era?: number;
  eraMinus?: number;
  note?: string;
};

export type StarterRecord = {
  gameId: string;
  date: string;      // YYYY-MM-DD（JST基準推奨）
  league?: "CL" | "PL";
  home: string;      // チームID（T/G/H/Cなど）
  away: string;
  homePitcher?: Pitcher;
  awayPitcher?: Pitcher;
  confidence?: number; // 0–1
  source?: string;     // "manual" | "provider" | "heuristic"
  updatedAt?: string;  // ISO
};

type StartersPayload = { date: string; items: StarterRecord[] };

function toJstISODate(d = new Date()) {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

async function tryProvider(date: string): Promise<StarterRecord[] | null> {
  try {
    // 任意：adapters で独自プロバイダがあれば使う（将来実装）
    // const mod = await import("../../../adapters/starters/provider");
    // if (mod?.getProbableStarters) return await mod.getProbableStarters(date);
  } catch {}
  return null;
}

async function tryFs(date: string): Promise<StarterRecord[] | null> {
  const file = path.join(process.cwd(), "data", "starters", `${date}.json`);
  try {
    const txt = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(txt) as StartersPayload;
    if (Array.isArray(parsed.items)) return parsed.items;
  } catch {}
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || toJstISODate();
  const gameId = url.searchParams.get("gameId"); // 1件だけ欲しい時
  const team = url.searchParams.get("team");     // 片方のチームIDでフィルタ

  // 優先順: provider → FS → 空
  const fromProvider = await tryProvider(date);
  const items = (fromProvider ?? (await tryFs(date)) ?? []).map((r) => ({
    ...r,
    date: r.date || date,
  }));

  let filtered = items;
  if (gameId) filtered = filtered.filter((r) => r.gameId === gameId);
  if (team) filtered = filtered.filter((r) => r.home === team || r.away === team);

  return NextResponse.json(
    { date, count: filtered.length, items: filtered },
    {
      headers: {
        // 5分CDN、10分SWR
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}