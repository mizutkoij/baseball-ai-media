"use client";

import { useEffect, useState } from "react";
import type { KeyPlay } from "@/app/api/games/[gameId]/keyplays/route";

type Props = {
  gameId: string;
  limit?: number;          // 既定3
  dense?: boolean;         // テーブル寄せの詰め表示
};

export default function KeyPlays({ gameId, limit = 3, dense }: Props) {
  const [items, setItems] = useState<KeyPlay[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/keyplays`, {
          next: { revalidate: 300 }
        });
        const json = await res.json();
        if (alive) {
          setItems(json.items ?? []);
          setLoading(false);
          try {
            // 表示時に一度だけビュー計測
            if ((json.items?.length ?? 0) > 0) {
              // @ts-ignore
              window.gtag?.("event", "game_keyplays_view", { gameId, count: json.items.length });
              // @ts-ignore
              window.plausible?.("game_keyplays_view", { props: { gameId, count: json.items.length } });
            }
          } catch {}
        }
      } catch {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [gameId]);

  if (loading) {
    return <div className="rounded border bg-white p-3 text-sm text-slate-500">重要プレーを集計中…</div>;
  }

  if (!items || items.length === 0) {
    return <div className="rounded border bg-white p-3 text-sm text-slate-500">重要プレーのデータは準備中です。</div>;
  }

  const top = items.slice(0, limit);

  const Badge = ({ label }: { label: string }) => (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border">{label}</span>
  );

  const Metric = ({ re24, wpa }: { re24?: number; wpa?: number }) => {
    return (
      <div className="flex items-center gap-2 text-xs">
        {typeof wpa === "number" && (
          <span className={`font-medium ${wpa >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            WPA { (wpa >= 0 ? "+" : "") + (Math.round(wpa * 1000) / 10).toFixed(1) }%
          </span>
        )}
        {typeof re24 === "number" && (
          <span className={`font-medium ${re24 >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            RE24 { (re24 >= 0 ? "+" : "") + (Math.round(re24 * 100) / 100).toFixed(2) }
          </span>
        )}
      </div>
    );
  };

  function onClickRow(k: KeyPlay, idx: number) {
    try {
      // @ts-ignore
      window.gtag?.("event", "game_keyplay_click", { gameId, idx, wpa: k.wpa, re24: k.re24 });
      // @ts-ignore
      window.plausible?.("game_keyplay_click", { props: { gameId, idx, wpa: k.wpa, re24: k.re24 } });
    } catch {}
  }

  return (
    <div className="rounded border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">重要プレー（RE24/WPA）</div>
        <div className="text-xs text-slate-500">トップ{limit}件を表示</div>
      </div>

      <div className="divide-y">
        {top.map((k, i) => (
          <button
            key={i}
            onClick={() => onClickRow(k, i)}
            className={`w-full text-left py-2 ${dense ? "px-1" : "px-2"} hover:bg-amber-50/50 transition-colors`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge label={`${k.inning}回${k.half === "top" ? "表" : "裏"}`} />
                  <Badge label={k.team} />
                </div>
                <div className="text-sm mt-1 line-clamp-2">{k.description}</div>
              </div>
              <Metric re24={k.re24} wpa={k.wpa} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}