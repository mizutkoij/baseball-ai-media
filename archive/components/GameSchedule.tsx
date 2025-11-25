'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Calendar, Clock, MapPin, Users, Trophy, Target, Filter, Zap } from 'lucide-react';

interface GameInfo {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  venue: string;
  status: 'finished' | 'scheduled' | 'live';
  time?: string;
  endTime?: string;
  gameTime?: string;
  attendance?: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeTeamInfo: {
    code: string;
    shortName: string;
    fullName: string;
    league: string;
    primaryColor: string;
  };
  awayTeamInfo: {
    code: string;
    shortName: string;
    fullName: string;
    league: string;
    primaryColor: string;
  };
  league: string;
  inningScores?: {
    away: number[];
    home: number[];
  };
}

interface GameScheduleResponse {
  games: GameInfo[];
  summary: {
    total_games: number;
    by_status: {
      finished: number;
      scheduled: number;
      live: number;
    };
    by_league: {
      central: number;
      pacific: number;
      interleague: number;
    };
    date_range: {
      earliest: string | null;
      latest: string | null;
    };
  };
  filters: any;
  source: string;
  last_updated: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const getStatusColor = (status: string) => {
  switch (status) {
    case 'finished': return 'bg-green-100 text-green-800 border-green-300';
    case 'live': return 'bg-red-100 text-red-800 border-red-300';
    case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'finished': return '終了';
    case 'live': return 'LIVE';
    case 'scheduled': return '予定';
    default: return status;
  }
};

const getTeamColorClasses = (teamColor: string) => {
  const colorMap: Record<string, string> = {
    '#FF6600': 'bg-orange-50 border-orange-300',
    '#FFE500': 'bg-yellow-50 border-yellow-300',
    '#DC143C': 'bg-red-50 border-red-300',
    '#006BB0': 'bg-blue-50 border-blue-300',
    '#3A5FCD': 'bg-indigo-50 border-indigo-300',
    '#003DA5': 'bg-blue-50 border-blue-400',
    '#FFD700': 'bg-yellow-50 border-yellow-400',
    '#00008B': 'bg-blue-50 border-blue-500',
    '#8B0000': 'bg-red-50 border-red-400',
    '#000080': 'bg-blue-50 border-blue-600',
    '#87CEEB': 'bg-sky-50 border-sky-300',
  };
  
  return colorMap[teamColor] || 'bg-gray-50 border-gray-300';
};

export default function GameSchedule({
  date,
  league,
  status = null,
  limit = 20
}: {
  date?: string;
  league?: 'central' | 'pacific';
  status?: 'finished' | 'scheduled' | 'live' | null;
  limit?: number;
}) {
  const [selectedLeague, setSelectedLeague] = useState<string>(league || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>(status || 'all');
  
  // Build API URL with filters
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (selectedLeague !== 'all') params.append('league', selectedLeague);
  if (selectedStatus !== 'all') params.append('status', selectedStatus);
  params.append('limit', limit.toString());
  
  const apiUrl = `/api/games?${params.toString()}`;
  
  const { data, error, isLoading } = useSWR<GameScheduleResponse>(apiUrl, fetcher, {
    refreshInterval: 30000, // 30秒ごとに更新
    revalidateOnFocus: true,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded animate-pulse"></div>
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
          試合情報の読み込みに失敗しました
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
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-blue-600">{data.summary.total_games}</div>
          <div className="text-sm text-gray-600">総試合数</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-green-600">{data.summary.by_status.finished}</div>
          <div className="text-sm text-gray-600">終了</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-red-600">{data.summary.by_status.live}</div>
          <div className="text-sm text-gray-600">進行中</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-2xl font-bold text-purple-600">{data.summary.by_status.scheduled}</div>
          <div className="text-sm text-gray-600">予定</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">フィルター:</span>
          </div>
          
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">全リーグ</option>
            <option value="central">セ・リーグ</option>
            <option value="pacific">パ・リーグ</option>
          </select>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">全状況</option>
            <option value="finished">終了</option>
            <option value="live">進行中</option>
            <option value="scheduled">予定</option>
          </select>
        </div>
      </div>

      {/* Games List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            NPB試合情報
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {data.summary.total_games}試合表示 • データソース: {data.source === 'npb_scraped_data' ? 'NPBスクレイピングデータ' : 'フォールバック'}
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {data.games.map((game, index) => (
            <div
              key={game.gameId || `${game.date}-${game.homeTeam}-${game.awayTeam}-${index}`}
              className={`p-6 hover:bg-gray-50 transition-colors ${getTeamColorClasses(game.homeTeamInfo?.primaryColor || '#888888')}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold text-gray-900">
                    {new Date(game.date).toLocaleDateString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short'
                    })}
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(game.status)}`}>
                    {game.status === 'live' && <Zap className="w-3 h-3 mr-1" />}
                    {getStatusText(game.status)}
                  </span>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: game.homeTeamInfo?.primaryColor || '#888888' }}
                    />
                    {game.homeTeamInfo?.league === 'central' ? 'セ' : 'パ'}リーグ
                  </div>
                </div>
                
                {game.time && (
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {game.time}
                  </div>
                )}
              </div>

              {/* Teams and Score */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  {/* Away Team */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full border-2"
                        style={{ 
                          backgroundColor: game.awayTeamInfo?.primaryColor || '#888888',
                          borderColor: game.awayTeamInfo?.primaryColor || '#888888'
                        }}
                      />
                      <span className="font-medium">{game.awayTeamInfo?.shortName || game.awayTeam}</span>
                      <span className="text-xs text-gray-500">({game.awayTeamInfo?.league === 'central' ? 'セ' : 'パ'})</span>
                    </div>
                    {game.status === 'finished' && (
                      <div className="text-2xl font-bold text-gray-900">{game.awayScore}</div>
                    )}
                  </div>
                  
                  {/* Home Team */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full border-2"
                        style={{ 
                          backgroundColor: game.homeTeamInfo?.primaryColor || '#888888',
                          borderColor: game.homeTeamInfo?.primaryColor || '#888888'
                        }}
                      />
                      <span className="font-medium">{game.homeTeamInfo?.shortName || game.homeTeam}</span>
                      <span className="text-xs text-gray-500">({game.homeTeamInfo?.league === 'central' ? 'セ' : 'パ'})</span>
                    </div>
                    {game.status === 'finished' && (
                      <div className="text-2xl font-bold text-gray-900">{game.homeScore}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Game Details */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {game.venue}
                </div>
                {game.attendance && (
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {game.attendance}
                  </div>
                )}
                {game.gameTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {game.gameTime}
                  </div>
                )}
              </div>

              {/* Inning Scores for finished games */}
              {game.status === 'finished' && game.inningScores && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-700 mb-2">イニング別スコア</div>
                  <div className="grid grid-cols-11 gap-1 text-xs">
                    <div></div>
                    {[1,2,3,4,5,6,7,8,9].map(inning => (
                      <div key={inning} className="text-center font-medium text-gray-600">{inning}</div>
                    ))}
                    <div className="text-center font-medium text-gray-600">R</div>
                    
                    <div className="font-medium text-gray-700">ビ</div>
                    {game.inningScores.away.map((score, i) => (
                      <div key={i} className="text-center">{score}</div>
                    ))}
                    <div className="text-center font-bold">{game.awayScore}</div>
                    
                    <div className="font-medium text-gray-700">ホ</div>
                    {game.inningScores.home.map((score, i) => (
                      <div key={i} className="text-center">{score}</div>
                    ))}
                    <div className="text-center font-bold">{game.homeScore}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
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
            <div className="flex items-center gap-4">
              <span>表示: {data.games.length}試合</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {data.source === 'npb_scraped_data' ? 'NPBデータ' : 'フォールバック'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}