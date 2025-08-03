import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Calculator, BarChart3, Beaker, TrendingUp, Download, ExternalLink, Server } from 'lucide-react';
import DataValidationStatus from '../../../components/DataValidationStatus';
import SystemStatus from '../../../components/SystemStatus';
import QualityStatus from '../../../components/QualityStatus';

export const metadata: Metadata = {
  title: '分析手法・係数表 | Baseball AI Media',
  description: 'Baseball AI Mediaで使用するセイバーメトリクス計算式、係数、統計手法の詳細説明。wOBA、FIP、wRC+等の透明性保証',
  openGraph: {
    title: '分析手法・係数表 | Baseball AI Media',
    description: 'NPB向けセイバーメトリクス計算式と係数の透明性保証',
    type: 'article'
  }
};

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/about" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6">
            <ArrowLeft className="w-4 h-4" />
            About に戻る
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <Calculator className="w-8 h-8 text-green-400" />
            <h1 className="text-3xl font-bold text-white">分析手法・係数表</h1>
          </div>
          
          <p className="text-slate-300 text-lg">
            Baseball AI Mediaで使用するセイバーメトリクス計算式・係数の完全透明化
          </p>
          
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-green-400">
              <Beaker className="w-4 h-4" />
              独自推定係数
            </div>
            <div className="flex items-center gap-2 text-blue-400">
              <TrendingUp className="w-4 h-4" />
              年別更新
            </div>
            <div className="flex items-center gap-2 text-purple-400">
              <BarChart3 className="w-4 h-4" />
              学術準拠
            </div>
          </div>
        </div>

        {/* データ検証・更新状況 */}
        <DataValidationStatus />

        {/* 品質ゲート状況 */}
        <QualityStatus />

        {/* 更新履歴・データアクセス */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-400" />
              最新係数データ
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">最終更新:</span>
                <span className="text-white">2024年7月31日</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">対象年度:</span>
                <span className="text-white">2019-2025年</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">更新頻度:</span>
                <span className="text-white">日次 (JST 0:30)</span>
              </div>
              <Link 
                href="/api/constants?year=2025&league=first" 
                target="_blank"
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                JSON形式で取得
              </Link>
            </div>
          </div>
          
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">更新履歴</h2>
            <div className="space-y-3 text-sm">
              <div className="border-l-2 border-green-500 pl-3">
                <div className="text-white font-medium">2024.07.31</div>
                <div className="text-slate-400">自前係数推定パイプライン実装</div>
              </div>
              <div className="border-l-2 border-blue-500 pl-3">
                <div className="text-white font-medium">2024.07.30</div>
                <div className="text-slate-400">FIP定数の年別推定開始</div>
              </div>
              <div className="border-l-2 border-purple-500 pl-3">
                <div className="text-white font-medium">2024.07.29</div>
                <div className="text-slate-400">wOBA係数の得点環境調整</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          
          {/* 基本方針 */}
          <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Beaker className="w-6 h-6 text-green-400" />
              基本方針・独自性
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">独自性保証</h3>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>NPB公式データを基にした自前計算</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>年別・リーグ別の環境係数推定</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>第三者データベースとの独立性</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>計算過程の完全透明化</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-4">学術準拠</h3>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">📚</span>
                    <span>Baseball Prospectus研究</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">📚</span>
                    <span>FanGraphs計算手法</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">📚</span>
                    <span>Tom Tango等の論文</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">📚</span>
                    <span>日本セイバーメトリクス協会</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* wOBA係数 */}
          <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-white mb-6">wOBA係数（加重出塁率）</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">計算式</h3>
              <div className="bg-slate-800/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <div className="text-green-300">
                  wOBA = (c_BB × uBB + c_HBP × HBP + c_1B × 1B + c_2B × 2B + c_3B × 3B + c_HR × HR) / (PA - IBB - SH)
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">2024年係数（推定値）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-white">事象</th>
                      <th className="px-4 py-3 text-right text-white">係数</th>
                      <th className="px-4 py-3 text-left text-white">説明</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-slate-700">
                      <td className="px-4 py-3">四球 (uBB)</td>
                      <td className="px-4 py-3 text-right font-mono">0.690</td>
                      <td className="px-4 py-3">故意四球を除く</td>
                    </tr>
                    <tr className="border-b border-slate-700">
                      <td className="px-4 py-3">死球 (HBP)</td>
                      <td className="px-4 py-3 text-right font-mono">0.720</td>
                      <td className="px-4 py-3">打者への死球</td>
                    </tr>
                    <tr className="border-b border-slate-700">
                      <td className="px-4 py-3">単打 (1B)</td>
                      <td className="px-4 py-3 text-right font-mono">0.890</td>
                      <td className="px-4 py-3">ヒット - 2B - 3B - HR</td>
                    </tr>
                    <tr className="border-b border-slate-700">
                      <td className="px-4 py-3">二塁打 (2B)</td>
                      <td className="px-4 py-3 text-right font-mono">1.270</td>
                      <td className="px-4 py-3">二塁打</td>
                    </tr>
                    <tr className="border-b border-slate-700">
                      <td className="px-4 py-3">三塁打 (3B)</td>
                      <td className="px-4 py-3 text-right font-mono">1.620</td>
                      <td className="px-4 py-3">三塁打</td>
                    </tr>
                    <tr className="border-b border-slate-700">
                      <td className="px-4 py-3">本塁打 (HR)</td>
                      <td className="px-4 py-3 text-right font-mono">2.100</td>
                      <td className="px-4 py-3">本塁打</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="font-medium text-blue-300 mb-2">推定方法</h4>
              <p className="text-sm text-slate-300">
                <strong>理想:</strong> RE24（Run Expectancy 24 states）表から線形回帰により年別係数を推定<br/>
                <strong>現実装:</strong> 汎用係数をベースに得点環境（R/PA）で調整<br/>
                <strong>更新頻度:</strong> 日次（前日までのデータで再計算）
              </p>
            </div>
          </section>

          {/* FIP定数 */}
          <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-white mb-6">FIP定数（守備無関係防御率）</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">計算式</h3>
              <div className="bg-slate-800/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <div className="text-green-300">
                  FIP = ((13 × HR) + (3 × (BB - IBB + HBP)) - (2 × SO)) / IP + C
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">年別FIP定数</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-white">年度</th>
                      <th className="px-4 py-3 text-right text-white">定数 (C)</th>
                      <th className="px-4 py-3 text-right text-white">リーグERA</th>
                      <th className="px-4 py-3 text-right text-white">サンプル数</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-slate-700">
                      <td className="px-4 py-3">2025</td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">3.278</td>
                      <td className="px-4 py-3 text-right font-mono">54.00</td>
                      <td className="px-4 py-3 text-right">1試合</td>
                    </tr>
                    <tr className="border-b border-slate-700 text-slate-500">
                      <td className="px-4 py-3">2024</td>
                      <td className="px-4 py-3 text-right font-mono">3.125</td>
                      <td className="px-4 py-3 text-right font-mono">3.92</td>
                      <td className="px-4 py-3 text-right">858試合</td>
                    </tr>
                    <tr className="border-b border-slate-700 text-slate-500">
                      <td className="px-4 py-3">2023</td>
                      <td className="px-4 py-3 text-right font-mono">3.142</td>
                      <td className="px-4 py-3 text-right font-mono">3.89</td>
                      <td className="px-4 py-3 text-right">858試合</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
              <h4 className="font-medium text-purple-300 mb-2">推定方法</h4>
              <p className="text-sm text-slate-300">
                <strong>原理:</strong> C = lgERA - ((13×HR + 3×(BB-IBB+HBP) - 2×SO) / IP)<br/>
                <strong>目的:</strong> FIPの平均値をリーグ平均ERAに合わせる調整<br/>
                <strong>品質保証:</strong> サンプル数最小100試合、前年値からの乖離±30%でアラート
              </p>
            </div>
          </section>

          {/* wRC+・OPS+ */}
          <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-white mb-6">相対指標（wRC+・OPS+）</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">wRC+ (加重得点創出)</h3>
                <div className="bg-slate-800/50 rounded-lg p-4 font-mono text-xs overflow-x-auto mb-4">
                  <div className="text-green-300">
                    wRC+ = ((wOBA - lgwOBA) / wOBA_scale + lgR/PA) / lgR/PA × 100 / PF
                  </div>
                </div>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• <strong>100</strong>: リーグ平均</li>
                  <li>• <strong>130+</strong>: 優秀</li>
                  <li>• <strong>90-</strong>: 平均以下</li>
                  <li>• パークファクター調整済み</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-4">OPS+ (出塁率+長打率)</h3>
                <div className="bg-slate-800/50 rounded-lg p-4 font-mono text-xs overflow-x-auto mb-4">
                  <div className="text-green-300">
                    OPS+ = (OBP/lgOBP + SLG/lgSLG - 1) × 100 / PF
                  </div>
                </div>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• <strong>100</strong>: リーグ平均</li>
                  <li>• <strong>120+</strong>: 優秀</li>
                  <li>• <strong>85-</strong>: 平均以下</li>
                  <li>• より直感的な指標</li>
                </ul>
              </div>
            </div>
          </section>

          {/* パークファクター・PF補正 */}
          <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-white mb-6">パークファクター・PF補正</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">2024年推定値</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">東京ドーム</h4>
                  <div className="text-2xl font-bold text-blue-400">1.05</div>
                  <div className="text-xs text-slate-400">やや打高</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">甲子園</h4>
                  <div className="text-2xl font-bold text-green-400">0.98</div>
                  <div className="text-xs text-slate-400">やや投高</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">ハマスタ</h4>
                  <div className="text-2xl font-bold text-red-400">1.12</div>
                  <div className="text-xs text-slate-400">打高球場</div>
                </div>
              </div>
            </div>
            
            <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-orange-300 mb-2">基本計算方法</h4>
              <p className="text-sm text-slate-300">
                <strong>現実装:</strong> 球場別平均得点 ÷ リーグ平均得点<br/>
                <strong>改善予定:</strong> 3年移動平均、ホーム/アウェイ分離、気温・湿度調整<br/>
                <strong>最小条件:</strong> シーズン10試合以上でファクター算出
              </p>
            </div>

            {/* PF補正システム */}
            <div>
              <h3 className="text-lg font-medium text-white mb-4">PF補正システム（ホーム/ビジター分析）</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h4 className="font-medium text-blue-300 mb-2">打撃指標補正</h4>
                  <div className="text-sm text-slate-300 space-y-1">
                    <div>• <strong>wRC+_neutral</strong> = wRC+ ÷ runPF^1.0</div>
                    <div>• <strong>OPS+_neutral</strong> = OPS+ ÷ runPF^1.0</div>
                    <div>• <strong>理由:</strong> 打撃成績は球場環境に線形比例</div>
                    <div>• <strong>適用:</strong> ホーム/ビジター各スプリット</div>
                  </div>
                </div>
                
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <h4 className="font-medium text-red-300 mb-2">投手指標補正</h4>
                  <div className="text-sm text-slate-300 space-y-1">
                    <div>• <strong>ERA-_neutral</strong> = ERA- ÷ runPF^1.0</div>
                    <div>• <strong>FIP-_neutral</strong> = FIP- ÷ runPF^0.5</div>
                    <div>• <strong>理由:</strong> FIPは守備無関係で球場影響が半減</div>
                    <div>• <strong>適用:</strong> 各投手の登板球場PF加重平均</div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <h4 className="font-medium text-purple-300 mb-2">実装詳細・品質管理</h4>
                <div className="text-sm text-slate-300 space-y-2">
                  <p><strong>加重平均PF:</strong> 各試合のPFをPA（打撃）/IP（投手）で加重平均してスプリット別に算出</p>
                  <p><strong>信頼性判定:</strong> 50PA/10IP未満は「参考値」、50-200PA/10-50IPは「中」、200PA/50IP以上は「高」</p>
                  <p><strong>欠損処理:</strong> PF未計測球場はrunPF=1.00として中立扱い</p>
                  <p><strong>UI連動:</strong> PFトグルON/OFFで生値⇔補正値を即座切替、分析の透明性を担保</p>
                </div>
              </div>
            </div>
          </section>

          {/* データ品質保証 */}
          <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-white mb-6">データ品質保証</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">自動検証</h3>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">🔍</span>
                    <span>係数の妥当性チェック（範囲外値の検出）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">🔍</span>
                    <span>サンプル数の最小値監視</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">🔍</span>
                    <span>前日差±7%でアラート送信</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">🔍</span>
                    <span>NPB公式記録との整合性確認</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-4">失敗時対応</h3>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">🛡️</span>
                    <span>フェイルオープン（前版係数で継続）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">🛡️</span>
                    <span>シュリンク調整（λ=0.3-0.5で前年重み）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">🛡️</span>
                    <span>異常値検出時の自動巻き戻し</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">🛡️</span>
                    <span>手動確認用の管理画面</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* チーム分析手法 */}
          <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-purple-400" />
              チーム分析手法
            </h2>
            
            <div className="space-y-6">
              {/* Team Standings */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">チーム順位表計算</h3>
                <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-slate-300 mb-2">勝率・順位の算出</h4>
                  <div className="font-mono text-xs text-green-300 mb-2">
                    勝率 = 勝数 ÷ (勝数 + 敗数 + 引分数 × 0.5)
                  </div>
                  <div className="font-mono text-xs text-green-300">
                    順位 = RANK() OVER (ORDER BY 勝数 DESC, 得失点差 DESC)
                  </div>
                </div>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• 引分は0.5勝0.5敗として勝率計算</li>
                  <li>• 同勝数の場合は得失点差で順位決定</li>
                  <li>• ホーム・アウェイ別の戦績も集計</li>
                  <li>• 対戦相手別の勝敗マトリックス生成</li>
                </ul>
              </div>

              {/* Team Distribution Charts */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">選手能力分布チャート</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="font-medium text-blue-300 mb-2">wRC+ 分布（打者）</h4>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>• 最小出場: 50打席以上</li>
                      <li>• ビン幅: 10刻み（~69, 70-79, ...140+）</li>
                      <li>• エリート層: 120以上</li>
                      <li>• 課題層: 80以下</li>
                    </ul>
                  </div>
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <h4 className="font-medium text-red-300 mb-2">FIP- 分布（投手）</h4>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>• 最小登板: 10投球回以上</li>
                      <li>• ビン幅: 10刻み（~69, 70-79, ...140+）</li>
                      <li>• エリート層: 80以下</li>
                      <li>• 課題層: 120以上</li>
                    </ul>
                  </div>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                  <h4 className="font-medium text-purple-300 mb-2">分析指標</h4>
                  <p className="text-sm text-slate-300">
                    <strong>チーム特色:</strong> 平均値・標準偏差からバランス型/特化型を判定<br/>
                    <strong>深度評価:</strong> エリート層の人数と課題層の比率<br/>
                    <strong>リーグ比較:</strong> 各ビンの分布率をリーグ平均と比較
                  </p>
                </div>
              </div>

              {/* Promotion Badges */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">昇格バッジシステム</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-300 mb-2">🌟 新人王候補</h4>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>• 4月末までデビュー</li>
                      <li>• 20試合以上出場</li>
                      <li>• wRC+ 95以上 or FIP- 105以下</li>
                    </ul>
                  </div>
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="font-medium text-blue-300 mb-2">📈 昇格注目</h4>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>• 途中昇格選手</li>
                      <li>• 50試合以下・150打席以下</li>
                      <li>• 経験積み段階</li>
                    </ul>
                  </div>
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <h4 className="font-medium text-green-300 mb-2">⚡ ブレイク</h4>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>• 途中昇格で好成績</li>
                      <li>• wRC+ 120以上 or FIP- 80以下</li>
                      <li>• 打率.300 + 出塁率.350以上</li>
                    </ul>
                  </div>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
                  <h4 className="font-medium text-orange-300 mb-2">判定ロジック</h4>
                  <p className="text-sm text-slate-300">
                    <strong>データソース:</strong> 一軍出場記録から逆算（ファーム記録は非公開のため）<br/>
                    <strong>インパクト評価:</strong> HIGH（即戦力級）・MEDIUM（期待株）・LOW（育成段階）<br/>
                    <strong>更新頻度:</strong> 日次（試合結果反映後に再判定）
                  </p>
                </div>
              </div>

              {/* Team Summary KPIs */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">チームKPI算出</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <h4 className="font-medium text-slate-300 mb-2">打撃指標</h4>
                    <ul className="text-sm text-slate-300 space-y-1">
                      <li>• <strong>チームwRC+:</strong> 全選手の合計wRCから算出</li>
                      <li>• <strong>チームOPS:</strong> 出塁率 + 長打率</li>
                      <li>• <strong>得点・本塁打・盗塁:</strong> 累計値</li>
                    </ul>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <h4 className="font-medium text-slate-300 mb-2">投手指標</h4>
                    <ul className="text-sm text-slate-300 space-y-1">
                      <li>• <strong>チームFIP:</strong> 全投手の投球回加重平均</li>
                      <li>• <strong>ERA-:</strong> チーム防御率のリーグ調整値</li>
                      <li>• <strong>WHIP・奪三振率・与四球率:</strong> 合計から算出</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 今後の拡張 */}
          <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-white mb-6">今後の拡張予定</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <span className="text-yellow-400">🚧</span>
                  RE24実装
                </h3>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• 24状況別得点期待値</li>
                  <li>• 3年移動平均での安定化</li>
                  <li>• より精密なwOBA係数</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <span className="text-purple-400">📊</span>
                  ファーム対応
                </h3>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• 二軍データの取り込み</li>
                  <li>• 昇降格追跡システム</li>
                  <li>• ファーム専用係数</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <span className="text-red-400">🎯</span>
                  高度指標
                </h3>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• WAR（Wins Above Replacement）</li>
                  <li>• UZR（Ultimate Zone Rating）</li>
                  <li>• Win Probability Added</li>
                </ul>
              </div>
            </div>
          </section>

          {/* System Status */}
          <SystemStatus />
        </div>

        {/* Navigation */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link 
            href="/api/constants?year=2025&league=first" 
            target="_blank"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            最新係数JSON
          </Link>
          <Link 
            href="/about" 
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            About・データ方針
          </Link>
          <Link 
            href="/privacy" 
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            プライバシーポリシー
          </Link>
        </div>
      </div>
    </div>
  );
}