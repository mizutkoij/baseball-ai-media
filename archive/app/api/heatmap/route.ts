import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, hashIP, getClientIP } from '@/lib/rate-limiter';

const LIVE_SERVER_URL = process.env.LIVE_SERVER_URL || 'http://localhost:8787';

// Prometheus メトリクス
let heatmapMetrics: any = null;
try {
  const promClient = require('prom-client');
  heatmapMetrics = {
    requests: new promClient.Counter({
      name: 'heatmap_api_requests_total',
      help: 'Total heatmap API requests',
      labelNames: ['result', 'pitcher_id', 'count_bucket']
    }),
    latency: new promClient.Histogram({
      name: 'heatmap_api_latency_seconds',
      help: 'Heatmap API latency',
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1.0]
    }),
    proxyRequests: new promClient.Counter({
      name: 'heatmap_proxy_requests_total',
      help: 'Heatmap proxy requests to live server',
      labelNames: ['status_code', 'cache_status']
    })
  };
} catch (e) {
  // Prometheus not available
}

function recordMetrics(result: string, latency?: number, pitcherId?: string, countBucket?: string) {
  if (heatmapMetrics) {
    heatmapMetrics.requests.inc({ 
      result, 
      pitcher_id: pitcherId || 'unknown',
      count_bucket: countBucket || 'unknown'
    });
    
    if (latency !== undefined) {
      heatmapMetrics.latency.observe(latency);
    }
  }
}

function recordProxyRequest(statusCode: number, cacheStatus: string) {
  if (heatmapMetrics) {
    heatmapMetrics.proxyRequests.inc({ 
      status_code: statusCode.toString(),
      cache_status: cacheStatus 
    });
  }
}

// キャッシュTTL決定（試合状況に応じて）
function getCacheTTL(pitcherId: string): { maxAge: number; sMaxAge: number } {
  // 実装簡略化：全て5分キャッシュ
  // 本来は試合状況（進行中/終了）に応じて動的調整
  return { maxAge: 300, sMaxAge: 300 }; // 5分
}

// GET: ヒートマップデータ取得（Live Server プロキシ）
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // レート制限チェック
    const clientIP = getClientIP(request);
    const ipHash = hashIP(clientIP);
    
    const rateLimitResult = rateLimiters.general.check(ipHash);
    if (!rateLimitResult.allowed) {
      recordMetrics('rate_limited', Date.now() - startTime);
      return new Response('Too Many Requests', { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
        }
      });
    }

    const { searchParams } = new URL(request.url);
    const pitcher = searchParams.get('pitcher');
    const batterSide = searchParams.get('side');
    const count = searchParams.get('countBucket') || searchParams.get('count');
    
    // パラメータバリデーション
    if (!pitcher) {
      recordMetrics('invalid_params', Date.now() - startTime);
      return NextResponse.json(
        { error: 'pitcher parameter is required' },
        { status: 400 }
      );
    }

    // Live Server のヒートマップエンドポイントに転送
    const liveServerParams = new URLSearchParams({
      pitcher: pitcher,
      ...(batterSide && { batterSide }),
      ...(count && { count })
    });
    
    const liveServerUrl = `${LIVE_SERVER_URL}/heatmap/NPB_HEATMAP?${liveServerParams}`;
    
    const liveResponse = await fetch(liveServerUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NextJS-Heatmap-Proxy/1.0'
      }
    });

    const cacheStatus = liveResponse.headers.get('x-cache') || 'unknown';
    recordProxyRequest(liveResponse.status, cacheStatus);

    if (!liveResponse.ok) {
      if (liveResponse.status === 404) {
        recordMetrics('not_found', (Date.now() - startTime) / 1000, pitcher, count || undefined);
        return NextResponse.json(
          { 
            error: 'Heatmap not found',
            message: `No heatmap data available for pitcher ${pitcher}`,
            available: false
          },
          { status: 404 }
        );
      }
      
      recordMetrics('live_server_error', (Date.now() - startTime) / 1000, pitcher, count || undefined);
      return NextResponse.json(
        { error: 'Live server error', status: liveResponse.status },
        { status: 502 }
      );
    }

    const heatmapData = await liveResponse.json();
    
    // レスポンスデータに追加情報を付与
    const responseData = {
      ...heatmapData,
      rateLimitInfo: {
        remaining: rateLimitResult.remainingRequests - 1,
        resetTime: rateLimitResult.resetTime
      },
      proxy: {
        source: 'live-server',
        responseTime: Date.now() - startTime
      }
    };

    // キャッシュヘッダー設定
    const cacheTTL = getCacheTTL(pitcher);
    const response = NextResponse.json(responseData);
    
    response.headers.set('Cache-Control', `public, max-age=${cacheTTL.maxAge}, s-maxage=${cacheTTL.sMaxAge}, stale-while-revalidate=600`);
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
    response.headers.set('X-Proxy-Source', 'live-server');
    
    // Live Serverからのヘッダーを転送
    const contentType = liveResponse.headers.get('content-type');
    if (contentType) response.headers.set('Content-Type', contentType);
    
    recordMetrics('success', (Date.now() - startTime) / 1000, pitcher, count || undefined);
    return response;
      
  } catch (error) {
    recordMetrics('error', (Date.now() - startTime) / 1000);
    console.error('Heatmap proxy error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

// POST: ヒートマップ再計算リクエスト（Live Server プロキシ）
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { pitcher_id, force = false } = await request.json();
    
    if (!pitcher_id) {
      recordMetrics('invalid_params', Date.now() - startTime);
      return NextResponse.json(
        { error: 'pitcher_id is required' },
        { status: 400 }
      );
    }
    
    // 管理者権限チェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
      recordMetrics('unauthorized', Date.now() - startTime);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Live Server の管理APIに転送
    const liveServerUrl = `${LIVE_SERVER_URL}/admin/reload-params`;
    
    const liveResponse = await fetch(liveServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        action: 'recompute_heatmap',
        pitcher_id,
        force 
      })
    });

    if (!liveResponse.ok) {
      recordMetrics('live_server_error', (Date.now() - startTime) / 1000, pitcher_id);
      return NextResponse.json(
        { error: 'Live server error', status: liveResponse.status },
        { status: 502 }
      );
    }

    const result = await liveResponse.json();
    
    recordMetrics('recompute_requested', (Date.now() - startTime) / 1000, pitcher_id);
    
    return NextResponse.json({
      success: true,
      message: `Heatmap recomputation triggered via live server for pitcher ${pitcher_id}`,
      pitcher_id,
      force,
      live_server_response: result,
      estimated_completion: new Date(Date.now() + 2 * 60 * 1000).toISOString()
    });
    
  } catch (error) {
    recordMetrics('error', (Date.now() - startTime) / 1000);
    console.error('Heatmap recompute proxy error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

// OPTIONS: CORS対応
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}