"use client";

import { useState } from 'react';
import { BarChart3, TrendingUp, Target, Activity } from 'lucide-react';

type StatCategory = 'basic' | 'advanced' | 'sabermetrics';

interface BattingStats {
  AVG?: number;
  OBP?: number;
  SLG?: number;
  OPS?: number;
  ISO?: number;
  BABIP?: number;
  wOBA?: number;
  'wRC+'?: number;
  'OPS+'?: number;
}

interface PitchingStats {
  IP?: number;
  ERA?: number;
  WHIP?: number;
  K9?: number;
  BB9?: number;
  HR9?: number;
  'K%'?: number;
  'BB%'?: number;
  FIP?: number;
  'ERA-'?: number;
  'FIP-'?: number;
}

interface AdvancedStatsProps {
  battingStats?: BattingStats;
  pitchingStats?: PitchingStats;
  playerName: string;
  constants?: {
    year: number;
    league: string;
    source: string;
  };
}

export default function AdvancedStats({ battingStats, pitchingStats, playerName, constants }: AdvancedStatsProps) {
  const [activeCategory, setActiveCategory] = useState<StatCategory>('basic');
  
  const categories = [
    { id: 'basic' as StatCategory, name: '基本', icon: BarChart3 },
    { id: 'advanced' as StatCategory, name: '発展', icon: TrendingUp },
    { id: 'sabermetrics' as StatCategory, name: 'セイバー', icon: Target }
  ];

  const getBattingStatsByCategory = (category: StatCategory): Array<{key: string, label: string, value: number | undefined, format: string}> => {
    if (!battingStats) return [];
    
    switch (category) {
      case 'basic':
        return [
          { key: 'AVG', label: '打率', value: battingStats.AVG, format: '.3f' },
          { key: 'OBP', label: '出塁率', value: battingStats.OBP, format: '.3f' },
          { key: 'SLG', label: '長打率', value: battingStats.SLG, format: '.3f' },
          { key: 'OPS', label: 'OPS', value: battingStats.OPS, format: '.3f' }
        ];
      case 'advanced':
        return [
          { key: 'ISO', label: 'ISO', value: battingStats.ISO, format: '.3f' },
          { key: 'BABIP', label: 'BABIP', value: battingStats.BABIP, format: '.3f' },
          { key: 'wOBA', label: 'wOBA', value: battingStats.wOBA, format: '.3f' },
          { key: 'OPS+', label: 'OPS+', value: battingStats['OPS+'], format: 'd' }
        ];
      case 'sabermetrics':
        return [
          { key: 'wRC+', label: 'wRC+', value: battingStats['wRC+'], format: 'd' },
          { key: 'wOBA', label: 'wOBA', value: battingStats.wOBA, format: '.3f' }
        ];
      default:
        return [];
    }
  };

  const getPitchingStatsByCategory = (category: StatCategory): Array<{key: string, label: string, value: number | undefined, format: string}> => {
    if (!pitchingStats) return [];
    
    switch (category) {
      case 'basic':
        return [
          { key: 'ERA', label: '防御率', value: pitchingStats.ERA, format: '.2f' },
          { key: 'WHIP', label: 'WHIP', value: pitchingStats.WHIP, format: '.2f' },
          { key: 'K9', label: 'K/9', value: pitchingStats.K9, format: '.1f' },
          { key: 'BB9', label: 'BB/9', value: pitchingStats.BB9, format: '.1f' }
        ];
      case 'advanced':
        return [
          { key: 'K%', label: 'K%', value: pitchingStats['K%'], format: '.1f%' },
          { key: 'BB%', label: 'BB%', value: pitchingStats['BB%'], format: '.1f%' },
          { key: 'HR9', label: 'HR/9', value: pitchingStats.HR9, format: '.1f' },
          { key: 'FIP', label: 'FIP', value: pitchingStats.FIP, format: '.2f' }
        ];
      case 'sabermetrics':
        return [
          { key: 'FIP', label: 'FIP', value: pitchingStats.FIP, format: '.2f' },
          { key: 'ERA-', label: 'ERA-', value: pitchingStats['ERA-'], format: 'd' },
          { key: 'FIP-', label: 'FIP-', value: pitchingStats['FIP-'], format: 'd' }
        ];
      default:
        return [];
    }
  };

  const formatValue = (value: number | undefined, format: string): string => {
    if (value === undefined || value === null) return '--';
    
    switch (format) {
      case '.3f':
        return value.toFixed(3);
      case '.2f':
        return value.toFixed(2);
      case '.1f':
        return value.toFixed(1);
      case '.1f%':
        return `${value.toFixed(1)}%`;
      case 'd':
        return Math.round(value).toString();
      default:
        return value.toString();
    }
  };

  const getStatColor = (key: string, value: number | undefined): string => {
    if (value === undefined) return 'text-slate-400';
    
    // 打撃指標の色分け (高い方が良い)
    const battingGoodStats = ['AVG', 'OBP', 'SLG', 'OPS', 'ISO', 'wOBA', 'wRC+', 'OPS+'];
    // 投球指標の色分け (低い方が良い)
    const pitchingGoodLow = ['ERA', 'WHIP', 'BB9', 'HR9', 'BB%', 'FIP'];
    // 投球指標の色分け (高い方が良い)
    const pitchingGoodHigh = ['K9', 'K%'];
    // マイナス系指標 (100未満が良い)
    const minusStats = ['ERA-', 'FIP-'];
    
    if (battingGoodStats.includes(key)) {
      if (key === 'wRC+' || key === 'OPS+') {
        if (value >= 130) return 'text-green-400';
        if (value >= 110) return 'text-blue-400';
        if (value >= 90) return 'text-white';
        return 'text-orange-400';
      } else {
        // 基本指標は相対的に評価
        if (value >= 0.300 && key === 'AVG') return 'text-green-400';
        if (value >= 0.400 && key === 'OBP') return 'text-green-400';
        if (value >= 0.500 && key === 'SLG') return 'text-green-400';
        if (value >= 0.900 && key === 'OPS') return 'text-green-400';
        if (value >= 0.380 && key === 'wOBA') return 'text-green-400';
        return 'text-white';
      }
    }
    
    if (pitchingGoodLow.includes(key)) {
      if (key === 'ERA' || key === 'FIP') {
        if (value <= 2.50) return 'text-green-400';
        if (value <= 3.50) return 'text-blue-400';
        if (value <= 4.50) return 'text-white';
        return 'text-orange-400';
      } else if (key === 'WHIP') {
        if (value <= 1.00) return 'text-green-400';
        if (value <= 1.30) return 'text-blue-400';
        return 'text-white';
      }
      return 'text-white';
    }
    
    if (pitchingGoodHigh.includes(key)) {
      if (key === 'K9' && value >= 9.0) return 'text-green-400';
      if (key === 'K%' && value >= 25.0) return 'text-green-400';
      return 'text-white';
    }
    
    if (minusStats.includes(key)) {
      if (value <= 80) return 'text-green-400';
      if (value <= 95) return 'text-blue-400';
      if (value <= 105) return 'text-white';
      return 'text-orange-400';
    }
    
    return 'text-white';
  };

  const battingStats_display = getBattingStatsByCategory(activeCategory);
  const pitchingStats_display = getPitchingStatsByCategory(activeCategory);

  if (!battingStats && !pitchingStats) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center justify-center text-slate-400">
          <Activity className="w-6 h-6 mr-2" />
          統計データがありません
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            高度指標 - {playerName}
          </h3>
          {constants && (
            <div className="text-xs text-slate-400">
              {constants.year}年 {constants.league} | {constants.source}
            </div>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex space-x-1">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Display */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Batting Stats */}
          {battingStats_display.map((stat) => (
            <div key={stat.key} className="text-center">
              <div className="text-xs text-slate-400 mb-1">{stat.label}</div>
              <div className={`text-lg font-bold ${getStatColor(stat.key, stat.value)}`}>
                {formatValue(stat.value, stat.format)}
              </div>
            </div>
          ))}
          
          {/* Pitching Stats */}
          {pitchingStats_display.map((stat) => (
            <div key={stat.key} className="text-center">
              <div className="text-xs text-slate-400 mb-1">{stat.label}</div>
              <div className={`text-lg font-bold ${getStatColor(stat.key, stat.value)}`}>
                {formatValue(stat.value, stat.format)}
              </div>
            </div>
          ))}
        </div>

        {/* Legend for Sabermetrics */}
        {activeCategory === 'sabermetrics' && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-xs text-slate-400 space-y-1">
              <p><span className="text-green-400">●</span> 優秀 <span className="text-blue-400">●</span> 良好 <span className="text-white">●</span> 平均 <span className="text-orange-400">●</span> 要改善</p>
              <p>wRC+/OPS+: 100=リーグ平均, 130+=優秀 | ERA-/FIP-: 100=リーグ平均, 80-=優秀</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}