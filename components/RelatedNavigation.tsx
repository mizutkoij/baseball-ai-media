/**
 * Related Navigation - 深掘り導線固定
 * 
 * Players/Teams末尾に「直近3試合／類似選手／同地区ライバル」を標準化
 * 内部リンク増でSEO+回遊率向上
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, Users, Trophy, Target, TrendingUp, ArrowRight } from "lucide-react";

interface RelatedItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  type: "game" | "player" | "team" | "record";
  icon?: React.ReactNode;
}

interface RelatedNavigationProps {
  type: "player" | "team";
  entityId: string;
  entityName: string;
  entityTeam?: string;
  entityDivision?: string;
}

// プレイヤー向けの関連データ生成
async function generatePlayerRelated(playerId: string, playerName: string, team?: string): Promise<{
  recentGames: RelatedItem[];
  similarPlayers: RelatedItem[];
  teamRivals: RelatedItem[];
}> {
  try {
    // 実際のAPIは将来実装予定
    // const response = await fetch(`/api/related/player/${playerId}`);
    
    // フォールバック: モックデータ
    return {
      recentGames: [
        {
          id: "game-1",
          title: "vs 巨人",
          subtitle: "2-1(W) 2安打1打点",
          href: `/games/2024-recent-1`,
          type: "game",
          icon: <Calendar className="w-4 h-4" />
        },
        {
          id: "game-2", 
          title: "vs 阪神",
          subtitle: "1-0(L) 1安打",
          href: `/games/2024-recent-2`,
          type: "game",
          icon: <Calendar className="w-4 h-4" />
        },
        {
          id: "game-3",
          title: "vs DeNA",
          subtitle: "3-2(W) 3安打2打点",
          href: `/games/2024-recent-3`, 
          type: "game",
          icon: <Calendar className="w-4 h-4" />
        }
      ],
      similarPlayers: [
        {
          id: "similar-1",
          title: "山田哲人",
          subtitle: "セカンド, wRC+ 120",
          href: `/players/similar-1`,
          type: "player",
          icon: <Target className="w-4 h-4" />
        },
        {
          id: "similar-2",
          title: "牧秀悟", 
          subtitle: "セカンド, wRC+ 118",
          href: `/players/similar-2`,
          type: "player",
          icon: <Target className="w-4 h-4" />
        },
        {
          id: "similar-3",
          title: "近本光司",
          subtitle: "外野手, wRC+ 115", 
          href: `/players/similar-3`,
          type: "player",
          icon: <Target className="w-4 h-4" />
        }
      ],
      teamRivals: [
        {
          id: "rival-1", 
          title: "巨人戦通算成績",
          subtitle: ".285 12HR 対戦78打席",
          href: `/matchups/player-vs-team/${playerId}/giants`,
          type: "record",
          icon: <Trophy className="w-4 h-4" />
        },
        {
          id: "rival-2",
          title: "阪神戦通算成績", 
          subtitle: ".301 8HR 対戦65打席",
          href: `/matchups/player-vs-team/${playerId}/tigers`,
          type: "record",
          icon: <Trophy className="w-4 h-4" />
        },
        {
          id: "rival-3",
          title: "DeNA戦通算成績",
          subtitle: ".267 6HR 対戦58打席", 
          href: `/matchups/player-vs-team/${playerId}/baystars`,
          type: "record",
          icon: <Trophy className="w-4 h-4" />
        }
      ]
    };
  } catch (error) {
    console.warn("Failed to generate player related data:", error);
    return { recentGames: [], similarPlayers: [], teamRivals: [] };
  }
}

// チーム向けの関連データ生成
async function generateTeamRelated(teamId: string, teamName: string, division?: string): Promise<{
  recentGames: RelatedItem[];
  rivalTeams: RelatedItem[];
  topPlayers: RelatedItem[];
}> {
  try {
    // 実際のAPIは将来実装予定
    // const response = await fetch(`/api/related/team/${teamId}`);
    
    // フォールバック: モックデータ
    return {
      recentGames: [
        {
          id: "team-game-1",
          title: "vs 巨人", 
          subtitle: "6-3(W) 村上2HR",
          href: `/games/team-recent-1`,
          type: "game",
          icon: <Calendar className="w-4 h-4" />
        },
        {
          id: "team-game-2",
          title: "vs 阪神",
          subtitle: "2-4(L) 投手陣踏ん張り",
          href: `/games/team-recent-2`, 
          type: "game",
          icon: <Calendar className="w-4 h-4" />
        },
        {
          id: "team-game-3",
          title: "vs DeNA",
          subtitle: "5-1(W) 打線爆発",
          href: `/games/team-recent-3`,
          type: "game", 
          icon: <Calendar className="w-4 h-4" />
        }
      ],
      rivalTeams: [
        {
          id: "rival-team-1",
          title: "vs 巨人 (伝統の一戦)",
          subtitle: "今季5勝3敗 .625",
          href: `/matchups/team-vs-team/${teamId}/giants`,
          type: "team",
          icon: <Users className="w-4 h-4" />
        },
        {
          id: "rival-team-2", 
          title: "vs 阪神 (セ・リーグ)",
          subtitle: "今季4勝4敗 .500",
          href: `/matchups/team-vs-team/${teamId}/tigers`,
          type: "team",
          icon: <Users className="w-4 h-4" />
        },
        {
          id: "rival-team-3",
          title: "vs DeNA (同地区)",
          subtitle: "今季6勝2敗 .750", 
          href: `/matchups/team-vs-team/${teamId}/baystars`,
          type: "team",
          icon: <Users className="w-4 h-4" />
        }
      ],
      topPlayers: [
        {
          id: "top-player-1",
          title: "村上宗隆",
          subtitle: "wRC+ 145, 25HR",
          href: `/players/top-player-1`,
          type: "player",
          icon: <TrendingUp className="w-4 h-4" />
        },
        {
          id: "top-player-2",
          title: "山田哲人", 
          subtitle: "wRC+ 128, 18HR",
          href: `/players/top-player-2`,
          type: "player",
          icon: <TrendingUp className="w-4 h-4" />
        },
        {
          id: "top-player-3",
          title: "奥川恭伸",
          subtitle: "ERA 2.45, FIP 2.89",
          href: `/players/top-player-3`,
          type: "player", 
          icon: <TrendingUp className="w-4 h-4" />
        }
      ]
    };
  } catch (error) {
    console.warn("Failed to generate team related data:", error);
    return { recentGames: [], rivalTeams: [], topPlayers: [] };
  }
}

function RelatedSection({ 
  title, 
  items, 
  icon, 
  color = "blue" 
}: { 
  title: string; 
  items: RelatedItem[]; 
  icon: React.ReactNode;
  color?: "blue" | "green" | "amber" | "purple";
}) {
  const colorClasses = {
    blue: "border-blue-400/50 bg-blue-950/20",
    green: "border-green-400/50 bg-green-950/20", 
    amber: "border-amber-400/50 bg-amber-950/20",
    purple: "border-purple-400/50 bg-purple-950/20"
  };

  if (items.length === 0) return null;

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-semibold text-white text-sm">{title}</h3>
      </div>
      
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block group hover:bg-white/5 rounded p-2 -m-2 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {item.icon}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors truncate">
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
                  )}
                </div>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function RelatedNavigation({ 
  type, 
  entityId, 
  entityName, 
  entityTeam, 
  entityDivision 
}: RelatedNavigationProps) {
  const [relatedData, setRelatedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRelatedData = async () => {
      try {
        if (type === "player") {
          const data = await generatePlayerRelated(entityId, entityName, entityTeam);
          setRelatedData(data);
        } else {
          const data = await generateTeamRelated(entityId, entityName, entityDivision);
          setRelatedData(data);
        }
      } catch (error) {
        console.error("Failed to fetch related data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRelatedData();
  }, [type, entityId, entityName, entityTeam, entityDivision]);

  if (isLoading) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">関連情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-700/30 rounded-lg p-4 h-32"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!relatedData) return null;

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-bold text-white">関連情報</h2>
        <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 font-medium">
          深掘り導線
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {type === "player" ? (
          <>
            <RelatedSection
              title="直近3試合"
              items={relatedData.recentGames}
              icon={<Calendar className="w-5 h-5 text-blue-400" />}
              color="blue"
            />
            <RelatedSection
              title="類似選手"
              items={relatedData.similarPlayers}
              icon={<Target className="w-5 h-5 text-green-400" />}
              color="green"
            />
            <RelatedSection
              title="対戦成績"
              items={relatedData.teamRivals}
              icon={<Trophy className="w-5 h-5 text-amber-400" />}
              color="amber"
            />
          </>
        ) : (
          <>
            <RelatedSection
              title="直近3試合"
              items={relatedData.recentGames}
              icon={<Calendar className="w-5 h-5 text-blue-400" />}
              color="blue"
            />
            <RelatedSection
              title="ライバルチーム"
              items={relatedData.rivalTeams}
              icon={<Users className="w-5 h-5 text-purple-400" />}
              color="purple"
            />
            <RelatedSection
              title="注目選手"
              items={relatedData.topPlayers}
              icon={<TrendingUp className="w-5 h-5 text-green-400" />}
              color="green"
            />
          </>
        )}
      </div>
      
      {/* 追加CTA */}
      <div className="mt-6 flex justify-center">
        <Link
          href={type === "player" ? "/players" : "/teams"}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
        >
          <TrendingUp className="w-4 h-4" />
          {type === "player" ? "他の選手を探す" : "他のチームを見る"}
        </Link>
      </div>
    </div>
  );
}