"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Clock, ExternalLink, Filter } from 'lucide-react';

interface GameResult {
  game_id: string;
  date: string;
  opponent: string;
  home_away: 'H' | 'A';
  result: 'W' | 'L' | 'D';
  score_team: number;
  score_opponent: number;
  venue?: string;
  game_status: 'completed' | 'scheduled' | 'postponed' | 'cancelled';
}

interface TeamScheduleProps {
  year: number;
  team: string;
  initialGames?: GameResult[];
}

const TeamSchedule: React.FC<TeamScheduleProps> = ({
  year,
  team,
  initialGames = []
}) => {
  const [games, setGames] = useState<GameResult[]>(initialGames);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'home' | 'away' | 'upcoming'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const teamNames: Record<string, string> = {
    'T': '阪神', 'S': 'ヤクルト', 'C': '広島', 'YS': 'DeNA', 'D': '中日', 'G': '巨人',
    'H': 'SB', 'L': '西武', 'E': '楽天', 'M': 'ロッテ', 'F': '日本ハム', 'B': 'オリックス'
  };

  useEffect(() => {
    if (initialGames.length === 0) {
      fetchSchedule();
    }
  }, [team, year]);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const fromDate = new Date(year, 0, 1).toISOString().split('T')[0]; // Jan 1st
      const toDate = new Date(year, 11, 31).toISOString().split('T')[0]; // Dec 31st
      
      const response = await fetch(`/api/schedule?team=${team}&from=${fromDate}&to=${toDate}&league=first`);
      if (response.ok) {
        const data = await response.json();
        
        // Convert games_by_date to flat array for easier processing
        const gamesArray: GameResult[] = [];
        Object.values(data.games_by_date || {}).forEach((dateGames: any) => {
          dateGames.forEach((game: any) => {
            gamesArray.push({
              game_id: game.game_id,
              date: game.date,
              opponent: game.opponent || (game.away_team === team ? game.home_team : game.away_team),
              home_away: game.home_away || (game.home_team === team ? 'H' : 'A'),
              result: game.result || (game.status === 'FINAL' ? 
                ((game.home_team === team && game.home_score > game.away_score) ||
                 (game.away_team === team && game.away_score > game.home_score) ? 'W' :
                 game.home_score === game.away_score ? 'D' : 'L') : 'W'),
              score_team: game.score_team || (game.home_team === team ? game.home_score : game.away_score) || 0,
              score_opponent: game.score_opponent || (game.home_team === team ? game.away_score : game.home_score) || 0,
              venue: game.venue,
              game_status: game.game_status || (
                game.status === 'FINAL' ? 'completed' : 
                game.status === 'IN_PROGRESS' ? 'in_progress' : 'scheduled'
              )
            });
          });
        });
        
        setGames(gamesArray);
      } else {
        throw new Error('API request failed');
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      // Fallback to mock data for demo
      setGames(generateMockGames());
    } finally {
      setLoading(false);
    }
  };

  const generateMockGames = (): GameResult[] => {
    const opponents = ['G', 'S', 'C', 'YS', 'D'].filter(t => t !== team);
    const mockGames: GameResult[] = [];
    
    for (let i = 0; i < 20; i++) {
      const date = new Date(year, selectedMonth - 1, i + 1);
      const opponent = opponents[i % opponents.length];
      const homeAway = Math.random() > 0.5 ? 'H' : 'A';
      
      mockGames.push({
        game_id: `${year}${(selectedMonth).toString().padStart(2, '0')}${(i + 1).toString().padStart(2, '0')}01`,
        date: date.toISOString().split('T')[0],
        opponent,
        home_away: homeAway,
        result: Math.random() > 0.3 ? (Math.random() > 0.6 ? 'W' : 'L') : 'D',
        score_team: Math.floor(Math.random() * 10) + 1,
        score_opponent: Math.floor(Math.random() * 10) + 1,
        venue: homeAway === 'H' ? '本拠地' : `${teamNames[opponent]}本拠地`,
        game_status: date < new Date() ? 'completed' : 'scheduled'
      });
    }
    
    return mockGames.filter(g => Math.random() > 0.3); // 70% 確率で試合
  };

  const filteredGames = games.filter(game => {
    const gameDate = new Date(game.date);
    const gameMonth = gameDate.getMonth() + 1;
    
    if (gameMonth !== selectedMonth) return false;
    
    switch (filter) {
      case 'home': return game.home_away === 'H';
      case 'away': return game.home_away === 'A';
      case 'upcoming': return game.game_status === 'scheduled';
      default: return true;
    }
  });

  const getResultColor = (result: string) => {
    switch (result) {
      case 'W': return 'text-green-400 bg-green-500/20';
      case 'L': return 'text-red-400 bg-red-500/20';
      case 'D': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  const handleGameClick = (game: GameResult) => {
    // Track analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'team_schedule_game_click', {
        team: team,
        year: year,
        game_id: game.game_id,
        opponent: game.opponent,
        home_away: game.home_away,
        game_status: game.game_status,
        result: game.result
      });
    }
  };

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    
    // Track analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'team_schedule_filter_change', {
        team: team,
        year: year,
        filter: newFilter,
        month: selectedMonth
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-600 rounded w-1/3"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">試合日程・結果</h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-black/30 border border-white/20 rounded-lg px-3 py-1 text-white text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}月
              </option>
            ))}
          </select>

          {/* Filter Buttons */}
          <div className="flex bg-black/30 rounded-lg p-1">
            {[
              { key: 'all', label: '全試合' },
              { key: 'home', label: 'ホーム' },
              { key: 'away', label: 'アウェイ' },
              { key: 'upcoming', label: '予定' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleFilterChange(key as typeof filter)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  filter === key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredGames.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>該当する試合がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGames.map((game) => {
            const gameDate = new Date(game.date);
            const isCompleted = game.game_status === 'completed';
            
            return (
              <Link
                key={game.game_id}
                href={`/games/${game.game_id}`}
                onClick={() => handleGameClick(game)}
                className="block bg-black/30 hover:bg-black/40 border border-white/10 rounded-lg p-4 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Date */}
                    <div className="text-center min-w-[60px]">
                      <div className="text-sm text-slate-400">
                        {gameDate.getMonth() + 1}/{gameDate.getDate()}
                      </div>
                      <div className="text-xs text-slate-500">
                        {['日', '月', '火', '水', '木', '金', '土'][gameDate.getDay()]}
                      </div>
                    </div>

                    {/* Home/Away Indicator */}
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      game.home_away === 'H' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {game.home_away === 'H' ? 'HOME' : 'AWAY'}
                    </div>

                    {/* Opponent */}
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">vs</span>
                      <span className="text-white font-semibold">
                        {teamNames[game.opponent] || game.opponent}
                      </span>
                    </div>

                    {/* Venue */}
                    {game.venue && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3" />
                        {game.venue}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Score & Result */}
                    {isCompleted ? (
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded text-xs font-bold ${getResultColor(game.result)}`}>
                          {game.result}
                        </div>
                        <div className="text-white font-mono text-sm">
                          {game.score_team} - {game.score_opponent}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {game.game_status === 'scheduled' ? '18:00' : game.game_status}
                      </div>
                    )}

                    {/* External Link Icon */}
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="text-white font-semibold">
              {filteredGames.filter(g => g.game_status === 'completed').length}
            </div>
            <div className="text-slate-400">試合数</div>
          </div>
          <div>
            <div className="text-green-400 font-semibold">
              {filteredGames.filter(g => g.result === 'W').length}
            </div>
            <div className="text-slate-400">勝利</div>
          </div>
          <div>
            <div className="text-red-400 font-semibold">
              {filteredGames.filter(g => g.result === 'L').length}
            </div>
            <div className="text-slate-400">敗戦</div>
          </div>
          <div>
            <div className="text-yellow-400 font-semibold">
              {filteredGames.filter(g => g.result === 'D').length}
            </div>
            <div className="text-slate-400">引分</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamSchedule;