/**
 * 統一HTTPクライアント + レート制御システム
 * 
 * 機能:
 * - トークンバケット式レート制限
 * - 指数バックオフ + ジッター
 * - 条件付きリクエスト (ETag, If-Modified-Since)
 * - 429/503専用リトライ
 * - 構造化ログ
 */

import type { HttpRequestOptions, LogEntry } from '../types/npb';
import { npbCircuitBreaker } from './circuit-breaker';
import { httpCache } from './http-cache';
import { httpRequests, httpRetries, circuitOpen, cacheStats } from './prometheus-metrics';
import { logHttpEvent } from './logger';

interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number; // tokens per second
  lastRefill: number;
}

interface CacheEntry {
  etag?: string;
  lastModified?: string;
  content: string;
  timestamp: number;
}

export class HttpClient {
  private bucket: TokenBucket;
  private cache = new Map<string, CacheEntry>();
  private userAgent: string;
  private logger: (entry: LogEntry) => void;

  constructor(options: {
    requestsPerSecond?: number;
    burstSize?: number;
    userAgent?: string;
    logger?: (entry: LogEntry) => void;
    enableCache?: boolean;
  } = {}) {
    this.bucket = {
      tokens: options.burstSize || 10,
      capacity: options.burstSize || 10,
      refillRate: options.requestsPerSecond || 2,
      lastRefill: Date.now(),
    };
    
    this.userAgent = options.userAgent || 'NPB-Scraper/1.0 (+https://baseball-ai-media.vercel.app)';
    this.logger = options.logger || (() => {});
    
    // HTTPキャッシュ初期化
    if (options.enableCache !== false) {
      httpCache.init().catch(error => {
        this.logger({
          timestamp: new Date().toISOString(),
          level: 'warn',
          component: 'http-client',
          message: 'Failed to initialize HTTP cache',
          error: { name: 'CacheInitError', message: String(error) }
        });
      });
    }
  }

  async request(options: HttpRequestOptions): Promise<{
    content: string;
    status: number;
    headers: Record<string, string>;
    fromCache: boolean;
  }> {
    const startTime = Date.now();
    const method = options.method || 'GET';
    const host = new URL(options.url).hostname;
    let finalStatus = 'ERROR';
    let fromCache = false;
    
    try {
      // レート制限適用
      await this.acquireToken();
      
      // 永続キャッシュチェック
      const cachedHeaders = await httpCache.readHeaders(options.url);
      const cachedContent = await httpCache.get(options.url);
      
      // リクエストヘッダー構築
      const headers: Record<string, string> = {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...options.headers,
      };

      // 条件付きリクエスト（ETag/Last-Modified）
      if (cachedHeaders.etag) {
        headers['If-None-Match'] = cachedHeaders.etag;
      }
      if (cachedHeaders.lastModified) {
        headers['If-Modified-Since'] = cachedHeaders.lastModified;
      }

      // サーキットブレーカーでリクエストをラップ
      const response = await npbCircuitBreaker.exec(async () => {
        return await this.fetchWithRetry({
          ...options,
          headers,
        });
      });

      const responseTime = Date.now() - startTime;
      finalStatus = response.status.toString();

      // 構造化ログ
      logHttpEvent(
        { url: options.url },
        'response',
        {
          method,
          status: response.status,
          duration_ms: responseTime,
          cache: response.status === 304,
        }
      );

      // 304 Not Modified の場合はキャッシュから返す
      if (response.status === 304 && cachedContent) {
        // Headers to Record<string, string> conversion
        const headersRecord: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headersRecord[key] = value;
        });

        fromCache = true;
        cacheStats.inc({ event: 'hit' });
        
        logHttpEvent(
          { url: options.url },
          'cache_hit',
          { method, duration_ms: responseTime }
        );

        return {
          content: cachedContent.content,
          status: 200,
          headers: headersRecord,
          fromCache: true,
        };
      }

      const content = await response.text();

      // 永続キャッシュ更新
      if (response.status === 200) {
        cacheStats.inc({ event: 'store' });
        
        await httpCache.writeHeaders(
          options.url,
          {
            etag: response.headers.get('etag') || undefined,
            lastModified: response.headers.get('last-modified') || undefined,
            expires: response.headers.get('expires') || undefined,
            cacheControl: response.headers.get('cache-control') || undefined,
          },
          content,
          response.headers.get('content-type') || 'text/html'
        );
      } else {
        cacheStats.inc({ event: 'miss' });
      }

