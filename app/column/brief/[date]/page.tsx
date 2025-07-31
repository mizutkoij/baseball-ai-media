import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  Trophy, 
  Users, 
  BarChart3,
  Clock,
  MapPin,
  Star
} from 'lucide-react';

interface BriefData {
  date: string;
  gotd: {
    game_id: string;
    away_team: string;
    home_team: string;
    away_score?: number;
    home_score?: number;
    status: string;
    venue?: string;
    selection_score: number;
  } | null;
  leaders: {
    player_name: string;
    team: string;
    metric_name: string;
    metric_value: number;
  }[];
  notes: string[];
  summary: {
    total_games: number;
    completed_games: number;
    highest_score_game?: {
      away_team: string;
      home_team: string;
      away_score: number;
      home_score: number;
    };
    closest_game?: {
      away_team: string;
      home_team: string;
      away_score: number;
      home_score: number;
    };
  };
  provenance: {
    source: string;
    method: string;
    generated_at: string;
  };
}

// 静的パスを生成（過去30日分）
export async function generateStaticParams() {
  const params = [];
  const now = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(now.getTime() - i * 86400000);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    params.push({ date: dateStr });
  }
  
  return params;
}

// ブリーフデータを読み込み
async function loadBriefData(date: string): Promise<BriefData | null> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const briefPath = path.join(process.cwd(), 'public/column/brief', date, 'index.json');
    const data = await fs.readFile(briefPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to load brief data for ${date}:`, error);
    return null;
  }
}

// メタデータ生成
export async function generateMetadata({ params }: { params: { date: string } }): Promise<Metadata> {
  const briefData = await loadBriefData(params.date);
  const formattedDate = formatDateString(params.date);
  
  if (!briefData) {
    return {
      title: `${formattedDate}のデイリーブリーフ | Baseball AI Media`,
      description: `${formattedDate}の野球データが見つかりません`,
    };
  }

  const gotdText = briefData.gotd 
    ? `注目試合: ${briefData.gotd.away_team} vs ${briefData.gotd.home_team}`
    : '注目試合なし';
  
  return {
    title: `${formattedDate} デイリーブリーフ | Baseball AI Media`,
    description: `${formattedDate}のNPB試合結果と注目選手。${gotdText}。完了試合${briefData.summary.completed_games}/${briefData.summary.total_games}試合の分析結果。`,
    openGraph: {
      title: `${formattedDate} NPBデイリーブリーフ`,
      description: `${gotdText}など、${formattedDate}の野球ハイライト`,
      type: 'article',
      images: [`/column/brief/${params.date}/og.png`]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${formattedDate} NPBブリーフ`,
      description: gotdText,
      images: [`/column/brief/${params.date}/og.png`]
    }
  };
}

// 日付フォーマット
function formatDateString(dateStr: string): string {
  if (dateStr.length === 8) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}年${parseInt(month)}月${parseInt(day)}日`;
  }
  return dateStr;
}

// ゲームステータス表示
function GameStatus({ game }: { game: NonNullable<BriefData['gotd']> }) {
  if (game.status === 'final' && game.away_score !== undefined && game.home_score !== undefined) {
    return (
      <div className="flex items-center gap-2 text-blue-400">
        <Trophy className="w-4 h-4" />
        <span>試合終了</span>
        <span className="font-bold">{game.away_score}-{game.home_score}</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Clock className="w-4 h-4" />
      <span>{game.status}</span>
    </div>
  );
}

export default async function DailyBriefPage({ params }: { params: { date: string } }) {
  const briefData = await loadBriefData(params.date);
  const formattedDate = formatDateString(params.date);

  if (!briefData) {
    notFound();
  }

  // トラッキングイベント（クライアントサイドで実行されるためuseEffectが必要）
  const trackBriefView = `
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'brief_view', {
        date: '${briefData.date}',
        has_gotd: ${briefData.gotd ? 'true' : 'false'},
        total_games: ${briefData.summary.total_games}
      });
    }
  `;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: trackBriefView }} />
      
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6">
              <ArrowLeft className="w-4 h-4" />
              ホームに戻る
            </Link>
            
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-8 h-8 text-yellow-400" />
              <h1 className="text-3xl font-bold text-white">デイリーブリーフ</h1>
            </div>
            
            <p className="text-slate-300 text-lg">
              {formattedDate}のNPB試合結果・注目選手・統計分析
            </p>
            
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-green-400">
                <BarChart3 className="w-4 h-4" />
                試合数: {briefData.summary.completed_games}/{briefData.summary.total_games}
              </div>
              <div className="flex items-center gap-2 text-blue-400">
                <TrendingUp className="w-4 h-4" />
                独自算出指標
              </div>
            </div>
          </div>

          {/* Game of the Day */}
          {briefData.gotd && (
            <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 backdrop-blur-md border border-yellow-500/30 rounded-lg p-6 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-6 h-6 text-yellow-400" />
                <h2 className="text-xl font-bold text-white">今日の注目試合</h2>
                <div className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded">
                  スコア: {briefData.gotd.selection_score}pt
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{briefData.gotd.away_team}</div>
                      <div className="text-sm text-slate-400">アウェイ</div>
                    </div>
                    
                    <div className="text-2xl font-bold text-blue-400">
                      {briefData.gotd.away_score !== undefined && briefData.gotd.home_score !== undefined
                        ? `${briefData.gotd.away_score} - ${briefData.gotd.home_score}`
                        : 'VS'
                      }
                    </div>
                    
                    <div className="text-left">
                      <div className="text-lg font-bold text-white">{briefData.gotd.home_team}</div>
                      <div className="text-sm text-slate-400">ホーム</div>
                    </div>
                  </div>
                  
                  <GameStatus game={briefData.gotd} />
                </div>
                
                <div className="space-y-3">
                  {briefData.gotd.venue && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span>{briefData.gotd.venue}</span>
                    </div>
                  )}
                  
                  <Link
                    href={`/games/${briefData.gotd.game_id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    詳細分析を見る
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Daily Leaders */}
          {briefData.leaders.length > 0 && (
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Users className="w-6 h-6 text-green-400" />
                今日の注目選手
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {briefData.leaders.map((leader, index) => (
                  <div key={index} className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-white">{leader.player_name}</div>
                        <div className="text-slate-400 text-sm">{leader.team}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">{leader.metric_value}</div>
                        <div className="text-slate-400 text-xs">{leader.metric_name}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Game Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {briefData.summary.highest_score_game && (
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-400" />
                  最多得点試合
                </h3>
                <div className="text-center">
                  <div className="text-lg text-white mb-2">
                    {briefData.summary.highest_score_game.away_team} vs {briefData.summary.highest_score_game.home_team}
                  </div>
                  <div className="text-2xl font-bold text-red-400">
                    {briefData.summary.highest_score_game.away_score}-{briefData.summary.highest_score_game.home_score}
                  </div>
                  <div className="text-sm text-slate-400 mt-2">
                    合計 {briefData.summary.highest_score_game.away_score + briefData.summary.highest_score_game.home_score} 得点
                  </div>
                </div>
              </div>
            )}

            {briefData.summary.closest_game && (
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-blue-400" />
                  最接戦
                </h3>
                <div className="text-center">
                  <div className="text-lg text-white mb-2">
                    {briefData.summary.closest_game.away_team} vs {briefData.summary.closest_game.home_team}
                  </div>
                  <div className="text-2xl font-bold text-blue-400">
                    {briefData.summary.closest_game.away_score}-{briefData.summary.closest_game.home_score}
                  </div>
                  <div className="text-sm text-slate-400 mt-2">
                    {Math.abs(briefData.summary.closest_game.away_score - briefData.summary.closest_game.home_score)}点差
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {briefData.notes.length > 0 && (
            <div className="bg-orange-900/20 backdrop-blur-md border border-orange-500/30 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-bold text-white mb-4">📊 分析ノート</h2>
              <ul className="space-y-2">
                {briefData.notes.map((note, index) => (
                  <li key={index} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h3 className="font-bold text-white mb-2">データ出典</h3>
                <ul className="text-slate-400 space-y-1">
                  <li>• ソース: {briefData.provenance.source}</li>
                  <li>• 手法: {briefData.provenance.method}</li>
                  <li>• 生成時刻: {new Date(briefData.provenance.generated_at).toLocaleString('ja-JP')}</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-white mb-2">関連ページ</h3>
                <div className="space-y-2">
                  <Link href="/today" className="block text-blue-400 hover:text-blue-300 underline">
                    今日の全試合
                  </Link>
                  <Link href="/players" className="block text-blue-400 hover:text-blue-300 underline">
                    選手データベース
                  </Link>
                  <Link href="/about/methodology" className="block text-blue-400 hover:text-blue-300 underline">
                    分析手法・係数表
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}