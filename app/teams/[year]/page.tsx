"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Users, TrendingUp, Calendar, Filter } from "lucide-react";

type TeamPlayer = {
  player_id: string;
  name: string;
  name_kana?: string;
  primary_pos: "P" | "B";
  is_active: boolean;
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

                {/* Top Players */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">主な選手</h4>
                  <ul className="space-y-1">
                    {displayPlayers.map((player) => (
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
                          <span className="text-xs text-green-400">●</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

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
                            <span className="text-xs text-green-400">●</span>
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