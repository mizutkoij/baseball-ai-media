"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Trophy, Users, TrendingUp } from "lucide-react";

interface SeasonPageProps {
  params: {
    year: string;
  };
}

// Static data for season metadata - can be enhanced with actual data later
const seasonData: Record<string, { title: string; description: string; highlight: string }> = {
  "2025": { title: "2025年シーズン", description: "2025年シーズン進行中", highlight: "現在進行中" },
  "2024": { title: "2024年シーズン", description: "巨人 vs ソフトバンク日本シリーズ", highlight: "日本シリーズ" },
  "2023": { title: "2023年シーズン", description: "阪神38年ぶりリーグ優勝", highlight: "阪神優勝" },
  "2022": { title: "2022年シーズン", description: "ヤクルト連覇達成", highlight: "ヤクルト連覇" },
  "2021": { title: "2021年シーズン", description: "ヤクルト20年ぶり日本一", highlight: "ヤクルト日本一" },
  "2020": { title: "2020年シーズン", description: "コロナ禍短縮シーズン", highlight: "短縮シーズン" },
  "2019": { title: "2019年シーズン", description: "巨人岩隈・丸獲得", highlight: "FA戦線活発" },
  "2018": { title: "2018年シーズン", description: "広島3連覇・西武日本一", highlight: "広島3連覇" },
  "2017": { title: "2017年シーズン", description: "侍ジャパンWBC準決勝", highlight: "WBC開催" },
  "2016": { title: "2016年シーズン", description: "広島25年ぶりリーグ優勝", highlight: "広島優勝" },
};

export default function SeasonPage({ params }: SeasonPageProps) {
  const year = parseInt(params.year);
  const season = seasonData[params.year];

  useEffect(() => {
    // Track page view
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'season_page_view', {
        year: year,
        event_category: 'navigation',
        event_label: 'season_detail'
      });
    }
  }, [year]);

  if (!season) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-4">シーズンデータが見つかりません</h1>
            <p className="text-slate-300 mb-6">
              {year}年のシーズンデータが存在しないか、準備中です。
            </p>
            <Link
              href="/seasons"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              シーズン一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/seasons"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            シーズン一覧に戻る
          </Link>
        </div>

        {/* Season Header */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Calendar className="w-10 h-10 text-amber-500" />
            <div>
              <h1 className="text-4xl font-bold text-white">{season.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
                  {season.highlight}
                </span>
                <span className="text-slate-400">{year >= 2019 ? 'データ充実' : '基本データ'}</span>
              </div>
            </div>
          </div>
          <p className="text-lg text-slate-300">{season.description}</p>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            href={`/teams?year=${year}`}
            className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-6 h-6 text-blue-500" />
              <h3 className="font-semibold text-white group-hover:text-blue-400">チーム成績</h3>
            </div>
            <p className="text-sm text-slate-300">12球団の詳細データ</p>
          </Link>

          <Link
            href={`/players?year=${year}`}
            className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <h3 className="font-semibold text-white group-hover:text-yellow-400">個人タイトル</h3>
            </div>
            <p className="text-sm text-slate-300">打撃・投手部門</p>
          </Link>

          <Link
            href={`/records?year=${year}`}
            className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <h3 className="font-semibold text-white group-hover:text-green-400">記録・ランキング</h3>
            </div>
            <p className="text-sm text-slate-300">年度別記録一覧</p>
          </Link>

          <Link
            href="/rankings"
            className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 hover:bg-black/30 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-6 h-6 text-purple-500" />
              <h3 className="font-semibold text-white group-hover:text-purple-400">指標分析</h3>
            </div>
            <p className="text-sm text-slate-300">wRC+/ERA-等</p>
          </Link>
        </div>

        {/* Team Links Grid */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-6">チーム別データ</h2>
          
          {/* Central League */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-slate-300 mb-4">セントラル・リーグ</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { code: 'G', name: '読売ジャイアンツ' },
                { code: 'T', name: '阪神タイガース' },
                { code: 'YS', name: '横浜DeNAベイスターズ' },
                { code: 'C', name: '広島東洋カープ' },
                { code: 'S', name: '東京ヤクルトスワローズ' },
                { code: 'D', name: '中日ドラゴンズ' },
              ].map((team) => (
                <Link
                  key={team.code}
                  href={`/teams/${year}/${team.code}`}
                  className="bg-slate-800/50 rounded-lg p-4 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="font-medium text-white">{team.name}</div>
                  <div className="text-sm text-slate-400">{year}年データを見る</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Pacific League */}
          <div>
            <h3 className="text-lg font-medium text-slate-300 mb-4">パシフィック・リーグ</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { code: 'H', name: 'ソフトバンクホークス' },
                { code: 'L', name: '埼玉西武ライオンズ' },
                { code: 'E', name: '東北楽天ゴールデンイーグルス' },
                { code: 'M', name: '千葉ロッテマリーンズ' },
                { code: 'F', name: '北海道日本ハムファイターズ' },
                { code: 'B', name: 'オリックス・バファローズ' },
              ].map((team) => (
                <Link
                  key={team.code}
                  href={`/teams/${year}/${team.code}`}
                  className="bg-slate-800/50 rounded-lg p-4 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="font-medium text-white">{team.name}</div>
                  <div className="text-sm text-slate-400">{year}年データを見る</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-400 text-center space-y-1">
          <p>※ セイバーメトリクス指標はリーグ平均100、パーク調整済みです</p>
          <p>※ {year >= 2019 ? '詳細データ対応年度' : '基本データのみ対応年度'}</p>
        </div>
      </div>
    </div>
  );
}

// Enable ISR with 24-hour revalidation
export const revalidate = 60 * 60 * 24; // 24 hours

// Generate static params for all years
export async function generateStaticParams() {
  const YEARS = Array.from({ length: 2025 - 2016 + 1 }, (_, i) => 2016 + i);
  return YEARS.map((year) => ({ year: year.toString() }));
}