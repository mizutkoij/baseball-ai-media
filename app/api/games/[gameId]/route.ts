import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { addNPBProvenance } from '@/lib/provenance';

// Prevent static generation during build
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    gameId: string;
  }> | {
    gameId: string;
  };
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
    // Try to connect to database
    const testDbPath = path.join(process.cwd(), 'data', 'npb_test.db');
    const mainDbPath = path.join(process.cwd(), 'data', 'npb.db');
    
    let dbPath = testDbPath;
    const fs = require('fs');
    
    // Check which database exists
    if (fs.existsSync(testDbPath)) {
      dbPath = testDbPath;
    } else if (fs.existsSync(mainDbPath)) {
      dbPath = mainDbPath;
    } else {
      throw new Error('No NPB database found');
    }

    // Conditional import to prevent build-time issues
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    
    // Get game info
    const gameInfo = db.prepare(`
      SELECT * FROM games WHERE game_id = ?
    `).get(gameId);
    
    if (!gameInfo) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    
    // Get lineups
    const lineups = db.prepare(`
      SELECT * FROM lineups 
      WHERE game_id = ? 
      ORDER BY team, order_no
    `).all(gameId);
    
    // Get batting stats
    const battingStats = db.prepare(`
      SELECT * FROM box_batting 
      WHERE game_id = ? 
      ORDER BY team, order_no
    `).all(gameId);
    
    // Get pitching stats
    const pitchingStats = db.prepare(`
      SELECT * FROM box_pitching 
      WHERE game_id = ? 
      ORDER BY team, IP_outs DESC
    `).all(gameId);
    
    db.close();
    
    // Parse links JSON
    let links = {};
    try {
      if (gameInfo && (gameInfo as any).links) {
        links = JSON.parse((gameInfo as any).links);
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
    
    // Group data by team
    const lineupsData: Record<string, any[]> = {};
    const battingData: Record<string, any[]> = {};
    const pitchingData: Record<string, any[]> = {};
    
    lineups.forEach((lineup: any) => {
      if (!lineupsData[lineup.team]) lineupsData[lineup.team] = [];
      lineupsData[lineup.team].push(lineup);
    });
    
    battingStats.forEach((stats: any) => {
      if (!battingData[stats.team]) battingData[stats.team] = [];
      battingData[stats.team].push(stats);
    });
    
    pitchingStats.forEach((stats: any) => {
      if (!pitchingData[stats.team]) pitchingData[stats.team] = [];
      pitchingData[stats.team].push(stats);
    });
    
    const responseData = {
      game: {
        ...gameInfo,
        links: links
      },
      lineups: lineupsData,
      batting: battingData,
      pitching: pitchingData,
      stats_summary: {
        lineups_count: lineups.length,
        batting_count: battingStats.length,
        pitching_count: pitchingStats.length
      }
    };

    // プロビナンス情報を付与
    const responseWithProvenance = addNPBProvenance(
      responseData,
      "database_query_with_calculated_sabermetrics",
      {
        version: "1.0",
        dependencies: ["npb_official_html", "academic_formulas"]
      }
    );

    return NextResponse.json(responseWithProvenance);

  } catch (error) {
    console.error('Error in game detail API:', error);
    
    return NextResponse.json({
      error: "Failed to load game details",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}