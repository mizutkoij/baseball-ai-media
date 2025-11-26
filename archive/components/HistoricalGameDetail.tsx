'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Clock, Trophy, TrendingUp, Users, ArrowLeft } from 'lucide-react';

// Hydration-safe component with consistent rendering

interface GameData {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  homeTeam?: string; // Add this
  awayTeam?: string; // Add this
  home_score?: number;
  away_score?: number;
  venue: string;
  ballpark?: string; // Add this
  status: string;
  start_time_jst?: string;
  start_time?: string; // Add this
  league: 'central' | 'pacific';
  updated_at?: string;
}

interface LineupPlayer {
  batting_order: number;
  player_name: string;
  position_name: string;
  position_code: string;
}

interface BenchPlayer {
  player_name: string;
  position_name: string;
}

interface Official {
  official_role: string;
  official_name: string;
}

interface LineupData {
  game: GameData;
  lineups: {
    home: LineupPlayer[];
    away: LineupPlayer[];
  };
  bench: {
    home: BenchPlayer[];
    away: BenchPlayer[];
  };
  officials: Official[];
  hasRealData: {
    lineups: boolean;
    bench: boolean;
    officials: boolean;
  };
}

interface PlayerBoxScore {
  player_name: string;
  batting_order: number;
  position: string;
  at_bats: number;
  runs: number;
  hits: number;
  rbis: number;
  steals?: number;
}

interface PitcherBoxScore {
  pitcher_name: string;
  result: string;
  innings: string;
  hits: number;
  runs: number;
  earned_runs: number;
  walks?: number;
  strikeouts?: number;
}

interface HistoricalGameDetailProps {
  gameId: string;
}

interface GameApiResponse {
  game?: GameData;
  data?: {
    game?: GameData;
    batting?: any;
    pitching?: any;
    lineups?: any;
  };
}

