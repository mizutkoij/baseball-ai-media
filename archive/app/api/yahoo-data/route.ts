import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { getYahooConnection } from '../../../lib/yahoo-integration';

interface YahooGameData {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  venue: string;
  status: string;
  league: string;
  processed: number;
  updated_at?: string; // Add updated_at to interface
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
  created_at?: string; // Add created_at to interface
}

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'games';
  const gameId = searchParams.get('gameId');
  const date = searchParams.get('date');
  const limit = parseInt(searchParams.get('limit') || '50');

  let db: Database.Database | null = null;

  try {
    db = getYahooConnection();

    switch (type) {
      case 'games':
        return getGamesData(db, { date, limit });
      
      case 'game-detail':
        if (!gameId) {
          return NextResponse.json({ error: 'gameId is required for game-detail' }, { status: 400 });
        }
        return getGameDetail(db, gameId);
      
      case 'pitches':
        if (!gameId) {
          return NextResponse.json({ error: 'gameId is required for pitches' }, { status: 400 });
        }
        return getPitchData(db, gameId, limit);
      
      case 'stats':
        return getStatsData(db);
      
      case 'recent-activity':
        return getRecentActivity(db, limit);
      
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Yahoo data API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    if (db && db.open) {
      db.close();
    }
  }
}

function getGamesData(db: Database.Database, options: { date?: string | null, limit: number }) {
  let query = 'SELECT * FROM games';
  const params: any[] = [];

  if (options.date) {
    query += ' WHERE date = ?';
    params.push(options.date);
  }

  query += ' ORDER BY date DESC, game_id DESC LIMIT ?';
  params.push(options.limit);

  const games = db.prepare(query).all(...params) as YahooGameData[];
  
  return NextResponse.json({
    success: true,
    data: games,
    total: games.length,
    filters: { date: options.date, limit: options.limit }
  });
}

function getGameDetail(db: Database.Database, gameId: string) {
  const game = db.prepare('SELECT * FROM games WHERE game_id = ?').get(gameId) as YahooGameData;

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const indexes = db.prepare('SELECT * FROM batting_indexes WHERE game_id = ? ORDER BY inning, side, batter_num').all(gameId);

  const pitchSummary = db.prepare(`
    SELECT 
      COUNT(*) as total_pitches,
      COUNT(DISTINCT pitcher_name) as unique_pitchers,
      COUNT(DISTINCT batter_name) as unique_batters,
      MAX(inning) as max_inning
    FROM pitch_data 
    WHERE game_id = ?
  `).get(gameId);

  return NextResponse.json({
    success: true,
    data: {
      game,
      indexes,
      pitch_summary: pitchSummary,
      has_detailed_data: game.processed === 1
    }
  });
}

function getPitchData(db: Database.Database, gameId: string, limit: number) {
  const pitches = db.prepare(`
    SELECT * FROM pitch_data 
    WHERE game_id = ? 
    ORDER BY inning, side, pitch_sequence 
    LIMIT ?
  `).all(gameId, limit) as YahooPitchData[];

  return NextResponse.json({
    success: true,
    data: pitches,
    total: pitches.length,
    game_id: gameId
  });
}

function getStatsData(db: Database.Database) {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_games,
      COUNT(CASE WHEN processed = 1 THEN 1 END) as processed_games,
      COUNT(CASE WHEN processed = 0 THEN 1 END) as pending_games,
      MIN(date) as earliest_date,
      MAX(date) as latest_date
    FROM games
  `).get() as any;

  const pitchStats = db.prepare(`
    SELECT 
      COUNT(*) as total_pitches,
      COUNT(DISTINCT game_id) as games_with_pitches,
      COUNT(DISTINCT pitcher_name) as unique_pitchers,
      COUNT(DISTINCT batter_name) as unique_batters
    FROM pitch_data
  `).get() as any;

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
}

function getRecentActivity(db: Database.Database, limit: number) {
  const recentGames = db.prepare(`
    SELECT game_id, date, home_team, away_team, status, processed, updated_at
    FROM games 
    ORDER BY updated_at DESC 
    LIMIT ?
  `).all(limit);

  const recentPitches = db.prepare(`
    SELECT p.game_id, p.inning, p.side, p.pitcher_name, p.batter_name, 
           p.result, g.home_team, g.away_team, p.created_at
    FROM pitch_data p
    JOIN games g ON p.game_id = g.game_id
    ORDER BY p.created_at DESC 
    LIMIT ?
  `).all(Math.min(limit, 20));

  return NextResponse.json({
    success: true,
    data: {
      recent_games: recentGames,
      recent_pitches: recentPitches,
      last_updated: new Date().toISOString()
    }
  });
}