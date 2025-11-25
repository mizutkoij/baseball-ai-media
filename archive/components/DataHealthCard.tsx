'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DataHealthMetrics {
  coverage_percentage: number;
  lag_p95: number;
  nextpitch_p95: number;
  timestamp: string;
}

interface DataHealthCardProps {
  className?: string;
}

const DataHealthCard: React.FC<DataHealthCardProps> = ({ className = "" }) => {
  const [metrics, setMetrics] = useState<DataHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDataHealth();
    const interval = setInterval(fetchDataHealth, 30000); // 30秒ごと更新
    return () => clearInterval(interval);
  }, []);

  const fetchDataHealth = async () => {
    try {
      const response = await fetch('/api/data-health');
      if (!response.ok) throw new Error('Failed to fetch data health');
      
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatus = (coverage: number, lag: number, latency: number): 'green' | 'yellow' | 'red' => {
    // Critical thresholds
    if (coverage < 95 || lag > 15 || latency > 100) return 'red';
    
    // Warning thresholds
    if (coverage < 98 || lag > 10 || latency > 80) return 'yellow';
    
    return 'green';
  };

  const getStatusBadge = (status: 'green' | 'yellow' | 'red') => {
    const config = {
      green: { text: '良好', className: 'bg-green-100 text-green-800' },
      yellow: { text: '注意', className: 'bg-yellow-100 text-yellow-800' },
      red: { text: '危険', className: 'bg-red-100 text-red-800' }
    };
    
    return (
      <Badge className={config[status].className}>
        {config[status].text}
      </Badge>
    );
  };

  const getMetricColor = (value: number, greenThreshold: number, yellowThreshold: number, isReversed = false): string => {
    if (isReversed) {
      // 低い方が良い指標（lag, latency）
      if (value <= greenThreshold) return 'text-green-600';
      if (value <= yellowThreshold) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      // 高い方が良い指標（coverage）
      if (value >= greenThreshold) return 'text-green-600';
      if (value >= yellowThreshold) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  if (loading) {
    return (
      <Card className={`${className} animate-pulse`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">データ健全性</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card className={`${className} border-red-200`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-red-600">データ健全性</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="destructive">データ取得エラー</Badge>
        </CardContent>
      </Card>
    );
  }

  const status = getHealthStatus(
    metrics.coverage_percentage,
    metrics.lag_p95,
    metrics.nextpitch_p95
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">データ健全性</CardTitle>
          {getStatusBadge(status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Coverage Rate */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">カバレッジ率</div>
            <div className={`text-xl font-bold ${getMetricColor(metrics.coverage_percentage, 98, 95)}`}>
              {metrics.coverage_percentage.toFixed(1)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">目標: ≥98%</div>
            <div className={`text-sm ${
              metrics.coverage_percentage >= 98 ? 'text-green-600' : 
              metrics.coverage_percentage >= 95 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {metrics.coverage_percentage >= 98 ? '✓ 良好' : 
               metrics.coverage_percentage >= 95 ? '△ 注意' : '✗ 危険'}
            </div>
          </div>
        </div>

        {/* Data Lag P95 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">データ遅延 P95</div>
            <div className={`text-xl font-bold ${getMetricColor(metrics.lag_p95, 10, 15, true)}`}>
              {metrics.lag_p95.toFixed(1)}s
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">目標: ≤10s</div>
            <div className={`text-sm ${
              metrics.lag_p95 <= 10 ? 'text-green-600' : 
              metrics.lag_p95 <= 15 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {metrics.lag_p95 <= 10 ? '✓ 良好' : 
               metrics.lag_p95 <= 15 ? '△ 注意' : '✗ 危険'}
            </div>
          </div>
        </div>

        {/* Prediction Latency P95 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">予測レイテンシ P95</div>
            <div className={`text-xl font-bold ${getMetricColor(metrics.nextpitch_p95, 80, 100, true)}`}>
              {metrics.nextpitch_p95.toFixed(0)}ms
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">目標: ≤80ms</div>
            <div className={`text-sm ${
              metrics.nextpitch_p95 <= 80 ? 'text-green-600' : 
              metrics.nextpitch_p95 <= 100 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {metrics.nextpitch_p95 <= 80 ? '✓ 良好' : 
               metrics.nextpitch_p95 <= 100 ? '△ 注意' : '✗ 危険'}
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              最終更新: {new Date(metrics.timestamp).toLocaleTimeString('ja-JP')}
            </span>
            <span className={`font-medium ${
              status === 'green' ? 'text-green-600' : 
              status === 'yellow' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {status === 'green' ? '🟢 全項目正常' : 
               status === 'yellow' ? '🟡 要注意項目あり' : '🔴 緊急対応必要'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataHealthCard;