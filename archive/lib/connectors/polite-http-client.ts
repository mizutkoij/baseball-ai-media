/**
 * Polite HTTP Client with Conditional GET and Rate Limiting (TypeScript)
 * Yahoo/baseballdata.jp scraping with robots.txt compliance
 */

import axios, { AxiosResponse } from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { URL } from 'url';
import { notifyDataProgress, notifyRateLimit, sendJsonAttachment } from '../discord-notifier';

// Rate limiting with simple delay-based approach
interface RateLimitConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  failureMultiplier: number;
}

const DEFAULT_RATE_CONFIG: RateLimitConfig = {
  baseDelayMs: 15000,    // 15s base delay
  maxDelayMs: 45000,     // 45s max delay
  failureMultiplier: 1.5 // Increase delay on failures
};

const HIGH_SPEED_CONFIG: RateLimitConfig = {
  baseDelayMs: 8000,     // 8s for high-speed periods
  maxDelayMs: 30000,     // 30s max
  failureMultiplier: 1.3
};

const DEFAULT_HEADERS = {
  'User-Agent': 'NPB-ResearchBot/1.0 (+contact@example.com)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

interface CacheEntry {
  etag?: string;
  lastModified?: string;
  timestamp: number;
}

interface RequestResult {
  data: string;
  status: number;
  headers: Record<string, string>;
  fromCache: boolean;
}

export class PoliteHTTPClient {
  private lastRequestTime = 0;
  private failureCount = 0;
  private rateConfig = DEFAULT_RATE_CONFIG;
  private etagCache = new Map<string, CacheEntry>();
  private robotsCache = new Map<string, { allowed: boolean; timestamp: number }>();
  private cacheDir: string;
  private DEFAULT_HEADERS: Record<string, string>;

  constructor(
    private contactEmail: string = 'contact@example.com',
    cacheBaseDir: string = 'data/cache'
  ) {
    this.cacheDir = path.join(cacheBaseDir, 'http');
    this.DEFAULT_HEADERS = {
      ...DEFAULT_HEADERS,
      'User-Agent': DEFAULT_HEADERS['User-Agent'].replace('contact@example.com', this.contactEmail)
    };
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Load ETag cache
      const cacheFile = path.join(this.cacheDir, 'etag_cache.json');
      try {
        const data = await fs.readFile(cacheFile, 'utf-8');
        const parsed = JSON.parse(data);
        this.etagCache = new Map(Object.entries(parsed));
      } catch {
        // Cache file doesn't exist or is invalid, start fresh
      }
    } catch (error) {
      console.warn('Failed to initialize HTTP cache:', error);
    }
  }

  private async saveEtagCache(): Promise<void> {
    try {
      const cacheFile = path.join(this.cacheDir, 'etag_cache.json');
      const cacheObj = Object.fromEntries(this.etagCache);
      await fs.writeFile(cacheFile, JSON.stringify(cacheObj, null, 2));
    } catch (error) {
      console.warn('Failed to save ETag cache:', error);
    }
  }

  private async checkRobotsTxt(baseUrl: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `${baseUrl}#${today}`;
    
    const cached = this.robotsCache.get(cacheKey);
    if (cached) {
      return cached.allowed;
    }

    try {
      const robotsUrl = `${baseUrl}/robots.txt`;
      const response = await axios.get(robotsUrl, {
        timeout: 10000,
        headers: { 'User-Agent': DEFAULT_HEADERS['User-Agent'] }
      });

      if (response.status === 200) {
        const robotsContent = response.data.toLowerCase();
        const lines = robotsContent.split('\n');
        
        let userAgentSection = false;
        let disallowed = false;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('user-agent:')) {
            const ua = trimmed.split(':')[1]?.trim();
            userAgentSection = (ua === '*' || ua?.includes('bot') || ua?.includes('research'));
          } else if (userAgentSection && trimmed.startsWith('disallow:')) {
            const path = trimmed.split(':')[1]?.trim();
            if (path === '/' || path?.includes('/npb/')) {
              disallowed = true;
              break;
            }
          }
        }

        const allowed = !disallowed;
        this.robotsCache.set(cacheKey, { allowed, timestamp: Date.now() });
        
        if (!allowed) {
          console.warn(`robots.txt disallows scraping for ${baseUrl}`);
        }
        
        return allowed;
      } else {
        // robots.txt not found, assume allowed but be conservative
        console.info(`robots.txt not found for ${baseUrl}, proceeding conservatively`);
        this.robotsCache.set(cacheKey, { allowed: true, timestamp: Date.now() });
        return true;
      }
    } catch (error) {
      console.warn(`Failed to check robots.txt for ${baseUrl}:`, error);
      // On error, assume allowed but be conservative
      this.robotsCache.set(cacheKey, { allowed: true, timestamp: Date.now() });
      return true;
    }
  }

  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    let requiredDelay = this.rateConfig.baseDelayMs;
    
    // Apply failure multiplier
    if (this.failureCount > 0) {
      requiredDelay *= Math.pow(this.rateConfig.failureMultiplier, this.failureCount);
      requiredDelay = Math.min(requiredDelay, this.rateConfig.maxDelayMs);
    }

    const remainingDelay = requiredDelay - timeSinceLastRequest;
    
    if (remainingDelay > 0) {
      console.log(`Rate limiting: waiting ${remainingDelay}ms (failures: ${this.failureCount})`);
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }
    
    this.lastRequestTime = Date.now();
  }

  private adjustRateLimit(success: boolean, statusCode?: number): void {
    if (success) {
      if (statusCode === 304) {
        // 304 responses are good, but don't reset failure count entirely
        this.failureCount = Math.max(0, this.failureCount - 0.5);
      } else {
        // Full success
        if (this.failureCount > 0) {
          this.failureCount = Math.max(0, this.failureCount - 1);
        }
        if (this.failureCount === 0) {
          this.rateConfig = DEFAULT_RATE_CONFIG;
        }
      }
    } else {
      this.failureCount += 1;
      if (this.failureCount >= 3 || statusCode === 429 || statusCode === 503) {
        // Switch to slower rate limiting
        this.rateConfig = {
          baseDelayMs: 30000,  // 30s base
          maxDelayMs: 60000,   // 60s max
          failureMultiplier: 2.0
        };
        console.warn(`Switching to slow rate limit due to ${this.failureCount} failures`);
      }
    }
  }

  async politeGet(url: string, useCache = true): Promise<RequestResult> {
    // Check robots.txt
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
    
    const robotsAllowed = await this.checkRobotsTxt(baseUrl);
    if (!robotsAllowed) {
      throw new Error(`robots.txt disallows access to ${baseUrl}`);
    }

    // Apply rate limiting
    await this.applyRateLimit();

    // Prepare headers with conditional GET
    const headers = { ...DEFAULT_HEADERS };
    headers['User-Agent'] = `NPB-ResearchBot/1.0 (+${this.contactEmail})`;

    if (useCache) {
      const cached = this.etagCache.get(url);
      if (cached) {
        if (cached.etag) {
          headers['If-None-Match'] = cached.etag;
        }
        if (cached.lastModified) {
          headers['If-Modified-Since'] = cached.lastModified;
        }
      }
    }

    let backoff = 2000; // 2s initial backoff
    const maxAttempts = 6;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.debug(`GET ${url} (attempt ${attempt + 1})`);
        
        const response = await axios.get(url, {
          headers,
          timeout: 15000,
          maxRedirects: 5,
          validateStatus: (status) => status < 500 || status === 503 // Allow 503 for retry
        });

        if (response.status === 200 || response.status === 304) {
          // Success - update cache
          if (useCache && response.status === 200) {
            const cacheEntry: CacheEntry = { timestamp: Date.now() };
            
            if (response.headers.etag) {
              cacheEntry.etag = response.headers.etag;
            }
            if (response.headers['last-modified']) {
              cacheEntry.lastModified = response.headers['last-modified'];
            }
            
            if (cacheEntry.etag || cacheEntry.lastModified) {
              this.etagCache.set(url, cacheEntry);
              await this.saveEtagCache();
            }
          }

          this.adjustRateLimit(true, response.status);
          
          // Discord通知: 成功レスポンス
          const source = new URL(url).hostname;
          notifyDataProgress(source, {
            url,
            status: response.status,
            etag: response.headers.etag,
            duration: `${Date.now() - this.lastRequestTime}ms`
          });
          
          // データ本体も添付で送信（"毎回"）
          if (response.data && response.status === 200) {
            sendJsonAttachment(`fetch_${source}_${Date.now()}`, {
              url,
              status: response.status,
              headers: response.headers,
              dataLength: String(response.data).length,
              timestamp: new Date().toISOString()
            });
          }
          
          return {
            data: response.data,
            status: response.status,
            headers: response.headers,
            fromCache: response.status === 304
          };
        }

        if (response.status === 429 || response.status === 503) {
          // Rate limiting - respect Retry-After
          const retryAfter = response.headers['retry-after'];
          let waitTime = backoff * (1.2 + 0.3 * attempt);
          
          if (retryAfter && !isNaN(Number(retryAfter))) {
            waitTime = Math.min(Number(retryAfter) * 1000, 300000); // Max 5 minutes
          }
          
          console.warn(`Rate limited (attempt ${attempt + 1}), waiting ${waitTime}ms`);
          
          // Discord通知: レート制限
          const source = new URL(url).hostname;
          notifyRateLimit(source, Math.round(waitTime / 1000), url);
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
          backoff = Math.min(backoff * 1.7, 30000);
          this.adjustRateLimit(false, response.status);
          continue;
        }

        // Other error status
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      } catch (error: any) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          console.warn(`Timeout for ${url} (attempt ${attempt + 1})`);
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            backoff *= 1.5;
            continue;
          }
        }
        
        // アラート抑制チェック
        const statusCode = error.response?.status || 0;
        try {
          const { AlertSuppressionManager } = await import('../alert-suppression');
          const suppressionManager = new AlertSuppressionManager();
          const shouldSuppress = suppressionManager.shouldSuppressError(statusCode, 'HTTP_ERROR');
          const logLevel = suppressionManager.getLogLevel();
          
          if (!shouldSuppress || logLevel !== 'SILENT') {
            if (logLevel === 'INFO') {
              console.info(`Info: ${url} returned ${statusCode} (expected on rest day)`);
            } else {
              console.error(`Error fetching ${url}:`, error.message);
            }
          }
        } catch {
          // Fallback to normal error logging if suppression module fails
          console.error(`Error fetching ${url}:`, error.message);
        }
        
        this.adjustRateLimit(false);
        
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error(`Failed to fetch ${url} after ${maxAttempts} attempts`);
  }

  enableHighSpeedMode(): void {
    this.rateConfig = HIGH_SPEED_CONFIG;
    console.log('🚀 High-speed mode enabled (8s intervals)');
  }

  enableConservativeMode(): void {
    this.rateConfig = {
      baseDelayMs: 30000,
      maxDelayMs: 60000,
      failureMultiplier: 2.0
    };
    console.log('🐌 Conservative mode enabled (30s intervals)');
  }
}

/**
 * Text normalization for differential detection
 */
export function normalizeText(s: string): string {
  if (!s) return '';
  
  // Unicode normalization
  s = s.normalize('NFKC');
  
  // Whitespace normalization
  s = s.replace(/\\s+/g, ' ').trim();
  
  // Character normalization
  s = s.replace(/[髙]/g, '高').replace(/[﨑]/g, '崎');
  s = s.replace(/[（）]/g, m => m === '（' ? '(' : ')');
  s = s.replace(/[－‐]/g, '-');
  
  // Full-width numbers to half-width
  s = s.replace(/[０-９]/g, (match) => 
    String.fromCharCode(match.charCodeAt(0) - 0xFEE0)
  );
  
  return s;
}

/**
 * Calculate row hash for differential detection
 */
export function rowHash(cells: string[]): string {
  const normalizedCells = cells.map(c => normalizeText(c));
  const base = normalizedCells.join('||');
  return crypto.createHash('sha256').update(base, 'utf8').digest('hex');
}

/**
 * Dynamic polling interval calculation
 */
export function calculateDynamicInterval(
  lastChangeTime: Date | null,
  currentTime: Date = new Date()
): number {
  if (!lastChangeTime) return 15; // Default interval
  
  const elapsed = (currentTime.getTime() - lastChangeTime.getTime()) / 1000;
  
  if (elapsed < 30) return 8;   // Recent change
  if (elapsed < 90) return 15;  // Normal interval
  if (elapsed < 300) return 30; // Long time without change
  return 45;                    // Very long interval
}

