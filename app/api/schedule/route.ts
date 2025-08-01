import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
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
    // Try to connect to DuckDB first, then fallback to SQLite
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

    // Use better-sqlite3 as a fallback since DuckDB integration is complex in Next.js
    const db = new Database(dbPath);
    
    // Query games in the date range
    const query = `
      SELECT 
        game_id, date, start_time_jst, venue, status, inning,
        away_team, home_team, away_score, home_score, league, links
      FROM games 
      WHERE date BETWEEN ? AND ? 
        AND league = ?
        ${team ? 'AND (away_team = ? OR home_team = ?)' : ''}
        ${status ? 'AND status = ?' : ''}
      ORDER BY date, start_time_jst
    `;
    
    const params = [from, to, league];
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
      
      // Parse links JSON if it exists
      let links = {};
      try {
        if (game.links) {
          links = JSON.parse(game.links);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
      
      const gameData = {
        game_id: game.game_id,
        date: game.date,
        start_time_jst: game.start_time_jst,
        venue: game.venue,
        status: game.status,
        inning: game.inning,
        away_team: game.away_team,
        home_team: game.home_team,
        away_score: game.away_score,
        home_score: game.home_score,
        league: game.league,
        links: links,
        // Add team-specific info when filtering by team
        ...(team && {
          opponent: game.away_team === team ? game.home_team : game.away_team,
          home_away: game.home_team === team ? 'H' : 'A',
          result: game.status === 'FINAL' ? (
            (game.home_team === team && game.home_score > game.away_score) ||
            (game.away_team === team && game.away_score > game.home_score) ? 'W' :
            game.home_score === game.away_score ? 'D' : 'L'
          ) : null,
          score_team: game.home_team === team ? game.home_score : game.away_score,
          score_opponent: game.home_team === team ? game.away_score : game.home_score,
          game_status: game.status === 'FINAL' ? 'completed' : 
                      game.status === 'IN_PROGRESS' ? 'in_progress' : 'scheduled'
        })
      };
      
      games_by_date[dateStr].push(gameData);
      
      // Update summary counts
      switch (game.status) {
        case 'SCHEDULED':
          summary.scheduled++;
          break;
        case 'IN_PROGRESS':
          summary.in_progress++;
          break;
        case 'FINAL':
          summary.final++;
          break;
        case 'POSTPONED':
          summary.postponed++;
          break;
      }
    });
    
    db.close();
    
    // Convert games_by_date to days array format for consistency
    const days = Object.entries(games_by_date).map(([date, games]) => ({
      date,
      games: games.map((game: any) => ({
        ...game,
        // Normalize status for consistent frontend handling
        status: game.status === 'FINAL' ? 'completed' :
                game.status === 'IN_PROGRESS' ? 'in_progress' :
                game.status === 'POSTPONED' ? 'postponed' : 'scheduled'
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