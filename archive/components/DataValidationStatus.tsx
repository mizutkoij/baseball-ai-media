import React from 'react';
import { CheckCircle, AlertTriangle, Clock, Database, TrendingUp, Shield, BarChart3 } from 'lucide-react';

interface ValidationSummary {
  date: string;
  totalGames: number;
  validGames: number;
  errorCount: number;
  warningCount: number;
  lastUpdated: string;
  processingTime: number;
}

interface ConstantsSummary {
  date: string;
  totalCoefficients: number;
  changedCoefficients: number;
  guardedCoefficients: number;
  maxDelta: number;
  lastUpdated: string;
}

// モックデータ（実際は API から取得）
const mockValidationData: ValidationSummary = {
  date: '2025-08-01',
  totalGames: 67,
  validGames: 66,
  errorCount: 2,
  warningCount: 5,
  lastUpdated: '2025-08-01T15:30:00Z',
  processingTime: 1.2
};

const mockConstantsData: ConstantsSummary = {
  date: '2025-08-01',
  totalCoefficients: 12,
  changedCoefficients: 3,
  guardedCoefficients: 1,
  maxDelta: 0.045,
  lastUpdated: '2025-08-01T06:30:00Z'
};

/**
 * データ検証・更新状況の可視化コンポーネント
 */
export default function DataValidationStatus() {
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (errorCount: number, warningCount: number) => {
    if (errorCount > 0) return 'text-red-400 bg-red-900/20 border-red-500/30';
    if (warningCount > 5) return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
    return 'text-green-400 bg-green-900/20 border-green-500/30';
  };

  const getDeltaColor = (delta: number) => {
    if (delta > 0.07) return 'text-red-400';
    if (delta > 0.03) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* データ検証状況 */}
      <div className={`backdrop-blur-md border rounded-lg p-6 ${getStatusColor(mockValidationData.errorCount, mockValidationData.warningCount)}`}>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6" />
          <h3 className="text-lg font-bold text-white">データ検証状況</h3>
          <div className="ml-auto text-xs opacity-75">
            最新: {formatTime(mockValidationData.lastUpdated)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {mockValidationData.validGames}/{mockValidationData.totalGames}
            </div>
            <div className="text-sm opacity-75">検証通過試合</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold">
              {((mockValidationData.validGames / mockValidationData.totalGames) * 100).toFixed(1)}%
            </div>
            <div className="text-sm opacity-75">通過率</div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              正常データ
            </span>
            <span>{mockValidationData.validGames} 試合</span>
          </div>
          
          {mockValidationData.errorCount > 0 && (
            <div className="flex justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                エラー検出
              </span>
              <span>{mockValidationData.errorCount} 件</span>
            </div>
          )}
          
          {mockValidationData.warningCount > 0 && (
            <div className="flex justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                警告
              </span>
              <span>{mockValidationData.warningCount} 件</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              処理時間
            </span>
            <span>{mockValidationData.processingTime}秒</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-current/20">
          <div className="text-xs opacity-75">
            破損データを事前検出・除外し、データ品質を保証
          </div>
        </div>
      </div>

      {/* 係数更新状況 */}
      <div className="bg-blue-900/20 backdrop-blur-md border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-bold text-white">係数更新状況</h3>
          <div className="ml-auto text-xs text-slate-400">
            最新: {formatTime(mockConstantsData.lastUpdated)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {mockConstantsData.changedCoefficients}/{mockConstantsData.totalCoefficients}
            </div>
            <div className="text-sm text-slate-400">更新係数</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${getDeltaColor(mockConstantsData.maxDelta)}`}>
              {(mockConstantsData.maxDelta * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-slate-400">最大変化率</div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-300">
            <span className="flex items-center gap-2">
              <Database className="w-4 h-4 text-green-400" />
              安定係数
            </span>
            <span>{mockConstantsData.totalCoefficients - mockConstantsData.changedCoefficients} 個</span>
          </div>
          
          <div className="flex justify-between text-slate-300">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              更新係数
            </span>
            <span>{mockConstantsData.changedCoefficients} 個</span>
          </div>
          
          {mockConstantsData.guardedCoefficients > 0 && (
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-yellow-400" />
                ガード適用
              </span>
              <span>{mockConstantsData.guardedCoefficients} 個</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-blue-500/20">
          <div className="text-xs text-slate-400">
            シュリンク推定でボラティリティを抑制し、安定した係数を提供
          </div>
        </div>
      </div>

      {/* 品質保証メトリクス */}
      <div className="lg:col-span-2 bg-purple-900/20 backdrop-blur-md border border-purple-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-6 h-6 text-purple-400" />
          <h3 className="text-lg font-bold text-white">品質保証プロセス</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-green-900/30 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-green-400" />
            </div>
            <h4 className="font-semibold text-white mb-2">データ検証</h4>
            <p className="text-sm text-slate-400">
              取り込み前に整合性チェック<br />
              破損データを自動除外
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-blue-900/30 rounded-full flex items-center justify-center">
              <Database className="w-8 h-8 text-blue-400" />
            </div>
            <h4 className="font-semibold text-white mb-2">安全なUPSERT</h4>
            <p className="text-sm text-slate-400">
              トランザクション保証<br />
              一時テーブルでロールバック対応
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-purple-900/30 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
            <h4 className="font-semibold text-white mb-2">係数安定化</h4>
            <p className="text-sm text-slate-400">
              ベイジアンシュリンク推定<br />
              小サンプル期の跳ね抑制
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-purple-500/20 text-center">
          <p className="text-sm text-slate-400">
            全処理ログを保存・監査可能。透明性と再現性を完全保証
          </p>
        </div>
      </div>
    </div>
  );
}