'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ModelMetrics {
  top1_accuracy: number;
  top3_accuracy: number;
  cross_entropy: number;
  ece: number; // Expected Calibration Error
  timestamp: string;
  previous?: {
    top1_accuracy: number;
    top3_accuracy: number;
    cross_entropy: number;
    ece: number;
  };
}

interface ModelHealthCardProps {
  className?: string;
  compact?: boolean;
}

const ModelHealthCard: React.FC<ModelHealthCardProps> = ({ 
  className = "", 
  compact = false 
}) => {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModelHealth();
    const interval = setInterval(fetchModelHealth, 60000); // 1分ごと更新
    return () => clearInterval(interval);
  }, []);

  const fetchModelHealth = async () => {
    try {
      const response = await fetch('/api/model-health');
      if (!response.ok) throw new Error('Failed to fetch model health');
      
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getChangeIndicator = (current: number, previous?: number) => {
    if (!previous) return null;
    
    const change = current - previous;
    const changePercent = (change / previous) * 100;
    
    if (Math.abs(changePercent) < 0.1) return null; // 0.1%未満は変化なし
    
    const isImprovement = 
      // Top-1/Top-3 精度は高いほど良い
      (current > previous && (current <= 1)) || 
      // CE/ECEは低いほど良い
      (current < previous && (current >= 0));
    
    return (
      <span className={`text-xs ml-1 ${
        isImprovement ? 'text-green-600' : 'text-red-600'
      }`}>
        {change > 0 ? '+' : ''}{changePercent.toFixed(1)}%
      </span>
    );
  };

  const getHealthStatus = (metrics: ModelMetrics): 'excellent' | 'good' | 'warning' | 'critical' => {
    // 健全性判定ロジック
    if (metrics.top1_accuracy > 0.7 && metrics.ece < 0.05) return 'excellent';
    if (metrics.top1_accuracy > 0.6 && metrics.ece < 0.1) return 'good';
    if (metrics.top1_accuracy > 0.5 && metrics.ece < 0.15) return 'warning';
    return 'critical';
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      excellent: { variant: 'default' as const, text: '優秀', className: 'bg-green-100 text-green-800' },
      good: { variant: 'secondary' as const, text: '良好', className: 'bg-blue-100 text-blue-800' },
      warning: { variant: 'outline' as const, text: '注意', className: 'bg-yellow-100 text-yellow-800' },
      critical: { variant: 'destructive' as const, text: '危険', className: 'bg-red-100 text-red-800' }
    };
    
    const config = variants[status as keyof typeof variants];
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.text}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className={`${className} animate-pulse`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">モデル健全性</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card className={`${className} border-red-200`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-red-600">モデル健全性</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Badge variant="destructive">データ取得エラー</Badge>
        </CardContent>
      </Card>
    );
  }

  const healthStatus = getHealthStatus(metrics);

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="text-sm font-medium">モデル:</span>
        {getStatusBadge(healthStatus)}
        <span className="text-xs text-gray-600">
          Top-1: {(metrics.top1_accuracy * 100).toFixed(1)}%
          {getChangeIndicator(metrics.top1_accuracy, metrics.previous?.top1_accuracy)}
        </span>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">モデル健全性</CardTitle>
          {getStatusBadge(healthStatus)}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-gray-600">Top-1 精度</div>
            <div className="font-semibold">
              {(metrics.top1_accuracy * 100).toFixed(1)}%
              {getChangeIndicator(metrics.top1_accuracy, metrics.previous?.top1_accuracy)}
            </div>
          </div>
          
          <div>
            <div className="text-gray-600">Top-3 精度</div>
            <div className="font-semibold">
              {(metrics.top3_accuracy * 100).toFixed(1)}%
              {getChangeIndicator(metrics.top3_accuracy, metrics.previous?.top3_accuracy)}
            </div>
          </div>
          
          <div>
            <div className="text-gray-600">Cross Entropy</div>
            <div className="font-semibold">
              {metrics.cross_entropy.toFixed(3)}
              {getChangeIndicator(metrics.cross_entropy, metrics.previous?.cross_entropy)}
            </div>
          </div>
          
          <div>
            <div className="text-gray-600">ECE</div>
            <div className="font-semibold">
              {metrics.ece.toFixed(3)}
              {getChangeIndicator(metrics.ece, metrics.previous?.ece)}
            </div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 border-t pt-2">
          最終更新: {new Date(metrics.timestamp).toLocaleTimeString('ja-JP')}
        </div>
      </CardContent>
    </Card>
  );
};

export default ModelHealthCard;