      // Headers to Record<string, string> conversion
      const headersRecord: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersRecord[key] = value;
      });

      return {
        content,
        status: response.status,
        headers: headersRecord,
        fromCache: false,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // サーキットブレーカーエラーの特別処理
      if (error instanceof Error && error.message.startsWith('CB_')) {
        circuitOpen.inc({ target: host });
        
        logHttpEvent(
          { url: options.url },
          'circuit_open',
          { method, duration_ms: responseTime, error: error.message }
        );
        
        // サーキットブレーカーエラーは別の例外として再throw
        throw new Error(`CIRCUIT_BREAKER_OPEN: ${options.url}`);
      }
      
      this.logger({
        timestamp: new Date().toISOString(),
        level: 'error',
        component: 'http-client',
        message: `HTTP request failed: ${options.url}`,
        data: {
          method: options.method || 'GET',
          url: options.url,
          responseTime,
        },
        error: {
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      throw error;
    } finally {
      // 最終的なメトリクス記録
      const responseTime = Date.now() - startTime;
      const cache = fromCache ? 'hit' : 'miss';
      
      httpRequests.inc({ method, host, status: finalStatus, cache });
    }
  }

  private async fetchWithRetry(options: HttpRequestOptions): Promise<Response> {
    const maxRetries = options.retries || 3;
    const baseDelay = options.retryDelay || 1000;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);

        const response = await fetch(options.url, {
          method: options.method || 'GET',
          headers: options.headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 成功レスポンス
        if (response.ok || response.status === 304) {
          return response;
        }

        // 429 (Too Many Requests) or 503 (Service Unavailable) の場合は特別処理
        if (response.status === 429 || response.status === 503) {
          const retryAfter = response.headers.get('Retry-After');
          let delay: number;
          
          if (retryAfter) {
            // Retry-After優先：秒数 or HTTP日付形式
            const retrySeconds = parseInt(retryAfter);
            if (!isNaN(retrySeconds)) {
              delay = retrySeconds * 1000; // 秒→ミリ秒
            } else {
              // HTTP日付形式の場合
              const retryDate = new Date(retryAfter);
              const now = new Date();
              delay = Math.max(retryDate.getTime() - now.getTime(), baseDelay);
            }
          } else {
            delay = this.calculateBackoffDelay(attempt, baseDelay);
          }
          
          const reason = response.status === 429 ? 'rate_limit' : '5xx';
          httpRetries.inc({ reason });
          
          logHttpEvent(
            { url: options.url },
            'retry',
            { method: options.method || 'GET', status: response.status, attempt, delay, reason }
          );

          if (attempt < maxRetries) {
            await this.sleep(delay);
            continue;
          }
        }

        // その他のHTTPエラー
        if (attempt === maxRetries) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // リトライ
        const delay = this.calculateBackoffDelay(attempt, baseDelay);
        await this.sleep(delay);
        
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        // AbortError以外はリトライ
        if (error instanceof Error && error.name !== 'AbortError') {
          const delay = this.calculateBackoffDelay(attempt, baseDelay);
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  private async acquireToken(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.bucket.lastRefill;
    
    // トークン補充
    const tokensToAdd = Math.floor((elapsed / 1000) * this.bucket.refillRate);
    this.bucket.tokens = Math.min(this.bucket.capacity, this.bucket.tokens + tokensToAdd);
    this.bucket.lastRefill = now;

    // トークンがない場合は待機
    if (this.bucket.tokens < 1) {
      const waitTime = Math.ceil(1000 / this.bucket.refillRate);
      this.logger({
        timestamp: new Date().toISOString(),
        level: 'debug',
        component: 'http-client',
        message: `Rate limited, waiting ${waitTime}ms for token`,
        data: { tokens: this.bucket.tokens, waitTime },
      });
      
      await this.sleep(waitTime);
      return this.acquireToken();
    }

    // トークン消費
    this.bucket.tokens--;
  }

  private calculateBackoffDelay(attempt: number, baseDelay: number): number {
    // 指数バックオフ + ジッター
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, 30000); // 最大30秒
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // キャッシュクリーンアップ（古いエントリを削除）
  cleanupCache(maxAge: number = 24 * 60 * 60 * 1000): void { // 24時間
    const now = Date.now();
    const urlsToDelete: string[] = [];
    
    this.cache.forEach((entry, url) => {
      if (now - entry.timestamp > maxAge) {
        urlsToDelete.push(url);
      }
    });
    
    urlsToDelete.forEach(url => this.cache.delete(url));
  }

  // 統計情報取得
  getStats(): {
    cacheSize: number;
    cacheHitRate: number;
    currentTokens: number;
    requestsInProgress: number;
  } {
    return {
      cacheSize: this.cache.size,
      cacheHitRate: 0, // 実装時に計算
      currentTokens: this.bucket.tokens,
      requestsInProgress: 0, // 実装時に計算
    };
  }
}

// シングルトンインスタンス
export const httpClient = new HttpClient({
  requestsPerSecond: 2, // NPB公式サイトに優しく
  burstSize: 5,
  userAgent: 'NPB-Scraper/1.0 (+https://baseball-ai-media.vercel.app)',
});