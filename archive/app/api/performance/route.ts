/**
 * Performance Dashboard API - Comprehensive performance metrics and insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/performance/performance-monitor';
import { cacheManager } from '@/lib/cache/cache-manager';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    
    // Get comprehensive performance report
    const report = performanceMonitor.getPerformanceReport();
    const cacheStats = cacheManager.getStats();
    
    // Additional detailed metrics if requested
    let detailedData = {};
    if (detailed) {
      const slowEndpoints = performanceMonitor.getSlowEndpoints(20);
      const trends = performanceMonitor.getTrends();
      
      detailedData = {
        slowEndpoints,
        trends,
        cacheDetails: {
          hitRate: cacheStats.hitRate || 0,
          size: cacheStats.size,
          maxSize: cacheStats.maxSize,
          efficiency: cacheStats.size > 0 ? (cacheStats.size / cacheStats.maxSize) * 100 : 0
        }
      };
    }
    
    const duration = Date.now() - startTime;
    
    // Record this API call
    performanceMonitor.recordRequest({
      endpoint: '/api/performance',
      method: 'GET',
      duration,
      status: 200
    });
    
    return NextResponse.json({
      success: true,
      data: {
        summary: report.summary,
        recommendations: report.recommendations,
        cacheStats,
        timestamp: new Date().toISOString(),
        ...detailedData
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    performanceMonitor.recordRequest({
      endpoint: '/api/performance',
      method: 'GET',
      duration,
      status: 500,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    console.error('Performance API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch performance metrics',
      data: {
        summary: {
          responseTime: 0,
          memoryUsage: 0,
          cacheHitRate: 0,
          errorRate: 0,
          requestCount: 0,
          slowQueries: 0
        },
        recommendations: ['Performance monitoring unavailable'],
        cacheStats: { size: 0, maxSize: 0, hitRate: 0, pendingRequests: 0 }
      }
    }, { status: 500 });
  }
}

// Admin endpoint to clear caches and reset performance metrics
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const clearType = searchParams.get('type') || 'all';
    
    switch (clearType) {
      case 'cache':
        cacheManager.clear();
        break;
      case 'performance':
        performanceMonitor.cleanup();
        break;
      case 'all':
      default:
        cacheManager.clear();
        performanceMonitor.cleanup();
        break;
    }
    
    const duration = Date.now() - startTime;
    
    performanceMonitor.recordRequest({
      endpoint: '/api/performance',
      method: 'DELETE',
      duration,
      status: 200
    });
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${clearType} data successfully`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    performanceMonitor.recordRequest({
      endpoint: '/api/performance',
      method: 'DELETE',
      duration,
      status: 500,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to clear performance data'
    }, { status: 500 });
  }
}