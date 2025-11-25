"use client";

import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";

interface BriefCTALinksProps {
  dateStr: string;
}

// Brief CTA クリックイベント
const handleBriefCTAClick = (location: string, label: string, dateStr: string) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'cta_click', {
      loc: location,
      label: label,
      date: dateStr,
      source: 'brief'
    });
  }
};

export default function BriefCTALinks({ dateStr }: BriefCTALinksProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        href={`/column/brief/${dateStr}`}
        onClick={() => handleBriefCTAClick('brief', '詳細を見る', dateStr)}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
      >
        <Calendar className="w-4 h-4" />
        詳細を見る
      </Link>
      <Link
        href="/today"
        onClick={() => handleBriefCTAClick('brief', '今日の試合', dateStr)}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        今日の試合
      </Link>
    </div>
  );
}