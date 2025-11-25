"use client";

import React from 'react';
import { pfDiffComment } from "@/lib/pf/diffComment";

interface PFDeltaNoteProps {
  raw: number;
  neutral: number;
  pf: number;
  metric: string;
}

/**
 * PF補正前後の差分を表示するコンポーネント
 * TeamSplitsなどで各指標の補正効果を可視化
 */
export function PFDeltaNote({ raw, neutral, pf, metric }: PFDeltaNoteProps) {
  const { text, dir, pct } = pfDiffComment(metric, raw, neutral, pf);
  
  // Analytics tracking
  React.useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'pf_comment_view', {
        metric,
        dir,
        pct: Math.round(pct * 1000) / 10, // 小数点1桁に丸める
        event_category: 'pf_analysis'
      });
    }
  }, [metric, dir, pct]);

  const colorClass = 
    dir === "up" ? "text-emerald-500" : 
    dir === "down" ? "text-rose-500" : 
    "text-slate-400";

  return (
    <div className={`text-sm mt-2 ${colorClass} font-medium`}>
      {text}
    </div>
  );
}

