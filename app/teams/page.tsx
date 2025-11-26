"use client";

import React from "react";
import Link from "next/link";
import Head from "next/head";
import { Calendar, Users, TrendingUp } from "lucide-react";

export default function TeamsPage() {
  // 利用可能な年度（実際にはディレクトリスキャンか静的データから取得）
  const availableYears = [2025, 2024, 2023, 2022, 2021, 2020];
  const currentYear = new Date().getFullYear();

  // SEO最適化メタデータ (20-24語目安)
  const title = "NPBチーム一覧｜2020-2025年全6年度12球団の所属選手・成績・Park Factors分析【Baseball AI Media】";
  const description = "NPB12球団の年度別所属選手データベース。2020-2025年の全6年度対応。各チームの成績・順位・球場補正係数・主力選手を完全網羅。セイバーメトリクス指標による詳細分析。";

  return (
    <React.Fragment>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content="NPB,チーム,所属選手,年度別,成績,順位,球場補正,Park Factors,セイバーメトリクス,12球団" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${typeof window !== 'undefined' ? window.location.origin : ''}/teams`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        
        {/* JSON-LD構造化データ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              "name": "NPBチーム一覧",
              "description": description,
              "url": `${typeof window !== 'undefined' ? window.location.origin : ''}/teams`,
              "creator": {
                "@type": "Organization",
                "name": "Baseball AI Media"
              },
              "about": {
                "@type": "SportsOrganization",
                "name": "NPB (日本プロ野球機構)"
              },
              "mainEntity": {
                "@type": "ItemList",
                "name": "NPB年度別チームデータ",
                "numberOfItems": availableYears.length,
                "itemListElement": availableYears.map((year, index) => ({
                  "@type": "ListItem",
                  "position": index + 1,
                  "name": `${year}年NPBチーム`,
                  "url": `${typeof window !== 'undefined' ? window.location.origin : ''}/teams/${year}`
                }))
              },
              "keywords": ["NPB", "チーム", "年度別", "所属選手", "成績", "セイバーメトリクス"],
              "dateModified": new Date().toISOString().split('T')[0]
            })
          }}
        />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Calendar className="w-8 h-8 text-blue-400" />
            年度別チーム所属選手
          </h1>
          <p className="text-slate-300">
            NPB各年度のチーム別所属選手を確認できます
          </p>
        </div>

        {/* Year Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableYears.map((year) => (
            <Link
              key={year}
              href={`/teams/${year}`}
              className="group block"
            >
              <div className="bg-black/20 backdrop-blur-md border border-white/10 hover:border-blue-400/50 rounded-lg p-6 transition-all duration-200 hover:bg-black/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                    {year}年
                  </h3>
                  {year === currentYear && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                      最新
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-slate-300 mb-4">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">12球団・選手データ</span>
                </div>

                <div className="text-sm text-slate-400">
                  チーム別所属選手を確認 →
                </div>
                
                <div className="mt-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-blue-400">詳細を見る</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info */}
        <div className="mt-12 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">利用方法</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-300">
            <div>
              <h4 className="font-medium text-white mb-2">📅 年度選択</h4>
              <p>上記から確認したい年度を選択してください。各年度のチーム別所属選手データが表示されます。</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">⚾ チーム情報</h4>
              <p>各チームの投手・野手・現役選手数の統計情報と、選手一覧（選手詳細ページへリンク）が確認できます。</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">🔍 フィルター機能</h4>
              <p>現役選手のみの表示や、投手・野手別の絞り込みが可能です。</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">📊 データソース</h4>
              <p>NPB公式データに基づく年度別所属情報です。移籍や引退の情報も反映されています。</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </React.Fragment>
  );
}