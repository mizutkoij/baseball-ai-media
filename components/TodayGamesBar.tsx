"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiGet, TodayGame, TodayGamesResponse } from "@/lib/api";
import Link from "next/link";

interface TodayGamesBarProps {
  refreshInterval?: number;
  defaultLeague?: string;
}

export default function TodayGamesBar({ refreshInterval = 30000, defaultLeague = "first" }: TodayGamesBarProps) {
  const wpaThreshold = 0.08;
  const [currentLeague, setCurrentLeague] = useState<string>(defaultLeague);
  
  const { data, error, isLoading } = useSWR<TodayGamesResponse>(
    ['/api/today-games', currentLeague, wpaThreshold], 
    () => apiGet(`/api/today-games?league=${currentLeague}`), 
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  );

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
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCurrentLeague("first")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  currentLeague === "first"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                一軍
              </button>
              <button
                onClick={() => setCurrentLeague("farm")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  currentLeague === "farm"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
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
              
              {/* League Badge */}
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {currentLeague === "first" ? "一軍" : "二軍"} ({data?.games || 0}試合)
              </span>
              
              {totalHighlights > 0 && (
                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                  ⭐️ {totalHighlights} ハイライト
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              🕐 更新: {lastUpdateMinutes === 0 ? "最新" : `${lastUpdateMinutes}分前`}
            </span>
            <span>閾値: {data?.wpa_threshold ? `${(data.wpa_threshold * 100).toFixed(0)}%` : "8%"}</span>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data?.map((game) => (
            <Link
              key={game.game_id}
              href={`/games/${game.game_id}`}
              className="block"
              aria-label={`${game.away_team} vs ${game.home_team} の詳細（WP推移・ハイライト）を見る`}
            >
              <div className="relative bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg p-4 border border-gray-200 hover:border-gray-300">
                {/* Highlights Badge */}
                {game.highlights_count && game.highlights_count > 0 && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-300 font-medium">
                    ⭐️ {game.highlights_count}
                  </div>
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
                    <div className="text-xs text-amber-600 mt-1">
                      📈 {game.highlights_count}件の重要場面
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )) || (
            <div className="col-span-full text-center py-8 text-gray-500">
              試合データがありません
            </div>
          )}
        </div>

        {/* Footer Info */}
        {data?.data && data.data.length > 0 && (
          <div className="mt-3 text-xs text-gray-500 text-center">
            {data.data.length}試合 | 
            {isRealMode ? " リアルタイム更新" : " 基本モード"} | 
            ハイライト基準: 勝率変動 ≥ {data?.wpa_threshold ? `${(data.wpa_threshold * 100).toFixed(0)}%` : "8%"}
          </div>
        )}
      </div>
    </div>
  );
}