'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Filter, Globe, Trophy, TrendingUp } from 'lucide-react'
import { PlayerExportButton } from '@/components/PlayerExportButton'

// KBO team data
const KBO_TEAMS = {
  'Doosan Bears': { 
    city: 'Seoul', 
    stadium: 'Jamsil Baseball Stadium', 
    founded: 1982, 
    colors: ['Navy', 'Red'],
    logo: '🐻'
  },
  'Hanwha Eagles': { 
    city: 'Daejeon', 
    stadium: 'Daejeon Hanwha Life Ballpark', 
    founded: 1985, 
    colors: ['Orange', 'Black'],
    logo: '🦅'
  },
  'Kia Tigers': { 
    city: 'Gwangju', 
    stadium: 'Gwangju Champions Field', 
    founded: 1982, 
    colors: ['Red', 'Black'],
    logo: '🐅'
  },
  'LG Twins': { 
    city: 'Seoul', 
    stadium: 'Jamsil Baseball Stadium', 
    founded: 1982, 
    colors: ['Red', 'Gray'],
    logo: '⚾'
  },
  'Lotte Giants': { 
    city: 'Busan', 
    stadium: 'Sajik Baseball Stadium', 
    founded: 1975, 
    colors: ['Blue', 'White'],
    logo: '🔵'
  },
  'NC Dinos': { 
    city: 'Changwon', 
    stadium: 'Changwon NC Park', 
    founded: 2013, 
    colors: ['Blue', 'Gold'],
    logo: '🦕'
  },
  'Samsung Lions': { 
    city: 'Daegu', 
    stadium: 'Daegu Samsung Lions Park', 
    founded: 1982, 
    colors: ['Blue', 'White'],
    logo: '🦁'
  },
  'SSG Landers': { 
    city: 'Incheon', 
    stadium: 'Incheon SSG Landers Field', 
    founded: 2000, 
    colors: ['Red', 'Black'],
    logo: '🚀'
  },
  'KT Wiz': { 
    city: 'Suwon', 
    stadium: 'Suwon KT Wiz Park', 
    founded: 2015, 
    colors: ['Black', 'Red'],
    logo: '🧙‍♂️'
  },
  'Kiwoom Heroes': { 
    city: 'Seoul', 
    stadium: 'Gocheok Sky Dome', 
    founded: 2008, 
    colors: ['Burgundy', 'Gold'],
    logo: '🦸‍♂️'
  }
}

interface Player {
  player_id: number
  name: string
  team: string
  position: string
  nationality: string
  age?: number
  jersey_number?: number
}

interface Team {
  team_id: number
  team_name: string
  team_code: string
  city: string
  stadium: string
  founded: number
  capacity: number
  manager: string
  primary_color: string
  secondary_color: string
  logo_emoji: string
  total_championships: number
}

interface Game {
  game_id: number
  game_date: string
  season: number
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  innings: number
  stadium: string
  attendance: number
  weather: string
  home_team_name: string
  away_team_name: string
  home_logo: string
  away_logo: string
}

export default function KBOLeaguePage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [selectedPosition, setSelectedPosition] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState('teams')
  const [advancedStats, setAdvancedStats] = useState<any[]>([])
  const [leagueAverages, setLeagueAverages] = useState<any>({})

  useEffect(() => {
    fetchKBOData()
  }, [])

  const fetchKBOData = async () => {
    try {
      // Fetch players
      const playersResponse = await fetch('/api/league-players?league=kbo&limit=800')
      const playersData = await playersResponse.json()
      setPlayers(playersData.players || [])
      
      // Fetch teams
      const teamsResponse = await fetch('/api/kbo/teams')
      const teamsData = await teamsResponse.json()
      setTeams(teamsData.teams || [])
      
      // Fetch recent games
      const gamesResponse = await fetch('/api/kbo/games?limit=20')
      const gamesData = await gamesResponse.json()
      setGames(gamesData.games || [])
      
      // Fetch advanced statistics
      const advancedResponse = await fetch('/api/kbo/advanced-stats?limit=100')
      const advancedData = await advancedResponse.json()
      setAdvancedStats(advancedData.advanced_stats || [])
      setLeagueAverages(advancedData.league_averages || {})
      
      // Generate stats from player data
      generateStats(playersData.players || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching KBO data:', error)
      setLoading(false)
    }
  }

  const generateStats = (playerData: Player[]) => {
    const teamStats: Record<string, any> = {}
    
    Object.keys(KBO_TEAMS).forEach(team => {
      const teamPlayers = playerData.filter(p => p.team === team)
      const koreanPlayers = teamPlayers.filter(p => p.nationality === 'KOR')
      
      const positionBreakdown: Record<string, number> = {}
      teamPlayers.forEach(player => {
        positionBreakdown[player.position] = (positionBreakdown[player.position] || 0) + 1
      })

      teamStats[team] = {
        total_players: teamPlayers.length,
        korean_percentage: (koreanPlayers.length / teamPlayers.length * 100).toFixed(1),
        foreign_players: teamPlayers.length - koreanPlayers.length,
        position_breakdown: positionBreakdown,
        ...KBO_TEAMS[team as keyof typeof KBO_TEAMS]
      }
    })

    setStats(teamStats)
  }

  const filteredPlayers = players.filter(player => {
    if (selectedTeam !== 'all' && player.team !== selectedTeam) return false
    if (selectedPosition !== 'all' && player.position !== selectedPosition) return false
    return true
  })

  const nationalityStats = players.reduce((acc, player) => {
    acc[player.nationality] = (acc[player.nationality] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const positionStats = players.reduce((acc, player) => {
    acc[player.position] = (acc[player.position] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Navigation */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-slate-600 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              KBO
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Korean Baseball Organization</h1>
              <p className="text-slate-600">한국야구위원회 • Complete Player Database</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                <Users className="w-4 h-4 inline mr-1" />
                {players.length} Players
              </div>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                <Trophy className="w-4 h-4 inline mr-1" />
                10 Teams
              </div>
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                <Globe className="w-4 h-4 inline mr-1" />
                Founded 1982
              </div>
              <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                144 Games/Season
              </div>
            </div>
            <button
              onClick={() => {
                // Export all KBO teams data as JSON
                const exportData = {
                  league: 'KBO',
                  export_date: new Date().toISOString(),
                  total_players: players.length,
                  teams: Object.keys(KBO_TEAMS).length,
                  team_stats: stats,
                  nationality_distribution: nationalityStats,
                  position_distribution: positionStats
                };
                
                const json = JSON.stringify(exportData, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `kbo-league-summary-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              リーグデータ出力
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-sm font-medium text-slate-600 mb-2">Total Players</div>
            <div className="text-2xl font-bold text-slate-900">{players.length}</div>
            <p className="text-xs text-slate-500">Across all positions</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-sm font-medium text-slate-600 mb-2">Korean Players</div>
            <div className="text-2xl font-bold text-slate-900">{nationalityStats.KOR || 0}</div>
            <p className="text-xs text-slate-500">
              {((nationalityStats.KOR || 0) / players.length * 100).toFixed(1)}% of roster
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-sm font-medium text-slate-600 mb-2">Foreign Players</div>
            <div className="text-2xl font-bold text-slate-900">
              {players.length - (nationalityStats.KOR || 0)}
            </div>
            <p className="text-xs text-slate-500">
              From {Object.keys(nationalityStats).filter(n => n !== 'KOR').length} countries
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-sm font-medium text-slate-600 mb-2">Pitchers</div>
            <div className="text-2xl font-bold text-slate-900">{positionStats.P || 0}</div>
            <p className="text-xs text-slate-500">
              {((positionStats.P || 0) / players.length * 100).toFixed(1)}% of players
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'teams', label: 'チーム' },
                { key: 'players', label: '選手' },
                { key: 'games', label: '試合結果' },
                { key: 'stats', label: '統計' },
                { key: 'advanced', label: 'セイバーメトリクス' },
                { key: 'about', label: 'リーグ情報' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'teams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => {
              const teamPlayers = players.filter(p => p.team === team.team_name)
              const koreanPlayers = teamPlayers.filter(p => p.nationality === 'KOR')
              
              return (
                <div key={team.team_id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{team.logo_emoji}</span>
                      <div>
                        <div className="font-bold text-lg">{team.team_name}</div>
                        <div className="text-sm text-slate-600">{team.city}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="font-medium">監督:</span> {team.manager}
                      </div>
                      <div>
                        <span className="font-medium">創設:</span> {team.founded}年
                      </div>
                      <div>
                        <span className="font-medium">選手数:</span> {teamPlayers.length}人
                      </div>
                      <div>
                        <span className="font-medium">韓国人:</span> {koreanPlayers.length}人
                      </div>
                      <div>
                        <span className="font-medium">収容人数:</span> {team.capacity.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">優勝:</span> {team.total_championships}回
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-500 mb-3">
                      🏟️ {team.stadium}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs">チームカラー:</span>
                      <div className="flex gap-1">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: team.primary_color.toLowerCase() }}
                          title={team.primary_color}
                        ></div>
                        {team.secondary_color && (
                          <div 
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: team.secondary_color.toLowerCase() }}
                            title={team.secondary_color}
                          ></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'games' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                最近の試合結果
              </h3>
              <div className="space-y-4">
                {games.slice(0, 10).map((game) => (
                  <div key={game.game_id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-500">{game.game_date}</div>
                      <div className="text-xs text-gray-500">
                        {game.weather} • 観客数: {game.attendance?.toLocaleString()}人
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <span className="text-lg">{game.away_logo}</span>
                          <span className="font-medium">{game.away_team_name}</span>
                        </div>
                        <div className="text-2xl font-bold text-center min-w-[60px]">
                          {game.away_score}
                        </div>
                      </div>
                      
                      <div className="text-lg text-gray-400 mx-4">vs</div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold text-center min-w-[60px]">
                          {game.home_score}
                        </div>
                        <div className="flex items-center gap-2 min-w-[150px] justify-end">
                          <span className="font-medium">{game.home_team_name}</span>
                          <span className="text-lg">{game.home_logo}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      🏟️ {game.stadium} • {game.innings}回{game.innings > 9 ? ' (延長)' : ''}
                    </div>
                  </div>
                ))}
              </div>
              
              {games.length > 10 && (
                <div className="text-center mt-4">
                  <button 
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    onClick={() => {
                      // Fetch more games functionality could be added here
                      alert('より多くの試合結果を表示する機能は実装予定です')
                    }}
                  >
                    さらに表示 ({games.length - 10}試合)
                  </button>
                </div>
              )}
            </div>
            
            {/* Game Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h4 className="font-semibold text-gray-900 mb-3">試合統計</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>総試合数:</span>
                    <span className="font-medium">{games.length}試合</span>
                  </div>
                  <div className="flex justify-between">
                    <span>平均得点:</span>
                    <span className="font-medium">
                      {games.length > 0 ? 
                        (games.reduce((sum, game) => sum + game.home_score + game.away_score, 0) / games.length).toFixed(1) 
                        : '0.0'}点
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>延長戦:</span>
                    <span className="font-medium">
                      {games.filter(g => g.innings > 9).length}試合
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h4 className="font-semibold text-gray-900 mb-3">観客動員</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>平均観客数:</span>
                    <span className="font-medium">
                      {games.length > 0 ? 
                        Math.round(games.reduce((sum, game) => sum + (game.attendance || 0), 0) / games.length).toLocaleString()
                        : '0'}人
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>最大観客数:</span>
                    <span className="font-medium">
                      {games.length > 0 ? 
                        Math.max(...games.map(g => g.attendance || 0)).toLocaleString()
                        : '0'}人
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h4 className="font-semibold text-gray-900 mb-3">ホーム戦績</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>ホーム勝率:</span>
                    <span className="font-medium">
                      {games.length > 0 ? 
                        (games.filter(g => g.home_score > g.away_score).length / games.length * 100).toFixed(1)
                        : '0.0'}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ホーム勝利:</span>
                    <span className="font-medium">
                      {games.filter(g => g.home_score > g.away_score).length}試合
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'players' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 bg-white"
                >
                  <option value="all">All Teams</option>
                  {Object.keys(KBO_TEAMS).map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 bg-white"
                >
                  <option value="all">All Positions</option>
                  {['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div className="text-sm text-slate-600 flex items-center">
                Showing {filteredPlayers.length} players
              </div>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPlayers.slice(0, 100).map(player => (
                <div key={player.player_id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Link 
                        href={`/players/${player.player_id}?league=kbo`}
                        className="font-semibold text-sm hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        {player.name}
                      </Link>
                      <span className={`text-xs px-2 py-1 rounded ${
                        player.nationality === 'KOR' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {player.nationality}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1 mb-3">
                      <div>📍 {player.team}</div>
                      <div>⚾ {player.position}</div>
                      {player.jersey_number && <div>👕 #{player.jersey_number}</div>}
                    </div>
                    <div className="flex gap-2">
                      <Link 
                        href={`/players/${player.player_id}?league=kbo`}
                        className="flex-1 text-center py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                      >
                        詳細
                      </Link>
                      <PlayerExportButton
                        playerId={player.player_id}
                        playerName={player.name}
                        size="sm"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredPlayers.length > 100 && (
              <div className="text-center text-slate-600">
                ... and {filteredPlayers.length - 100} more players
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Nationality Distribution</h3>
              <div className="space-y-2">
                {Object.entries(nationalityStats)
                  .sort(([,a], [,b]) => b - a)
                  .map(([nationality, count]) => (
                  <div key={nationality} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{nationality}</span>
                    <div className="flex items-center gap-2">
                      <div className="text-sm">{count} players</div>
                      <div className="text-xs text-slate-500">
                        ({(count / players.length * 100).toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Position Distribution</h3>
              <div className="space-y-2">
                {Object.entries(positionStats)
                  .sort(([,a], [,b]) => b - a)
                  .map(([position, count]) => (
                  <div key={position} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{position}</span>
                    <div className="flex items-center gap-2">
                      <div className="text-sm">{count} players</div>
                      <div className="text-xs text-slate-500">
                        ({(count / players.length * 100).toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-6">
            {/* League Averages Overview */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                KBOセイバーメトリクス概要
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">平均wOBA</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {leagueAverages.woba ? leagueAverages.woba.toFixed(3) : '-.---'}
                  </div>
                  <div className="text-xs text-gray-500">Weighted On-Base Average</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">平均wRC+</div>
                  <div className="text-2xl font-bold text-green-600">
                    {leagueAverages.wrc_plus ? Math.round(leagueAverages.wrc_plus) : '--'}
                  </div>
                  <div className="text-xs text-gray-500">Weighted Runs Created Plus</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">平均FIP</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {leagueAverages.fip ? leagueAverages.fip.toFixed(2) : '-.--'}
                  </div>
                  <div className="text-xs text-gray-500">Fielding Independent Pitching</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">平均打撃WAR</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {leagueAverages.batting_war ? leagueAverages.batting_war.toFixed(1) : '-.--'}
                  </div>
                  <div className="text-xs text-gray-500">Wins Above Replacement</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">総計算レコード</div>
                  <div className="text-2xl font-bold text-gray-600">
                    {leagueAverages.total_records || 0}
                  </div>
                  <div className="text-xs text-gray-500">Advanced Stats Records</div>
                </div>
              </div>
            </div>

            {/* Top Performers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h4 className="font-semibold text-gray-900 mb-4">打撃WAR上位選手</h4>
                <div className="space-y-3">
                  {advancedStats
                    .filter(player => player.batting_war && player.batting_war > 0)
                    .sort((a, b) => (b.batting_war || 0) - (a.batting_war || 0))
                    .slice(0, 10)
                    .map((player, index) => (
                    <div key={`${player.player_id}-${player.season}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500 w-6">#{index + 1}</span>
                        <div>
                          <div className="font-medium text-sm">{player.full_name}</div>
                          <div className="text-xs text-gray-500">{player.current_team} • {player.season}年</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-purple-600">{player.batting_war?.toFixed(1)} WAR</div>
                        {player.woba && (
                          <div className="text-xs text-gray-500">wOBA: {player.woba.toFixed(3)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h4 className="font-semibold text-gray-900 mb-4">投手WAR上位選手</h4>
                <div className="space-y-3">
                  {advancedStats
                    .filter(player => player.pitching_war && player.pitching_war > 0)
                    .sort((a, b) => (b.pitching_war || 0) - (a.pitching_war || 0))
                    .slice(0, 10)
                    .map((player, index) => (
                    <div key={`${player.player_id}-${player.season}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500 w-6">#{index + 1}</span>
                        <div>
                          <div className="font-medium text-sm">{player.full_name}</div>
                          <div className="text-xs text-gray-500">{player.current_team} • {player.season}年</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">{player.pitching_war?.toFixed(1)} WAR</div>
                        {player.fip && (
                          <div className="text-xs text-gray-500">FIP: {player.fip.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Advanced Stats Table */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h4 className="font-semibold text-gray-900">詳細セイバーメトリクス</h4>
                <p className="text-sm text-gray-600 mt-1">
                  計算された高度な野球統計 • 計{advancedStats.length}レコード
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">選手名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">チーム</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">年度</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">wOBA</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">wRC+</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">打撃WAR</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">FIP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">投手WAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {advancedStats.slice(0, 20).map((player) => (
                      <tr key={`${player.player_id}-${player.season}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{player.full_name}</div>
                          <div className="text-xs text-gray-500">{player.primary_position}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">{player.current_team}</td>
                        <td className="px-4 py-3 text-sm">{player.season}</td>
                        <td className="px-4 py-3 text-sm">
                          {player.woba ? player.woba.toFixed(3) : '---'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {player.wrc_plus ? player.wrc_plus : '---'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${
                            player.batting_war > 2 ? 'text-green-600' :
                            player.batting_war > 1 ? 'text-blue-600' :
                            player.batting_war > 0 ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {player.batting_war ? player.batting_war.toFixed(1) : '---'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {player.fip ? player.fip.toFixed(2) : '---'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${
                            player.pitching_war > 2 ? 'text-green-600' :
                            player.pitching_war > 1 ? 'text-blue-600' :
                            player.pitching_war > 0 ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {player.pitching_war ? player.pitching_war.toFixed(1) : '---'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {advancedStats.length > 20 && (
                <div className="p-4 bg-gray-50 text-center">
                  <span className="text-sm text-gray-600">
                    さらに{advancedStats.length - 20}レコードの詳細統計が利用可能
                  </span>
                </div>
              )}
            </div>

            {/* Sabermetrics Explanation */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h4 className="font-semibold text-blue-900 mb-3">セイバーメトリクス説明</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-blue-800 mb-1">wOBA (Weighted On-Base Average)</div>
                  <div className="text-blue-700">出塁率に重み付けを加えた総合的な攻撃指標。.320以上が優秀。</div>
                </div>
                <div>
                  <div className="font-medium text-blue-800 mb-1">wRC+ (Weighted Runs Created Plus)</div>
                  <div className="text-blue-700">リーグ平均を100とした攻撃指標。120以上が優秀。</div>
                </div>
                <div>
                  <div className="font-medium text-blue-800 mb-1">WAR (Wins Above Replacement)</div>
                  <div className="text-blue-700">代替可能選手より何勝分の価値があるか。2.0以上でスター級。</div>
                </div>
                <div>
                  <div className="font-medium text-blue-800 mb-1">FIP (Fielding Independent Pitching)</div>
                  <div className="text-blue-700">守備に依存しない投手指標。ERA より客観的。</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <h3 className="text-xl font-semibold mb-6">About Korean Baseball Organization (KBO)</h3>
            <div className="prose max-w-none space-y-4">
              <p className="text-slate-700">
                The Korean Baseball Organization (KBO) is the governing body for professional baseball in South Korea. 
                Founded in 1982, it operates the top-level professional baseball league in the country.
              </p>
              
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">League Structure</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>10 teams competing in a single league format</li>
                  <li>144 regular season games per team</li>
                  <li>Playoff system with Korean Series championship</li>
                  <li>Each team allows up to 3 foreign players on active roster</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Teams & Stadiums</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {Object.entries(KBO_TEAMS).map(([team, info]) => (
                    <div key={team} className="flex justify-between">
                      <span>{info.logo} {team}</span>
                      <span className="text-slate-600">{info.city}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">International Recognition</h4>
                <p className="text-slate-700">
                  KBO has gained global attention, especially after several Korean players succeeded in MLB. 
                  The league features high-quality baseball with passionate fan culture and is considered 
                  one of Asia's premier professional baseball leagues.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Database Coverage</h4>
                <p className="text-blue-800 text-sm">
                  Our comprehensive KBO database includes 800+ players with detailed profiles, 
                  statistics, and career information across all 10 teams. This represents the most 
                  complete English-language KBO player database available.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}