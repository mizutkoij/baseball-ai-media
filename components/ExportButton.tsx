"use client";

import { useState } from 'react';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  playerId: string;
  season?: number;
  className?: string;
  variant?: 'player' | 'season';
}

export function ExportButton({ 
  playerId, 
  season, 
  className = "",
  variant = 'player'
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({ playerId });
      if (season) params.set('year', season.toString());
      
      const url = `/api/export/player?${params.toString()}`;
      
      // Track analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'csv_download', {
          scope: variant,
          playerId,
          season: season || 'all',
          rows: 'unknown'
        });
      }

      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.click();
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('エクスポートに失敗しました。しばらく後でお試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Download className="h-4 w-4" />
      {isLoading ? 'エクスポート中...' : 'CSVエクスポート'}
    </button>
  );
}