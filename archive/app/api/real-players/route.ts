import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';

  try {
    let sql: string;
    let params: any[] = [];

    if (search) {
      sql = `
        SELECT 
          player_id,
          name,
          team,
          position,
          uniform_number,
          height,
          weight,
          birthdate,
          debut_date,
          throws,
          bats,
          updated_at
        FROM players 
        WHERE name LIKE ? 
        ORDER BY name 
        LIMIT ? OFFSET ?
      `;
      params = [`%${search}%`, limit, offset];
    } else {
      sql = `
        SELECT 
          player_id,
          name,
          team,
          position,
          uniform_number,
          height,
          weight,
          birthdate,
          debut_date,
          throws,
          bats,
          updated_at
        FROM players 
        ORDER BY name 
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    }

    const players = await query(sql, params);

    // Get total count for pagination
    const countSql = search 
      ? 'SELECT COUNT(*) as total FROM players WHERE name LIKE ?'
      : 'SELECT COUNT(*) as total FROM players';
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await query(countSql, countParams);
    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      players,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      source: 'real_database_db_current'
    });

  } catch (error) {
    console.error('Real players API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}