/**
 * app/sabermetrics/page.tsx - セイバーメトリクス分析ページ
 */

import { Metadata } from 'next'
import SabermetricsVisualization from '@/components/SabermetricsVisualization'

export const metadata: Metadata = {
  title: 'セイバーメトリクス分析 | Baseball AI Media',
  description: 'NPBとMLBの高度な野球統計指標（セイバーメトリクス）を分析・比較。wOBA、FIP、wRC+などの指標でプレーヤーを評価します。',
  keywords: 'セイバーメトリクス, 野球統計, wOBA, FIP, OPS, wRC+, NPB, MLB, 野球分析'
}

export default function SabermetricsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">セイバーメトリクス分析</h1>
        <p className="text-muted-foreground">
          収集されたNPBデータとMLBデータから高度な野球統計指標を計算・分析し、両リーグの比較も行います。
        </p>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium mb-2">主要指標の説明</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div><strong>wOBA:</strong> 重み付き出塁率 - 各結果の価値を重み付けした出塁指標</div>
            <div><strong>FIP:</strong> 守備に依存しない投手成績 - 奪三振、四球、本塁打のみで評価</div>
            <div><strong>wRC+:</strong> リーグ平均を100とした攻撃貢献度</div>
            <div><strong>xFIP:</strong> FIPの本塁打を正常化した版</div>
            <div><strong>BABIP:</strong> インプレーボールでの打率</div>
            <div><strong>ISO:</strong> 長打力指標（長打率-打率）</div>
          </div>
        </div>
      </div>
      
      <SabermetricsVisualization />
    </div>
  )
}