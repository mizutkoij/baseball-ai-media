import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface ComprehensiveGameData {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  venue: string;
  status: string;
  live_updates?: any;
  advanced_stats?: any;
  game_insights?: any;
}

/**
 * 包括的試合分析データAPI
 * GET /api/analytics/games
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const gameId = url.searchParams.get('gameId');
    const date = url.searchParams.get('date');
    const team = url.searchParams.get('team');
    const status = url.searchParams.get('status');
    const includeAnalytics = url.searchParams.get('analytics') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // 包括的試合データを読み込み
    const comprehensiveGames = await loadComprehensiveGameData();
    
    // NPB基本試合データを読み込み
    const basicGameData = await loadBasicGameData();
    
    // リアルタイム監視データを読み込み
    const realtimeData = await loadRealtimeMonitoringData();

    // データをマージ
    let games = mergeGameData(comprehensiveGames, basicGameData, realtimeData);

    // フィルタリング
    if (gameId) {
      games = games.filter(g => g.gameId === gameId);
    }
    
    if (date) {
      games = games.filter(g => g.date === date || g.date.includes(date));
    }
    
    if (team) {
      games = games.filter(g => 
        g.homeTeam.includes(team) || g.awayTeam.includes(team)
      );
    }
    
    if (status) {
      games = games.filter(g => g.status === status);
    }

    // 制限適用
    games = games.slice(0, limit);

    // レスポンス用データの整形
    const formattedGames = games.map(game => ({
      game_id: game.gameId,
      date: game.date,
      teams: {
        home: {
          name: game.homeTeam,
          score: game.homeScore,
          team_stats: extractTeamStats(game, 'home')
        },
        away: {
          name: game.awayTeam,
          score: game.awayScore,
          team_stats: extractTeamStats(game, 'away')
        }
      },
      game_info: {
        venue: game.venue,
        status: game.status,
        inning_scores: extractInningScores(game),
        game_duration: calculateGameDuration(game)
      },
      live_status: game.live_updates ? {
        last_updated: game.live_updates.last_updated,
        current_situation: {
          inning: game.live_updates.current_inning,
          half: game.live_updates.current_half,
          outs: game.live_updates.outs,
          runners: game.live_updates.runners
        },
        last_play: game.live_updates.last_play
      } : null,
      analytics: includeAnalytics ? extractGameAnalytics(game) : null,
      insights: game.game_insights ? {
        key_moments: game.game_insights.key_moments,
        turning_points: game.game_insights.turning_points,
        performance_highlights: game.game_insights.performance_highlights
      } : null
    }));

    return NextResponse.json({
      success: true,
      data: formattedGames,
      meta: {
        total_games: formattedGames.length,
        data_sources: ['comprehensive_games', 'npb_basic', 'realtime_monitoring'],
        last_updated: new Date().toISOString(),
        filters_applied: {
          gameId: gameId || 'none',
          date: date || 'none',
          team: team || 'none',
          status: status || 'none'
        }
      }
    });

  } catch (error) {
    console.error('Analytics Games API Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch game analytics data',
      data: []
    }, { status: 500 });
  }
}

/**
 * 包括的試合データの読み込み
 */
async function loadComprehensiveGameData(): Promise<ComprehensiveGameData[]> {
  try {
    const comprehensiveDir = path.join(process.cwd(), 'data/comprehensive_games');
    const files = await fs.readdir(comprehensiveDir);
    const gameFiles = files.filter(f => f.includes('games_comprehensive_'));
    
    if (gameFiles.length === 0) return [];
    
    // 最新のファイルを使用
    const latestFile = gameFiles.sort().reverse()[0];
    const filePath = path.join(comprehensiveDir, latestFile);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Failed to load comprehensive game data:', error);
    return [];
  }
}

/**
 * NPB基本試合データの読み込み
 */
async function loadBasicGameData(): Promise<ComprehensiveGameData[]> {
  const files = [
    'data/npb_2025_all_games_simple.json',
    'data/npb_2025_detailed_complete.json'
  ];

  const allData: ComprehensiveGameData[] = [];

  for (const filePath of files) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        // NPBデータ形式を標準形式に変換
        const normalizedData = data.map(game => normalizeNPBGameData(game));
        allData.push(...normalizedData);
      }
    } catch (error) {
      console.warn(`Failed to load ${filePath}:`, error);
    }
  }

  return allData;
}

/**
 * リアルタイム監視データの読み込み
 */
