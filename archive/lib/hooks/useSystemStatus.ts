/**
 * System Status Hook - Real-time system monitoring
 */

import { useState, useEffect, useCallback } from 'react';

interface SystemMetrics {
  scraping: {
    status: 'active' | 'inactive' | 'error';
    lastUpdate: string;
    frequency: string;
    sources: string[];
    gamesMonitored: number;
  };
  dataQuality: {
    score: number;
    testsTotal: number;
    testsPassed: number;
    errorRate: number;
    lastCheck: string;
  };
  systemPerformance: {
    responseTime: number;
    memoryUsage: number;
    uptime: string;
    cpuUsage: number;
    diskSpace: number;
  };
  aiPrediction: {
    accuracy: number;
    dataProcessed: string;
    lastModelUpdate: string;
    modelsActive: number;
  };
}

interface SystemStatusHook {
  metrics: SystemMetrics | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function useSystemStatus(
  autoRefresh: boolean = true,
  refreshInterval: number = 30000 // 30 seconds
): SystemStatusHook {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSystemStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/system-status');
      const result = await response.json();
      
      if (result.success) {
        setMetrics(result.data);
        setError(null);
        setLastUpdated(new Date());
      } else {
        setError(result.error || 'Failed to fetch system status');
        // Still set fallback data if available
        if (result.data) {
          setMetrics(result.data);
        }
      }
    } catch (err) {
      console.error('System status fetch error:', err);
      setError('Network error while fetching system status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchSystemStatus();
  }, [fetchSystemStatus]);

  useEffect(() => {
    // Initial fetch
    fetchSystemStatus();
    
    if (!autoRefresh) return;
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      fetchSystemStatus();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchSystemStatus, autoRefresh, refreshInterval]);

  return {
    metrics,
    isLoading,
    error,
    lastUpdated,
    refresh
  };
}

// Utility functions for formatting
export function getStatusColor(status: 'active' | 'inactive' | 'error'): string {
  switch (status) {
    case 'active':
      return 'text-green-400';
    case 'inactive':
      return 'text-yellow-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
}

export function getStatusIndicatorColor(status: 'active' | 'inactive' | 'error'): string {
  switch (status) {
    case 'active':
      return 'bg-green-400';
    case 'inactive':
      return 'bg-yellow-400';
    case 'error':
      return 'bg-red-400';
    default:
      return 'bg-slate-400';
  }
}

export function formatTimeAgo(isoString: string): string {
  const now = new Date();
  const timestamp = new Date(isoString);
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) {
    return '今';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  } else if (diffMinutes < 1440) {
    const hours = Math.floor(diffMinutes / 60);
    return `${hours}時間前`;
  } else {
    const days = Math.floor(diffMinutes / 1440);
    return `${days}日前`;
  }
}

export function getQualityScoreColor(score: number): string {
  if (score >= 95) return 'text-green-400';
  if (score >= 90) return 'text-blue-400';
  if (score >= 85) return 'text-yellow-400';
  return 'text-red-400';
}