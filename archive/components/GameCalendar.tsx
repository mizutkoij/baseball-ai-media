'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Trophy, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';

interface GameInfo {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  venue: string;
  status: 'scheduled' | 'live' | 'finished';
  startTime: string;
}

interface CalendarDay {
  date: string;
  isCurrentMonth: boolean;
  games: GameInfo[];
}

export default function GameCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      generateCalendar();
    }
  }, [currentDate, mounted]);

  const generateCalendar = async () => {
    setLoading(true);
    
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // 月の最初と最後の日を取得
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // カレンダーの開始日（月曜日から開始）
      const startDate = new Date(firstDay);
      const startDayOfWeek = (firstDay.getDay() + 6) % 7; // 月曜日を0とする
      startDate.setDate(firstDay.getDate() - startDayOfWeek);
      
      // カレンダーの終了日
      const endDate = new Date(lastDay);
      const endDayOfWeek = (lastDay.getDay() + 6) % 7;
      endDate.setDate(lastDay.getDate() + (6 - endDayOfWeek));
      
      const days: CalendarDay[] = [];
      const currentDateObj = new Date(startDate);
      
      // 月の範囲で試合データを取得
      const monthStart = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
      const monthEnd = `${year}-${(month + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
      
      const gamesData = await fetchGamesForMonth(monthStart, monthEnd);
      const gamesByDate = groupGamesByDate(gamesData);
      
      while (currentDateObj <= endDate) {
        const dateStr = currentDateObj.toISOString().split('T')[0];
        const isCurrentMonth = currentDateObj.getMonth() === month;
        const dayGames = gamesByDate[dateStr] || [];
        
        days.push({
          date: dateStr,
          isCurrentMonth,
          games: dayGames
        });
        
        currentDateObj.setDate(currentDateObj.getDate() + 1);
      }
      
      setCalendarDays(days);
    } catch (error) {
      console.error('Error generating calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGamesForMonth = async (startDate: string, endDate: string): Promise<GameInfo[]> => {
    try {
      // 複数日の試合データを取得
      const promises = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        promises.push(fetchGamesForDate(dateStr));
      }
      
      const results = await Promise.all(promises);
      return results.flat();
    } catch (error) {
      console.error('Error fetching games for month:', error);
      return [];
    }
  };

  const fetchGamesForDate = async (date: string): Promise<GameInfo[]> => {
    try {
      const response = await fetch(`/api/games/by-date/${date}`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.games || [];
    } catch (error) {
      return [];
    }
  };

  const groupGamesByDate = (games: GameInfo[]): { [date: string]: GameInfo[] } => {
    return games.reduce((acc, game) => {
      const date = game.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(game);
      return acc;
    }, {} as { [date: string]: GameInfo[] });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finished': return 'bg-green-500';
      case 'live': return 'bg-red-500 animate-pulse';
      case 'scheduled': return 'bg-blue-500';
      default: return 'bg-gray-500';
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

  const formatTeamName = (teamName: string | undefined) => {
    if (!teamName) return '?';
    
    // チーム名を短縮表示
    const shortNames: { [key: string]: string } = {
      '巨人': '巨',
      'ヤクルト': 'ヤ',
      '阪神': '神',
      '広島': '広',
      'DeNA': 'De',
      '中日': '中',
      'ソフトバンク': 'ソ',
      '日本ハム': '日',
      '西武': '西',
      'ロッテ': 'ロ',
      'オリックス': 'オ',
      '楽天': '楽'
    };
    return shortNames[teamName] || teamName.slice(0, 2);
  };

  if (!mounted) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded mb-4"></div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/5 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const monthYear = currentDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-white">試合日程</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            disabled={loading}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 py-2 text-white font-medium min-w-[120px] text-center">
            {monthYear}
          </div>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            disabled={loading}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['月', '火', '水', '木', '金', '土', '日'].map((day, index) => (
          <div key={day} className={`text-center text-sm font-medium p-2 ${
            index >= 5 ? 'text-red-400' : 'text-slate-400'
          }`}>
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => {
          const isToday = day.date === today;
          const hasGames = day.games.length > 0;
          
          return (
            <div
              key={`${day.date}-${index}`}
              className={`min-h-[80px] p-2 rounded-lg border transition-all ${
                day.isCurrentMonth 
                  ? 'bg-white/5 border-white/10' 
                  : 'bg-white/2 border-white/5 opacity-50'
              } ${
                isToday ? 'ring-2 ring-blue-500' : ''
              } ${
                hasGames ? 'hover:bg-white/10 cursor-pointer' : ''
              }`}
              onClick={() => hasGames ? setSelectedDate(selectedDate === day.date ? null : day.date) : null}
            >
              {/* 日付 */}
              <div className={`text-sm font-medium mb-1 ${
                isToday ? 'text-blue-400' : 'text-white'
              }`}>
                {new Date(day.date).getDate()}
              </div>

              {/* 試合情報 */}
              <div className="space-y-1">
                {day.games.slice(0, 2).map((game, gameIndex) => (
                  <Link
                    key={`${game.gameId}-${gameIndex}`}
                    href={`/games/${game.gameId}`}
                    className="block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={`text-xs p-1 rounded ${getStatusColor(game.status)} text-white`}>
                      <div className="flex items-center justify-between">
                        <span>{formatTeamName(game.awayTeam)}</span>
                        <span>vs</span>
                        <span>{formatTeamName(game.homeTeam)}</span>
                      </div>
                      {game.status === 'finished' && game.homeScore !== undefined && (
                        <div className="text-center mt-1 font-bold">
                          {game.awayScore}-{game.homeScore}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
                
                {day.games.length > 2 && (
                  <div className="text-xs text-slate-400 text-center">
                    +{day.games.length - 2}試合
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 選択された日の詳細 */}
      {selectedDate && (
        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-3">
            {new Date(selectedDate).toLocaleDateString('ja-JP', { 
              month: 'long', 
              day: 'numeric',
              weekday: 'long'
            })}の試合
          </h3>
          
          <div className="space-y-3">
            {calendarDays
              .find(day => day.date === selectedDate)
              ?.games.map((game, index) => (
              <Link 
                key={`${game.gameId}-detail-${index}`}
                href={`/games/${game.gameId}`}
                className="block p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full text-white ${getStatusColor(game.status)}`}>
                        {getStatusText(game.status)}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {game.startTime}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-white">
                        {game.awayTeam} vs {game.homeTeam}
                      </div>
                      {game.status === 'finished' && game.homeScore !== undefined && (
                        <div className="text-white font-bold">
                          {game.awayScore} - {game.homeScore}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                      <MapPin className="w-3 h-3" />
                      {game.venue}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          <button
            onClick={() => setSelectedDate(null)}
            className="mt-3 text-sm text-slate-400 hover:text-white"
          >
            閉じる
          </button>
        </div>
      )}

      {/* 凡例 */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-slate-400">終了</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded animate-pulse"></div>
          <span className="text-slate-400">LIVE</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-slate-400">予定</span>
        </div>
      </div>
    </div>
  );
}