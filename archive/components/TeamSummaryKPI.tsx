"use client";

import { TrendingUp, TrendingDown, Activity, Target } from "lucide-react";

interface TeamSummary {
  batting: {
    wRC_plus: number;
    wOBA: number;
    OPS: number;
    R: number;
    HR: number;
    SB: number;
  };
  pitching: {
    FIP: number;
    ERA_minus: number;
    WHIP: number;
    K_pct: number;
    BB_pct: number;
    HR_per9: number;
  };
}

interface TeamSummaryKPIProps {
  summary: TeamSummary;
  year: number;
  team: string;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
  description?: string;
}

function KPICard({ title, value, subtitle, icon, trend, color, description }: KPICardProps) {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return null;
  };

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (val < 10 && val > 0) return val.toFixed(3);
      if (val < 100) return val.toFixed(1);
      return Math.round(val).toString();
    }
    return val;
  };

  return (
    <div className={`bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-colors group`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${color} bg-opacity-20`}>
          {icon}
        </div>
        {getTrendIcon()}
      </div>
      
      <div className="mb-1">
        <div className="text-2xl font-bold text-white">
          {formatValue(value)}
        </div>
        {subtitle && (
          <div className="text-xs text-slate-400">
            {subtitle}
          </div>
        )}
      </div>
      
      <div className="text-sm font-medium text-slate-300 mb-1">
        {title}
      </div>
      
      {description && (
        <div className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
          {description}
        </div>
      )}
    </div>
  );
}

export default function TeamSummaryKPI({ summary, year, team }: TeamSummaryKPIProps) {
  const getWrcPlusTrend = (wrcPlus: number) => {
    if (wrcPlus >= 120) return 'up';
    if (wrcPlus <= 80) return 'down';
    return 'neutral';
  };

  const getFipTrend = (fip: number) => {
    if (fip <= 3.5) return 'up'; // Good FIP
    if (fip >= 4.5) return 'down'; // Poor FIP
    return 'neutral';
  };

  const getEraMinusTrend = (eraMinus: number) => {
    if (eraMinus <= 85) return 'up'; // Good ERA-
    if (eraMinus >= 115) return 'down'; // Poor ERA-
    return 'neutral';
  };

  return (
    <div className="mb-6">
      <h3 className="text-xl font-semibold text-white mb-4">チーム指標サマリー</h3>
      
      {/* Batting KPIs */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-blue-400 mb-3 flex items-center gap-2">
          <Target className="w-5 h-5" />
          打撃指標
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="wRC+"
            value={summary.batting.wRC_plus}
            subtitle="リーグ平均=100"
            icon={<Target className="w-5 h-5 text-blue-400" />}
            trend={getWrcPlusTrend(summary.batting.wRC_plus)}
            color="bg-blue-500"
            description="総合打撃貢献度。120以上は優秀。"
          />
          
          <KPICard
            title="wOBA"
            value={summary.batting.wOBA}
            icon={<Target className="w-5 h-5 text-green-400" />}
            color="bg-green-500"
            description="重み付け出塁率。.320がリーグ平均。"
          />
          
          <KPICard
            title="OPS"
            value={summary.batting.OPS}
            icon={<Target className="w-5 h-5 text-yellow-400" />}
            color="bg-yellow-500"
            description="出塁率+長打率。.800以上は優秀。"
          />
          
          <KPICard
            title="得点"
            value={summary.batting.R}
            subtitle={`本塁打 ${summary.batting.HR}`}
            icon={<Target className="w-5 h-5 text-purple-400" />}
            color="bg-purple-500"
            description="チーム総得点数"
          />
        </div>
      </div>

      {/* Pitching KPIs */}
      <div>
        <h4 className="text-lg font-medium text-red-400 mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          投球指標
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="FIP"
            value={summary.pitching.FIP}
            subtitle="守備独立投球指標"
            icon={<Activity className="w-5 h-5 text-red-400" />}
            trend={getFipTrend(summary.pitching.FIP)}
            color="bg-red-500"
            description="3.50以下は優秀。防御率より予測性が高い。"
          />
          
          <KPICard
            title="ERA-"
            value={summary.pitching.ERA_minus}
            subtitle="リーグ平均=100"
            icon={<Activity className="w-5 h-5 text-orange-400" />}
            trend={getEraMinusTrend(summary.pitching.ERA_minus)}
            color="bg-orange-500"
            description="85以下は優秀。数字が小さいほど良い。"
          />
          
          <KPICard
            title="WHIP"
            value={summary.pitching.WHIP}
            subtitle="1回あたり出塁許可"
            icon={<Activity className="w-5 h-5 text-cyan-400" />}
            color="bg-cyan-500"
            description="1.20以下は優秀。低いほど良い。"
          />
          
          <KPICard
            title="K%-BB%"
            value={`${summary.pitching.K_pct.toFixed(1)}-${summary.pitching.BB_pct.toFixed(1)}`}
            subtitle="奪三振率-四球率"
            icon={<Activity className="w-5 h-5 text-indigo-400" />}
            color="bg-indigo-500"
            description="差が大きいほど優秀な投手陣"
          />
        </div>
      </div>
    </div>
  );
}