/**
 * 試合リプレイページ - SSE風リプレイ体験
 * Live外時間でも滞在時間↑・広告在庫↑・SNS拡散↑
 */

import { Metadata } from 'next';
import Link from 'next/link';
import ReplayPlayer from '@/components/ReplayPlayer';
import { TeamShopLink } from '@/components/AffiliateLink';
import { AffiliatePageBanner } from '@/components/AffiliateDisclosure';

interface PageProps {
  params: { gameId: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const gameId = params.gameId;
  const gameDate = gameId.slice(0, 8);
  const formattedDate = `${gameDate.slice(0,4)}年${gameDate.slice(4,6)}月${gameDate.slice(6,8)}日`;

  return {
    title: `${formattedDate} 試合リプレイ | Baseball AI Media`,
    description: `${formattedDate}の試合をリプレイで振り返り。AI予測の変遷、勝率推移、注目プレーを詳細分析。`,
    keywords: ['NPB', 'リプレイ', '試合振り返り', 'AI予測', '勝率推移', formattedDate],
    openGraph: {
      title: `${formattedDate} 試合リプレイ`,
      description: 'AI予測と勝率推移で振り返る試合分析',
      type: 'article',
      locale: 'ja_JP',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${formattedDate} 試合リプレイ`,
      description: 'AI予測の変遷をリプレイで体験',
    },
  };
}

export default async function ReplayPage({ params }: PageProps) {
  const gameId = params.gameId;
  
  // ゲーム情報取得（軽量版）
  const gameInfo = await fetchGameInfo(gameId);
  
  return (
    <>
      <main className="mx-auto max-w-7xl p-4 lg:p-6 bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen text-white">
        {/* ナビゲーション */}
        <div className="flex items-center gap-4 mb-6">
          <Link 
            href={`/games/${gameId}`} 
            className="text-orange-400 hover:text-orange-300 transition-colors"
          >
            ← 試合詳細に戻る
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold">
            試合リプレイ
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>{gameInfo?.matchup || gameId}</span>
            {gameInfo?.status && (
              <span className="px-2 py-1 bg-gray-600 rounded text-xs">
                {gameInfo.status}
              </span>
            )}
          </div>
        </div>

        {/* 広告バナー（景表法対応） */}
        <AffiliatePageBanner />

        {/* リプレイプレイヤー */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
          {/* 左: スコア・状況表示 */}
          <div className="xl:col-span-1">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
              <h2 className="font-medium mb-4 text-white">試合状況</h2>
              <div id="game-status" className="space-y-3">
                <div className="text-center text-slate-400 text-sm">
                  リプレイ開始前...
                </div>
              </div>
            </div>

            {/* 操作ガイド */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-4">
              <h3 className="text-sm font-medium text-blue-300 mb-2">操作方法</h3>
              <ul className="text-xs text-blue-200 space-y-1">
                <li>▶️ 再生/停止</li>
                <li>⏩ 速度調整 (1-4x)</li>
                <li>⏭️ 重要場面へジャンプ</li>
                <li>📱 モバイル対応</li>
              </ul>
            </div>
          </div>

          {/* 中央: リプレイプレイヤー */}
          <div className="xl:col-span-2">
            <ReplayPlayer 
              gameId={gameId} 
              gameInfo={gameInfo}
            />
          </div>

          {/* 右: 広告枠・関連情報 */}
          <div className="xl:col-span-1 space-y-4">
            {/* チーム関連グッズ（広告） */}
            {(gameInfo?.homeTeam || gameInfo?.awayTeam) && (
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
                <h3 className="font-medium mb-3 text-white flex items-center gap-2">
                  ⚾ 関連グッズ
                  <span className="text-xs bg-blue-600 px-2 py-1 rounded">PR</span>
                </h3>
                <div className="space-y-3">
                  {gameInfo.homeTeam && (
                    <div>
                      <p className="text-sm text-gray-300 mb-2">{gameInfo.homeTeam}</p>
                      <TeamShopLink 
                        teamCode={gameInfo.homeTeam} 
                        className="text-sm w-full justify-center"
                      />
                    </div>
                  )}
                  {gameInfo.awayTeam && gameInfo.awayTeam !== gameInfo.homeTeam && (
                    <div>
                      <p className="text-sm text-gray-300 mb-2">{gameInfo.awayTeam}</p>
                      <TeamShopLink 
                        teamCode={gameInfo.awayTeam} 
                        className="text-sm w-full justify-center"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ホワイトペーパー導線 */}
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
              <h3 className="font-medium mb-2 text-purple-300">📊 AI分析手法</h3>
              <p className="text-sm text-purple-200 mb-3">
                このリプレイで使用しているAI予測モデルの詳細を公開中
              </p>
              <Link 
                href="/about/methodology"
                className="inline-flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-md transition-colors"
              >
                📄 手法詳細を見る
              </Link>
            </div>

            {/* SNS シェア */}
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
              <h3 className="font-medium mb-3 text-white">📢 シェアする</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => shareToTwitter(gameId, gameInfo)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded transition-colors"
                >
                  Twitter
                </button>
                <button 
                  onClick={() => copyToClipboard(window.location.href)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-2 rounded transition-colors"
                >
                  リンクコピー
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 関連試合リンク */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
          <h3 className="font-medium mb-4 text-white">🔗 関連試合</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              href={`/games/${gameId}`}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <div className="text-sm font-medium text-white">📊 詳細分析</div>
              <div className="text-xs text-slate-400">統計・データを見る</div>
            </Link>
            <Link 
              href={`/games`}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <div className="text-sm font-medium text-white">📅 試合一覧</div>
              <div className="text-xs text-slate-400">他の試合を探す</div>
            </Link>
            <Link 
              href="/analytics"
              className="p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <div className="text-sm font-medium text-white">🧮 高度分析</div>
              <div className="text-xs text-slate-400">AI予測ダッシュボード</div>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

// ゲーム情報取得（軽量版）
async function fetchGameInfo(gameId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/games/${gameId}`, {
      next: { revalidate: 300 } // 5分キャッシュ
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        matchup: `${data.away_team} @ ${data.home_team}`,
        homeTeam: data.home_team,
        awayTeam: data.away_team,
        status: data.status,
        venue: data.venue
      };
    }
  } catch (error) {
    console.error('Failed to fetch game info:', error);
  }
  
  // フォールバック: ゲームIDから推測
  const match = gameId.match(/\d{8}_([A-Z]+)-([A-Z]+)_\d{2}/);
  if (match) {
    return {
      matchup: `${match[2]} @ ${match[1]}`,
      homeTeam: match[1],
      awayTeam: match[2],
      status: 'UNKNOWN'
    };
  }
  
  return null;
}

// クライアントサイド関数（Next.js に組み込み用）
const shareToTwitter = (gameId: string, gameInfo: any) => {
  if (typeof window !== 'undefined') {
    const text = `${gameInfo?.matchup || gameId}の試合をAI予測リプレイで振り返り中 ⚾📊`;
    const url = window.location.href;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank');
  }
};

const copyToClipboard = (text: string) => {
  if (typeof window !== 'undefined') {
    navigator.clipboard.writeText(text).then(() => {
      alert('リンクをコピーしました！');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }
};