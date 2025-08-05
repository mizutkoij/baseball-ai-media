import WarLeadersContainer from "@/components/WarLeadersContainer";
import MatchupPreviewCard from "@/components/MatchupPreviewCard";
import BasicBanner from "@/components/BasicBanner";
import DataStatus from "@/components/DataStatus";
import TodayGamesBar from "@/components/TodayGamesBar";
import StatsGlossary from "@/components/StatsGlossary";
import GameOfTheDay from "@/components/GameOfTheDay";
import LatestBrief, { LatestBriefStatic } from "@/components/LatestBrief";
import { SeasonDiscovery } from "@/components/SeasonDiscovery";
import HomeScoreboard from "@/components/HomeScoreboard";
import HomeGamesList from "@/components/HomeGamesList";
import TeamComparisonPresets from "@/components/TeamComparisonPresets";
import LeagueStandings from "@/components/LeagueStandings";
import HomeComparePresets from "@/components/HomeComparePresets";
import DailyHighlights from "@/components/DailyHighlights";
import TodayHighlightsFixed from "@/components/TodayHighlightsFixed";
import Link from "next/link";
import { Suspense } from "react";
import { TrendingUp, Target, BarChart3, Zap } from "lucide-react";
import CTAButtons from "@/components/CTAButtons";
import { currentSeasonYear } from "@/lib/time";

// Force dynamic rendering to prevent build-time API calls
export const dynamic = 'force-dynamic';

// API データ取得関数（ビルド時はスキップ）
async function fetchWarLeaders() {
  // ビルド時（API使用不可）はスキップ
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_BASE_URL) {
    console.log('Skipping WAR leaders fetch during build');
    return [];
  }

  try {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
    if (!api || api === 'undefined' || api.includes('localhost') && process.env.NODE_ENV === 'production') {
      throw new Error('API base URL not configured for production');
    }
    
    const res = await fetch(`${api}/war-leaders?limit=15`, { 
      next: { revalidate: 300 } // 5分キャッシュ
    });
    
    if (!res.ok) {
      throw new Error(`WAR Leaders API failed: ${res.status}`);
    }
    
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch WAR leaders:', error);
    return [];
  }
}

async function fetchMatchupPreview() {
  // ビルド時（API使用不可）はスキップ
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_BASE_URL) {
    console.log('Skipping matchup preview fetch during build');
    return [];
  }

  try {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
    if (!api || api === 'undefined' || api.includes('localhost') && process.env.NODE_ENV === 'production') {
      throw new Error('API base URL not configured for production');
    }
    
    const res = await fetch(`${api}/matchup-preview`, { 
      next: { revalidate: 300 } // 5分キャッシュ
    });
    
    if (!res.ok) {
      throw new Error(`Matchup Preview API failed: ${res.status}`);
    }
    
    const data = await res.json();
    return data.games || [];
  } catch (error) {
    console.error('Failed to fetch matchup preview:', error);
    return [];
  }
}

