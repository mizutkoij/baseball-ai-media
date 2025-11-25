"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, Trophy, BarChart3, TrendingUp } from "lucide-react";

const SEASONS = [
  { year: 2025, status: "現在", description: "2025年シーズン進行中" },
  { year: 2024, status: "完了", description: "巨人 vs ソフトバンク日本シリーズ" },
  { year: 2023, status: "完了", description: "阪神38年ぶりリーグ優勝" },
  { year: 2022, status: "完了", description: "ヤクルト連覇達成" },
  { year: 2021, status: "完了", description: "ヤクルト20年ぶり日本一" },
  { year: 2020, status: "完了", description: "コロナ禍短縮シーズン" },
  { year: 2019, status: "完了", description: "巨人岩隈・丸獲得" },
  { year: 2018, status: "完了", description: "広島3連覇・西武日本一" },
  { year: 2017, status: "完了", description: "侍ジャパンWBC準決勝" },
  { year: 2016, status: "完了", description: "広島25年ぶりリーグ優勝" },
];

export default function SeasonsIndexPage() {
  const handleTileClick = (year: number) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'season_index_click', {
        year: year,
        event_category: 'navigation',
        event_label: 'seasons_overview'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
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
            <Calendar className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-bold text-white">シーズン一覧</h1>
          </div>
          
          <p className="text-lg text-slate-300 max-w-3xl">
            NPB各年度のシーズン総括ページです。順位表、主要指標、個人タイトル争いを年度別に確認できます。
            セイバーメトリクス指標（wRC+、ERA-、パークファクター）による客観的分析を提供しています。
          </p>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <h3 className="text-lg font-semibold text-white">データ範囲</h3>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-white">2016-2025</div>
              <div className="text-sm text-slate-300">10年間のシーズンデータ</div>
            </div>
          </div>

          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              <h3 className="text-lg font-semibold text-white">分析指標</h3>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-white">wRC+/ERA-</div>
              <div className="text-sm text-slate-300">パーク調整済み相対評価</div>
            </div>
          </div>

          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <h3 className="text-lg font-semibold text-white">更新頻度</h3>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-white">月次更新</div>
              <div className="text-sm text-slate-300">自動バックフィル対応</div>
            </div>
          </div>
        </div>

        {/* Season Tiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SEASONS.map((season) => (
            <Link
              key={season.year}
              href={`/seasons/${season.year}`}
              onClick={() => handleTileClick(season.year)}
              className="group bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 hover:border-white/20 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white group-hover:text-amber-400 transition-colors">
                    {season.year}年
                  </h2>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium mt-2 ${
                    season.status === "現在" 
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}>
                    {season.status}
                  </span>
                </div>
                <div className="opacity-60 group-hover:opacity-100 transition-opacity">
                  <Calendar className="w-6 h-6 text-slate-400" />
                </div>
              </div>

              <p className="text-slate-300 text-sm mb-4 line-clamp-2">
                {season.description}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="text-xs text-slate-400">
                  順位・指標・タイトル
                </div>
                <div className="text-sm text-amber-400 font-medium group-hover:text-amber-300">
                  詳細を見る →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Navigation Hints */}
        <div className="mt-12 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">シーズンページの見方</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-white mb-2">📊 順位表</h4>
              <p className="text-sm text-slate-300">各チームの成績とwRC+/ERA-による相対評価を表示</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">🏆 個人タイトル</h4>
              <p className="text-sm text-slate-300">打撃・投手部門の主要タイトル争い状況</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">⚾ パークファクター</h4>
              <p className="text-sm text-slate-300">球場特性を数値化した補正係数</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">📈 セイバーメトリクス</h4>
              <p className="text-sm text-slate-300">wRC+、ERA-等の現代的指標による分析</p>
            </div>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/players"
            className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-all text-center"
          >
            <div className="text-blue-400 font-medium">選手データベース</div>
            <div className="text-xs text-slate-400 mt-1">個人成績を詳細分析</div>
          </Link>
          
          <Link
            href="/records"
            className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-all text-center"
          >
            <div className="text-yellow-400 font-medium">歴代記録</div>
            <div className="text-xs text-slate-400 mt-1">通算・年度別記録</div>
          </Link>
          
          <Link
            href="/rankings"
            className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-all text-center"
          >
            <div className="text-green-400 font-medium">年度別ランキング</div>
            <div className="text-xs text-slate-400 mt-1">指標別リーダーボード</div>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 text-xs text-slate-400 text-center space-y-1">
          <p>※ wRC+ = 得点創出貢献度（リーグ平均100、パーク調整済み）</p>
          <p>※ ERA- = 防御率指標（リーグ平均100、低いほど優秀、パーク調整済み）</p>
          <p>※ データは月次で自動更新されます</p>
        </div>
      </div>
    </div>
  );
}