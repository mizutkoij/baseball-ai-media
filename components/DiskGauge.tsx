import React from 'react';
import { HardDrive, AlertTriangle, CheckCircle, Server } from 'lucide-react';

interface DiskGaugeProps {
  usedGB?: number;
  totalGB?: number;
  availableGB?: number;
  className?: string;
}

export default function DiskGauge({
  usedGB = 0,
  totalGB = 100,
  availableGB = 100,
  className = ''
}: DiskGaugeProps) {
  
  const usagePercent = Math.min(Math.round((usedGB / totalGB) * 100), 100);
  
  const getUsageStatus = (percent: number) => {
    if (percent < 60) return { status: 'healthy', color: 'text-green-400', bgColor: 'bg-green-400' };
    if (percent < 80) return { status: 'warning', color: 'text-yellow-400', bgColor: 'bg-yellow-400' };
    return { status: 'critical', color: 'text-red-400', bgColor: 'bg-red-400' };
  };

  const { status, color, bgColor } = getUsageStatus(usagePercent);

  const formatSize = (sizeGB: number) => {
    if (sizeGB < 1) {
      return `${Math.round(sizeGB * 1024)} MB`;
    }
    return `${sizeGB.toFixed(1)} GB`;
  };

  return (
    <div className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Storage Usage</h3>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
          status === 'healthy' ? 'text-green-400 bg-green-400/10 border border-green-400/20' :
          status === 'warning' ? 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/20' :
          'text-red-400 bg-red-400/10 border border-red-400/20'
        }`}>
          {status === 'healthy' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="capitalize">{status}</span>
        </div>
      </div>

      {/* Circular Progress */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
            {/* Background circle */}
            <path
              className="stroke-slate-700"
              fill="none"
              strokeWidth="3"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            {/* Progress circle */}
            <path
              className={`stroke-current ${color}`}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${usagePercent}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${color}`}>
              {usagePercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Storage Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300">Database Size</span>
          </div>
          <span className="text-white font-medium">{formatSize(usedGB)}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300">Available Space</span>
          </div>
          <span className="text-white font-medium">{formatSize(availableGB)}</span>
        </div>

        {/* Usage Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>0 GB</span>
            <span>{formatSize(totalGB)}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${bgColor} transition-all duration-300`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Warnings */}
      {status === 'critical' && (
        <div className="mt-4 p-3 bg-red-400/10 border border-red-400/20 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Storage Critical</span>
          </div>
          <p className="text-red-300 text-sm mt-1">
            Disk usage is critically high. Consider archiving old data or expanding storage.
          </p>
        </div>
      )}

      {status === 'warning' && (
        <div className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Storage Warning</span>
          </div>
          <p className="text-yellow-300 text-sm mt-1">
            Disk usage is approaching capacity. Monitor usage closely.
          </p>
        </div>
      )}
    </div>
  );
}