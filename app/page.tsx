import Link from "next/link";
import { TrendingUp, Target, BarChart3, Zap } from "lucide-react";
import TodaysGames from "../components/TodaysGames";

// Force dynamic rendering to prevent build-time API calls
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-6">
            Baseball AI Media
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
            NPBのデータ分析と統計情報を提供する日本語野球サイト
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/standings"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
              順位表を見る
            </Link>
            <Link
              href="/games"
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              <Target className="w-5 h-5" />
              試合情報
            </Link>
            <Link
              href="/rankings"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              <TrendingUp className="w-5 h-5" />
              ランキング
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              <h3 className="text-lg font-semibold text-white">リアルタイム順位表</h3>
            </div>
            <p className="text-slate-400 mb-4">
              セ・リーグ、パ・リーグの最新順位と勝敗記録
            </p>
            <Link href="/standings" className="text-blue-400 hover:text-blue-300 font-medium">
              詳細を見る →
            </Link>
          </div>

          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-purple-500" />
              <h3 className="text-lg font-semibold text-white">試合情報</h3>
            </div>
            <p className="text-slate-400 mb-4">
              スクレイピングデータによる正確な試合結果・スケジュール
            </p>
            <Link href="/games" className="text-purple-400 hover:text-purple-300 font-medium">
              詳細を見る →
            </Link>
          </div>

          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <h3 className="text-lg font-semibold text-white">ランキング</h3>
            </div>
            <p className="text-slate-400 mb-4">
              wRC+・ERA-等主要指標のTOP20
            </p>
            <Link href="/rankings" className="text-green-400 hover:text-green-300 font-medium">
              詳細を見る →
            </Link>
          </div>

          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-yellow-500" />
              <h3 className="text-lg font-semibold text-white">チーム比較</h3>
            </div>
            <p className="text-slate-400 mb-4">
              チーム間の詳細データ比較分析
            </p>
            <Link href="/compare/teams" className="text-yellow-400 hover:text-yellow-300 font-medium">
              詳細を見る →
            </Link>
          </div>

          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold text-white">選手比較</h3>
            </div>
            <p className="text-slate-400 mb-4">
              選手同士の成績・能力値比較
            </p>
            <Link href="/compare/players" className="text-red-400 hover:text-red-300 font-medium">
              詳細を見る →
            </Link>
          </div>

          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-6 h-6 text-cyan-500" />
              <h3 className="text-lg font-semibold text-white">対戦分析</h3>
            </div>
            <p className="text-slate-400 mb-4">
              チーム間H2H成績・直近10試合分析
            </p>
            <Link href="/matchups" className="text-cyan-400 hover:text-cyan-300 font-medium">
              詳細を見る →
            </Link>
          </div>
        </div>

        {/* Today's Games Section - Temporarily disabled to debug 500 error */}
        {/* <TodaysGames /> */}

        {/* Status Message */}
        <div className="text-center text-slate-400 text-sm">
          <p>🚀 NPBスクレイピングデータで動作中</p>
          <p className="mt-2">
            データ更新: {new Date().toLocaleDateString('ja-JP', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} • リアルタイム自動更新
          </p>
        </div>
      </div>
    </div>
  );
}