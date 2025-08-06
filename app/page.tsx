import Link from "next/link";
import { TrendingUp, Target, BarChart3, Zap } from "lucide-react";

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
              href="/schedule"
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              <Target className="w-5 h-5" />
              試合日程
            </Link>
            <Link
              href="/stats"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              <TrendingUp className="w-5 h-5" />
              選手成績
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
              <h3 className="text-lg font-semibold text-white">試合スケジュール</h3>
            </div>
            <p className="text-slate-400 mb-4">
              今日の試合予定と結果、球場情報
            </p>
            <Link href="/schedule" className="text-purple-400 hover:text-purple-300 font-medium">
              詳細を見る →
            </Link>
          </div>

          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <h3 className="text-lg font-semibold text-white">選手統計</h3>
            </div>
            <p className="text-slate-400 mb-4">
              打撃・投手成績とセイバーメトリクス
            </p>
            <Link href="/stats" className="text-green-400 hover:text-green-300 font-medium">
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
              <h3 className="text-lg font-semibold text-white">チーム詳細</h3>
            </div>
            <p className="text-slate-400 mb-4">
              各チームの詳細分析と選手一覧
            </p>
            <Link href="/teams" className="text-cyan-400 hover:text-cyan-300 font-medium">
              詳細を見る →
            </Link>
          </div>
        </div>

        {/* Mock Today's Games Section */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">今日の試合</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
              <div className="text-white">
                <span className="font-medium">阪神タイガース</span> vs <span className="font-medium">読売ジャイアンツ</span>
              </div>
              <div className="text-slate-400">18:00 東京ドーム</div>
            </div>
            <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
              <div className="text-white">
                <span className="font-medium">横浜DeNAベイスターズ</span> vs <span className="font-medium">広島東洋カープ</span>
              </div>
              <div className="text-slate-400">18:00 横浜スタジアム</div>
            </div>
            <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
              <div className="text-white">
                <span className="font-medium">福岡ソフトバンクホークス</span> vs <span className="font-medium">千葉ロッテマリーンズ</span>
              </div>
              <div className="text-slate-400">18:00 PayPayドーム</div>
            </div>
          </div>
          <div className="text-center mt-6">
            <Link href="/schedule" className="text-blue-400 hover:text-blue-300 font-medium">
              すべての試合を見る →
            </Link>
          </div>
        </div>

        {/* Status Message */}
        <div className="text-center text-slate-400 text-sm">
          <p>🤖 Vercel環境で動作中 - モックデータを使用しています</p>
          <p className="mt-2">
            データ更新: {new Date().toLocaleDateString('ja-JP', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>
    </div>
  );
}