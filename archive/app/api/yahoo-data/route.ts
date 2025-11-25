import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// Yahoo SQLite データベース接続
function getYahooConnection() {
  const dbPath = process.env.YAHOO_DB_PATH || './data/yahoo_scraping/database/yahoo_baseball.db';
  const db = new sqlite3.Database(dbPath);
  
  return {
    get: promisify(db.get.bind(db)),
    all: promisify(db.all.bind(db)),
    run: promisify(db.run.bind(db)),
    close: promisify(db.close.bind(db))
  };
}

interface YahooGameData {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  venue: string;
  status: string;
  league: string;
  processed: number;
}

interface YahooPitchData {
  game_id: string;
  index_code: string;
  pitch_sequence: number;
  pitcher_name: string;
  batter_name: string;
  pitch_type: string;
  velocity: number;
  zone_name: string;
  result: string;
  count_balls: number;
  count_strikes: number;
  runners: string;
  inning: number;
  side: string;
  outs: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'games';
  const gameId = searchParams.get('gameId');
  const date = searchParams.get('date');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const db = getYahooConnection();

    switch (type) {
      case 'games':
        return await getGamesData(db, { date, limit });
      
      case 'game-detail':
        if (!gameId) {
          return NextResponse.json({ error: 'gameId required for game-detail' }, { status: 400 });
        }
        return await getGameDetail(db, gameId);
      
      case 'pitches':
        if (!gameId) {
          return NextResponse.json({ error: 'gameId required for pitches' }, { status: 400 });
        }
        return await getPitchData(db, gameId, limit);
      
      case 'stats':
        return await getStatsData(db);
      
      case 'recent-activity':
        return await getRecentActivity(db, limit);
      
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Yahoo data API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getGamesData(db: any, options: { date?: string | null, limit: number }) {
  try {
    let query = 'SELECT * FROM games';
    let params: any[] = [];

    if (options.date) {
      query += ' WHERE date = ?';
      params.push(options.date);
    }

    query += ' ORDER BY date DESC, game_id DESC LIMIT ?';
    params.push(options.limit);

    const games = await db.all(query, params) as YahooGameData[];
    
    await db.close();
    
    return NextResponse.json({
      success: true,
      data: games,
      total: games.length,
      filters: { date: options.date, limit: options.limit }
    });
  } catch (error) {
    await db.close();
    throw error;
  }
}

async function getGameDetail(db: any, gameId: string) {
  try {
    const game = await db.get(
      'SELECT * FROM games WHERE game_id = ?',
      [gameId]
    ) as YahooGameData;

    if (!game) {
      await db.close();
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // 打席インデックス情報取得
    const indexes = await db.all(
      'SELECT * FROM batting_indexes WHERE game_id = ? ORDER BY inning, side, batter_num',
      [gameId]
    );

    // 一球速報データのサマリー
    const pitchSummary = await db.get(`
      SELECT 
        COUNT(*) as total_pitches,
        COUNT(DISTINCT pitcher_name) as unique_pitchers,
        COUNT(DISTINCT batter_name) as unique_batters,
        MAX(inning) as max_inning
      FROM pitch_data 
      WHERE game_id = ?
    `, [gameId]);

    await db.close();

    return NextResponse.json({
      success: true,
      data: {
        game,
        indexes,
        pitch_summary: pitchSummary,
        has_detailed_data: game.processed === 1
      }
    });
  } catch (error) {
    await db.close();
    throw error;
  }
}

async function getPitchData(db: any, gameId: string, limit: number) {
  try {
    const pitches = await db.all(`
      SELECT * FROM pitch_data 
      WHERE game_id = ? 
      ORDER BY inning, side, pitch_sequence 
      LIMIT ?
    `, [gameId, limit]) as YahooPitchData[];

    await db.close();

    return NextResponse.json({
      success: true,
      data: pitches,
      total: pitches.length,
      game_id: gameId
    });
  } catch (error) {
    await db.close();
    throw error;
  }
}

async function getStatsData(db: any) {
  try {
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN processed = 1 THEN 1 END) as processed_games,
        COUNT(CASE WHEN processed = 0 THEN 1 END) as pending_games,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM games
    `);

    const pitchStats = await db.get(`
      SELECT 
        COUNT(*) as total_pitches,
        COUNT(DISTINCT game_id) as games_with_pitches,
        COUNT(DISTINCT pitcher_name) as unique_pitchers,
        COUNT(DISTINCT batter_name) as unique_batters
      FROM pitch_data
    `);

    await db.close();

    return NextResponse.json({
      success: true,
      data: {
        games: stats,
        pitches: pitchStats,
        collection_status: {
          completion_rate: stats.total_games > 0 ? 
            (stats.processed_games / stats.total_games * 100).toFixed(1) : '0.0',
          data_richness: pitchStats.total_pitches > 0 ? 'detailed' : 'basic'
        }
      }
    });
  } catch (error) {
    await db.close();
    throw error;
  }
}

async function getRecentActivity(db: any, limit: number) {
  try {
    const recentGames = await db.all(`
      SELECT game_id, date, home_team, away_team, status, processed, updated_at
      FROM games 
      ORDER BY updated_at DESC 
      LIMIT ?
    `, [limit]);

    const recentPitches = await db.all(`
      SELECT p.game_id, p.inning, p.side, p.pitcher_name, p.batter_name, 
             p.result, g.home_team, g.away_team, p.created_at
      FROM pitch_data p
      JOIN games g ON p.game_id = g.game_id
      ORDER BY p.created_at DESC 
      LIMIT ?
    `, [Math.min(limit, 20)]);

    await db.close();

    return NextResponse.json({
      success: true,
      data: {
        recent_games: recentGames,
        recent_pitches: recentPitches,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    await db.close();
    throw error;
  }
}