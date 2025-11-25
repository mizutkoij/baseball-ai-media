"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Users } from "lucide-react";

type ScheduleGame = {
  game_id: string;
  date: string;
  start_time_jst: string;
  venue: string;
  status: string;
  inning: string | null;
  away_team: string;
  home_team: string;
  away_score: number | null;
  home_score: number | null;
  league: string;
  links: {
    index: string;
    box: string;
    pbp: string;
  };
};

type ScheduleResponse = {
  source: string;
  league: string;
  date_range: {
    from: string;
    to: string;
  };
  total_games: number;
  games_by_date: Record<string, ScheduleGame[]>;
  summary: {
    scheduled: number;
    in_progress: number;
    final: number;
    postponed: number;
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (dateStr === today.toISOString().split('T')[0]) {
    return "今日";
  } else if (dateStr === yesterday.toISOString().split('T')[0]) {
    return "昨日";
  } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
    return "明日";
  }
  
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  
  return `${month}/${day}(${weekday})`;
};

const formatStatus = (status: string, inning: string | null) => {
  switch (status) {
    case "SCHEDULED":
      return "試合前";
    case "IN_PROGRESS":
      return inning || "試合中";
    case "FINAL":
      return "試合終了";
    case "POSTPONED":
      return "中止";
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
    case "POSTPONED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

export default function SchedulePage() {
  const [currentWeekStart, setCurrentWeekStart] = useState<string>("");
  const [selectedLeague, setSelectedLeague] = useState<"first" | "farm">("first");

  // Initialize current week on client side
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    setCurrentWeekStart(monday.toISOString().split('T')[0]);
  }, []);

  // Calculate week end date
  const weekEnd = currentWeekStart ? (() => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    return end.toISOString().split('T')[0];
  })() : "";

  // Fetch schedule data
  const { data, error, isLoading } = useSWR<ScheduleResponse>(
    currentWeekStart ? `/api/schedule?from=${currentWeekStart}&to=${weekEnd}&league=${selectedLeague}` : null,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );

  const navigateWeek = (direction: -1 | 1) => {
    if (!currentWeekStart) return;
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + (direction * 7));
    setCurrentWeekStart(newStart.toISOString().split('T')[0]);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    setCurrentWeekStart(monday.toISOString().split('T')[0]);
  };

  // Generate week dates
  const weekDates = currentWeekStart ? Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  }) : [];

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-4">データ取得エラー</h1>
            <p className="text-slate-300">スケジュールデータの読み込みに失敗しました。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            ホームに戻る
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">NPB週間スケジュール</h1>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* League Selector */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedLeague("first")}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  selectedLeague === "first"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                一軍
              </button>
              <button
                onClick={() => setSelectedLeague("farm")}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  selectedLeague === "farm"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                ファーム
              </button>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateWeek(-1)}
                className="p-2 text-white hover:text-blue-400 transition-colors"
                disabled={isLoading}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="text-center">
                <div className="text-white font-medium">
                  {currentWeekStart && weekEnd && (
                    <>
                      {formatDate(currentWeekStart)} 〜 {formatDate(weekEnd)}
                    </>
                  )}
                </div>
                <button
                  onClick={goToCurrentWeek}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  今週に戻る
                </button>
              </div>
              
              <button
                onClick={() => navigateWeek(1)}
                className="p-2 text-white hover:text-blue-400 transition-colors"
                disabled={isLoading}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Summary */}
            {data && (
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {data.total_games}試合
                </span>
                {data.summary.in_progress > 0 && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                    {data.summary.in_progress}進行中
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-slate-400">スケジュールを読み込み中...</p>
          </div>
        )}

        {/* Week View */}
        {data && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {weekDates.map((date) => {
              const dayGames = data.games_by_date[date] || [];
              const isToday = date === new Date().toISOString().split('T')[0];
              
              return (
                <div
                  key={date}
                  className={`bg-black/20 backdrop-blur-md border rounded-lg p-4 ${
                    isToday 
                      ? "border-blue-400 bg-blue-900/20" 
                      : "border-white/10"
                  }`}
                >
                  <div className="text-center mb-4">
                    <h3 className={`font-semibold ${
                      isToday ? "text-blue-400" : "text-white"
                    }`}>
                      {formatDate(date)}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {dayGames.length}試合
                    </p>
                  </div>

                  <div className="space-y-3">
                    {dayGames.length === 0 ? (
                      <div className="text-center py-4 text-slate-500 text-sm">
                        試合なし
                      </div>
                    ) : (
                      dayGames.map((game) => (
                        <Link
                          key={game.game_id}
                          href={`/games/${game.game_id}`}
                          className="block bg-black/20 hover:bg-black/30 rounded-lg p-3 transition-colors"
                        >
                          <div className="space-y-2">
                            {/* Teams */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-white font-medium">
                                  {game.away_team}
                                </span>
                                <span className="text-slate-300">
                                  {game.away_score ?? "−"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-white font-medium">
                                  {game.home_team}
                                </span>
                                <span className="text-slate-300">
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
                              </div>
                              
                              <div className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock className="w-3 h-3" />
                                {game.start_time_jst}
                              </div>
                              
                              {game.venue && (
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                  <MapPin className="w-3 h-3" />
                                  {game.venue}
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {data && (
          <div className="mt-8 text-center text-xs text-slate-400">
            <p>データソース: {data.source === "npb_db" ? "NPB公式" : data.source}</p>
            <p>リーグ: {selectedLeague === "first" ? "一軍" : "ファーム"}</p>
          </div>
        )}
      </div>
    </div>
  );
}