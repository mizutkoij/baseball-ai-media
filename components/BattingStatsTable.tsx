'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, TrendingDown, Trophy, Target, ArrowUpDown } from 'lucide-react';

interface BattingStats {
  player_id: string;
  name: string;
  team: string;
  position: string;
  year: number;
  games: number;
  at_bats: number;
  hits: number;
  runs: number;
  rbis: number;
  doubles: number;
  triples: number;
  home_runs: number;
  walks: number;
  strikeouts: number;
  stolen_bases: number;
  batting_average: number;
  on_base_percentage: number;
  slugging_percentage: number;
  ops: number;
  team_name: string;
  team_league: string;
}

interface BattingStatsResponse {
  year: number;
  league: string | null;
  team: string | null;
  sort_by: string;
  sort_order: string;
  limit: number;
  players: BattingStats[];
  summary: {
    total_players: number;
    league_averages: {
      batting_average: number;
      home_runs: number;
      rbis: number;
    };
    leaders: {
      batting_average: number;
      home_runs: number;
      rbis: number;
    };
  };
  last_updated: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// チーム色定義
const TEAM_COLORS: Record<string, string> = {
  'YG': 'bg-orange-50 border-orange-200',
  'T': 'bg-yellow-50 border-yellow-200',
  'C': 'bg-red-50 border-red-200',
  'DB': 'bg-blue-50 border-blue-200',
  'D': 'bg-blue-50 border-blue-300',
  'S': 'bg-green-50 border-green-200',
  'H': 'bg-yellow-50 border-yellow-300',
  'L': 'bg-blue-50 border-blue-400',
  'E': 'bg-red-50 border-red-300',
  'M': 'bg-gray-50 border-gray-200',
  'F': 'bg-blue-50 border-blue-300',
  'B': 'bg-blue-50 border-blue-400'
};

export default function BattingStatsTable({ 
  league,
  limit = 50 
}: { 
  league?: 'central' | 'pacific' | null;
  limit?: number;
}) {
  const [sortBy, setSortBy] = useState('batting_average');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const apiUrl = `/api/stats/batting?year=2025&limit=${limit}&sort=${sortBy}&order=${sortOrder}${league ? `&league=${league}` : ''}`;
  
  const { data, error, isLoading } = useSWR<BattingStatsResponse>(apiUrl, fetcher, {
    refreshInterval: 300000, // 5分ごとに更新
    revalidateOnFocus: true,
    dedupingInterval: 60000,
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'batting_average' || column === 'ops' ? 'desc' : 'desc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortOrder === 'desc' ? 
      <TrendingDown className="w-3 h-3 text-blue-600" /> : 
      <TrendingUp className="w-3 h-3 text-blue-600" />;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <div className="text-red-600 mb-2">打者成績の読み込みに失敗しました</div>
        <button 
          onClick={() => window.location.reload()} 
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          再試行
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-blue-600">{data.summary.total_players}</div>
          <div className="text-sm text-gray-600">総選手数</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-green-600">{data.summary.league_averages.batting_average.toFixed(3)}</div>
          <div className="text-sm text-gray-600">平均打率</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-purple-600">{data.summary.league_averages.home_runs.toFixed(1)}</div>
          <div className="text-sm text-gray-600">平均本塁打</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-orange-600">{data.summary.league_averages.rbis.toFixed(1)}</div>
          <div className="text-sm text-gray-600">平均打点</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            打者成績ランキング
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {league ? (league === 'central' ? 'セントラル・リーグ' : 'パシフィック・リーグ') : '両リーグ'} • {data.players.length}選手表示
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-xs text-gray-600">
                <th className="text-left py-3 px-4 font-semibold">順位</th>
                <th className="text-left py-3 px-4 font-semibold">選手名</th>
                <th className="text-left py-3 px-4 font-semibold">チーム</th>
                <th className="text-center py-3 px-2 font-semibold">ポジション</th>
                <th className="text-center py-3 px-2 font-semibold">試合</th>
                <th className="text-center py-3 px-2 font-semibold">打席</th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('batting_average')}
                >
                  <div className="flex items-center justify-center gap-1">
                    打率 {getSortIcon('batting_average')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('hits')}
                >
                  <div className="flex items-center justify-center gap-1">
                    安打 {getSortIcon('hits')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('home_runs')}
                >
                  <div className="flex items-center justify-center gap-1">
                    本塁打 {getSortIcon('home_runs')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('rbis')}
                >
                  <div className="flex items-center justify-center gap-1">
                    打点 {getSortIcon('rbis')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('ops')}
                >
                  <div className="flex items-center justify-center gap-1">
                    OPS {getSortIcon('ops')}
                  </div>
                </th>
                <th className="text-center py-3 px-2 font-semibold">盗塁</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.players.map((player, index) => (
                <tr 
                  key={player.player_id}
                  className={`hover:bg-gray-50 transition-colors ${
                    index < 3 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100' : 
                    index < 10 ? TEAM_COLORS[player.team] || 'bg-white' : 'bg-white'
                  }`}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                        index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500' :
                        index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                        index < 10 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                        'bg-gray-400'
                      }`}>
                        {index + 1}
                      </span>
                      {index < 3 && <Trophy className="w-4 h-4 text-yellow-500 ml-2" />}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{player.name}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full border-2 mr-2 ${
                        TEAM_COLORS[player.team]?.replace('bg-', 'border-').replace('-50', '-300') || 'border-gray-300'
                      }`}></div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{player.team}</div>
                        <div className="text-xs text-gray-500">{player.team_league}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {player.position}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                    {player.games}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                    {player.at_bats}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900">
                    {player.batting_average.toFixed(3)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-semibold text-blue-600">
                    {player.hits}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-semibold text-purple-600">
                    {player.home_runs}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">
                    {player.rbis}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-bold text-orange-600">
                    {player.ops.toFixed(3)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                    {player.stolen_bases}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              最終更新: {new Date(data.last_updated).toLocaleString('ja-JP', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div>
              表示件数: {data.players.length}選手 / 総数: {data.summary.total_players}選手
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}