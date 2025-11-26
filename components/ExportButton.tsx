"use client";

import { useState } from 'react';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  scope: 'player' | 'team' | 'game';
  id: string;
  season?: string | number;
  pfCorrection?: boolean;
  label?: string;
  className?: string;
  
  // Legacy support
  playerId?: string;
  variant?: 'player' | 'season';
}

export function ExportButton({ 
  scope,
  id,
  season, 
  pfCorrection = false,
  label,
  className = "",
  
  // Legacy support
  playerId,
  variant = 'player'
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    
    try {
      // Legacy support
      const actualScope = scope || 'player';
      const actualId = id || playerId;
      
      if (!actualId) {
        throw new Error('ID is required for export');
      }
      
      const params = new URLSearchParams({
        scope: actualScope,
        id: actualId
      });
      
      if (season) params.set('season', season.toString());
      if (pfCorrection) params.set('pf', 'true');
      
      const response = await fetch(`/api/export/csv?${params.toString()}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export failed: ${errorText}`);
      }

      // Track analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'csv_download', {
          scope: actualScope,
          id: actualId,
          season: season || 'all',
          pf_correction: pfCorrection
        });
      }

      // Download CSV file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      const fileNameMatch = contentDisposition?.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || `${actualScope}_${actualId}_${Date.now()}.csv`;
      
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('エクスポートに失敗しました。しばらく後でお試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (label) return label;
    if (isLoading) return 'エクスポート中...';
    
    const actualScope = scope || 'player';
    switch (actualScope) {
      case 'player': return '選手データをCSV出力';
      case 'team': return 'チームデータをCSV出力';
      case 'game': return '試合データをCSV出力';
      default: return 'CSVエクスポート';
    }
  };

  const getScopeDescription = () => {
    const actualScope = scope || 'player';
    switch (actualScope) {
      case 'player': 
        return season ? `${season}年シーズンの個人成績` : '全シーズンの個人成績';
      case 'team': 
        return `${season}年の試合結果・月別統計`;
      case 'game': 
        return '打撃・投手の詳細記録';
      default: 
        return 'データ';
    }
  };

  return (
    <div className="export-button-container">
      <button
        onClick={handleExport}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
        title={`${getScopeDescription()}をCSV形式でダウンロード`}
      >
        <Download className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        {getButtonText()}
      </button>
      
      {pfCorrection && (
        <p className="text-xs text-slate-500 mt-1">
          ※ Park Factor補正込みの数値で出力
        </p>
      )}
      
      <p className="text-xs text-slate-500 mt-1">
        Excel/Numbers対応（UTF-8 BOM付き）
      </p>
    </div>
  );
}