'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download, RefreshCw, Info } from 'lucide-react'

interface HeatmapData {
  pitcher_id: string
  batter_side: 'L' | 'R'
  count_bucket: string
  grid: {
    width: number
    height: number
  }
  empirical: Record<string, number[][]>
  model: Record<string, number[][]>
  metadata: {
    sample_size: number
    quality_score: number
    updated_at: string
    computed_from_date: string
    computed_to_date: string
  }
  available: boolean
}

interface HeatmapGridProps {
  data: number[][]
  title: string
  pitchType: string
  maxValue?: number
}

function HeatmapGrid({ data, title, pitchType, maxValue = 1 }: HeatmapGridProps) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm text-gray-700">{title} - {pitchType}</h4>
      <div className="grid grid-cols-13 gap-0.5 max-w-md">
        {data.map((row, y) =>
          row.map((value, x) => {
            const intensity = maxValue > 0 ? value / maxValue : 0
            const alpha = Math.min(1, Math.max(0.1, intensity))
            
            return (
              <div
                key={`${y}-${x}`}
                className="w-4 h-4 border border-gray-200 flex items-center justify-center text-xs"
                style={{
                  backgroundColor: intensity > 0.1 
                    ? `rgba(59, 130, 246, ${alpha})` 
                    : 'rgba(229, 231, 235, 0.3)',
                  color: intensity > 0.5 ? 'white' : 'black'
                }}
                title={`(${x}, ${y}): ${(value * 100).toFixed(1)}%`}
              >
                {intensity > 0.2 ? Math.round(value * 100) : ''}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const PITCHERS = [
  { id: 'G#18_Sugano', name: '菅野智之 (G)' },
  { id: 'T#16_Nishi', name: '西勇輝 (T)' },
  { id: 'H#11_Imamiya', name: '今宮健太 (H)' },
  { id: 'S#19_Yamamoto', name: '山本由伸 (S)' }
]

const COUNT_BUCKETS = [
  { value: 'start', label: '打席開始 (0-0)' },
  { value: 'ahead', label: '投手有利' },
  { value: 'behind', label: '投手不利' },
  { value: 'even', label: '互角' },
  { value: 'two_strike', label: 'ツーストライク' },
  { value: 'full', label: 'フルカウント' }
]

export default function HeatmapPage() {
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedPitcher, setSelectedPitcher] = useState('G#18_Sugano')
  const [selectedSide, setSelectedSide] = useState<'L' | 'R'>('R')
  const [selectedCount, setSelectedCount] = useState('even')

  const fetchHeatmap = async () => {
    if (!selectedPitcher || !selectedSide || !selectedCount) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        pitcher: selectedPitcher,
        side: selectedSide,
        countBucket: selectedCount
      })

      const response = await fetch(`/api/heatmap?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch heatmap')
      }

      const data = await response.json()
      setHeatmapData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setHeatmapData(null)
    } finally {
      setLoading(false)
    }
  }

  // 初回ロード
  useEffect(() => {
    fetchHeatmap()
  }, [selectedPitcher, selectedSide, selectedCount])

  const downloadHeatmap = () => {
    if (!heatmapData) return

    const data = {
      ...heatmapData,
      downloaded_at: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `heatmap_${selectedPitcher}_${selectedSide}_${selectedCount}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800'
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          投球ヒートマップ分析
        </h1>
        <p className="text-gray-600">
          投手の配球パターンを13×13グリッドで可視化。実測分布とNextPitchモデル予測を比較できます。
        </p>
      </div>

      {/* 条件選択 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            分析条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">投手</label>
              <select 
                value={selectedPitcher} 
                onChange={(e) => setSelectedPitcher(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PITCHERS.map(pitcher => (
                  <option key={pitcher.id} value={pitcher.id}>
                    {pitcher.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">打者左右</label>
              <select 
                value={selectedSide} 
                onChange={(e) => setSelectedSide(e.target.value as 'L' | 'R')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="R">右打者</option>
                <option value="L">左打者</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">カウント状況</label>
              <select 
                value={selectedCount} 
                onChange={(e) => setSelectedCount(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {COUNT_BUCKETS.map(bucket => (
                  <option key={bucket.value} value={bucket.value}>
                    {bucket.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">アクション</label>
              <div className="flex gap-2">
                <Button 
                  onClick={fetchHeatmap} 
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                {heatmapData && (
                  <Button onClick={downloadHeatmap} variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* エラー表示 */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">エラー: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* ローディング */}
      {loading && (
        <Card className="mb-6">
          <CardContent className="pt-6 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>ヒートマップを読み込み中...</span>
          </CardContent>
        </Card>
      )}

      {/* ヒートマップデータ表示 */}
      {heatmapData && heatmapData.available && (
        <>
          {/* メタデータ */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>データ品質</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">サンプル数</p>
                  <p className="text-lg font-semibold">{heatmapData.metadata.sample_size.toLocaleString()} 球</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">品質スコア</p>
                  <Badge className={getQualityColor(heatmapData.metadata.quality_score)}>
                    {(heatmapData.metadata.quality_score * 100).toFixed(1)}%
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">データ期間</p>
                  <p className="text-sm">{heatmapData.metadata.computed_from_date} ～ {heatmapData.metadata.computed_to_date}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">最終更新</p>
                  <p className="text-sm">{new Date(heatmapData.metadata.updated_at).toLocaleString('ja-JP')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ヒートマップグリッド */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 実測分布 */}
            <Card>
              <CardHeader>
                <CardTitle>実測分布 (Empirical)</CardTitle>
                <p className="text-sm text-gray-600">実際の投球位置頻度</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(heatmapData.empirical).map(([pitchType, grid]) => {
                    const maxValue = Math.max(...grid.flat())
                    return (
                      <HeatmapGrid
                        key={`empirical-${pitchType}`}
                        data={grid}
                        title="実測"
                        pitchType={pitchType}
                        maxValue={maxValue}
                      />
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* モデル予測分布 */}
            <Card>
              <CardHeader>
                <CardTitle>モデル予測 (Model)</CardTitle>
                <p className="text-sm text-gray-600">NextPitchモデルによる空間分布予測</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(heatmapData.model).map(([pitchType, grid]) => {
                    const maxValue = Math.max(...grid.flat())
                    return (
                      <HeatmapGrid
                        key={`model-${pitchType}`}
                        data={grid}
                        title="モデル"
                        pitchType={pitchType}
                        maxValue={maxValue}
                      />
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 使用方法 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>使用方法</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• 各セルにマウスホバーで正確な確率値が表示されます</p>
                <p>• 実測分布：過去の実際の投球データに基づく頻度分布</p>
                <p>• モデル予測：NextPitchモデルによる球種選択確率を空間に再配分した分布</p>
                <p>• 色の濃さが確率の高さを表現（青色：高確率、薄グレー：低確率）</p>
                <p>• ダウンロードボタンでJSONデータを保存可能</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* データなしの場合 */}
      {heatmapData && !heatmapData.available && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-yellow-600">
              選択した条件でのヒートマップデータが見つかりません。
              他の投手・カウント条件をお試しください。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}