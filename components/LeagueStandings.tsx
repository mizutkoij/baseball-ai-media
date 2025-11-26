'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Trophy, TrendingUp, TrendingDown, Calendar, Target, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';

interface TeamStanding {
  team_code: string;
  team_name: string;
  league: 'central' | 'pacific';
  wins: number;
  losses: number;
  draws: number;
  games_played: number;
  win_pct: number;
  games_back: number;
  rank: number;
  last_10: string;
  streak: string;
  home_record: string;
  away_record: string;
  vs_central: string;
  vs_pacific: string;
  runs_scored: number;
  runs_allowed: number;
  run_diff: number;
}

interface StandingsResponse {
  central: TeamStanding[];
  pacific: TeamStanding[];
  last_updated: string;
  season: number;
  games_remaining: number;
  playoff_format: {
    central: { cs_teams: number; wildcard_teams: number };
    pacific: { cs_teams: number; wildcard_teams: number };
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function StandingsTable({ 
  teams, 
  league, 
  playoffFormat 
}: { 
  teams: TeamStanding[];
  league: 'central' | 'pacific';
  playoffFormat: { cs_teams: number; wildcard_teams: number };
}) {
  const getTeamBgColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-50 border-yellow-200';
    if (rank <= playoffFormat.cs_teams) return 'bg-blue-50 border-blue-200';
    if (rank <= playoffFormat.cs_teams + playoffFormat.wildcard_teams) return 'bg-green-50 border-green-200';
    return 'bg-white border-slate-200';
  };

  const getStreakColor = (streak: string) => {
    if (streak.startsWith('W')) return 'text-green-600 bg-green-50';
    if (streak.startsWith('L')) return 'text-red-600 bg-red-50';
    return 'text-slate-600 bg-slate-50';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-600" />;
    if (rank <= playoffFormat.cs_teams) return <Target className="w-4 h-4 text-blue-600" />;
    if (rank <= playoffFormat.cs_teams + playoffFormat.wildcard_teams) return <ArrowUp className="w-4 h-4 text-green-600" />;
    return null;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          {league === 'central' ? 'セントラル・リーグ' : 'パシフィック・リーグ'}
          <span className="text-sm font-normal text-slate-600">
            ({teams.length}チーム)
          </span>
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs text-slate-600">
              <th className="text-left py-3 px-4 font-semibold">順位</th>
              <th className="text-left py-3 px-4 font-semibold">チーム</th>
              <th className="text-center py-3 px-2 font-semibold">試合</th>
              <th className="text-center py-3 px-2 font-semibold">勝</th>
              <th className="text-center py-3 px-2 font-semibold">敗</th>
              <th className="text-center py-3 px-2 font-semibold">分</th>
              <th className="text-center py-3 px-2 font-semibold">勝率</th>
              <th className="text-center py-3 px-2 font-semibold">GB</th>
              <th className="text-center py-3 px-2 font-semibold">直近10試合</th>
              <th className="text-center py-3 px-2 font-semibold">連続</th>
              <th className="text-center py-3 px-2 font-semibold">得失点差</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => (
              <tr 
                key={team.team_code}
                className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${getTeamBgColor(team.rank)}`}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{team.rank}</span>
                    {getRankIcon(team.rank)}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Link 
                    href={`/teams/2024/${team.team_code}`}
                    className="hover:text-blue-600 transition-colors"
                  >
                    <div className="font-medium text-slate-900">{team.team_name}</div>
                    <div className="text-xs text-slate-500">{team.team_code}</div>
                  </Link>
                </td>
                <td className="text-center py-3 px-2 text-sm">{team.games_played}</td>
                <td className="text-center py-3 px-2 text-sm font-semibold text-green-600">{team.wins}</td>
                <td className="text-center py-3 px-2 text-sm font-semibold text-red-600">{team.losses}</td>
                <td className="text-center py-3 px-2 text-sm text-slate-600">{team.draws}</td>
                <td className="text-center py-3 px-2 text-sm font-mono font-bold">
                  {team.win_pct.toFixed(3)}
                </td>
                <td className="text-center py-3 px-2 text-sm text-slate-600">
                  {team.games_back === 0 ? '-' : team.games_back}
                </td>
                <td className="text-center py-3 px-2 text-sm font-mono">{team.last_10}</td>
                <td className="text-center py-3 px-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStreakColor(team.streak)}`}>
                    {team.streak}
                  </span>
                </td>
                <td className="text-center py-3 px-2 text-sm">
                  <span className={`font-medium ${team.run_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {team.run_diff >= 0 ? '+' : ''}{team.run_diff}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Playoff Indicators */}
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-200">
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Trophy className="w-3 h-3 text-yellow-600" />
            <span>優勝</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3 h-3 text-blue-600" />
            <span>CS進出 (上位{playoffFormat.cs_teams}位)</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUp className="w-3 h-3 text-green-600" />
            <span>ワイルドカード圏内</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeagueStandings({ 
  year = new Date().getFullYear(),
  showBoth = true,
  league,
  compact = false 
}: {
  year?: number;
  showBoth?: boolean;
  league?: 'central' | 'pacific';
  compact?: boolean;
}) {
  const [selectedLeague, setSelectedLeague] = useState<'both' | 'central' | 'pacific'>('both');
  
  const apiUrl = `/api/standings?year=${year}${league ? `&league=${league}` : ''}`;
  
  const { data, error, isLoading } = useSWR<StandingsResponse>(apiUrl, fetcher, {
    refreshInterval: 300000, // 5 minutes
    revalidateOnFocus: true,
    dedupingInterval: 60000, // 1 minute
  });

  useEffect(() => {
    if (league) setSelectedLeague(league);
  }, [league]);

  const handleTabChange = (tab: 'both' | 'central' | 'pacific') => {
    setSelectedLeague(tab);
    
    // Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'standings_tab_switch', {
        league: tab,
        year: year
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-3">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6 text-center">
        <div className="text-red-600 mb-2">順位表の読み込みに失敗しました</div>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-600" />
            NPB順位表
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            {year}年シーズン • 残り{data.games_remaining}試合
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-4 h-4" />
          最終更新: {new Date(data.last_updated).toLocaleString('ja-JP', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>

      {/* League Tabs */}
      {showBoth && !league && (
        <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => handleTabChange('both')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedLeague === 'both'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            両リーグ
          </button>
          <button
            onClick={() => handleTabChange('central')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedLeague === 'central'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            セ・リーグ
          </button>
          <button
            onClick={() => handleTabChange('pacific')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedLeague === 'pacific'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            パ・リーグ
          </button>
        </div>
      )}

      {/* Standings Tables */}
      <div className={compact ? 'space-y-4' : 'space-y-6'}>
        {(selectedLeague === 'both' || selectedLeague === 'central') && data.central && (
          <StandingsTable 
            teams={data.central} 
            league="central" 
            playoffFormat={data.playoff_format.central}
          />
        )}
        
        {(selectedLeague === 'both' || selectedLeague === 'pacific') && data.pacific && (
          <StandingsTable 
            teams={data.pacific} 
            league="pacific" 
            playoffFormat={data.playoff_format.pacific}
          />
        )}
      </div>

      {/* Quick Links */}
      {!compact && (
        <div className="bg-slate-50 rounded-lg p-6">
          <h3 className="font-semibold text-slate-900 mb-4">関連ツール</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/compare/teams"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <Target className="w-4 h-4" />
              チーム詳細比較
            </Link>
            <Link
              href="/schedule"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <Calendar className="w-4 h-4" />
              試合スケジュール
            </Link>
            <Link
              href="/matchups"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <TrendingUp className="w-4 h-4" />
              対戦分析
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}