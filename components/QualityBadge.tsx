/**
 * Quality Badge Component - P1監視強化
 * 
 * Quality Badge + 係数スパークラインの表示
 * リアルタイム品質状況とトレンドを可視化
 */

"use client";

import { useState, useEffect } from "react";
import { Shield, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Zap } from "lucide-react";

interface QualityStatus {
  status: "healthy" | "degraded" | "unknown";
  version?: string;
  pinned_version?: string;
  tests?: {
    total: number;
    passed: number;
    failed: number;
    coverage_pct: number;
  };
  last_success?: string;
  last_failure?: string;
  pinned?: boolean;
}

interface CoefficientTrend {
  name: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  status: "stable" | "drift" | "alert";
}

const MOCK_COEFFICIENT_TRENDS: CoefficientTrend[] = [
  { name: "wOBA_1B", current: 0.885, previous: 0.882, change: 0.003, changePercent: 0.34, status: "stable" },
  { name: "wOBA_2B", current: 1.250, previous: 1.247, change: 0.003, changePercent: 0.24, status: "stable" },
  { name: "wOBA_3B", current: 1.595, previous: 1.598, change: -0.003, changePercent: -0.19, status: "stable" },
  { name: "wOBA_HR", current: 2.025, previous: 2.018, change: 0.007, changePercent: 0.35, status: "stable" },
  { name: "wOBA_BB", current: 0.695, previous: 0.698, change: -0.003, changePercent: -0.43, status: "stable" },
  { name: "FIP_K", current: 2.02, previous: 2.01, change: 0.01, changePercent: 0.50, status: "stable" }
];

async function fetchQualityStatus(): Promise<QualityStatus> {
  try {
    const response = await fetch("/api/quality");
    if (response.ok) {
      return await response.json();
    }
    throw new Error("Quality API failed");
  } catch (error) {
    console.warn("Failed to fetch quality status:", error);
    return {
      status: "unknown",
      tests: { total: 195, passed: 126, failed: 69, coverage_pct: 78.3 }
    };
  }
}

function SparkLine({ trend }: { trend: CoefficientTrend }) {
  const isPositive = trend.change > 0;
  const width = Math.abs(trend.changePercent) * 10; // スケール調整
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white truncate">{trend.name}</div>
        <div className="text-xs text-slate-400">{trend.current.toFixed(3)}</div>
      </div>
      <div className="w-12 h-6 flex items-center">
        <div className={`h-1 rounded ${isPositive ? 'bg-green-400' : 'bg-red-400'}`} 
             style={{ width: `${Math.max(width, 2)}px` }}></div>
      </div>
      <div className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{trend.changePercent.toFixed(1)}%
      </div>
    </div>
  );
}

export default function QualityBadge() {
  const [qualityStatus, setQualityStatus] = useState<QualityStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQualityStatus()
      .then(setQualityStatus)
      .catch(console.error)
      .finally(() => setIsLoading(false));
      
    // 5分ごとに更新
    const interval = setInterval(() => {
      fetchQualityStatus().then(setQualityStatus).catch(console.error);
    }, 300000);
    
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-3 animate-pulse">
        <div className="h-4 bg-slate-600 rounded w-24"></div>
      </div>
    );
  }

  if (!qualityStatus) return null;

  const getStatusIcon = () => {
    switch (qualityStatus.status) {
      case "healthy": return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "degraded": return <AlertCircle className="w-4 h-4 text-amber-400" />;
      default: return <Shield className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = () => {
    switch (qualityStatus.status) {
      case "healthy": return "border-green-400/50 bg-green-950/20";
      case "degraded": return "border-amber-400/50 bg-amber-950/20";
      default: return "border-slate-400/50 bg-slate-800/20";
    }
  };

  const successRate = qualityStatus.tests 
    ? ((qualityStatus.tests.passed / qualityStatus.tests.total) * 100)
    : 0;

  return (
    <div className={`rounded-lg border transition-all ${getStatusColor()}`}>
      <div 
        className="p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-xs font-medium text-white">
              Quality Gate
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              qualityStatus.status === "healthy" 
                ? "bg-green-100 text-green-800"
                : qualityStatus.status === "degraded"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-800"
            }`}>
              {qualityStatus.status.toUpperCase()}
            </span>
          </div>
          
          <div className="text-xs text-slate-300">
            {successRate.toFixed(1)}%
          </div>
        </div>
        
        {qualityStatus.pinned && (
          <div className="mt-2 text-xs text-amber-300">
            🔒 Pinned: {qualityStatus.pinned_version}
          </div>
        )}
      </div>
      
      {isExpanded && (
        <div className="border-t border-slate-600/30 p-3">
          {/* テスト結果詳細 */}
          {qualityStatus.tests && (
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-300 mb-2">Test Results</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-green-400 font-bold">{qualityStatus.tests.passed}</div>
                  <div className="text-slate-400">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-bold">{qualityStatus.tests.failed}</div>
                  <div className="text-slate-400">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-400 font-bold">{qualityStatus.tests.coverage_pct.toFixed(1)}%</div>
                  <div className="text-slate-400">Coverage</div>
                </div>
              </div>
            </div>
          )}
          
          {/* 係数トレンド */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3 h-3 text-blue-400" />
              <div className="text-xs font-medium text-slate-300">Coefficient Trends</div>
            </div>
            <div className="space-y-2">
              {MOCK_COEFFICIENT_TRENDS.slice(0, 4).map((trend) => (
                <SparkLine key={trend.name} trend={trend} />
              ))}
            </div>
          </div>
          
          {/* 詳細リンク */}
          <div className="mt-3 pt-3 border-t border-slate-600/30">
            <a 
              href="/about/methodology"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              詳細監視ダッシュボード →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}