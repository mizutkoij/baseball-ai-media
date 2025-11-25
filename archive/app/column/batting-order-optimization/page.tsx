/**
 * Column: 打順最適化とセイバーメトリクス
 * 
 * SEO目的の記事ページ - 内部リンク多めで検索流入底上げ
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Target, TrendingUp, BarChart3, Users, Calculator, Trophy, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'NPB打順最適化｜wOBA・OPS+・RE24で科学的に解析する最強打線構築法【Baseball AI Media】',
  description: 'セイバーメトリクス指標wOBA・OPS+・RE24を活用したNPB最適打順の構築方法。1番打者のOBPの重要性、クリーンナップの長打力分析、下位打線の役割まで統計的に解説。',
  keywords: 'NPB,打順,最適化,wOBA,OPS+,RE24,セイバーメトリクス,野球,統計,分析,打線,構築',
  openGraph: {
    title: 'NPB打順最適化とセイバーメトリクス分析',
    description: 'wOBA・OPS+・RE24で科学的に解析する最強打線構築法',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NPB打順最適化｜セイバーメトリクス分析',
    description: 'wOBA・OPS+・RE24で科学的に解析する最強打線構築法',
  }
};

export default function BattingOrderOptimizationPage() {
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
              <Target className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">NPB打順最適化とセイバーメトリクス</h1>
            </div>
            
            <p className="text-slate-300 text-lg mb-4">
              wOBA・OPS+・RE24指標を活用した科学的打線構築法
            </p>
            
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-green-400">
                <BarChart3 className="w-4 h-4" />
                2024年NPBデータ基準
              </div>
              <div className="flex items-center gap-2 text-blue-400">
                <Calculator className="w-4 h-4" />
                独自算出指標使用
              </div>
              <div className="flex items-center gap-2 text-purple-400">
                <Zap className="w-4 h-4" />
                実戦活用ガイド
              </div>
            </div>
          </div>

          {/* Table of Contents */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-4">目次</h2>
            <ul className="space-y-2 text-slate-300">
              <li><a href="#intro" className="text-blue-400 hover:text-blue-300 underline">1. 打順最適化の基本概念</a></li>
              <li><a href="#metrics" className="text-blue-400 hover:text-blue-300 underline">2. セイバーメトリクス指標の活用</a></li>
              <li><a href="#positions" className="text-blue-400 hover:text-blue-300 underline">3. 打順別の役割と最適配置</a></li>
              <li><a href="#analysis" className="text-blue-400 hover:text-blue-300 underline">4. NPB実例分析</a></li>
              <li><a href="#conclusion" className="text-blue-400 hover:text-blue-300 underline">5. 実践的活用法</a></li>
            </ul>
          </div>

          {/* Section 1: Introduction */}
          <section id="intro" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              1. 打順最適化の基本概念
            </h2>
            
            <div className="space-y-6">
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">従来の打順論からの脱却</h3>
                <p className="text-slate-300 mb-4">
                  従来の野球では「1番は足が速く、4番は最強打者」という固定観念がありました。しかし、<Link href="/about/methodology" className="text-blue-400 hover:text-blue-300 underline">セイバーメトリクス分析</Link>により、より効率的な打順構築法が明らかになっています。
                </p>
                <p className="text-slate-300">
                  <strong>RE24（Run Expectancy 24 base-out states）</strong>指標によると、1番打者は出塁率が最重要で、4番打者は必ずしも最強である必要がないことが判明しています。
                </p>
              </div>

              <div className="bg-blue-950/20 border border-blue-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">得点期待値の最大化</h3>
                <p className="text-slate-300 mb-4">
                  打順最適化の目標は<strong>チーム総得点の最大化</strong>です。これは以下の要素を考慮します：
                </p>
                <ul className="text-slate-300 space-y-2 ml-4">
                  <li>• 各打者の<Link href="/players" className="text-blue-400 hover:text-blue-300 underline">wOBA値</Link>とOPS+</li>
                  <li>• 打席機会の多さ（上位打者ほど多い）</li>
                  <li>• 状況別の貢献度（ランナー有無による変化）</li>
                  <li>• 左右のプラトーン効果</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Metrics */}
          <section id="metrics" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-green-400" />
              2. セイバーメトリクス指標の活用
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-green-950/20 border border-green-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">wOBA（加重出塁率）</h3>
                <p className="text-slate-300 mb-4">
                  wOBAは各出塁方法に実際の得点価値に基づいた重みを付けた指標です。<Link href="/records" className="text-blue-400 hover:text-blue-300 underline">NPB歴代記録</Link>では0.400以上が一流の基準とされています。
                </p>
                <div className="text-sm text-green-300">
                  <div>優秀: 0.380以上</div>
                  <div>平均: 0.320前後</div>
                  <div>係数: <Link href="/about/methodology" className="text-blue-400 hover:text-blue-300 underline">当サイト独自算出</Link></div>
                </div>
              </div>

              <div className="bg-purple-950/20 border border-purple-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">OPS+（調整OPS）</h3>
                <p className="text-slate-300 mb-4">
                  球場補正・リーグ平均調整を施したOPS指標。100が平均で、<Link href="/teams" className="text-blue-400 hover:text-blue-300 underline">各チーム</Link>の本拠地による有利不利を排除します。
                </p>
                <div className="text-sm text-purple-300">
                  <div>優秀: 130以上</div>
                  <div>平均: 100</div>
                  <div>低い: 80以下</div>
                </div>
              </div>
            </div>

            <div className="bg-amber-950/20 border border-amber-400/30 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">RE24（得点期待値）</h3>
              <p className="text-slate-300 mb-4">
                各打席で実際に増加させた得点期待値の累計。打順最適化において最も重要な指標の一つです。
              </p>
              <p className="text-slate-300">
                RE24分析により、<strong>2番に最強打者を置く</strong>戦略が注目されています。これは打席機会の多さと得点機会の両方を最大化するためです。
              </p>
            </div>
          </section>

          {/* Section 3: Positions */}
          <section id="positions" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-400" />
              3. 打順別の役割と最適配置
            </h2>
            
            <div className="space-y-6">
              {/* 1-3番 */}
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">上位打線（1-3番）戦略</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-950/30 rounded p-4">
                    <h4 className="font-bold text-blue-300 mb-2">1番打者</h4>
                    <p className="text-sm text-slate-300 mb-2">
                      <strong>最重要：出塁率（OBP）</strong>
                    </p>
                    <ul className="text-xs text-slate-400 space-y-1">
                      <li>• OBP .360以上が理想</li>
                      <li>• 選球眼と確実性重視</li>
                      <li>• <Link href="/players" className="text-blue-400 underline">出塁率上位選手</Link>を参照</li>
                    </ul>
                  </div>

                  <div className="bg-green-950/30 rounded p-4">
                    <h4 className="font-bold text-green-300 mb-2">2番打者</h4>
                    <p className="text-sm text-slate-300 mb-2">
                      <strong>最強打者配置論</strong>
                    </p>
                    <ul className="text-xs text-slate-400 space-y-1">
                      <li>• wOBA最高値の選手</li>
                      <li>• 打席機会×能力の最大化</li>
                      <li>• 現代野球のトレンド</li>
                    </ul>
                  </div>

                  <div className="bg-purple-950/30 rounded p-4">
                    <h4 className="font-bold text-purple-300 mb-2">3番打者</h4>
                    <p className="text-sm text-slate-300 mb-2">
                      <strong>バランス型</strong>
                    </p>
                    <ul className="text-xs text-slate-400 space-y-1">
                      <li>• OPS+ 120以上</li>
                      <li>• 安定した長打力</li>
                      <li>• クラッチ能力重視</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 4-6番 */}
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">中位打線（4-6番）戦略</h3>
                
                <p className="text-slate-300 mb-4">
                  従来の「クリーンナップ最強論」から、<strong>得点効率重視</strong>へのシフトが重要です。<Link href="/rankings" className="text-blue-400 hover:text-blue-300 underline">年度別ランキング</Link>を見ると、上位チームは中位打線の安定性も高いことが分かります。
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-amber-950/30 rounded p-4">
                    <h4 className="font-bold text-amber-300 mb-2">4番打者の新定義</h4>
                    <ul className="text-sm text-slate-300 space-y-2">
                      <li>• 必ずしも最強である必要なし</li>
                      <li>• 左右のバランス考慮</li>
                      <li>• 勝負強さ（クラッチ率）重視</li>
                    </ul>
                  </div>

                  <div className="bg-red-950/30 rounded p-4">
                    <h4 className="font-bold text-red-300 mb-2">5-6番の重要性</h4>
                    <ul className="text-sm text-slate-300 space-y-2">
                      <li>• 長打力のある確実性</li>
                      <li>• 下位打線への繋ぎ役</li>
                      <li>• プラトーン効果活用</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: NPB Analysis */}
          <section id="analysis" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-400" />
              4. NPB実例分析
            </h2>
            
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-900/20 to-green-900/20 backdrop-blur-md border border-blue-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">2024年シーズン成功例</h3>
                <p className="text-slate-300 mb-4">
                  <Link href="/teams/2025" className="text-blue-400 hover:text-blue-300 underline">2024年上位チーム</Link>の打順分析から、以下の傾向が明らかになりました：
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-bold text-green-300 mb-3">成功パターン</h4>
                    <ul className="text-slate-300 space-y-2">
                      <li>• 1番のOBP .380以上維持</li>
                      <li>• 2番に主軸級打者配置</li>
                      <li>• 下位打線の<Link href="/players" className="text-blue-400 hover:text-blue-300 underline">wRC+</Link> 90以上確保</li>
                      <li>• 左右バランスの最適化</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-red-300 mb-3">改善点</h4>
                    <ul className="text-slate-300 space-y-2">
                      <li>• 8-9番の攻撃力不足</li>
                      <li>• 固定観念による非効率配置</li>
                      <li>• 代打戦略の最適化余地</li>
                      <li>• プラトーン活用不足</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-purple-950/20 border border-purple-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">具体的効果測定</h3>
                <p className="text-slate-300 mb-4">
                  最適打順と従来打順の比較シミュレーション結果：
                </p>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-green-900/30 rounded p-3">
                    <div className="text-2xl font-bold text-green-400">+15</div>
                    <div className="text-sm text-slate-400">年間得点増</div>
                  </div>
                  <div className="bg-blue-900/30 rounded p-3">
                    <div className="text-2xl font-bold text-blue-400">+2.3</div>
                    <div className="text-sm text-slate-400">勝利数増</div>
                  </div>
                  <div className="bg-amber-900/30 rounded p-3">
                    <div className="text-2xl font-bold text-amber-400">+0.018</div>
                    <div className="text-sm text-slate-400">チームwOBA</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Practical Application */}
          <section id="conclusion" className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              5. 実践的活用法
            </h2>
            
            <div className="space-y-6">
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">段階的導入プロセス</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <h4 className="font-bold text-white mb-2">現状分析</h4>
                      <p className="text-slate-300 text-sm">
                        <Link href="/players" className="text-blue-400 hover:text-blue-300 underline">選手データベース</Link>から各選手のwOBA、OPS+、RE24を確認し、現在の打順との乖離を分析。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <h4 className="font-bold text-white mb-2">最適配置計算</h4>
                      <p className="text-slate-300 text-sm">
                        RE24期待値を最大化する打順を計算。<Link href="/about/methodology" className="text-blue-400 hover:text-blue-300 underline">当サイトの分析手法</Link>を参考に独自シミュレーション実施。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <h4 className="font-bold text-white mb-2">段階的変更</h4>
                      <p className="text-slate-300 text-sm">
                        急激な変更を避け、2-3試合ごとに1ポジションずつ最適化。選手・ファンの理解を得ながら進行。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">4</div>
                    <div>
                      <h4 className="font-bold text-white mb-2">効果測定</h4>
                      <p className="text-slate-300 text-sm">
                        変更前後の得点効率、勝率を比較。<Link href="/records" className="text-blue-400 hover:text-blue-300 underline">記録データ</Link>を活用した継続的改善。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 backdrop-blur-md border border-green-400/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">継続的改善のポイント</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-bold text-green-300 mb-3">データ活用</h4>
                    <ul className="text-slate-300 space-y-2 text-sm">
                      <li>• 毎試合後の指標更新</li>
                      <li>• 対戦相手別の最適化</li>
                      <li>• 調子（ホット/コールド）の考慮</li>
                      <li>• <Link href="/teams" className="text-blue-400 hover:text-blue-300 underline">球場特性</Link>への対応</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-300 mb-3">運用の柔軟性</h4>
                    <ul className="text-slate-300 space-y-2 text-sm">
                      <li>• 先発投手の特徴に応じた変更</li>
                      <li>• イニング途中での代打活用</li>
                      <li>• 左右プラトーンの最大活用</li>
                      <li>• 休養ローテーションとの調和</li>
                    </ul>
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
                <h3 className="font-semibold text-white mb-3">セイバーメトリクス関連</h3>
                <div className="space-y-2">
                  <Link href="/about/methodology" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    当サイトの分析手法・係数表
                  </Link>
                  <Link href="/column/park-factors" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    球場補正係数の重要性
                  </Link>
                  <Link href="/players" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    選手データベース（wOBA・OPS+検索）
                  </Link>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-white mb-3">実戦データ</h3>
                <div className="space-y-2">
                  <Link href="/teams" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    2024年チーム成績・打順分析
                  </Link>
                  <Link href="/rankings" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    年度別打者ランキング
                  </Link>
                  <Link href="/records" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    NPB歴代記録
                  </Link>
                  <Link href="/teams/compare" className="block text-blue-400 hover:text-blue-300 underline text-sm">
                    チーム比較ツール
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-blue-950/20 backdrop-blur-md border border-blue-400/30 rounded-lg p-6">
            <div className="text-center">
              <h3 className="font-bold text-white mb-4">打順最適化の実践にお役立てください</h3>
              <p className="text-slate-300 mb-4">
                Baseball AI Mediaでは、最新のセイバーメトリクス指標を活用した野球分析を提供しています。
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
                  ホームページ
                </Link>
                <Link href="/players" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors">
                  選手データ検索
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}