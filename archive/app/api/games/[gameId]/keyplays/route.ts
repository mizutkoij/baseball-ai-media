import { NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs/promises";

export const runtime = "nodejs";

export type KeyPlay = {
  index?: number;              // プレイ順（任意）
  inning: number;              // 1..12
  half: "top" | "bottom";      // 表/裏
  team: string;                // チームID（T, G, H, C...）
  description: string;         // 短い要約（日本語OK）
  batterId?: string;
  pitcherId?: string;
  re24?: number;               // +なら攻撃にプラス
  wpa?: number;                // -1..+1（小数）
  leverage?: number;           // 重要度（任意）
  source?: string;             // "manual" | "provider" | "heuristic"
  at?: string;                 // ISO (任意)
};

type Payload = { gameId: string; items: KeyPlay[] };

async function readFs(gameId: string): Promise<KeyPlay[] | null> {
  // どちらかの配置で拾えるように2パス対応
  const candidates = [
    path.join(process.cwd(), "data", "keyplays", `${gameId}.json`),
    path.join(process.cwd(), "data", "games", gameId, "keyplays.json"),
  ];
  for (const f of candidates) {
    try {
      const txt = await fs.readFile(f, "utf8");
      const parsed = JSON.parse(txt) as Payload | KeyPlay[];
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray((parsed as Payload).items)) return (parsed as Payload).items;
    } catch {}
  }
  return null;
}

// 将来: adapters 側の自動計算/取得に差し替え可能
async function tryProvider(gameId: string): Promise<KeyPlay[] | null> {
  try {
    // 将来実装: adapters/keyplays/provider.ts
    // const mod = await import("../../../../../adapters/keyplays/provider");
    // if (mod?.getKeyPlays) return await mod.getKeyPlays(gameId);
  } catch {}
  return null;
}

export async function GET(_: Request, ctx: { params: { gameId: string } }) {
  const gameId = ctx.params.gameId;
  const fromProvider = await tryProvider(gameId);
  const items = (fromProvider ?? (await readFs(gameId)) ?? []).slice();

  // 並び順保証: WPA > RE24 の優先キーで降順（どちらも無い時は index）
  items.sort((a, b) => {
    const aw = typeof a.wpa === "number" ? Math.abs(a.wpa) : -1;
    const bw = typeof b.wpa === "number" ? Math.abs(b.wpa) : -1;
    if (bw !== aw) return bw - aw;
    const ar = typeof a.re24 === "number" ? Math.abs(a.re24) : -1;
    const br = typeof b.re24 === "number" ? Math.abs(b.re24) : -1;
    if (br !== ar) return br - ar;
    return (a.index ?? 0) - (b.index ?? 0);
  });

  return NextResponse.json(
    { gameId, count: items.length, items },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
  );
}