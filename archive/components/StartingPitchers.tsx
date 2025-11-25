"use client";

import { useEffect, useState } from "react";
import type { StarterRecord } from "@/app/api/starters/route";

type Props = {
  gameId: string;
  home: string;
  away: string;
  compact?: boolean;
};

export default function StartingPitchers({ gameId, home, away, compact }: Props) {
  const [rec, setRec] = useState<StarterRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/starters?gameId=${encodeURIComponent(gameId)}`, {
          next: { revalidate: 300 },
        });
        const json = await res.json();
        const found = (json.items as StarterRecord[])[0] || null;
        if (alive) {
          setRec(found);
          setLoading(false);
          try {
            // 計測（存在時のみ）
            if (found) {
              // @ts-ignore
              window.gtag?.("event", "matchups_starters_view", { gameId, source: found.source, confidence: found.confidence });
              // @ts-ignore
              window.plausible?.("matchups_starters_view", { props: { gameId, source: found.source, confidence: found.confidence } });
            }
          } catch {}
        }
      } catch {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gameId]);

  const P = ({ name, hand, era, eraMinus, note }: any) => {
    if (!name) return <span className="text-slate-400">未発表</span>;
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-semibold">{name}</span>
        {hand ? <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 border">{hand}</span> : null}
        {typeof era === "number" ? <span className="text-xs text-slate-600">ERA {era.toFixed(2)}</span> : null}
        {typeof eraMinus === "number" ? <span className="text-xs text-slate-600">/ ERA- {Math.round(eraMinus)}</span> : null}
        {note ? <span className="text-xs text-slate-500">({note})</span> : null}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="rounded border bg-white p-3 text-sm text-slate-500">先発情報を取得中…</div>
    );
  }

  if (!rec) {
    return (
      <div className="rounded border bg-white p-3 text-sm text-slate-500">
        予告先発はまだありません（{home} vs {away}）
      </div>
    );
  }

  const conf = typeof rec.confidence === "number" ? Math.round(rec.confidence * 100) : null;

  return (
    <div className="rounded border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">予告先発</div>
        <div className="text-xs text-slate-500">
          {rec.source ? `source: ${rec.source}` : "source: n/a"}
          {conf !== null ? ` · 信頼度 ${conf}%` : null}
        </div>
      </div>
      <div className={`grid ${compact ? "grid-cols-1 gap-2" : "grid-cols-2 gap-3"}`}>
        <div>
          <div className="text-xs text-slate-500 mb-1">{away}（ビジター）</div>
          <P {...rec.awayPitcher} />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">{home}（ホーム）</div>
          <P {...rec.homePitcher} />
        </div>
      </div>
    </div>
  );
}