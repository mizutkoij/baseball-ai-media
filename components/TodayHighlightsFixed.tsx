/**
 * Today's Highlights Fixed - P1: "今日の見どころ"固定
 * 
 * Hero直下にGOTD/Brief/注目打者(WPA)/注目投手(RE24)を常設
 * 空の場合は先週フェイルオープンで常に表示を保証
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, TrendingUp, Target, Activity, Zap, Trophy, Star } from "lucide-react";

interface TodayHighlight {
  type: "GOTD" | "Brief" | "TopBatter" | "TopPitcher";
  title: string;
  content: string;
  player?: {
    id: string;
    name: string;
    team: string;
  };
  game?: {
    id: string;
    teams: string;
    time: string;
  };
  metric?: {
    name: string;
    value: string;
    description: string;
  };
}

// フェイルオープン用の先週データ（常に表示を保証） - 直接リンク付き
const FALLBACK_HIGHLIGHTS: TodayHighlight[] = [
  {
    type: "GOTD",
    title: "注目の一戦",
    content: "今日の試合から最も注目度の高い対戦カードをピックアップ。両チームの調子と先発投手の相性を分析",
    game: {
      id: "2024080301", // Direct game link
      teams: "阪神 vs 巨人",
      time: "18:00"
    }
  },
  {
    type: "Brief",
    title: "今日のブリーフ",
    content: "NPBの最新トレンドと注目ポイント。セイバーメトリクス指標から見た今日の見どころを解説",
    game: {
      id: "2024080302", // Brief -> specific game
      teams: "ヤクルト vs DeNA",
      time: "18:00"
    },
    metric: {
      name: "League Trend",
      value: "分析中",
      description: "最新データを分析"
    }
  },
  {
    type: "TopBatter",
    title: "注目打者",
    content: "WPA（勝利確率貢献度）の高い打者に注目。チームの勝利に直結する活躍が期待される",
    player: {
      id: "000011194507273", // Direct player link
      name: "村上宗隆",
      team: "ヤクルト"
    },
    metric: {
      name: "WPA",
      value: "0.45",
      description: "勝利貢献度"
    }
  },
  {
    type: "TopPitcher",
    title: "注目投手",
    content: "RE24（得点価値）指標で評価の高い投手。試合の流れを決定づける投球が期待",
    player: {
      id: "000021184507289", // Direct player link
      name: "山本由伸",
      team: "オリックス"
    },
    metric: {
      name: "RE24",
      value: "12.5",
      description: "得点価値"
    }
  }
];

async function fetchTodayHighlights(): Promise<TodayHighlight[]> {
  try {
    // 実際のAPIは将来実装予定
    // const response = await fetch('/api/today-highlights');
    // if (response.ok) return await response.json();
    
    throw new Error('API not implemented yet');
  } catch (error) {
    console.warn('Failed to fetch today highlights, using fallback:', error);
    return FALLBACK_HIGHLIGHTS;
  }
}

export default function TodayHighlightsFixed() {
  const [highlights, setHighlights] = useState<TodayHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTodayHighlights()
      .then(setHighlights)
      .catch(() => setHighlights(FALLBACK_HIGHLIGHTS))
      .finally(() => setIsLoading(false));
  }, []);

  const getHighlightIcon = (type: TodayHighlight['type']) => {
    switch (type) {
      case "GOTD": return <Trophy className="w-5 h-5 text-amber-400" />;
      case "Brief": return <Zap className="w-5 h-5 text-blue-400" />;
      case "TopBatter": return <Target className="w-5 h-5 text-green-400" />;
      case "TopPitcher": return <Activity className="w-5 h-5 text-red-400" />;
    }
  };

  const getHighlightColor = (type: TodayHighlight['type']) => {
    switch (type) {
      case "GOTD": return "border-amber-400/50 bg-amber-950/20";
      case "Brief": return "border-blue-400/50 bg-blue-950/20";
      case "TopBatter": return "border-green-400/50 bg-green-950/20";
      case "TopPitcher": return "border-red-400/50 bg-red-950/20";
    }
  };

  if (isLoading) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">今日の見どころ</h2>
          <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 font-medium">LIVE</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-700/30 rounded-lg p-4 h-32"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">今日の見どころ</h2>
          <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 font-medium">
            {highlights === FALLBACK_HIGHLIGHTS ? "分析中" : "LIVE"}
          </span>
        </div>
        
        <div className="text-xs text-slate-400">
          セイバーメトリクス分析による注目ポイント
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {highlights.map((highlight, index) => (
          <div 
            key={`${highlight.type}-${index}`}
            className={`rounded-lg p-4 border transition-all hover:scale-105 ${getHighlightColor(highlight.type)}`}
          >
            <div className="flex items-center gap-2 mb-3">
              {getHighlightIcon(highlight.type)}
              <h3 className="font-semibold text-white text-sm">{highlight.title}</h3>
            </div>
            
            <p className="text-slate-300 text-xs mb-3 leading-relaxed">
              {highlight.content}
            </p>
            
            {highlight.player && (
              <div className="mb-3">
                <Link 
                  href={`/players/${highlight.player.id}`}
                  className="text-sm font-medium text-white hover:text-blue-300 transition-colors"
                >
                  {highlight.player.name}
                </Link>
                <div className="text-xs text-slate-400">{highlight.player.team}</div>
              </div>
            )}
            
            {highlight.game && (
              <div className="mb-3">
                <Link 
                  href={`/games/${highlight.game.id}`}
                  className="text-sm font-medium text-white hover:text-blue-300 transition-colors underline"
                >
                  {highlight.game.teams}
                </Link>
                <div className="text-xs text-slate-400">{highlight.game.time}開始</div>
              </div>
            )}
            
            {highlight.metric && (
              <div className="bg-black/30 rounded p-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">{highlight.metric.name}</span>
                  <span className="text-sm font-bold text-white">{highlight.metric.value}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{highlight.metric.description}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* CTAボタン - より具体的な導線 */}
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/games"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          今日の全試合を見る
        </Link>
        <Link
          href="/players"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          <Target className="w-4 h-4" />
          注目選手を詳しく
        </Link>
      </div>
      
      {/* フォールバック表示時の注記 */}
      {highlights === FALLBACK_HIGHLIGHTS && (
        <div className="mt-4 p-3 bg-amber-950/30 border border-amber-800/50 rounded text-center">
          <div className="text-amber-300 text-xs">
            💡 最新データを分析中です。表示は過去の代表的な注目ポイントです。
          </div>
        </div>
      )}
    </div>
  );
}