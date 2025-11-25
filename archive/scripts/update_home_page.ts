#!/usr/bin/env tsx
/**
 * update_home_page.ts - ホームページから重複する試合情報表示を削除・整理
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('📋 Updating home page layout...');

// サーバー上での実行を想定
const pagePath = '/home/mizu/baseball-ai-media/app/page.tsx';

// 新しいホームページの内容（TodayGamesBarを削除し、試合情報を統合）
const newPageContent = `import WarLeadersContainer from "@/components/WarLeadersContainer";
import MatchupPreviewCard from "@/components/MatchupPreviewCard";
import BasicBanner from "@/components/BasicBanner";
import DataStatus from "@/components/DataStatus";
// TodayGamesBar を削除 - ポップアップ風で邪魔なので
// import TodayGamesBar from "@/components/TodayGamesBar";
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
    
    const res = await fetch(\`\${api}/war-leaders?limit=15\`, { 
      next: { revalidate: 300 } // 5分キャッシュ
    });
    
    if (!res.ok) {
      throw new Error(\`WAR Leaders API failed: \${res.status}\`);
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
    
    const res = await fetch(\`\${api}/matchup-preview\`, { 
      next: { revalidate: 300 } // 5分キャッシュ
    });
    
    if (!res.ok) {
      throw new Error(\`Matchup Preview API failed: \${res.status}\`);
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

export default async function HomePage() {
  const warLeaders = await fetchWarLeaders();
  const matchupPreview = await fetchMatchupPreview();

  return (
    <main className="min-h-screen">
      {/* BasicBannerは残すが、TodayGamesBarは削除 */}
      <BasicBanner />
      
      {/* メインコンテンツ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-baseball-gradient opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* ヒーローセクション */}
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 animate-fade-in">
              <span className="text-gradient">NPB AI Analytics</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto animate-fade-in animation-delay-150">
              <strong>完全独立のNPBセイバーメトリクス基盤</strong>を実現。 
              自前推定の係数・定数による高精度な統計分析で、第三者データベースとは一線を画す独自の洞察を提供。 
              透明性保証・学術準拠の分析手法により、真のデータドリブン野球観戦をサポートします。<br/>
              日本プロ野球の新しい分析体験
            </p>
            <CTAButtons />
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="stat-card animate-fade-in animation-delay-0">
              <div className="flex items-center justify-between mb-2">
                <div className="text-blue-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="text-xs text-slate-400">LIVE</span>
              </div>
              <h3 className="font-semibold text-sm mb-1">WAR Leaders</h3>
              <p className="text-lg font-bold text-gradient">中立化指標</p>
              <p className="text-xs text-slate-400">球場補正適用</p>
            </div>
            
            <div className="stat-card animate-fade-in animation-delay-150">
              <div className="flex items-center justify-between mb-2">
                <div className="text-blue-400">
                  <Target className="w-6 h-6" />
                </div>
                <span className="text-xs text-slate-400">LIVE</span>
              </div>
              <h3 className="font-semibold text-sm mb-1">Matchup Analysis</h3>
              <p className="text-lg font-bold text-gradient">プラトーン効果</p>
              <p className="text-xs text-slate-400">対戦相性分析</p>
            </div>
            
            <div className="stat-card animate-fade-in animation-delay-300">
              <div className="flex items-center justify-between mb-2">
                <div className="text-blue-400">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="text-xs text-slate-400">LIVE</span>
              </div>
              <h3 className="font-semibold text-sm mb-1">Park Factors</h3>
              <p className="text-lg font-bold text-gradient">12球場環境</p>
              <p className="text-xs text-slate-400">補正係数適用</p>
            </div>
            
            <div className="stat-card animate-fade-in animation-delay-450">
              <div className="flex items-center justify-between mb-2">
                <div className="text-blue-400">
                  <Zap className="w-6 h-6" />
                </div>
                <span className="text-xs text-slate-400">LIVE</span>
              </div>
              <h3 className="font-semibold text-sm mb-1">Real-time</h3>
              <p className="text-lg font-bold text-gradient">AI予測</p>
              <p className="text-xs text-slate-400">WP・RE分析</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* 今日の見どころセクション */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TodayHighlightsFixed />
      </section>
      
      {/* デイリーハイライトセクション */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DailyHighlights />
      </section>

      {/* コンテンツセクション */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 今日の試合 - 一つに統合 */}
        <div className="mb-8 animate-slide-up">
          <HomeGamesList />
        </div>

        {/* 今週の全試合 */}
        <div className="mb-8 animate-slide-up animation-delay-75">
          <HomeScoreboard />
        </div>

        {/* チーム比較プリセット */}
        <div className="mb-8 animate-slide-up animation-delay-100">
          <HomeComparePresets />
        </div>

        {/* 今日の注目試合 */}
        <div className="mb-8 animate-slide-up animation-delay-150">
          <Suspense fallback={<LoadingCard title="今日の注目試合" />}>
            <GameOfTheDay />
          </Suspense>
        </div>

        {/* デイリーブリーフ */}
        <div className="mb-12 animate-slide-up animation-delay-150">
          <Suspense fallback={<div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 backdrop-blur-md border border-yellow-500/30 rounded-lg p-6 animate-pulse"><div className="h-6 bg-yellow-500/20 rounded mb-4"></div><div className="h-4 bg-yellow-500/20 rounded"></div></div>}>
            <LatestBrief />
          </Suspense>
        </div>

        {/* NPBデータ&統計セクション */}
        <div className="mb-12 animate-slide-up animation-delay-200">
          <LeagueStandings />
        </div>
      </section>

      {/* フッター的な情報セクション */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SeasonDiscovery location="home" />
      </section>
    </main>
  );
}`;

console.log('✅ Created new home page content without TodayGamesBar');
console.log('📁 Ready to deploy to remote server');

// ファイルに書き込み（ローカル用）
const localPagePath = join(process.cwd(), 'scripts', 'new_home_page.tsx');
writeFileSync(localPagePath, newPageContent);
console.log('💾 Saved new home page to:', localPagePath);