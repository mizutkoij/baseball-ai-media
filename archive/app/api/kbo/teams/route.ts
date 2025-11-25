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
  const includeHistory = searchParams.get('history') === 'true';
  const season = searchParams.get('season');
  
  try {
    const db = getDatabase();
    
    // Get basic team information
    const teamsQuery = `
      SELECT 
        team_id, team_name, team_code, city, stadium, founded, capacity,
        manager, primary_color, secondary_color, logo_emoji, total_championships
      FROM kbo_teams 
      ORDER BY team_name
    `;
    
    const teams = db.prepare(teamsQuery).all();
    
    // Enrich with history data if requested
    if (includeHistory) {
      for (const team of teams) {
        let historyQuery = `
          SELECT season, championship_won, playoff_result, final_ranking,
                 wins, losses, ties, win_percentage
          FROM kbo_team_history 
          WHERE team_code = ?
        `;
        const historyParams = [team.team_code];
        
        if (season) {
          historyQuery += ' AND season = ?';
          historyParams.push(parseInt(season));
        }
        
        historyQuery += ' ORDER BY season DESC';
        
        team.history = db.prepare(historyQuery).all(...historyParams);
      }
    }
    
    // Get league statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_teams,
        MIN(founded) as oldest_team_year,
        SUM(total_championships) as total_championships,
        AVG(capacity) as avg_capacity,
        MAX(capacity) as max_capacity
      FROM kbo_teams
    `;
    
    const stats = db.prepare(statsQuery).get();
    
    db.close();
    
    return NextResponse.json({
      teams,
      league_stats: stats,
      meta: {
        total_teams: teams.length,
        include_history: includeHistory,
        season_filter: season || 'all',
        data_source: 'kbo_comprehensive_database'
      }
    });
    
  } catch (error) {
    console.error('KBO Teams API error:', error);
    
    // Fallback data
    const fallbackTeams = [
      {
        team_name: 'Doosan Bears',
        team_code: 'DOO',
        city: 'Seoul',
        stadium: 'Jamsil Baseball Stadium',
        founded: 1982,
        logo_emoji: '🐻'
      },
      {
        team_name: 'Kia Tigers',
        team_code: 'KIA',
        city: 'Gwangju',
        stadium: 'Gwangju Champions Field',
        founded: 1982,
        logo_emoji: '🐅'
      }
    ];
    
    return NextResponse.json({
      teams: fallbackTeams,
      error: 'Database unavailable, using fallback data',
      meta: {
        total_teams: fallbackTeams.length,
        include_history: false,
        data_source: 'fallback'
      }
    });
  }
}