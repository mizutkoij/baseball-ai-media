import { Metadata } from 'next';
import { BookOpen, Shield, Database, Code, Users, ExternalLink, Globe, Cpu, BarChart3, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'このサイトについて | NPB Analytics',
  description: 'Baseball AI Mediaの技術仕様、データソース、セイバーメトリクス指標の詳細説明。NPB公式データの独自分析・実装方針。',
  openGraph: {
    title: 'Baseball AI Media について',
    description: 'NPB公式データを活用した独自セイバーメトリクス分析サイト。完全自前実装・透明性重視',
    type: 'website',
  },
  robots: 'index, follow',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            ⚾ Baseball AI Media について
          </h1>
          <p className="text-xl text-slate-300">
            NPB（日本プロ野球）の独自分析とデータ可視化メディア
          </p>
        </div>

        {/* データ方針 - 最重要セクション */}
        <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-green-400" />
            <h2 className="text-2xl font-bold text-white">📊 データ独自性の保証</h2>
          </div>
          
          <div className="space-y-6">
            <div className="bg-green-900/20 border-l-4 border-green-400 p-4 rounded">
              <h3 className="font-bold text-green-400 mb-2">🔒 完全独自データ</h3>
              <p className="text-slate-300 mb-3">
                <strong>当サイトの指標値は自前のNPB公式スコア等から算出。第三者データベースの複製ではありません。</strong>
              </p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• NPB公式サイトの公開統計のみを使用</li>
                <li>• wOBA, FIP等の現代指標を独自実装</li>
                <li>• 係数・定数は学術文献に基づき自前推定</li>
                <li>• 第三者データベースの値を一切複製せず</li>
              </ul>
            </div>

            <div className="bg-blue-900/20 border-l-4 border-blue-400 p-4 rounded">
              <h3 className="font-bold text-blue-400 mb-2">✍️ オリジナル文章</h3>
              <p className="text-slate-300 mb-3">
                <strong>サイト内文章は独自執筆。引用は短い範囲に限定し、出典を明記。</strong>
              </p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• 統計解説は完全オリジナル執筆</li>
                <li>• 学術文献・一般理論からの概念理解のみ</li>
                <li>• 必要な引用は最小限かつ出典明記</li>
                <li>• UI/UX も独自デザイン・実装</li>
              </ul>
            </div>

            <div className="bg-purple-900/20 border-l-4 border-purple-400 p-4 rounded">
              <h3 className="font-bold text-purple-400 mb-2">🔬 透明性の確保</h3>
              <p className="text-slate-300 mb-3">
                <strong>統計手法は一般理論・学術論文・FanGraphs等の概念紹介に基づく独自実装。</strong>
              </p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• 計算式・係数を全て公開</li>
                <li>• リーグ集計値との整合性を検証</li>
                <li>• データの出所・作成方法を明示</li>
                <li>• 監査可能な透明なプロセス</li>
              </ul>
            </div>
          </div>
        </section>

        {/* プロジェクト概要 */}
        <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">プロジェクト概要</h2>
          </div>
          
          <div className="text-slate-300 space-y-4">
            <p>
              Baseball AI Mediaは、NPB（日本プロ野球）の統計分析・データ可視化に特化したWebメディアです。
              現代的なセイバーメトリクス指標を用いて、選手・チームのパフォーマンスを多角的に分析・表示します。
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  主要機能
                </h3>
                <ul className="text-sm space-y-1">
                  <li>• 選手別 wOBA, OPS+, FIP等の現代指標</li>
                  <li>• チーム別ピタゴラス勝率・パークファクター</li>
                  <li>• リアルタイム試合データ表示</li>
                  <li>• インタラクティブなランキング・比較</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  技術スタック
                </h3>
                <ul className="text-sm space-y-1">
                  <li>• Frontend: Next.js 14 + TypeScript</li>
                  <li>• Styling: Tailwind CSS</li>
                  <li>• Database: DuckDB + SQLite</li>
                  <li>• Data Pipeline: Python + Beautiful Soup</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* データパイプライン */}
        <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">自動データパイプライン</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">1. 収集</h3>
              <p className="text-sm text-slate-300">NPB公式サイトから試合結果・選手成績を自動取得（robots.txt遵守）</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">2. 処理</h3>
              <p className="text-sm text-slate-300">自動パース・正規化・異常値検出・重複排除プロセス</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">3. 算出</h3>
              <p className="text-sm text-slate-300">wRC+, ERA-, FIP, WAR等セイバーメトリクス指標を独自実装で計算</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">4. 配信</h3>
              <p className="text-sm text-slate-300">リアルタイム更新・比較分析・可視化をWeb配信</p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">技術仕様詳細</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="text-blue-400">フロントエンド:</strong>
                <span className="text-slate-300 ml-2">Next.js 14, TypeScript, Tailwind CSS, SWR</span>
              </div>
              <div>
                <strong className="text-blue-400">データベース:</strong>
                <span className="text-slate-300 ml-2">SQLite3 (現行・履歴データ分離)</span>
              </div>
              <div>
                <strong className="text-blue-400">データ処理:</strong>
                <span className="text-slate-300 ml-2">Node.js + Beautiful Soup (Python)</span>
              </div>
              <div>
                <strong className="text-blue-400">デプロイ:</strong>
                <span className="text-slate-300 ml-2">Vercel (CDN配信・自動ビルド)</span>
              </div>
              <div>
                <strong className="text-blue-400">更新頻度:</strong>
                <span className="text-slate-300 ml-2">試合終了後30分以内に自動反映</span>
              </div>
              <div>
                <strong className="text-blue-400">品質管理:</strong>
                <span className="text-slate-300 ml-2">監査スクリプト・整合性チェック</span>
              </div>
            </div>
          </div>
        </section>

        {/* データソース詳細 */}
        <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-green-400" />
            <h2 className="text-xl font-bold text-white">データソース・収集方針</h2>
          </div>
          
          <div className="space-y-4 text-slate-300">
            <div className="border-l-4 border-green-400 pl-4">
              <h4 className="font-semibold text-green-400">NPB公式サイト</h4>
              <p className="text-sm mt-1">
                試合結果・選手成績等の公開統計情報のみを利用。
                robots.txt遵守・適切なレート制限を実装。
              </p>
            </div>
            
            <div className="border-l-4 border-blue-400 pl-4">
              <h4 className="font-semibold text-blue-400">統計算出</h4>
              <p className="text-sm mt-1">
                wOBA係数・FIP定数等は学術文献の手法に基づき、
                NPBデータから独自推定。リーグ平均との整合性を確認。
              </p>
            </div>
            
            <div className="border-l-4 border-purple-400 pl-4">
              <h4 className="font-semibold text-purple-400">品質管理</h4>
              <p className="text-sm mt-1">
                全データにプロビナンス（出所・作成方法・ライセンス）情報を付与。
                監査スクリプトによる品質チェックを実施。
              </p>
            </div>
          </div>
        </section>

        {/* ライセンス・法的事項 */}
        <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">ライセンス・法的遵守</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 text-slate-300">
            <div>
              <h4 className="font-semibold text-white mb-2">データ利用</h4>
              <ul className="text-sm space-y-1">
                <li>• 公開統計情報の分析・可視化に限定</li>
                <li>• 第三者データベースの再配布なし</li>
                <li>• Fair Use原則遵守</li>
                <li>• DMCA・著作権法完全遵守</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-2">プライバシー</h4>
              <ul className="text-sm space-y-1">
                <li>• 個人情報は一切収集せず</li>
                <li>• 公開統計のみ利用</li>
                <li>• Cookie最小限使用</li>
                <li>• GDPR・個人情報保護法遵守</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-900/20 rounded border border-yellow-600/30">
            <p className="text-xs text-yellow-200">
              <strong>📄 詳細ライセンス情報:</strong> 
              出典・参考文献・利用条件の詳細は
              <Link href="/data/LICENSES.md" className="text-yellow-400 hover:underline ml-1">
                /data/LICENSES.md
              </Link>
              をご確認ください。
            </p>
          </div>
        </section>

        {/* 開発・連絡先 */}
        <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">開発・お問い合わせ</h2>
          </div>
          
          <div className="text-slate-300 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-2">開発方針</h4>
              <p className="text-sm">
                オープンソース精神に基づき、透明性・検証可能性を重視した開発を行っています。
                統計手法・データ処理過程を可能な限り公開し、コミュニティによる検証を歓迎します。
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-blue-400 mb-1">技術的質問</h5>
                <p>統計手法・データ処理に関するご質問</p>
              </div>
              <div>
                <h5 className="font-medium text-green-400 mb-1">データ品質</h5>
                <p>算出値の検証・不具合報告</p>
              </div>
              <div>
                <h5 className="font-medium text-yellow-400 mb-1">ライセンス</h5>
                <p>著作権・利用許諾に関するお問い合わせ</p>
              </div>
              <div>
                <h5 className="font-medium text-purple-400 mb-1">その他</h5>
                <p>機能要望・改善提案など</p>
              </div>
            </div>
          </div>
        </section>

        {/* フッター */}
        <div className="text-center mt-12 pt-8 border-t border-white/10">
          <p className="text-slate-400 text-sm">
            <strong>⚾ NPB分析の新しいスタンダードを目指して</strong>
          </p>
          <p className="text-slate-500 text-xs mt-2">
            独自開発・独自データ・オープンな検証プロセス
          </p>
        </div>
      </div>
    </div>
  );
}