export interface IngestResult {
  newRows: number;
  totalRows: number;
}

/**
 * Differential ingestion engine
 */
export class DifferentialIngester {
  private seenHashes = new Set<string>();
  
  constructor(
    private timelineFile: string,
    private latestFile: string
  ) {
    this.loadExistingHashes();
  }
  
  private async loadExistingHashes(): Promise<void> {
    try {
      if (await this.fileExists(this.timelineFile)) {
        const content = await fs.readFile(this.timelineFile, 'utf-8');
        const lines = content.trim().split('\\n');
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.row_hash) {
                this.seenHashes.add(data.row_hash);
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load existing hashes:', error);
    }
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  async ingestRows(
    rows: any[], 
    gameId: string, 
    index: string,
    confidence: 'high' | 'medium' | 'low' = 'high'
  ): Promise<IngestResult> {
    let newRows = 0;
    const timestamp = new Date().toISOString();
    
    const latestData = {
      gameId,
      index,
      timestamp,
      confidence,
      rows: []
    };
    
    // Ensure directories exist
    await fs.mkdir(path.dirname(this.timelineFile), { recursive: true });
    await fs.mkdir(path.dirname(this.latestFile), { recursive: true });
    
    for (const row of rows) {
      // Calculate row hash
      const rowCells = Object.values(row).map(v => String(v));
      const hashValue = rowHash(rowCells);
      
      // Process new rows only
      if (!this.seenHashes.has(hashValue)) {
        const rowWithMeta = {
          ...row,
          row_hash: hashValue,
          game_id: gameId,
          index,
          timestamp,
          confidence
        };
        
        // Append to timeline
        await fs.appendFile(
          this.timelineFile, 
          JSON.stringify(rowWithMeta) + '\\n'
        );
        
        this.seenHashes.add(hashValue);
        newRows++;
      }
      
      // Add to latest data (including hash)
      latestData.rows.push({
        ...row,
        row_hash: hashValue
      });
    }
    
    // Update latest.json
    await fs.writeFile(
      this.latestFile,
      JSON.stringify(latestData, null, 2)
    );
    
    return { newRows, totalRows: rows.length };
  }
}