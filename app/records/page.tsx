"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Trophy, Target, Activity, TrendingUp, Medal } from "lucide-react";

type RecordData = {
  stat: string;
  stat_name: string;
  better: "high" | "low";
  type: "yearly" | "career";
  data: any;
};

type YearlyRecord = {
  player_id: string;
  name: string;
  team: string;
  value: number;
  games: number;
  pa?: number;
  ip?: number;
  year?: string;
};

type CareerRecord = {
  player_id: string;
  name: string;
  total: number;
  seasons: number;
  first_year: number;
  last_year: number;
  teams: string[];
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatNumber = (value: any, decimals = 0) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  }
  return value.toString();
};

const RecordTable = ({ 
  records, 
  type, 
  statName, 
  better 
}: { 
  records: YearlyRecord[] | CareerRecord[], 
  type: "yearly" | "career",
  statName: string,
  better: "high" | "low"
}) => {
  const getValueDecimals = (statName: string) => {
    if (statName.includes("率") || statName.includes("OPS") || statName.includes("WHIP") || statName.includes("FIP")) {
      return 3;
    }
    if (statName.includes("%")) {
      return 1;
    }
    return 0;
  };

  const decimals = getValueDecimals(statName);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-black/30 border-b border-white/20">
            <th className="text-left p-3 font-medium text-white">順位</th>
            <th className="text-left p-3 font-medium text-white">選手名</th>
            {type === "yearly" ? (
              <>
                <th className="text-left p-3 font-medium text-white">チーム</th>
                <th className="text-right p-3 font-medium text-white">年度</th>
              </>
            ) : (
              <>
                <th className="text-left p-3 font-medium text-white">主要所属</th>
                <th className="text-right p-3 font-medium text-white">期間</th>
                <th className="text-right p-3 font-medium text-white">年数</th>
              </>
            )}
            <th className="text-right p-3 font-medium text-white">{statName}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-black/10" : "bg-black/20"}>
              <td className="p-3 font-bold text-yellow-400">
                {i + 1 <= 3 ? (
                  <div className="flex items-center gap-1">
                    <Medal className="w-4 h-4" />
                    {i + 1}
                  </div>
                ) : (
                  i + 1
                )}
              </td>
              <td className="p-3">
                <Link 
                  href={`/players/${record.player_id}`}
                  className="text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  {record.name}
                </Link>
              </td>
              {type === "yearly" ? (
                <>
                  <td className="p-3 text-slate-300">{(record as YearlyRecord).team}</td>
                  <td className="p-3 text-right text-white font-medium">
                    {(record as YearlyRecord).year || "-"}
                  </td>
                </>
              ) : (
                <>
                  <td className="p-3 text-slate-300">
                    {(record as CareerRecord).teams.slice(0, 2).join(", ")}
                    {(record as CareerRecord).teams.length > 2 && "..."}
                  </td>
                  <td className="p-3 text-right text-white">
                    {(record as CareerRecord).first_year}-{(record as CareerRecord).last_year}
                  </td>
                  <td className="p-3 text-right text-slate-300">
                    {(record as CareerRecord).seasons}年
                  </td>
                </>
              )}
              <td className="p-3 text-right font-bold text-white text-lg">
                {type === "yearly" 
                  ? formatNumber((record as YearlyRecord).value, decimals)
                  : formatNumber((record as CareerRecord).total, decimals)
                }
                {statName.includes("%") && "%"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StatCard = ({ 
  title, 
  icon, 
  data, 
  type, 
  better,
  onSelect 
}: { 
  title: string;
  icon: React.ReactNode;
  data: any;
  type: "yearly" | "career";
  better: "high" | "low";
  onSelect: () => void;
}) => {
  const getTopValue = () => {
    if (type === "yearly") {
      // Get the most recent year's top performer
      const years = Object.keys(data).sort((a, b) => parseInt(b) - parseInt(a));
      if (years.length > 0) {
        const topYear = years[0];
        const topRecord = data[topYear][0];
        return { value: topRecord?.value, year: topYear, name: topRecord?.name };
      }
    } else {
      // Get the top career performer
      const topRecord = data[0];
      return { value: topRecord?.total, name: topRecord?.name };
    }
    return { value: null };
  };

  const topValue = getTopValue();

  return (
    <div 
      onClick={onSelect}
      className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-black/30 transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="text-sm text-slate-300">
        {type === "yearly" ? "年度別最高" : "通算記録"}
        {topValue.value && (
          <div className="mt-1">
            <span className="text-lg font-bold text-white">
              {formatNumber(topValue.value, title.includes("率") || title.includes("OPS") ? 3 : 0)}
            </span>
            {topValue.year && (
              <span className="text-xs text-slate-400 ml-2">({topValue.year}年)</span>
            )}
            {topValue.name && (
              <div className="text-blue-400 text-xs mt-1">{topValue.name}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function RecordsPage() {
  const [selectedCategory, setSelectedCategory] = useState<"batting" | "pitching">("batting");
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"yearly" | "career">("career");

  // Load batting records
  const battingStats = ["HR", "RBI", "H", "AVG", "OPS", "OPS_plus", "wRC_plus"];
  const pitchingStats = ["SO", "ERA", "WHIP", "FIP", "ERA_minus", "K_pct"];

  const currentStats = selectedCategory === "batting" ? battingStats : pitchingStats;
  const currentStatKey = selectedStat || currentStats[0];

  const { data: recordData, isLoading } = useSWR<RecordData>(
    `/data/players/records/${selectedCategory === "batting" ? "bat" : "pit"}_${currentStatKey}_${selectedType}.json`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 600000,
    }
  );

  useEffect(() => {
    // Reset selected stat when category changes
    setSelectedStat(null);
  }, [selectedCategory]);

  const getStatDisplayName = (stat: string) => {
    const names: Record<string, string> = {
      "HR": "本塁打", "RBI": "打点", "H": "安打数", "AVG": "打率", 
      "OPS": "OPS", "OPS_plus": "OPS+", "wRC_plus": "wRC+",
      "SO": "奪三振", "ERA": "防御率", "WHIP": "WHIP", 
      "FIP": "FIP", "ERA_minus": "ERA-", "K_pct": "奪三振率"
    };
    return names[stat] || stat;
  };

  const getStatIcon = (stat: string) => {
    if (["HR", "RBI", "H", "AVG", "OPS", "OPS_plus", "wRC_plus"].includes(stat)) {
      return <Target className="w-5 h-5 text-blue-600" />;
    }
    return <Activity className="w-5 h-5 text-red-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            ホームに戻る
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold text-white">歴代記録</h1>
          </div>
          
          <p className="text-slate-300">
            NPBの歴代記録と年度別記録を表示します。通算記録は複数年に渡る活躍、年度別記録は単年での最高成績を示します。
          </p>
        </div>

        {/* Category Tabs */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg mb-6">
          <div className="border-b border-white/20">
            <nav className="flex">
              <button
                onClick={() => setSelectedCategory("batting")}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  selectedCategory === "batting"
                    ? "border-blue-400 text-blue-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  打撃記録
                </div>
              </button>
              <button
                onClick={() => setSelectedCategory("pitching")}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  selectedCategory === "pitching"
                    ? "border-red-400 text-red-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  投球記録
                </div>
              </button>
            </nav>
          </div>

          {/* Record Type Toggle */}
          <div className="p-4 border-b border-white/20">
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedType("career")}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  selectedType === "career"
                    ? "bg-blue-600 text-white"
                    : "bg-black/20 text-slate-300 hover:bg-black/30"
                }`}
              >
                通算記録
              </button>
              <button
                onClick={() => setSelectedType("yearly")}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  selectedType === "yearly"
                    ? "bg-blue-600 text-white"
                    : "bg-black/20 text-slate-300 hover:bg-black/30"
                }`}
              >
                年度別記録
              </button>
            </div>
          </div>

          {/* Stat Selection Grid */}
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {currentStats.map((stat) => (
                <button
                  key={stat}
                  onClick={() => setSelectedStat(stat)}
                  className={`p-3 text-sm rounded-lg transition-colors text-left ${
                    (selectedStat || currentStats[0]) === stat
                      ? "bg-blue-600 text-white"
                      : "bg-black/20 text-slate-300 hover:bg-black/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {getStatIcon(stat)}
                    {getStatDisplayName(stat)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
          <div className="p-4 border-b border-white/20">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {getStatDisplayName(currentStatKey)} - {selectedType === "career" ? "通算記録" : "年度別記録"}
              {selectedType === "yearly" && (
                <span className="text-sm text-slate-400 ml-2">(各年度上位20位)</span>
              )}
            </h2>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                <p className="text-slate-400">記録を読み込み中...</p>
              </div>
            ) : recordData ? (
              selectedType === "yearly" ? (
                <div className="space-y-8">
                  {Object.entries(recordData.data)
                    .sort(([a], [b]) => parseInt(b) - parseInt(a))
                    .slice(0, 5) // Show top 5 years
                    .map(([year, records]) => (
                      <div key={year}>
                        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                          <Medal className="w-5 h-5 text-yellow-500" />
                          {year}年
                        </h3>
                        <RecordTable
                          records={(records as YearlyRecord[]).map(r => ({ ...r, year }))}
                          type="yearly"
                          statName={recordData.stat_name}
                          better={recordData.better}
                        />
                      </div>
                    ))}
                </div>
              ) : (
                <RecordTable
                  records={recordData.data as CareerRecord[]}
                  type="career"
                  statName={recordData.stat_name}
                  better={recordData.better}
                />
              )
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400">記録データが見つかりません</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-xs text-slate-400 text-center">
          <p>※ 記録は規定打席・投球回に基づいて集計されています</p>
          <p>※ OPS+, wRC+, ERA-, FIP等の指標は年別リーグ平均を基準とした相対評価です</p>
        </div>
      </div>
    </div>
  );
}