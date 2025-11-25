import { Metadata } from 'next';
import Link from 'next/link';
import { FileText, ArrowLeft, AlertTriangle, Scale, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: '利用規約 | Baseball AI Media',
  description: 'Baseball AI Mediaの利用規約、サービス利用条件、禁止事項、免責事項の詳細',
  openGraph: {
    title: '利用規約 | Baseball AI Media',
    description: 'Baseball AI Mediaの利用規約とサービス利用条件',
    type: 'article'
  }
};

export default function TermsPage() {
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
            <Scale className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">利用規約</h1>
          </div>
          
          <p className="text-slate-300 text-lg">
            Baseball AI Mediaサービス利用に関する規約・条件
          </p>
          
          <div className="mt-4 text-sm text-slate-400">
            最終更新日: 2025年8月8日 | 施行日: 2025年3月28日
          </div>
        </div>

        {/* Content */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 space-y-8">
          
          {/* 総則 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              第1条（総則）
            </h2>
            <div className="text-slate-300 space-y-4">
              <p>
                本利用規約（以下「本規約」）は、Baseball AI Media（以下「当サイト」）が提供する
                NPB統計分析・データ可視化サービス（以下「本サービス」）の利用条件を定めるものです。
              </p>
              <p>
                ユーザーが当サイトにアクセスし、本サービスを利用することにより、
                本規約の全ての条項に同意したものとみなします。
              </p>
              
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h3 className="font-medium text-blue-300 mb-2">定義</h3>
                <ul className="text-sm space-y-1">
                  <li>• <strong>「当サイト」</strong>: Baseball AI Media およびその運営者</li>
                  <li>• <strong>「ユーザー」</strong>: 本サービスを利用する全ての個人・法人</li>
                  <li>• <strong>「コンテンツ」</strong>: 当サイトが提供する統計データ、分析結果、記事等</li>
                </ul>
              </div>
            </div>
          </section>

          {/* サービス内容 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              第2条（サービス内容）
            </h2>
            <div className="text-slate-300 space-y-4">
              <h3 className="text-lg font-medium text-white">提供サービス</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>NPB（日本プロ野球）公式データに基づく統計分析</li>
                <li>セイバーメトリクス指標の計算・可視化</li>
                <li>選手・チーム成績データベースの検索・閲覧</li>
                <li>試合結果・スケジュール情報の提供</li>
                <li>野球統計に関する教育的コンテンツ</li>
              </ul>
              
              <h3 className="text-lg font-medium text-white">独自性保証</h3>
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-sm text-green-300">
                  当サイトの統計指標は、NPB公式データを基に独自の計算式・係数を用いて算出しており、
                  第三者データベースの複製ではありません。分析手法の透明性を保証します。
                </p>
              </div>
            </div>
          </section>

          {/* 利用条件 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">第3条（利用条件）</h2>
            <div className="text-slate-300 space-y-4">
              <h3 className="text-lg font-medium text-white">適正利用</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>個人的・非商用目的での利用</li>
                <li>教育・研究目的での適正な引用</li>
                <li>野球統計の理解・学習を目的とした利用</li>
                <li>ファンコミュニティでの議論・情報共有</li>
              </ul>
              
              <h3 className="text-lg font-medium text-white">商用利用について</h3>
              <p>
                商用目的での利用をご希望の場合は、事前に当サイトまでご相談ください。
                適切な利用条件を個別に検討いたします。
              </p>
            </div>
          </section>

          {/* 禁止事項 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              第4条（禁止事項）
            </h2>
            <div className="text-slate-300 space-y-4">
              <p>ユーザーは以下の行為を行ってはなりません:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-red-300 mb-2">技術的禁止事項</h4>
                  <ul className="text-sm space-y-1">
                    <li>• 過度なアクセス・スクレイピング</li>
                    <li>• サーバーへの攻撃・負荷をかける行為</li>
                    <li>• 不正アクセス・セキュリティ侵害</li>
                    <li>• APIの悪用・制限回避</li>
                  </ul>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-red-300 mb-2">コンテンツ利用禁止</h4>
                  <ul className="text-sm space-y-1">
                    <li>• データの無断複製・再配布</li>
                    <li>• 出典を明記しない転載</li>
                    <li>• 商用目的での無許可利用</li>
                    <li>• 競合サービスでの流用</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <h4 className="font-medium text-red-300 mb-2">重要: 公序良俗違反</h4>
                <ul className="text-sm space-y-1">
                  <li>• 違法行為・賭博への利用</li>
                  <li>• 誹謗中傷・差別的発言</li>
                  <li>• プライバシー侵害</li>
                  <li>• その他社会的に不適切な利用</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 知的財産権 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">第5条（知的財産権）</h2>
            <div className="text-slate-300 space-y-4">
              <h3 className="text-lg font-medium text-white">当サイトの権利</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>サイトデザイン・UI/UXの著作権</li>
                <li>独自計算式・アルゴリズムの知的財産権</li>
                <li>分析結果・レポートの著作権</li>
                <li>「Baseball AI Media」商標・ブランド権</li>
              </ul>
              
              <h3 className="text-lg font-medium text-white">第三者の権利</h3>
              <p>
                NPB公式統計データの権利は日本野球機構に帰属します。
                当サイトは公開されている統計情報を適正に利用し、独自の分析・解釈を加えて提供しています。
              </p>
              
              <h3 className="text-lg font-medium text-white">適正な引用</h3>
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm">
                  当サイトのコンテンツを引用する場合は、以下を明記してください:<br/>
                  「出典: Baseball AI Media (https://baseball-ai-media.vercel.app/)」
                </p>
              </div>
            </div>
          </section>

          {/* 免責事項 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">第6条（免責事項）</h2>
            <div className="text-slate-300 space-y-4">
              <h3 className="text-lg font-medium text-white">データ精度について</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>統計データの正確性向上に努めますが、完全性を保証するものではありません</li>
                <li>計算エラー・データ更新遅延が発生する可能性があります</li>
                <li>NPB公式記録との相違が生じる場合があります</li>
              </ul>
              
              <h3 className="text-lg font-medium text-white">サービス継続性</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>システムメンテナンス・障害によるサービス中断</li>
                <li>予告なしのサービス変更・終了の可能性</li>
                <li>外部API・データソース変更による機能制限</li>
              </ul>
              
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-medium text-yellow-300 mb-2">損害賠償の制限</h4>
                <p className="text-sm">
                  当サイトの利用により生じた損害について、法令で定められた範囲を除き、
                  一切の責任を負いません。投資・賭博等の判断材料としての利用は推奨しません。
                </p>
              </div>
            </div>
          </section>

          {/* 規約変更 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">第7条（規約の変更）</h2>
            <div className="text-slate-300 space-y-4">
              <p>
                当サイトは、法令改正やサービス変更に伴い、予告なく本規約を変更することがあります。
                変更後の規約は、当サイトに掲載された時点で効力を生じます。
              </p>
              <p>
                重要な変更については、サイト内での告知により事前にお知らせするよう努めます。
                変更後も継続してサービスをご利用いただくことで、変更に同意いただいたものとみなします。
              </p>
            </div>
          </section>

          {/* 準拠法・管轄裁判所 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">第8条（準拠法・管轄裁判所）</h2>
            <div className="text-slate-300 space-y-4">
              <p>
                本規約の解釈・適用については、日本国法に準拠します。
                本サービスに関する紛争については、当サイト運営者の所在地を管轄する裁判所を
                第一審の専属的合意管轄裁判所とします。
              </p>
            </div>
          </section>

          {/* 連絡先 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">お問い合わせ</h2>
            <div className="text-slate-300 space-y-4">
              <p>本規約に関するご質問・ご相談は以下までお寄せください:</p>
              
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="font-medium text-white mb-2">Baseball AI Media 運営チーム</p>
                <p className="text-sm">
                  <strong>Web:</strong> <Link href="/about" className="text-blue-400 hover:text-blue-300 underline">お問い合わせフォーム</Link><br/>
                  <strong>GitHub:</strong> <a href="https://github.com/mizutkoij/baseball-ai-media/issues" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener">Issues</a>
                </p>
              </div>
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