import Link from "next/link";
import NextPitchPanel from "@/components/NextPitchPanel";
import ErrorBoundary, { SSEErrorBoundary } from "@/components/ErrorBoundary";
import { StreamingLink, TeamShopLink, PlayerGoodsLink } from "@/components/AffiliateLink";
import dynamicImport from "next/dynamic";

// Dynamic import with SSR disabled to prevent hydration errors
const HistoricalGameDetail = dynamicImport(() => import("@/components/HistoricalGameDetail"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded mb-4"></div>
          <div className="h-64 bg-white/10 rounded mb-6"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-40 bg-white/10 rounded"></div>
            <div className="h-40 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  ),
});

export const dynamic = "force-dynamic"; // SSE連携のため

const LIVE_API = process.env.NEXT_PUBLIC_LIVE_API_BASE || "http://127.0.0.1:8787";

async function fetchLatest(gameId: string) {
  try {
    const r = await fetch(`${LIVE_API}/live/${gameId}?stale=5`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  } catch (error) {
    console.error('Failed to fetch live data:', error);
    return null;
  }
}

// NPBデータアダプターの型をインポート
type EnhancedGameData = {
  date: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  time: string;
  endTime?: string;
  gameTime?: string;
  attendance?: string;
  weather?: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'inprogress' | 'finished';
  league: 'central' | 'pacific';
  inningScores?: {
    away: number[];
    home: number[];
  };
  homeHits?: number;
  awayHits?: number;
  homeErrors?: number;
  awayErrors?: number;
  winningPitcher?: string;
  losingPitcher?: string;
  savePitcher?: string;
  holdPitchers?: string[];
  homeLineup?: Array<{
    position: string;
    name: string;
    positionName: string;
    playerId?: string;
  }>;
  awayLineup?: Array<{
    position: string;
    name: string;
    positionName: string;
    playerId?: string;
  }>;
  homeBattery?: string[];
  awayBattery?: string[];
  officials?: {
    chief?: string;
    first?: string;
    second?: string;
    third?: string;
  };
  // 詳細データ拡張
  homeBattingStats?: any[];
  awayBattingStats?: any[];
  homePitchingStats?: any[];
  awayPitchingStats?: any[];
  homeRoster?: any;
  awayRoster?: any;
  detailedAvailable?: boolean;
  dataSource?: 'legacy' | 'detailed' | 'hybrid';
};

function badge(s: string){ return s==="LIVE" ? "bg-green-100 text-green-700" :
  s==="FINISHED" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"; }

export default async function GamePage({ params }: { params: { gameId: string } }) {
  const latest = await fetchLatest(params.gameId);
  
  // データベースから基本情報を取得
  let dbGameData = null;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/games/${params.gameId}`, {
      cache: 'no-store'
    });
    if (response.ok) {
      const data = await response.json();
      dbGameData = data.game;
    }
  } catch (error) {
    console.error('Failed to fetch DB game data:', error);
  }

  // ステータスの決定: DB優先、次にライブAPI
  const status = dbGameData?.status || latest?.status || "SCHEDULED";

  // 過去試合の場合は専用コンポーネントを使用
  // 2017年のゲームIDや終了した試合は HistoricalGameDetail を使用
  if (status === 'finished' || status === 'final' || params.gameId.startsWith('2017') || params.gameId.startsWith('2018') || params.gameId.startsWith('2019') || params.gameId.startsWith('2020') || params.gameId.startsWith('2021') || params.gameId.startsWith('2022') || params.gameId.startsWith('2023') || params.gameId.startsWith('2024')) {
    return <HistoricalGameDetail gameId={params.gameId} />;
  }

  // 以下は既存のライブ試合用ロジック
  const homeTeam = latest?.homeTeam || extractTeamFromGameId(params.gameId, 'home');
  const awayTeam = latest?.awayTeam || extractTeamFromGameId(params.gameId, 'away');

  return (
    <main className="mx-auto max-w-5xl p-6 bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen text-white">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/games" className="text-orange-400 hover:text-orange-300 transition-colors">
          ← 一覧に戻る
        </Link>
        <h1 className="text-2xl font-semibold">{params.gameId}</h1>
        <span className={`text-xs rounded px-2 py-1 ${badge(status)}`}>{status}</span>
        
        {/* 詳細ページリンク */}
        <Link 
          href={`/games/${params.gameId}/enhanced`}
          className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors"
        >
          📝 詳細試合情報
        </Link>
        
        {/* リプレイリンク（Live外のみ） */}
        {status !== 'LIVE' && (
          <Link 
            href={`/games/${params.gameId}/replay`}
            className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors"
          >
            📽️ リプレイ
          </Link>
        )}
      </div>

      {/* 配信・視聴リンク（試合前60分のみ） */}
      {status === 'SCHEDULED' && (
        <div className="mb-6 p-4 border border-blue-500/30 bg-blue-900/20 rounded-lg">
          <h3 className="text-sm font-medium text-blue-300 mb-3">⚾ 試合を視聴する</h3>
          <div className="flex flex-wrap gap-3">
            <StreamingLink service="dazn" className="text-sm" />
            <StreamingLink service="parire_tv" className="text-sm" />
          </div>
        </div>
      )}

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        {/* 勝率スパークライン（既存 /dash のSVGロジックを流用可） */}
        <div className="rounded-xl p-4 border border-white/20 bg-black/20 backdrop-blur-md">
          <h2 className="font-medium mb-2 text-white">Live Win Probability</h2>
          <LiveSparkline gameId={params.gameId} />
        </div>

        {/* 次球予測（SSE） */}
        <div className="rounded-xl p-4 border border-white/20 bg-black/20 backdrop-blur-md">
          <h2 className="font-medium mb-2 text-white">Next Pitch（Top-3）</h2>
          <SSEErrorBoundary>
            <NextPitchPanel gameId={params.gameId} />
          </SSEErrorBoundary>
        </div>
      </section>

      {/* チーム関連グッズ（試合中・試合後） */}
      {(status === 'LIVE' || status === 'FINISHED') && (homeTeam || awayTeam) && (
        <section className="mt-6">
          <h3 className="text-lg font-medium text-white mb-4">⚾ 応援グッズ</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {homeTeam && (
              <div className="p-4 border border-white/10 bg-white/5 rounded-lg">
                <h4 className="text-sm font-medium text-gray-300 mb-2">{homeTeam} 関連</h4>
                <div className="space-y-2">
                  <TeamShopLink teamCode={homeTeam} className="text-sm" />
                  {latest?.winningPitcher && (
                    <PlayerGoodsLink 
                      playerName={latest.winningPitcher} 
                      teamCode={homeTeam}
                      className="text-sm"
                    />
                  )}
                </div>
              </div>
            )}
            
            {awayTeam && (
              <div className="p-4 border border-white/10 bg-white/5 rounded-lg">
                <h4 className="text-sm font-medium text-gray-300 mb-2">{awayTeam} 関連</h4>
                <div className="space-y-2">
                  <TeamShopLink teamCode={awayTeam} className="text-sm" />
                  {latest?.losingPitcher && (
                    <PlayerGoodsLink 
                      playerName={latest.losingPitcher} 
                      teamCode={awayTeam}
                      className="text-sm"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

// ↓ クライアント小物は app/components に分けてもOK

// チーム情報抽出ヘルパー関数
function extractTeamFromGameId(gameId: string, position: 'home' | 'away'): string | null {
  // ゲームIDの形式: YYYYMMDD_H-A_01 (例: 20250813_G-T_01)
  const match = gameId.match(/\d{8}_([A-Z]+)-([A-Z]+)_\d{2}/);
  if (match) {
    return position === 'home' ? match[1] : match[2];
  }
  return null;
}

function LiveSparkline({ gameId }: { gameId: string }) {
  return (
    <div className="text-center py-8">
      <div className="text-slate-400 text-sm">勝率変動グラフ（準備中）</div>
      <div className="text-xs text-slate-500 mt-2">Game: {gameId}</div>
    </div>
  );
}