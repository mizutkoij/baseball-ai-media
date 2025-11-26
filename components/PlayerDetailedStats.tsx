"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface DetailedStatsProps {
  stats: any;
}

const StatSection = ({ title, data, children }: { title: string; data: any; children?: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  return (
    <div className="border border-white/20 rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-black/30 hover:bg-black/40 transition-colors"
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-white/60" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/60" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 bg-black/10">
          {children || <pre className="text-xs text-white/80 overflow-auto">{JSON.stringify(data, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
};

const StatTable = ({ data }: { data: any }) => {
  if (!data || typeof data !== 'object') return null;

  const entries = Array.isArray(data) ? data : [data];

  if (entries.length === 0) return null;

  const keys = Object.keys(entries[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-black/30 border-b border-white/20">
            {keys.map((key) => (
              <th key={key} className="text-left p-2 font-medium text-white whitespace-nowrap">
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-black/10" : "bg-black/20"}>
              {keys.map((key) => (
                <td key={key} className="p-2 text-white/90 whitespace-nowrap">
                  {row[key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function PlayerDetailedStats({ stats }: DetailedStatsProps) {
  if (!stats) {
    return (
      <div className="text-center py-8 text-white/60">
        詳細データが見つかりませんでした
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white mb-6">詳細成績</h2>

      {/* 基本情報 */}
      {stats.basic_info && (
        <StatSection title="基本情報" data={stats.basic_info}>
          <StatTable data={stats.basic_info} />
        </StatSection>
      )}

      {/* ファーム成績 */}
      {stats.farm_stats && (
        <StatSection title="ファーム成績" data={stats.farm_stats}>
          <StatTable data={stats.farm_stats} />
        </StatSection>
      )}

      {/* 状況別成績 */}
      {stats.day_night && (
        <StatSection title="Day/Nighter別成績" data={stats.day_night}>
          <StatTable data={stats.day_night} />
        </StatSection>
      )}

      {stats.home_visitor && (
        <StatSection title="Home/Visitor別成績" data={stats.home_visitor}>
          <StatTable data={stats.home_visitor} />
        </StatSection>
      )}

      {stats.count_based && (
        <StatSection title="カウント別成績" data={stats.count_based}>
          <StatTable data={stats.count_based} />
        </StatSection>
      )}

      {stats.runner_situation && (
        <StatSection title="ランナー別成績" data={stats.runner_situation}>
          <StatTable data={stats.runner_situation} />
        </StatSection>
      )}

      {stats.vs_leftright && (
        <StatSection title="対左右別成績" data={stats.vs_leftright}>
          <StatTable data={stats.vs_leftright} />
        </StatSection>
      )}

      {/* 時系列成績 */}
      {stats.monthly && (
        <StatSection title="月別成績" data={stats.monthly}>
          <StatTable data={stats.monthly} />
        </StatSection>
      )}

      {stats.weekly && (
        <StatSection title="週間成績" data={stats.weekly}>
          <StatTable data={stats.weekly} />
        </StatSection>
      )}

      {/* 対戦相手別 */}
      {stats.opponent_team_league && (
        <StatSection title="対チーム別成績（リーグ）" data={stats.opponent_team_league}>
          <StatTable data={stats.opponent_team_league} />
        </StatSection>
      )}

      {stats.opponent_team_interleague && (
        <StatSection title="対チーム別成績（交流戦）" data={stats.opponent_team_interleague}>
          <StatTable data={stats.opponent_team_interleague} />
        </StatSection>
      )}

      {stats.ballpark && (
        <StatSection title="球場別成績" data={stats.ballpark}>
          <StatTable data={stats.ballpark} />
        </StatSection>
      )}

      {/* 打撃詳細 */}
      {stats.batting_order && (
        <StatSection title="打順別成績（先発時）" data={stats.batting_order}>
          <StatTable data={stats.batting_order} />
        </StatSection>
      )}

      {stats.pitch_types && (
        <StatSection title="球種一覧" data={stats.pitch_types}>
          <StatTable data={stats.pitch_types} />
        </StatSection>
      )}

      {stats.hit_direction && (
        <StatSection title="打球方向" data={stats.hit_direction}>
          <StatTable data={stats.hit_direction} />
        </StatSection>
      )}

      {stats.hit_content && (
        <StatSection title="打撃内容一覧" data={stats.hit_content}>
          <StatTable data={stats.hit_content} />
        </StatSection>
      )}

      {/* 盗塁 */}
      {stats.stolen_base_2nd && (
        <StatSection title="盗塁状況別マトリクス - 二塁盗塁 -" data={stats.stolen_base_2nd}>
          <StatTable data={stats.stolen_base_2nd} />
        </StatSection>
      )}

      {stats.stolen_base_3rd && (
        <StatSection title="盗塁状況別マトリクス - 三塁盗塁 -" data={stats.stolen_base_3rd}>
          <StatTable data={stats.stolen_base_3rd} />
        </StatSection>
      )}

      {stats.stolen_base_home && (
        <StatSection title="盗塁状況別マトリクス - 本塁盗塁 -" data={stats.stolen_base_home}>
          <StatTable data={stats.stolen_base_home} />
        </StatSection>
      )}

      {/* その他 */}
      {stats.homerun_types && (
        <StatSection title="本塁打の種別一覧" data={stats.homerun_types}>
          <StatTable data={stats.homerun_types} />
        </StatSection>
      )}

      {stats.career_stats && (
        <StatSection title="通算成績（各種指標）" data={stats.career_stats}>
          <StatTable data={stats.career_stats} />
        </StatSection>
      )}

      {stats.registration_status && (
        <StatSection title="登録状況" data={stats.registration_status}>
          <StatTable data={stats.registration_status} />
        </StatSection>
      )}

      {stats.registration_history && (
        <StatSection title="登録履歴" data={stats.registration_history}>
          <StatTable data={stats.registration_history} />
        </StatSection>
      )}
    </div>
  );
}
