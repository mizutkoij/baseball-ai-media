'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import Head from 'next/head';
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
  Info,
  Trophy,
  Target
} from 'lucide-react';
import ShareButton from '@/components/ShareButton';

interface TeamComparisonData {
  team_code: string;
  team_name: string;
  league: 'central' | 'pacific';
  year: number;
  wins: number;
  losses: number;
  pct: number;
  rank: number;
  games_back: number;
  team_batting: {
    games: number;
    PA: number;
    AB: number;
    R: number;
    H: number;
    HR: number;
    RBI: number;
    BB: number;
    SO: number;
    AVG: number;
    OBP: number;
    SLG: number;
    OPS: number;
    wRC_plus: number;
    wRC_plus_neutral?: number;
    OPS_plus: number;
    OPS_plus_neutral?: number;
    ISO: number;
    BABIP: number;
    K_pct: number;
    BB_pct: number;
  };
  team_pitching: {
    games: number;
    IP: number;
    H_allowed: number;
    R_allowed: number;
    ER: number;
    BB_allowed: number;
    SO_pitched: number;
    HR_allowed: number;
    ERA: number;
    ERA_neutral?: number;
    WHIP: number;
    FIP: number;
    FIP_neutral?: number;
    ERA_minus: number;
    ERA_minus_neutral?: number;
    FIP_minus: number;
    FIP_minus_neutral?: number;
    K_9: number;
    BB_9: number;
    K_pct: number;
    BB_pct: number;
  };
  home_away_split: {
    home: {
      wins: number;
      losses: number;
      pct: number;
      runs_scored: number;
      runs_allowed: number;
    };
    away: {
      wins: number;
      losses: number;
      pct: number;
      runs_scored: number;
      runs_allowed: number;
    };
  };
  avg_park_factor: number;
}