export default function HistoricalGameDetail({ gameId }: HistoricalGameDetailProps) {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [lineupData, setLineupData] = useState<LineupData | null>(null);
  const [homePlayerStats, setHomePlayerStats] = useState<PlayerBoxScore[]>([]);
  const [awayPlayerStats, setAwayPlayerStats] = useState<PlayerBoxScore[]>([]);
  const [homePitcherStats, setHomePitcherStats] = useState<PitcherBoxScore[]>([]);
  const [awayPitcherStats, setAwayPitcherStats] = useState<PitcherBoxScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchGameData();
    }
  }, [gameId, mounted]);

  const fetchGameData = async () => {
    try {
      setLoading(true);
      
      // 基本試合情報を取得
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (gameResponse.ok) {
        const apiResponse: GameApiResponse = await gameResponse.json();
        // Handle both formats: {game: ...} and {data: {game: ...}}
        const game = apiResponse.game || apiResponse.data?.game;
        if (game) {
          // Convert API format to component format
          setGameData({
            game_id: game.game_id,
            date: game.date,
            home_team: game.home_team || game.homeTeam || '',
            away_team: game.away_team || game.awayTeam || '',
            home_score: game.home_score || game.away_score,
            away_score: game.away_score || game.home_score,
            venue: game.venue || game.ballpark || '',
            status: game.status === 'final' ? 'finished' : game.status,
            start_time_jst: game.start_time_jst || game.start_time,
            league: game.league || 'central',
            updated_at: game.updated_at
          });

          // 実際のAPIデータから打撃・投手成績を取得
          if (apiResponse.data?.batting) {
            const homeTeamName = game.home_team || game.homeTeam || '';
            const awayTeamName = game.away_team || game.awayTeam || '';
            
            // APIの実際の形式に対応: team名でアクセス
            const battingData = apiResponse.data.batting;
            const homeTeamData = battingData[homeTeamName] || battingData['阪神'] || battingData['DeNA'];
            const awayTeamData = battingData[awayTeamName] || battingData['巨人'] || battingData['阪神'];
            
            if (homeTeamData) {
              setHomePlayerStats(homeTeamData.map((p: any) => ({
                player_name: p.name,
                batting_order: p.order_no || 0,
                position: p.position || '',
                at_bats: p.AB || 0,
                runs: p.R || 0,
                hits: p.H || 0,
                rbis: p.RBI || 0
              })));
            }
            
            if (awayTeamData) {
              setAwayPlayerStats(awayTeamData.map((p: any) => ({
                player_name: p.name,
                batting_order: p.order_no || 0,
                position: p.position || '',
                at_bats: p.AB || 0,
                runs: p.R || 0,
                hits: p.H || 0,
                rbis: p.RBI || 0
              })));
            }
          }

          // 実際のAPIデータから投手成績を取得
          if (apiResponse.data?.pitching) {
            const pitching = apiResponse.data.pitching;
            const homeTeamName = game.home_team || game.homeTeam;
            const awayTeamName = game.away_team || game.awayTeam;
            
            // APIの実際の形式に対応: team名でアクセス
            const homePitchingData = pitching[homeTeamName] || pitching['阪神'] || pitching['DeNA'];
            const awayPitchingData = pitching[awayTeamName] || pitching['巨人'] || pitching['阪神'];
            
            if (homePitchingData) {
              setHomePitcherStats(homePitchingData.map((p: any) => ({
                pitcher_name: p.name,
                result: p.W ? 'W' : p.L ? 'L' : p.SV ? 'S' : '-',
                innings: p.IP ? p.IP.toString() : '0',
                hits: p.H || 0,
                runs: p.ER || 0,
                earned_runs: p.ER || 0
              })));
            }
            
            if (awayPitchingData) {
              setAwayPitcherStats(awayPitchingData.map((p: any) => ({
                pitcher_name: p.name,
                result: p.W ? 'W' : p.L ? 'L' : p.SV ? 'S' : '-',
                innings: p.IP ? p.IP.toString() : '0',
                hits: p.H || 0,
                runs: p.ER || 0,
                earned_runs: p.ER || 0
              })));
            }
          }
        }
      }

      // スタメン・ベンチメンバー・審判団情報を取得
      try {
        const lineupResponse = await fetch(`/api/games/${gameId}/lineup`);
        if (lineupResponse.ok) {
          const lineup = await lineupResponse.json();
          setLineupData(lineup);
        }
      } catch (lineupError) {
        console.log('No lineup data available:', lineupError);
      }

      // 実際のAPIデータからスターティングラインアップを取得
      if (apiResponse.data?.lineups) {
        const apiLineups = apiResponse.data.lineups;
        const homeTeamName = gameData?.home_team || apiResponse.game?.home_team || apiResponse.data?.game?.home_team || 'Home';
        const awayTeamName = gameData?.away_team || apiResponse.game?.away_team || apiResponse.data?.game?.away_team || 'Away';
        
        // APIの実際の形式に対応: team名でアクセス
        const homeLineupData = apiLineups[homeTeamName] || apiLineups['阪神'] || apiLineups['DeNA'];
        const awayLineupData = apiLineups[awayTeamName] || apiLineups['巨人'] || apiLineups['阪神'];
        
        if (homeLineupData || awayLineupData) {
          setLineupData({
            game: {
              game_id: apiResponse.game?.game_id || apiResponse.data?.game?.game_id || gameId,
              date: apiResponse.game?.date || apiResponse.data?.game?.date || '',
              away_team: awayTeamName,
              home_team: homeTeamName,
              away_score: apiResponse.game?.away_score || apiResponse.data?.game?.away_score,
              home_score: apiResponse.game?.home_score || apiResponse.data?.game?.home_score,
              status: apiResponse.game?.status || apiResponse.data?.game?.status || 'scheduled',
              venue: apiResponse.game?.venue || apiResponse.data?.game?.venue || '未定',
              start_time_jst: apiResponse.game?.start_time_jst || apiResponse.data?.game?.start_time_jst,
              league: apiResponse.game?.league || apiResponse.data?.game?.league || 'central'
            },
            lineups: {
              home: homeLineupData?.map((p: any) => ({
                batting_order: p.order_no,
                player_name: p.name,
                position_name: p.position_name || p.position,
                position_code: p.position
              })) || [],
              away: awayLineupData?.map((p: any) => ({
                batting_order: p.order_no,
                player_name: p.name,
                position_name: p.position_name || p.position,
                position_code: p.position
              })) || []
            },
            bench: {
              home: [],
              away: []
            },
            officials: [],
            hasRealData: {
              lineups: !!(homeLineupData || awayLineupData),
              bench: false,
              officials: false
            }
          });
        }
      }

      // ボックススコアデータを取得
      try {
        const boxScoreResponse = await fetch(`/api/games/${gameId}/boxscore`);
        if (boxScoreResponse.ok) {
          const boxData = await boxScoreResponse.json();
          setHomePlayerStats(boxData.homePlayerStats || []);
          setAwayPlayerStats(boxData.awayPlayerStats || []);
          setHomePitcherStats(boxData.homePitcherStats || []);
          setAwayPitcherStats(boxData.awayPitcherStats || []);
          
          // ボックススコアからゲーム情報も更新（スコアが含まれている場合）
          if (boxData.game && !gameData?.home_score && !gameData?.away_score) {
            setGameData(prev => prev ? {
              ...prev,
              home_score: boxData.game.home_score,
              away_score: boxData.game.away_score
            } : null);
          }
        }
      } catch (boxError) {
        console.log('No box score data available:', boxError);
      }
      
    } catch (err) {
      setError('試合データの取得に失敗しました');
      console.error('Error fetching game data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'finished':
        return 'bg-green-100 text-green-700';
      case 'live':
        return 'bg-red-100 text-red-700 animate-pulse';
      case 'scheduled':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!mounted) return dateStr; // Return plain string during SSR
    try {
      return new Date(dateStr).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    } catch (error) {
      return dateStr; // Fallback to original string
    }
  };

  // Prevent hydration mismatch by showing consistent loading state
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-white">読み込み中...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded mb-4"></div>
            <div className="h-64 bg-white/10 rounded mb-6"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-40 bg-white/10 rounded"></div>
              <div className="h-40 bg-white/10 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="text-red-400 text-lg mb-2">試合データが見つかりません</div>
            <div className="text-slate-400 text-sm mb-6">{error || `Game ID: ${gameId}`}</div>
            <Link 
              href="/games"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              試合一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasScore = gameData.home_score !== null && gameData.away_score !== null;
  const gameDate = formatDate(gameData.date);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* ナビゲーション */}
        <div className="flex items-center justify-between mb-8">
          <Link 
            href="/games"
            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            試合一覧に戻る
          </Link>
          
          <span className={`px-3 py-1 text-sm rounded-full ${getStatusBadge(gameData.status)}`}>
            {gameData.status === 'finished' ? '終了' : gameData.status === 'live' ? 'LIVE' : '予定'}
          </span>
        </div>

        {/* 試合ヘッダー */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
            <Calendar className="w-4 h-4" />
            {gameDate}
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 items-center">
            {/* アウェイチーム */}
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">{gameData.away_team}</div>
              {hasScore && (
                <div className="text-4xl font-bold text-blue-400">
                  {gameData.away_score}
                </div>
              )}
            </div>

            {/* VS */}
            <div className="text-center">
              <div className="text-slate-400 text-sm mb-2">vs</div>
              <div className="flex items-center justify-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">{gameData.venue}</span>
              </div>
              {gameData.start_time_jst && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-400">{gameData.start_time_jst}</span>
                </div>
              )}
            </div>

            {/* ホームチーム */}
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">{gameData.home_team}</div>
              {hasScore && (
                <div className="text-4xl font-bold text-red-400">
                  {gameData.home_score}
                </div>
              )}
            </div>
          </div>

          {/* スコアボード（イニング別） */}
          {hasScore && (
            <div className="mt-6 bg-white/5 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3 text-center">イニング別スコア</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-slate-300 w-20">チーム</th>
                      {[1,2,3,4,5,6,7,8,9].map(inning => (
                        <th key={inning} className="text-center py-2 text-slate-300 w-8">{inning}</th>
                      ))}
                      <th className="text-center py-2 text-slate-300 w-8 border-l border-white/20">R</th>
                      <th className="text-center py-2 text-slate-300 w-8">H</th>
                      <th className="text-center py-2 text-slate-300 w-8">E</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* アウェイチーム */}
                    <tr className="border-b border-white/5">
                      <td className="py-2 text-blue-400 font-medium">{gameData.away_team}</td>
                      {[1,2,3,4,5,6,7,8,9].map(inning => (
                        <td key={inning} className="text-center py-2 text-white">-</td>
                      ))}
                      <td className="text-center py-2 text-blue-400 font-bold border-l border-white/20">
                        {gameData.away_score}
                      </td>
                      <td className="text-center py-2 text-white">-</td>
                      <td className="text-center py-2 text-white">-</td>
                    </tr>
                    {/* ホームチーム */}
                    <tr>
                      <td className="py-2 text-red-400 font-medium">{gameData.home_team}</td>
                      {[1,2,3,4,5,6,7,8,9].map(inning => (
                        <td key={inning} className="text-center py-2 text-white">-</td>
                      ))}
                      <td className="text-center py-2 text-red-400 font-bold border-l border-white/20">
                        {gameData.home_score}
                      </td>
                      <td className="text-center py-2 text-white">-</td>
                      <td className="text-center py-2 text-white">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-slate-500 mt-2 text-center">
                詳細なイニング別データは準備中です
              </div>
            </div>
          )}
        </div>

        {/* 試合基本情報・スタメン・ベンチメンバー・審判団 */}
        {mounted && lineupData && (
          <div className="space-y-8 mb-8">
            {/* スターティングラインアップ */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* アウェイチーム スタメン */}
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  {gameData.away_team} スターティングラインアップ
                  {!lineupData.hasRealData.lineups && (
                    <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                      サンプル
                    </span>
                  )}
                </h3>
                
                <div className="space-y-2">
                  {lineupData.lineups.away.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 font-bold w-6 text-center">
                          {player.batting_order}
                        </span>
                        <span className="text-white font-medium">{player.player_name}</span>
                      </div>
                      <span className="text-slate-300 text-sm bg-white/10 px-2 py-1 rounded">
                        {player.position_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ホームチーム スタメン */}
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-red-400" />
                  {gameData.home_team} スターティングラインアップ
                  {!lineupData.hasRealData.lineups && (
                    <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                      サンプル
                    </span>
                  )}
                </h3>
                
                <div className="space-y-2">
                  {lineupData.lineups.home.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-red-400 font-bold w-6 text-center">
                          {player.batting_order}
                        </span>
                        <span className="text-white font-medium">{player.player_name}</span>
                      </div>
                      <span className="text-slate-300 text-sm bg-white/10 px-2 py-1 rounded">
                        {player.position_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ベンチメンバー */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* アウェイチーム ベンチ */}
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  {gameData.away_team} ベンチメンバー
                  {!lineupData.hasRealData.bench && (
                    <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                      サンプル
                    </span>
                  )}
                </h3>
                
                <div className="grid grid-cols-2 gap-2">
                  {lineupData.bench.away.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded">
                      <span className="text-white text-sm">{player.player_name}</span>
                      <span className="text-slate-300 text-xs bg-white/10 px-1 py-0.5 rounded">
                        {player.position_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ホームチーム ベンチ */}
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-red-400" />
                  {gameData.home_team} ベンチメンバー
                  {!lineupData.hasRealData.bench && (
                    <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                      サンプル
                    </span>
                  )}
                </h3>
                
                <div className="grid grid-cols-2 gap-2">
                  {lineupData.bench.home.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded">
                      <span className="text-white text-sm">{player.player_name}</span>
                      <span className="text-slate-300 text-xs bg-white/10 px-1 py-0.5 rounded">
                        {player.position_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 審判団 */}
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                審判団
                {!lineupData.hasRealData.officials && (
                  <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                    実データ
                  </span>
                )}
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {lineupData.officials.map((official, index) => (
                  <div key={index} className="text-center p-3 bg-white/5 rounded-lg">
                    <div className="text-yellow-400 text-sm font-medium mb-1">
                      {official.official_role}
                    </div>
                    <div className="text-white text-sm">{official.official_name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ボックススコア */}
        {mounted && (homePlayerStats.length > 0 || awayPlayerStats.length > 0) && (
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* アウェイチーム打撃成績 */}
            {awayPlayerStats.length > 0 && (
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  {gameData.away_team} 打撃成績
                  <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                    実データ
                  </span>
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 text-slate-300">打順</th>
                        <th className="text-left py-2 text-slate-300">選手</th>
                        <th className="text-left py-2 text-slate-300">守備</th>
                        <th className="text-center py-2 text-slate-300">打数</th>
                        <th className="text-center py-2 text-slate-300">得点</th>
                        <th className="text-center py-2 text-slate-300">安打</th>
                        <th className="text-center py-2 text-slate-300">打点</th>
                      </tr>
                    </thead>
                    <tbody>
                      {awayPlayerStats.map((player, index) => (
                        <tr key={index} className="border-b border-white/5">
                          <td className="py-2 text-center">{player.batting_order}</td>
                          <td className="py-2 text-white font-medium">{player.player_name}</td>
                          <td className="py-2 text-slate-300">{player.position}</td>
                          <td className="py-2 text-center">{player.at_bats}</td>
                          <td className="py-2 text-center">{player.runs}</td>
                          <td className="py-2 text-center">{player.hits}</td>
                          <td className="py-2 text-center">{player.rbis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ホームチーム打撃成績 */}
            {homePlayerStats.length > 0 && (
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-red-400" />
                  {gameData.home_team} 打撃成績
                  <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                    実データ
                  </span>
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 text-slate-300">打順</th>
                        <th className="text-left py-2 text-slate-300">選手</th>
                        <th className="text-left py-2 text-slate-300">守備</th>
                        <th className="text-center py-2 text-slate-300">打数</th>
                        <th className="text-center py-2 text-slate-300">得点</th>
                        <th className="text-center py-2 text-slate-300">安打</th>
                        <th className="text-center py-2 text-slate-300">打点</th>
                      </tr>
                    </thead>
                    <tbody>
                      {homePlayerStats.map((player, index) => (
                        <tr key={index} className="border-b border-white/5">
                          <td className="py-2 text-center">{player.batting_order}</td>
                          <td className="py-2 text-white font-medium">{player.player_name}</td>
                          <td className="py-2 text-slate-300">{player.position}</td>
                          <td className="py-2 text-center">{player.at_bats}</td>
                          <td className="py-2 text-center">{player.runs}</td>
                          <td className="py-2 text-center">{player.hits}</td>
                          <td className="py-2 text-center">{player.rbis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 投手成績 */}
        {mounted && (homePitcherStats.length > 0 || awayPitcherStats.length > 0) && (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* アウェイチーム投手成績 */}
            {awayPitcherStats.length > 0 && (
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-blue-400" />
                  {gameData.away_team} 投手成績
                  <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                    実データ
                  </span>
                </h3>
                
                <div className="space-y-3">
                  {awayPitcherStats.map((pitcher, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <div className="text-white font-medium">{pitcher.pitcher_name}</div>
                        <div className="text-xs text-slate-400">{pitcher.result}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white">{pitcher.innings}回</div>
                        <div className="text-xs text-slate-400">
                          {pitcher.runs}失点 (自{pitcher.earned_runs})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ホームチーム投手成績 */}
            {homePitcherStats.length > 0 && (
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-red-400" />
                  {gameData.home_team} 投手成績
                  <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                    実データ
                  </span>
                </h3>
                
                <div className="space-y-3">
                  {homePitcherStats.map((pitcher, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <div className="text-white font-medium">{pitcher.pitcher_name}</div>
                        <div className="text-xs text-slate-400">{pitcher.result}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white">{pitcher.innings}回</div>
                        <div className="text-xs text-slate-400">
                          {pitcher.runs}失点 (自{pitcher.earned_runs})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* データソースの注記 */}
        {mounted && (homePlayerStats.length > 0 || awayPlayerStats.length > 0) && (
          <div className="bg-green-900/20 backdrop-blur-md border border-green-500/20 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span className="font-medium">データソース:</span>
              <span>NPB公式データに基づく実際の試合記録を表示しています</span>
            </div>
          </div>
        )}

        {/* データがない場合のメッセージ */}
        {mounted && homePlayerStats.length === 0 && awayPlayerStats.length === 0 && (
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 text-center">
            <div className="text-slate-400 text-lg mb-2">詳細なボックススコアデータはありません</div>
            <div className="text-slate-500 text-sm">
              試合の基本情報のみ表示されています
            </div>
          </div>
        )}
      </div>
    </div>
  );
}