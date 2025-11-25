"use client";

import { Trophy, TrendingUp, Target } from "lucide-react";

interface TeamHeaderProps {
  year: number;
  team: string;
  league: 'central' | 'pacific';
  standings: {
    W: number;
    L: number;
    D: number;
    RD: number;
    rank: number;
    last10: { W: number; L: number; D: number };
  };
}

const teamNames: Record<string, string> = {
  // Central League
  'T': '阪神타이거스',
  'S': '東京ヤクルトスワローズ',
  'C': '広島東洋カープ',
  'YS': '横浜DeNAベイスターズ',
  'D': '中日ドラゴンズ',
  'G': '読売ジャイアンツ',
  // Pacific League
  'H': 'ソフトバンクホークス',
  'L': '埼玉西武ライオンズ',
  'E': '東北楽天ゴールデンイーグルス',
  'M': '千葉ロッテマリーンズ',
  'F': '北海道日本ハムファイターズ',
  'B': 'オリックス・バファローズ'
};

export default function TeamHeader({ year, team, league, standings }: TeamHeaderProps) {
  const teamName = teamNames[team] || team;
  const leagueName = league === 'central' ? 'セントラル・リーグ' : 'パシフィック・リーグ';
  const winPct = (standings.W + standings.L + standings.D) > 0 
    ? standings.W / (standings.W + standings.L + standings.D * 0.5) 
    : 0;
  
  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank <= 3) return 'text-green-400';
    if (rank <= 4) return 'text-blue-400';
    return 'text-slate-400';
  };
  
  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🏆';
    if (rank <= 3) return '🥉';
    return '';
  };

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Team Info */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{teamName}</h1>
            <span className={`text-2xl font-bold ${getRankColor(standings.rank)}`}>
              {standings.rank}位 {getRankBadge(standings.rank)}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 font-medium">
              {year}年
            </span>
            <span className="px-3 py-1 text-sm rounded-full bg-purple-100 text-purple-800 font-medium">
              {leagueName}
            </span>
          </div>
          
          <p className="text-slate-300 text-sm">
            勝率 {(winPct * 100).toFixed(1)}% | 得失点差 {standings.RD > 0 ? '+' : ''}{standings.RD}
          </p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {/* Record */}
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-2xl font-bold text-white">
              {standings.W}-{standings.L}
              {standings.D > 0 && `-${standings.D}`}
            </div>
            <div className="text-xs text-slate-400">戦績</div>
          </div>
          
          {/* Win Percentage */}
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-400">
              .{Math.round(winPct * 1000).toString().padStart(3, '0')}
            </div>
            <div className="text-xs text-slate-400">勝率</div>
          </div>
          
          {/* Run Differential */}
          <div className="bg-black/30 rounded-lg p-3">
            <div className={`text-2xl font-bold ${standings.RD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {standings.RD > 0 ? '+' : ''}{standings.RD}
            </div>
            <div className="text-xs text-slate-400">得失点差</div>
          </div>
          
          {/* Last 10 (if available) */}
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-lg font-bold text-white">
              {standings.last10.W || 0}-{standings.last10.L || 0}
            </div>
            <div className="text-xs text-slate-400">直近10試合</div>
          </div>
        </div>
      </div>
      
      {/* Additional Info Bar */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4" />
              <span>{leagueName} {standings.rank}位</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              <span>勝利数: {standings.W}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp className="w-3 h-3" />
            <span>最終更新: {new Date().toLocaleDateString('ja-JP')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}