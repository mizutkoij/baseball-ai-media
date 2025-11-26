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

interface LineupPlayer {
  team: string;
  batting_order: number;
  player_name: string;
  position_name: string;
  position_code: string;
}

interface BenchPlayer {
  team: string;
  player_name: string;
  position_name: string;
}

interface Official {
  official_role: string;
  official_name: string;
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
    
    // Get game basic info
    const gameQuery = `
      SELECT game_id, date, league, home_team, away_team, 
             home_score, away_score, venue, status, start_time_jst
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

    // Get starting lineups if available
    const lineupQuery = `
      SELECT team, batting_order, player_name, position_name, position_code
      FROM game_lineups 
      WHERE game_id = ? 
      ORDER BY team, batting_order
    `;
    
    let lineups: LineupPlayer[] = [];
    try {
      lineups = db.prepare(lineupQuery).all(gameId) || [];
    } catch (error) {
      console.log('Lineup table not found or empty:', error);
    }

    // Get bench players if available
    const benchQuery = `
      SELECT team, player_name, position_name
      FROM game_bench 
      WHERE game_id = ?
      ORDER BY team, player_name
    `;
    
    let benchPlayers: BenchPlayer[] = [];
    try {
      benchPlayers = db.prepare(benchQuery).all(gameId) || [];
    } catch (error) {
      console.log('Bench table not found or empty:', error);
    }

    // Get officials if available
    const officialsQuery = `
      SELECT official_role, official_name
      FROM game_officials 
      WHERE game_id = ?
    `;
    
    let officials: Official[] = [];
    try {
      officials = db.prepare(officialsQuery).all(gameId) || [];
    } catch (error) {
      console.log('Officials table not found or empty:', error);
    }

    db.close();

    // Organize lineup data
    const homeLineup = lineups.filter(p => p.team === game.home_team);
    const awayLineup = lineups.filter(p => p.team === game.away_team);
    
    // Organize bench data
    const homeBench = benchPlayers.filter(p => p.team === game.home_team);
    const awayBench = benchPlayers.filter(p => p.team === game.away_team);

    // Generate mock data if no database records exist
    const generateMockLineup = (teamName: string) => {
      const positions = ['中', '二', '右', '一', '左', '三', '遊', '捕', '投'];
      const mockNames = [
        '田中 太郎', '佐藤 次郎', '鈴木 三郎', '高橋 四郎', '伊藤 五郎',
        '渡辺 六郎', '山本 七郎', '中村 八郎', '小林 九郎'
      ];
      
      return positions.map((pos, index) => ({
        batting_order: index + 1,
        player_name: mockNames[index] || `選手${index + 1}`,
        position_name: pos,
        position_code: pos
      }));
    };

    const generateMockBench = () => {
      return [
        { player_name: '松田 控一', position_name: '捕' },
        { player_name: '井上 控二', position_name: '内' },
        { player_name: '木村 控三', position_name: '外' },
        { player_name: '斎藤 控四', position_name: '投' }
      ];
    };

    const generateMockOfficials = () => {
      return [
        { official_role: '球審', official_name: '審判 主審' },
        { official_role: '一塁', official_name: '審判 一塁' },
        { official_role: '二塁', official_name: '審判 二塁' },
        { official_role: '三塁', official_name: '審判 三塁' }
      ];
    };

    const responseData = {
      game: {
        game_id: game.game_id,
        date: game.date,
        away_team: game.away_team,
        home_team: game.home_team,
        away_score: game.away_score,
        home_score: game.home_score,
        status: game.status,
        venue: game.venue,
        start_time_jst: game.start_time_jst,
        league: game.league
      },
      lineups: {
        home: homeLineup.length > 0 ? homeLineup : generateMockLineup(game.home_team),
        away: awayLineup.length > 0 ? awayLineup : generateMockLineup(game.away_team)
      },
      bench: {
        home: homeBench.length > 0 ? homeBench : generateMockBench(),
        away: awayBench.length > 0 ? awayBench : generateMockBench()
      },
      officials: officials.length > 0 ? officials : generateMockOfficials(),
      hasRealData: {
        lineups: lineups.length > 0,
        bench: benchPlayers.length > 0,
        officials: officials.length > 0
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in lineup API:', error);
    
    return NextResponse.json({
      error: "Failed to load lineup data",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}