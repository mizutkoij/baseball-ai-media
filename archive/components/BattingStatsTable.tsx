'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, TrendingDown, Trophy, Target, ArrowUpDown, Star, Award } from 'lucide-react';

interface EnhancedBattingStats {
  player_id: string;
  name: string;
  team_code: string;
  team_name: string;
  team_full_name: string;
  team_short_name: string;
  team_league: string;
  team_color: string;
  position: string;
  year: number;
  games: number;
  plate_appearances: number;
  at_bats: number;
  hits: number;
  runs: number;
  rbis: number;
  doubles: number;
  triples: number;
  home_runs: number;
  total_bases: number;
  walks: number;
  strikeouts: number;
  stolen_bases: number;
  batting_average: number;
  on_base_percentage: number;
  slugging_percentage: number;
  ops: number;
  woba?: number;
  wrc_plus?: number;
  babip?: number;
  iso?: number;
  data_quality_score: number;
  singles: number;
  extra_base_hits: number;
  contact_rate: number;
  power_rating: number;
  last_updated: string;
  source: string;
}

interface EnhancedBattingStatsResponse {
  year: number;
  league: string | null;
  team: string | null;
  sort_by: string;
  sort_order: string;
  limit: number;
  players: EnhancedBattingStats[];
  summary: {
    total_players: number;
    total_qualified_players: number;
    league_averages: {
      batting_average: number;
      home_runs: number;
      rbis: number;
      ops: number;
      woba?: number;
    };
    leaders: {
      batting_average: number;
      home_runs: number;
      rbis: number;
      ops: number;
    };
    data_quality: {
      average_score: number;
      high_quality_count: number;
    };
  };
  last_updated: string;
  source: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Enhanced team colors using actual NPB team colors
const getTeamColorClasses = (teamColor: string) => {
  const colorMap: Record<string, string> = {
    '#FF6600': 'bg-orange-50 border-orange-300 text-orange-800',
    '#FFE500': 'bg-yellow-50 border-yellow-300 text-yellow-800',
    '#DC143C': 'bg-red-50 border-red-300 text-red-800',
    '#006BB0': 'bg-blue-50 border-blue-300 text-blue-800',
    '#3A5FCD': 'bg-indigo-50 border-indigo-300 text-indigo-800',
    '#003DA5': 'bg-blue-50 border-blue-400 text-blue-800',
    '#FFD700': 'bg-yellow-50 border-yellow-400 text-yellow-800',
    '#00008B': 'bg-blue-50 border-blue-500 text-blue-800',
    '#8B0000': 'bg-red-50 border-red-400 text-red-800',
    '#000080': 'bg-blue-50 border-blue-600 text-blue-800',
    '#87CEEB': 'bg-sky-50 border-sky-300 text-sky-800',
  };
  
  return colorMap[teamColor] || 'bg-gray-50 border-gray-300 text-gray-800';
};

// Quality score badge component
const QualityBadge = ({ score }: { score: number }) => {
  const getQualityColor = () => {
    if (score >= 95) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (score >= 90) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 80) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getQualityColor()}`}>
      <Star className="w-3 h-3 mr-1" />
      {score}%
    </span>
  );
};

export default function BattingStatsTable({ 
  league,
  limit = 50,
  year = 2024 
}: { 
  league?: 'central' | 'pacific' | null;
  limit?: number;
  year?: number;
}) {
  const [sortBy, setSortBy] = useState('batting_average');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const apiUrl = `/api/stats/batting?year=${year}&limit=${limit}&sort=${sortBy}&order=${sortOrder}${league ? `&league=${league}` : ''}&min_games=20`;
  
  const { data, error, isLoading } = useSWR<EnhancedBattingStatsResponse>(apiUrl, fetcher, {
    refreshInterval: 300000, // 5分ごとに更新
    revalidateOnFocus: true,
    dedupingInterval: 60000,
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder(['batting_average', 'ops', 'woba', 'data_quality_score'].includes(column) ? 'desc' : 'desc');
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
        <div className="text-red-600 mb-2">
          {data?.source === 'fallback_mock' ? 
            '高品質データが利用できません（フォールバックデータを表示）' : 
            '打者成績の読み込みに失敗しました'
          }
        </div>
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
      {/* Enhanced Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <div className="text-2xl font-bold text-orange-600">{data.summary.league_averages.ops.toFixed(3)}</div>
          <div className="text-sm text-gray-600">平均OPS</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-emerald-600">{data.summary.data_quality.average_score.toFixed(1)}%</div>
          <div className="text-sm text-gray-600">データ品質</div>
        </div>
      </div>

      {/* Toggle Advanced View */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Target className="w-4 h-4" />
          {showAdvanced ? '基本表示' : '詳細表示'}
        </button>
        
        {data.source === 'enhanced_npb_scraper' && (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <Award className="w-4 h-4" />
            高品質データ使用中
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            打者成績ランキング ({year}年)
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {league ? (league === 'central' ? 'セントラル・リーグ' : 'パシフィック・リーグ') : '両リーグ'} • 
            {data.players.length}選手表示 • 品質スコア平均: {data.summary.data_quality.average_score.toFixed(1)}%
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
                {showAdvanced && (
                  <>
                    <th 
                      className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('woba')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        wOBA {getSortIcon('woba')}
                      </div>
                    </th>
                    <th 
                      className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('babip')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        BABIP {getSortIcon('babip')}
                      </div>
                    </th>
                  </>
                )}
                <th 
                  className="text-center py-3 px-2 font-semibold cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('data_quality_score')}
                >
                  <div className="flex items-center justify-center gap-1">
                    品質 {getSortIcon('data_quality_score')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.players.map((player, index) => (
                <tr 
                  key={player.player_id}
                  className={`hover:bg-gray-50 transition-colors ${
                    index < 3 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100' : 
                    getTeamColorClasses(player.team_color)
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
                    <div className="text-xs text-gray-500">{player.team_full_name}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2 border-2"
                        style={{ backgroundColor: player.team_color, borderColor: player.team_color }}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{player.team_short_name}</div>
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
                  {showAdvanced && (
                    <>
                      <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-semibold text-indigo-600">
                        {player.woba ? player.woba.toFixed(3) : '-'}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-semibold text-cyan-600">
                        {player.babip ? player.babip.toFixed(3) : '-'}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-4 whitespace-nowrap text-center">
                    <QualityBadge score={player.data_quality_score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>最終更新: {new Date(data.last_updated).toLocaleString('ja-JP', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {data.source === 'enhanced_npb_scraper' ? '高品質データ' : 'フォールバックデータ'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>表示: {data.players.length}選手</span>
              <span>高品質データ: {data.summary.data_quality.high_quality_count}選手</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}