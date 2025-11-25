import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { rateLimiters, hashIP, getClientIP } from '@/lib/rate-limiter';
import crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PGURL,
});

// Prometheus メトリクス
let voteMetrics: any = null;
try {
  const promClient = require('prom-client');
  voteMetrics = {
    requests: new promClient.Counter({
      name: 'vote_api_requests_total',
      help: 'Total vote API requests',
      labelNames: ['method', 'status', 'result']
    }),
    latency: new promClient.Histogram({
      name: 'vote_api_latency_seconds',
      help: 'Vote API latency',
      labelNames: ['method'],
      buckets: [0.1, 0.5, 1, 2, 5]
    }),
    duplicateAttempts: new promClient.Counter({
      name: 'vote_duplicate_attempts_total',
      help: 'Duplicate vote attempts',
      labelNames: ['method']
    })
  };
} catch (e) {
  // Prometheus not available
}

function recordMetrics(method: string, status: number, result: string, latency?: number) {
  if (voteMetrics) {
    voteMetrics.requests.inc({ method, status: status.toString(), result });
    if (latency !== undefined) {
      voteMetrics.latency.observe({ method }, latency);
    }
    if (result === 'duplicate') {
      voteMetrics.duplicateAttempts.inc({ method });
    }
  }
}

// POST: 投票記録
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // レート制限チェック
    const clientIP = getClientIP(request);
    const ipHash = hashIP(clientIP);
    
    const rateLimitResult = rateLimiters.voting.check(ipHash);
    if (!rateLimitResult.allowed) {
      recordMetrics('POST', 429, 'rate_limited', Date.now() - startTime);
      return new Response('Too Many Requests', { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
        }
      });
    }

    const { playerId, playerName, teamCode } = await request.json();

    if (!playerId || !playerName) {
      recordMetrics('POST', 400, 'invalid_params', Date.now() - startTime);
      return NextResponse.json(
        { error: 'Player ID and name are required' },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || '';
    const referrer = request.headers.get('referer') || '';
    const sessionId = request.cookies.get('session_id')?.value;
    const voterKey = request.cookies.get('voter_key')?.value || sessionId || crypto.randomUUID();

    const client = await pool.connect();
    
    try {
      // JST対応の改良版投票記録関数を使用
      const result = await client.query(`
        SELECT record_player_vote_jst($1, $2, $3, $4, $5, $6, $7, $8) as vote_id
      `, [playerId, playerName, teamCode, voterKey, sessionId, ipHash, userAgent, referrer]);

      const voteId = result.rows[0].vote_id;

      if (voteId === -1) {
        recordMetrics('POST', 409, 'duplicate', Date.now() - startTime);
        return NextResponse.json(
          { error: 'Already voted today', code: 'ALREADY_VOTED' },
          { status: 409 }
        );
      }

      // 今日のランキングから取得（MV使用で高速化）
      const rankingResult = await client.query(`
        SELECT * FROM vote_leaderboard_today_mv 
        WHERE player_id = $1
      `, [playerId]);

      const playerRanking = rankingResult.rows[0];

      // 非ブロッキングでMV更新（パフォーマンス重視）
      setImmediate(() => {
        client.query('SELECT refresh_vote_leaderboards()').catch(console.error);
      });

      const response = NextResponse.json({
        success: true,
        voteId,
        player: {
          id: playerId,
          name: playerName,
          teamCode,
          currentVotes: playerRanking?.votes_today || 1,
          currentRank: playerRanking?.rank_today || null
        },
        message: `${playerName}に投票しました！`,
        rateLimitInfo: {
          remaining: rateLimitResult.remainingRequests - 1,
          resetTime: rateLimitResult.resetTime
        }
      });

      // voter_key をクッキーに設定（永続化）
      response.cookies.set('voter_key', voterKey, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 365 // 1年
      });

      // セッションIDも設定
      if (sessionId !== voterKey) {
        response.cookies.set('session_id', sessionId || crypto.randomUUID(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 30 // 30日
        });
      }

      recordMetrics('POST', 200, 'success', Date.now() - startTime);
      return response;
    } finally {
      client.release();
    }
  } catch (error) {
    recordMetrics('POST', 500, 'error', Date.now() - startTime);
    console.error('Vote POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: 投票ランキング取得
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 読み取り用レート制限（緩い）
    const clientIP = getClientIP(request);
    const ipHash = hashIP(clientIP);
    
    const rateLimitResult = rateLimiters.votingRead.check(ipHash);
    if (!rateLimitResult.allowed) {
      recordMetrics('GET', 429, 'rate_limited', Date.now() - startTime);
      return new Response('Too Many Requests', { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
        }
      });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // 最大100件
    const teamCode = searchParams.get('team');
    const period = searchParams.get('period') || 'today'; // today | 7d

    const client = await pool.connect();
    
    try {
      let rankingQuery: string;
      let params: any[];
      let tableName: string;

      if (period === '7d') {
        // 7日間ランキング（MV使用）
        tableName = 'vote_leaderboard_7d_mv';
        rankingQuery = `
          SELECT 
            player_id, player_name, team_code, 
            votes_7d as total_votes, rank_7d as rank_overall,
            latest_vote_at
          FROM ${tableName}
          ${teamCode ? 'WHERE team_code = $1' : ''}
          ORDER BY rank_7d
          LIMIT $${teamCode ? '2' : '1'}
        `;
        params = teamCode ? [teamCode, limit] : [limit];
      } else {
        // 今日のリアルタイムランキング（MV使用）
        tableName = 'vote_leaderboard_today_mv';
        rankingQuery = `
          SELECT 
            player_id, player_name, team_code, 
            votes_today as total_votes, rank_today as rank_overall,
            unique_voters
          FROM ${tableName}
          ${teamCode ? 'WHERE team_code = $1' : ''}
          ORDER BY rank_today
          LIMIT $${teamCode ? '2' : '1'}
        `;
        params = teamCode ? [teamCode, limit] : [limit];
      }

      const rankingResult = await client.query(rankingQuery, params);

      // 統計情報取得（今日分のみ、高速化のためMV使用）
      const statsResult = await client.query(`
        SELECT 
          SUM(votes_today) as total_votes,
          SUM(unique_voters) as unique_voters,
          COUNT(DISTINCT team_code) as teams_represented,
          (SELECT player_name FROM vote_leaderboard_today_mv WHERE rank_today = 1 LIMIT 1) as top_player_name,
          (SELECT votes_today FROM vote_leaderboard_today_mv WHERE rank_today = 1 LIMIT 1) as top_player_votes
        FROM vote_leaderboard_today_mv
      `);

      const stats = statsResult.rows[0] || {};

      const responseData = {
        ranking: rankingResult.rows,
        stats: {
          totalVotes: parseInt(stats.total_votes || '0'),
          uniqueVoters: parseInt(stats.unique_voters || '0'),
          teamsRepresented: parseInt(stats.teams_represented || '0'),
          topPlayer: stats.top_player_name || null,
          topPlayerVotes: parseInt(stats.top_player_votes || '0')
        },
        period,
        teamFilter: teamCode || null,
        limit,
        rateLimitInfo: {
          remaining: rateLimitResult.remainingRequests - 1,
          resetTime: rateLimitResult.resetTime
        }
      };

      const response = NextResponse.json(responseData);
      
      // キャッシュヘッダー設定（1分間キャッシュ）
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
      
      recordMetrics('GET', 200, 'success', Date.now() - startTime);
      return response;
    } finally {
      client.release();
    }
  } catch (error) {
    recordMetrics('GET', 500, 'error', Date.now() - startTime);
    console.error('Vote GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: 投票状況チェック（voter_key + IP制限確認）
export async function PATCH(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const clientIP = getClientIP(request);
    const ipHash = hashIP(clientIP);
    const voterKey = request.cookies.get('voter_key')?.value;

    const client = await pool.connect();
    
    try {
      // JST日付基準で投票状況確認
      const query = voterKey ? `
        SELECT COUNT(*) as vote_count, MAX(created_at) as last_vote_at
        FROM player_votes 
        WHERE (voter_key = $1 OR ip_hash = $2) 
        AND vote_day_jst = (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE
      ` : `
        SELECT COUNT(*) as vote_count, MAX(created_at) as last_vote_at
        FROM player_votes 
        WHERE ip_hash = $1 
        AND vote_day_jst = (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE
      `;

      const params = voterKey ? [voterKey, ipHash] : [ipHash];
      const result = await client.query(query, params);
      const { vote_count, last_vote_at } = result.rows[0];

      const hasVotedToday = parseInt(vote_count) > 0;
      
      recordMetrics('PATCH', 200, hasVotedToday ? 'already_voted' : 'can_vote', Date.now() - startTime);

      return NextResponse.json({
        hasVotedToday,
        voteCount: parseInt(vote_count),
        lastVoteAt: last_vote_at,
        canVote: !hasVotedToday,
        voterKey: voterKey || null,
        jstDate: new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
      });
    } finally {
      client.release();
    }
  } catch (error) {
    recordMetrics('PATCH', 500, 'error', Date.now() - startTime);
    console.error('Vote PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}