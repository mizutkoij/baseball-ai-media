"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { apiGet, TodayGame, TodayGamesResponse } from "@/lib/api";
import Link from "next/link";

interface TodayGamesBarProps {
  refreshInterval?: number;
  defaultLeague?: string;
}

export default function TodayGamesBar({ refreshInterval = 30000, defaultLeague = "first" }: TodayGamesBarProps) {
  const searchParams = useSearchParams();
  const urlWpaThreshold = searchParams.get('wpa') ? parseFloat(searchParams.get('wpa')!) : null;
  
  // Load saved threshold from localStorage
  const getSavedThreshold = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wpaThreshold');
      if (saved) {
        const num = parseFloat(saved);
        if (num >= 0.01 && num <= 0.5) return num;
      }
    }
    return 0.08;
  };
  
  const wpaThreshold = urlWpaThreshold && urlWpaThreshold >= 0.01 && urlWpaThreshold <= 0.5 
    ? urlWpaThreshold 
    : getSavedThreshold();
  
  const [currentLeague, setCurrentLeague] = useState<string>(defaultLeague);
  const [showHighlightsOnly, setShowHighlightsOnly] = useState<boolean>(false);
  const [customThreshold, setCustomThreshold] = useState<string>((wpaThreshold * 100).toFixed(0));
  
  const { data, error, isLoading } = useSWR<TodayGamesResponse>(
    ['/api/today-games', currentLeague, wpaThreshold], 
    () => apiGet(`/api/today-games?league=${currentLeague}`), 
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  );

  const handleThresholdChange = (newThreshold: string) => {
    const numThreshold = parseFloat(newThreshold) / 100;
    if (numThreshold >= 0.01 && numThreshold <= 0.5) {
      // Save to localStorage for persistence
      localStorage.setItem('wpaThreshold', numThreshold.toString());
      
      const url = new URL(window.location.href);
      url.searchParams.set('wpa', numThreshold.toFixed(3));
      window.history.replaceState({}, '', url.toString());
      window.location.reload(); // Simple approach for immediate effect
    }
  };

  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [lastUpdateMinutes, setLastUpdateMinutes] = useState<number>(0);
  const [isRealMode, setIsRealMode] = useState(false);

  useEffect(() => {
    if (data) {
      const now = new Date();
      setLastUpdate(now.toLocaleTimeString());
      setIsRealMode(data.source === "real");
      
      // Calculate minutes since API timestamp
      if (data.ts) {
        const apiTime = new Date(data.ts);
        const minutesDiff = Math.floor((now.getTime() - apiTime.getTime()) / (1000 * 60));
        setLastUpdateMinutes(minutesDiff);
      }
    }
  }, [data]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600 text-sm">
          ⚠️ データ取得エラー: {error.message}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 text-sm">今日の試合を読み込み中...</p>
        </div>
      </div>
    );
  }

  const formatStatus = (status: string, inning: string | null) => {
    switch (status) {
      case "SCHEDULED":
        return "試合前";
      case "IN_PROGRESS":
        return inning || "試合中";
      case "FINAL":
        return "試合終了";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return "bg-gray-100 text-gray-700";
      case "IN_PROGRESS":
        return "bg-green-100 text-green-700";
      case "FINAL":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const totalHighlights = data?.data?.reduce((sum, game) => sum + (game.highlights_count || 0), 0) || 0;
  
  // Filter games based on highlights toggle
  const filteredGames = data?.data?.filter(game => {
    if (showHighlightsOnly) {
      return game.highlights_count && game.highlights_count > 0;
    }
    return true;
  }) || [];
  
  const highlightGamesCount = data?.data?.filter(game => game.highlights_count && game.highlights_count > 0).length || 0;

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800">
              ⚾️ 今日の試合
            </h2>
            
            {/* League Tabs */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1" role="tablist" aria-label="リーグ選択">
              <button
                onClick={() => setCurrentLeague("first")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  currentLeague === "first"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                role="tab"
                aria-selected={currentLeague === "first"}
                aria-controls="games-panel"
              >
                一軍
              </button>
              <button
                onClick={() => setCurrentLeague("farm")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  currentLeague === "farm"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                role="tab"
                aria-selected={currentLeague === "farm"}
                aria-controls="games-panel"
              >
                二軍
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isRealMode
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {isRealMode ? "🔴 REAL" : "📊 BASIC"}
              </span>
              
              {/* Week Schedule Link */}
              <Link
                href="/schedule"
                className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium hover:bg-purple-200 transition-colors"
              >
                📅 週表示
              </Link>
              
              {/* League Badge */}
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {currentLeague === "first" ? "一軍" : "二軍"} ({data?.games || 0}試合)
              </span>
              
              {totalHighlights > 0 && (
                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                  ⭐️ {totalHighlights} ハイライト
                </span>
              )}
              
              {/* Highlights Filter Toggle */}
              {highlightGamesCount > 0 && (
                <button
                  onClick={() => setShowHighlightsOnly(!showHighlightsOnly)}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 ${
                    showHighlightsOnly
                      ? "bg-amber-200 text-amber-900 border border-amber-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  role="button"
                  aria-pressed={showHighlightsOnly}
                  aria-label={showHighlightsOnly ? "全試合を表示する" : "ハイライトのある試合のみ表示する"}
                >
                  {showHighlightsOnly ? "📌 ハイライトのみ" : "🔍 全試合"}
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              🕐 更新: {lastUpdateMinutes === 0 ? "最新" : `${lastUpdateMinutes}分前`}
            </span>
            
            {/* WPA Threshold Control */}
            <div className="flex items-center gap-1">
              <span>閾値:</span>
              <input
                type="number"
                min="1"
                max="50"
                step="1"
                value={customThreshold}
                onChange={(e) => setCustomThreshold(e.target.value)}
                onBlur={() => handleThresholdChange(customThreshold)}
                onKeyPress={(e) => e.key === 'Enter' && handleThresholdChange(customThreshold)}
                className="w-10 px-1 text-xs border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="WPAハイライト閾値パーセント"
              />
              <span>%</span>
              {urlWpaThreshold && (
                <span className="text-xs text-blue-600">(カスタム)</span>
              )}
            </div>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="games-panel" role="tabpanel">
          {showHighlightsOnly && filteredGames.length === 0 && (
            <div className="col-span-full text-center py-8 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="mb-3">⭐️</div>
              <p className="text-sm text-gray-700 mb-4">現在、ハイライトがある試合はありません</p>
              
              <div className="flex flex-col gap-2 items-center">
                <p className="text-xs text-gray-600 mb-2">以下の方法をお試しください：</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowHighlightsOnly(false)}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  >
                    🔍 全試合を表示
                  </button>
                  
                  <button
                    onClick={() => {
                      setCustomThreshold("5");
                      handleThresholdChange("5");
                    }}
                    className="px-3 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
                  >
                    📉 閾値を5%に下げる
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  試合が進行すると、重要な場面でハイライトが自動生成されます
                </p>
              </div>
            </div>
          )}
          
          {filteredGames.map((game) => (
            <Link
              key={game.game_id}
              href={`/games/${game.game_id}`}
              className="block"
              aria-label={`${game.away_team} vs ${game.home_team} の詳細（WP推移・ハイライト）を見る`}
            >
              <div className="relative bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg p-4 border border-gray-200 hover:border-gray-300">
                {/* Highlights Badge */}
                {game.highlights_count && game.highlights_count > 0 && (
                  <Link
                    href={`/games/${game.game_id}#highlights`}
                    className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-300 font-medium hover:bg-amber-200 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
                    aria-label={`${game.highlights_count}件のハイライトを詳細表示`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                  >
                    ⭐️ {game.highlights_count}
                  </Link>
                )}

                {/* Teams */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">
                      {game.away_team}
                    </span>
                    <span className="font-bold text-lg text-gray-900">
                      {game.away_score ?? "−"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">
                      {game.home_team}
                    </span>
                    <span className="font-bold text-lg text-gray-900">
                      {game.home_score ?? "−"}
                    </span>
                  </div>
                </div>

                {/* Game Info */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                        game.status
                      )}`}
                    >
                      {formatStatus(game.status, game.inning)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {game.start_time_jst}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    📍 {game.venue}
                    {game.tv && (
                      <span className="ml-2">📺 {game.tv}</span>
                    )}
                  </div>

                  {/* Highlight Info */}
                  {game.highlights_count && game.highlights_count > 0 && (
                    <div className="text-xs text-amber-600 mt-1 flex items-center justify-between">
                      <span>📈 {game.highlights_count}件の重要場面</span>
                      {game.last_highlight_ts && (
                        <span className="text-xs text-gray-400">
                          最新: {new Date(game.last_highlight_ts).toLocaleTimeString('ja-JP', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Highlight Visual Indicator */}
                  {game.highlights_count && game.highlights_count > 0 && (
                    <div className="flex gap-1 mt-1">
                      {Array.from({ length: Math.min(game.highlights_count, 5) }, (_, i) => (
                        <div
                          key={i}
                          className="w-2 h-1 bg-amber-400 rounded-full"
                          title={`${game.highlights_count}件のハイライト`}
                        />
                      ))}
                      {game.highlights_count > 5 && (
                        <span className="text-xs text-amber-600 ml-1">+{game.highlights_count - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )) || (!showHighlightsOnly && (
            <div className="col-span-full text-center py-8 text-gray-500">
              試合データがありません
            </div>
          ))}
        </div>

        {/* Footer Info */}
        {data?.data && data.data.length > 0 && (
          <div className="mt-3 text-xs text-gray-500 text-center">
            {showHighlightsOnly ? 
              `${filteredGames.length}/${data.data.length}試合（ハイライトあり）` :
              `${data.data.length}試合`
            } | 
            {isRealMode ? " リアルタイム更新" : " 基本モード"} | 
            ハイライト基準: 勝率変動 ≥ {data?.wpa_threshold ? `${(data.wpa_threshold * 100).toFixed(0)}%` : "8%"}
          </div>
        )}
      </div>
    </div>
  );
}