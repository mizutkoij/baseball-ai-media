import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database connection helper
function getDatabase() {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'db_current.db');
    return new Database(dbPath, { readonly: true });
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Failed to connect to database');
  }
}

// Helper to format player data for compatibility with existing UI
function formatPlayerData(player: any, yearlyData: any[], league: string) {
  // Group yearly data by batting and pitching
  const batting = yearlyData
    .filter(row => row.at_bats > 0 || row.games_played > 0)
    .map(row => ({
      年度: row.season,
      所属球団: row.team_name,
      試合: row.games_played || 0,
      打席: row.plate_appearances || 0,
      打数: row.at_bats || 0,
      安打: row.hits || 0,
      本塁打: row.home_runs || 0,
      打点: row.rbis || 0,
      打率: row.batting_avg || 0,
      OPS: row.ops || 0,
      OPS_plus_simple: Math.round((row.ops || 0) * 100),
      wRC_plus_simple: Math.round((row.ops || 0) * 100)
    }));

  const pitching = yearlyData
    .filter(row => row.games_pitched > 0 || row.innings_pitched > 0)
    .map(row => ({
      年度: row.season,
      所属球団: row.team_name,
      登板: row.games_pitched || 0,
      勝利: row.wins || 0,
      敗北: row.losses || 0,
      IP_float: row.innings_pitched || 0,
      三振: row.strikeouts_pitched || 0,
      防御率: row.era || 0,
      WHIP: row.whip || 0,
      FIP: row.era || 0, // Fallback to ERA for now
      ERA_minus: Math.round(100 / Math.max(row.era || 4.0, 1) * 100),
      K_pct: row.strikeouts_pitched && row.innings_pitched ? 
        (row.strikeouts_pitched / (row.innings_pitched * 3) * 100) : 0
    }));

  // Calculate career totals
  const careerBatting = batting.length > 0 ? {
    年度数: batting.length,
    試合: batting.reduce((sum, row) => sum + row.試合, 0),
    安打: batting.reduce((sum, row) => sum + row.安打, 0),
    本塁打: batting.reduce((sum, row) => sum + row.本塁打, 0)
  } : {};

  const careerPitching = pitching.length > 0 ? {
    年度数: pitching.length,
    登板: pitching.reduce((sum, row) => sum + row.登板, 0),
    勝利: pitching.reduce((sum, row) => sum + row.勝利, 0),
    奪三振: pitching.reduce((sum, row) => sum + row.三振, 0)
  } : {};

  return {
    player_id: player.player_id.toString(),
    name: player.full_name || player.name,
    name_kana: player.name_kana || '',
    url: player.official_url || '',
    first_year: yearlyData.length > 0 ? Math.min(...yearlyData.map(y => y.season)) : null,
    last_year: yearlyData.length > 0 ? Math.max(...yearlyData.map(y => y.season)) : null,
    primary_pos: player.primary_position === 'P' ? 'P' : 'B',
    is_active: player.is_active || true,
    active_source: league.toUpperCase(),
    active_confidence: '確定',
    batting,
    pitching,
    career: {
      batting: careerBatting,
      pitching: careerPitching
    }
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const playerId = parseInt(params.id);
  
  if (isNaN(playerId)) {
    return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 });
  }
  
  try {
    const db = getDatabase();
    
    // Get basic player information
    const playerQuery = `
      SELECT * FROM detailed_players_master 
      WHERE player_id = ?
    `;
    
    const player = db.prepare(playerQuery).get(playerId);
    
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    
    // Get yearly performance data
    const performanceQuery = `
      SELECT * FROM yearly_performance 
      WHERE player_id = ?
      ORDER BY season DESC
    `;
    
    const yearlyPerformance = db.prepare(performanceQuery).all(playerId);
    
    db.close();
    
    // Format data for compatibility with existing UI
    const formattedPlayer = formatPlayerData(player, yearlyPerformance, player.league);
    
    return NextResponse.json(formattedPlayer);
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player details' },
      { status: 500 }
    );
  }
}