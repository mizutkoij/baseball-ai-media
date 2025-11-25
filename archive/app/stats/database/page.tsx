'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, User, Trophy, TrendingUp } from 'lucide-react';

interface Player {
  player_id: number;
  league: string;
  full_name: string;
  native_name?: string;
  primary_position: string;
  current_team: string;
  team_level: string;
  age: number;
  nationality: string;
  height_cm: number;
  weight_kg: number;
  bats: string;
  throws: string;
  birth_city: string;
  birth_country: string;
  current_salary: number;
  scouting_grade: number;
  prospect_ranking?: number;
  career_status: string;
}

interface PlayerStats {
  total_players: number;
  leagues: number;
  countries: number;
  avg_age: number;
  avg_grade: number;
}

interface ApiResponse {
  players: Player[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: PlayerStats;
}

export default function DatabasePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  
  // フィルター・検索状態
  const [filters, setFilters] = useState({
    league: '',
    position: '',
    search: ''
  });

  const fetchPlayers = async (page = 1) => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.league && { league: filters.league }),
        ...(filters.position && { position: filters.position }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`/api/comprehensive-players?${searchParams}`);
      const data: ApiResponse = await response.json();
      
      setPlayers(data.players);
      setPagination(data.pagination);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers(1);
  }, [filters]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatSalary = (salary: number) => {
    if (salary >= 1000000) {
      return `$${(salary / 1000000).toFixed(1)}M`;
    } else if (salary >= 1000) {
      return `$${(salary / 1000).toFixed(0)}K`;
    }
    return `$${salary.toLocaleString()}`;
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 70) return 'text-red-600 bg-red-50';
    if (grade >= 60) return 'text-orange-600 bg-orange-50';
    if (grade >= 50) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            包括的野球データベース
          </h1>
          <p className="text-gray-600">
            MLB・NPB・KBO 全2,480選手の詳細データベース
          </p>
        </div>

        {/* 統計サマリー */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center">
                <User className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">総選手数</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.total_players.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center">
                <Trophy className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">リーグ数</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.leagues}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">国籍数</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.countries}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">平均年齢</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.avg_age.toFixed(1)}歳
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">平均評価</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.avg_grade.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 検索・フィルター */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                検索
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="選手名で検索..."
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                リーグ
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.league}
                onChange={(e) => handleFilterChange('league', e.target.value)}
              >
                <option value="">全リーグ</option>
                <option value="MLB">MLB</option>
                <option value="NPB">NPB</option>
                <option value="KBO">KBO</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ポジション
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.position}
                onChange={(e) => handleFilterChange('position', e.target.value)}
              >
                <option value="">全ポジション</option>
                <option value="P">投手</option>
                <option value="C">捕手</option>
                <option value="1B">一塁手</option>
                <option value="2B">二塁手</option>
                <option value="3B">三塁手</option>
                <option value="SS">遊撃手</option>
                <option value="OF">外野手</option>
                <option value="DH">指名打者</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ league: '', position: '', search: '' })}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                リセット
              </button>
            </div>
          </div>
        </div>

        {/* 選手リスト */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">読み込み中...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        選手名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        リーグ・チーム
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ポジション
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        身体情報
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        出身
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        年俸
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        評価
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {players.map((player) => (
                      <tr key={player.player_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {player.full_name}
                            </div>
                            {player.native_name && (
                              <div className="text-sm text-gray-500">
                                {player.native_name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {player.league} - {player.current_team}
                          </div>
                          <div className="text-sm text-gray-500">
                            {player.team_level}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {player.primary_position}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>{player.age}歳</div>
                          <div className="text-gray-500">
                            {player.height_cm}cm / {player.weight_kg}kg
                          </div>
                          <div className="text-gray-500">
                            {player.bats}/{player.throws}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>{player.birth_city}</div>
                          <div className="text-gray-500">{player.birth_country}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatSalary(player.current_salary)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGradeColor(player.scouting_grade)}`}>
                            {player.scouting_grade.toFixed(1)}
                          </span>
                          {player.prospect_ranking && (
                            <div className="text-xs text-gray-500 mt-1">
                              Rank #{player.prospect_ranking}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ページネーション */}
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => fetchPlayers(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    前へ
                  </button>
                  <button
                    onClick={() => fetchPlayers(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    次へ
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span>
                      {' - '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>
                      {' / '}
                      <span className="font-medium">{pagination.total}</span>
                      {' 件'}
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => fetchPlayers(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        前へ
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        {pagination.page} / {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => fetchPlayers(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        次へ
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}