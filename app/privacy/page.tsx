import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft, FileText, Database, Cookie } from 'lucide-react';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | Baseball AI Media',
  description: 'Baseball AI Mediaのプライバシーポリシー、個人情報保護方針、データ収集・利用に関する詳細な説明',
  openGraph: {
    title: 'プライバシーポリシー | Baseball AI Media',
    description: 'Baseball AI Mediaのプライバシーポリシー、個人情報保護方針',
    type: 'article'
  }
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6">
            <ArrowLeft className="w-4 h-4" />
            ホームに戻る
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-green-400" />
            <h1 className="text-3xl font-bold text-white">プライバシーポリシー</h1>
          </div>
          
          <p className="text-slate-300 text-lg">
            Baseball AI Mediaにおける個人情報保護方針とデータ取り扱い基準
          </p>
          
          <div className="mt-4 text-sm text-slate-400">
            最終更新日: 2024年7月31日 | 施行日: 2024年1月1日
          </div>
        </div>

        {/* Content */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 space-y-8">
          
          {/* 基本方針 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              基本方針
            </h2>
            <div className="text-slate-300 space-y-4">
              <p>
                Baseball AI Media（以下「当サイト」）は、NPB（日本プロ野球）の統計分析とデータ可視化を提供するWebサイトです。
                ユーザーのプライバシー保護を最優先とし、個人情報の適切な取り扱いに努めます。
              </p>
              <p>
                当サイトは個人情報保護法および関連法令を遵守し、透明性のあるデータ運用を行います。
              </p>
            </div>
          </section>

          {/* 収集する情報 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              収集する情報
            </h2>
            <div className="text-slate-300 space-y-4">
              <h3 className="text-lg font-medium text-white">自動収集情報</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>IPアドレス（匿名化処理済み）</li>
                <li>ブラウザ種別・バージョン</li>
                <li>アクセス日時・参照ページ</li>
                <li>デバイス情報（画面サイズ、OS等）</li>
                <li>サイト内行動データ（ページビュー、滞在時間、クリック等）</li>
              </ul>
              
              <h3 className="text-lg font-medium text-white">ユーザー提供情報</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>お問い合わせフォームでの連絡先情報</li>
                <li>フィードバック・意見投稿時の任意情報</li>
              </ul>
              
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-medium text-blue-300 mb-2">重要: 収集しない情報</h4>
                <p className="text-sm">
                  当サイトでは会員登録システムを提供しておらず、氏名・住所・電話番号・メールアドレス等の
                  個人識別情報を積極的に収集することはありません。
                </p>
              </div>
            </div>
          </section>

          {/* 利用目的 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Cookie className="w-5 h-5 text-blue-400" />
              情報の利用目的
            </h2>
            <div className="text-slate-300 space-y-4">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>サイト改善</strong>: ユーザビリティ向上、コンテンツ最適化</li>
                <li><strong>パフォーマンス分析</strong>: サイト速度、エラー率の監視</li>
                <li><strong>セキュリティ</strong>: 不正アクセス検知、スパム防止</li>
                <li><strong>統計分析</strong>: 匿名化されたアクセス傾向の把握</li>
                <li><strong>お問い合わせ対応</strong>: ユーザーサポート、技術的質問への回答</li>
              </ul>
              
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-sm text-green-300">
                  <strong>データ独立性保証:</strong> 当サイトで収集したデータは、NPB統計分析の目的以外で
                  第三者に販売・提供することはありません。
                </p>
              </div>
            </div>
          </section>

          {/* Cookie・トラッキング */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Cookie・トラッキング技術</h2>
            <div className="text-slate-300 space-y-4">
              <h3 className="text-lg font-medium text-white">使用するCookie</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">必須Cookie</h4>
                  <p className="text-sm">サイト機能に必要な基本的なCookie（セッション管理、設定保存等）</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">分析Cookie</h4>
                  <p className="text-sm">Google Analytics等によるサイト利用状況の分析（匿名化済み）</p>
                </div>
              </div>
              
              <h3 className="text-lg font-medium text-white">オプトアウト</h3>
              <p>
                分析Cookieの使用を拒否したい場合は、ブラウザ設定でCookieを無効化するか、
                <a href="https://tools.google.com/dlpage/gaoptout" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener">
                  Google Analytics オプトアウト アドオン
                </a>をご利用ください。
              </p>
            </div>
          </section>

          {/* データ保護・セキュリティ */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">データ保護・セキュリティ</h2>
            <div className="text-slate-300 space-y-4">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>暗号化通信</strong>: SSL/TLS暗号化によるデータ送信保護</li>
                <li><strong>アクセス制限</strong>: サーバーレベルでの不正アクセス防止</li>
                <li><strong>データ匿名化</strong>: 個人識別可能情報の自動匿名化処理</li>
                <li><strong>定期監査</strong>: セキュリティ状況の定期的な点検・改善</li>
                <li><strong>データ保持期間</strong>: ログデータは最大2年間保持後、自動削除</li>
              </ul>
            </div>
          </section>

          {/* 第三者との情報共有 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">第三者との情報共有</h2>
            <div className="text-slate-300 space-y-4">
              <h3 className="text-lg font-medium text-white">情報提供する場合</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>法令に基づく開示要求がある場合</li>
                <li>ユーザーの生命・財産保護のため緊急性がある場合</li>
                <li>ユーザーの同意がある場合</li>
              </ul>
              
              <h3 className="text-lg font-medium text-white">利用している外部サービス</h3>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <ul className="text-sm space-y-1">
                  <li>• <strong>Vercel</strong>: ホスティング・CDNサービス</li>
                  <li>• <strong>Google Analytics</strong>: アクセス解析サービス</li>
                  <li>• <strong>GitHub</strong>: ソースコード管理</li>
                </ul>
                <p className="text-xs text-slate-400 mt-2">
                  各サービスのプライバシーポリシーもご確認ください。
                </p>
              </div>
            </div>
          </section>

          {/* ユーザーの権利 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">ユーザーの権利</h2>
            <div className="text-slate-300 space-y-4">
              <p>ユーザーは以下の権利を有します:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>アクセス権</strong>: 収集された情報の開示請求</li>
                <li><strong>訂正権</strong>: 不正確な情報の訂正請求</li>
                <li><strong>削除権</strong>: 不要な情報の削除請求</li>
                <li><strong>処理停止権</strong>: データ処理の停止請求</li>
              </ul>
              
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm">
                  これらの権利行使をご希望の場合は、下記連絡先までお問い合わせください。
                  適切な本人確認後、法令に従って対応いたします。
                </p>
              </div>
            </div>
          </section>

          {/* ポリシー変更 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">プライバシーポリシーの変更</h2>
            <div className="text-slate-300 space-y-4">
              <p>
                当サイトでは、法令改正やサービス変更に伴い、本プライバシーポリシーを更新する場合があります。
                重要な変更がある場合は、サイト内での告知またはメール通知により事前にお知らせします。
              </p>
              <p>
                継続してサイトをご利用いただくことで、変更後のプライバシーポリシーに同意いただいたものとみなします。
              </p>
            </div>
          </section>

          {/* 連絡先 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">お問い合わせ</h2>
            <div className="text-slate-300 space-y-4">
              <p>プライバシーポリシーに関するご質問・ご意見は以下までお寄せください:</p>
              
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="font-medium text-white mb-2">Baseball AI Media 運営チーム</p>
                <p className="text-sm">
                  <strong>Web:</strong> <Link href="/about" className="text-blue-400 hover:text-blue-300 underline">お問い合わせフォーム</Link><br/>
                  <strong>GitHub:</strong> <a href="https://github.com/mizutkoij/baseball-ai-media/issues" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener">Issues</a>
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  お問い合わせへの回答は、営業日2-3日以内を目安としております。
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link 
            href="/terms" 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            利用規約
          </Link>
          <Link 
            href="/about" 
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            About・データ方針
          </Link>
          <Link 
            href="/about/methodology" 
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            分析手法
          </Link>
        </div>
      </div>
    </div>
  );
}