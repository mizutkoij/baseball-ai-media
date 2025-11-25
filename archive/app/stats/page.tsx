import Link from "next/link";
import { ArrowLeft, TrendingUp, BarChart3, Database, Activity, Calendar, Target } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: 'NPB統計ハブ | Baseball AI Media',
  description: 'NPBの包括的統計分析ハブ。選手データベース、セイバーメトリクス、高度分析、シーズン統計を一元化。',
  keywords: 'NPB, 統計, セイバーメトリクス, 野球分析, データベース, wRC+, ERA-, FIP',
  openGraph: {
    title: 'NPB統計ハブ',
    description: 'NPBの包括的統計分析ハブ',
    type: 'website',
    locale: 'ja_JP',
  },
};

export const dynamic = 'force-dynamic';

export default function StatsHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            ホームに戻る
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-8 h-8 text-blue-500" />
            <h1 className="text-4xl font-bold text-white">NPB統計ハブ</h1>
          </div>
          
          <p className="text-lg text-slate-300 max-w-4xl">
            NPBの包括的統計分析の中心地です。選手データベース、セイバーメトリクス、高度分析、シーズン統計まで、
            すべての数値データと分析ツールを一元化。データ駆動型の野球分析をサポートします。
          </p>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">850+</div>
            <div className="text-sm text-slate-400">選手データ</div>
          </div>
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">47+</div>
            <div className="text-sm text-slate-400">統計指標</div>
          </div>
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">10年</div>
            <div className="text-sm text-slate-400">データ範囲</div>
          </div>
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">リアルタイム</div>
            <div className="text-sm text-slate-400">データ更新</div>
          </div>
        </div>

        {/* Main Statistics Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Player Database */}
          <Link
            href="/stats/database"
            className="group bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 hover:border-blue-500/50 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                <Database className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white">選手データベース</h3>
            </div>
            <p className="text-slate-300 mb-4">
              MLB・NPB・KBO全2,480選手の包括的データベース。フィルタリング、検索、詳細統計を提供。
            </p>
            <div className="flex items-center gap-2 text-sm text-blue-400 font-medium">
              <span>データベースを探索</span>
              <span>→</span>
            </div>
          </Link>

          {/* Sabermetrics */}
          <Link
            href="/stats/sabermetrics"
            className="group bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 hover:border-purple-500/50 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                <Target className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white">セイバーメトリクス</h3>
            </div>
            <p className="text-slate-300 mb-4">
              wOBA、FIP、wRC+などの高度統計指標。NPB・MLB比較分析と詳細な指標解説を提供。
            </p>
            <div className="flex items-center gap-2 text-sm text-purple-400 font-medium">
              <span>指標を分析</span>
              <span>→</span>
            </div>
          </Link>

          {/* Advanced Analytics */}
          <Link
            href="/stats/analytics"
            className="group bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 hover:border-green-500/50 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                <Activity className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white">高度分析</h3>
            </div>
            <p className="text-slate-300 mb-4">
              137名の詳細分析、試合分析ダッシュボード、リアルタイム監視システム。AI洞察も提供。
            </p>
            <div className="flex items-center gap-2 text-sm text-green-400 font-medium">
              <span>分析を開始</span>
              <span>→</span>
            </div>
          </Link>

          {/* Season Statistics */}
          <Link
            href="/stats/seasons"
            className="group bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 hover:border-amber-500/50 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
                <Calendar className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">シーズン統計</h3>
            </div>
            <p className="text-slate-300 mb-4">
              2016-2025年の10年間データ。年度別順位表、個人タイトル争い、パークファクター分析。
            </p>
            <div className="flex items-center gap-2 text-sm text-amber-400 font-medium">
              <span>シーズン選択</span>
              <span>→</span>
            </div>
          </Link>

          {/* Data Visualization */}
          <Link
            href="/stats/data"
            className="group bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 hover:border-cyan-500/50 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-colors">
                <BarChart3 className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white">データ可視化</h3>
            </div>
            <p className="text-slate-300 mb-4">
              収集された野球データの可視化ダッシュボード。チーム別ロスター、試合結果、選手統計。
            </p>
            <div className="flex items-center gap-2 text-sm text-cyan-400 font-medium">
              <span>ダッシュボード</span>
              <span>→</span>
            </div>
          </Link>

          {/* Quick Links */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">クイックアクセス</h3>
            <div className="space-y-3">
              <Link
                href="/rankings"
                className="block text-blue-400 hover:text-blue-300 transition-colors text-sm"
              >
                📈 現在のリーダーボード
              </Link>
              <Link
                href="/standings"
                className="block text-blue-400 hover:text-blue-300 transition-colors text-sm"
              >
                🏆 最新順位表
              </Link>
              <Link
                href="/players/compare"
                className="block text-blue-400 hover:text-blue-300 transition-colors text-sm"
              >
                ⚖️ 選手比較ツール
              </Link>
              <Link
                href="/teams/compare"
                className="block text-blue-400 hover:text-blue-300 transition-colors text-sm"
              >
                🆚 チーム比較分析
              </Link>
            </div>
          </div>
        </div>

        {/* Statistics Explanation */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">主要統計指標について</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-blue-400 mb-1">wRC+</h4>
              <p className="text-slate-300">打撃総合指標。リーグ平均100、パーク調整済み</p>
            </div>
            <div>
              <h4 className="font-medium text-purple-400 mb-1">ERA-</h4>
              <p className="text-slate-300">投手総合指標。リーグ平均100、小さいほど優秀</p>
            </div>
            <div>
              <h4 className="font-medium text-green-400 mb-1">FIP</h4>
              <p className="text-slate-300">守備に依存しない投手評価（K、BB、HR）</p>
            </div>
            <div>
              <h4 className="font-medium text-amber-400 mb-1">wOBA</h4>
              <p className="text-slate-300">各打撃結果を価値で重み付けした出塁率</p>
            </div>
            <div>
              <h4 className="font-medium text-cyan-400 mb-1">OPS+</h4>
              <p className="text-slate-300">出塁率+長打率のパーク・リーグ調整版</p>
            </div>
            <div>
              <h4 className="font-medium text-red-400 mb-1">BABIP</h4>
              <p className="text-slate-300">インプレーボールでの打率、運要素の評価</p>
            </div>
          </div>
        </div>

        {/* Data Sources */}
        <div className="text-center text-xs text-slate-400 space-y-1">
          <p>※ データソース: NPB公式、BaseballData.jp、MLB公式統計</p>
          <p>※ 更新頻度: リアルタイム（試合中）、日次（選手統計）、月次（歴史データ）</p>
          <p>※ 最終更新: {new Date().toLocaleString('ja-JP')}</p>
        </div>
      </div>
    </div>
  );
}