async function loadRealtimeMonitoringData(): Promise<any[]> {
  try {
    const realtimeDir = path.join(process.cwd(), 'data/realtime_monitoring');
    const files = await fs.readdir(realtimeDir);
    const snapshotFiles = files.filter(f => f.endsWith('.json'));
    
    const allRealtimeData: any[] = [];
    
    for (const file of snapshotFiles) {
      try {
        const filePath = path.join(realtimeDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        allRealtimeData.push(data);
      } catch (error) {
        console.warn(`Failed to load realtime data ${file}:`, error);
      }
    }
    
    return allRealtimeData;
  } catch (error) {
    console.warn('Failed to load realtime monitoring data:', error);
    return [];
  }
}

/**
 * NPB試合データの正規化
 */
function normalizeNPBGameData(npbGame: any): ComprehensiveGameData {
  return {
    gameId: npbGame.game_id || npbGame.id || generateGameId(npbGame),
    date: npbGame.date || npbGame.game_date || '',
    homeTeam: npbGame.home_team || npbGame.homeTeam || '',
    awayTeam: npbGame.away_team || npbGame.awayTeam || '',
    homeScore: npbGame.home_score || npbGame.homeScore || 0,
    awayScore: npbGame.away_score || npbGame.awayScore || 0,
    venue: npbGame.venue || '',
    status: npbGame.status || 'unknown'
  };
}

/**
 * 試合データのマージ
 */
function mergeGameData(
  comprehensiveData: ComprehensiveGameData[],
  basicData: ComprehensiveGameData[],
  realtimeData: any[]
): ComprehensiveGameData[] {
  const gameMap = new Map<string, ComprehensiveGameData>();

  // 基本データから開始
  for (const game of basicData) {
    gameMap.set(game.gameId, { ...game });
  }

  // 包括的データでエンハンス
  for (const game of comprehensiveData) {
    const existing = gameMap.get(game.gameId);
    if (existing) {
      gameMap.set(game.gameId, {
        ...existing,
        ...game,
        advanced_stats: game.advanced_stats,
        game_insights: game.game_insights,
        live_updates: game.live_updates
      });
    } else {
      gameMap.set(game.gameId, game);
    }
  }

  // リアルタイムデータでエンハンス
  for (const realtimeGame of realtimeData) {
    if (realtimeGame.game_id) {
      const existing = gameMap.get(realtimeGame.game_id);
      if (existing) {
        gameMap.set(realtimeGame.game_id, {
          ...existing,
          live_updates: {
            ...existing.live_updates,
            ...realtimeGame.current_state,
            significant_changes: realtimeGame.significant_changes,
            last_updated: realtimeGame.last_updated
          }
        });
      }
    }
  }

  return Array.from(gameMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * チーム統計の抽出
 */
function extractTeamStats(game: ComprehensiveGameData, team: 'home' | 'away'): any {
  const isHome = team === 'home';
  
  return {
    runs: isHome ? game.homeScore : game.awayScore,
    hits: null, // 詳細データから抽出予定
    errors: null,
    batting_average: null,
    pitching_era: null
  };
}

/**
 * イニングスコアの抽出
 */
function extractInningScores(game: ComprehensiveGameData): any {
  // 詳細試合データからイニング別スコアを抽出
  if ((game as any).inningScores) {
    return (game as any).inningScores;
  }
  
  return {
    away: [],
    home: []
  };
}

/**
 * 試合時間の計算
 */
function calculateGameDuration(game: ComprehensiveGameData): string | null {
  // 試合開始・終了時間から計算
  return null; // 実装予定
}

/**
 * 試合分析データの抽出
 */
function extractGameAnalytics(game: ComprehensiveGameData): any {
  if (!game.advanced_stats) return null;

  return {
    win_probability: game.advanced_stats.win_probability,
    leverage_index: game.advanced_stats.leverage_index,
    game_situation: game.advanced_stats.game_situation,
    momentum_analysis: {
      momentum_shift: game.advanced_stats.momentum_shift,
      key_momentum_plays: extractKeyMomentumPlays(game)
    },
    performance_metrics: {
      offensive_efficiency: calculateOffensiveEfficiency(game),
      pitching_effectiveness: calculatePitchingEffectiveness(game),
      fielding_quality: calculateFieldingQuality(game)
    }
  };
}

/**
 * 重要な勢い変化プレイの抽出
 */
function extractKeyMomentumPlays(game: ComprehensiveGameData): any[] {
  if (!game.game_insights?.key_moments) return [];
  
  return game.game_insights.key_moments
    .filter((moment: any) => moment.impact_score > 7)
    .map((moment: any) => ({
      inning: moment.inning,
      description: moment.description,
      impact: moment.impact_score,
      players: moment.players_involved
    }));
}

/**
 * 攻撃効率の計算
 */
function calculateOffensiveEfficiency(game: ComprehensiveGameData): number {
  // 得点 / 出塁機会 の基本計算
  const totalScore = game.homeScore + game.awayScore;
  return totalScore > 0 ? Math.round(totalScore / 20 * 100) / 100 : 0;
}

/**
 * 投手効率の計算
 */
function calculatePitchingEffectiveness(game: ComprehensiveGameData): number {
  // 被安打数 / イニング数 の逆数的な計算
  return 0.75; // 実装予定
}

/**
 * 守備品質の計算
 */
function calculateFieldingQuality(game: ComprehensiveGameData): number {
  // エラー数から品質を計算
  return 0.85; // 実装予定
}

/**
 * 試合IDの生成
 */
function generateGameId(game: any): string {
  const date = game.date || game.game_date || 'unknown';
  const home = game.home_team || game.homeTeam || 'home';
  const away = game.away_team || game.awayTeam || 'away';
  
  return `${date}_${away}_${home}`.replace(/[^a-zA-Z0-9_-]/g, '');
}