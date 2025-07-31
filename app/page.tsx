import WarLeadersContainer from "@/components/WarLeadersContainer";
import MatchupPreviewCard from "@/components/MatchupPreviewCard";
import BasicBanner from "@/components/BasicBanner";
import DataStatus from "@/components/DataStatus";
import TodayGamesBar from "@/components/TodayGamesBar";
import StatsGlossary from "@/components/StatsGlossary";
import { Suspense } from "react";
import { TrendingUp, Target, BarChart3, Zap } from "lucide-react";

// API データ取得関数
async function fetchWarLeaders() {
  try {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL!;
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
  try {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL!;
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
              高度なセイバーメトリクスとAI予測による
              <br />
              日本プロ野球の新しい分析体験
            </p>
            <div className="flex justify-center space-x-4 animate-fade-in animation-delay-300">
              <button className="button-primary">
                📊 今日の分析を見る
              </button>
              <button className="button-secondary">
                ⚾ ランキング
              </button>
            </div>
          </div>
          
          {/* Stats Overview */}
          <StatsOverview />
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* WAR Leaders Card */}
          <div className="animate-slide-up">
            <WarLeadersContainer />
          </div>

          {/* Matchup Preview Card */}
          <div className="animate-slide-up animation-delay-150">
            <Suspense fallback={<LoadingCard title="今日の見どころ" />}>
              <MatchupPreviewCard data={preview} />
            </Suspense>
          </div>
        </div>

        {/* Stats Glossary Section */}
        <div className="mt-12 mb-8">
          <StatsGlossary compact={true} />
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