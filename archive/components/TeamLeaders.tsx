"use client";

import Link from "next/link";
import { Target, Activity, ExternalLink, Info } from "lucide-react";

interface LeaderRow {
  player_id: string;
  player_name: string;
  team: string;
  PA?: number;
  IP?: number;
  wRC_plus?: number;
  FIP_minus?: number;
  avg?: number;
  obp?: number;
  slg?: number;
  HR?: number;
  era?: number;
  whip?: number;
  SO?: number;
}

interface TeamLeadersProps {
  year: number;
  team: string;
  hitters: LeaderRow[];
  pitchers: LeaderRow[];
}

export default function TeamLeaders({ year, team, hitters, pitchers }: TeamLeadersProps) {
  const formatStat = (value: number | undefined, decimals: number = 0): string => {
    if (value === undefined || value === null) return '-';
    return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  };

  const getWrcPlusColor = (wrcPlus: number | undefined) => {
    if (!wrcPlus) return 'text-slate-400';
    if (wrcPlus >= 140) return 'text-green-400';
    if (wrcPlus >= 120) return 'text-blue-400';
    if (wrcPlus >= 100) return 'text-white';
    return 'text-red-400';
  };

  const getFipMinusColor = (fipMinus: number | undefined) => {
    if (!fipMinus) return 'text-slate-400';
    if (fipMinus <= 70) return 'text-green-400';
    if (fipMinus <= 85) return 'text-blue-400';
    if (fipMinus <= 100) return 'text-white';
    return 'text-red-400';
  };

  const handleLeaderClick = (type: 'hitter' | 'pitcher', playerId: string, rank: number) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'team_leader_click', {
        type,
        player_id: playerId,
        rank,
        team,
        year
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Batting Leaders */}
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            打撃リーダー (wRC+)
          </h3>
          <div className="group relative">
            <Info className="w-4 h-4 text-slate-400 cursor-help" />
            <div className="absolute right-0 top-6 w-64 p-2 bg-black border border-white/20 rounded-lg text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              wRC+: リーグ平均を100とした打撃貢献度。120以上は優秀、140以上は最高レベル。
              規定打席: PA≥120
            </div>
          </div>
        </div>
        
        {hitters.length > 0 ? (
          <div className="space-y-3">
            {hitters.map((hitter, index) => (
              <div key={hitter.player_id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg hover:bg-black/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <Link
                      href={`/players/${hitter.player_id}`}
                      className="font-medium text-white hover:text-blue-400 transition-colors"
                      onClick={() => handleLeaderClick('hitter', hitter.player_id, index + 1)}
                    >
                      {hitter.player_name}
                    </Link>
                    <div className="text-xs text-slate-400 mt-1">
                      打率 {formatStat(hitter.avg, 3)} | HR {formatStat(hitter.HR)} | PA {formatStat(hitter.PA)}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg font-bold ${getWrcPlusColor(hitter.wRC_plus)}`}>
                    {formatStat(hitter.wRC_plus)}
                  </div>
                  <div className="text-xs text-slate-400">wRC+</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>打撃データを集計中...</p>
          </div>
        )}
        
        <div className="mt-4 pt-3 border-t border-white/10">
          <Link
            href={`/players?team=${team}&year=${year}&pos=B`}
            className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            全打者を見る
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Pitching Leaders */}
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500" />
            投手リーダー (FIP-)
          </h3>
          <div className="group relative">
            <Info className="w-4 h-4 text-slate-400 cursor-help" />
            <div className="absolute right-0 top-6 w-64 p-2 bg-black border border-white/20 rounded-lg text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              FIP-: リーグ平均を100とした投手実力指標。85以下は優秀、70以下は最高レベル。
              規定投球回: IP≥30
            </div>
          </div>
        </div>
        
        {pitchers.length > 0 ? (
          <div className="space-y-3">
            {pitchers.map((pitcher, index) => (
              <div key={pitcher.player_id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg hover:bg-black/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <Link
                      href={`/players/${pitcher.player_id}`}
                      className="font-medium text-white hover:text-red-400 transition-colors"
                      onClick={() => handleLeaderClick('pitcher', pitcher.player_id, index + 1)}
                    >
                      {pitcher.player_name}
                    </Link>
                    <div className="text-xs text-slate-400 mt-1">
                      防御率 {formatStat(pitcher.era, 2)} | K {formatStat(pitcher.SO)} | IP {formatStat(pitcher.IP, 1)}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg font-bold ${getFipMinusColor(pitcher.FIP_minus)}`}>
                    {formatStat(pitcher.FIP_minus)}
                  </div>
                  <div className="text-xs text-slate-400">FIP-</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>投手データを集計中...</p>
          </div>
        )}
        
        <div className="mt-4 pt-3 border-t border-white/10">
          <Link
            href={`/players?team=${team}&year=${year}&pos=P`}
            className="inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            全投手を見る
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}