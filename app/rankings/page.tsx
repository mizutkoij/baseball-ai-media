"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Trophy, TrendingUp, Activity, BarChart3, Calendar, Filter } from "lucide-react";

type LeaderPlayer = {
  rank: number;
  player_id: string;
  name: string;
  team: string;
  value: number;
  games: number;
  pa?: number;
  ip?: number;
  avg?: number;
  ops?: number;
  era?: number;
  whip?: number;
  hr?: number;
  rbi?: number;
  wins?: number;
  k_pct?: number;
};

type LeaderboardData = {
  year: number;
  generated_at: string;
  batting: {
    ops_plus?: LeaderPlayer[];
    wrc_plus?: LeaderPlayer[];
  };
  pitching: {
    fip?: LeaderPlayer[];
    era_minus?: LeaderPlayer[];
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function RankingsPage() {
  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedCategory, setSelectedCategory] = useState<"batting" | "pitching">("batting");
  const [selectedStat, setSelectedStat] = useState<string>("ops_plus");

  const availableYears = [2025, 2024, 2023, 2022, 2021, 2020];

  const { data, isLoading, error } = useSWR<LeaderboardData>(
    `/data/players/leaders/${selectedYear}.json`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5分間キャッシュ
    }
  );

  const statOptions = {
    batting: {
      ops_plus: { name: "OPS+", desc: "パークファクター調整OPS（100=リーグ平均）", higherBetter: true },
      wrc_plus: { name: "wRC+", desc: "加重得点創出能力（100=リーグ平均）", higherBetter: true }
    },
    pitching: {
      fip: { name: "FIP", desc: "守備無関係防御率（低いほど良い）", higherBetter: false },
      era_minus: { name: "ERA-", desc: "パークファクター調整防御率（100=リーグ平均、低いほど良い）", higherBetter: false }
    }
  };

  const getCurrentLeaders = (): LeaderPlayer[] => {
    if (!data) return [];
    
    if (selectedCategory === "batting") {
      return data.batting[selectedStat as keyof typeof data.batting] || [];
    } else {
      return data.pitching[selectedStat as keyof typeof data.pitching] || [];
    }
  };

  const formatValue = (value: number, stat: string): string => {
    if (stat === "fip" || stat === "era" || stat === "whip") {
      return value.toFixed(2);
    } else if (stat === "avg" || stat === "ops") {
      return value.toFixed(3);
    } else if (stat === "k_pct") {
      return `${value.toFixed(1)}%`;
    }
    return value.toString();
  };

  const getRankColor = (rank: number): string => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-gray-300";
    if (rank === 3) return "text-amber-600";
    return "text-slate-300";
  };

  const getRankBadge = (rank: number): string => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `${rank}位`;
  };

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

  const currentLeaders = getCurrentLeaders();
  const currentStatInfo = statOptions[selectedCategory][selectedStat as keyof typeof statOptions[typeof selectedCategory]];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-400" />
            NPBランキング
          </h1>
          <p className="text-slate-300">
            セイバーメトリクス指標による年度別リーダーボード
          </p>
        </div>

        {/* Controls */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Year Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                年度
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded text-white"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                カテゴリ
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value as "batting" | "pitching");
                  setSelectedStat(e.target.value === "batting" ? "ops_plus" : "fip");
                }}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded text-white"
              >
                <option value="batting">打撃</option>
                <option value="pitching">投球</option>
              </select>
            </div>

            {/* Stat Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <BarChart3 className="w-4 h-4 inline mr-1" />
                指標
              </label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded text-white"
              >
                {Object.entries(statOptions[selectedCategory]).map(([key, info]) => (
                  <option key={key} value={key}>{info.name}</option>
                ))}
              </select>
            </div>

            {/* Source Badge */}
            <div className="flex items-end">
              <span className="px-3 py-2 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                📊 STATIC
              </span>
            </div>
          </div>

          {/* Current Stat Description */}
          {currentStatInfo && (
            <div className="mt-4 p-4 bg-black/20 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-2">{currentStatInfo.name}</h3>
              <p className="text-sm text-slate-300">{currentStatInfo.desc}</p>
            </div>
          )}
        </div>

        {/* Leaders Table */}
        {error || !data ? (
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-4">データが見つかりません</h2>
            <p className="text-slate-300">選択された年度のランキングデータが存在しません。</p>
          </div>
        ) : (
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-white/20">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                {selectedCategory === "batting" ? 
                  <TrendingUp className="w-5 h-5 text-blue-400" /> : 
                  <Activity className="w-5 h-5 text-red-400" />
                }
                {selectedYear}年 {currentStatInfo?.name} ランキング
                <span className="text-sm text-slate-400">
                  （上位{currentLeaders.length}位）
                </span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white">順位</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white">選手名</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white">チーム</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-white">{currentStatInfo?.name}</th>
                    {selectedCategory === "batting" ? (
                      <>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">試合</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">打率</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">OPS</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">HR</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">打点</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">登板</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">防御率</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">WHIP</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">K%</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-white">勝利</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {currentLeaders.map((player, index) => (
                    <tr
                      key={player.player_id}
                      className={`border-b border-white/10 hover:bg-black/20 ${
                        index % 2 === 0 ? 'bg-black/5' : 'bg-black/10'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={`font-bold ${getRankColor(player.rank)}`}>
                          {getRankBadge(player.rank)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/players/${player.player_id}`}
                          className="text-blue-400 hover:text-blue-300 underline font-medium"
                        >
                          {player.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{player.team}</td>
                      <td className="px-4 py-3 text-right font-bold text-white">
                        {formatValue(player.value, selectedStat)}
                      </td>
                      {selectedCategory === "batting" ? (
                        <>
                          <td className="px-4 py-3 text-right text-slate-300">{player.games}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatValue(player.avg || 0, "avg")}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatValue(player.ops || 0, "ops")}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{player.hr || 0}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{player.rbi || 0}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right text-slate-300">{player.games}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatValue(player.era || 0, "era")}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatValue(player.whip || 0, "whip")}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatValue(player.k_pct || 0, "k_pct")}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{player.wins || 0}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-6 text-xs text-slate-400 text-center">
          <p>
            最小規定: 打撃50打席以上・投球20回以上 | 
            データ更新: {data?.generated_at ? new Date(data.generated_at).toLocaleDateString('ja-JP') : '---'} |
            静的プリコンピュート方式
          </p>
        </div>
      </div>
    </div>
  );
}