// ローディングコンポーネント
function LoadingCard({ title }: { title: string }) {
  return (
    <div className="card animate-pulse">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-4 bg-white/10 rounded w-1/3"></div>
            <div className="h-4 bg-white/10 rounded w-1/6"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 統計カード
function StatsOverview() {
  const stats = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      label: "WAR Leaders",
      value: "中立化指標",
      description: "球場補正適用"
    },
    {
      icon: <Target className="w-6 h-6" />,
      label: "Matchup Analysis", 
      value: "プラトーン効果",
      description: "対戦相性分析"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      label: "Park Factors",
      value: "12球場環境",
      description: "補正係数適用"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      label: "Real-time",
      value: "AI予測",
      description: "WP・RE分析"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, index) => (
        <div 
          key={stat.label} 
          className={`stat-card animate-fade-in animation-delay-${index * 150}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-blue-400">
              {stat.icon}
            </div>
            <span className="text-xs text-slate-400">LIVE</span>
          </div>
          <h3 className="font-semibold text-sm mb-1">{stat.label}</h3>
          <p className="text-lg font-bold text-gradient">{stat.value}</p>
          <p className="text-xs text-slate-400">{stat.description}</p>
        </div>
      ))}
    </div>
  );
}

export default async function Home() {
  // データ並行取得
  const [leaders, preview] = await Promise.all([
    fetchWarLeaders(),
    fetchMatchupPreview()
  ]);

  return (
    <main className="min-h-screen">
      {/* Today Games Bar - Fixed Top */}
      <TodayGamesBar />
      
      {/* Basic Mode Banner */}
      <BasicBanner />
      
      {/* Data Status */}
      <DataStatus />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-baseball-gradient opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 animate-fade-in">
              <span className="text-gradient">NPB AI Analytics</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto animate-fade-in animation-delay-150">
              <strong>完全独立のNPBセイバーメトリクス基盤</strong>を実現。
              自前推定の係数・定数による高精度な統計分析で、第三者データベースとは一線を画す独自の洞察を提供。
              透明性保証・学術準拠の分析手法により、真のデータドリブン野球観戦をサポートします。
              <br />
              日本プロ野球の新しい分析体験
            </p>
            
            {/* 3-Button Navigation */}
            <CTAButtons />
          </div>
          
          {/* Stats Overview */}
          <StatsOverview />
        </div>
      </section>

      {/* Today's Highlights - P1 Fixed Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TodayHighlightsFixed />
      </section>

      {/* Daily Highlights - Additional Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DailyHighlights />
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Home Scoreboard - Always Visible */}
        <div className="mb-8 animate-slide-up">
          <HomeScoreboard />
        </div>

        {/* Home Games List - Weekly Overview */}
        <div className="mb-8 animate-slide-up animation-delay-75">
          <HomeGamesList />
        </div>

        {/* Home Compare Presets - New Feature */}
        <div className="mb-8 animate-slide-up animation-delay-100">
          <HomeComparePresets />
        </div>

        {/* Game of the Day - Featured Section */}
        <div className="mb-8 animate-slide-up animation-delay-150">
          <GameOfTheDay />
        </div>

        {/* Latest Brief Section */}
        <div className="mb-12 animate-slide-up animation-delay-150">
          <Suspense fallback={<LatestBriefStatic />}>
            <LatestBrief />
          </Suspense>
        </div>

        {/* NPB Stats & Data Section */}
        <div className="mb-12 animate-slide-up animation-delay-200">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">NPB詳細データ & 統計</h2>
              <p className="text-slate-600">最新の順位表、選手成績、試合データをリアルタイムで確認</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                href="/standings" 
                className="group bg-white rounded-lg shadow-md hover:shadow-lg transition-all p-6 border-l-4 border-yellow-500"
              >
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp className="w-8 h-8 text-yellow-600" />
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                    NEW
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2 group-hover:text-yellow-600 transition-colors">
                  順位表
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  セ・パ両リーグの最新順位、勝率、ゲーム差を確認
                </p>
                <div className="text-xs text-slate-500">
                  リアルタイム更新 • プレーオフ進出圏表示
                </div>
              </Link>

              <Link 
                href="/stats" 
                className="group bg-white rounded-lg shadow-md hover:shadow-lg transition-all p-6 border-l-4 border-blue-500"
              >
                <div className="flex items-center justify-between mb-3">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                    NEW
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                  選手成績
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  打者・投手の詳細成績ランキング
                </p>
                <div className="text-xs text-slate-500">
                  打率・本塁打・防御率 • 詳細統計
                </div>
              </Link>

              <Link 
                href="/schedule" 
                className="group bg-white rounded-lg shadow-md hover:shadow-lg transition-all p-6 border-l-4 border-green-500"
              >
                <div className="flex items-center justify-between mb-3">
                  <Target className="w-8 h-8 text-green-600" />
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                    更新
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2 group-hover:text-green-600 transition-colors">
                  試合日程
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  今後の試合予定と結果を詳細表示
                </p>
                <div className="text-xs text-slate-500">
                  詳細スコア • 会場情報 • 開始時間
                </div>
              </Link>

              <div className="group bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500 opacity-75">
                <div className="flex items-center justify-between mb-3">
                  <Zap className="w-8 h-8 text-purple-600" />
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
                    準備中
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">
                  試合詳細
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  イニング別スコア、ボックススコア
                </p>
                <div className="text-xs text-slate-500">
                  詳細統計 • プレイバイプレイ
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* WAR Leaders Card */}
          <div className="animate-slide-up animation-delay-300">
            <WarLeadersContainer />
          </div>

          {/* Matchup Preview Card */}
          <div className="animate-slide-up animation-delay-450">
            <Suspense fallback={<LoadingCard title="今日の見どころ" />}>
              <MatchupPreviewCard data={preview} />
            </Suspense>
          </div>
        </div>

        {/* Stats Glossary Section */}
        <div className="mt-12 mb-8">
          <StatsGlossary compact={true} />
        </div>

        {/* League Standings */}
        <div className="mt-12 animate-slide-up animation-delay-600">
          <LeagueStandings year={currentSeasonYear()} compact={true} />
        </div>

        {/* Team Comparison Presets */}
        <div className="mt-12 animate-slide-up animation-delay-750">
          <TeamComparisonPresets location="home" />
        </div>

        {/* Season Discovery Section */}
        <div className="mt-8 animate-slide-up animation-delay-900">
          <SeasonDiscovery location="home" />
        </div>

        {/* 추가 섹션 */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* AI コラム予告 */}
          <div className="card animate-slide-up animation-delay-300">
            <h3 className="font-bold mb-3 flex items-center">
              🤖 AI Generated Column
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              今日の試合前・試合後の自動生成コラムをお届けします
            </p>
            <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              コラム一覧 →
            </button>
          </div>

          {/* リアルタイム予告 */}
          <div className="card animate-slide-up animation-delay-450">
            <h3 className="font-bold mb-3 flex items-center">
              ⚡ Real-time Analysis
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              試合中のWP（勝利確率）・RE（得点期待値）をリアルタイム分析
            </p>
            <div className="flex items-center text-xs text-slate-500">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
              Phase 7C 準備中
            </div>
          </div>

          {/* データソース情報 */}
          <div className="card animate-slide-up animation-delay-[600ms]">
            <h3 className="font-bold mb-3 flex items-center">
              📊 独自データ
            </h3>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• NPB公式サイト（公開統計のみ）</li>
              <li>• 自前算出指標（wOBA, FIP等）</li>
              <li>• 透明性保証（式・係数を公開）</li>
              <li className="text-xs text-slate-500">第三者DB複製なし</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}