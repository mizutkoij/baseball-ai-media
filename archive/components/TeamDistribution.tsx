"use client";

import React, { useEffect } from 'react';
import { BarChart3, TrendingUp, Users } from 'lucide-react';

interface DistributionBin {
  range: string;
  count: number;
  percentage: number;
  players: string[];
}

interface TeamDistributionData {
  type: 'wRC_plus' | 'FIP_minus';
  title: string;
  description: string;
  teamAverage: number;
  leagueAverage: number;
  bins: DistributionBin[];
  total: number;
}

interface TeamDistributionProps {
  year: number;
  team: string;
  distributions: TeamDistributionData[];
}

const TeamDistribution: React.FC<TeamDistributionProps> = ({
  year,
  team,
  distributions
}) => {
  // Track analytics for distribution view
  React.useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag && distributions.length > 0) {
      (window as any).gtag('event', 'team_distribution_view', {
        team: team,
        year: year,
        distribution_count: distributions.length,
        has_batting: distributions.some(d => d.type === 'wRC_plus'),
        has_pitching: distributions.some(d => d.type === 'FIP_minus'),
        batting_average: distributions.find(d => d.type === 'wRC_plus')?.teamAverage || 0,
        pitching_average: distributions.find(d => d.type === 'FIP_minus')?.teamAverage || 0
      });
    }
  }, [year, team, distributions]);

  if (!distributions || distributions.length === 0) {
    return null;
  }

  const getBarColor = (type: 'wRC_plus' | 'FIP_minus') => {
    return type === 'wRC_plus' 
      ? 'bg-gradient-to-t from-blue-500 to-blue-400'
      : 'bg-gradient-to-t from-red-500 to-red-400';
  };

  const getBarHoverColor = (type: 'wRC_plus' | 'FIP_minus') => {
    return type === 'wRC_plus' 
      ? 'hover:from-blue-600 hover:to-blue-500'
      : 'hover:from-red-600 hover:to-red-500';
  };

  const renderHistogram = (distribution: TeamDistributionData) => {
    const maxCount = Math.max(...distribution.bins.map(bin => bin.count));
    const maxHeight = 120; // pixels

    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className={`w-6 h-6 ${
              distribution.type === 'wRC_plus' ? 'text-blue-400' : 'text-red-400'
            }`} />
            <div>
              <h3 className="text-lg font-semibold text-white">
                {distribution.title}
              </h3>
              <p className="text-sm text-slate-400">
                {distribution.description}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${
              distribution.type === 'wRC_plus' ? 'text-blue-400' : 'text-red-400'
            }`}>
              {distribution.teamAverage}
            </div>
            <div className="text-xs text-slate-400">
              チーム平均 (リーグ: {distribution.leagueAverage})
            </div>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="mb-4">
          <div className="flex items-end justify-between gap-1 h-32 mb-2">
            {distribution.bins.map((bin, index) => {
              const height = maxCount > 0 ? (bin.count / maxCount) * maxHeight : 0;
              
              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center group relative"
                >
                  {/* Bar */}
                  <div
                    className={`w-full ${getBarColor(distribution.type)} ${getBarHoverColor(distribution.type)} 
                      rounded-t-sm transition-all duration-300 cursor-pointer`}
                    style={{ height: `${height}px` }}
                    onClick={() => {
                      // Track analytics for bin interaction
                      if (typeof window !== 'undefined' && (window as any).gtag) {
                        (window as any).gtag('event', 'team_distribution_bin_click', {
                          team: team,
                          year: year,
                          distribution_type: distribution.type,
                          bin_range: bin.range,
                          player_count: bin.count,
                          percentage: bin.percentage.toFixed(1)
                        });
                      }
                    }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      <div className="bg-black/90 text-white text-xs rounded-lg p-3 whitespace-nowrap
                        border border-white/20 shadow-lg">
                        <div className="font-semibold mb-1">{bin.range}</div>
                        <div>{bin.count}人 ({bin.percentage.toFixed(1)}%)</div>
                        {bin.players.length > 0 && (
                          <div className="mt-1 text-slate-300">
                            {bin.players.slice(0, 3).join(', ')}
                            {bin.players.length > 3 && '...'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Count Label */}
                  {bin.count > 0 && (
                    <div className="text-xs text-white font-medium mt-1">
                      {bin.count}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* X-axis Labels */}
          <div className="flex justify-between gap-1 text-xs text-slate-400">
            {distribution.bins.map((bin, index) => (
              <div key={index} className="flex-1 text-center">
                {bin.range}
              </div>
            ))}
          </div>
        </div>

        {/* Statistics Summary */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">
                合計: {distribution.total}人
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">
                標準偏差: {calculateStandardDeviation(distribution.bins).toFixed(1)}
              </span>
            </div>
          </div>
          
          {/* Team vs League Comparison */}
          <div className="text-right">
            <div className={`text-sm font-medium ${
              getComparisonColor(distribution.teamAverage, distribution.leagueAverage, distribution.type)
            }`}>
              {getComparisonText(distribution.teamAverage, distribution.leagueAverage, distribution.type)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-8 h-8 text-purple-500" />
        <div>
          <h2 className="text-2xl font-bold text-white">チーム能力分布</h2>
          <p className="text-slate-400">
            {year}年 主力選手の能力値分布とチーム特色
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {distributions.map((distribution, index) => (
          <div key={index}>
            {renderHistogram(distribution)}
          </div>
        ))}
      </div>

      {/* Analysis Summary */}
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          分布分析サマリー
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {distributions.map((dist, index) => (
            <div key={index} className="space-y-2">
              <h4 className={`font-medium ${
                dist.type === 'wRC_plus' ? 'text-blue-400' : 'text-red-400'
              }`}>
                {dist.title}
              </h4>
              <ul className="space-y-1 text-slate-300">
                <li>• チーム平均: {dist.teamAverage} (リーグ: {dist.leagueAverage})</li>
                <li>• 最多レンジ: {getMostCommonRange(dist.bins)}</li>
                <li>• エリート層: {getEliteCount(dist.bins, dist.type)}人</li>
                <li>• 課題層: {getStrugglingCount(dist.bins, dist.type)}人</li>
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper Functions
function calculateStandardDeviation(bins: DistributionBin[]): number {
  // Simplified calculation using bin midpoints
  const values: number[] = [];
  bins.forEach(bin => {
    const midpoint = parseBinMidpoint(bin.range);
    for (let i = 0; i < bin.count; i++) {
      values.push(midpoint);
    }
  });
  
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function parseBinMidpoint(range: string): number {
  // Parse ranges like "100-109", "110+", etc.
  if (range.includes('+')) {
    return parseInt(range.replace('+', '')) + 10;
  }
  if (range.includes('-')) {
    const [min, max] = range.split('-').map(n => parseInt(n));
    return (min + max) / 2;
  }
  return parseInt(range) || 100;
}

function getComparisonColor(teamAvg: number, leagueAvg: number, type: 'wRC_plus' | 'FIP_minus'): string {
  const isGood = type === 'wRC_plus' ? teamAvg > leagueAvg : teamAvg < leagueAvg;
  return isGood ? 'text-green-400' : 'text-red-400';
}

function getComparisonText(teamAvg: number, leagueAvg: number, type: 'wRC_plus' | 'FIP_minus'): string {
  const diff = Math.abs(teamAvg - leagueAvg);
  const isGood = type === 'wRC_plus' ? teamAvg > leagueAvg : teamAvg < leagueAvg;
  
  if (diff < 2) return '平均的';
  if (diff < 5) return isGood ? 'やや良好' : 'やや課題';
  return isGood ? '優秀' : '要改善';
}

function getMostCommonRange(bins: DistributionBin[]): string {
  const maxBin = bins.reduce((max, bin) => bin.count > max.count ? bin : max, bins[0]);
  return maxBin?.range || '-';
}

function getEliteCount(bins: DistributionBin[], type: 'wRC_plus' | 'FIP_minus'): number {
  // Elite threshold: wRC+ 120+, FIP- 80-
  const eliteThreshold = type === 'wRC_plus' ? 120 : 80;
  
  return bins.reduce((count, bin) => {
    const midpoint = parseBinMidpoint(bin.range);
    const isElite = type === 'wRC_plus' ? midpoint >= eliteThreshold : midpoint <= eliteThreshold;
    return count + (isElite ? bin.count : 0);
  }, 0);
}

function getStrugglingCount(bins: DistributionBin[], type: 'wRC_plus' | 'FIP_minus'): number {
  // Struggling threshold: wRC+ 80-, FIP- 120+
  const strugglingThreshold = type === 'wRC_plus' ? 80 : 120;
  
  return bins.reduce((count, bin) => {
    const midpoint = parseBinMidpoint(bin.range);
    const isStruggling = type === 'wRC_plus' ? midpoint <= strugglingThreshold : midpoint >= strugglingThreshold;
    return count + (isStruggling ? bin.count : 0);
  }, 0);
}

export default TeamDistribution;