import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Parse parameters
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const team = searchParams.get('team'); // Optional team filter
  const league = searchParams.get('league'); // 'central', 'pacific', or null for both
  const limit = parseInt(searchParams.get('limit') || '50');
  const sort = searchParams.get('sort') || 'era'; // sorting column
  const order = searchParams.get('order') || 'asc'; // 'asc' or 'desc'
  
  try {
    const currentDbPath = path.join(process.cwd(), 'data', 'db_current.db');
    const fs = require('fs');
    
    if (!fs.existsSync(currentDbPath)) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    const Database = require('better-sqlite3');
    const db = new Database(currentDbPath);
    
    // Build query with filters
    let whereConditions = [`ps.year = ?`];
    let params: any[] = [year];
    
    if (team) {
      whereConditions.push('ps.team = ?');
      params.push(team);
    }
    
    if (league) {
      whereConditions.push('t.league = ?');
      params.push(league);
    }
    
    // Validate sort column to prevent SQL injection
    const allowedSortColumns = [
      'era', 'wins', 'losses', 'saves', 'strikeouts', 'whip',
      'innings_pitched', 'games', 'hits_allowed', 'walks'
    ];
    const sortColumn = allowedSortColumns.includes(sort) ? sort : 'era';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    
    const query = `
      SELECT 
        ps.player_id, ps.name, ps.team, ps.year,
        ps.games, ps.wins, ps.losses, ps.saves, ps.era,
        ps.innings_pitched, ps.hits_allowed, ps.runs_allowed, ps.earned_runs,
        ps.walks, ps.strikeouts, ps.home_runs_allowed, ps.whip, ps.updated_at,
        t.name as team_name, t.league as team_league
      FROM pitching_stats ps
      LEFT JOIN teams t ON ps.team = t.team_code
      WHERE ${whereConditions.join(' AND ')}
        AND ps.innings_pitched > 0
      ORDER BY ps.${sortColumn} ${sortOrder}, ps.strikeouts DESC
      LIMIT ?
    `;
    
    params.push(limit);
    const pitchingStats = db.prepare(query).all(...params);
    
    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_players,
        AVG(era) as avg_era,
        MIN(era) as min_era,
        AVG(wins) as avg_wins,
        MAX(wins) as max_wins,
        AVG(strikeouts) as avg_strikeouts,
        MAX(strikeouts) as max_strikeouts,
        AVG(saves) as avg_saves,
        MAX(saves) as max_saves
      FROM pitching_stats ps
      LEFT JOIN teams t ON ps.team = t.team_code
      WHERE ${whereConditions.join(' AND ')}
        AND ps.innings_pitched > 0
    `;
    
    const summary = db.prepare(summaryQuery).get(...params.slice(0, -1)) as any;
    
    db.close();
    
    const response = {
      year,
      league,
      team,
      sort_by: sort,
      sort_order: order,
      limit,
      players: pitchingStats.map((player: any) => ({
        ...player,
        era: Math.round(player.era * 100) / 100,
        whip: Math.round(player.whip * 100) / 100,
        innings_pitched: Math.round(player.innings_pitched * 10) / 10
      })),
      summary: {
        total_players: summary.total_players,
        league_averages: {
          era: Math.round(summary.avg_era * 100) / 100,
          wins: Math.round(summary.avg_wins * 10) / 10,
          strikeouts: Math.round(summary.avg_strikeouts * 10) / 10,
          saves: Math.round(summary.avg_saves * 10) / 10
        },
        leaders: {
          era: Math.round(summary.min_era * 100) / 100, // Best ERA is lowest
          wins: summary.max_wins,
          strikeouts: summary.max_strikeouts,
          saves: summary.max_saves
        }
      },
      last_updated: pitchingStats[0]?.updated_at || new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in pitching stats API:', error);
    
    // Return mock data as fallback
    const mockPlayers = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      player_id: `mock_pitcher_${i + 1}`,
      name: `投手${i + 1}`,
      team: ['YG', 'T', 'C', 'DB', 'S', 'D', 'H', 'F', 'L', 'M', 'B', 'E'][i % 12],
      year,
      games: Math.floor(Math.random() * 30) + 25,
      wins: Math.floor(Math.random() * 12) + 3,
      losses: Math.floor(Math.random() * 10) + 2,
      saves: Math.floor(Math.random() * 30),
      era: Math.round((2.50 + Math.random() * 2.00) * 100) / 100,
      innings_pitched: Math.round((50 + Math.random() * 150) * 10) / 10,
      hits_allowed: Math.floor(Math.random() * 150) + 80,
      runs_allowed: Math.floor(Math.random() * 80) + 40,
      earned_runs: Math.floor(Math.random() * 70) + 35,
      walks: Math.floor(Math.random() * 60) + 25,
      strikeouts: Math.floor(Math.random() * 120) + 80,
      home_runs_allowed: Math.floor(Math.random() * 15) + 5,
      whip: Math.round((1.00 + Math.random() * 0.50) * 100) / 100,
      team_name: 'モックチーム',
      team_league: i % 2 === 0 ? 'central' : 'pacific',
      updated_at: new Date().toISOString()
    }));

    const mockResponse = {
      year,
      league,
      team,
      sort_by: sort,
      sort_order: order,
      limit,
      players: mockPlayers,
      summary: {
        total_players: mockPlayers.length,
        league_averages: {
          era: 3.45,
          wins: 8.2,
          strikeouts: 145.3,
          saves: 12.8
        },
        leaders: {
          era: 2.15,
          wins: 18,
          strikeouts: 245,
          saves: 42
        }
      },
      last_updated: new Date().toISOString(),
      source: 'mock_fallback'
    };
    
    return NextResponse.json(mockResponse);
  }
}