"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Search, Filter, Users, TrendingUp } from "lucide-react";

type PlayerIndex = {
  player_id: string;
  name: string;
  name_kana?: string;
  primary_pos: "P" | "B";
  first_year?: number;
  last_year?: number;
  is_active: boolean;
  url?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PlayersPage() {
  const { data: players, isLoading } = useSWR<PlayerIndex[]>(
    "/data/players/players_index.json",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5分間キャッシュ
    }
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<"ALL" | "P" | "B">("ALL");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "OB">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 50;

  const filteredPlayers = useMemo(() => {
    if (!players) return [];

    return players.filter((player) => {
      const matchesSearch = 
        player.name.includes(searchTerm) ||
        (player.name_kana?.includes(searchTerm)) ||
        false;

      const matchesPosition = 
        positionFilter === "ALL" || player.primary_pos === positionFilter;

      const matchesActive = 
        activeFilter === "ALL" ||
        (activeFilter === "ACTIVE" && player.is_active) ||
        (activeFilter === "OB" && !player.is_active);

      return matchesSearch && matchesPosition && matchesActive;
    });
  }, [players, searchTerm, positionFilter, activeFilter]);

  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPlayers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPlayers, currentPage]);

  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-600 rounded mb-6 w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-400" />
            選手データベース
          </h1>
          <p className="text-slate-300">
            NPB全選手 {players?.length.toLocaleString()}人の詳細データを検索・閲覧できます
          </p>
        </div>

        {/* 検索・フィルター */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 検索 */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="選手名またはよみがなで検索..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* ポジションフィルター */}
            <div>
              <select
                value={positionFilter}
                onChange={(e) => {
                  setPositionFilter(e.target.value as "ALL" | "P" | "B");
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">すべて</option>
                <option value="P">投手</option>
                <option value="B">野手</option>
              </select>
            </div>

            {/* 活動状況フィルター */}
            <div>
              <select
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value as "ALL" | "ACTIVE" | "OB");
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">すべて</option>
                <option value="ACTIVE">現役推定</option>
                <option value="OB">OB</option>
              </select>
            </div>
          </div>

          {/* 結果数 */}
          <div className="mt-4 text-sm text-slate-300">
            {filteredPlayers.length.toLocaleString()}人の選手が見つかりました
          </div>
        </div>

        {/* 選手一覧 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {paginatedPlayers.map((player) => (
            <Link
              key={player.player_id}
              href={`/players/${player.player_id}`}
              className="bg-black/20 backdrop-blur-md border border-white/10 hover:border-blue-400/50 rounded-lg p-4 transition-all duration-200 hover:bg-black/30"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg text-white truncate">
                  {player.name}
                </h3>
                <div className="flex gap-1">
                  <span
                    className={`px-2 py-1 text-xs rounded-full font-medium ${
                      player.primary_pos === "P"
                        ? "bg-red-100 text-red-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {player.primary_pos === "P" ? "投手" : "野手"}
                  </span>
                  {player.is_active && (
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                      現役推定
                    </span>
                  )}
                </div>
              </div>

              {player.name_kana && (
                <p className="text-sm text-slate-400 mb-2">{player.name_kana}</p>
              )}

              <div className="flex justify-between items-center text-sm text-slate-300">
                <span>
                  {player.first_year && player.last_year
                    ? `${player.first_year} - ${player.last_year}`
                    : player.first_year
                    ? `${player.first_year} -`
                    : "期間不明"}
                </span>
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
            </Link>
          ))}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-white/20 bg-black/20 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/30"
            >
              前へ
            </button>

            <span className="px-4 py-2 text-sm text-slate-300">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm border border-white/20 bg-black/20 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/30"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}