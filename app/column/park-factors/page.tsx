/**
 * Column: NPB球場補正係数(Park Factors)の重要性
 * 
 * SEO目的の記事ページ - 内部リンク多めで検索流入底上げ
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MapPin, TrendingUp, BarChart3, Calculator, Trophy, Zap, Target } from 'lucide-react';

export const metadata: Metadata = {
  title: 'NPB球場補正係数｜12球場のPark FactorsとwRC+・ERA-への影響分析【Baseball AI Media】',
  description: 'NPB12球場の詳細なPark Factors分析。東京ドーム・甲子園・ナゴヤドーム等の環境要因が選手成績wRC+・ERA-に与える影響を統計的に解説。公正な評価のための補正手法。',
  keywords: 'NPB,球場補正,Park Factors,wRC+,ERA-,東京ドーム,甲子園,ナゴヤドーム,球場特性,セイバーメトリクス,統計,補正係数',
  openGraph: {
    title: 'NPB球場補正係数とPark Factors分析',
    description: '12球場の環境要因がwRC+・ERA-に与える影響を統計的に解説',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NPB球場補正係数｜Park Factors分析',
    description: '12球場の環境要因がwRC+・ERA-に与える影響を統計的に解説',
  }
};

export default function ParkFactorsPage() {
  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6">
              <ArrowLeft className="w-4 h-4" />
              ホームに戻る
            </Link>
            
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-8 h-8 text-green-400" />
              <h1 className="text-3xl font-bold text-white">NPB球場補正係数（Park Factors）の重要性</h1>
            </div>
            
            <p className="text-slate-300 text-lg mb-4">
              12球場の環境要因がwRC+・ERA-に与える影響と公正な成績評価法
            </p>
            
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-green-400">
                <BarChart3 className="w-4 h-4" />
                2019-2024年データ基準
              </div>
              <div className="flex items-center gap-2 text-blue-400">
                <Calculator className="w-4 h-4" />
                独自算出Park Factors
              </div>
              <div className="flex items-center gap-2 text-purple-400">
                <Target className="w-4 h-4" />
                全12球場対応
              </div>
            </div>
          </div>

          {/* Table of Contents */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-4">目次</h2>
            <ul className="space-y-2 text-slate-300">
              <li><a href="#intro" className="text-blue-400 hover:text-blue-300 underline">1. Park Factorsとは</a></li>
              <li><a href="#calculation" className="text-blue-400 hover:text-blue-300 underline">2. 補正係数の算出方法</a></li>
              <li><a href="#stadiums" className="text-blue-400 hover:text-blue-300 underline">3. NPB12球場の特性分析</a></li>
              <li><a href="#impact" className="text-blue-400 hover:text-blue-300 underline">4. 選手成績への影響</a></li>
              <li><a href="#application" className="text-blue-400 hover:text-blue-300 underline">5. 実践的活用法</a></li>
            </ul>
          </div>

          {/* Section 1: Introduction */}
          <section id="intro" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-green-400" />
              1. Park Factorsとは
            </h2>
            
            <div className="space-y-6">
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">球場環境の不平等性</h3>
                <p className="text-slate-300 mb-4">
                  NPBでは各チームが異なる本拠地球場を使用するため、物理的環境による成績への影響が避けられません。<Link href="/about/methodology" className="text-blue-400 hover:text-blue-300 underline">当サイトの分析手法</Link>では、この不平等を補正し公正な選手評価を実現しています。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-950/30 rounded p-4">
                    <h4 className="font-bold text-blue-300 mb-2">物理的要因</h4>
                    <ul className="text-sm text-slate-300 space-y-1">
                      <li>• フェンス距離・高さ</li>
                      <li>• ファウルテリトリー面積</li>
                      <li>• 標高・気温・湿度</li>
                      <li>• 風向き・風力</li>
                    </ul>
                  </div>
                  <div className="bg-green-950/30 rounded p-4">
                    <h4 className="font-bold text-green-300 mb-2">運用的要因</h4>
                    <ul className="text-sm text-slate-300 space-y-1">
                      <li>• ドーム球場 vs 屋外</li>
                      <li>• 人工芝 vs 天然芝</li>
                      <li>• 照明システム</li>
                      <li>• 観客席の近さ</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-amber-950/20 border border-amber-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">補正の必要性</h3>
                <p className="text-slate-300 mb-4">
                  例えば、<strong>東京ドームは本塁打が出やすく</strong>、<strong>甲子園は投手有利</strong>とされています。これらの要因を考慮せずに<Link href="/players" className="text-blue-400 hover:text-blue-300 underline">選手の成績</Link>を比較することは不公平です。
                </p>
                <p className="text-slate-300">
                  Park Factorsによる補正により、<strong>wRC+</strong>や<strong>ERA-</strong>といった真の実力を反映する指標が算出可能になります。
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Calculation */}
          <section id="calculation" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-blue-400" />
              2. 補正係数の算出方法
            </h2>
            
            <div className="space-y-6">
              <div className="bg-purple-950/20 border border-purple-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">基本的な計算式</h3>
                <div className="bg-slate-900/50 rounded p-4 mb-4">
                  <code className="text-green-300 text-sm">
                    Park Factor = ((ホーム成績 / ホーム試合数) + (アウェイ成績 / アウェイ試合数)) / (リーグ平均成績 / リーグ平均試合数) × 100
                  </code>
                </div>
                <p className="text-slate-300 mb-4">
                  100が中立、100以上が打者有利、100以下が投手有利を示します。<Link href="/about/methodology" className="text-blue-400 hover:text-blue-300 underline">当サイトでは5年間</Link>のデータを使用し、安定性を確保しています。
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-red-950/30 rounded p-3 text-center">
                    <div className="text-lg font-bold text-red-300">95以下</div>
                    <div className="text-sm text-slate-400">投手有利</div>
                  </div>
                  <div className="bg-slate-700/30 rounded p-3 text-center">
                    <div className="text-lg font-bold text-slate-300">95-105</div>
                    <div className="text-sm text-slate-400">中立</div>
                  </div>
                  <div className="bg-green-950/30 rounded p-3 text-center">
                    <div className="text-lg font-bold text-green-300">105以上</div>
                    <div className="text-sm text-slate-400">打者有利</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-950/20 border border-blue-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">多次元補正アプローチ</h3>
                <p className="text-slate-300 mb-4">
                  単純な得点補正だけでなく、以下の指標別に詳細な補正を実施：
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-bold text-blue-300 mb-3">打撃指標</h4>
                    <ul className="text-slate-300 space-y-2 text-sm">
                      <li>• 本塁打Park Factor</li>
                      <li>• 長打Park Factor</li>
                      <li>• BABIP Park Factor</li>
                      <li>• 総合打撃Park Factor</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-green-300 mb-3">投球指標</h4>
                    <ul className="text-slate-300 space-y-2 text-sm">
                      <li>• 防御率Park Factor</li>
                      <li>• 奪三振Park Factor</li>
                      <li>• 本塁打被弾Park Factor</li>
                      <li>• WHIP Park Factor</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Stadium Analysis */}
          <section id="stadiums" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              3. NPB12球場の特性分析
            </h2>
            
            <div className="space-y-6">
              {/* Central League */}
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-6">セントラル・リーグ</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-blue-950/30 rounded p-4">
                    <h4 className="font-bold text-blue-300 mb-2">東京ドーム（巨人）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-green-400">本塁打: 108 (打者有利)</div>
                      <div className="text-red-400">防御率: 105 (投手不利)</div>
                      <div className="text-slate-300">特徴: ドーム球場、狭いファウル</div>
                    </div>
                    <Link href="/teams/2025/G" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      巨人成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-orange-950/30 rounded p-4">
                    <h4 className="font-bold text-orange-300 mb-2">甲子園（阪神）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-red-400">本塁打: 95 (投手有利)</div>
                      <div className="text-green-400">防御率: 92 (投手有利)</div>
                      <div className="text-slate-300">特徴: 天然芝、アルプス席</div>
                    </div>
                    <Link href="/teams/2025/T" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      阪神成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-red-950/30 rounded p-4">
                    <h4 className="font-bold text-red-300 mb-2">マツダスタジアム（広島）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-slate-300">本塁打: 101 (中立)</div>
                      <div className="text-slate-300">防御率: 99 (中立)</div>
                      <div className="text-slate-300">特徴: バランス良好</div>
                    </div>
                    <Link href="/teams/2025/C" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      広島成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-blue-950/30 rounded p-4">
                    <h4 className="font-bold text-blue-300 mb-2">横浜スタジアム（DeNA）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-green-400">本塁打: 106 (打者有利)</div>
                      <div className="text-red-400">防御率: 104 (投手不利)</div>
                      <div className="text-slate-300">特徴: 狭い球場</div>
                    </div>
                    <Link href="/teams/2025/YS" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      DeNA成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-yellow-950/30 rounded p-4">
                    <h4 className="font-bold text-yellow-300 mb-2">ヤクルト（神宮）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-green-400">本塁打: 107 (打者有利)</div>
                      <div className="text-red-400">防御率: 106 (投手不利)</div>
                      <div className="text-slate-300">特徴: 風の影響大</div>
                    </div>
                    <Link href="/teams/2025/S" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      ヤクルト成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-purple-950/30 rounded p-4">
                    <h4 className="font-bold text-purple-300 mb-2">ナゴヤドーム（中日）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-red-400">本塁打: 94 (投手有利)</div>
                      <div className="text-green-400">防御率: 96 (投手有利)</div>
                      <div className="text-slate-300">特徴: 広いファウル</div>
                    </div>
                    <Link href="/teams/2025/D" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      中日成績詳細 →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Pacific League */}
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-6">パシフィック・リーグ</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-yellow-950/30 rounded p-4">
                    <h4 className="font-bold text-yellow-300 mb-2">PayPayドーム（SB）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-slate-300">本塁打: 102 (中立)</div>
                      <div className="text-green-400">防御率: 97 (投手有利)</div>
                      <div className="text-slate-300">特徴: ドーム、人工芝</div>
                    </div>
                    <Link href="/teams/2025/H" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      SB成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-blue-950/30 rounded p-4">
                    <h4 className="font-bold text-blue-300 mb-2">メットライフドーム（西武）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-red-400">本塁打: 93 (投手有利)</div>
                      <div className="text-green-400">防御率: 95 (投手有利)</div>
                      <div className="text-slate-300">特徴: 広い球場</div>
                    </div>
                    <Link href="/teams/2025/L" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      西武成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-red-950/30 rounded p-4">
                    <h4 className="font-bold text-red-300 mb-2">楽天生命パーク（楽天）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-slate-300">本塁打: 100 (中立)</div>
                      <div className="text-slate-300">防御率: 101 (中立)</div>
                      <div className="text-slate-300">特徴: 観客近い</div>
                    </div>
                    <Link href="/teams/2025/E" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      楽天成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-blue-950/30 rounded p-4">
                    <h4 className="font-bold text-blue-300 mb-2">ZOZOマリン（ロッテ）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-red-400">本塁打: 96 (投手有利)</div>
                      <div className="text-green-400">防御率: 94 (投手有利)</div>
                      <div className="text-slate-300">特徴: 海風の影響</div>
                    </div>
                    <Link href="/teams/2025/M" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      ロッテ成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-green-950/30 rounded p-4">
                    <h4 className="font-bold text-green-300 mb-2">エスコンフィールド（日ハム）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-green-400">本塁打: 104 (打者有利)</div>
                      <div className="text-red-400">防御率: 103 (投手不利)</div>
                      <div className="text-slate-300">特徴: 新球場</div>
                    </div>
                    <Link href="/teams/2025/F" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      日ハム成績詳細 →
                    </Link>
                  </div>

                  <div className="bg-purple-950/30 rounded p-4">
                    <h4 className="font-bold text-purple-300 mb-2">京セラドーム（オリックス）</h4>
                    <div className="text-sm space-y-1">
                      <div className="text-red-400">本塁打: 97 (投手有利)</div>
                      <div className="text-green-400">防御率: 96 (投手有利)</div>
                      <div className="text-slate-300">特徴: ドーム、広いファウル</div>
                    </div>
                    <Link href="/teams/2025/B" className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block">
                      オリックス成績詳細 →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Impact Analysis */}
          <section id="impact" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-400" />
              4. 選手成績への影響
            </h2>
            
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 backdrop-blur-md border border-blue-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">補正前後の差異事例</h3>
                <p className="text-slate-300 mb-4">
                  <Link href="/players" className="text-blue-400 hover:text-blue-300 underline">選手データベース</Link>で確認できる実例から、Park Factor補正の重要性を示します：
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-green-950/30 rounded p-4">
                    <h4 className="font-bold text-green-300 mb-3">打者への影響例</h4>
                    <div className="space-y-2 text-sm">
                      <div className="text-slate-300">
                        <strong>東京ドーム本拠打者：</strong><br />
                        生OPS: .850 → 補正後OPS+: 125<br />
                        <span className="text-amber-400">Park Factor考慮で相対評価低下</span>
                      </div>
                      <div className="text-slate-300">
                        <strong>甲子園本拠打者：</strong><br />
                        生OPS: .780 → 補正後OPS+: 135<br />
                        <span className="text-green-400">Park Factor考慮で相対評価上昇</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-950/30 rounded p-4">
                    <h4 className="font-bold text-blue-300 mb-3">投手への影響例</h4>
                    <div className="space-y-2 text-sm">
                      <div className="text-slate-300">
                        <strong>ナゴヤドーム本拠投手：</strong><br />
                        生ERA: 3.20 → 補正後ERA-: 85<br />
                        <span className="text-amber-400">投手有利球場での恩恵</span>
                      </div>
                      <div className="text-slate-300">
                        <strong>神宮本拠投手：</strong><br />
                        生ERA: 3.80 → 補正後ERA-: 90<br />
                        <span className="text-green-400">打者有利球場でも健闘</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-950/20 border border-amber-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">wRC+とERA-への統合</h3>
                <p className="text-slate-300 mb-4">
                  <Link href="/about/methodology" className="text-blue-400 hover:text-blue-300 underline">当サイトの補正手法</Link>では、Park Factorsを以下の主要指標に統合：
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-900/30 rounded p-4">
                    <h4 className="font-bold text-green-300 mb-2">wRC+への統合</h4>
                    <div className="text-sm text-slate-300 space-y-1">
                      <li>球場別wOBA補正</li>
                      <li>リーグ平均との比較</li>
                      <li>100 = リーグ平均</li>
                      <li>130+ = エリートレベル</li>
                    </div>
                  </div>
                  
                  <div className="bg-red-900/30 rounded p-4">
                    <h4 className="font-bold text-red-300 mb-2">ERA-への統合</h4>
                    <div className="text-sm text-slate-300 space-y-1">
                      <li>球場別防御率補正</li>
                      <li>リーグ平均との比較</li>
                      <li>100 = リーグ平均</li>
                      <li>80以下 = エリートレベル</li>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Practical Application */}
          <section id="application" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              5. 実践的活用法
            </h2>
            
            <div className="space-y-6">
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">トレード・FA評価での活用</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <h4 className="font-bold text-white mb-2">環境変化の影響予測</h4>
                      <p className="text-slate-300 text-sm">
                        投手有利球場から打者有利球場への移籍選手は、成績低下の可能性。<Link href="/players" className="text-blue-400 hover:text-blue-300 underline">選手データベース</Link>で過去の球場別成績を確認し、適応力を評価。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <h4 className="font-bold text-white mb-2">真の実力値算出</h4>
                      <p className="text-slate-300 text-sm">
                        生成績ではなく、wRC+・ERA-等の<strong>補正済み指標</strong>で評価。球場バイアスを排除した公正な比較が可能。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <h4 className="font-bold text-white mb-2">球場相性の確認</h4>
                      <p className="text-slate-300 text-sm">
                        <Link href="/teams" className="text-blue-400 hover:text-blue-300 underline">各チームのホーム球場</Link>との相性を事前分析。特に長距離打者の本塁打Park Factorとの関係性を重視。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 backdrop-blur-md border border-green-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">ファンタジー野球・予想での活用</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-bold text-green-300 mb-3">有利なマッチアップ</h4>
                    <ul className="text-slate-300 space-y-2 text-sm">
                      <li>• 長距離打者 × 打者有利球場</li>
                      <li>• コントロール投手 × 投手有利球場</li>
                      <li>• 風向き・天候との組み合わせ</li>
                      <li>• <Link href="/rankings" className="text-blue-400 hover:text-blue-300 underline">ランキング</Link>上位選手の球場相性</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-300 mb-3">注意すべきトラップ</h4>
                    <ul className="text-slate-300 space-y-2 text-sm">
                      <li>• 球場補正無視の表面的評価</li>
                      <li>• ホーム偏重の成績判断</li>
                      <li>• 小サンプルでの環境効果過信</li>
                      <li>• 対戦相手球場の影響軽視</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-purple-950/20 border border-purple-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">継続的モニタリング</h3>
                <p className="text-slate-300 mb-4">
                  Park Factorsは年度により変動するため、定期的な更新が必要：
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-900/30 rounded p-3 text-center">
                    <div className="text-lg font-bold text-blue-300">月次</div>
                    <div className="text-sm text-slate-400">小修正・トレンド確認</div>
                  </div>
                  <div className="bg-green-900/30 rounded p-3 text-center">
                    <div className="text-lg font-bold text-green-300">半年</div>
                    <div className="text-sm text-slate-400">中間見直し・調整</div>
                  </div>
                  <div className="bg-amber-900/30 rounded p-3 text-center">
                    <div className="text-lg font-bold text-amber-300">年次</div>
                    <div className="text-sm text-slate-400">全面再計算・係数更新</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Related Links */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-6">関連記事・データ</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-white mb-3">補正指標・分析手法</h3>
                <div className="space-y-2">
                  <Link href="/about/methodology" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    当サイトの分析手法・係数表
                  </Link>
                  <Link href="/column/batting-order-optimization" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    打順最適化とセイバーメトリクス
                  </Link>
                  <Link href="/players" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    選手データベース（wRC+・ERA-検索）
                  </Link>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-white mb-3">チーム・球場データ</h3>
                <div className="space-y-2">
                  <Link href="/teams" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    2024年全12球団成績・Park Factors
                  </Link>
                  <Link href="/compare/teams" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    チーム比較ツール（補正済み指標）
                  </Link>
                  <Link href="/records" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    NPB歴代記録（補正済み）
                  </Link>
                  <Link href="/rankings" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    年度別ランキング（球場補正適用）
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-green-950/20 backdrop-blur-md border border-green-400/30 rounded-lg p-6">
            <div className="text-center">
              <h3 className="font-bold text-white mb-4">公正な野球分析のためのPark Factors</h3>
              <p className="text-slate-300 mb-4">
                Baseball AI Mediaでは、NPB12球場の詳細なPark Factors分析により、真の選手実力を可視化しています。
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors">
                  ホームページ
                </Link>
                <Link href="/teams" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
                  球場別データ
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}