import React from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Database, TrendingDown, TrendingUp } from 'lucide-react';

interface BackfillHealthProps {
  lastRunTime?: string;
  insertedRows?: number;
  deltaPct?: number;
  status?: 'healthy' | 'warning' | 'error' | 'unknown';
  className?: string;
}

interface HealthMetric {
  label: string;
  value: string | number;
  status: 'good' | 'warning' | 'error';
  icon: React.ReactNode;
}

export default function BackfillHealth({
  lastRunTime,
  insertedRows = 0,
  deltaPct = 0,
  status = 'unknown',
  className = ''
}: BackfillHealthProps) {
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'warning': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'error': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatLastRun = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
      return date.toLocaleDateString('ja-JP');
    } catch {
      return 'Invalid date';
    }
  };

  const getDeltaStatus = (delta: number): 'good' | 'warning' | 'error' => {
    const absDelta = Math.abs(delta);
    if (absDelta < 2) return 'good';
    if (absDelta < 7) return 'warning';
    return 'error';
  };

  const metrics: HealthMetric[] = [
    {
      label: 'Last Run',
      value: formatLastRun(lastRunTime),
      status: lastRunTime ? 'good' : 'warning',
      icon: <Clock className="w-4 h-4" />
    },
    {
      label: 'Rows Added',
      value: insertedRows.toLocaleString(),
      status: insertedRows > 0 ? 'good' : 'warning',
      icon: <Database className="w-4 h-4" />
    },
    {
      label: 'Coefficient Δ',
      value: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%`,
      status: getDeltaStatus(deltaPct),
      icon: deltaPct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
    }
  ];

  return (
    <div className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Data Pipeline Health</h3>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(status)}`}>
          {getStatusIcon(status)}
          <span className="capitalize">{status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
            <div className="flex items-center gap-2 mb-1">
              <span className={`${
                metric.status === 'good' ? 'text-green-400' : 
                metric.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {metric.icon}
              </span>
              <span className="text-slate-300 text-sm font-medium">{metric.label}</span>
            </div>
            <div className={`text-lg font-semibold ${
              metric.status === 'good' ? 'text-green-400' : 
              metric.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {status === 'error' && (
        <div className="mt-4 p-3 bg-red-400/10 border border-red-400/20 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Pipeline Error Detected</span>
          </div>
          <p className="text-red-300 text-sm mt-1">
            The data backfill process encountered an error. Check logs for details.
          </p>
        </div>
      )}

      {Math.abs(deltaPct) > 7 && (
        <div className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Large Coefficient Change</span>
          </div>
          <p className="text-yellow-300 text-sm mt-1">
            Coefficient delta of {deltaPct.toFixed(2)}% exceeds recommended threshold (±7%).
          </p>
        </div>
      )}
    </div>
  );
}