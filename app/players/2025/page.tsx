"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Search, Users, TrendingUp } from "lucide-react";

// This is the new structure we created, including the 'league' field.
type PlayerIndex2025 = {
  player_id: string;
  name: string;
  primary_pos: "P" | "B";
  is_active: boolean;
  league: "1-gun" | "farm" | "both";
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Players2025Page() {
  // Fetch data from our newly generated file
  const { data: players, isLoading } = useSWR<PlayerIndex2025[]>(
    "/data/players/players_2025_all.json",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
    }
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<"ALL" | "P" | "B">("ALL");
  // New filter for league
  const [leagueFilter, setLeagueFilter] = useState<"ALL" | "1-gun" | "farm" | "both">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 50;

  const filteredPlayers = useMemo(() => {
    if (!players) return [];

    return players.filter((player) => {
      const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPosition = positionFilter === "ALL" || player.primary_pos === positionFilter;
      const matchesLeague =
        leagueFilter === "ALL" ||
        player.league === leagueFilter ||
        (leagueFilter === "1-gun" && player.league === "both") ||
        (leagueFilter === "farm" && player.league === "both");

      return matchesSearch && matchesPosition && matchesLeague;
    });
  }, [players, searchTerm, positionFilter, leagueFilter]);

  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPlayers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPlayers, currentPage]);

  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-6 text-white text-center">
        Loading 2025 Player Data...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-400" />
            2025年 選手データベース
          </h1>
          <p className="text-slate-300">
            {players?.length.toLocaleString()}人の2025年シーズンの選手データを閲覧できます
          </p>
        </div>

        {/* Filters */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="選手名で検索..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <select
                value={positionFilter}
                onChange={(e) => { setPositionFilter(e.target.value as any); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">全ポジション</option>
                <option value="P">投手</option>
                <option value="B">野手</option>
              </select>
            </div>
            <div>
              <select
                value={leagueFilter}
                onChange={(e) => { setLeagueFilter(e.target.value as any); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">全リーグ</option>
                <option value="1-gun">1軍</option>
                <option value="farm">ファーム</option>
                <option value="both">両方</option>
              </select>
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-300">
            {filteredPlayers.length.toLocaleString()}人の選手が見つかりました
          </div>
        </div>

        {/* Player List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {paginatedPlayers.map((player) => (
            <div key={player.player_id} className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg text-white truncate">{player.name}</h3>
                <div className="flex gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-full ${player.primary_pos === 'P' ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>
                    {player.primary_pos === 'P' ? '投手' : '野手'}
                  </span>
                  <span className={`px-2 py-1 rounded-full ${
                    player.league === 'both' ? 'bg-green-200 text-green-800' : 
                    player.league === '1-gun' ? 'bg-sky-200 text-sky-800' : 
                    'bg-amber-200 text-amber-800'
                  }`}>
                    {player.league === 'both' ? '1軍/ファーム' : player.league === '1-gun' ? '1軍のみ' : 'ファームのみ'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-400">{player.player_id.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 text-white">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-white/20 bg-black/20 rounded disabled:opacity-50"
            >
              前へ
            </button>
            <span>{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm border border-white/20 bg-black/20 rounded disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
