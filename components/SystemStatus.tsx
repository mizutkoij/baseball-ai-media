'use client';

import React, { useState, useEffect } from 'react';
import { Server, Loader } from 'lucide-react';
import BackfillHealth from './BackfillHealth';
import DiskGauge from './DiskGauge';

interface BackfillStatusData {
  lastRunTime?: string;
  insertedRows: number;
  deltaPct: number;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  diskUsage: {
    usedGB: number;
    totalGB: number;
    availableGB: number;
  };
}

export default function SystemStatus() {
  const [data, setData] = useState<BackfillStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/backfill-status');
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        const statusData = await response.json();
        setData(statusData);
        setError(null);
      } catch (err) {
        console.error('Error fetching backfill status:', err);
        setError('Failed to load system status');
        // Provide fallback data
        setData({
          lastRunTime: undefined,
          insertedRows: 0,
          deltaPct: 0,
          status: 'unknown',
          diskUsage: {
            usedGB: 0,
            totalGB: 10,
            availableGB: 10
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <Server className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">System Status</h2>
        </div>
        
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 text-slate-400 animate-spin" />
          <span className="ml-2 text-slate-400">Loading system status...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <Server className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">System Status</h2>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
          <p className="text-yellow-300 text-sm">{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BackfillHealth
          lastRunTime={data?.lastRunTime}
          insertedRows={data?.insertedRows || 0}
          deltaPct={data?.deltaPct || 0}
          status={data?.status || 'unknown'}
        />
        
        <DiskGauge
          usedGB={data?.diskUsage.usedGB || 0}
          totalGB={data?.diskUsage.totalGB || 10}
          availableGB={data?.diskUsage.availableGB || 10}
        />
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-slate-400 text-sm">
          データパイプラインは自動的に監視されています • 
          最終更新: {new Date().toLocaleString('ja-JP')}
        </p>
      </div>
    </section>
  );
}