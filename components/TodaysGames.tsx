'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Trophy, Zap, ChevronRight, RefreshCw, Sprout, Activity } from 'lucide-react';
import Link from 'next/link';

interface TodaysGameInfo {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  venue: string;
  status: 'finished' | 'scheduled' | 'live';
  time?: string;
  level?: 'NPB1' | 'NPB2';
  homeTeamInfo: {
    shortName: string;
    primaryColor: string;
    league: string;
  };
  awayTeamInfo: {
    shortName: string;
    primaryColor: string;
    league: string;
  };
}

export default function TodaysGames() {
  const [mounted, setMounted] = useState(false);
  const [games, setGames] = useState<TodaysGameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const isNPB2Mode = false; // Static for now

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      // Small delay to ensure proper hydration
      const timer = setTimeout(() => {
        fetchTodaysGames();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mounted]);

  const fetchTodaysGames = async () => {
    try {
      setLoading(true);
      setIsRunning(true);
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/games/by-date/${today}`);
      const data = await response.json();
      
      if (data.games && data.games.length > 0) {
        const transformedGames: TodaysGameInfo[] = data.games.map((game: any) => ({
          gameId: game.game_id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          homeScore: game.home_score,
          awayScore: game.away_score,
          venue: game.venue || '未定',
          status: game.status || 'scheduled',
          time: game.start_time_jst || '18:00',
          level: 'NPB1',
          homeTeamInfo: {
            shortName: game.home_team.slice(0, 2),
            primaryColor: getTeamColor(game.home_team),
            league: 'central'
          },
          awayTeamInfo: {
            shortName: game.away_team.slice(0, 2),
            primaryColor: getTeamColor(game.away_team),
            league: 'central'
          }
        }));
        setGames(transformedGames);
        setError(false);
      } else {
        setGames([]);
        setError(false);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching games:', err);
      setError(true);
      setGames([]);
    } finally {
      setLoading(false);
      setIsRunning(false);
    }
  };

  const refreshGames = () => {
    if (!loading) {
      fetchTodaysGames();
    }
  };

  // Team color mapping
  const getTeamColor = (teamName: string): string => {
    const colorMap: { [key: string]: string } = {
      '巨人': '#FF6600',
      'ヤクルト': '#00A0E9',
      '阪神': '#FFED00',
      '広島': '#DC143C',
      '中日': '#0066CC',
      'DeNA': '#1E90FF',
      'ソフトバンク': '#F4D03F',
      '日本ハム': '#87CEEB',
      '西武': '#0066CC',
      'ロッテ': '#000080',
      'オリックス': '#5D4037',
      '楽天': '#8B0000'
    };
    return colorMap[teamName] || '#888888';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finished': return 'text-green-600';
      case 'live': return 'text-red-600';
      case 'scheduled': return 'text-blue-600';
      default: return 'text-gray-600';
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

  // Early return for non-mounted state to prevent hydration issues
  if (!mounted) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-white">今日の試合</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-16 bg-white/10 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-white">今日の試合</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/10 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-white">今日の試合</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-slate-400 mb-3">試合情報の読み込みに失敗しました</div>
          <button
            onClick={refreshGames}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-white">今日の試合</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-slate-400">今日は試合がありません</div>
        </div>
        <div className="text-xs text-slate-500 text-center mt-4">
          最終更新: {lastUpdated ? lastUpdated.toLocaleTimeString('ja-JP') : '未取得'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-white">今日の試合</h2>
        </div>
        <div className="flex items-center gap-2">
          {games.some(g => g.status === 'live') && (
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="text-xs text-red-500 font-medium">LIVE</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-green-400 animate-pulse" />
                <span className="text-xs text-green-400">自動更新中</span>
              </div>
            )}
            <button
              onClick={refreshGames}
              className="text-slate-400 hover:text-white transition-colors"
              title="手動更新"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {games.slice(0, 5).map((game, index) => (
          <div
            key={game.gameId || `${game.homeTeam}-${game.awayTeam}-${index}`}
            className="bg-white/5 backdrop-blur-sm rounded-lg p-4 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`text-sm font-medium ${getStatusColor(game.status)}`}>
                {game.status === 'live' && <Zap className="w-3 h-3 inline mr-1 animate-pulse" />}
                {getStatusText(game.status)}
              </div>
              {game.time && (
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {game.time}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                {/* Away Team */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{
                        backgroundColor: game.awayTeamInfo?.primaryColor || '#888888',
                        borderColor: game.awayTeamInfo?.primaryColor || '#888888'
                      }}
                    />
                    <span className="text-sm text-white">{game.awayTeamInfo?.shortName || game.awayTeam}</span>
                    <span className="text-xs text-slate-500">
                      ({game.awayTeamInfo?.league === 'central' ? 'セ' : 'パ'})
                    </span>
                  </div>
                  {game.status === 'finished' && (
                    <span className="text-lg font-bold text-white">{game.awayScore}</span>
                  )}
                </div>

                {/* Home Team */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{
                        backgroundColor: game.homeTeamInfo?.primaryColor || '#888888',
                        borderColor: game.homeTeamInfo?.primaryColor || '#888888'
                      }}
                    />
                    <span className="text-sm text-white">{game.homeTeamInfo?.shortName || game.homeTeam}</span>
                    <span className="text-xs text-slate-500">
                      ({game.homeTeamInfo?.league === 'central' ? 'セ' : 'パ'})
                    </span>
                  </div>
                  {game.status === 'finished' && (
                    <span className="text-lg font-bold text-white">{game.homeScore}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 mt-2">{game.venue}</div>
          </div>
        ))}
      </div>

      {games.length > 5 && (
        <div className="text-center">
          <Link
            href="/games"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
          >
            他の試合を見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
        <div className="text-xs text-slate-500">
          最終更新: {lastUpdated ? lastUpdated.toLocaleTimeString('ja-JP') : '未取得'}
        </div>
        <Link
          href="/games"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          全試合を見る
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}