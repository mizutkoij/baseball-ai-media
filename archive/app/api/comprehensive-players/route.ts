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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const league = searchParams.get('league');
  const position = searchParams.get('position');
  const search = searchParams.get('search');
  
  const offset = (page - 1) * limit;
  
  try {
    const db = getComprehensiveDatabase();
    
    // 基本クエリ構築
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    
    if (league) {
      whereClause += ' AND league = ?';
      params.push(league);
    }
    
    if (position) {
      whereClause += ' AND primary_position = ?';
      params.push(position);
    }
    
    if (search) {
      whereClause += ' AND (full_name LIKE ? OR native_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // 選手データ取得
    const playersQuery = `
      SELECT 
        player_id,
        league,
        full_name,
        native_name,
        primary_position,
        current_team,
        team_level,
        age,
        nationality,
        height_cm,
        weight_kg,
        bats,
        throws,
        birth_city,
        birth_country,
        current_salary,
        scouting_grade,
        prospect_ranking,
        career_status
      FROM detailed_players_master 
      ${whereClause}
      ORDER BY scouting_grade DESC, full_name ASC
      LIMIT ? OFFSET ?
    `;
    
    const players = db.prepare(playersQuery).all(...params, limit, offset);
    
    // 総数取得
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM detailed_players_master 
      ${whereClause}
    `;
    
    const totalResult = db.prepare(countQuery).get(...params) as { total: number };
    const total = totalResult.total;
    
    // 統計情報取得
    const statsQuery = `
      SELECT 
        COUNT(*) as total_players,
        COUNT(DISTINCT league) as leagues,
        COUNT(DISTINCT nationality) as countries,
        AVG(age) as avg_age,
        AVG(scouting_grade) as avg_grade
      FROM detailed_players_master 
      ${whereClause}
    `;
    
    const stats = db.prepare(statsQuery).get(...params);
    
    db.close();
    
    return NextResponse.json({
      players,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 500 }
    );
  }
}