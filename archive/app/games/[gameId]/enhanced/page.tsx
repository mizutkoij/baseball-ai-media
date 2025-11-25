import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GameDetailsTab from "@/components/GameDetailsTab";
import PitchByPitchTab from "@/components/PitchByPitchTab";
import GameResultsTab from "@/components/GameResultsTab";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function fetchYahooGameData(gameId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/yahoo-data?type=game-detail&gameId=${gameId}`, {
      cache: 'no-store'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.success ? data.data : null;
    }
  } catch (error) {
    console.error('Failed to fetch Yahoo game data:', error);
  }
  return null;
}

// チーム情報抽出ヘルパー関数
function extractTeamFromGameId(gameId: string, position: 'home' | 'away'): string | null {
  // Yahoo ゲームIDの形式を解析
  const match = gameId.match(/\d{8}_([A-Z]+)-([A-Z]+)_\d{2}/);
  if (match) {
    return position === 'home' ? match[1] : match[2];
  }
  return null;
}

function getStatusBadge(status: string) {
  if (status === '試合中' || status === 'LIVE') {
    return 'bg-green-100 text-green-700';
  }
  if (status === '試合終了' || status === 'FINISHED') {
    return 'bg-gray-100 text-gray-600';
  }
  return 'bg-yellow-100 text-yellow-700';
}

interface EnhancedGamePageProps {
  params: { gameId: string };
  searchParams: { tab?: string };
}

export default async function EnhancedGamePage({ params, searchParams }: EnhancedGamePageProps) {
  const yahooData = await fetchYahooGameData(params.gameId);
  const activeTab = searchParams.tab || 'details';
  
  // ゲーム情報の抽出
  const gameInfo = yahooData?.game;
  const homeTeam = gameInfo?.home_team || extractTeamFromGameId(params.gameId, 'home') || 'ホーム';
  const awayTeam = gameInfo?.away_team || extractTeamFromGameId(params.gameId, 'away') || 'アウェイ';
  const status = gameInfo?.status || 'scheduled';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/games" 
              className="text-orange-400 hover:text-orange-300 transition-colors"
            >
              ← 試合一覧に戻る
            </Link>
            <div>
              <h1 className="text-3xl font-bold">
                {awayTeam} vs {homeTeam}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-gray-400">{gameInfo?.date || params.gameId}</span>
                <span className={`text-xs rounded px-2 py-1 ${getStatusBadge(status)}`}>
                  {status}
                </span>
                {gameInfo?.venue && (
                  <span className="text-gray-400">@{gameInfo.venue}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Link 
              href={`/games/${params.gameId}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
            >
              📊 ライブ分析
            </Link>
            <Link 
              href={`/games/${params.gameId}/replay`}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors"
            >
              📽️ リプレイ
            </Link>
          </div>
        </div>

        {/* タブナビゲーション */}
        <Card className="mb-8">
          <CardContent className="p-0">
            <div className="flex border-b">
              <TabButton 
                href={`/games/${params.gameId}/enhanced?tab=details`}
                active={activeTab === 'details'}
                icon="📝"
              >
                試合情報
              </TabButton>
              <TabButton 
                href={`/games/${params.gameId}/enhanced?tab=pitch-by-pitch`}
                active={activeTab === 'pitch-by-pitch'}
                icon="⚾"
              >
                一球速報
              </TabButton>
              <TabButton 
                href={`/games/${params.gameId}/enhanced?tab=results`}
                active={activeTab === 'results'}
                icon="📊"
              >
                試合結果
              </TabButton>
            </div>
          </CardContent>
        </Card>

        {/* タブコンテンツ */}
        <Suspense fallback={<LoadingFallback />}>
          <div className="space-y-6">
            {activeTab === 'details' && (
              <GameDetailsTab gameId={params.gameId} />
            )}
            
            {activeTab === 'pitch-by-pitch' && (
              <PitchByPitchTab gameId={params.gameId} />
            )}
            
            {activeTab === 'results' && (
              <GameResultsTab 
                gameId={params.gameId}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
              />
            )}
          </div>
        </Suspense>

        {/* データソース情報 */}
        <Card className="mt-8">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <div className="flex items-center gap-4">
                <span>
                  データソース: {yahooData ? 'Yahoo野球' : 'NPBデータベース'}
                </span>
                {yahooData?.has_detailed_data && (
                  <span className="text-green-400">
                    ✓ 詳細データ利用可能
                  </span>
                )}
              </div>
              <div>
                最終更新: {new Date().toLocaleString('ja-JP')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

interface TabButtonProps {
  href: string;
  active: boolean;
  icon: string;
  children: React.ReactNode;
}

function TabButton({ href, active, icon, children }: TabButtonProps) {
  return (
    <Link 
      href={href}
      className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
        active 
          ? 'text-blue-600 border-blue-600 bg-blue-50' 
          : 'text-gray-600 border-transparent hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      <span>{icon}</span>
      {children}
    </Link>
  );
}

function LoadingFallback() {
  return (
    <Card>
      <CardContent className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">データを読み込み中...</span>
        </div>
      </CardContent>
    </Card>
  );
}

export const metadata = {
  title: 'Enhanced Game View | Baseball AI Media',
  description: 'Yahooデータ統合の詳細試合ページ - スタメン、一球速報、試合結果',
};