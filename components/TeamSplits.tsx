"use client";

import React, { useState, useEffect } from 'react';
import { Home, Plane, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { PFDeltaNote } from '@/components/PFDeltaNote';
import { PFHelpTooltip } from '@/components/PFHelpTooltip';
import type { TeamSplitStats } from '@/lib/db/teamQueries';

interface TeamSplitsProps {
  year: number;
  team: string;
  splits: TeamSplitStats[];
}

const TeamSplits: React.FC<TeamSplitsProps> = ({
  year,
  team,
  splits
}) => {
  const [pfCorrectionEnabled, setPfCorrectionEnabled] = useState(false);

  const homeSplit = splits.find(s => s.split_type === 'home');
  const awaySplit = splits.find(s => s.split_type === 'away');

  if (!homeSplit || !awaySplit) {
    return null;
  }

  const handlePfToggle = () => {
    const newState = !pfCorrectionEnabled;
    setPfCorrectionEnabled(newState);
    
    // Track analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'team_pf_toggle', {
        on: newState,
        split: 'both',
        year: year,
        team: team
      });
    }
  };

  const handleSplitView = (split: 'home' | 'away') => {
    // Track analytics for split viewing
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'team_split_view', {
        split: split,
        year: year,
        team: team,
        pf_correction: pfCorrectionEnabled
      });
    }
  };

  const getReliabilityBadge = (reliability: 'high' | 'medium' | 'low') => {
    const config = {
      high: { bg: 'bg-green-500/20', text: 'text-green-400', label: '信頼性: 高' },
      medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '信頼性: 中' },
      low: { bg: 'bg-red-500/20', text: 'text-red-400', label: '参考値' }
    };
    
    const { bg, text, label } = config[reliability];
    
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${bg} ${text}`}>
        {reliability === 'low' && <AlertTriangle className="w-3 h-3" />}
        {label}
      </div>
    );
  };

  const formatStat = (value: number, precision: number = 0) => {
    if (precision === 3) return value.toFixed(3);
    if (precision === 1) return value.toFixed(1);
    return Math.round(value);
  };

  const renderSplitCard = (split: TeamSplitStats, icon: React.ReactNode, title: string) => {
    return (
      <div 
        className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 cursor-pointer hover:bg-black/30 transition-colors"
        onClick={() => handleSplitView(split.split_type)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h4 className="text-lg font-semibold text-white">{title}</h4>
              <p className="text-sm text-slate-400">{split.games}試合</p>
            </div>
          </div>
          {getReliabilityBadge(split.reliability)}
        </div>

        {/* Batting Stats */}
        <div className="mb-6">
          <h5 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            打撃指標
            <span className="text-xs text-slate-500">({split.batting.PA} PA)</span>
          </h5>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-400">
                {pfCorrectionEnabled ? formatStat(split.batting.wRC_plus_neutral) : formatStat(split.batting.wRC_plus)}
              </div>
              <div className="text-xs text-slate-400">wRC+</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-400">
                {pfCorrectionEnabled ? formatStat(split.batting.OPS_plus_neutral) : formatStat(split.batting.OPS_plus)}
              </div>
              <div className="text-xs text-slate-400">OPS+</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-400">
                {formatStat(split.batting.wOBA, 3)}
              </div>
              <div className="text-xs text-slate-400">wOBA</div>
            </div>
          </div>
        </div>

        {/* Pitching Stats */}
        <div className="mb-4">
          <h5 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            投手指標
            <span className="text-xs text-slate-500">({formatStat(split.pitching.IP, 1)} IP)</span>
          </h5>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-red-400">
                {pfCorrectionEnabled ? formatStat(split.pitching.ERA_minus_neutral) : formatStat(split.pitching.ERA_minus)}
              </div>
              <div className="text-xs text-slate-400">ERA-</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-400">
                {pfCorrectionEnabled ? formatStat(split.pitching.FIP_minus_neutral) : formatStat(split.pitching.FIP_minus)}
              </div>
              <div className="text-xs text-slate-400">FIP-</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-400">
                {formatStat(split.pitching.HR_per9, 1)}
              </div>
              <div className="text-xs text-slate-400">HR/9</div>
            </div>
          </div>
        </div>

        {/* Park Factor Info & Difference Comments */}
        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>平均PF: {split.batting.avg_pf}</span>
            <span>{pfCorrectionEnabled ? 'PF補正済み' : 'PF補正なし'}</span>
          </div>
          
          {/* PF Difference Comments - only show when toggle is enabled */}
          {pfCorrectionEnabled && (
            <div className="space-y-1">
              <PFDeltaNote 
                raw={split.batting.wRC_plus} 
                neutral={split.batting.wRC_plus_neutral} 
                pf={Number(split.batting.avg_pf)} 
                metric="wRC+" 
              />
              <PFDeltaNote 
                raw={split.batting.OPS_plus} 
                neutral={split.batting.OPS_plus_neutral} 
                pf={Number(split.batting.avg_pf)} 
                metric="OPS+" 
              />
              <PFDeltaNote 
                raw={split.pitching.ERA_minus} 
                neutral={split.pitching.ERA_minus_neutral} 
                pf={Number(split.batting.avg_pf)} 
                metric="ERA-" 
              />
              <PFDeltaNote 
                raw={split.pitching.FIP_minus} 
                neutral={split.pitching.FIP_minus_neutral} 
                pf={Number(split.batting.avg_pf)} 
                metric="FIP-" 
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Home className="w-6 h-6 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">ホーム/ビジター成績</h3>
        </div>

        {/* PF Correction Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <PFHelpTooltip />
            <span className="text-slate-300">PF補正</span>
          </div>
          <button
            onClick={handlePfToggle}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              pfCorrectionEnabled 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
            }`}
          >
            {pfCorrectionEnabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">
              {pfCorrectionEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Split Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {renderSplitCard(
          homeSplit,
          <Home className="w-6 h-6 text-blue-500" />,
          'ホーム'
        )}
        
        {renderSplitCard(
          awaySplit,
          <Plane className="w-6 h-6 text-purple-500" />,
          'ビジター'
        )}
      </div>

      {/* Comparison Summary */}
      <div className="bg-black/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-3">ホーム vs ビジター 比較</h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="text-slate-400">wRC+ 差</div>
            <div className={`font-bold ${
              (pfCorrectionEnabled ? homeSplit.batting.wRC_plus_neutral : homeSplit.batting.wRC_plus) >
              (pfCorrectionEnabled ? awaySplit.batting.wRC_plus_neutral : awaySplit.batting.wRC_plus)
                ? 'text-green-400' : 'text-red-400'
            }`}>
              {Math.abs(
                (pfCorrectionEnabled ? homeSplit.batting.wRC_plus_neutral : homeSplit.batting.wRC_plus) -
                (pfCorrectionEnabled ? awaySplit.batting.wRC_plus_neutral : awaySplit.batting.wRC_plus)
              )}
            </div>
          </div>
          
          <div>
            <div className="text-slate-400">ERA- 差</div>
            <div className={`font-bold ${
              (pfCorrectionEnabled ? homeSplit.pitching.ERA_minus_neutral : homeSplit.pitching.ERA_minus) <
              (pfCorrectionEnabled ? awaySplit.pitching.ERA_minus_neutral : awaySplit.pitching.ERA_minus)
                ? 'text-green-400' : 'text-red-400'
            }`}>
              {Math.abs(
                (pfCorrectionEnabled ? homeSplit.pitching.ERA_minus_neutral : homeSplit.pitching.ERA_minus) -
                (pfCorrectionEnabled ? awaySplit.pitching.ERA_minus_neutral : awaySplit.pitching.ERA_minus)
              )}
            </div>
          </div>
          
          <div>
            <div className="text-slate-400">ホーム優位</div>
            <div className="font-bold text-blue-400">
              {homeSplit.batting.avg_pf > 1.0 ? '打高' : homeSplit.batting.avg_pf < 1.0 ? '投高' : '中立'}
            </div>
          </div>
          
          <div>
            <div className="text-slate-400">サンプル</div>
            <div className={`font-bold ${
              Math.min(homeSplit.batting.PA, awaySplit.batting.PA) >= 200 ? 'text-green-400' :
              Math.min(homeSplit.batting.PA, awaySplit.batting.PA) >= 50 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {Math.min(homeSplit.batting.PA, awaySplit.batting.PA)} PA
            </div>
          </div>
        </div>
      </div>

      {/* Methodology Note */}
      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
        <p className="text-xs text-slate-400">
          <strong>PF補正方法:</strong> 打撃指標は runPF^1.0、ERA- は runPF^1.0、FIP- は runPF^0.5 で補正。
          各試合のPFをPA/IPで加重平均して適用。参考値は50PA/10IP未満のスプリット。
        </p>
      </div>
    </div>
  );
};

export default TeamSplits;