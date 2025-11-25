/**
 * Cache Manager - Comprehensive caching strategy implementation
 */

import { LRUCache } from 'lru-cache';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version?: string;
  tags?: string[];
}

interface CacheOptions {
  maxSize?: number;
  ttlMs?: number;
  staleWhileRevalidateMs?: number;
  tags?: string[];
}

class CacheManager {
  private memoryCache: LRUCache<string, CacheEntry<any>>;
  private pendingRequests = new Map<string, Promise<any>>();
  
  constructor() {
    this.memoryCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes default TTL
    });
  }

  /**
   * Get data from cache or execute fetcher if not found/stale
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const {
      ttlMs = 5 * 60 * 1000, // 5 minutes
      staleWhileRevalidateMs = 30 * 60 * 1000, // 30 minutes
      tags = []
    } = options;

    const cached = this.memoryCache.get(key);
    const now = Date.now();

    // Cache hit - check if fresh
    if (cached) {
      const age = now - cached.timestamp;
      
      // Fresh cache hit
      if (age < ttlMs) {
        return cached.data;
      }
      
      // Stale but within stale-while-revalidate window
      if (age < staleWhileRevalidateMs) {
        // Return stale data immediately
        const staleData = cached.data;
        
        // Revalidate in background (no await)
        this.backgroundRevalidate(key, fetcher, { ...options, tags });
        
        return staleData;
      }
    }

    // Cache miss or expired - fetch fresh data
    return this.fetchAndCache(key, fetcher, { ...options, tags });
  }

  /**
   * Fetch data and cache it, with deduplication
   */
  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const fetchPromise = this.executeFetch(key, fetcher, options);
    this.pendingRequests.set(key, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Execute the actual fetch and cache the result
   */
  private async executeFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    try {
      const data = await fetcher();
      
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        tags: options.tags || []
      };

      this.memoryCache.set(key, entry);
      return data;
    } catch (error) {
      // On error, return stale data if available
      const stale = this.memoryCache.get(key);
      if (stale) {
        console.warn(`Fetch failed for ${key}, returning stale data:`, error);
        return stale.data;
      }
      throw error;
    }
  }

  /**
   * Background revalidation without blocking
   */
  private backgroundRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): void {
    // Fire and forget
    this.executeFetch(key, fetcher, options).catch(error => {
      console.warn(`Background revalidation failed for ${key}:`, error);
    });
  }

  /**
   * Set data directly in cache
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      tags: options.tags || []
    };
    this.memoryCache.set(key, entry);
  }

  /**
   * Invalidate cache entries by key
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
  }

  /**
   * Invalidate cache entries by tag
   */
  invalidateByTag(tag: string): void {
    const keysToDelete: string[] = [];
    
    this.memoryCache.forEach((entry, key) => {
      if (entry.tags?.includes(tag)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.memoryCache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.memoryCache.size,
      maxSize: this.memoryCache.max,
      hitRate: this.memoryCache.calculatedSize || 0,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Warmup cache with predefined data
   */
  async warmup(entries: Array<{ key: string; fetcher: () => Promise<any>; options?: CacheOptions }>): Promise<void> {
    const promises = entries.map(({ key, fetcher, options }) =>
      this.get(key, fetcher, options).catch(error => {
        console.warn(`Cache warmup failed for ${key}:`, error);
        return null;
      })
    );

    await Promise.allSettled(promises);
  }
}

// Create singleton instance
export const cacheManager = new CacheManager();

// Helper functions for common cache operations
export function createCacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

export function createTimestampedKey(baseKey: string, intervalMs: number = 60000): string {
  const bucket = Math.floor(Date.now() / intervalMs);
  return `${baseKey}:${bucket}`;
}

// Cache decorators for API routes
export function withCache<T>(
  key: string,
  options: CacheOptions = {}
) {
  return function(fetcher: () => Promise<T>): Promise<T> {
    return cacheManager.get(key, fetcher, options);
  };
}

// Predefined cache configurations
export const CacheConfigs = {
  // Fast changing data (games, live stats)
  LIVE_DATA: {
    ttlMs: 15 * 1000, // 15 seconds
    staleWhileRevalidateMs: 60 * 1000, // 1 minute
    tags: ['live']
  },
  
  // Medium frequency data (player stats, standings)
  MEDIUM_FREQ: {
    ttlMs: 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidateMs: 30 * 60 * 1000, // 30 minutes
    tags: ['stats']
  },
  
  // Slow changing data (player profiles, team info)
  STATIC_DATA: {
    ttlMs: 60 * 60 * 1000, // 1 hour
    staleWhileRevalidateMs: 24 * 60 * 60 * 1000, // 24 hours
    tags: ['static']
  },
  
  // System status and health data
  SYSTEM_STATUS: {
    ttlMs: 30 * 1000, // 30 seconds
    staleWhileRevalidateMs: 2 * 60 * 1000, // 2 minutes
    tags: ['system']
  }
};