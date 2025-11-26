import React from 'react';
import Link from 'next/link';
import { Calendar, TrendingUp, ArrowRight, Star, Users } from 'lucide-react';

interface BriefData {
  date: string;
  gotd: {
    away_team: string;
    home_team: string;
    away_score?: number;
    home_score?: number;
    status: string;
  } | null;
  leaders: {
    player_name: string;
    team: string;
    metric_name: string; 
    metric_value: number;
  }[];
  summary: {
    total_games: number;
    completed_games: number;
  };
}

// ビルド時チェック用ユーティリティ
function isBuildTime(): boolean {
  return process.env.NODE_ENV === 'production' && 
         (process.env.NEXT_PHASE === 'phase-production-build' || 
          (typeof window === 'undefined' && !process.env.VERCEL && !process.env.RUNTIME));
}

// 最新のブリーフデータを取得
async function getLatestBrief(): Promise<{ briefData: BriefData; dateStr: string; } | null> {
  // ビルド時はスキップ
  if (isBuildTime()) {
    console.log('Skipping LatestBrief data loading during build time');
    return null;
  }

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // 過去7日間のブリーフを探す
    for (let i = 1; i <= 7; i++) {
      const date = new Date(Date.now() - i * 86400000);
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const briefPath = path.join(process.cwd(), 'public/column/brief', dateStr, 'index.json');
      
      try {
        const data = await fs.readFile(briefPath, 'utf8');
        const briefData = JSON.parse(data) as BriefData;
        return { briefData, dateStr };
      } catch (error) {
        // ファイルが存在しない場合は次の日を試す
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to load latest brief:', error);
    return null;
  }
}

// 日付フォーマット
function formatDate(dateStr: string): string {
  if (dateStr.length === 8) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${parseInt(month)}/${parseInt(day)}`;
  }
  return dateStr;
}

// 相対日付表示
function getRelativeDate(dateStr: string): string {
  const targetDate = new Date(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(4, 6)) - 1,
    parseInt(dateStr.slice(6, 8))
  );
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  
  if (targetDate.toDateString() === yesterday.toDateString()) {
    return '昨日';
  } else if (targetDate.toDateString() === today.toDateString()) {
    return '今日';
  } else {
    const diffTime = today.getTime() - targetDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays}日前`;
  }
}

// ローディングコンポーネント
function LatestBriefLoading() {
  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-6 bg-yellow-400/20 rounded"></div>
        <div className="h-6 bg-white/10 rounded w-32"></div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-white/10 rounded w-full"></div>
        <div className="h-4 bg-white/10 rounded w-3/4"></div>
        <div className="h-8 bg-white/10 rounded w-24 mt-4"></div>
      </div>
    </div>
  );
}

// エラー表示コンポーネント
function LatestBriefError() {
  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-6 h-6 text-yellow-400" />
        <h2 className="text-lg font-bold text-white">最新のブリーフ</h2>
      </div>
      <div className="text-center py-4">
        <p className="text-slate-400 mb-4">ブリーフデータの読み込みに失敗しました</p>
        <Link
          href="/column"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <Calendar className="w-4 h-4" />
          ブリーフ一覧を見る
        </Link>
      </div>
    </div>
  );
}

// メインコンポーネント
export default async function LatestBrief() {
  const result = await getLatestBrief();
  
  if (!result) {
    return <LatestBriefError />;
  }

  const { briefData, dateStr } = result;
  const relativeDate = getRelativeDate(dateStr);

  return (
    <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 backdrop-blur-md border border-yellow-500/30 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-yellow-400" />
          <h2 className="text-lg font-bold text-white">最新のブリーフ</h2>
        </div>
        <div className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded">
          {relativeDate}
        </div>
      </div>

      {/* Game of the Day要約 */}
      {briefData.gotd && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-300">注目試合</span>
          </div>
          <div className="text-white">
            <span className="font-medium">{briefData.gotd.away_team}</span>
            <span className="mx-2 text-slate-400">vs</span>
            <span className="font-medium">{briefData.gotd.home_team}</span>
            {briefData.gotd.away_score !== undefined && briefData.gotd.home_score !== undefined && (
              <span className="ml-3 text-blue-400 font-bold">
                {briefData.gotd.away_score}-{briefData.gotd.home_score}
              </span>
            )}
          </div>
        </div>
      )}

      {/* リーダー要約 */}
      {briefData.leaders.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-300">注目選手</span>
          </div>
          <div className="text-white text-sm">
            {briefData.leaders.slice(0, 2).map((leader, index) => (
              <div key={index} className="flex justify-between items-center">
                <span>{leader.player_name} ({leader.team})</span>
                <span className="text-green-400 font-medium">
                  {leader.metric_name} {leader.metric_value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 試合サマリ */}
      <div className="flex items-center gap-4 text-sm text-slate-300 mb-4">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span>試合: {briefData.summary.completed_games}/{briefData.summary.total_games}</span>
        </div>
      </div>

      {/* アクション */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/column/brief/${dateStr}`}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
        >
          <Calendar className="w-4 h-4" />
          詳細を見る
        </Link>
        <Link
          href="/today"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          今日の試合
        </Link>
      </div>

      {/* 日付表示 */}
      <div className="mt-4 pt-3 border-t border-yellow-500/20 text-center">
        <p className="text-xs text-slate-400">
          {formatDate(dateStr)} のブリーフ • NPB独自分析
        </p>
      </div>
    </div>
  );
}

// 静的コンポーネント版（エラー時のフォールバック）
export function LatestBriefStatic() {
  return (
    <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 backdrop-blur-md border border-yellow-500/30 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-6 h-6 text-yellow-400" />
        <h2 className="text-lg font-bold text-white">デイリーブリーフ</h2>
      </div>
      
      <div className="text-center py-4">
        <p className="text-slate-300 mb-4">
          毎日の試合結果と注目選手を自動分析してお届け
        </p>
        <div className="space-y-2">
          <div className="text-sm text-slate-400">
            • 今日の注目試合選出
          </div>
          <div className="text-sm text-slate-400">
            • パフォーマンスリーダー
          </div>
          <div className="text-sm text-slate-400">
            • 係数変動アラート
          </div>
        </div>
        
        <Link
          href="/column"
          className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors mt-4"
        >
          <Calendar className="w-4 h-4" />
          ブリーフ一覧
        </Link>
      </div>
    </div>
  );
}