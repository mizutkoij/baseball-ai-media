"use client";

import Link from "next/link";
import { Calendar, TrendingUp, Trophy, Users, BarChart3, Target, ArrowRight } from "lucide-react";

interface NextNavProps {
  from: string;
  entityType?: "player" | "team" | "game" | "season" | "general";
  entityId?: string;
  contextualSuggestions?: Array<{
    href: string;
    label: string;
    description: string;
    icon?: React.ComponentType<any>;
    priority?: number;
  }>;
}

/**
 * 全ページ共通の「次に見る」回遊導線コンポーネント - 共有体験磨き強化版
 * PV/Visit向上とサイト内回遊の標準化を目的 + コンテキスト対応
 */
export function NextNav({ 
  from, 
  entityType = "general", 
  entityId, 
  contextualSuggestions = [] 
}: NextNavProps) {
  
  // エンティティタイプ別のデフォルト導線
  const getDefaultSuggestions = () => {
    switch (entityType) {
      case "player":
        return [
          { href: "/players", label: "他の選手", icon: Users, description: "選手データベース" },
          { href: "/records", label: "記録比較", icon: TrendingUp, description: "歴代記録ランキング" },
          { href: "/teams", label: "チーム", icon: Trophy, description: "所属チーム情報" }
        ];
      case "team":
        return [
          { href: "/teams", label: "他のチーム", icon: Users, description: "全12球団" },
          { href: "/standings", label: "順位表", icon: BarChart3, description: "リーグ順位" },
          { href: "/matchups", label: "対戦分析", icon: Target, description: "チーム対戦相性" }
        ];
      case "game":
        return [
          { href: "/games", label: "試合一覧", icon: Calendar, description: "今日の全試合" },
          { href: "/players", label: "注目選手", icon: Target, description: "今日の活躍選手" },
          { href: "/standings", label: "順位への影響", icon: TrendingUp, description: "順位表更新" }
        ];
      case "season":
        return [
          { href: "/seasons", label: "他のシーズン", icon: Trophy, description: "2016-2025年" },
          { href: "/records", label: "記録", icon: TrendingUp, description: "年度別記録" },
          { href: "/players", label: "選手", icon: Users, description: "活躍選手" }
        ];
      default:
        return [
          { href: "/games", label: "今日の試合", icon: Calendar, description: "本日の対戦・結果" },
          { href: "/records", label: "記録", icon: TrendingUp, description: "年度別・通算記録" },
          { href: "/players", label: "選手", icon: Users, description: "選手データベース" }
        ];
    }
  };

  // コンテキスト提案 + デフォルト提案を統合
  const allSuggestions = [...contextualSuggestions, ...getDefaultSuggestions()];
  
  // 重複除去 & 優先度ソート & 3つに制限
  const uniqueSuggestions = allSuggestions
    .filter((item, index, self) => 
      index === self.findIndex(t => t.href === item.href)
    )
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, 3);

  const items = uniqueSuggestions.map(suggestion => ({
    href: suggestion.href,
    label: suggestion.label,
    icon: suggestion.icon || Target,
    description: suggestion.description
  }));

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

  if (items.length === 0) return null;

  return (
    <nav className="mt-10 border-t border-white/10 pt-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400 font-medium">次に見る</p>
        <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 font-medium">
          {entityType === "general" ? "おすすめ" : "関連"}
        </span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => handleNavClick(item.href, item.label)}
            className="group bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 hover:border-white/20 transition-all duration-200 hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-blue-400" />
                <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                  {item.label}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </div>
            <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              {item.description}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">#{index + 1}</span>
              <span className="text-xs text-blue-600 group-hover:text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                詳細 →
              </span>
            </div>
          </Link>
        ))}
      </div>
      
      {/* より多くの選択肢へのリンク */}
      <div className="mt-4 text-center">
        <Link
          href={entityType === "player" ? "/players" : entityType === "team" ? "/teams" : "/"}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
        >
          さらに探す
        </Link>
      </div>
    </nav>
  );
}