'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, TrendingUp, Target, Activity, Zap, Trophy, Star } from "lucide-react";
import { getABTestConfig, trackABTestConversion, renderVariant } from "@/lib/ab-testing";

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

// A/B テスト用の並び順を定義
const FALLBACK_HIGHLIGHTS_A: TodayHighlight[] = [
  // パターンA: GOTD → Brief → TopBatter → TopPitcher
  {
    type: "GOTD",
    title: "注目の一戦",
    content: "今日の試合から最も注目度の高い対戦カードをピックアップ。両チームの調子と先発投手の相性を分析",
    game: {
      id: "2024080301",
      teams: "阪神 vs 巨人",
      time: "18:00"
    }
  },
  {
    type: "Brief",
    title: "今日のブリーフ",
    content: "NPBの最新トレンドと注目ポイント。セイバーメトリクス指標から見た今日の見どころを解説",
    game: {
      id: "2024080302",
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
      id: "000011194507273",
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
      id: "000021184507289",
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

const FALLBACK_HIGHLIGHTS_B: TodayHighlight[] = [
  // パターンB: Brief → GOTD → TopBatter → TopPitcher
  {
    type: "Brief",
    title: "今日のブリーフ",
    content: "NPBの最新トレンドと注目ポイント。セイバーメトリクス指標から見た今日の見どころを解説",
    game: {
      id: "2024080302",
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
    type: "GOTD",
    title: "注目の一戦",
    content: "今日の試合から最も注目度の高い対戦カードをピックアップ。両チームの調子と先発投手の相性を分析",
    game: {
      id: "2024080301",
      teams: "阪神 vs 巨人",
      time: "18:00"
    }
  },
  {
    type: "TopBatter",
    title: "注目打者",
    content: "WPA（勝利確率貢献度）の高い打者に注目。チームの勝利に直結する活躍が期待される",
    player: {
      id: "000011194507273",
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
      id: "000021184507289",
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
    
    // A/B テストの設定に基づいてフォールバックデータを返す
    const abTest = getABTestConfig('TODAY_HIGHLIGHTS_ORDER');
    return renderVariant(
      abTest,
      FALLBACK_HIGHLIGHTS_A,
      FALLBACK_HIGHLIGHTS_B,
      FALLBACK_HIGHLIGHTS_A
    );
  }
}

export default function TodayHighlightsWithAB() {
  const [highlights, setHighlights] = useState<TodayHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [abTest] = useState(() => getABTestConfig('TODAY_HIGHLIGHTS_ORDER'));

  useEffect(() => {
    fetchTodayHighlights()
      .then(setHighlights)
      .catch(() => {
        const fallbackData = renderVariant(
          abTest,
          FALLBACK_HIGHLIGHTS_A,
          FALLBACK_HIGHLIGHTS_B,
          FALLBACK_HIGHLIGHTS_A
        );
        setHighlights(fallbackData);
      })
      .finally(() => setIsLoading(false));
  }, [abTest]);

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

  const handleCTAClick = (ctaType: string, href: string) => {
    // A/B テストのコンバージョントラッキング
    if (abTest.isEnabled) {
      trackABTestConversion(abTest.testName, abTest.variant, `cta_${ctaType}`);
    }

    // 通常のアナリティクストラッキング
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'today_highlights_cta_click', {
        event_category: 'engagement',
        event_label: ctaType,
        cta_type: ctaType,
        ab_test_variant: abTest.isEnabled ? abTest.variant : 'none'
      });
    }
  };

  const handleDetailClick = (linkType: string, href: string) => {
    // A/B テストのコンバージョントラッキング
    if (abTest.isEnabled) {
      trackABTestConversion(abTest.testName, abTest.variant, `detail_${linkType}`);
    }

    // 通常のアナリティクストラッキング
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'today_highlights_detail_click', {
        event_category: 'engagement',
        event_label: linkType,
        ab_test_variant: abTest.isEnabled ? abTest.variant : 'none'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">今日の見どころ</h2>
          <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 font-medium">LIVE</span>
          {abTest.isEnabled && (
            <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800 font-medium">
              A/B-{abTest.variant}
            </span>
          )}
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
            {highlights === (abTest.variant === 'A' ? FALLBACK_HIGHLIGHTS_A : FALLBACK_HIGHLIGHTS_B) ? "分析中" : "LIVE"}
          </span>
          {abTest.isEnabled && (
            <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800 font-medium">
              Test-{abTest.variant}
            </span>
          )}
        </div>
        
        <div className="text-xs text-slate-400">
          セイバーメトリクス分析による注目ポイント
          {abTest.isEnabled && <span className="ml-2 text-purple-400">({abTest.variant === 'A' ? 'GOTD優先' : 'Brief優先'})</span>}
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
              {index === 0 && abTest.isEnabled && (
                <span className="text-xs px-1 rounded bg-purple-800 text-purple-200">
                  {abTest.variant}
                </span>
              )}
            </div>
            
            <p className="text-slate-300 text-xs mb-3 leading-relaxed">
              {highlight.content}
            </p>
            
            {highlight.player && (
              <div className="mb-3 p-2 bg-black/20 rounded">
                <Link 
                  href={`/players/${highlight.player.id}`}
                  onClick={() => {
                    if (abTest.isEnabled) {
                      trackABTestConversion(abTest.testName, abTest.variant, 'player_link');
                    }
                    if (typeof window !== 'undefined' && (window as any).gtag) {
                      (window as any).gtag('event', 'today_highlights_player_click', {
                        event_category: 'navigation',
                        event_label: highlight.player?.name,
                        highlight_type: highlight.type,
                        ab_test_variant: abTest.isEnabled ? abTest.variant : 'none'
                      });
                    }
                  }}
                  className="text-sm font-medium text-white hover:text-blue-300 transition-colors underline decoration-dotted"
                >
                  👤 {highlight.player.name}
                </Link>
                <div className="text-xs text-slate-400 mt-1">{highlight.player.team}</div>
                <div className="text-xs text-blue-400 hover:text-blue-300 mt-1">
                  → 詳細な成績データを見る
                </div>
              </div>
            )}
            
            {highlight.game && (
              <div className="mb-3 p-2 bg-black/20 rounded">
                <Link 
                  href={`/games/${highlight.game.id}`}
                  onClick={() => {
                    if (abTest.isEnabled) {
                      trackABTestConversion(abTest.testName, abTest.variant, 'game_link');
                    }
                    if (typeof window !== 'undefined' && (window as any).gtag) {
                      (window as any).gtag('event', 'today_highlights_game_click', {
                        event_category: 'navigation',
                        event_label: highlight.game?.teams,
                        highlight_type: highlight.type,
                        ab_test_variant: abTest.isEnabled ? abTest.variant : 'none'
                      });
                    }
                  }}
                  className="text-sm font-medium text-white hover:text-blue-300 transition-colors underline decoration-dotted"
                >
                  ⚾ {highlight.game.teams}
                </Link>
                <div className="text-xs text-slate-400 mt-1">{highlight.game.time}開始</div>
                <div className="text-xs text-green-400 hover:text-green-300 mt-1">
                  → ライブスコア・詳細データ
                </div>
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
      
      {/* Enhanced CTAボタン */}
      <div className="mt-6 space-y-3">
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            href="/games"
            onClick={() => handleCTAClick('games', '/games')}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg font-medium"
          >
            <TrendingUp className="w-4 h-4" />
            今日の全試合を見る
          </Link>
          <Link
            href="/analytics"
            onClick={() => handleCTAClick('analytics', '/analytics')}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg font-medium"
          >
            <Star className="w-4 h-4" />
            高度分析データ
          </Link>
        </div>
        
        <div className="flex justify-center gap-2 text-xs">
          <Link
            href="/players/trending"
            onClick={() => handleDetailClick('trending_players', '/players/trending')}
            className="text-blue-400 hover:text-blue-300 underline decoration-dotted"
          >
            急上昇選手
          </Link>
          <span className="text-slate-500">|</span>
          <Link
            href="/standings"
            onClick={() => handleDetailClick('standings', '/standings')}
            className="text-green-400 hover:text-green-300 underline decoration-dotted"
          >
            詳細順位表
          </Link>
          <span className="text-slate-500">|</span>
          <Link
            href="/rankings"
            onClick={() => handleDetailClick('rankings', '/rankings')}
            className="text-amber-400 hover:text-amber-300 underline decoration-dotted"
          >
            個人ランキング
          </Link>
        </div>
      </div>
      
      {/* フォールバック表示時の注記 */}
      {(highlights === FALLBACK_HIGHLIGHTS_A || highlights === FALLBACK_HIGHLIGHTS_B) && (
        <div className="mt-4 p-3 bg-amber-950/30 border border-amber-800/50 rounded text-center">
          <div className="text-amber-300 text-xs">
            💡 最新データを分析中です。表示は過去の代表的な注目ポイントです。
            {abTest.isEnabled && (
              <span className="ml-2 text-purple-300">
                (テストパターン{abTest.variant}: {abTest.variant === 'A' ? 'GOTD優先' : 'Brief優先'})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}