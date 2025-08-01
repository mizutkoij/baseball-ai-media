"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface OpponentRecord {
  opponent: string;
  W: number;
  L: number;
  D: number;
}

interface OpponentMatrixProps {
  year: number;
  team: string;
  league: 'central' | 'pacific';
  vsOpponents: OpponentRecord[];
}

const teamNames: Record<string, { name: string; short: string }> = {
  // Central League
  'T': { name: '阪神タイガース', short: '阪神' },
  'S': { name: '東京ヤクルトスワローズ', short: 'ヤクルト' },
  'C': { name: '広島東洋カープ', short: '広島' },
  'YS': { name: '横浜DeNAベイスターズ', short: 'DeNA' },
  'D': { name: '中日ドラゴンズ', short: '中日' },
  'G': { name: '読売ジャイアンツ', short: '巨人' },
  // Pacific League
  'H': { name: 'ソフトバンクホークス', short: 'ソフトバンク' },
  'L': { name: '埼玉西武ライオンズ', short: '西武' },
  'E': { name: '東北楽天ゴールデンイーグルス', short: '楽天' },
  'M': { name: '千葉ロッテマリーンズ', short: 'ロッテ' },
  'F': { name: '北海道日本ハムファイターズ', short: '日本ハム' },
  'B': { name: 'オリックス・バファローズ', short: 'オリックス' }
};

export default function OpponentMatrix({ year, team, league, vsOpponents }: OpponentMatrixProps) {
  const handleOpponentClick = (opponent: string) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'team_opponent_click', {
        year,
        team,
        opponent
      });
    }
  };

  const getRecordColor = (W: number, L: number, D: number) => {
    const total = W + L + D;
    if (total === 0) return 'text-slate-400';
    
    const winPct = W / (W + L + D * 0.5);
    if (winPct >= 0.6) return 'text-green-400';
    if (winPct >= 0.4) return 'text-white';
    return 'text-red-400';
  };

  const getWinPct = (W: number, L: number, D: number) => {
    const total = W + L + D;
    if (total === 0) return '---';
    
    const winPct = W / (W + L + D * 0.5);
    return '.' + Math.round(winPct * 1000).toString().padStart(3, '0');
  };

  // Sort opponents by league (same league first, then interleague)
  const sameLeagueTeams = ['T', 'S', 'C', 'YS', 'D', 'G']; // Central
  const pacificTeams = ['H', 'L', 'E', 'M', 'F', 'B']; // Pacific
  
  const currentLeagueTeams = league === 'central' ? sameLeagueTeams : pacificTeams;
  const otherLeagueTeams = league === 'central' ? pacificTeams : sameLeagueTeams;
  
  const sortedOpponents = [
    ...vsOpponents.filter(opp => currentLeagueTeams.includes(opp.opponent)),
    ...vsOpponents.filter(opp => otherLeagueTeams.includes(opp.opponent))
  ];

  if (vsOpponents.length === 0) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">対戦成績</h3>
        <div className="text-center py-8 text-slate-400">
          <p>対戦成績データを集計中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">対戦成績</h3>
        <div className="text-xs text-slate-400">
          クリックで相手チームページへ
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black/30 border-b border-white/20">
              <th className="text-left p-3 font-medium text-white sticky left-0 bg-black/30">相手</th>
              <th className="text-center p-3 font-medium text-white">勝</th>
              <th className="text-center p-3 font-medium text-white">敗</th>
              <th className="text-center p-3 font-medium text-white">分</th>
              <th className="text-center p-3 font-medium text-white">勝率</th>
            </tr>
          </thead>
          <tbody>
            {/* Same League Header */}
            <tr className="bg-black/20">
              <td colSpan={5} className="p-2 text-xs font-medium text-slate-400 border-t border-white/10">
                {league === 'central' ? 'セ・リーグ' : 'パ・リーグ'}
              </td>
            </tr>
            
            {/* Same League Teams */}
            {sortedOpponents
              .filter(opponent => currentLeagueTeams.includes(opponent.opponent))
              .map((opponent, i) => (
                <tr key={opponent.opponent} className={i % 2 === 0 ? "bg-black/10" : "bg-black/20"}>
                  <td className="p-3 sticky left-0 bg-inherit">
                    <Link
                      href={`/teams/${year}/${opponent.opponent}`}
                      className="font-medium text-white hover:text-blue-400 transition-colors flex items-center gap-2"
                      onClick={() => handleOpponentClick(opponent.opponent)}
                    >
                      {teamNames[opponent.opponent]?.short || opponent.opponent}
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </Link>
                  </td>
                  <td className="p-3 text-center text-green-400 font-medium">
                    {opponent.W}
                  </td>
                  <td className="p-3 text-center text-red-400 font-medium">
                    {opponent.L}
                  </td>
                  <td className="p-3 text-center text-yellow-400 font-medium">
                    {opponent.D || 0}
                  </td>
                  <td className={`p-3 text-center font-medium ${getRecordColor(opponent.W, opponent.L, opponent.D)}`}>
                    {getWinPct(opponent.W, opponent.L, opponent.D)}
                  </td>
                </tr>
              ))}
            
            {/* Interleague Header */}
            {sortedOpponents.some(opp => otherLeagueTeams.includes(opp.opponent)) && (
              <tr className="bg-black/20">
                <td colSpan={5} className="p-2 text-xs font-medium text-slate-400 border-t border-white/10">
                  交流戦 ({league === 'central' ? 'パ・リーグ' : 'セ・リーグ'})
                </td>
              </tr>
            )}
            
            {/* Interleague Teams */}
            {sortedOpponents
              .filter(opponent => otherLeagueTeams.includes(opponent.opponent))
              .map((opponent, i) => (
                <tr key={opponent.opponent} className={i % 2 === 0 ? "bg-black/10" : "bg-black/20"}>
                  <td className="p-3 sticky left-0 bg-inherit">
                    <Link
                      href={`/teams/${year}/${opponent.opponent}`}
                      className="font-medium text-white hover:text-purple-400 transition-colors flex items-center gap-2"
                      onClick={() => handleOpponentClick(opponent.opponent)}
                    >
                      {teamNames[opponent.opponent]?.short || opponent.opponent}
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </Link>
                  </td>
                  <td className="p-3 text-center text-green-400 font-medium">
                    {opponent.W}
                  </td>
                  <td className="p-3 text-center text-red-400 font-medium">
                    {opponent.L}
                  </td>
                  <td className="p-3 text-center text-yellow-400 font-medium">
                    {opponent.D || 0}
                  </td>
                  <td className={`p-3 text-center font-medium ${getRecordColor(opponent.W, opponent.L, opponent.D)}`}>
                    {getWinPct(opponent.W, opponent.L, opponent.D)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      
      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-white/10 text-xs text-slate-400">
        <p>
          総対戦: {vsOpponents.reduce((acc, opp) => acc + opp.W + opp.L + opp.D, 0)}試合 |
          勝率: {getWinPct(
            vsOpponents.reduce((acc, opp) => acc + opp.W, 0),
            vsOpponents.reduce((acc, opp) => acc + opp.L, 0),
            vsOpponents.reduce((acc, opp) => acc + opp.D, 0)
          )}
        </p>
      </div>
    </div>
  );
}