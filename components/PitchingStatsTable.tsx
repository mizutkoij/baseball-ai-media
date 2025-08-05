'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, TrendingDown, Trophy, Target, ArrowUpDown, Zap } from 'lucide-react';

interface PitchingStats {
  player_id: string;
  name: string;
  team: string;
  year: number;
  games: number;
  wins: number;
  losses: number;
  saves: number;
  era: number;
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  walks: number;
  strikeouts: number;
  home_runs_allowed: number;
  whip: number;
  team_name: string;
  team_league: string;
}

interface PitchingStatsResponse {
  year: number;
  league: string | null;
  team: string | null;
  sort_by: string;
  sort_order: string;
  limit: number;
  players: PitchingStats[];
  summary: {
    total_players: number;
    league_averages: {
      era: number;
      wins: number;
      strikeouts: number;
      saves: number;
    };
    leaders: {
      era: number;
      wins: number;
      strikeouts: number;
      saves: number;
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

export default function PitchingStatsTable({ 
  league,
  limit = 50 
}: { 
  league?: 'central' | 'pacific' | null;
  limit?: number;
}) {
  const [sortBy, setSortBy] = useState('era');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const apiUrl = `/api/stats/pitching?year=2025&limit=${limit}&sort=${sortBy}&order=${sortOrder}${league ? `&league=${league}` : ''}`;
  
  const { data, error, isLoading } = useSWR<PitchingStatsResponse>(apiUrl, fetcher, {
    refreshInterval: 300000, // 5分ごとに更新
    revalidateOnFocus: true,
    dedupingInterval: 60000,
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      // ERA, WHIPは昇順が良い、その他は降順
      setSortOrder(column === 'era' || column === 'whip' ? 'asc' : 'desc');
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
        <div className="text-red-600 mb-2">投手成績の読み込みに失敗しました</div>
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
          <div className="text-sm text-gray-600">総投手数</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-green-600">{data.summary.league_averages.era.toFixed(2)}</div>
          <div className="text-sm text-gray-600">平均防御率</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-purple-600">{data.summary.league_averages.strikeouts.toFixed(1)}</div>
          <div className="text-sm text-gray-600">平均奪三振</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-orange-600">{data.summary.league_averages.wins.toFixed(1)}</div>
          <div className="text-sm text-gray-600">平均勝利数</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6" />
            投手成績ランキング
          </h2>
          <p className="text-purple-100 text-sm mt-1">
            {league ? (league === 'central' ? 'セントラル・リーグ' : 'パシフィック・リーグ') : '両リーグ'} • {data.players.length}投手表示
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-xs text-gray-600">
                <th className="text-left py-3 px-4 font-semibold">順位</th>
                <th className="text-left py-3 px-4 font-semibold">選手名</th>
                <th className="text-left py-3 px-4 font-semibold">チーム</th>
                <th className="text-center py-3 px-2 font-semibold">試合</th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('era')}
                >
                  <div className="flex items-center justify-center gap-1">
                    防御率 {getSortIcon('era')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('wins')}
                >
                  <div className="flex items-center justify-center gap-1">
                    勝利 {getSortIcon('wins')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('losses')}
                >
                  <div className="flex items-center justify-center gap-1">
                    敗戦 {getSortIcon('losses')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('saves')}
                >
                  <div className="flex items-center justify-center gap-1">
                    セーブ {getSortIcon('saves')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('innings_pitched')}
                >
                  <div className="flex items-center justify-center gap-1">
                    投球回 {getSortIcon('innings_pitched')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('strikeouts')}
                >
                  <div className="flex items-center justify-center gap-1">
                    奪三振 {getSortIcon('strikeouts')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('whip')}
                >
                  <div className="flex items-center justify-center gap-1">
                    WHIP {getSortIcon('whip')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.players.map((player, index) => (
                <tr 
                  key={player.player_id}
                  className={`hover:bg-gray-50 transition-colors ${
                    index < 3 ? 'bg-gradient-to-r from-purple-50 to-purple-100' : 
                    index < 10 ? TEAM_COLORS[player.team] || 'bg-white' : 'bg-white'
                  }`}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                        index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500' :
                        index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                        index < 10 ? 'bg-gradient-to-r from-purple-400 to-purple-600' :
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
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                    {player.games}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-bold text-red-600">
                    {player.era.toFixed(2)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">
                    {player.wins}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-500">
                    {player.losses}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-semibold text-blue-600">
                    {player.saves}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {player.innings_pitched.toFixed(1)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-semibold text-purple-600">
                    {player.strikeouts}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-bold text-orange-600">
                    {player.whip.toFixed(2)}
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
              表示件数: {data.players.length}投手 / 総数: {data.summary.total_players}投手
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}