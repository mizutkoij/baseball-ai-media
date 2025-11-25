import { useState } from 'react';
import { Download } from 'lucide-react';

interface PlayerExportButtonProps {
  playerId: number;
  playerName: string;
  year?: number;
  format?: 'csv' | 'json';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PlayerExportButton({ 
  playerId, 
  playerName, 
  year, 
  format = 'csv',
  size = 'md',
  className = '' 
}: PlayerExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        playerId: playerId.toString(),
        format
      });
      
      if (year) {
        params.append('year', year.toString());
      }

      const response = await fetch(`/api/export/player?${params}`);
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Get filename from Content-Disposition header or create one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `player-${playerId}-${playerName.replace(/[^a-zA-Z0-9]/g, '_')}-stats.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('エクスポートに失敗しました。再試行してください。');
    } finally {
      setIsExporting(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${className}`}
      title={`${playerName}の成績データを${format.toUpperCase()}形式でエクスポート`}
    >
      <Download className={iconSizes[size]} />
      {isExporting ? 'エクスポート中...' : `CSV出力`}
    </button>
  );
}