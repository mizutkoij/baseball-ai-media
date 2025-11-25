import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft, AlertCircle, FileText, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'DMCA通知 | Baseball AI Media',
  description: 'Baseball AI MediaのDMCA著作権侵害通知手続き、申請方法、対応プロセスの詳細',
  openGraph: {
    title: 'DMCA通知 | Baseball AI Media',
    description: 'Baseball AI MediaのDMCA著作権侵害通知手続き',
    type: 'article'
  }
};

export default function DMCAPage() {
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
            <Shield className="w-8 h-8 text-red-400" />
            <h1 className="text-3xl font-bold text-white">DMCA著作権侵害通知</h1>
          </div>
          
          <p className="text-slate-300 text-lg">
            Baseball AI Mediaにおけるデジタルミレニアム著作権法（DMCA）通知手続き
          </p>
          
          <div className="mt-4 text-sm text-slate-400">
            最終更新日: 2024年7月31日 | Digital Millennium Copyright Act Compliance
          </div>
        </div>

        {/* Content */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 space-y-8">
          
          {/* 概要 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              DMCA概要
            </h2>
            <div className="text-slate-300 space-y-4">
              <p>
                Baseball AI Media（以下「当サイト」）は、デジタルミレニアム著作権法（DMCA）を遵守し、
                著作権者の権利を尊重します。著作権侵害の申し立てを受けた場合、適切な手続きに従って対応いたします。
              </p>
              <p>
                当サイトは独自の統計分析システムを用いており、NPB公式データを適正に利用しています。
                第三者の著作権を侵害する意図はありません。
              </p>
              
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-medium text-yellow-300 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  重要事項
                </h4>
                <p className="text-sm">
                  虚偽のDMCA通知は偽証罪に該当する可能性があります。申請前に著作権侵害の根拠を十分ご確認ください。
                </p>
              </div>
            </div>
          </section>

          {/* 通知要件 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">DMCA通知の要件</h2>
            <div className="text-slate-300 space-y-4">
              <p>DMCA通知には以下の情報が必要です:</p>
              
              <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-white">必須記載事項</h3>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                    <div>
                      <h4 className="font-medium text-white">著作権者情報</h4>
                      <p className="text-sm text-slate-300">著作権者または代理人の氏名・連絡先</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                    <div>
                      <h4 className="font-medium text-white">侵害コンテンツの特定</h4>
                      <p className="text-sm text-slate-300">侵害されたとされるコンテンツの具体的な場所・URL</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                    <div>
                      <h4 className="font-medium text-white">著作権作品の特定</h4>
                      <p className="text-sm text-slate-300">侵害されたとする著作権作品の詳細情報</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                    <div>
                      <h4 className="font-medium text-white">誠実性の宣言</h4>
                      <p className="text-sm text-slate-300">通知内容が真実であり、著作権者または代理人として行動する旨の宣言</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">5</span>
                    <div>
                      <h4 className="font-medium text-white">電子署名または物理署名</h4>
                      <p className="text-sm text-slate-300">著作権者または正当な代理人の署名</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 対応プロセス */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">対応プロセス</h2>
            <div className="text-slate-300 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-300 mb-3">1. 通知受理</h3>
                  <ul className="text-sm space-y-1">
                    <li>• 通知内容の確認</li>
                    <li>• 要件充足の審査</li>
                    <li>• 受理通知の送信</li>
                  </ul>
                </div>
                
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-300 mb-3">2. 調査・対応</h3>
                  <ul className="text-sm space-y-1">
                    <li>• 該当コンテンツの調査</li>
                    <li>• 侵害の妥当性判定</li>
                    <li>• 必要に応じたコンテンツ削除</li>
                  </ul>
                </div>
                
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-green-300 mb-3">3. 結果通知</h3>
                  <ul className="text-sm space-y-1">
                    <li>• 調査結果の報告</li>
                    <li>• 対応措置の詳細</li>
                    <li>• 反駁手続きの案内</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">対応期間</h4>
                <p className="text-sm text-slate-300">
                  有効なDMCA通知を受理してから <strong>5営業日以内</strong> に調査を開始し、
                  <strong>10営業日以内</strong> に結果をご報告いたします。
                </p>
              </div>
            </div>
          </section>

          {/* 反駁通知 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">反駁通知（Counter-Notice）</h2>
            <div className="text-slate-300 space-y-4">
              <p>
                コンテンツが誤って削除されたと考える場合、反駁通知を提出できます。
              </p>
              
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <h4 className="font-medium text-purple-300 mb-3">反駁通知に必要な情報</h4>
                <ul className="text-sm space-y-2">
                  <li>• 削除されたコンテンツの特定情報</li>
                  <li>• 削除が間違いである理由の詳細説明</li>
                  <li>• 偽証罪に該当することの理解と同意</li>
                  <li>• 法的管轄への同意</li>
                  <li>• 申請者の連絡先情報と署名</li>
                </ul>
              </div>
              
              <p className="text-sm">
                反駁通知が適正である場合、原通知者が法的措置を取らない限り、
                10-14営業日後にコンテンツを復元する場合があります。
              </p>
            </div>
          </section>

          {/* 連絡先 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              DMCA通知提出先
            </h2>
            <div className="text-slate-300 space-y-4">
              <p>DMCA通知は以下の方法で提出してください:</p>
              
              <div className="bg-slate-800/50 rounded-lg p-6">
                <h3 className="font-medium text-white mb-4">指定代理人（Designated Agent）</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-white mb-2">連絡先</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>組織:</strong> Baseball AI Media 運営チーム</p>
                      <p><strong>Email:</strong> dmca@baseball-ai-media.example.com</p>
                      <p><strong>件名:</strong> &quot;DMCA Takedown Notice&quot; または &quot;DMCA Counter-Notice&quot;</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-white mb-2">提出方法</h4>
                    <div className="text-sm space-y-1">
                      <p>• <strong>推奨:</strong> Emailによる提出</p>
                      <p>• <strong>形式:</strong> PDF添付またはメール本文</p>
                      <p>• <strong>言語:</strong> 日本語または英語</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-xs text-slate-400">
                  <p>
                    <strong>注意:</strong> 上記メールアドレスはDMCA通知専用です。
                    その他のお問い合わせは <Link href="/about" className="text-blue-400 hover:text-blue-300 underline">通常のお問い合わせ</Link> をご利用ください。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 免責事項 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">免責事項</h2>
            <div className="text-slate-300 space-y-4">
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <ul className="text-sm space-y-2">
                  <li>• 当サイトは、ユーザーの投稿コンテンツについて事前審査を行いません</li>
                  <li>• DMCA通知の内容について、当サイトは法的助言を提供しません</li>
                  <li>• 虚偽通知による損害について、当サイトは責任を負いません</li>
                  <li>• 反復侵害者のアカウントは、適切な手続きを経て停止される場合があります</li>
                </ul>
              </div>
              
              <p className="text-sm">
                DMCA通知に関する詳細は、
                <a href="https://www.copyright.gov/legislation/dmca.pdf" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener">
                  米国著作権庁の公式文書
                </a>をご参照ください。
              </p>
            </div>
          </section>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link 
            href="/privacy" 
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            プライバシーポリシー
          </Link>
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
            About・お問い合わせ
          </Link>
        </div>
      </div>
    </div>
  );
}