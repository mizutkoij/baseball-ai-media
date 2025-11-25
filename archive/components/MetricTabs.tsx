"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";

export type Metric = "batting" | "pitching" | "fielding";

const LABELS: Record<Metric, string> = {
  batting: "打者",
  pitching: "投手",
  fielding: "守備",
};

type Props = {
  active: Metric;
  available?: Metric[]; // 例: ["batting","pitching"]（fielding未実装なら省略）
  onSwitchEventName?: string; // 計測イベント名
};

export default function MetricTabs({
  active,
  available = ["batting", "pitching", "fielding"],
  onSwitchEventName = "rankings_metric_tab_switch",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onClick = (m: Metric) => {
    const next = new URLSearchParams(sp?.toString());
    next.set("metric", m);
    try {
      // @ts-ignore
      window.gtag?.("event", onSwitchEventName, { metric: m });
      // @ts-ignore
      window.plausible?.(onSwitchEventName, { props: { metric: m } });
    } catch {}
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="not-prose">
      <div role="tablist" aria-label="指標切り替え" className="flex flex-wrap gap-2">
        {available.map((m) => {
          const selected = m === active;
          return (
            <button
              key={m}
              role="tab"
              aria-selected={selected}
              onClick={() => onClick(m as Metric)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-sm border transition",
                selected
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700"
              )}
            >
              {LABELS[m as Metric]}
            </button>
          );
        })}
      </div>
    </div>
  );
}