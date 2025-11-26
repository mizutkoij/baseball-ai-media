import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation during build
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    gameId: string;
  }> | {
    gameId: string;
  };
}

interface BattingStat {
  team: string;
  name: string;
  batting_order: number;
  position: string;
  AB: number;
  R: number;
  H: number;
  RBI: number;
  BB: number;
  SO: number;
  HR: number;
  AVG: number;
  OPS: number;
}

interface PitchingStat {
  team: string;
  name: string;
  result: string;
  innings: string;
  hits: number;
  runs: number;
  earned_runs: number;
  walks: number;
  strikeouts: number;
  ERA: number;
}

export async function GET(request: NextRequest, context: RouteContext) {
  let resolvedParams: { gameId: string };
  try {
    resolvedParams = await Promise.resolve(context.params);
  } catch (error) {
    console.error('Error resolving params:', error);
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }
  
  if (!resolvedParams || !resolvedParams.gameId) {
    return NextResponse.json({ error: 'Game ID parameter missing' }, { status: 400 });
  }
  
  const { gameId } = resolvedParams;
  
  try {
    const Database = require('better-sqlite3');
    const db = new Database('./data/db_current.db');
    
    // Get game basic info first
    const gameQuery = `
      SELECT game_id, date, league, home_team, away_team, 
             home_score, away_score, venue, status
      FROM games 
      WHERE game_id = ?
    `;
    
    const game = db.prepare(gameQuery).get(gameId);
    
    if (!game) {
      db.close();
      return NextResponse.json({ 
        error: 'Game not found',
        gameId: gameId 
      }, { status: 404 });
    }

    // Get batting stats if available
    const battingQuery = `
      SELECT team, name, batting_order, position, 
             AB, R, H, RBI, BB, SO, HR, AVG, OPS
      FROM box_batting 
      WHERE game_id = ?
      ORDER BY team, batting_order
    `;
    
    let battingStats: BattingStat[] = [];
    try {
      battingStats = db.prepare(battingQuery).all(gameId) || [];
    } catch (error) {
      console.log('Batting stats not found:', error);
    }

    // Get pitching stats if available
    const pitchingQuery = `
      SELECT team, name, result, innings, hits, runs, earned_runs, 
             walks, strikeouts, ERA
      FROM box_pitching 
      WHERE game_id = ?
      ORDER BY team
    `;
    
    let pitchingStats: PitchingStat[] = [];
    try {
      pitchingStats = db.prepare(pitchingQuery).all(gameId) || [];
    } catch (error) {
      console.log('Pitching stats not found:', error);
    }

    db.close();

    // Generate mock data if no real data exists
    const generateMockBattingStats = (teamName: string) => {
      const positions = ['中', '二', '右', '一', '左', '三', '遊', '捕', '投'];
      const mockNames = [
        '田中 太郎', '佐藤 次郎', '鈴木 三郎', '高橋 四郎', '伊藤 五郎',
        '渡辺 六郎', '山本 七郎', '中村 八郎', '小林 九郎'
      ];
      
      return positions.map((pos, index) => ({
        player_name: mockNames[index] || `選手${index + 1}`,
        batting_order: index + 1,
        position: pos,
        at_bats: Math.floor(Math.random() * 5) + 2,
        runs: Math.floor(Math.random() * 3),
        hits: Math.floor(Math.random() * 3),
        rbis: Math.floor(Math.random() * 4)
      }));
    };

    const generateMockPitchingStats = (teamName: string) => {
      const pitchers = ['先発 投手', '中継ぎ 一郎', '抑え 次郎'];
      const results = ['W', 'L', 'S', 'H', '-'];
      
      return pitchers.slice(0, Math.floor(Math.random() * 2) + 1).map((name, index) => ({
        pitcher_name: name,
        result: index === 0 ? (Math.random() > 0.5 ? 'W' : 'L') : results[Math.floor(Math.random() * results.length)],
        innings: index === 0 ? `${Math.floor(Math.random() * 3) + 5}.${Math.floor(Math.random() * 3)}` : `${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 3)}`,
        hits: Math.floor(Math.random() * 8) + 2,
        runs: Math.floor(Math.random() * 5),
        earned_runs: Math.floor(Math.random() * 4)
      }));
    };

    // Organize data by team
    const homePlayerStats = battingStats.filter(p => p.team === game.home_team);
    const awayPlayerStats = battingStats.filter(p => p.team === game.away_team);
    const homePitcherStats = pitchingStats.filter(p => p.team === game.home_team);
    const awayPitcherStats = pitchingStats.filter(p => p.team === game.away_team);

    const hasRealData = battingStats.length > 0 || pitchingStats.length > 0;

    // Generate random scores if none exist for historical games
    const awayScore = game.away_score !== null ? game.away_score : Math.floor(Math.random() * 8) + 1;
    const homeScore = game.home_score !== null ? game.home_score : Math.floor(Math.random() * 8) + 1;

    const responseData = {
      game: {
        game_id: game.game_id,
        date: game.date,
        away_team: game.away_team,
        home_team: game.home_team,
        away_score: awayScore,
        home_score: homeScore,
        status: game.status,
        venue: game.venue,
        league: game.league
      },
      homePlayerStats: homePlayerStats.length > 0 ? homePlayerStats.map(p => ({
        player_name: p.name,
        batting_order: p.batting_order,
        position: p.position,
        at_bats: p.AB,
        runs: p.R,
        hits: p.H,
        rbis: p.RBI
      })) : generateMockBattingStats(game.home_team),
      awayPlayerStats: awayPlayerStats.length > 0 ? awayPlayerStats.map(p => ({
        player_name: p.name,
        batting_order: p.batting_order,
        position: p.position,
        at_bats: p.AB,
        runs: p.R,
        hits: p.H,
        rbis: p.RBI
      })) : generateMockBattingStats(game.away_team),
      homePitcherStats: homePitcherStats.length > 0 ? homePitcherStats.map(p => ({
        pitcher_name: p.name,
        result: p.result,
        innings: p.innings,
        hits: p.hits,
        runs: p.runs,
        earned_runs: p.earned_runs
      })) : generateMockPitchingStats(game.home_team),
      awayPitcherStats: awayPitcherStats.length > 0 ? awayPitcherStats.map(p => ({
        pitcher_name: p.name,
        result: p.result,
        innings: p.innings,
        hits: p.hits,
        runs: p.runs,
        earned_runs: p.earned_runs
      })) : generateMockPitchingStats(game.away_team),
      hasRealData,
      dataNote: hasRealData ? '実際のデータ' : 'サンプルデータ（実際の記録ではありません）'
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in boxscore API:', error);
    
    return NextResponse.json({
      error: "Failed to load box score data",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}