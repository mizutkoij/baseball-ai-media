"use client";

import { TrendingUp, Award, Users, BarChart3 } from "lucide-react";

// 型定義
type WarRow = {
  season: number;
  player_id: string;
  player_name?: string;
  team?: string;
  WAR_total: number;
  WAR_batting?: number;
  WAR_pitching?: number;
  war_rank?: number;
};

interface WarLeadersCardProps {
  data: WarRow[];
}

// WAR値に基づく色分け
function getWarColor(war: number): string {
  if (war >= 6.0) return "text-yellow-400"; // MVP級
  if (war >= 4.0) return "text-emerald-400"; // オールスター級
  if (war >= 2.0) return "text-blue-400";    // レギュラー級
  if (war >= 0.0) return "text-white";       // 平均以上
  return "text-red-400";                     // 平均以下
}

// WAR値のバッジ
function WarBadge({ war }: { war: number }) {
  let badge = "";
  let badgeColor = "";
  
  if (war >= 6.0) {
    badge = "MVP";
    badgeColor = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  } else if (war >= 4.0) {
    badge = "AS";
    badgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  } else if (war >= 2.0) {
    badge = "REG";
    badgeColor = "bg-blue-500/20 text-blue-400 border-blue-500/30";
  }
  
  if (!badge) return null;
  
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${badgeColor}`}>
      {badge}
    </span>
  );
}

// 統計サマリー
function StatsSummary({ data }: { data: WarRow[] }) {
  const totalPlayers = data.length;
  const avgWar = data.reduce((sum, p) => sum + p.WAR_total, 0) / totalPlayers;
  const topWar = Math.max(...data.map(p => p.WAR_total));
  const mvpCandidates = data.filter(p => p.WAR_total >= 4.0).length;
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div className="flex items-center space-x-2">
        <Users className="w-4 h-4 text-slate-400" />
        <div>
          <p className="text-xs text-slate-400">選手数</p>
          <p className="font-semibold">{totalPlayers}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        <div>
          <p className="text-xs text-slate-400">平均WAR</p>
          <p className="font-semibold">{avgWar.toFixed(1)}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Award className="w-4 h-4 text-yellow-400" />
        <div>
          <p className="text-xs text-slate-400">最高WAR</p>
          <p className="font-semibold text-yellow-400">{topWar.toFixed(1)}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <BarChart3 className="w-4 h-4 text-emerald-400" />
        <div>
          <p className="text-xs text-slate-400">MVP候補</p>
          <p className="font-semibold text-emerald-400">{mvpCandidates}</p>
        </div>
      </div>
    </div>
  );
}

export default function WarLeadersCard({ data }: WarLeadersCardProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold">WAR Leaders (Neutral)</h2>
        </div>
        <div className="text-center py-8 text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold">WAR Leaders</h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
            中立化指標
          </span>
          <span className="text-xs text-slate-400">
            球場補正適用
          </span>
        </div>
      </div>

      {/* 統計サマリー */}
      <StatsSummary data={data} />

      {/* ランキングテーブル */}
      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-slate-300">
              <th className="text-left p-3 font-medium">#</th>
              <th className="text-left p-3 font-medium">選手名</th>
              <th className="text-right p-3 font-medium">WAR</th>
              <th className="text-right p-3 font-medium">打撃</th>
              <th className="text-right p-3 font-medium">投手</th>
              <th className="text-left p-3 font-medium">チーム</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {data.map((player, index) => (
              <tr 
                key={`${player.season}-${player.player_id}`} 
                className="hover:bg-white/5 transition-colors duration-200"
              >
                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-300">
                      {index + 1}
                    </span>
                    {index < 3 && (
                      <div className={`w-2 h-2 rounded-full ${
                        index === 0 ? 'bg-yellow-400' : 
                        index === 1 ? 'bg-slate-300' : 'bg-amber-600'
                      }`} />
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">
                      {player.player_name || player.player_id}
                    </span>
                    <WarBadge war={player.WAR_total} />
                  </div>
                </td>
                <td className="p-3 text-right">
                  <span className={`font-bold text-lg ${getWarColor(player.WAR_total)}`}>
                    {player.WAR_total.toFixed(1)}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <span className="text-slate-300">
                    {player.WAR_batting ? player.WAR_batting.toFixed(1) : "—"}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <span className="text-slate-300">
                    {player.WAR_pitching ? player.WAR_pitching.toFixed(1) : "—"}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-slate-400 text-xs bg-white/10 px-2 py-1 rounded">
                    {player.team || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* フッター */}
      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-slate-400">
        <span>
          球場補正（Phase 7A）・中立化指標適用
        </span>
        <span>
          最終更新: {new Date().toLocaleString('ja-JP', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </div>
  );
}