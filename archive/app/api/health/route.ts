// app/api/health/route.ts
import { q } from "@/app/lib/db";

export async function GET() {
  const start = Date.now();
  
  try {
    // 代表ページヘルスチェック
    const today = new Date().toISOString().slice(0, 10);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // 1. Games一覧チェック
    const gamesResponse = await fetch(`${baseUrl}/api/games/by-date/${today}?level=NPB2`).catch(() => null);
    
    // 2. DB接続チェック  
    const dbCheck = await q('SELECT 1 as status').catch(() => null);
    
    // 3. SSE接続チェック（軽量版）
    const sseApiBase = process.env.NEXT_PUBLIC_LIVE_API_BASE || 'http://127.0.0.1:8787';
    const sseResponse = await fetch(`${sseApiBase}/health`).catch(() => null);
    
    const ttfb = Date.now() - start;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ttfb: `${ttfb}ms`,
      checks: {
        games_api: gamesResponse?.ok ? 'OK' : 'FAILED',
        database: dbCheck ? 'OK' : 'FAILED',
        sse_service: sseResponse?.ok ? 'OK' : 'FAILED'
      },
      details: {
        games_status: gamesResponse?.status || 'N/A',
        db_result: dbCheck?.[0]?.status || 'N/A',
        sse_status: sseResponse?.status || 'N/A'
      }
    };
    
    // いずれかが失敗した場合は unhealthy
    const allHealthy = Object.values(health.checks).every(status => status === 'OK');
    if (!allHealthy) {
      health.status = 'unhealthy';
    }
    
    return Response.json(health, {
      status: allHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    return Response.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      ttfb: `${Date.now() - start}ms`,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}