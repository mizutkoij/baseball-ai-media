/**
 * app/data/page.tsx - データダッシュボードページ
 */

import { Metadata } from 'next'
import DataVisualization from '@/components/DataVisualization'

export const metadata: Metadata = {
  title: '野球データダッシュボード | Baseball AI Media',
  description: '収集された野球データの可視化ダッシュボード。チーム別ロスター、試合結果、選手統計を確認できます。',
}

export default function DataPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">野球データダッシュボード</h1>
        <p className="text-muted-foreground">
          継続収集システムによって収集された野球データを可視化して表示します。
        </p>
      </div>
      
      <DataVisualization />
    </div>
  )
}