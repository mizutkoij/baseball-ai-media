import { NextRequest, NextResponse } from 'next/server';
// Database import moved to function to prevent build-time issues
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Parse parameters
  const from = searchParams.get('from') || new Date().toISOString().split('T')[0];
  const to = searchParams.get('to') || from;
  const league = searchParams.get('league') || 'first';
  const status = searchParams.get('status'); // Optional status filter
  const team = searchParams.get('team'); // Team filter for team-specific schedules
  
  try {
    // Database priority: db_current.db -> db_history.db -> npb.db -> mock data
    const currentDbPath = path.join(process.cwd(), 'data', 'db_current.db');
    const historyDbPath = path.join(process.cwd(), 'data', 'db_history.db');
    const mainDbPath = path.join(process.cwd(), 'data', 'npb.db');
    
    let dbPath = currentDbPath;
    const fs = require('fs');
    
    // Check which database exists (priority order)
    if (fs.existsSync(currentDbPath)) {
      dbPath = currentDbPath;
    } else if (fs.existsSync(historyDbPath)) {
      dbPath = historyDbPath;
    } else if (fs.existsSync(mainDbPath)) {
      dbPath = mainDbPath;
    } else {
      // Database not found - return mock data for production
      console.log('Database not found, returning mock schedule data');
      return NextResponse.json({
        days: [
          {
            date: new Date().toISOString().split('T')[0],
            games: [
              {
                game_id: 'mock_game_001',
                date: new Date().toISOString().split('T')[0],
                away_team: 'Giants',
                home_team: 'Tigers',
                away_score: null,
                home_score: null,
                status: 'scheduled',
                inning: null,
                ballpark: 'Koshien Stadium'
              }
            ]
          }
        ],
        total_games: 1,
        date_range: { from: from, to: to },
        source: 'mock_data_no_database'
      });
    }

    // Use better-sqlite3 as a fallback since DuckDB integration is complex in Next.js
    // Conditional import to prevent build-time issues
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    
    // Query games in the date range
    // Map league parameter: 'first' -> both central and pacific, 'farm' -> farm league
    let leagueCondition = '';
    const params = [from, to];
    
    if (league === 'first') {
      leagueCondition = "AND (league = 'central' OR league = 'pacific' OR league = 'interleague')";
    } else if (league === 'farm') {
      leagueCondition = "AND league = 'farm'";
    }
    
    const query = `
      SELECT 
        game_id, date, start_time_jst, venue, status, inning,
        away_team, home_team, away_score, home_score, league
      FROM games 
      WHERE date BETWEEN ? AND ? 
        ${leagueCondition}
        ${team ? 'AND (away_team = ? OR home_team = ?)' : ''}
        ${status ? 'AND status = ?' : ''}
      ORDER BY date, start_time_jst
    `;
    
    if (team) {
      params.push(team, team);
    }
    if (status) params.push(status);
    
    const games = db.prepare(query).all(...params);
    
    // Group games by date
    const games_by_date: Record<string, any[]> = {};
    let summary = {
      scheduled: 0,
      in_progress: 0, 
      final: 0,
      postponed: 0
    };
    
    games.forEach((game: any) => {
      const dateStr = game.date;
      if (!games_by_date[dateStr]) {
        games_by_date[dateStr] = [];
      }
      
      // Update summary counts based on status
      switch (game.status) {
        case 'scheduled':
          summary.scheduled++;
          break;
        case 'live':
          summary.in_progress++;
          break;
        case 'final':
          summary.final++;
          break;
        case 'postponed':
        case 'cancelled':
          summary.postponed++;
          break;
      }
      
      const gameData = {
        game_id: game.game_id,
        date: game.date,
        start_time_jst: game.start_time_jst || '時間未定',
        venue: game.venue,
        status: game.status,
        inning: game.inning,
        away_team: game.away_team,
        home_team: game.home_team,
        away_score: game.away_score,
        home_score: game.home_score,
        league: game.league,
        links: {
          index: `/games/${game.game_id}`,
          box: `/games/${game.game_id}/box`,
          pbp: `/games/${game.game_id}/pbp`
        }
      };
      
      games_by_date[dateStr].push(gameData);
    });
    
    db.close();
    
    // Convert games_by_date to days array format for consistency
    const days = Object.entries(games_by_date).map(([date, games]) => ({
      date,
      games: games.map((game: any) => ({
        ...game,
        // Normalize status for consistent frontend handling
        status: game.status === 'FINAL' || game.status === 'final' ? 'final' :
                game.status === 'IN_PROGRESS' || game.status === 'live' ? 'live' :
                game.status === 'POSTPONED' || game.status === 'postponed' ? 'postponed' :
                game.status === 'CANCELLED' || game.status === 'cancelled' ? 'cancelled' : 'scheduled'
      }))
    }));

    const response = {
      source: "npb_db",
      league: league,
      date_range: {
        from: from,
        to: to
      },
      total_games: games.length,
      days: days,
      games_by_date: games_by_date, // Keep for backward compatibility
      summary: summary
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in schedule API:', error);
    
    // フォールバック: モックデータを返す
    const mockGames = [{
      game_id: `${from.replace(/-/g, '')}-mock-fallback`,
      date: from,
      start_time_jst: "18:00",
      venue: "データベース接続エラー",
      status: "scheduled",
      inning: null,
      away_team: "チームA",
      home_team: "チームB", 
      away_score: null,
      home_score: null,
      league: league,
      links: {}
    }];

    const mockData = {
      source: "mock_fallback",
      league: league,
      date_range: { from, to },
      total_games: 1,
      days: [{ date: from, games: mockGames }],
      games_by_date: { [from]: mockGames },
      summary: { scheduled: 1, in_progress: 0, final: 0, postponed: 0 },
      error: "Database connection failed, using mock data"
    };
    
    return NextResponse.json(mockData);
  }
}