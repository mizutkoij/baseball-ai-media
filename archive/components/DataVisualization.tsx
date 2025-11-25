/**
 * components/DataVisualization.tsx - データ可視化コンポーネント
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Users, BarChart3, Activity, Loader2 } from 'lucide-react'

interface TeamRosterData {
  team: string
  playerCount: number
  lastUpdated: string
  players: Array<{
    name: string
    number: number | null
    position: string
  }>
}

interface GameData {
  gameDate: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: string
}

interface StatsData {
  playerName: string
  team: string
  battingAvg: number | null
  homeRuns: number | null
  rbis: number | null
  era: number | null
  wins: number | null
  losses: number | null
  dataDate: string
}

interface CollectionMetrics {
  totalCollectedToday: number
  totalFiles: number
  lastCollectionTime: string
  collectionStatus: {
    completed: number
    pending: number
    failed: number
  }
  recentActivity: Array<{
    timestamp: string
    action: string
    target: string
    status: string
  }>
}

const DataVisualization = () => {
  const [rosters, setRosters] = useState<TeamRosterData[]>([])
  const [games, setGames] = useState<GameData[]>([])
  const [stats, setStats] = useState<StatsData[]>([])
  const [metrics, setMetrics] = useState<CollectionMetrics | null>(null)
  const [teams, setTeams] = useState<string[]>([])
  
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [selectedTeam])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [rostersRes, gamesRes, statsRes, metricsRes, teamsRes] = await Promise.all([
        fetch(`/api/baseball/rosters${selectedTeam !== 'all' ? `?team=${selectedTeam}` : ''}`),
        fetch('/api/baseball/games'),
        fetch(`/api/baseball/stats${selectedTeam !== 'all' ? `?team=${selectedTeam}` : ''}?limit=10`),
        fetch('/api/baseball/metrics'),
        fetch('/api/baseball/teams')
      ])

      if (!rostersRes.ok || !gamesRes.ok || !statsRes.ok || !metricsRes.ok || !teamsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const [rostersData, gamesData, statsData, metricsData, teamsData] = await Promise.all([
        rostersRes.json(),
        gamesRes.json(),
        statsRes.json(),
        metricsRes.json(),
        teamsRes.json()
      ])

      setRosters(rostersData.data.rosters)
      setGames(gamesData.data.games)
      setStats(statsData.data.players)
      setMetrics(metricsData.data.metrics)
      setTeams(teamsData.data.teams)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">データを読み込んでいます...</span>
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
      {/* フィルター */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            野球データダッシュボード
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <select 
              value={selectedTeam} 
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-48 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">全チーム</option>
              {teams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
            <Button onClick={fetchData} variant="outline">
              更新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* メトリクス */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">今日の収集</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalCollectedToday}</div>
              <p className="text-xs text-muted-foreground">レコード</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">総ファイル数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalFiles}</div>
              <p className="text-xs text-muted-foreground">ファイル</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">最終収集</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {metrics.lastCollectionTime ? 
                  new Date(metrics.lastCollectionTime).toLocaleString('ja-JP') : 
                  '未実行'
                }
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">システム状態</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-green-600">
                <Activity className="h-3 w-3 mr-1" />
                稼働中
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ロスターデータ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            チーム別ロスター ({selectedTeam === 'all' ? '全チーム' : selectedTeam})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rosters.map((roster) => (
              <Card key={roster.team} className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{roster.team}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {roster.playerCount}名 | 更新: {roster.lastUpdated}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {roster.players.slice(0, 5).map((player, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{player.name}</span>
                        <span className="text-muted-foreground">
                          {player.number ? `#${player.number}` : ''} {player.position}
                        </span>
                      </div>
                    ))}
                    {roster.players.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{roster.players.length - 5}名
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 最近の試合 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            最近の試合
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {games.slice(0, 10).map((game, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 border rounded">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground min-w-20">
                    {game.gameDate}
                  </span>
                  <span className="font-medium">
                    {game.awayTeam} vs {game.homeTeam}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {game.homeScore !== null && game.awayScore !== null ? (
                    <span className="font-mono">
                      {game.awayScore} - {game.homeScore}
                    </span>
                  ) : (
                    <Badge variant="outline">{game.status}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 選手統計 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            選手統計 ({selectedTeam === 'all' ? '全チーム' : selectedTeam})
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
                  <th className="text-right py-2">本塁打</th>
                  <th className="text-right py-2">打点</th>
                  <th className="text-right py-2">防御率</th>
                  <th className="text-right py-2">勝利</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((player, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 font-medium">{player.playerName}</td>
                    <td className="py-2 text-muted-foreground">{player.team}</td>
                    <td className="py-2 text-right">
                      {player.battingAvg ? player.battingAvg.toFixed(3) : '-'}
                    </td>
                    <td className="py-2 text-right">{player.homeRuns || '-'}</td>
                    <td className="py-2 text-right">{player.rbis || '-'}</td>
                    <td className="py-2 text-right">
                      {player.era ? player.era.toFixed(2) : '-'}
                    </td>
                    <td className="py-2 text-right">{player.wins || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DataVisualization