interface CompareTeamsResponse {
  teams: TeamComparisonData[];
  comparison_summary: {
    batting_leaders: {
      wRC_plus: { team: string; value: number; rank_change?: number };
      OPS_plus: { team: string; value: number; rank_change?: number };
      ISO: { team: string; value: number; rank_change?: number };
      K_pct_low: { team: string; value: number; rank_change?: number };
    };
    pitching_leaders: {
      ERA_minus: { team: string; value: number; rank_change?: number };
      FIP_minus: { team: string; value: number; rank_change?: number };
      K_pct: { team: string; value: number; rank_change?: number };
      WHIP: { team: string; value: number; rank_change?: number };
    };
    pf_correction_effects: Array<{
      team: string;
      metric: string;
      original_rank: number;
      corrected_rank: number;
      rank_change: number;
      comment: string;
    }>;
    auto_summary: string;
  };
  pf_correction: boolean;
  year: number;
  league_context: {
    central_avg_wRC_plus: number;
    pacific_avg_wRC_plus: number;
    central_avg_ERA_minus: number;
    pacific_avg_ERA_minus: number;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function AutoSummary({ summary }: { summary: string }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-blue-900 mb-2">チーム比較サマリー</h3>
          <p className="text-blue-800 text-sm leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  );
}

function TeamCard({ 
  team, 
  pfCorrection, 
  isHighlighted = false,
  highlightType = 'batting'
}: { 
  team: TeamComparisonData; 
  pfCorrection: boolean;
  isHighlighted?: boolean;
  highlightType?: 'batting' | 'pitching';
}) {
  const getBattingMetric = () => {
    const value = pfCorrection && team.team_batting.wRC_plus_neutral 
      ? team.team_batting.wRC_plus_neutral 
      : team.team_batting.wRC_plus;
    return { label: 'wRC+', value: Math.round(value) };
  };

  const getPitchingMetric = () => {
    const value = pfCorrection && team.team_pitching.ERA_minus_neutral 
      ? team.team_pitching.ERA_minus_neutral 
      : team.team_pitching.ERA_minus;
    return { label: 'ERA-', value: Math.round(value) };
  };

  const battingMetric = getBattingMetric();
  const pitchingMetric = getPitchingMetric();

  return (
    <div className={`
      bg-white border-2 rounded-lg p-4 transition-all duration-200
      ${isHighlighted ? 'border-yellow-400 bg-yellow-50 shadow-lg' : 'border-slate-200 hover:border-slate-300'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg text-slate-900">{team.team_name}</h3>
          <span className="text-sm text-slate-600">
            {team.league === 'central' ? 'セ・リーグ' : 'パ・リーグ'} • {team.rank}位
          </span>
        </div>
        {isHighlighted && (
          <Award className="w-6 h-6 text-yellow-500" />
        )}
      </div>

      {/* Standing */}
      <div className="bg-slate-50 rounded-lg p-3 mb-3">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-lg font-bold text-slate-900">
              {team.wins}勝{team.losses}敗
            </div>
            <div className="text-sm text-slate-600">
              {(team.pct * 100).toFixed(1)}% • {team.games_back}GB
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">#{team.rank}</div>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center bg-blue-50 rounded p-2">
          <div className="text-lg font-bold text-blue-900">{battingMetric.value}</div>
          <div className="text-xs text-blue-600">{battingMetric.label}</div>
        </div>
        <div className="text-center bg-green-50 rounded p-2">
          <div className="text-lg font-bold text-green-900">{pitchingMetric.value}</div>
          <div className="text-xs text-green-600">{pitchingMetric.label}</div>
        </div>
      </div>

      {pfCorrection && (
        <div className="text-xs text-blue-600 mt-2 text-center">Park Factor補正済み</div>
      )}
    </div>
  );
}

function ComparisonTable({ 
  teams, 
  pfCorrection 
}: { 
  teams: TeamComparisonData[];
  pfCorrection: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'batting' | 'pitching' | 'splits'>('batting');

  const renderBattingTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-2 font-semibold">チーム</th>
            <th className="text-center py-3 px-2 font-semibold">AVG</th>
            <th className="text-center py-3 px-2 font-semibold">OPS</th>
            <th className="text-center py-3 px-2 font-semibold">wRC+</th>
            <th className="text-center py-3 px-2 font-semibold">HR</th>
            <th className="text-center py-3 px-2 font-semibold">ISO</th>
            <th className="text-center py-3 px-2 font-semibold">K%</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => (
            <tr key={team.team_code} className={index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
              <td className="py-3 px-2 font-medium">{team.team_name}</td>
              <td className="text-center py-3 px-2">{team.team_batting.AVG.toFixed(3)}</td>
              <td className="text-center py-3 px-2">{team.team_batting.OPS.toFixed(3)}</td>
              <td className="text-center py-3 px-2 font-bold">
                {Math.round(pfCorrection && team.team_batting.wRC_plus_neutral 
                  ? team.team_batting.wRC_plus_neutral 
                  : team.team_batting.wRC_plus)}
              </td>
              <td className="text-center py-3 px-2">{team.team_batting.HR}</td>
              <td className="text-center py-3 px-2">{team.team_batting.ISO.toFixed(3)}</td>
              <td className="text-center py-3 px-2">{team.team_batting.K_pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPitchingTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-2 font-semibold">チーム</th>
            <th className="text-center py-3 px-2 font-semibold">ERA</th>
            <th className="text-center py-3 px-2 font-semibold">ERA-</th>
            <th className="text-center py-3 px-2 font-semibold">FIP</th>
            <th className="text-center py-3 px-2 font-semibold">WHIP</th>
            <th className="text-center py-3 px-2 font-semibold">K/9</th>
            <th className="text-center py-3 px-2 font-semibold">K%</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => (
            <tr key={team.team_code} className={index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
              <td className="py-3 px-2 font-medium">{team.team_name}</td>
              <td className="text-center py-3 px-2">
                {(pfCorrection && team.team_pitching.ERA_neutral 
                  ? team.team_pitching.ERA_neutral 
                  : team.team_pitching.ERA).toFixed(2)}
              </td>
              <td className="text-center py-3 px-2 font-bold">
                {Math.round(pfCorrection && team.team_pitching.ERA_minus_neutral 
                  ? team.team_pitching.ERA_minus_neutral 
                  : team.team_pitching.ERA_minus)}
              </td>
              <td className="text-center py-3 px-2">
                {(pfCorrection && team.team_pitching.FIP_neutral 
                  ? team.team_pitching.FIP_neutral 
                  : team.team_pitching.FIP).toFixed(2)}
              </td>
              <td className="text-center py-3 px-2">{team.team_pitching.WHIP.toFixed(2)}</td>
              <td className="text-center py-3 px-2">{team.team_pitching.K_9.toFixed(1)}</td>
              <td className="text-center py-3 px-2">{team.team_pitching.K_pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSplitsTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-2 font-semibold">チーム</th>
            <th className="text-center py-3 px-2 font-semibold">ホーム</th>
            <th className="text-center py-3 px-2 font-semibold">アウェー</th>
            <th className="text-center py-3 px-2 font-semibold">H得点</th>
            <th className="text-center py-3 px-2 font-semibold">A得点</th>
            <th className="text-center py-3 px-2 font-semibold">球場係数</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => (
            <tr key={team.team_code} className={index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
              <td className="py-3 px-2 font-medium">{team.team_name}</td>
              <td className="text-center py-3 px-2">
                {team.home_away_split.home.wins}-{team.home_away_split.home.losses}
                <br />
                <span className="text-xs text-slate-500">
                  {(team.home_away_split.home.pct * 100).toFixed(1)}%
                </span>
              </td>
              <td className="text-center py-3 px-2">
                {team.home_away_split.away.wins}-{team.home_away_split.away.losses}
                <br />
                <span className="text-xs text-slate-500">
                  {(team.home_away_split.away.pct * 100).toFixed(1)}%
                </span>
              </td>
              <td className="text-center py-3 px-2">{team.home_away_split.home.runs_scored}</td>
              <td className="text-center py-3 px-2">{team.home_away_split.away.runs_scored}</td>
              <td className="text-center py-3 px-2 font-mono">
                {team.avg_park_factor.toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      {/* Tab Headers */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('batting')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'batting'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          打撃成績
        </button>
        <button
          onClick={() => setActiveTab('pitching')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pitching'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="w-4 h-4 inline mr-2" />
          投手成績
        </button>
        <button
          onClick={() => setActiveTab('splits')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'splits'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          本拠地成績
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'batting' && renderBattingTable()}
        {activeTab === 'pitching' && renderPitchingTable()}
        {activeTab === 'splits' && renderSplitsTable()}
      </div>
    </div>
  );
}

function PFCorrectionEffects({ 
  effects 
}: { 
  effects: CompareTeamsResponse['comparison_summary']['pf_correction_effects'];
}) {
  if (!effects || effects.length === 0) return null;

  return (
    <div className="bg-slate-50 rounded-lg p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-orange-600" />
        Park Factor補正による順位変動
      </h3>
      <div className="space-y-3">
        {effects.map((effect, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
            <div className="flex items-center gap-3">
              <span className="font-medium">{effect.team}</span>
              <span className="text-sm text-slate-600">{effect.metric}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">
                {effect.original_rank}位 → {effect.corrected_rank}位
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                effect.rank_change > 0 
                  ? 'bg-red-100 text-red-800' 
                  : effect.rank_change < 0
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {effect.rank_change > 0 ? `▼${effect.rank_change}` : 
                 effect.rank_change < 0 ? `▲${Math.abs(effect.rank_change)}` : '→'}
              </span>
              <span className="text-sm text-slate-600">{effect.comment}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareTeamsContent() {
  const searchParams = useSearchParams();
  const [pfCorrection, setPfCorrection] = useState(false);
  const [year, setYear] = useState(2024);
  const [analyticsTracked, setAnalyticsTracked] = useState(false);

  // URL正規化: ソート・重複除去・大文字化
  const rawTeamCodes = searchParams.get('teams')?.split(',') || [];
  const teamCodes = Array.from(new Set(rawTeamCodes.map(code => code.trim().toUpperCase()))).sort();
  
  const apiUrl = `/api/compare/teams?teams=${teamCodes.join(',')}&year=${year}&pf=${pfCorrection}`;
  
  const { data, error, isLoading } = useSWR<CompareTeamsResponse>(
    teamCodes.length > 0 ? apiUrl : null, 
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
    }
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag && teamCodes.length > 0 && !analyticsTracked) {
      (window as any).gtag('event', 'compare_teams_view', {
        team_count: teamCodes.length,
        teams: teamCodes.join(','),
        pf_correction: pfCorrection,
        year: year
      });
      setAnalyticsTracked(true);
    }
  }, [teamCodes, pfCorrection, year, analyticsTracked]);

  const handlePfToggle = () => {
    const newValue = !pfCorrection;
    setPfCorrection(newValue);
    
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'compare_teams_toggle_pf', {
        enabled: newValue,
        teams: teamCodes.join(',')
      });
    }
  };

  const handleDownload = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'compare_teams_dl_csv', {
        teams: teamCodes.join(','),
        pf_correction: pfCorrection,
        format: 'csv'
      });
    }

    const downloadUrl = `/api/export/csv?scope=team_comparison&teams=${teamCodes.join(',')}&year=${year}&pf=${pfCorrection}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `team_comparison_${teamCodes.join('_')}_${year}.csv`;
    link.click();
  };

  if (teamCodes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">チームを選択してください</h2>
        <p className="text-slate-600 mb-6">URLにチームコードを指定して比較を開始できます</p>
        <Link 
          href="/teams" 
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          チーム一覧から選ぶ
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
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

  const battingLeader = data.comparison_summary.batting_leaders.wRC_plus;
  const pitchingLeader = data.comparison_summary.pitching_leaders.ERA_minus;

  // 動的SEO生成
  const teamNames = data.teams.map(t => t.team_name).join('・');
  const pageTitle = `${teamNames} チーム比較 ${year}年 | NPB Analytics`;
  const pageDescription = `${teamNames}の${year}年チーム成績を詳細比較。打撃（wRC+）・投手（ERA-）・Park Factor補正対応。${pfCorrection ? 'PF補正適用中' : '生データ表示'}`;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`https://npb-ai.com/api/og/teams?teams=${teamCodes.join(',')}&year=${year}&pf=${pfCorrection}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`https://npb-ai.com/api/og/teams?teams=${teamCodes.join(',')}&year=${year}&pf=${pfCorrection}`} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://npb-ai.com/compare/teams?teams=${teamCodes.join(',')}&year=${year}&pf=${pfCorrection}`} />
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/teams"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            チーム一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">チーム比較</h1>
          <p className="text-slate-600 mt-1">
            {year}年 • {data.teams.length}チーム比較
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Year selector */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select 
              value={year} 
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="border border-slate-300 rounded px-2 py-1"
            >
              {[2019, 2020, 2021, 2022, 2023, 2024].map(y => (
                <option key={y} value={y}>{y}年</option>
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

          {/* Share */}
          <ShareButton
            url={`https://npb-ai.com/compare/teams?teams=${teamCodes.join(',')}&year=${year}&pf=${pfCorrection}`}
            title={pageTitle}
            text={pageDescription}
          />
        </div>
      </div>

      {/* Auto Summary */}
      {data.comparison_summary.auto_summary && (
        <AutoSummary summary={data.comparison_summary.auto_summary} />
      )}

      {/* Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {data.teams.map((team) => (
          <TeamCard 
            key={team.team_code} 
            team={team} 
            pfCorrection={pfCorrection}
            isHighlighted={
              battingLeader.team === team.team_name || pitchingLeader.team === team.team_name
            }
          />
        ))}
      </div>

      {/* Comparison Table */}
      <div className="mb-8">
        <ComparisonTable teams={data.teams} pfCorrection={pfCorrection} />
      </div>

      {/* PF Correction Effects */}
      {pfCorrection && data.comparison_summary.pf_correction_effects.length > 0 && (
        <PFCorrectionEffects effects={data.comparison_summary.pf_correction_effects} />
      )}
      </div>
    </>
  );
}

export default function CompareTeamsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8">Loading...</div>}>
      <CompareTeamsContent />
    </Suspense>
  );
}