'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Calendar, Clock, MapPin, ChevronDown, ChevronUp, Activity } from 'lucide-react';

interface GameData {
  game_id: string;
  date: string;
  league: string;
  away_team: string;
  home_team: string;
  away_score?: number;
  home_score?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed';
  inning?: string;
  venue: string;
  start_time_jst: string;
}

interface DaySchedule {
  date: string;
  games: GameData[];
}

interface ScheduleResponse {
  days: DaySchedule[];
  total_games: number;
  date_range: {
    from: string;
    to: string;
  };
  source: string;
}

interface HomeGamesListProps {
  className?: string;
}

const TEAM_NAMES: Record<string, string> = {
  'G': '巨人', 'T': '阪神', 'C': '広島', 'YS': 'DeNA', 'D': '中日', 'S': 'ヤクルト',
  'H': 'ソフトバンク', 'L': '西武', 'E': '楽天', 'M': 'ロッテ', 'F': '日本ハム', 'B': 'オリックス'
};

const TEAM_COLORS: Record<string, string> = {
  'G': 'border-orange-500', 'T': 'border-yellow-500', 'C': 'border-red-500',
  'YS': 'border-blue-500', 'D': 'border-blue-700', 'S': 'border-green-500',
  'H': 'border-yellow-400', 'L': 'border-blue-600', 'E': 'border-red-600',
  'M': 'border-black', 'F': 'border-blue-400', 'B': 'border-blue-800'
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Generate date range (today ± 3 days)
function getWeekRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 3);
  const to = new Date(today);
  to.setDate(today.getDate() + 3);
  
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function GameCard({ game, isCompact = false }: { game: GameData; isCompact?: boolean }) {
  const getStatusBadge = () => {
    switch (game.status) {
      case 'scheduled':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">PRE</span>;
      case 'in_progress':
        return (
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full font-medium">
              LIVE {game.inning}
            </span>
          </div>
        );
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">FINAL</span>;
      case 'postponed':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">中止</span>;
      default:
        return null;
    }
  };

  const getScore = (team: 'away' | 'home') => {
    const score = team === 'away' ? game.away_score : game.home_score;
    return score !== undefined ? score : '-';
  };

  const awayTeamColor = TEAM_COLORS[game.away_team] || 'border-gray-300';
  const homeTeamColor = TEAM_COLORS[game.home_team] || 'border-gray-300';

  if (isCompact) {
    return (
      <Link href={`/games/${game.game_id}`}>
        <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:shadow-md transition-all cursor-pointer">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-3 h-3 border-2 ${awayTeamColor} rounded-full`}></span>
                <span className="font-medium">{TEAM_NAMES[game.away_team] || game.away_team}</span>
                <span className="font-bold text-lg">{getScore('away')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 border-2 ${homeTeamColor} rounded-full`}></span>
                <span className="font-medium">{TEAM_NAMES[game.home_team] || game.home_team}</span>
                <span className="font-bold text-lg">{getScore('home')}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500">
              <Clock className="w-3 h-3 inline mr-1" />
              {game.start_time_jst}
            </div>
            {getStatusBadge()}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/games/${game.game_id}`}>
      <div className="bg-white border border-slate-200 rounded-lg p-4 hover:bg-slate-50 hover:shadow-md transition-all cursor-pointer">
        {/* Status & Time */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4" />
            <span>{game.start_time_jst}</span>
            <MapPin className="w-4 h-4 ml-2" />
            <span className="truncate">{game.venue}</span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Teams & Scores */}
        <div className="space-y-2">
          <div className={`flex items-center justify-between p-2 border-l-4 ${awayTeamColor}`}>
            <span className="font-medium text-slate-900">{TEAM_NAMES[game.away_team] || game.away_team}</span>
            <span className="text-xl font-bold text-slate-900">{getScore('away')}</span>
          </div>
          
          <div className={`flex items-center justify-between p-2 border-l-4 ${homeTeamColor}`}>
            <span className="font-medium text-slate-900">{TEAM_NAMES[game.home_team] || game.home_team}</span>
            <span className="text-xl font-bold text-slate-900">{getScore('home')}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function DaySection({ day, isExpanded, onToggle }: { 
  day: DaySchedule; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
    
    return isToday ? '今日' : formatter.format(date);
  };

  const liveGamesCount = day.games.filter(game => game.status === 'in_progress').length;
  const completedGamesCount = day.games.filter(game => game.status === 'completed').length;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Mobile: Collapsible header */}
      <button
        onClick={onToggle}
        className="md:hidden w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-slate-600" />
          <div className="text-left">
            <div className="font-semibold text-slate-900">{formatDate(day.date)}</div>
            <div className="text-sm text-slate-600">
              {day.games.length}試合
              {liveGamesCount > 0 && <span className="text-red-600 font-medium ml-2">● {liveGamesCount}試合中継中</span>}
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Desktop: Always visible header */}
      <div className="hidden md:flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-slate-600" />
          <div>
            <div className="font-semibold text-slate-900">{formatDate(day.date)}</div>
            <div className="text-sm text-slate-600">
              {day.games.length}試合
              {liveGamesCount > 0 && <span className="text-red-600 font-medium ml-2">● {liveGamesCount}試合中継中</span>}
            </div>
          </div>
        </div>
        {completedGamesCount === day.games.length && completedGamesCount > 0 && (
          <span className="text-xs text-green-600 font-medium">全試合終了</span>
        )}
      </div>

      {/* Games list */}
      <div className={`${!isExpanded ? 'md:block hidden' : 'block'}`}>
        {day.games.length > 0 ? (
          <div className="p-4 space-y-3">
            {day.games.map((game) => (
              <GameCard key={game.game_id} game={game} isCompact />
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-slate-500">
            試合予定がありません
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeGamesList({ className = "" }: HomeGamesListProps) {
  const [activeTab, setActiveTab] = useState<'first' | 'farm'>('first');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  
  const dateRange = getWeekRange();
  const apiUrl = `/api/schedule?from=${dateRange.from}&to=${dateRange.to}&league=${activeTab}`;
  
  // Skip SWR during build time
  const shouldFetch = typeof window !== 'undefined';
  const { data, error, isLoading } = useSWR<ScheduleResponse>(
    shouldFetch ? apiUrl : null, 
    fetcher, 
    {
      refreshInterval: 60000, // 60秒ごとに更新
      revalidateOnFocus: true,
      dedupingInterval: 30000,
    }
  );

  // Track analytics
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'home_gameslist_view', {
        league: activeTab,
        date_range: `${dateRange.from}_to_${dateRange.to}`,
        total_days: 7
      });
    }
  }, [activeTab, dateRange.from, dateRange.to]);

  const handleTabSwitch = (tab: 'first' | 'farm') => {
    setActiveTab(tab);
    setExpandedDays(new Set()); // Reset expanded state
    
    // Track tab switch
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'home_gameslist_tab', {
        from_tab: activeTab,
        to_tab: tab
      });
    }
  };

  const toggleDayExpansion = (date: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDays(newExpanded);

    // Track day toggle
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'home_gameslist_day_toggle', {
        date,
        expanded: !expandedDays.has(date),
        league: activeTab
      });
    }
  };

  const getTabStyle = (tab: 'first' | 'farm') => {
    const isActive = activeTab === tab;
    return `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive 
        ? 'bg-blue-600 text-white' 
        : 'bg-white/50 text-slate-600 hover:bg-white/80'
    }`;
  };

  return (
    <section className={`bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">今週の全試合</h2>
          <span className="text-sm text-slate-500">
            {new Date(dateRange.from).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} 〜 
            {new Date(dateRange.to).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* League tabs */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => handleTabSwitch('first')}
            className={getTabStyle('first')}
          >
            1軍 ({data?.days.reduce((sum, day) => sum + day.games.length, 0) || 0})
          </button>
          <button
            onClick={() => handleTabSwitch('farm')}
            className={getTabStyle('farm')}
          >
            ファーム
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        // Skeleton loading
        <div className="space-y-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-5 h-5 bg-slate-200 rounded"></div>
                <div className="w-24 h-4 bg-slate-200 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 bg-slate-200 rounded"></div>
                <div className="w-full h-12 bg-slate-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error || !data ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">試合データの読み込みに失敗しました</p>
          <p className="text-xs text-slate-400 mt-1">しばらく後にお試しください</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.days.map((day) => (
            <DaySection
              key={day.date}
              day={day}
              isExpanded={expandedDays.has(day.date)}
              onToggle={() => toggleDayExpansion(day.date)}
            />
          ))}
          
          {data.days.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">この期間に{activeTab === 'first' ? '1軍' : 'ファーム'}の試合はありません</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Activity className="w-4 h-4" />
          <span>60秒ごと自動更新</span>
          {data?.source && (
            <span className="text-xs">({data.source})</span>
          )}
        </div>
        <Link 
          href="/schedule" 
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          全スケジュール →
        </Link>
      </div>
    </section>
  );
}