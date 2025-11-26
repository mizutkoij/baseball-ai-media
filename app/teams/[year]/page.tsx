"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Users, TrendingUp, Calendar, Filter, Star, Target, Activity } from "lucide-react";

type TeamPlayer = {
  player_id: string;
  name: string;
  name_kana?: string;
  primary_pos: "P" | "B";
  is_active: boolean;
  active_confidence?: string;
};

type TeamData = {
  team: string;
  player_count: number;
  pitchers: number;
  fielders: number;
  active_players: number;
  players: TeamPlayer[];
};

type YearData = {
  year: number;
  total_teams: number;
  total_players: number;
  teams: TeamData[];
};

type YearsData = {
  total_years: number;
  year_range: {
    earliest: number;
    latest: number;
  };
  recent_years: Array<{
    year: number;
    team_count: number;
    total_players: number;
  }>;
  all_years: Array<{
    year: number;
    team_count: number;
    total_players: number;
  }>;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TeamsByYear({ params }: { params: { year: string } }) {
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<"ALL" | "P" | "B">("ALL");

  const { data, isLoading, error } = useSWR<YearData>(
    `/data/players/teams_by_year/${params.year}.json`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5分間キャッシュ
    }
  );

  // 年度一覧データをロード
  const { data: yearsData } = useSWR<YearsData>(
    "/data/players/years_available.json",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 600000, // 10分間キャッシュ
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-600 rounded mb-6 w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/players"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            選手データベースに戻る
          </Link>
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-4">{params.year}年のデータが見つかりません</h1>
            <p className="text-slate-300 mb-6">この年度のチーム所属データが存在しないか、読み込みに失敗しました。</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredTeams = data.teams.filter((team) => {
    if (showActiveOnly && team.active_players === 0) return false;
    return true;
  });

  // 主力選手を特定する関数
  const getStarPlayers = (team: TeamData) => {
    // 現役選手を優先、かつポジション別にバランスを取る
    const activePlayers = team.players.filter(p => p.is_active);
    const allPlayers = activePlayers.length >= 3 ? activePlayers : team.players;
    
    // 投手と野手を分ける
    const pitchers = allPlayers.filter(p => p.primary_pos === "P").slice(0, 2);
    const batters = allPlayers.filter(p => p.primary_pos === "B").slice(0, 3);
    
    return [...pitchers, ...batters].slice(0, 4); // 最大4人
  };

  const getFilteredPlayers = (players: TeamPlayer[]) => {
    return players.filter((player) => {
      if (showActiveOnly && !player.is_active) return false;
      if (positionFilter !== "ALL" && player.primary_pos !== positionFilter) return false;
      return true;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/players"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            選手データベース
          </Link>
          
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Calendar className="w-8 h-8 text-blue-400" />
            {params.year}年 チーム別選手
          </h1>
          <p className="text-slate-300">
            {data.total_teams}チーム・{data.total_players}人の選手データ
          </p>
        </div>

        {/* Year Navigation */}
        {yearsData && (
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">年度を選択</span>
              <span className="text-xs text-slate-400">
                ({yearsData.year_range.earliest}-{yearsData.year_range.latest})
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {yearsData.recent_years.map((yearInfo) => (
                <Link
                  key={yearInfo.year}
                  href={`/teams/${yearInfo.year}`}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    parseInt(params.year) === yearInfo.year
                      ? "bg-blue-600 text-white"
                      : "bg-black/20 text-slate-300 hover:bg-black/30 hover:text-white"
                  }`}
                >
                  {yearInfo.year}
                  <span className="ml-1 text-xs text-slate-400">
                    ({yearInfo.team_count}球団)
                  </span>
                </Link>
              ))}
              
              {yearsData.all_years.length > yearsData.recent_years.length && (
                <details className="relative">
                  <summary className="px-3 py-1 text-sm rounded-lg bg-black/20 text-slate-300 hover:bg-black/30 cursor-pointer">
                    他の年度...
                  </summary>
                  <div className="absolute top-8 left-0 z-10 bg-slate-800 border border-white/20 rounded-lg p-2 min-w-48 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-3 gap-1">
                      {yearsData.all_years
                        .filter(y => !yearsData.recent_years.some(r => r.year === y.year))
                        .map((yearInfo) => (
                        <Link
                          key={yearInfo.year}
                          href={`/teams/${yearInfo.year}`}
                          className="px-2 py-1 text-xs rounded text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          {yearInfo.year}
                        </Link>
                      ))}
                    </div>
                  </div>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">フィルター:</span>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-white">現役選手のみ</span>
            </label>

            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value as "ALL" | "P" | "B")}
              className="px-3 py-1 bg-black/20 border border-white/20 rounded text-white text-sm"
            >
              <option value="ALL">すべてのポジション</option>
              <option value="P">投手</option>
              <option value="B">野手</option>
            </select>
          </div>
        </div>

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => {
            const filteredPlayers = getFilteredPlayers(team.players);
            const displayPlayers = filteredPlayers.slice(0, 3);
            
            return (
              <div
                key={team.team}
                className="bg-black/20 backdrop-blur-md border border-white/10 hover:border-blue-400/50 rounded-lg p-6 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{team.team}</h3>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{filteredPlayers.length}名</span>
                  </div>
                </div>

                {/* Team Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                  <div className="text-center">
                    <div className="text-red-400 font-medium">{team.pitchers}</div>
                    <div className="text-slate-400">投手</div>
                  </div>
                  <div className="text-center">
                    <div className="text-blue-400 font-medium">{team.fielders}</div>
                    <div className="text-slate-400">野手</div>
                  </div>
                  <div className="text-center">
                    <div className="text-green-400 font-medium">{team.active_players}</div>
                    <div className="text-slate-400">現役</div>
                  </div>
                </div>

                {/* Star Players */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <h4 className="text-sm font-medium text-slate-300">主力選手</h4>
                  </div>
                  <div className="space-y-1">
                    {getStarPlayers(team).map((player) => (
                      <div key={player.player_id} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`w-2 h-2 rounded-full ${
                            player.primary_pos === "P" ? "bg-red-400" : "bg-blue-400"
                          }`} />
                          <Link
                            href={`/players/${player.player_id}`}
                            className="text-sm text-blue-400 hover:text-blue-300 underline truncate font-medium"
                          >
                            {player.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1">
                          {player.is_active && (
                            <span className={`text-xs ${
                              player.active_confidence === "確定" ? "text-green-400" : "text-yellow-400"
                            }`}>●</span>
                          )}
                          {!player.is_active && player.active_confidence === "確定" && (
                            <span className="text-xs text-gray-400">●</span>
                          )}
                          <span className={`text-xs px-1 py-0.5 rounded ${
                            player.primary_pos === "P" 
                              ? "bg-red-100 text-red-800" 
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {player.primary_pos === "P" ? "投" : "野"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Other Players Preview */}
                {filteredPlayers.length > getStarPlayers(team).length && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">その他の選手</h4>
                    <ul className="space-y-1">
                      {filteredPlayers
                        .filter(p => !getStarPlayers(team).some(star => star.player_id === p.player_id))
                        .slice(0, 3)
                        .map((player) => (
                        <li key={player.player_id} className="flex items-center gap-2">
                          <span className={`w-1 h-1 rounded-full ${
                            player.primary_pos === "P" ? "bg-red-400" : "bg-blue-400"
                          }`} />
                          <Link
                            href={`/players/${player.player_id}`}
                            className="text-sm text-blue-400 hover:text-blue-300 underline truncate"
                          >
                            {player.name}
                          </Link>
                          {player.is_active && (
                            <span className={`text-xs ${
                              player.active_confidence === "確定" ? "text-green-400" : "text-yellow-400"
                            }`}>●</span>
                          )}
                          {!player.is_active && player.active_confidence === "確定" && (
                            <span className="text-xs text-gray-400">●</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Show All Button */}
                {filteredPlayers.length > 3 && (
                  <button
                    onClick={() => setSelectedTeam(selectedTeam === team.team ? null : team.team)}
                    className="w-full text-xs text-slate-400 hover:text-white border border-white/20 rounded py-2 hover:bg-white/5 transition-colors"
                  >
                    {selectedTeam === team.team ? "折りたたむ" : `他${filteredPlayers.length - 3}名を表示`}
                  </button>
                )}

                {/* All Players (Expandable) */}
                {selectedTeam === team.team && filteredPlayers.length > 3 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                      {filteredPlayers.slice(3).map((player) => (
                        <div key={player.player_id} className="flex items-center gap-2 py-1">
                          <span className={`w-1 h-1 rounded-full ${
                            player.primary_pos === "P" ? "bg-red-400" : "bg-blue-400"
                          }`} />
                          <Link
                            href={`/players/${player.player_id}`}
                            className="text-xs text-blue-400 hover:text-blue-300 underline truncate"
                          >
                            {player.name}
                          </Link>
                          {player.is_active && (
                            <span className={`text-xs ${
                              player.active_confidence === "確定" ? "text-green-400" : "text-yellow-400"
                            }`}>●</span>
                          )}
                          {!player.is_active && player.active_confidence === "確定" && (
                            <span className="text-xs text-gray-400">●</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-8 text-center text-sm text-slate-400">
          表示中: {filteredTeams.length}チーム・
          {filteredTeams.reduce((sum, team) => sum + getFilteredPlayers(team.players).length, 0)}人
          {showActiveOnly && " (現役のみ)"}
        </div>
      </div>
    </div>
  );
}