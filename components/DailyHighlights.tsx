"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, TrendingUp, Target, Calendar, ExternalLink } from 'lucide-react';
import { currentSeasonYear } from '@/lib/time';

interface DailyHighlight {
  type: 'wpa' | 're24' | 'gotd' | 'brief';
  title: string;
  subtitle: string;
  description: string;
  link: string;
  icon: 'zap' | 'trending' | 'target' | 'calendar';
  color: string;
}

interface DailyHighlightsProps {
  date?: string; // YYYY-MM-DD format
}

export default function DailyHighlights({ date }: DailyHighlightsProps) {
  const [highlights, setHighlights] = useState<DailyHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = date || new Date().toISOString().split('T')[0];
  const year = currentSeasonYear();

  useEffect(() => {
    const generateHighlights = () => {
      // Daily highlights with direct game/player links (CTR bottom-up)
      const mockHighlights: DailyHighlight[] = [
        {
          type: 'gotd',
          title: 'Game of the Day',
          subtitle: '阪神 vs 巨人',
          description: '伝統の一戦。今シーズン対戦成績3勝3敗の注目カード',
          link: '/games/2024080301', // Direct game link
          icon: 'target',
          color: 'bg-blue-600'
        },
        {
          type: 'wpa',
          title: '注目打者',
          subtitle: '村上宗隆 (ヤクルト)',
          description: 'WPA最大 +0.45。勝利への貢献度が最も高い一打',
          link: '/players/000011194507273', // Direct player link
          icon: 'trending',
          color: 'bg-green-600'
        },
        {
          type: 're24',
          title: '注目投手',
          subtitle: '山本由伸 (オリックス)',
          description: 'RE24最大 -2.8。失点阻止で試合の流れを決定',
          link: '/players/000021184507289', // Direct player link
          icon: 'zap',
          color: 'bg-purple-600'
        },
        {
          type: 'brief',
          title: 'Daily Brief',
          subtitle: `${today} 分析レポート`,
          description: '今日の試合結果とセイバーメトリクス分析。詳細データへの導線も含む',
          link: `/games/2024080302`, // Brief -> specific game
          icon: 'calendar',
          color: 'bg-amber-600'
        }
      ];

      setHighlights(mockHighlights);
      setIsLoading(false);
    };

    generateHighlights();
  }, [today, year]);

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'zap': return <Zap className="w-6 h-6" />;
      case 'trending': return <TrendingUp className="w-6 h-6" />;
      case 'target': return <Target className="w-6 h-6" />;
      case 'calendar': return <Calendar className="w-6 h-6" />;
      default: return <Zap className="w-6 h-6" />;
    }
  };

  if (isLoading) {
    return (
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-amber-200 rounded-full animate-pulse"></div>
          <h2 className="text-xl font-bold text-amber-900">今日の見どころ</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/50 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-amber-200 rounded mb-2"></div>
              <div className="h-3 bg-amber-100 rounded mb-2"></div>
              <div className="h-3 bg-amber-100 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-amber-900">今日の見どころ</h2>
          <span className="px-3 py-1 text-sm rounded-full bg-amber-100 text-amber-800 font-medium">
            {today}
          </span>
        </div>
        <Link
          href="/matchups"
          className="text-sm text-amber-700 hover:text-amber-900 underline font-medium flex items-center gap-1"
        >
          詳細分析へ
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {highlights.map((highlight, index) => (
          <Link
            key={highlight.type}
            href={highlight.link}
            className="group bg-white/80 hover:bg-white border border-amber-200/50 hover:border-amber-300 rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 ${highlight.color} rounded-lg flex items-center justify-center text-white`}>
                {getIcon(highlight.icon)}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900 text-sm">
                  {highlight.title}
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  {highlight.subtitle}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-slate-700 leading-relaxed">
              {highlight.description}
            </p>
            
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                #{index + 1}
              </span>
              <span className="text-xs text-amber-600 group-hover:text-amber-800 font-medium">
                詳細 →
              </span>
            </div>
          </Link>
        ))}
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-xs text-amber-700">
          リアルタイム更新・セイバーメトリクス解析による注目ポイント抽出
        </p>
      </div>
    </section>
  );
}