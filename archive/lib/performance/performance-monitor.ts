/**
 * Performance Monitor - Real-time performance tracking and optimization
 */

interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  errorRate: number;
  requestCount: number;
  slowQueries: number;
}

interface RequestMetric {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
  cacheHit?: boolean;
  error?: string;
}

class PerformanceMonitor {
  private metrics: RequestMetric[] = [];
  private readonly maxMetricsHistory = 1000;
  private readonly slowThreshold = 1000; // 1 second

  /**
   * Record a request metric
   */
  recordRequest(metric: Omit<RequestMetric, 'timestamp'>): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now()
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const now = Date.now();
    const recent = this.metrics.filter(m => now - m.timestamp < 60000); // Last minute
    
    if (recent.length === 0) {
      return {
        responseTime: 0,
        memoryUsage: this.getMemoryUsage(),
        cacheHitRate: 0,
        errorRate: 0,
        requestCount: 0,
        slowQueries: 0
      };
    }

    const totalDuration = recent.reduce((sum, m) => sum + m.duration, 0);
    const errorCount = recent.filter(m => m.status >= 400).length;
    const cacheHits = recent.filter(m => m.cacheHit).length;
    const slowQueries = recent.filter(m => m.duration > this.slowThreshold).length;

    return {
      responseTime: Math.round(totalDuration / recent.length),
      memoryUsage: this.getMemoryUsage(),
      cacheHitRate: recent.length > 0 ? Math.round((cacheHits / recent.length) * 100) : 0,
      errorRate: Math.round((errorCount / recent.length) * 100),
      requestCount: recent.length,
      slowQueries
    };
  }

  /**
   * Get memory usage percentage
   */
  private getMemoryUsage(): number {
    // Skip memory usage in Edge Runtime environments
    if (typeof process === 'undefined' || !process.memoryUsage) return 0;
    
    try {
      const memUsage = process.memoryUsage();
      // Use a fixed total memory estimate for Edge Runtime compatibility
      const totalMem = 1024 * 1024 * 1024; // 1GB estimate
      return Math.round((memUsage.heapUsed / totalMem) * 100);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get slow endpoints analysis
   */
  getSlowEndpoints(limit: number = 10): Array<{
    endpoint: string;
    averageTime: number;
    requestCount: number;
    slowCount: number;
  }> {
    const endpointStats = new Map<string, {
      totalTime: number;
      count: number;
      slowCount: number;
    }>();

    const recent = this.metrics.filter(m => Date.now() - m.timestamp < 300000); // Last 5 minutes

    recent.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      const existing = endpointStats.get(key) || { totalTime: 0, count: 0, slowCount: 0 };
      
      existing.totalTime += metric.duration;
      existing.count++;
      if (metric.duration > this.slowThreshold) {
        existing.slowCount++;
      }
      
      endpointStats.set(key, existing);
    });

    return Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: Math.round(stats.totalTime / stats.count),
        requestCount: stats.count,
        slowCount: stats.slowCount
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, limit);
  }

  /**
   * Get performance trends
   */
  getTrends(): {
    responseTimeTrend: 'up' | 'down' | 'stable';
    errorRateTrend: 'up' | 'down' | 'stable';
    cacheEfficiency: 'good' | 'moderate' | 'poor';
  } {
    const now = Date.now();
    const recent = this.metrics.filter(m => now - m.timestamp < 300000); // Last 5 minutes
    const older = this.metrics.filter(m => now - m.timestamp >= 300000 && now - m.timestamp < 600000); // 5-10 minutes ago

    if (recent.length === 0 || older.length === 0) {
      return {
        responseTimeTrend: 'stable',
        errorRateTrend: 'stable',
        cacheEfficiency: 'good'
      };
    }

    // Calculate trends
    const recentAvgTime = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length;
    const olderAvgTime = older.reduce((sum, m) => sum + m.duration, 0) / older.length;
    const timeDiff = recentAvgTime - olderAvgTime;

    const recentErrorRate = recent.filter(m => m.status >= 400).length / recent.length;
    const olderErrorRate = older.filter(m => m.status >= 400).length / older.length;
    const errorDiff = recentErrorRate - olderErrorRate;

    const cacheHitRate = recent.filter(m => m.cacheHit).length / recent.length;

    return {
      responseTimeTrend: timeDiff > 50 ? 'up' : timeDiff < -50 ? 'down' : 'stable',
      errorRateTrend: errorDiff > 0.05 ? 'up' : errorDiff < -0.05 ? 'down' : 'stable',
      cacheEfficiency: cacheHitRate > 0.8 ? 'good' : cacheHitRate > 0.5 ? 'moderate' : 'poor'
    };
  }

  /**
   * Clear old metrics
   */
  cleanup(): void {
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get detailed performance report
   */
  getPerformanceReport(): {
    summary: PerformanceMetrics;
    slowEndpoints: ReturnType<typeof this.getSlowEndpoints>;
    trends: ReturnType<typeof this.getTrends>;
    recommendations: string[];
  } {
    const summary = this.getCurrentMetrics();
    const slowEndpoints = this.getSlowEndpoints();
    const trends = this.getTrends();
    
    const recommendations: string[] = [];

    if (summary.responseTime > 500) {
      recommendations.push('Consider optimizing slow endpoints or increasing cache TTL');
    }
    if (summary.cacheHitRate < 50) {
      recommendations.push('Cache hit rate is low - review caching strategy');
    }
    if (summary.errorRate > 5) {
      recommendations.push('Error rate is high - investigate failing endpoints');
    }
    if (summary.memoryUsage > 80) {
      recommendations.push('Memory usage is high - consider garbage collection or optimization');
    }
    if (trends.responseTimeTrend === 'up') {
      recommendations.push('Response times are increasing - monitor for performance degradation');
    }

    return {
      summary,
      slowEndpoints,
      trends,
      recommendations
    };
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Express middleware for automatic request tracking
export function createPerformanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function(data: any) {
      const duration = Date.now() - start;
      
      performanceMonitor.recordRequest({
        endpoint: req.path,
        method: req.method,
        duration,
        status: res.statusCode,
        cacheHit: res.get('X-Cache-Status') === 'HIT'
      });

      return originalSend.call(this, data);
    };

    next();
  };
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const getMetrics = (): PerformanceMetrics => {
    return performanceMonitor.getCurrentMetrics();
  };

  const getReport = () => {
    return performanceMonitor.getPerformanceReport();
  };

  const recordClientMetric = (metric: {
    operation: string;
    duration: number;
    success: boolean;
  }) => {
    performanceMonitor.recordRequest({
      endpoint: metric.operation,
      method: 'CLIENT',
      duration: metric.duration,
      status: metric.success ? 200 : 500
    });
  };

  return {
    getMetrics,
    getReport,
    recordClientMetric
  };
}