import React from 'react';
import { FileText } from 'lucide-react';
import { generatePlayerSummary, type PlayerDetail } from '@/lib/players/summary';

interface PlayerSummaryProps {
  player: {
    player_id: string;
    name: string;
    name_kana?: string;
    primary_pos: "P" | "B";
    batting?: any[];
    pitching?: any[];
    career?: {
      batting?: any;
      pitching?: any;
    };
  };
}

/**
 * 現在のPlayer型をPlayerDetail型に変換
 */
function convertToPlayerDetail(player: PlayerSummaryProps['player']): PlayerDetail {
  const convertSeasonData = (seasons: any[]) => {
    if (!seasons) return [];
    
    return seasons.map(season => ({
      year: season.年度 || season.year,
      wrc_plus: season.wRC_plus_simple || season.wRC_plus || season.wrc_plus,
      fip_minus: season.FIP_minus || season.fip_minus,
      iso: season.ISO || season.iso,
      k_minus_bb_pct: season.K_minus_BB_pct || season.k_minus_bb_pct,
      era: season.防御率 || season.era,
      ops: season.OPS || season.ops,
      avg: season.打率 || season.avg,
      hr: season.本塁打 || season.hr,
      rbi: season.打点 || season.rbi,
      sb: season.盗塁 || season.sb,
    }));
  };

  return {
    id: player.player_id,
    name: player.name,
    primary_pos: player.primary_pos === "P" ? "投手" : player.primary_pos,
    batting: convertSeasonData(player.batting || []),
    pitching: convertSeasonData(player.pitching || []),
    career_stats: {
      batting: player.career?.batting ? {
        ops: player.career.batting.OPS || player.career.batting.ops,
        avg: player.career.batting.打率 || player.career.batting.avg,
        hr: player.career.batting.本塁打 || player.career.batting.hr,
      } : undefined,
      pitching: player.career?.pitching ? {
        era: player.career.pitching.防御率 || player.career.pitching.era,
        whip: player.career.pitching.WHIP || player.career.pitching.whip,
      } : undefined,
    },
  };
}

export default function PlayerSummary({ player }: PlayerSummaryProps) {
  // プレイヤーデータを変換
  const playerDetail = convertToPlayerDetail(player);
  
  // サマリを生成
  const summary = generatePlayerSummary(playerDetail);

  // トラッキングイベント（将来の実装のための準備）
  const handleSummaryView = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'player_summary_view', {
        player_id: player.player_id,
        player_name: player.name,
        position: player.primary_pos
      });
    }
  };

  // コンポーネントがマウントされた時にトラッキングイベントを発火
  React.useEffect(() => {
    handleSummaryView();
  }, [player.player_id]);

  return (
    <div className="bg-gradient-to-r from-blue-900/20 to-green-900/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <FileText className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            選手サマリ
          </h2>
          <div className="prose prose-invert max-w-none">
            <p className="text-slate-300 leading-relaxed text-base">
              {summary}
            </p>
          </div>
          
          {/* メタ情報 */}
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>📊 NPB独自係数で分析</span>
            <span>🎯 環境補正適用済み</span>
            <span>📈 リアルタイム更新</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ローディング状態のプレースホルダー
 */
export function PlayerSummaryLoading() {
  return (
    <div className="bg-gradient-to-r from-blue-900/20 to-green-900/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <div className="w-5 h-5 bg-blue-400/20 rounded"></div>
        </div>
        <div className="flex-1">
          <div className="h-6 bg-white/10 rounded w-32 mb-3"></div>
          <div className="space-y-2 mb-4">
            <div className="h-4 bg-white/10 rounded w-full"></div>
            <div className="h-4 bg-white/10 rounded w-5/6"></div>
            <div className="h-4 bg-white/10 rounded w-4/5"></div>
            <div className="h-4 bg-white/10 rounded w-3/4"></div>
          </div>
          <div className="pt-3 border-t border-white/10 flex gap-4">
            <div className="h-3 bg-white/10 rounded w-20"></div>
            <div className="h-3 bg-white/10 rounded w-16"></div>
            <div className="h-3 bg-white/10 rounded w-18"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * エラー状態のフォールバック
 */
export function PlayerSummaryError({ playerName }: { playerName: string }) {
  return (
    <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 backdrop-blur-md border border-red-500/20 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <FileText className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white mb-3">
            選手サマリ
          </h2>
          <p className="text-slate-300 leading-relaxed text-base">
            {playerName}の分析情報を準備中です。NPB公式データを基にした詳細な統計分析を順次提供してまいります。
          </p>
          
          <div className="mt-4 pt-3 border-t border-white/10 text-xs text-slate-400">
            <span>⚠️ データ読み込みエラー</span>
          </div>
        </div>
      </div>
    </div>
  );
}