import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { TeamShopLink, TeamTicketLink } from '@/components/AffiliateLink';
import GameCalendar from '@/components/GameCalendar';
import YearSelector from '@/components/YearSelector';
import { Calendar, Trophy, TrendingUp, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: '試合日程・結果 | Baseball AI Media',
  description: 'NPB全試合の日程・結果を確認。カレンダー形式で見やすく表示し、過去の試合詳細も簡単にアクセスできます。',
  keywords: ['NPB', 'プロ野球', '試合結果', 'スケジュール', 'カレンダー', '日程'],
  authors: [{ name: 'Baseball AI Media Team' }],
  robots: 'index, follow',
  openGraph: {
    title: '試合日程・結果',
    description: 'カレンダー形式で見やすい試合日程と結果',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: '試合日程・結果',
    description: 'カレンダー形式で見やすい試合日程と結果',
  },
};

function toJstDate(d = new Date()) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo" })
    .formatToParts(d).reduce((acc,p)=> (p.type==="year"||p.type==="month"||p.type==="day")? (acc.push(p.value),acc):acc, [] as string[])
    .join("-").replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/, (_,y,m,dd)=>`${y}-${m.padStart(2,"0")}-${dd.padStart(2,"0")}`);
}

function prev(d: string) { 
  const dt = new Date(d); 
  dt.setDate(dt.getDate() - 1); 
  return dt.toISOString().slice(0, 10); 
}

function next(d: string) { 
  const dt = new Date(d); 
  dt.setDate(dt.getDate() + 1); 
  return dt.toISOString().slice(0, 10); 
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'LIVE':
      return 'bg-red-500 text-white animate-pulse';
    case 'FINISHED':
      return 'bg-gray-500 text-white';
    case 'SCHEDULED':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
}

