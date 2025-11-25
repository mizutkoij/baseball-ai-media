"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { track } from "@/lib/analytics";

type Props = {
  years: number[];
  activeYear: number;
  paramKey?: string; // デフォルト: "year"
  onSwitchEventName?: string; // 計測イベント名（任意）
};

export default function YearTabs({
  years,
  activeYear,
  paramKey = "year",
  onSwitchEventName = "rankings_year_tab_switch",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const items = useMemo(
    () => years.sort((a, b) => b - a),
    [years]
  );

  const onClick = (y: number) => {
    const sp = new URLSearchParams(searchParams?.toString());
    sp.set(paramKey, String(y));
    // 計測
    try {
      track(onSwitchEventName, { year: y });
    } catch {}
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="not-prose">
      <div role="tablist" aria-label="年度選択" className="flex flex-wrap gap-2">
        {items.map((y) => {
          const active = y === activeYear;
          return (
            <button
              key={y}
              role="tab"
              aria-selected={active}
              onClick={() => onClick(y)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700"
              }`}
            >
              {y}
            </button>
          );
        })}
      </div>
    </div>
  );
}