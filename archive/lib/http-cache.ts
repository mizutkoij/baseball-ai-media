/**
 * HTTP Cache システム - 帯域削減&BAN耐性UP
 * 
 * 機能:
 * - ETag/Last-Modified による条件付きGET
 * - JSONファイルベースの永続化キャッシュ
 * - 自動ローテーション（古いエントリー削除）
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface CacheHeaders {
  etag?: string;
  lastModified?: string;
  expires?: string;
  cacheControl?: string;
}

export interface CacheEntry {
  url: string;
  headers: CacheHeaders;
  content: string;
  contentType: string;
  timestamp: number;
  hits: number;
}

export class HttpCache {
  private cacheDir: string;
  private memoryCache = new Map<string, CacheEntry>();

  constructor(cacheDir: string = './data/cache/http') {
    this.cacheDir = cacheDir;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await this.loadFromDisk();
  }

  private getCacheKey(url: string): string {
    // URLを安全なファイル名に変換
    return Buffer.from(url).toString('base64url');
  }

  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  async readHeaders(url: string): Promise<CacheHeaders> {
    const key = this.getCacheKey(url);
    
    // メモリキャッシュから検索
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.hits++;
      return entry.headers;
    }

    // ディスクから読み込み
    try {
      const cachePath = this.getCachePath(key);
      const content = await fs.readFile(cachePath, 'utf-8');
      const diskEntry: CacheEntry = JSON.parse(content);
      
      // メモリキャッシュに追加
      this.memoryCache.set(key, diskEntry);
      
      return diskEntry.headers;
    } catch {
      return {}; // キャッシュなし
    }
  }

  async writeHeaders(url: string, headers: CacheHeaders, content?: string, contentType?: string): Promise<void> {
    const key = this.getCacheKey(url);
    const timestamp = Date.now();

    const entry: CacheEntry = {
      url,
      headers,
      content: content || '',
      contentType: contentType || 'text/html',
      timestamp,
      hits: 0,
    };

    // メモリキャッシュに保存
    this.memoryCache.set(key, entry);

    // ディスクに非同期保存
    try {
      const cachePath = this.getCachePath(key);
      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2));
    } catch (error) {
      console.error('Failed to write cache to disk:', error);
    }
  }

  async get(url: string): Promise<{ content: string; headers: CacheHeaders } | null> {
    const key = this.getCacheKey(url);
    const entry = this.memoryCache.get(key);
    
    if (entry) {
      entry.hits++;
      return {
        content: entry.content,
        headers: entry.headers,
      };
    }

    return null;
  }

  async cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // メモリキャッシュのクリーンアップ
    this.memoryCache.forEach((entry, key) => {
      if (now - entry.timestamp > maxAgeMs) {
        keysToDelete.push(key);
      }
    });

    // メモリから削除
    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // ディスクから削除
    await Promise.all(keysToDelete.map(async (key) => {
      try {
        await fs.unlink(this.getCachePath(key));
      } catch {
        // ファイルが存在しない場合は無視
      }
    }));
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      // 最新100件のみメモリに読み込み
      const fileStats = await Promise.all(
        jsonFiles.map(async (f) => {
          const fullPath = path.join(this.cacheDir, f);
          const stat = await fs.stat(fullPath);
          return { path: fullPath, mtime: stat.mtime.getTime() };
        })
      );
      
      const recentFiles = fileStats
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 100)
        .map(f => f.path);

      await Promise.all(recentFiles.map(async (filePath) => {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const entry: CacheEntry = JSON.parse(content);
          const key = this.getCacheKey(entry.url);
          this.memoryCache.set(key, entry);
        } catch {
          // 破損ファイルは無視
        }
      }));
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }

  getStats(): {
    memoryEntries: number;
    totalHits: number;
    hitRate: number;
    oldestEntry: number;
  } {
    const entries = Array.from(this.memoryCache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const totalRequests = entries.length * 2; // 仮想的な計算
    const oldestEntry = Math.min(...entries.map(e => e.timestamp));

    return {
      memoryEntries: entries.length,
      totalHits,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      oldestEntry: oldestEntry === Infinity ? Date.now() : oldestEntry,
    };
  }
}

// グローバルキャッシュインスタンス
export const httpCache = new HttpCache();