'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, Share2, Heart, Eye, TrendingUp, TrendingDown, 
  Minus, Calendar, User, Users, Filter, Download, Bookmark,
  Award, Crown, Medal, Trophy, Star, BarChart3
} from 'lucide-react';
import { LeaderboardBuilderProvider, useLeaderboardBuilder, LeaderboardResult } from '@/lib/leaderboard-builder';
import { useAuth } from '@/lib/auth';
import DataExportButton, { prepareLeaderboardDataForExport } from '@/components/DataExportButton';

interface LeaderboardPageContentProps {
  id: string;
}

function LeaderboardPageContent({ id }: LeaderboardPageContentProps) {
  const [leaderboardResult, setLeaderboardResult] = useState<LeaderboardResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { authState } = useAuth();
  const { getLeaderboardResult, likeLeaderboard, availableMetrics } = useLeaderboardBuilder();

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setIsLoading(true);
        const result = await getLeaderboardResult(id);
        if (result) {
          setLeaderboardResult(result);
        } else {
          setError('リーダーボードが見つかりませんでした');
        }
      } catch (err) {
        setError('データの読み込みに失敗しました');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadLeaderboard();
    }
  }, [id]);

  const handleLike = async () => {
    if (!authState.isAuthenticated || !leaderboardResult) return;
    await likeLeaderboard(leaderboardResult.leaderboard.id);
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'same') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="text-lg font-bold text-slate-400">#{rank}</span>;
  };

  const getMetricName = (metricId: string) => {
    return availableMetrics.find(m => m.id === metricId)?.name || metricId;
  };

  const formatMetricValue = (value: number | string, metricId: string) => {
    if (typeof value === 'string') return value;
    
    const metric = availableMetrics.find(m => m.id === metricId);
    if (!metric) return value;

    switch (metric.dataType) {
      case 'rate':
        return value < 1 ? value.toFixed(3) : value.toFixed(2);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="bg-black/20 rounded-lg h-32"></div>
            <div className="bg-black/20 rounded-lg h-96"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !leaderboardResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-16">
            <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4 opacity-50" />
            <h1 className="text-2xl font-bold text-white mb-4">エラーが発生しました</h1>
            <p className="text-slate-400 mb-8">{error}</p>
            <Link
              href="/leaderboards"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              リーダーボード一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { leaderboard, entries, totalPlayers, lastUpdated } = leaderboardResult;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="mb-8">
          <Link 
            href="/leaderboards" 
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            リーダーボード一覧に戻る
          </Link>
        </div>

        {/* Header */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-2">
                    {leaderboard.name}
                  </h1>
                  <p className="text-slate-300 text-lg">{leaderboard.description}</p>
                </div>
              </div>

              {/* Tags */}
              {leaderboard.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {leaderboard.tags.map((tag) => (
                    <span key={tag} className="text-sm bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Metrics Info */}
              <div className="bg-black/20 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-2">評価指標</div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="font-medium text-white">主要: {getMetricName(leaderboard.primaryMetric)}</span>
                  </div>
                  {leaderboard.secondaryMetrics.length > 0 && (
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400">
                        副指標: {leaderboard.secondaryMetrics.map(getMetricName).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions & Stats */}
            <div className="lg:text-right space-y-4">
              {/* Action buttons */}
              <div className="flex lg:justify-end gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  <Share2 className="w-4 h-4" />
                  <span className="text-sm">共有</span>
                </button>
                <DataExportButton
                  data={{
                    ...prepareLeaderboardDataForExport(
                      entries,
                      availableMetrics,
                      leaderboard.primaryMetric,
                      leaderboard.secondaryMetrics
                    ),
                    filename: `leaderboard_${leaderboard.name.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')}_${new Date().toISOString().split('T')[0]}`
                  }}
                  title="エクスポート"
                  variant="secondary"
                  size="md"
                />
                <button 
                  onClick={handleLike}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  <span className="text-sm">{leaderboard.likes}</span>
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-black/20 rounded-lg p-3">
                  <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm">閲覧</span>
                  </div>
                  <div className="text-lg font-bold text-white">{leaderboard.views.toLocaleString()}</div>
                </div>
                <div className="bg-black/20 rounded-lg p-3">
                  <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">対象選手</span>
                  </div>
                  <div className="text-lg font-bold text-white">{totalPlayers}</div>
                </div>
              </div>

              {/* Filter info */}
              <div className="text-sm text-slate-400 space-y-1">
                <div className="flex items-center justify-end gap-2">
                  <Filter className="w-4 h-4" />
                  <span>リーグ: {leaderboard.filters.league.toUpperCase()}</span>
                </div>
                {leaderboard.filters.position !== 'all' && (
                  <div>ポジション: {leaderboard.filters.position}</div>
                )}
                {leaderboard.filters.team !== 'all' && (
                  <div>チーム: {leaderboard.filters.team}</div>
                )}
                <div>対象年度: {leaderboard.filters.year}</div>
                <div className="flex items-center justify-end gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>更新: {new Date(lastUpdated).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              ランキング (TOP {entries.length})
            </h2>
          </div>
          
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-black/10 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">順位</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">選手</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                    {getMetricName(leaderboard.primaryMetric)}
                  </th>
                  {leaderboard.secondaryMetrics.slice(0, 3).map((metric) => (
                    <th key={metric} className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      {getMetricName(metric)}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">トレンド</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {entries.map((entry) => (
                  <tr key={entry.playerId} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center w-8">
                        {getRankDisplay(entry.rank)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/players/${entry.playerId}`} className="hover:text-blue-400 transition-colors">
                        <div>
                          <div className="font-semibold text-white">{entry.playerName}</div>
                          <div className="text-sm text-slate-400">{entry.team} • {entry.position}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-lg font-bold text-blue-400">
                        {formatMetricValue(entry.metrics[leaderboard.primaryMetric], leaderboard.primaryMetric)}
                      </div>
                    </td>
                    {leaderboard.secondaryMetrics.slice(0, 3).map((metric) => (
                      <td key={metric} className="px-6 py-4 text-center">
                        <div className="text-white">
                          {entry.metrics[metric] !== undefined 
                            ? formatMetricValue(entry.metrics[metric] as number, metric)
                            : '-'
                          }
                        </div>
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center">
                      {getTrendIcon(entry.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-white/10">
            {entries.map((entry) => (
              <div key={entry.playerId} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8">
                      {getRankDisplay(entry.rank)}
                    </div>
                    <div>
                      <Link href={`/players/${entry.playerId}`} className="hover:text-blue-400 transition-colors">
                        <div className="font-semibold text-white">{entry.playerName}</div>
                      </Link>
                      <div className="text-sm text-slate-400">{entry.team} • {entry.position}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(entry.trend)}
                    <div className="text-lg font-bold text-blue-400">
                      {formatMetricValue(entry.metrics[leaderboard.primaryMetric], leaderboard.primaryMetric)}
                    </div>
                  </div>
                </div>
                
                {/* Secondary metrics */}
                {leaderboard.secondaryMetrics.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {leaderboard.secondaryMetrics.slice(0, 3).map((metric) => (
                      <div key={metric} className="text-center bg-black/20 rounded p-2">
                        <div className="text-xs text-slate-400 mb-1">{getMetricName(metric)}</div>
                        <div className="text-sm font-medium text-white">
                          {entry.metrics[metric] !== undefined 
                            ? formatMetricValue(entry.metrics[metric] as number, metric)
                            : '-'
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-slate-400">
          <p>最終更新: {new Date(lastUpdated).toLocaleString('ja-JP')}</p>
          <p className="mt-1">対象選手数: {totalPlayers}人 • 表示: {entries.length}人</p>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const params = useParams();
  const id = params?.id as string;

  if (!id) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-white mb-4">無効なリーダーボードID</h1>
          <Link
            href="/leaderboards"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            リーダーボード一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <LeaderboardBuilderProvider>
      <LeaderboardPageContent id={id} />
    </LeaderboardBuilderProvider>
  );
}