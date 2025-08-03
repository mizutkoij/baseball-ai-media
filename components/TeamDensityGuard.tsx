/**
 * Team Density Guard Component - P0密度保証
 * 
 * 順位バッジ + 主力5人選手の確実な表示を保証
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, TrendingUp, TrendingDown, Minus, Users, Target, Activity } from "lucide-react";
import { getTeamDensityData, type TeamDensityData } from "@/lib/teamDensityGuard";

interface TeamDensityGuardProps {
  year: number;
  teamCode: string;
  teamName: string;
}

export default function TeamDensityGuard({ year, teamCode, teamName }: TeamDensityGuardProps) {
  const [densityData, setDensityData] = useState<TeamDensityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getTeamDensityData(year, teamCode)
      .then(setDensityData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [year, teamCode]);

  if (isLoading) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-600 rounded mb-4 w-48"></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!densityData) return null;

  const { rankingBadge, keyPlayers, supplementData } = densityData;

  const getTrendIcon = () => {
    switch (rankingBadge.trend) {
      case "上昇": return <TrendingUp className="w-4 h-4 text-green-400" />;
      case "下降": return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPositionColor = (position: number | null) => {
    if (!position) return "bg-slate-600";
    if (position <= 2) return "bg-amber-500";
    if (position <= 4) return "bg-blue-500";
    return "bg-slate-500";
  };

  const formatWinRate = (rate: number) => rate.toFixed(3);

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
      {/* 順位バッジセクション */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white">{year}年 {teamName}</h2>
          </div>
          
          {/* 順位バッジ */}
          <div className={`px-4 py-2 rounded-full ${getPositionColor(rankingBadge.position)} flex items-center gap-2`}>
            <span className="text-white font-bold">
              {rankingBadge.position ? `${rankingBadge.league} ${rankingBadge.position}位` : "順位計算中"}
            </span>
          </div>
        </div>

        {/* 成績サマリー */}
        <div className="text-right">
          <div className="text-lg font-bold text-white">
            {rankingBadge.wins}勝{rankingBadge.losses}敗
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span>勝率 {formatWinRate(rankingBadge.winRate)}</span>
            {getTrendIcon()}
          </div>
          {rankingBadge.gamesBack !== null && rankingBadge.gamesBack > 0 && (
            <div className="text-xs text-slate-400">
              {rankingBadge.gamesBack}ゲーム差
            </div>
          )}
        </div>
      </div>

      {/* チームハイライト */}
      {supplementData.teamHighlights.length > 0 && (
        <div className="mb-6 p-3 bg-blue-950/30 border border-blue-800/50 rounded-lg">
          <div className="flex flex-wrap gap-2">
            {supplementData.teamHighlights.map((highlight, index) => (
              <span key={index} className="text-sm text-blue-300 bg-blue-900/50 px-2 py-1 rounded">
                {highlight}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 主力選手セクション */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 主力打者 */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">主力打者 (wRC+順)</h3>
          </div>
          <div className="space-y-2">
            {keyPlayers.batting.slice(0, 5).map((batter, index) => (
              <Link
                key={batter.player_id}
                href={`/players/${batter.player_id}`}
                className="block p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded border border-slate-600/30 hover:border-green-400/50 transition-all"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-white">{batter.name}</div>
                    <div className="text-xs text-slate-400">{batter.highlight}</div>
                  </div>
                  <div className="text-right">
                    {batter.wrc_plus && (
                      <div className="text-green-400 font-bold">
                        wRC+ {batter.wrc_plus.toFixed(0)}
                      </div>
                    )}
                    {batter.ops && (
                      <div className="text-xs text-slate-400">
                        OPS {batter.ops.toFixed(3)}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            
            {keyPlayers.batting.length === 0 && (
              <div className="p-3 bg-slate-800/30 rounded text-center text-slate-400">
                主力打者データを読み込み中...
              </div>
            )}
          </div>
        </div>

        {/* 主力投手 */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-white">主力投手 (FIP順)</h3>
          </div>
          <div className="space-y-2">
            {keyPlayers.pitching.slice(0, 5).map((pitcher, index) => (
              <Link
                key={pitcher.player_id}
                href={`/players/${pitcher.player_id}`}
                className="block p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded border border-slate-600/30 hover:border-red-400/50 transition-all"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-white">{pitcher.name}</div>
                    <div className="text-xs text-slate-400">{pitcher.highlight}</div>
                  </div>
                  <div className="text-right">
                    {pitcher.fip && (
                      <div className="text-red-400 font-bold">
                        FIP {pitcher.fip.toFixed(2)}
                      </div>
                    )}
                    {pitcher.era_minus && (
                      <div className="text-xs text-slate-400">
                        ERA- {pitcher.era_minus.toFixed(0)}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            
            {keyPlayers.pitching.length === 0 && (
              <div className="p-3 bg-slate-800/30 rounded text-center text-slate-400">
                主力投手データを読み込み中...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* フッター情報 */}
      <div className="mt-6 pt-4 border-t border-slate-600/30">
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <span>📈 {supplementData.recentForm}</span>
          <span>🎯 {supplementData.seasonOutlook}</span>
          <span>📊 セイバーメトリクス指標による分析</span>
        </div>
      </div>
    </div>
  );
}