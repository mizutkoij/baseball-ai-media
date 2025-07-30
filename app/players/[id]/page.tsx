"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Activity, BarChart3, Target, TrendingUp, ExternalLink } from "lucide-react";

type YearRow = Record<string, any>;

type Player = {
  player_id: string;
  name: string;
  name_kana?: string;
  url?: string;
  first_year?: number;
  last_year?: number;
  primary_pos: "P" | "B";
  is_active: boolean;
  active_source: string;
  batting: YearRow[];
  pitching: YearRow[];
  career: {
    batting: Record<string, any>;
    pitching: Record<string, any>;
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatNumber = (value: any, decimals = 0) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  }
  return value.toString();
};

const BattingTable = ({ data }: { data: YearRow[] }) => {
  if (!data || data.length === 0) return <div className="text-slate-400 text-center py-8">打撃データがありません</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-black/30 border-b border-white/20">
            <th className="text-left p-2 font-medium text-white">年度</th>
            <th className="text-left p-2 font-medium text-white">チーム</th>
            <th className="text-right p-2 font-medium text-white">試合</th>
            <th className="text-right p-2 font-medium text-white">打席</th>
            <th className="text-right p-2 font-medium text-white">打数</th>
            <th className="text-right p-2 font-medium text-white">安打</th>
            <th className="text-right p-2 font-medium text-white">HR</th>
            <th className="text-right p-2 font-medium text-white">打点</th>
            <th className="text-right p-2 font-medium text-white">打率</th>
            <th className="text-right p-2 font-medium text-white">OPS</th>
            <th className="text-right p-2 font-medium text-white">OPS+</th>
            <th className="text-right p-2 font-medium text-white">wRC+</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-black/10" : "bg-black/20"}>
              <td className="p-2 font-medium text-white">{row.年度}</td>
              <td className="p-2 text-slate-300">{row.所属球団 || "-"}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.試合)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.打席)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.打数)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.安打)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.本塁打)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.打点)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.打率, 3)}</td>
              <td className="p-2 text-right font-medium text-white">{formatNumber(row.OPS, 3)}</td>
              <td className="p-2 text-right text-blue-400 font-medium">{formatNumber(row.OPS_plus_simple)}</td>
              <td className="p-2 text-right text-green-400 font-medium">{formatNumber(row.wRC_plus_simple)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PitchingTable = ({ data }: { data: YearRow[] }) => {
  if (!data || data.length === 0) return <div className="text-slate-400 text-center py-8">投球データがありません</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-black/30 border-b border-white/20">
            <th className="text-left p-2 font-medium text-white">年度</th>
            <th className="text-left p-2 font-medium text-white">チーム</th>
            <th className="text-right p-2 font-medium text-white">登板</th>
            <th className="text-right p-2 font-medium text-white">勝</th>
            <th className="text-right p-2 font-medium text-white">敗</th>
            <th className="text-right p-2 font-medium text-white">投球回</th>
            <th className="text-right p-2 font-medium text-white">奪三振</th>
            <th className="text-right p-2 font-medium text-white">防御率</th>
            <th className="text-right p-2 font-medium text-white">WHIP</th>
            <th className="text-right p-2 font-medium text-white">FIP</th>
            <th className="text-right p-2 font-medium text-white">ERA-</th>
            <th className="text-right p-2 font-medium text-white">K%</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-black/10" : "bg-black/20"}>
              <td className="p-2 font-medium text-white">{row.年度}</td>
              <td className="p-2 text-slate-300">{row.所属球団 || "-"}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.登板)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.勝利)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.敗北)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.IP_float, 1)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.三振)}</td>
              <td className="p-2 text-right text-slate-300">{formatNumber(row.防御率, 2)}</td>
              <td className="p-2 text-right font-medium text-white">{formatNumber(row.WHIP, 3)}</td>
              <td className="p-2 text-right text-blue-400 font-medium">{formatNumber(row.FIP, 2)}</td>
              <td className="p-2 text-right text-green-400 font-medium">{formatNumber(row.ERA_minus)}</td>
              <td className="p-2 text-right text-purple-400 font-medium">{formatNumber(row.K_pct, 1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function PlayerDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<"batting" | "pitching">("batting");

  const { data: player, isLoading, error } = useSWR<Player>(
    `/data/players/players/${params.id}.json`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 600000, // 10分間キャッシュ
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-6 w-64"></div>
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <div className="h-4 bg-slate-600 rounded mb-4 w-full"></div>
              <div className="h-4 bg-slate-600 rounded mb-4 w-3/4"></div>
              <div className="h-4 bg-slate-600 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-4">選手が見つかりません</h1>
            <p className="text-slate-300 mb-6">指定された選手のデータが存在しないか、読み込みに失敗しました。</p>
            <Link
              href="/players"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              選手一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasBattingData = player.batting && player.batting.length > 0;
  const hasPitchingData = player.pitching && player.pitching.length > 0;

  // デフォルトタブの設定
  if (activeTab === "batting" && !hasBattingData && hasPitchingData) {
    setActiveTab("pitching");
  } else if (activeTab === "pitching" && !hasPitchingData && hasBattingData) {
    setActiveTab("batting");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 戻るボタン */}
        <div className="mb-4">
          <Link
            href="/players"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            選手一覧に戻る
          </Link>
        </div>

        {/* 選手基本情報 */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{player.name}</h1>
              {player.name_kana && (
                <p className="text-lg text-slate-300 mb-2">{player.name_kana}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-3 py-1 text-sm rounded-full font-medium ${
                    player.primary_pos === "P"
                      ? "bg-red-100 text-red-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {player.primary_pos === "P" ? "投手" : "野手"}
                </span>
                {player.is_active && (
                  <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-800 font-medium">
                    現役推定
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-medium text-white">
                {player.first_year && player.last_year
                  ? `${player.first_year} - ${player.last_year}`
                  : player.first_year
                  ? `${player.first_year} -`
                  : "期間不明"}
              </div>
              {player.url && (
                <a
                  href={player.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mt-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  NPB公式プロフィール
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 通算成績サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {hasBattingData && (
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                通算打撃成績
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">年数:</span>
                  <span className="ml-2 font-medium text-white">{player.career.batting?.年度数 || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400">試合:</span>
                  <span className="ml-2 font-medium text-white">{formatNumber(player.career.batting?.試合)}</span>
                </div>
                <div>
                  <span className="text-slate-400">安打:</span>
                  <span className="ml-2 font-medium text-white">{formatNumber(player.career.batting?.安打)}</span>
                </div>
                <div>
                  <span className="text-slate-400">本塁打:</span>
                  <span className="ml-2 font-medium text-white">{formatNumber(player.career.batting?.本塁打)}</span>
                </div>
              </div>
            </div>
          )}

          {hasPitchingData && (
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-600" />
                通算投球成績
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">年数:</span>
                  <span className="ml-2 font-medium text-white">{player.career.pitching?.年度数 || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400">登板:</span>
                  <span className="ml-2 font-medium text-white">{formatNumber(player.career.pitching?.登板)}</span>
                </div>
                <div>
                  <span className="text-slate-400">勝利:</span>
                  <span className="ml-2 font-medium text-white">{formatNumber(player.career.pitching?.勝利)}</span>
                </div>
                <div>
                  <span className="text-slate-400">奪三振:</span>
                  <span className="ml-2 font-medium text-white">{formatNumber(player.career.pitching?.奪三振)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 年度別成績 */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
          {/* タブ */}
          <div className="border-b border-white/20">
            <nav className="flex">
              {hasBattingData && (
                <button
                  onClick={() => setActiveTab("batting")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "batting"
                      ? "border-blue-400 text-blue-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    打撃成績
                  </div>
                </button>
              )}
              {hasPitchingData && (
                <button
                  onClick={() => setActiveTab("pitching")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "pitching"
                      ? "border-red-400 text-red-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    投球成績
                  </div>
                </button>
              )}
            </nav>
          </div>

          {/* テーブル */}
          <div className="p-6">
            {activeTab === "batting" ? (
              <BattingTable data={player.batting} />
            ) : (
              <PitchingTable data={player.pitching} />
            )}
          </div>
        </div>

        {/* フッター注記 */}
        <div className="mt-6 text-xs text-slate-400 text-center">
          <p>OPS+, wRC+, ERA-, FIP等の指標は年別リーグ平均を基準とした相対評価です。</p>
          <p>現役判定は最終年度に基づくヒューリスティック推定です。</p>
        </div>
      </div>
    </div>
  );
}