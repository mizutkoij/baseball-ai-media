import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Parse parameters
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const team = searchParams.get('team'); // Optional team filter
  const league = searchParams.get('league'); // 'central', 'pacific', or null for both
  const limit = parseInt(searchParams.get('limit') || '50');
  const sort = searchParams.get('sort') || 'batting_average'; // sorting column
  const order = searchParams.get('order') || 'desc'; // 'asc' or 'desc'
  
  try {
    const currentDbPath = path.join(process.cwd(), 'data', 'db_current.db');
    const fs = require('fs');
    
    if (!fs.existsSync(currentDbPath)) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    const Database = require('better-sqlite3');
    const db = new Database(currentDbPath);
    
    // Build query with filters
    let whereConditions = [`bs.year = ?`];
    let params: any[] = [year];
    
    if (team) {
      whereConditions.push('bs.team = ?');
      params.push(team);
    }
    
    if (league) {
      whereConditions.push('t.league = ?');
      params.push(league);
    }
    
    // Validate sort column to prevent SQL injection
    const allowedSortColumns = [
      'batting_average', 'hits', 'home_runs', 'rbis', 'runs', 'ops',
      'on_base_percentage', 'slugging_percentage', 'at_bats', 'games'
    ];
    const sortColumn = allowedSortColumns.includes(sort) ? sort : 'batting_average';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    
    const query = `
      SELECT 
        bs.player_id, bs.name, bs.team, bs.position, bs.year,
        bs.games, bs.at_bats, bs.hits, bs.runs, bs.rbis,
        bs.doubles, bs.triples, bs.home_runs, bs.walks, bs.strikeouts,
        bs.stolen_bases, bs.batting_average, bs.on_base_percentage,
        bs.slugging_percentage, bs.ops, bs.updated_at,
        t.name as team_name, t.league as team_league
      FROM batting_stats bs
      LEFT JOIN teams t ON bs.team = t.team_code
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY bs.${sortColumn} ${sortOrder}, bs.hits DESC
      LIMIT ?
    `;
    
    params.push(limit);
    const battingStats = db.prepare(query).all(...params);
    
    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_players,
        AVG(batting_average) as avg_batting_average,
        MAX(batting_average) as max_batting_average,
        AVG(home_runs) as avg_home_runs,
        MAX(home_runs) as max_home_runs,
        AVG(rbis) as avg_rbis,
        MAX(rbis) as max_rbis
      FROM batting_stats bs
      LEFT JOIN teams t ON bs.team = t.team_code
      WHERE ${whereConditions.join(' AND ')}
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
      players: battingStats.map((player: any) => ({
        ...player,
        batting_average: Math.round(player.batting_average * 1000) / 1000,
        on_base_percentage: Math.round(player.on_base_percentage * 1000) / 1000,
        slugging_percentage: Math.round(player.slugging_percentage * 1000) / 1000,
        ops: Math.round(player.ops * 1000) / 1000
      })),
      summary: {
        total_players: summary.total_players,
        league_averages: {
          batting_average: Math.round(summary.avg_batting_average * 1000) / 1000,
          home_runs: Math.round(summary.avg_home_runs * 10) / 10,
          rbis: Math.round(summary.avg_rbis * 10) / 10
        },
        leaders: {
          batting_average: Math.round(summary.max_batting_average * 1000) / 1000,
          home_runs: summary.max_home_runs,
          rbis: summary.max_rbis
        }
      },
      last_updated: battingStats[0]?.updated_at || new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in batting stats API:', error);
    
    // Return mock data as fallback
    const mockPlayers = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      player_id: `mock_player_${i + 1}`,
      name: `選手${i + 1}`,
      team: ['YG', 'T', 'C', 'DB', 'S', 'D', 'H', 'F', 'L', 'M', 'B', 'E'][i % 12],
      position: ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'C', 'DH'][i % 9],
      year,
      games: Math.floor(Math.random() * 50) + 100,
      at_bats: Math.floor(Math.random() * 200) + 300,
      hits: Math.floor(Math.random() * 100) + 80,
      runs: Math.floor(Math.random() * 60) + 40,
      rbis: Math.floor(Math.random() * 80) + 50,
      doubles: Math.floor(Math.random() * 25) + 15,
      triples: Math.floor(Math.random() * 5) + 1,
      home_runs: Math.floor(Math.random() * 25) + 10,
      walks: Math.floor(Math.random() * 60) + 30,
      strikeouts: Math.floor(Math.random() * 100) + 80,
      stolen_bases: Math.floor(Math.random() * 20) + 5,
      batting_average: Math.round((0.200 + Math.random() * 0.150) * 1000) / 1000,
      on_base_percentage: Math.round((0.250 + Math.random() * 0.150) * 1000) / 1000,
      slugging_percentage: Math.round((0.300 + Math.random() * 0.200) * 1000) / 1000,
      ops: Math.round((0.650 + Math.random() * 0.250) * 1000) / 1000,
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
          batting_average: 0.265,
          home_runs: 18.5,
          rbis: 72.3
        },
        leaders: {
          batting_average: 0.342,
          home_runs: 45,
          rbis: 125
        }
      },
      last_updated: new Date().toISOString(),
      source: 'mock_fallback'
    };
    
    return NextResponse.json(mockResponse);
  }
}