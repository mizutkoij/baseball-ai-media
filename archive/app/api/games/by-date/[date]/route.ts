// app/api/games/by-date/[date]/route.ts
import { query } from "@/lib/db";

function getRevalidateTime(date: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = new Date(date);
  const todayDate = new Date(today);
  
  // 過去: 1時間キャッシュ（確定データ）
  if (date < today) return 3600;
  
  // 未来: 5分キャッシュ（スケジュール変更対応）
  if (date > today) return 300;
  
  // 今日: 1分キャッシュ（リアルタイム更新）
  return 60;
}

function getCacheHeaders(date: string): HeadersInit {
  const today = new Date().toISOString().slice(0, 10);
  
  if (date < today) {
    // 過去: 長期キャッシュ
    return {
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
      'CDN-Cache-Control': 'max-age=3600'
    };
  } else if (date > today) {
    // 未来: 中期キャッシュ
    return {
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      'CDN-Cache-Control': 'max-age=300'
    };
  } else {
    // 今日: 短期キャッシュ + SWR
    return {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
      'CDN-Cache-Control': 'max-age=60'
    };
  }
}

export async function GET(req: Request, { params }: { params: { date: string } }) {
  try {
    const url = new URL(req.url);
    const level = (url.searchParams.get("level") || "NPB1").toUpperCase();

    // SQLite direct access
    const Database = require('better-sqlite3');
    const db = new Database('./data/db_current.db');
    
    const rows = db.prepare(`
      SELECT 
        game_id, 
        date,
        league,
        home_team, 
        away_team, 
        home_score,
        away_score,
        start_time_jst,
        venue, 
        status
      FROM games 
      WHERE date = ? 
      ORDER BY start_time_jst ASC, game_id ASC
    `).all(params.date);
    
    db.close();

    return Response.json({ 
      date: params.date, 
      level, 
      games: rows,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        ...getCacheHeaders(params.date),
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Games API error:', error);
    
    // Fallback to mock data for demo
    const mockGames = [
      {
        game_id: `${params.date}_demo_01`,
        date: params.date,
        level: "NPB2",
        home_team: "ファーム巨人",
        away_team: "ファーム阪神",
        start_time_jst: "13:00",
        venue: "ジャイアンツ球場",
        status: "SCHEDULED"
      }
    ];

    return Response.json({ 
      date: params.date, 
      level: "NPB2", 
      games: mockGames,
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
}