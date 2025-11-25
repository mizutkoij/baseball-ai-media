import YahooDataDashboard from '@/components/YahooDataDashboard';
import LivePitchTracker from '@/components/LivePitchTracker';

export default function YahooAdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Yahoo野球データ管理</h1>
        <p className="text-gray-600">
          Yahoo野球スクレイピングシステムで収集したデータの管理と統合
        </p>
      </div>

      <div className="space-y-8">
        {/* データ統計・同期ダッシュボード */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">データ統計・同期管理</h2>
          <YahooDataDashboard />
        </section>

        {/* リアルタイム一球速報 */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">最新の一球速報</h2>
          <LivePitchTracker autoRefresh={true} refreshInterval={30000} />
        </section>

        {/* システム情報 */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">システム情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">収集システム</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 24時間連続稼働中</li>
                <li>• 45分/試合のペースで処理</li>
                <li>• Yahoo野球APIからデータ収集</li>
                <li>• レート制限: 8-15秒間隔</li>
              </ul>
            </div>
            
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">データ品質</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• 一球ごとの詳細データ</li>
                <li>• 投手・打者・球種・球速</li>
                <li>• カウント・ランナー状況</li>
                <li>• 自動重複排除</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Yahoo野球データ管理 | Baseball AI Media',
  description: 'Yahoo野球スクレイピングデータの管理と統合システム',
};