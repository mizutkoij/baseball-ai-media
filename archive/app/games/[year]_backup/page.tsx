import { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, Trophy, TrendingUp, Clock, ArrowLeft, BarChart3 } from 'lucide-react';

interface GamesByMonth {
  [month: string]: Array<{
    game_id: string;
    date: string;
    home_team: string;
    away_team: string;
    home_score?: number;
    away_score?: number;
    status: string;
    venue: string;
  }>;
}

async function getYearlyGames(year: string) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database('./data/db_current.db');
    
    const games = db.prepare(`
      SELECT 
        game_id, date, home_team, away_team, 
        home_score, away_score, status, venue
      FROM games 
      WHERE substr(date, 1, 4) = ?
      ORDER BY date ASC, game_id ASC
    `).all(year);
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN status = 'finished' THEN 1 END) as finished_games,
        COUNT(CASE WHEN status = 'live' THEN 1 END) as live_games,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_games
      FROM games 
      WHERE substr(date, 1, 4) = ?
    `).get(year);
    
    db.close();

    // Group games by month
    const gamesByMonth: GamesByMonth = {};
    games.forEach((game: any) => {
      const month = game.date.substring(0, 7); // YYYY-MM
      if (!gamesByMonth[month]) {
        gamesByMonth[month] = [];
      }
      gamesByMonth[month].push(game);
    });

    return { games, gamesByMonth, stats };
  } catch (error) {
    console.error('Error fetching yearly games:', error);
    return { games: [], gamesByMonth: {}, stats: { total_games: 0, finished_games: 0, live_games: 0, scheduled_games: 0 } };
  }
}

export async function generateMetadata({ params }: { params: { year: string } }): Promise<Metadata> {
  return {
    title: `${params.year}年シーズン試合一覧 | Baseball AI Media`,
    description: `${params.year}年NPBシーズンの全試合結果・日程を月別で確認。詳細な試合データと統計情報を提供。`,
    keywords: ['NPB', `${params.year}年`, 'プロ野球', '試合結果', 'シーズン', '月別'],
  };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'live':
      return 'bg-red-500 text-white animate-pulse';
    case 'finished':
      return 'bg-gray-500 text-white';
    case 'scheduled':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-300 text-gray-700';
  }
}

function getMonthName(monthStr: string) {
  const month = parseInt(monthStr.split('-')[1]);
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  return months[month - 1];
}

export default async function YearPage({ params }: { params: { year: string } }) {
  const { games, gamesByMonth, stats } = await getYearlyGames(params.year);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/games" className="text-orange-400 hover:text-orange-300 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {params.year}年シーズン
            </h1>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{stats.total_games}</div>
              <div className="text-sm text-slate-300">総試合数</div>
            </div>
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{stats.finished_games}</div>
              <div className="text-sm text-slate-300">終了</div>
            </div>
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">{stats.live_games}</div>
              <div className="text-sm text-slate-300">進行中</div>
            </div>
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400">{stats.scheduled_games}</div>
              <div className="text-sm text-slate-300">予定</div>
            </div>
          </div>
        </div>

        {/* Monthly Games */}
        <div className="space-y-8">
          {Object.entries(gamesByMonth)
            .sort(([a], [b]) => b.localeCompare(a)) // Sort months descending
            .map(([month, monthGames]) => (
            <div key={month} className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-semibold">{getMonthName(month)}</h2>
                <span className="text-sm text-slate-400">({monthGames.length}試合)</span>
              </div>
              
              <div className="grid gap-3">
                {monthGames.map((game) => (
                  <Link
                    key={game.game_id}
                    href={`/games/${game.game_id}`}
                    className="block p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 hover:border-white/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-400 min-w-[80px]">
                          {new Date(game.date).toLocaleDateString('ja-JP', {
                            month: 'numeric',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{game.away_team}</span>
                          <span className="text-slate-400">vs</span>
                          <span className="font-medium">{game.home_team}</span>
                        </div>
                        
                        {game.home_score !== null && game.away_score !== null && (
                          <div className="text-lg font-bold text-blue-400">
                            {game.away_score} - {game.home_score}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-slate-400">{game.venue}</div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(game.status)}`}>
                          {game.status === 'finished' ? '終了' : 
                           game.status === 'live' ? 'LIVE' : 
                           game.status === 'scheduled' ? '予定' : game.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* No Data Message */}
        {games.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              {params.year}年のデータはありません
            </h3>
            <p className="text-slate-400">
              このシーズンの試合データはまだ収集されていません。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}