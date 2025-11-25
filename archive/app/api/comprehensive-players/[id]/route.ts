import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// 包括的データベースへの接続
function getComprehensiveDatabase() {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(process.cwd(), 'comprehensive_baseball_database.db');
    return new Database(dbPath, { readonly: true });
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Failed to connect to database');
  }
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
    const db = getComprehensiveDatabase();
    
    // 基本選手情報取得
    const playerQuery = `
      SELECT * FROM detailed_players_master 
      WHERE player_id = ?
    `;
    
    const player = db.prepare(playerQuery).get(playerId);
    
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    
    // 学歴・経歴情報取得
    const backgroundQuery = `
      SELECT * FROM player_background 
      WHERE player_id = ?
    `;
    
    const background = db.prepare(backgroundQuery).get(playerId);
    
    // 年度別成績取得
    const performanceQuery = `
      SELECT * FROM yearly_performance 
      WHERE player_id = ?
      ORDER BY season DESC
    `;
    
    const yearlyPerformance = db.prepare(performanceQuery).all(playerId);
    
    // セイバーメトリクス取得
    const sabermetricsQuery = `
      SELECT * FROM yearly_sabermetrics 
      WHERE player_id = ?
      ORDER BY season DESC
    `;
    
    const sabermetrics = db.prepare(sabermetricsQuery).all(playerId);
    
    // 受賞歴取得
    const awardsQuery = `
      SELECT * FROM awards_achievements 
      WHERE player_id = ?
      ORDER BY award_year DESC
    `;
    
    const awards = db.prepare(awardsQuery).all(playerId);
    
    db.close();
    
    return NextResponse.json({
      player,
      background,
      yearlyPerformance,
      sabermetrics,
      awards
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player details' },
      { status: 500 }
    );
  }
}