/**
 * Cached Data Hook - React hook with intelligent caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheManager, createCacheKey, CacheConfigs } from '@/lib/cache/cache-manager';

interface UseCachedDataOptions {
  cacheConfig?: {
    ttlMs?: number;
    staleWhileRevalidateMs?: number;
    tags?: string[];
  };
  refreshInterval?: number;
  retryCount?: number;
  retryDelay?: number;
  suspense?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

interface UseCachedDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
  lastUpdated: Date | null;
}

export function useCachedData<T>(
  keyParts: (string | number)[],
  fetcher: () => Promise<T>,
  options: UseCachedDataOptions = {}
): UseCachedDataResult<T> {
  const {
    cacheConfig = CacheConfigs.MEDIUM_FREQ,
    refreshInterval = 0, // 0 = no auto refresh
    retryCount = 3,
    retryDelay = 1000,
    enabled = true,
    onSuccess,
    onError
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRetryRef = useRef(0);

  const cacheKey = createCacheKey(...keyParts);

  const fetchData = useCallback(async (isRetry = false): Promise<void> => {
    if (!enabled) return;

    try {
      if (!isRetry) {
        setIsLoading(true);
        setError(null);
      }

      const result = await cacheManager.get(cacheKey, fetcher, cacheConfig);
      
      setData(result);
      setIsStale(false);
      setLastUpdated(new Date());
      currentRetryRef.current = 0;
      
      onSuccess?.(result);

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      console.error(`Fetch error for ${cacheKey}:`, errorObj);

      // Retry logic
      if (currentRetryRef.current < retryCount) {
        currentRetryRef.current++;
        retryTimeoutRef.current = setTimeout(() => {
          fetchData(true);
        }, retryDelay * currentRetryRef.current);
      } else {
        setError(errorObj);
        onError?.(errorObj);
      }
    } finally {
      if (!isRetry) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, fetcher, cacheConfig, enabled, retryCount, retryDelay, onSuccess, onError]);

  const refetch = useCallback(async (): Promise<void> => {
    currentRetryRef.current = 0;
    await fetchData();
  }, [fetchData]);

  const invalidate = useCallback((): void => {
    cacheManager.invalidate(cacheKey);
    setIsStale(true);
  }, [cacheKey]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [fetchData, enabled]);

  // Auto refresh
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;

    intervalRef.current = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, refreshInterval, enabled]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    isStale,
    error,
    refetch,
    invalidate,
    lastUpdated
  };
}

// Specialized hooks for common data types

export function useCachedGames(
  date?: string,
  league: string = 'npb',
  options: UseCachedDataOptions = {}
) {
  const keyParts = ['games', league, date || new Date().toISOString().split('T')[0]];
  
  const fetcher = async () => {
    const response = await fetch(`/api/live-games?date=${date}&league=${league}`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch games');
    }
    return result.data;
  };

  return useCachedData(keyParts, fetcher, {
    cacheConfig: CacheConfigs.LIVE_DATA,
    refreshInterval: 15000, // 15 seconds
    ...options
  });
}

export function useCachedStats(
  category: string = 'trending',
  league: string = 'npb',
  options: UseCachedDataOptions = {}
) {
  const keyParts = ['stats', league, category];
  
  const fetcher = async () => {
    const response = await fetch(`/api/live-stats?category=${category}&league=${league}`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch stats');
    }
    return result.data;
  };

  return useCachedData(keyParts, fetcher, {
    cacheConfig: CacheConfigs.MEDIUM_FREQ,
    refreshInterval: 60000, // 1 minute
    ...options
  });
}

export function useCachedSystemStatus(options: UseCachedDataOptions = {}) {
  const keyParts = ['system-status'];
  
  const fetcher = async () => {
    const response = await fetch('/api/system-status');
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch system status');
    }
    return result.data;
  };

  return useCachedData(keyParts, fetcher, {
    cacheConfig: CacheConfigs.SYSTEM_STATUS,
    refreshInterval: 30000, // 30 seconds
    ...options
  });
}

// Batch cache operations
export function useCacheBatch() {
  const invalidateByTag = useCallback((tag: string) => {
    cacheManager.invalidateByTag(tag);
  }, []);

  const invalidateMultiple = useCallback((keys: string[][]) => {
    keys.forEach(keyParts => {
      const key = createCacheKey(...keyParts);
      cacheManager.invalidate(key);
    });
  }, []);

  const warmupCache = useCallback(async (entries: Array<{
    keyParts: (string | number)[];
    fetcher: () => Promise<any>;
    cacheConfig?: any;
  }>) => {
    const warmupEntries = entries.map(({ keyParts, fetcher, cacheConfig }) => ({
      key: createCacheKey(...keyParts),
      fetcher,
      options: cacheConfig || CacheConfigs.MEDIUM_FREQ
    }));

    await cacheManager.warmup(warmupEntries);
  }, []);

  return {
    invalidateByTag,
    invalidateMultiple,
    warmupCache,
    getCacheStats: () => cacheManager.getStats()
  };
}