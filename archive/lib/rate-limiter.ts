import { Pool } from 'pg';
import { LRUCache } from 'lru-cache';

// インメモリキャッシュ（軽量制限用）
const rateLimitCache = new LRUCache<string, { count: number; resetTime: number }>({
  max: 10000,
  ttl: 60 * 60 * 1000, // 1時間
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PGURL,
});

export interface RateLimitConfig {
  windowMs: number;      // ウィンドウ時間（ミリ秒）
  maxRequests: number;   // 最大リクエスト数
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  totalRequests: number;
}

// 軽量インメモリレートリミッター（高頻度API用）
export class MemoryRateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(identifier: string): RateLimitResult {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const now = Date.now();
    const windowStart = now - (now % this.config.windowMs);
    const resetTime = windowStart + this.config.windowMs;

    let record = rateLimitCache.get(key);
    
    if (!record || record.resetTime <= now) {
      // 新しいウィンドウ
      record = { count: 1, resetTime };
      rateLimitCache.set(key, record);
      
      return {
        allowed: true,
        remainingRequests: this.config.maxRequests - 1,
        resetTime,
        totalRequests: 1
      };
    }

    // 既存ウィンドウ内
    record.count++;
    rateLimitCache.set(key, record);

    const allowed = record.count <= this.config.maxRequests;
    
    return {
      allowed,
      remainingRequests: Math.max(0, this.config.maxRequests - record.count),
      resetTime: record.resetTime,
      totalRequests: record.count
    };
  }
}

// データベース永続化レートリミッター（精密制限用）
export class PersistentRateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async check(identifier: string, endpoint: string = 'default'): Promise<RateLimitResult> {
    const client = await pool.connect();
    
    try {
      const windowStart = new Date(Date.now() - this.config.windowMs);
      
      // 現在のウィンドウ内のリクエスト数を取得
      const countResult = await client.query(`
        SELECT COALESCE(SUM(request_count), 0) as total_requests
        FROM rate_limit_log 
        WHERE ip_hash = $1 
          AND endpoint = $2 
          AND window_start > $3
      `, [identifier, endpoint, windowStart]);

      const currentCount = parseInt(countResult.rows[0].total_requests);
      const allowed = currentCount < this.config.maxRequests;

      if (allowed) {
        // リクエスト記録
        await client.query(`
          INSERT INTO rate_limit_log (ip_hash, endpoint, request_count, window_start)
          VALUES ($1, $2, 1, NOW())
          ON CONFLICT (ip_hash, endpoint, window_start) 
          DO UPDATE SET 
            request_count = rate_limit_log.request_count + 1,
            created_at = NOW()
        `, [identifier, endpoint]);
      }

      const resetTime = Date.now() + this.config.windowMs;
      
      return {
        allowed,
        remainingRequests: Math.max(0, this.config.maxRequests - currentCount - (allowed ? 1 : 0)),
        resetTime,
        totalRequests: currentCount + (allowed ? 1 : 0)
      };
      
    } finally {
      client.release();
    }
  }

  // クリーンアップ（定期実行推奨）
  async cleanup(): Promise<number> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        DELETE FROM rate_limit_log 
        WHERE created_at < NOW() - INTERVAL '2 hours'
      `);
      
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }
}

// 事前定義されたレートリミッター
export const rateLimiters = {
  // 投票API: 1分間に6回まで
  voting: new MemoryRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 6,
    keyGenerator: (ip) => `vote:${ip}`
  }),

  // 投票ランキング取得: 1分間に30回まで
  votingRead: new MemoryRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyGenerator: (ip) => `vote_read:${ip}`
  }),

  // リプレイAPI: 1分間に10回まで
  replay: new MemoryRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyGenerator: (ip) => `replay:${ip}`
  }),

  // 一般API: 1分間に60回まで
  general: new MemoryRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyGenerator: (ip) => `general:${ip}`
  }),

  // 厳格な投票制限（データベース永続化）
  votingStrict: new PersistentRateLimiter({
    windowMs: 60 * 60 * 1000, // 1時間
    maxRequests: 5 // 1時間に5回まで
  })
};

// Next.js API Route用のミドルウェア
export function withRateLimit(limiter: MemoryRateLimiter | PersistentRateLimiter, endpoint?: string) {
  return async function rateLimitMiddleware(
    identifier: string,
    onRateLimited?: () => Response
  ): Promise<RateLimitResult> {
    let result: RateLimitResult;
    
    if (limiter instanceof MemoryRateLimiter) {
      result = limiter.check(identifier);
    } else {
      result = await limiter.check(identifier, endpoint);
    }
    
    return result;
  };
}

// IP ハッシュ化（一貫性のため）
export function hashIP(ip: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'baseball-ai-salt')).digest('hex');
}

// リクエストからIPアドレス取得
export function getClientIP(request: any): string {
  const forwarded = request.headers.get?.('x-forwarded-for') || request.headers['x-forwarded-for'];
  const realIP = request.headers.get?.('x-real-ip') || request.headers['x-real-ip'];
  const remoteAddress = request.headers.get?.('remote-addr') || request.headers['remote-addr'];
  
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }
  if (remoteAddress) {
    return Array.isArray(remoteAddress) ? remoteAddress[0] : remoteAddress;
  }
  return '127.0.0.1';
}

// 使用例:
// const result = await rateLimiters.voting.check(hashIP(getClientIP(request)));
// if (!result.allowed) {
//   return new Response('Too Many Requests', { 
//     status: 429,
//     headers: {
//       'X-RateLimit-Remaining': result.remainingRequests.toString(),
//       'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
//     }
//   });
// }