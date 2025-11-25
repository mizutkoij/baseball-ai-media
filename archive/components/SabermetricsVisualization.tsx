/**
 * components/SabermetricsVisualization.tsx - セイバーメトリクス可視化コンポーネント
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, Activity, Calculator, Zap, Users, Trophy, Loader2, RefreshCw } from 'lucide-react'

interface SabermetricsData {
  name: string
  team: string
  league: 'NPB' | 'MLB'
  season: number
  playerType: 'batter' | 'pitcher'
  // 打撃指標
  battingAverage?: number
  onBasePercentage?: number
  sluggingPercentage?: number
  ops?: number
  woba?: number
  wrcPlus?: number
  babip?: number
  isolatedPower?: number
  walkRate?: number
  strikeoutRate?: number
  // 投手指標
  earnedRunAverage?: number
  whip?: number
  fip?: number
  xfip?: number
  soBbRatio?: number
  soPer9?: number
  bbPer9?: number
  hrPer9?: number
}

interface ComparisonData {
  npb: SabermetricsData[]
  mlb: SabermetricsData[]
}

const SabermetricsVisualization = () => {
  const [npbData, setNpbData] = useState<SabermetricsData[]>([])
  const [mlbData, setMlbData] = useState<SabermetricsData[]>([])
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [activeTab, setActiveTab] = useState('npb-batters')
  const [selectedMetric, setSelectedMetric] = useState('ops')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      // NPBデータ取得
      const [npbBattersRes, npbPitchersRes, mlbBattersRes, mlbPitchersRes] = await Promise.all([
        fetch('/api/sabermetrics/npb?type=batter&limit=15'),
        fetch('/api/sabermetrics/npb?type=pitcher&limit=15'),
        fetch('/api/sabermetrics/mlb?type=batting&limit=15'),
        fetch('/api/sabermetrics/mlb?type=pitching&limit=15')
      ])

      const [npbBatters, npbPitchers, mlbBatters, mlbPitchers] = await Promise.all([
        npbBattersRes.json(),
        npbPitchersRes.json(),
        mlbBattersRes.json(),
        mlbPitchersRes.json()
      ])

      if (npbBatters.success) {
        setNpbData([
          ...(npbBatters.data.sabermetrics || []),
          ...(npbPitchers.data.sabermetrics || [])
        ])
      }

      if (mlbBatters.success && mlbBatters.data.sabermetrics) {
        setMlbData([
          ...(mlbBatters.data.sabermetrics.batting || []),
          ...(mlbPitchers.data.sabermetrics.pitching || [])
        ])
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const calculateSabermetrics = async (league: 'NPB' | 'MLB') => {
    setCalculating(true)
    try {
      const response = await fetch('/api/sabermetrics/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league,
          season: league === 'NPB' ? 2025 : 2023
        })
      })

      const result = await response.json()
      if (result.success) {
        await fetchData() // データ再取得
      } else {
        setError(result.error || 'Calculation failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error')
    } finally {
      setCalculating(false)
    }
  }

  const fetchComparison = async (metric: string, playerType: 'batter' | 'pitcher') => {
    try {
      const response = await fetch(`/api/sabermetrics/compare?metric=${metric}&type=${playerType}`)
      const result = await response.json()
      
      if (result.success) {
        setComparisonData(result.data.comparison)
      }
    } catch (err) {
      console.error('Comparison fetch error:', err)
    }
  }

  const formatMetric = (value: number | undefined, decimals: number = 3): string => {
    if (value === undefined || value === null) return '-'
    return value.toFixed(decimals)
  }

  const getMetricDescription = (metric: string): string => {
    const descriptions: { [key: string]: string } = {
      'ops': 'OPS - 出塁率 + 長打率',
      'woba': 'wOBA - 重み付き出塁率',
      'wrc_plus': 'wRC+ - リーグ平均を100とした攻撃貢献度',
      'fip': 'FIP - 守備に依存しない投手成績',
      'era': 'ERA - 防御率',
      'whip': 'WHIP - 1イニングあたりの被安打+四球'
    }
    return descriptions[metric] || metric.toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">セイバーメトリクスデータを読み込んでいます...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">エラー: {error}</p>
        <Button onClick={fetchData}>再試行</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            セイバーメトリクス分析ダッシュボード
          </CardTitle>
          <div className="flex gap-4">
            <Button 
              onClick={() => calculateSabermetrics('NPB')}
              disabled={calculating}
              variant="outline"
            >
              {calculating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
              NPB計算実行
            </Button>
            <Button 
              onClick={() => calculateSabermetrics('MLB')}
              disabled={calculating}
              variant="outline"
            >
              <Calculator className="h-4 w-4 mr-2" />
              MLB統合実行
            </Button>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              データ更新
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* タブ表示 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="npb-batters">NPB打者</TabsTrigger>
          <TabsTrigger value="npb-pitchers">NPB投手</TabsTrigger>
          <TabsTrigger value="mlb-batters">MLB打者</TabsTrigger>
          <TabsTrigger value="mlb-pitchers">MLB投手</TabsTrigger>
        </TabsList>

        {/* NPB打者 */}
        <TabsContent value="npb-batters">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                NPB打者セイバーメトリクス (2025)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">選手名</th>
                      <th className="text-left py-2">チーム</th>
                      <th className="text-right py-2">打率</th>
                      <th className="text-right py-2">出塁率</th>
                      <th className="text-right py-2">長打率</th>
                      <th className="text-right py-2">OPS</th>
                      <th className="text-right py-2">wOBA</th>
                      <th className="text-right py-2">wRC+</th>
                      <th className="text-right py-2">BABIP</th>
                      <th className="text-right py-2">ISO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {npbData
                      .filter(player => player.playerType === 'batter')
                      .slice(0, 15)
                      .map((player, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2 font-medium">{player.name}</td>
                          <td className="py-2">
                            <Badge variant="outline">{player.team}</Badge>
                          </td>
                          <td className="py-2 text-right">{formatMetric(player.battingAverage)}</td>
                          <td className="py-2 text-right">{formatMetric(player.onBasePercentage)}</td>
                          <td className="py-2 text-right">{formatMetric(player.sluggingPercentage)}</td>
                          <td className="py-2 text-right font-bold">{formatMetric(player.ops)}</td>
                          <td className="py-2 text-right">{formatMetric(player.woba)}</td>
                          <td className="py-2 text-right">{formatMetric(player.wrcPlus, 0)}</td>
                          <td className="py-2 text-right">{formatMetric(player.babip)}</td>
                          <td className="py-2 text-right">{formatMetric(player.isolatedPower)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NPB投手 */}
        <TabsContent value="npb-pitchers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                NPB投手セイバーメトリクス (2025)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">選手名</th>
                      <th className="text-left py-2">チーム</th>
                      <th className="text-right py-2">防御率</th>
                      <th className="text-right py-2">WHIP</th>
                      <th className="text-right py-2">FIP</th>
                      <th className="text-right py-2">xFIP</th>
                      <th className="text-right py-2">SO/BB</th>
                      <th className="text-right py-2">SO/9</th>
                      <th className="text-right py-2">BB/9</th>
                      <th className="text-right py-2">HR/9</th>
                    </tr>
                  </thead>
                  <tbody>
                    {npbData
                      .filter(player => player.playerType === 'pitcher')
                      .slice(0, 15)
                      .map((player, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2 font-medium">{player.name}</td>
                          <td className="py-2">
                            <Badge variant="outline">{player.team}</Badge>
                          </td>
                          <td className="py-2 text-right">{formatMetric(player.earnedRunAverage, 2)}</td>
                          <td className="py-2 text-right">{formatMetric(player.whip, 2)}</td>
                          <td className="py-2 text-right font-bold">{formatMetric(player.fip, 2)}</td>
                          <td className="py-2 text-right">{formatMetric(player.xfip, 2)}</td>
                          <td className="py-2 text-right">{formatMetric(player.soBbRatio, 2)}</td>
                          <td className="py-2 text-right">{formatMetric(player.soPer9, 2)}</td>
                          <td className="py-2 text-right">{formatMetric(player.bbPer9, 2)}</td>
                          <td className="py-2 text-right">{formatMetric(player.hrPer9, 2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MLB打者 */}
        <TabsContent value="mlb-batters">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                MLB打者セイバーメトリクス (2023)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mlbData.filter(player => player.playerType === 'batter').length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">選手名</th>
                        <th className="text-left py-2">チーム</th>
                        <th className="text-right py-2">打率</th>
                        <th className="text-right py-2">出塁率</th>
                        <th className="text-right py-2">長打率</th>
                        <th className="text-right py-2">OPS</th>
                        <th className="text-right py-2">wRC+</th>
                        <th className="text-right py-2">BABIP</th>
                        <th className="text-right py-2">ISO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mlbData
                        .filter(player => player.playerType === 'batter')
                        .slice(0, 15)
                        .map((player, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2 font-medium">{player.name}</td>
                            <td className="py-2">
                              <Badge variant="secondary">{player.team}</Badge>
                            </td>
                            <td className="py-2 text-right">{formatMetric(player.battingAverage)}</td>
                            <td className="py-2 text-right">{formatMetric(player.onBasePercentage)}</td>
                            <td className="py-2 text-right">{formatMetric(player.sluggingPercentage)}</td>
                            <td className="py-2 text-right font-bold">{formatMetric(player.ops)}</td>
                            <td className="py-2 text-right">{formatMetric(player.wrcPlus, 0)}</td>
                            <td className="py-2 text-right">{formatMetric(player.babip)}</td>
                            <td className="py-2 text-right">{formatMetric(player.isolatedPower)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8">
                  <p className="text-muted-foreground mb-4">
                    MLBデータはまだ統合されていません
                  </p>
                  <Button onClick={() => calculateSabermetrics('MLB')} variant="outline">
                    MLB統合実行
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MLB投手 */}
        <TabsContent value="mlb-pitchers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                MLB投手セイバーメトリクス (2023)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mlbData.filter(player => player.playerType === 'pitcher').length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">選手名</th>
                        <th className="text-left py-2">チーム</th>
                        <th className="text-right py-2">防御率</th>
                        <th className="text-right py-2">WHIP</th>
                        <th className="text-right py-2">FIP</th>
                        <th className="text-right py-2">SO/BB</th>
                        <th className="text-right py-2">SO/9</th>
                        <th className="text-right py-2">BB/9</th>
                        <th className="text-right py-2">HR/9</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mlbData
                        .filter(player => player.playerType === 'pitcher')
                        .slice(0, 15)
                        .map((player, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2 font-medium">{player.name}</td>
                            <td className="py-2">
                              <Badge variant="secondary">{player.team}</Badge>
                            </td>
                            <td className="py-2 text-right">{formatMetric(player.earnedRunAverage, 2)}</td>
                            <td className="py-2 text-right">{formatMetric(player.whip, 2)}</td>
                            <td className="py-2 text-right font-bold">{formatMetric(player.fip, 2)}</td>
                            <td className="py-2 text-right">{formatMetric(player.soBbRatio, 2)}</td>
                            <td className="py-2 text-right">{formatMetric(player.soPer9, 2)}</td>
                            <td className="py-2 text-right">{formatMetric(player.bbPer9, 2)}</td>
                            <td className="py-2 text-right">{formatMetric(player.hrPer9, 2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8">
                  <p className="text-muted-foreground mb-4">
                    MLBデータはまだ統合されていません
                  </p>
                  <Button onClick={() => calculateSabermetrics('MLB')} variant="outline">
                    MLB統合実行
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 比較セクション */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            NPB vs MLB 比較分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">指標選択</label>
              <select 
                value={selectedMetric} 
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="ops">OPS (打者)</option>
                <option value="woba">wOBA (打者)</option>
                <option value="wrc_plus">wRC+ (打者)</option>
                <option value="fip">FIP (投手)</option>
                <option value="era">ERA (投手)</option>
                <option value="whip">WHIP (投手)</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => fetchComparison(selectedMetric, selectedMetric === 'ops' || selectedMetric === 'woba' || selectedMetric === 'wrc_plus' ? 'batter' : 'pitcher')}
                className="w-full"
              >
                比較実行
              </Button>
            </div>
            <div className="text-sm text-muted-foreground flex items-end">
              {getMetricDescription(selectedMetric)}
            </div>
          </div>

          {comparisonData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">NPB トップ10</h4>
                <div className="space-y-2">
                  {comparisonData.npb.slice(0, 10).map((player, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 border rounded">
                      <span className="font-medium">{player.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{player.team}</Badge>
                        <span className="font-mono">{formatMetric((player as any).metricValue, 3)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">MLB トップ10</h4>
                <div className="space-y-2">
                  {comparisonData.mlb.slice(0, 10).map((player, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 border rounded">
                      <span className="font-medium">{player.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{player.team}</Badge>
                        <span className="font-mono">{formatMetric((player as any).metricValue, 3)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SabermetricsVisualization