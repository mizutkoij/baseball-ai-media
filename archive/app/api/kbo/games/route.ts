import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// Database connection helper
function getDatabase() {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(process.cwd(), 'comprehensive_baseball_database.db');
    return new Database(dbPath, { readonly: true });
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Failed to connect to database');
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const team = searchParams.get('team');
  const season = searchParams.get('season');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    const db = getDatabase();
    
    // Build query
    let gamesQuery = `
      SELECT 
        g.game_id, g.game_date, g.season, g.home_team, g.away_team,
        g.home_score, g.away_score, g.innings, g.stadium, g.attendance,
        g.weather, g.game_status,
        ht.team_name as home_team_name, ht.logo_emoji as home_logo,
        at.team_name as away_team_name, at.logo_emoji as away_logo
      FROM kbo_games g
      LEFT JOIN kbo_teams ht ON g.home_team = ht.team_code
      LEFT JOIN kbo_teams at ON g.away_team = at.team_code
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (date) {
      gamesQuery += ' AND g.game_date = ?';
      params.push(date);
    }
    
    if (team) {
      gamesQuery += ' AND (g.home_team = ? OR g.away_team = ?)';
      params.push(team, team);
    }
    
    if (season) {
      gamesQuery += ' AND g.season = ?';
      params.push(parseInt(season));
    }
    
    gamesQuery += ' ORDER BY g.game_date DESC, g.game_id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const games = db.prepare(gamesQuery).all(...params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM kbo_games WHERE 1=1';
    const countParams: any[] = [];
    
    if (date) {
      countQuery += ' AND game_date = ?';
      countParams.push(date);
    }
    
    if (team) {
      countQuery += ' AND (home_team = ? OR away_team = ?)';
      countParams.push(team, team);
    }
    
    if (season) {
      countQuery += ' AND season = ?';
      countParams.push(parseInt(season));
    }
    
    const { total } = db.prepare(countQuery).get(...countParams);
    
    // Get league statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_games,
        AVG(home_score + away_score) as avg_total_runs,
        AVG(attendance) as avg_attendance,
        COUNT(CASE WHEN innings > 9 THEN 1 END) as extra_inning_games,
        COUNT(CASE WHEN home_score > away_score THEN 1 END) as home_wins
      FROM kbo_games
      WHERE game_status = 'completed'
    `;
    
    if (season) {
      const seasonStatsQuery = statsQuery + ' AND season = ?';
      var stats = db.prepare(seasonStatsQuery).get(parseInt(season));
    } else {
      var stats = db.prepare(statsQuery).get();
    }
    
    // Calculate home win percentage
    if (stats && stats.total_games > 0) {
      stats.home_win_percentage = (stats.home_wins / stats.total_games * 100).toFixed(1);
    }
    
    db.close();
    
    return NextResponse.json({
      games,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      },
      statistics: stats,
      filters: {
        date,
        team,
        season: season || 'all'
      },
      meta: {
        data_source: 'kbo_comprehensive_database'
      }
    });
    
  } catch (error) {
    console.error('KBO Games API error:', error);
    
    // Fallback data
    const fallbackGames = [
      {
        game_id: 1,
        game_date: '2024-08-15',
        season: 2024,
        home_team: 'DOO',
        away_team: 'KIA',
        home_score: 7,
        away_score: 4,
        innings: 9,
        stadium: 'Jamsil Baseball Stadium',
        home_team_name: 'Doosan Bears',
        away_team_name: 'Kia Tigers',
        home_logo: '🐻',
        away_logo: '🐅'
      }
    ];
    
    return NextResponse.json({
      games: fallbackGames,
      error: 'Database unavailable, using fallback data',
      pagination: { total: 1, limit, offset, has_more: false },
      meta: { data_source: 'fallback' }
    });
  }
}