'use client';

import { useState } from 'react';
import { Download, FileText, Table, Database, Check } from 'lucide-react';

export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

interface DataExportButtonProps {
  data: ExportData;
  title?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
}

export default function DataExportButton({ 
  data, 
  title = "エクスポート",
  disabled = false,
  size = 'md',
  variant = 'secondary'
}: DataExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFormats, setShowFormats] = useState(false);

  const sizeClasses = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
    outline: 'border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white bg-transparent'
  };

  const exportToCsv = async () => {
    try {
      setIsExporting(true);
      
      // Create CSV content
      const csvContent = [
        data.headers.join(','),
        ...data.rows.map(row => 
          row.map(cell => 
            typeof cell === 'string' && cell.includes(',') 
              ? `"${cell.replace(/"/g, '""')}"` 
              : cell
          ).join(',')
        )
      ].join('\n');

      // Create blob with BOM for Excel compatibility
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${data.filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show success state
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setShowFormats(false);
    }
  };

  const exportToTsv = async () => {
    try {
      setIsExporting(true);
      
      // Create TSV content (Tab-separated values)
      const tsvContent = [
        data.headers.join('\t'),
        ...data.rows.map(row => row.join('\t'))
      ].join('\n');

      const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${data.filename}.tsv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setShowFormats(false);
    }
  };

  const exportToJson = async () => {
    try {
      setIsExporting(true);
      
      // Convert to JSON format
      const jsonData = data.rows.map(row => {
        const obj: Record<string, string | number> = {};
        data.headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });

      const jsonContent = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${data.filename}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setShowFormats(false);
    }
  };

  const exportFormats = [
    {
      name: 'CSV (Excel)',
      description: 'Excel・Googleスプレッドシート対応',
      icon: Table,
      onClick: exportToCsv
    },
    {
      name: 'TSV',
      description: 'タブ区切り形式',
      icon: FileText,
      onClick: exportToTsv
    },
    {
      name: 'JSON',
      description: 'プログラム処理用データ',
      icon: Database,
      onClick: exportToJson
    }
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setShowFormats(!showFormats)}
        disabled={disabled || isExporting}
        className={`
          ${sizeClasses[size]} 
          ${variantClasses[variant]}
          rounded-lg font-medium transition-all duration-200 
          flex items-center gap-2
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900
        `}
      >
        {showSuccess ? (
          <>
            <Check className="w-4 h-4" />
            {size !== 'sm' && 'ダウンロード完了'}
          </>
        ) : isExporting ? (
          <>
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-transparent border-t-current" />
            {size !== 'sm' && 'エクスポート中...'}
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            {size !== 'sm' && title}
          </>
        )}
      </button>

      {/* Format Selection Dropdown */}
      {showFormats && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white">エクスポート形式を選択</h3>
            <p className="text-xs text-slate-400 mt-1">
              {data.rows.length.toLocaleString()}件のデータをエクスポート
            </p>
          </div>
          
          <div className="py-2">
            {exportFormats.map((format) => {
              const IconComponent = format.icon;
              return (
                <button
                  key={format.name}
                  onClick={format.onClick}
                  disabled={isExporting}
                  className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-start gap-3 disabled:opacity-50"
                >
                  <IconComponent className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-white">{format.name}</div>
                    <div className="text-xs text-slate-400">{format.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-700 bg-slate-800/50">
            <div className="text-xs text-slate-400 space-y-1">
              <p>• CSV: Excelで開くのに最適</p>
              <p>• TSV: データベース取り込み向け</p>
              <p>• JSON: API・プログラム処理用</p>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showFormats && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowFormats(false)}
        />
      )}
    </div>
  );
}

// Utility function to prepare leaderboard data for export
export const prepareLeaderboardDataForExport = (
  entries: any[], 
  metrics: any[],
  primaryMetric: string,
  secondaryMetrics: string[]
) => {
  const headers = [
    '順位',
    '選手名', 
    'チーム',
    'ポジション',
    ...([primaryMetric, ...secondaryMetrics].map(metricId => 
      metrics.find(m => m.id === metricId)?.name || metricId
    ))
  ];

  const rows = entries.map(entry => [
    entry.rank,
    entry.playerName,
    entry.team,
    entry.position,
    ...[primaryMetric, ...secondaryMetrics].map(metricId => 
      entry.metrics[metricId] || '-'
    )
  ]);

  return { headers, rows };
};