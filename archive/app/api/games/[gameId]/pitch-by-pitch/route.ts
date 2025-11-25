import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';

const DB_PATH = process.env.COMPREHENSIVE_DB_PATH || './comprehensive_baseball_database.db';

export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const { searchParams } = new URL(request.url);
  const inning = searchParams.get('inning');
  const side = searchParams.get('side');
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    const db = new Database(DB_PATH);

    let query = `
      SELECT 
        id, game_id, inning, side, pitch_sequence,
        pitcher_name, batter_name, pitch_type, velocity,
        zone, result, balls, strikes, runners, outs, created_at
      FROM pitch_by_pitch 
      WHERE game_id = ?
    `;

    const params_list: any[] = [params.gameId];

    if (inning) {
      query += ' AND inning = ?';
      params_list.push(parseInt(inning));
    }

    if (side) {
      query += ' AND side = ?';
      params_list.push(side);
    }

    query += ' ORDER BY inning ASC, side ASC, pitch_sequence ASC';

    if (limit) {
      query += ' LIMIT ?';
      params_list.push(limit);
    }

    const pitches = db.prepare(query).all(...params_list);

    // 統計情報も取得
    const statsQuery = `
      SELECT 
        COUNT(*) as total_pitches,
        COUNT(DISTINCT inning || side) as total_half_innings,
        COUNT(DISTINCT pitcher_name) as unique_pitchers,
        COUNT(DISTINCT batter_name) as unique_batters,
        MIN(inning) as first_inning,
        MAX(inning) as last_inning
      FROM pitch_by_pitch 
      WHERE game_id = ?
    `;

    const stats = db.prepare(statsQuery).get(params.gameId);

    db.close();

    return NextResponse.json({
      success: true,
      data: pitches,
      stats: stats,
      filters: {
        gameId: params.gameId,
        inning: inning,
        side: side,
        limit: limit
      }
    });

  } catch (error) {
    console.error('Pitch by pitch API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}