async function getRecentGames() {
  try {
    // 最近7日間の試合を取得
    const games = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/games/by-date/${dateStr}`, {
          next: { revalidate: 300 } // 5分キャッシュ
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.games) {
            games.push(...data.games.map((game: any) => ({ ...game, date: dateStr })));
          }
        }
      } catch (error) {
        console.error(`Error fetching games for ${dateStr}:`, error);
      }
    }
    
    return games;
  } catch (error) {
    console.error('Error fetching recent games:', error);
    return [];
  }
}

async function getGameStats() {
  try {
    // 統計情報をダミーで返す（実際のAPIから取得する場合はここを修正）
    return {
      totalGamesThisMonth: 45,
      finishedGames: 38,
      upcomingGames: 7,
      avgScorePerGame: 8.3
    };
  } catch (error) {
    return {
      totalGamesThisMonth: 0,
      finishedGames: 0,
      upcomingGames: 0,
      avgScorePerGame: 0
    };
  }
}

function RecentGamesSection({ games }: { games: any[] }) {
  const finishedGames = games.filter(g => g.status === 'finished').slice(0, 10);
  
  if (finishedGames.length === 0) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          最近の試合結果
        </h2>
        <p className="text-slate-400">最近の試合データがありません。</p>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-500" />
        最近の試合結果
      </h2>
      
      <div className="space-y-3">
        {finishedGames.map((game, index) => (
          <Link
            key={`${game.game_id}-${index}`}
            href={`/games/${game.game_id}`}
            className="block p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-white">
                    {game.away_team} vs {game.home_team}
                  </div>
                  <div className="text-white font-bold">
                    {game.away_score} - {game.home_score}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{game.venue}</span>
                  <span>{new Date(game.date).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatsSection({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <div className="text-sm text-slate-400">今月の試合</div>
        </div>
        <div className="text-2xl font-bold text-white">{stats.totalGamesThisMonth}</div>
      </div>
      
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-green-500" />
          <div className="text-sm text-slate-400">完了試合</div>
        </div>
        <div className="text-2xl font-bold text-white">{stats.finishedGames}</div>
      </div>
      
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-orange-500" />
          <div className="text-sm text-slate-400">予定試合</div>
        </div>
        <div className="text-2xl font-bold text-white">{stats.upcomingGames}</div>
      </div>
      
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-purple-500" />
          <div className="text-sm text-slate-400">平均得点</div>
        </div>
        <div className="text-2xl font-bold text-white">{stats.avgScorePerGame}</div>
      </div>
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams?: { view?: string, level?: string, date?: string } }) {
  const view = searchParams?.view || 'calendar';
  const level = (searchParams?.level || "NPB1").toUpperCase();
  const date = searchParams?.date || toJstDate();

  // カレンダービューとリストビューの切り替え
  if (view === 'calendar') {
    const [recentGames, stats] = await Promise.all([
      getRecentGames(),
      getGameStats()
    ]);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          {/* ヘッダー */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-blue-500" />
                  試合日程・結果
                </h1>
                <p className="text-slate-300">
                  NPB全試合の日程と結果を確認できます。カレンダーから過去の試合詳細にも簡単にアクセスできます。
                </p>
              </div>
              <div className="flex gap-2">
                <Link 
                  href="/games?view=calendar"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg transition-colors"
                >
                  カレンダー
                </Link>
                <Link 
                  href="/games?view=list"
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  リスト
                </Link>
              </div>
            </div>
          </div>

          {/* 統計情報 */}
          <div className="mb-8">
            <StatsSection stats={stats} />
          </div>

          {/* メインコンテンツ */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* カレンダー */}
            <div className="lg:col-span-2">
              <Suspense fallback={
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
              }>
                <GameCalendar />
              </Suspense>
            </div>

            {/* サイドバー */}
            <div className="space-y-6">
              {/* 年度選択 */}
              <YearSelector />
              
              {/* 最近の試合結果 */}
              <RecentGamesSection games={recentGames} />
            </div>
          </div>

          {/* 使い方ガイド */}
          <div className="mt-8 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">使い方</h3>
            <div className="space-y-2 text-sm text-slate-300">
              <p>• カレンダーの日付をクリックすると、その日の全試合が表示されます</p>
              <p>• 試合をクリックすると詳細ページに移動します</p>
              <p>• 月の切り替えは左右の矢印ボタンで行えます</p>
              <p>• 緑色は終了した試合、青色は予定の試合、赤色（点滅）はライブ中の試合です</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 既存のリストビュー
  let games: any[] = [];
  let fallback = false;
  
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const today = new Date().toISOString().slice(0, 10);
    const revalidateTime = date < today ? 3600 : date > today ? 300 : 60;
    
    const res = await fetch(`${baseUrl}/api/games/by-date/${date}?level=${level}`, { 
      next: { revalidate: revalidateTime }
    });
    const data = await res.json();
    games = data.games || [];
    fallback = data.fallback || false;
  } catch (error) {
    console.error('Failed to fetch games:', error);
    fallback = true;
  }

  const today = toJstDate();
  const isToday = date === today;
  const isPast = date < today;
  const isFuture = date > today;

  return (
    <main className="mx-auto max-w-5xl p-6 bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-orange-400 hover:text-orange-300 transition-colors">
          ← ホーム
        </Link>
        <h1 className="text-3xl font-bold">
          試合一覧 {level === 'NPB2' ? 'ファーム' : '一軍'}
        </h1>
        <span className={`text-xs px-2 py-1 rounded ${level === 'NPB2' ? 'bg-orange-600' : 'bg-blue-600'}`}>
          {level}
        </span>
      </div>

      {/* Date Navigation */}
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href={`/games?level=${level}&date=${prev(date)}`}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              ← 前日
            </Link>
            
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{date}</span>
              {isToday && <span className="text-xs bg-green-600 px-2 py-1 rounded">今日</span>}
              {isPast && <span className="text-xs bg-gray-600 px-2 py-1 rounded">過去</span>}
              {isFuture && <span className="text-xs bg-blue-600 px-2 py-1 rounded">未来</span>}
            </div>
            
            <Link 
              href={`/games?level=${level}&date=${next(date)}`}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              翌日 →
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href={`/games?level=${level}&date=${today}`}
              className={`px-3 py-2 rounded-lg transition-colors ${isToday ? 'bg-green-600' : 'bg-white/10 hover:bg-white/20'}`}
            >
              今日に戻る
            </Link>
            <Link 
              href={`/?filter=${level}`}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ダッシュボード →
            </Link>
          </div>
        </div>
      </div>

      {/* Games Table */}
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
        {fallback && (
          <div className="bg-yellow-600/20 border-l-4 border-yellow-500 p-4 mb-4">
            <p className="text-sm text-yellow-200">
              ⚠️ データベース接続エラー - デモデータを表示中
            </p>
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left p-4 text-sm font-medium text-slate-300">開始時刻</th>
              <th className="text-left p-4 text-sm font-medium text-slate-300">対戦カード</th>
              <th className="text-left p-4 text-sm font-medium text-slate-300">球場</th>
              <th className="text-left p-4 text-sm font-medium text-slate-300">状態</th>
              <th className="text-left p-4 text-sm font-medium text-slate-300">操作</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game: any, index: number) => (
              <tr 
                key={game.game_id} 
                className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
              >
                <td className="p-4 text-white">
                  {game.start_time_jst || "-"}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{game.away_team}</span>
                    <span className="text-slate-400">@</span>
                    <span className="text-white font-medium">{game.home_team}</span>
                  </div>
                </td>
                <td className="p-4 text-slate-300">
                  {game.venue || "-"}
                </td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(game.status)}`}>
                    {game.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <Link 
                      href={`/games/${game.game_id}`}
                      className="text-orange-400 hover:text-orange-300 transition-colors underline text-sm"
                    >
                      詳細 →
                    </Link>
                    
                    {/* 自然な位置にアフィリエイトリンク（最大2つまで） */}
                    <div className="flex gap-2 text-xs">
                      {game.home_team && (
                        <TeamShopLink 
                          teamCode={game.home_team} 
                          className="!text-xs !px-2 !py-1"
                        />
                      )}
                      {game.home_team && game.status === 'SCHEDULED' && (
                        <TeamTicketLink 
                          teamCode={game.home_team}
                          className="!text-xs !px-2 !py-1" 
                        />
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {games.length === 0 && (
          <div className="text-center py-12">
            <div className="text-slate-400 text-lg mb-2">📅 試合予定がありません</div>
            <div className="text-xs text-slate-500">
              {isFuture ? "今後の日程をお待ちください" : 
               isPast ? "この日は試合がありませんでした" : 
               "本日は試合休養日です"}
            </div>
          </div>
        )}
      </div>

      {/* Level Toggle */}
      <div className="mt-6 flex justify-center">
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-2 flex gap-1">
          <Link 
            href={`/games?level=NPB1&date=${date}`}
            className={`px-4 py-2 rounded-md transition-colors ${level === 'NPB1' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            一軍
          </Link>
          <Link 
            href={`/games?level=NPB2&date=${date}`}
            className={`px-4 py-2 rounded-md transition-colors ${level === 'NPB2' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            ファーム
          </Link>
        </div>
      </div>
    </main>
  );
}