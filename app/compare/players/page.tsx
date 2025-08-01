'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { 
  ArrowLeft, 
  TrendingUp, 
  BarChart3, 
  Download, 
  ToggleLeft, 
  ToggleRight,
  Users,
  Calendar,
  Award,
  Info
} from 'lucide-react';

interface PlayerComparisonData {
  player_id: string;
  name: string;
  primary_pos: 'P' | 'B';
  years: Array<{
    year: number;
    team: string;
    wRC_plus?: number;
    wRC_plus_neutral?: number;
    ERA_minus?: number;
    ERA_minus_neutral?: number;
    K_pct?: number;
    BB_pct?: number;
    ISO?: number;
    BABIP?: number;
    avg_pf?: number;
  }>;
  career_summary: {
    batting?: {
      career_wRC_plus: number;
      career_wRC_plus_neutral?: number;
      best_year: { year: number; wRC_plus: number };
    };
    pitching?: {
      career_ERA_minus: number;
      career_ERA_minus_neutral?: number;
      best_year: { year: number; ERA_minus: number };
    };
  };
}

interface ComparePlayersResponse {
  players: PlayerComparisonData[];
  comparison_summary: {
    batting?: {
      leaders: {
        wRC_plus: { player_id: string; name: string; value: number; year: number };
        ISO: { player_id: string; name: string; value: number; year: number };
        K_pct_low: { player_id: string; name: string; value: number; year: number };
      };
      trends: Array<{
        player_id: string;
        name: string;
        trend: 'improving' | 'declining' | 'stable';
        description: string;
      }>;
    };
    pitching?: {
      leaders: {
        ERA_minus: { player_id: string; name: string; value: number; year: number };
        FIP_minus: { player_id: string; name: string; value: number; year: number };
      };
      trends: Array<{
        player_id: string;
        name: string;
        trend: 'improving' | 'declining' | 'stable';
        description: string;
      }>;
    };
    auto_summary: string;
  };
  pf_correction: boolean;
  year_range: { from: number; to: number };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function AutoSummary({ summary }: { summary: string }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-blue-900 mb-2">比較サマリー</h3>
          <p className="text-blue-800 text-sm leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ 
  player, 
  pfCorrection, 
  isHighlighted = false 
}: { 
  player: PlayerComparisonData; 
  pfCorrection: boolean;
  isHighlighted?: boolean;
}) {
  const isBatter = player.primary_pos === 'B';
  const summary = isBatter ? player.career_summary.batting : player.career_summary.pitching;

  const getMainMetric = () => {
    if (isBatter) {
      const value = pfCorrection && summary?.career_wRC_plus_neutral 
        ? summary.career_wRC_plus_neutral 
        : summary?.career_wRC_plus || 0;
      return { label: 'wRC+', value: Math.round(value) };
    } else {
      const value = pfCorrection && summary?.career_ERA_minus_neutral 
        ? summary.career_ERA_minus_neutral 
        : summary?.career_ERA_minus || 0;
      return { label: 'ERA-', value: Math.round(value) };
    }
  };

  const mainMetric = getMainMetric();

  return (
    <div className={`
      bg-white border-2 rounded-lg p-4 transition-all duration-200
      ${isHighlighted ? 'border-yellow-400 bg-yellow-50 shadow-lg' : 'border-slate-200 hover:border-slate-300'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg text-slate-900">{player.name}</h3>
          <span className="text-sm text-slate-600">
            {isBatter ? '野手' : '投手'} • {player.years.length}年間
          </span>
        </div>
        {isHighlighted && (
          <Award className="w-6 h-6 text-yellow-500" />
        )}
      </div>

      {/* Main metric */}
      <div className="bg-slate-50 rounded-lg p-3 mb-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{mainMetric.value}</div>
          <div className="text-sm text-slate-600">{mainMetric.label} 平均</div>
          {pfCorrection && (
            <div className="text-xs text-blue-600 mt-1">Park Factor補正済み</div>
          )}
        </div>
      </div>

      {/* Best year */}
      <div className="text-center">
        <div className="text-sm text-slate-600">最高年</div>
        <div className="font-semibold">
          {summary?.best_year.year}年 ({isBatter ? summary?.best_year.wRC_plus : summary?.best_year.ERA_minus})
        </div>
      </div>
    </div>
  );
}

function YearlyTrendChart({ 
  players, 
  pfCorrection, 
  metric = 'wRC_plus' 
}: { 
  players: PlayerComparisonData[];
  pfCorrection: boolean;
  metric?: string;
}) {
  const getMetricValue = (player: PlayerComparisonData, year: any) => {
    if (metric === 'wRC_plus') {
      return pfCorrection && year.wRC_plus_neutral ? year.wRC_plus_neutral : year.wRC_plus;
    } else if (metric === 'ERA_minus') {
      return pfCorrection && year.ERA_minus_neutral ? year.ERA_minus_neutral : year.ERA_minus;
    }
    return year[metric as keyof typeof year] as number;
  };

  // Get all years across all players
  const allYears = Array.from(new Set(
    players.flatMap(p => p.years.map(y => y.year))
  )).sort();

  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        年次推移 ({metric.replace('_', ' ')})
      </h3>
      
      {/* Simple line chart representation */}
      <div className="space-y-4">
        {players.map((player, playerIndex) => {
          const playerColor = colors[playerIndex % colors.length];
          
          return (
            <div key={player.player_id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: playerColor }}
                ></div>
                <span className="font-medium text-sm">{player.name}</span>
              </div>
              
              <div className="grid grid-cols-6 gap-2 text-xs">
                {allYears.map(year => {
                  const yearData = player.years.find(y => y.year === year);
                  const value = yearData ? getMetricValue(player, yearData) : null;
                  
                  return (
                    <div key={year} className="text-center">
                      <div className="text-slate-600">{year}</div>
                      <div className="font-medium">
                        {value ? Math.round(value) : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparePlayersContent() {
  const searchParams = useSearchParams();
  const [pfCorrection, setPfCorrection] = useState(false);
  const [yearFrom, setYearFrom] = useState(2022);
  const [yearTo, setYearTo] = useState(2024);

  // Get player IDs from URL
  const playerIds = searchParams.get('players')?.split(',') || [];
  
  // Build API URL
  const apiUrl = `/api/compare/players?players=${playerIds.join(',')}&pf=${pfCorrection}&from=${yearFrom}&to=${yearTo}`;
  
  const { data, error, isLoading } = useSWR<ComparePlayersResponse>(
    playerIds.length > 0 ? apiUrl : null, 
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  );

  // Track analytics
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag && playerIds.length > 0) {
      (window as any).gtag('event', 'compare_players_view', {
        player_count: playerIds.length,
        players: playerIds.join(','),
        pf_correction: pfCorrection,
        year_range: `${yearFrom}-${yearTo}`
      });
    }
  }, [playerIds, pfCorrection, yearFrom, yearTo]);

  const handlePfToggle = () => {
    const newValue = !pfCorrection;
    setPfCorrection(newValue);
    
    // Track PF toggle
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'compare_toggle_pf', {
        enabled: newValue,
        players: playerIds.join(',')
      });
    }
  };

  const handleDownload = () => {
    // Track download
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'compare_dl_csv', {
        players: playerIds.join(','),
        pf_correction: pfCorrection,
        format: 'csv'
      });
    }

    // Trigger CSV download (implementation would use existing ExportButton logic)
    const downloadUrl = `/api/export/csv?scope=player_comparison&players=${playerIds.join(',')}&pf=${pfCorrection}&from=${yearFrom}&to=${yearTo}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `player_comparison_${playerIds.join('_')}_${yearFrom}-${yearTo}.csv`;
    link.click();
  };

  if (playerIds.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">選手を選択してください</h2>
        <p className="text-slate-600 mb-6">URLに選手IDを指定して比較を開始できます</p>
        <Link 
          href="/players" 
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          選手一覧から選ぶ
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-slate-200 rounded-lg h-48"></div>
            ))}
          </div>
          <div className="h-64 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="text-red-500 mb-4">データの読み込みに失敗しました</div>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          再試行
        </button>
      </div>
    );
  }

  const batters = data.players.filter(p => p.primary_pos === 'B');
  const pitchers = data.players.filter(p => p.primary_pos === 'P');

  // Determine highlights (top performers)
  const battingLeader = data.comparison_summary.batting?.leaders.wRC_plus;
  const pitchingLeader = data.comparison_summary.pitching?.leaders.ERA_minus;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/players"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            選手一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">選手比較</h1>
          <p className="text-slate-600 mt-1">
            {yearFrom}年〜{yearTo}年 • {data.players.length}名比較
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Year range controls */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select 
              value={yearFrom} 
              onChange={(e) => setYearFrom(parseInt(e.target.value))}
              className="border border-slate-300 rounded px-2 py-1"
            >
              {[2019, 2020, 2021, 2022, 2023].map(year => (
                <option key={year} value={year}>{year}年〜</option>
              ))}
            </select>
            <select 
              value={yearTo} 
              onChange={(e) => setYearTo(parseInt(e.target.value))}
              className="border border-slate-300 rounded px-2 py-1"
            >
              {[2022, 2023, 2024, 2025].map(year => (
                <option key={year} value={year}>〜{year}年</option>
              ))}
            </select>
          </div>

          {/* PF Toggle */}
          <button
            onClick={handlePfToggle}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {pfCorrection ? 
              <ToggleRight className="w-5 h-5 text-blue-600" /> : 
              <ToggleLeft className="w-5 h-5 text-slate-400" />
            }
            <span className="text-sm">PF補正</span>
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV出力
          </button>
        </div>
      </div>

      {/* Auto Summary */}
      {data.comparison_summary.auto_summary && (
        <AutoSummary summary={data.comparison_summary.auto_summary} />
      )}

      {/* Player Cards */}
      {batters.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            打撃成績比較
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {batters.map((player) => (
              <PlayerCard 
                key={player.player_id} 
                player={player} 
                pfCorrection={pfCorrection}
                isHighlighted={battingLeader?.player_id === player.player_id}
              />
            ))}
          </div>
          <YearlyTrendChart 
            players={batters} 
            pfCorrection={pfCorrection} 
            metric="wRC_plus" 
          />
        </div>
      )}

      {/* Pitchers */}
      {pitchers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-600" />
            投球成績比較
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {pitchers.map((player) => (
              <PlayerCard 
                key={player.player_id} 
                player={player} 
                pfCorrection={pfCorrection}
                isHighlighted={pitchingLeader?.player_id === player.player_id}
              />
            ))}
          </div>
          <YearlyTrendChart 
            players={pitchers} 
            pfCorrection={pfCorrection} 
            metric="ERA_minus" 
          />
        </div>
      )}

      {/* Trends */}
      {(data.comparison_summary.batting?.trends || data.comparison_summary.pitching?.trends) && (
        <div className="bg-slate-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">トレンド分析</h3>
          <div className="space-y-2">
            {data.comparison_summary.batting?.trends.map((trend, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className={`
                  px-2 py-1 rounded-full text-xs font-medium
                  ${trend.trend === 'improving' ? 'bg-green-100 text-green-800' :
                    trend.trend === 'declining' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'}
                `}>
                  {trend.trend === 'improving' ? '↗️ 上昇' : 
                   trend.trend === 'declining' ? '↘️ 下降' : '→ 安定'}
                </span>
                <span className="font-medium">{trend.name}</span>
                <span className="text-sm text-slate-600">{trend.description}</span>
              </div>
            ))}
            {data.comparison_summary.pitching?.trends.map((trend, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className={`
                  px-2 py-1 rounded-full text-xs font-medium
                  ${trend.trend === 'improving' ? 'bg-green-100 text-green-800' :
                    trend.trend === 'declining' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'}
                `}>
                  {trend.trend === 'improving' ? '↗️ 向上' : 
                   trend.trend === 'declining' ? '↘️ 悪化' : '→ 安定'}
                </span>
                <span className="font-medium">{trend.name}</span>
                <span className="text-sm text-slate-600">{trend.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePlayersPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8">Loading...</div>}>
      <ComparePlayersContent />
    </Suspense>
  );
}