/**
 * Live Data Hook - Real-time data management with automatic refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface LiveDataOptions {
  refreshInterval?: number;
  retryDelay?: number;
  maxRetries?: number;
  autoStart?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
}

interface LiveDataHook<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  start: () => void;
  stop: () => void;
  isRunning: boolean;
}

export function useLiveData<T>(
  endpoint: string,
  options: LiveDataOptions = {}
): LiveDataHook<T> {
  const {
    refreshInterval = 30000, // 30 seconds
    retryDelay = 5000,
    maxRetries = 3,
    autoStart = true,
    onError,
    onSuccess
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
        setLastUpdated(new Date());
        retryCountRef.current = 0;
        onSuccess?.(result.data);
      } else {
        throw new Error(result.error || 'API request failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Live data fetch error for ${endpoint}:`, err);
      
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      
      // Retry logic
      retryCountRef.current++;
      if (retryCountRef.current < maxRetries) {
        setTimeout(() => {
          if (isRunning) {
            fetchData();
          }
        }, retryDelay);
      }
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, maxRetries, retryDelay, onError, onSuccess, isRunning]);

  const start = useCallback(() => {
    if (isRunning) return;
    
    setIsRunning(true);
    retryCountRef.current = 0;
    
    // Initial fetch
    fetchData();
    
    // Set up interval
    intervalRef.current = setInterval(fetchData, refreshInterval);
  }, [isRunning, fetchData, refreshInterval]);

  const stop = useCallback(() => {
    setIsRunning(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    retryCountRef.current = 0;
    await fetchData();
  }, [fetchData]);

  // Auto-start effect
  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      stop();
    };
  }, [autoStart, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refresh,
    start,
    stop,
    isRunning
  };
}

// Specialized hooks for different data types

export function useLiveGames(
  date?: string,
  league: string = 'npb',
  options: LiveDataOptions = {}
) {
  const endpoint = `/api/live-games?date=${date || new Date().toISOString().split('T')[0]}&league=${league}`;
  return useLiveData(endpoint, {
    refreshInterval: 15000, // 15 seconds for games
    ...options
  });
}

export function useLiveStats(
  category: 'trending' | 'batters' | 'pitchers' | 'teams' = 'trending',
  league: string = 'npb',
  options: LiveDataOptions = {}
) {
  const endpoint = `/api/live-stats?category=${category}&league=${league}`;
  return useLiveData(endpoint, {
    refreshInterval: 60000, // 1 minute for stats
    ...options
  });
}

export function useSystemStatus(options: LiveDataOptions = {}) {
  const endpoint = '/api/system-status';
  return useLiveData(endpoint, {
    refreshInterval: 30000, // 30 seconds for system status
    ...options
  });
}

// Utility hook for managing multiple live data sources
export function useMultipleLiveData(
  endpoints: { key: string; endpoint: string; options?: LiveDataOptions }[]
) {
  const [globalIsLoading, setGlobalIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [allData, setAllData] = useState<Record<string, any>>({});

  const hooks = endpoints.reduce((acc, { key, endpoint, options }) => {
    acc[key] = useLiveData(endpoint, {
      onSuccess: (data) => {
        setAllData(prev => ({ ...prev, [key]: data }));
      },
      onError: (error) => {
        setGlobalError(error.message);
      },
      ...options
    });
    return acc;
  }, {} as Record<string, LiveDataHook<any>>);

  // Calculate global loading state
  useEffect(() => {
    const anyLoading = Object.values(hooks).some(hook => hook.isLoading);
    setGlobalIsLoading(anyLoading);
  }, [hooks]);

  const refreshAll = useCallback(async () => {
    setGlobalError(null);
    const promises = Object.values(hooks).map(hook => hook.refresh());
    
    try {
      await Promise.all(promises);
    } catch (error) {
      setGlobalError('Failed to refresh some data sources');
    }
  }, [hooks]);

  const startAll = useCallback(() => {
    Object.values(hooks).forEach(hook => hook.start());
  }, [hooks]);

  const stopAll = useCallback(() => {
    Object.values(hooks).forEach(hook => hook.stop());
  }, [hooks]);

  return {
    hooks,
    allData,
    globalIsLoading,
    globalError,
    refreshAll,
    startAll,
    stopAll
  };
}