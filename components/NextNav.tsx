"use client";

import Link from "next/link";
import { Calendar, TrendingUp, Trophy } from "lucide-react";

interface NextNavProps {
  from: string;
}

/**
 * 全ページ共通の「次に見る」回遊導線コンポーネント
 * PV/Visit向上とサイト内回遊の標準化を目的
 */
export function NextNav({ from }: NextNavProps) {
  const items = [
    { 
      href: "/today", 
      label: "今日の試合", 
      icon: Calendar,
      description: "本日の対戦・結果" 
    },
    { 
      href: "/records", 
      label: "記録", 
      icon: TrendingUp,
      description: "年度別・通算記録" 
    },
    { 
      href: "/seasons", 
      label: "シーズン一覧", 
      icon: Trophy,
      description: "2016-2025年総括" 
    },
  ];

  const handleNavClick = (to: string, label: string) => {
    // Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'next_nav_click', {
        from,
        to,
        label,
        event_category: 'navigation'
      });
    }
  };

  return (
    <nav className="mt-10 border-t border-white/10 pt-6">
      <p className="mb-4 text-sm text-slate-400 font-medium">次に見る</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => handleNavClick(item.href, item.label)}
            className="group bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 hover:border-white/20 transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-2">
              <item.icon className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                {item.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </nav>
  );
}