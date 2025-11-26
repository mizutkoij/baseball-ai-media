"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Head from "next/head";
import { ArrowLeft, Calendar, Users, TrendingUp, ExternalLink, Share2, BarChart3, Trophy } from "lucide-react";
import TeamHeader from "@/components/TeamHeader";
import TeamLeaders from "@/components/TeamLeaders";
import TeamSummaryKPI from "@/components/TeamSummaryKPI";
import OpponentMatrix from "@/components/OpponentMatrix";
import TeamDistribution from "@/components/TeamDistribution";
import { PromotionList } from "@/components/PromotionBadge";
import TeamSchedule from "@/components/TeamSchedule";
import TeamSplits from "@/components/TeamSplits";
import JsonLd from "@/components/JsonLd";
import { NextNav } from "@/components/NextNav";
import { ExportButton } from "@/components/ExportButton";
import RelatedNavigation from "@/components/RelatedNavigation";
import type { TeamPageData } from "@/app/api/teams/[year]/[team]/route";

interface TeamPageProps {
  params: {
    year: string;
    team: string;
  };
}

const teamNames: Record<string, string> = {
  // Central League
  'T': '阪神タイガース',
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

const TEAM_META: Record<string, { name: string; league: "セ・リーグ" | "パ・リーグ"; logo?: string }> = {
  G: { name: "読売ジャイアンツ", league: "セ・リーグ" },
  T: { name: "阪神タイガース", league: "セ・リーグ" },
  C: { name: "広島東洋カープ", league: "セ・リーグ" },
  D: { name: "中日ドラゴンズ", league: "セ・リーグ" },
  YS: { name: "横浜DeNAベイスターズ", league: "セ・リーグ" },
  S: { name: "東京ヤクルトスワローズ", league: "セ・リーグ" },
  L: { name: "埼玉西武ライオンズ", league: "パ・リーグ" },
  H: { name: "福岡ソフトバンクホークス", league: "パ・リーグ" },
  M: { name: "千葉ロッテマリーンズ", league: "パ・リーグ" },
  F: { name: "北海道日本ハムファイターズ", league: "パ・リーグ" },
  E: { name: "東北楽天ゴールデンイーグルス", league: "パ・リーグ" },
  B: { name: "オリックス・バファローズ", league: "パ・リーグ" },
};

function buildTeamJsonLd({
  site, year, teamCode, updatedAt,
  scheduleUrl, analysisUrl,
}: {
  site: string; year: number; teamCode: string; updatedAt: string;
  scheduleUrl: string; analysisUrl: string;
}) {
  const meta = TEAM_META[teamCode];
  const teamUrl = `${site}/teams/${year}/${teamCode}`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "チーム", item: `${site}/seasons/${year}` },
        { "@type": "ListItem", position: 2, name: `${meta.name}（${year}年）`, item: teamUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "SportsTeam",
      name: `${meta.name}（${year}年）`,
      sport: "Baseball",
      memberOf: { "@type": "SportsOrganization", name: `NPB ${meta.league}` },
      url: teamUrl,
      image: meta.logo,
      inLanguage: "ja-JP",
      knowsAbout: ["wRC+", "OPS+", "ERA-", "FIP-", "Park Factor"],
      hasPart: [
        { "@type": "CollectionPage", name: "スケジュール・結果", url: scheduleUrl },
        { "@type": "CollectionPage", name: "詳細分析", url: analysisUrl },
      ],
      dateModified: updatedAt,
    },
  ];
}

export default function TeamPage({ params }: TeamPageProps) {
  const [teamData, setTeamData] = useState<TeamPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'analysis'>('overview');

  const year = parseInt(params.year);
  const team = params.team;
  const teamName = teamNames[team] || team;

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/teams/${year}/${team}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch team data: ${response.statusText}`);
        }
        
        const data: TeamPageData = await response.json();
        setTeamData(data);

        // Track page view
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'team_page_view', {
            year,
            team,
            league: data.meta.league
          });
        }
        
      } catch (err) {
        console.error('Error fetching team data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load team data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamData();
  }, [year, team]);

  const shareTeamPage = async (channel: 'copy' | 'x') => {
    const url = window.location.href;
    const text = `${year}年 ${teamName} チームデータ - Baseball AI Media`;
    
    try {
      if (channel === 'copy') {
        await navigator.clipboard.writeText(url);
        // You could show a toast notification here
      } else if (channel === 'x') {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, '_blank');
      }
      
      // Track share event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'team_share_click', {
          channel,
          year,
          team
        });
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleTabSwitch = (tab: 'overview' | 'schedule' | 'analysis') => {
    setActiveTab(tab);
    
    // Track analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'team_tab_switch', {
        team,
        year,
        tab,
        from_tab: activeTab
      });
    }
  };

  // Generate meta data
  const generateMetadata = () => {
    if (!teamData) return null;
    
    const title = `${year}年 ${teamName} チームデータ｜戦績・wRC+・FIP-【Baseball AI Media】`;
    const description = `${year}年${teamName}の詳細データ。戦績${teamData.standings.W}勝${teamData.standings.L}敗・${teamData.meta.league === 'central' ? 'セ' : 'パ'}・リーグ${teamData.standings.rank}位。主力選手の成績とチーム指標を分析。`;
    const ogImageUrl = `${window.location.origin}/api/og/teams/${year}/${team}`;
    
    return { title, description, ogImageUrl };
  };

  const metadata = generateMetadata();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-6 w-64"></div>
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6">
              <div className="h-4 bg-slate-600 rounded mb-4 w-full"></div>
              <div className="h-4 bg-slate-600 rounded mb-4 w-3/4"></div>
              <div className="h-4 bg-slate-600 rounded w-1/2"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64 bg-slate-600 rounded"></div>
              <div className="h-64 bg-slate-600 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !teamData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-4">チームデータが見つかりません</h1>
            <p className="text-slate-300 mb-6">
              {error || `${year}年の${teamName}のデータが存在しないか、読み込みに失敗しました。`}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/teams"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                チーム一覧に戻る
              </Link>
              <Link
                href={`/seasons/${year}`}
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                {year}年シーズンを見る
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {metadata && (
        <Head>
          <title>{metadata.title}</title>
          <meta name="description" content={metadata.description} />
          <meta property="og:title" content={metadata.title} />
          <meta property="og:description" content={metadata.description} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={window.location.href} />
          <meta property="og:image" content={metadata.ogImageUrl} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:alt" content={metadata.title} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={metadata.title} />
          <meta name="twitter:description" content={metadata.description} />
          <meta name="twitter:image" content={metadata.ogImageUrl} />
          
          {/* JSON-LD Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "SportsTeam",
                "name": teamName,
                "sport": "野球",
                "memberOf": {
                  "@type": "SportsOrganization",
                  "name": teamData.meta.league === 'central' ? 'セントラル・リーグ' : 'パシフィック・リーグ'
                },
                "url": window.location.href,
                "foundingDate": year,
                "description": metadata.description,
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": window.location.href
                }
              })
            }}
          />
        </Head>
      )}
      
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header with Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href={`/seasons/${year}`}
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {year}年シーズンに戻る
            </Link>
            
            <div className="flex items-center gap-2">
              {/* CSV エクスポートボタン */}
              <ExportButton 
                data={teamData}
                filename={`${teamName}_${year}`}
              />
              
              <button
                onClick={() => shareTeamPage('copy')}
                className="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
              >
                <Share2 className="w-4 h-4" />
                コピー
              </button>
              <button
                onClick={() => shareTeamPage('x')}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                X で共有
              </button>
            </div>
          </div>

          {/* Team Header */}
          <TeamHeader
            year={teamData.meta.year}
            team={teamData.meta.team}
            league={teamData.meta.league}
            standings={teamData.standings}
          />

          {/* Team Summary KPIs */}
          <TeamSummaryKPI
            summary={teamData.summary}
            year={teamData.meta.year}
            team={teamData.meta.team}
          />

          {/* Tab Navigation */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-1 mb-6">
            <div className="flex">
              {[
                { key: 'overview', label: '概要', icon: Trophy },
                { key: 'schedule', label: 'スケジュール', icon: Calendar },
                { key: 'analysis', label: '詳細分析', icon: BarChart3 }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleTabSwitch(key as typeof activeTab)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-black/20'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
                  <TeamLeaders
                year={teamData.meta.year}
                team={teamData.meta.team}
                hitters={teamData.leaders.hitters}
                pitchers={teamData.leaders.pitchers}
              />

              {/* Opponent Matrix */}
              <OpponentMatrix
                year={teamData.meta.year}
                team={teamData.meta.team}
                league={teamData.meta.league}
                vsOpponents={teamData.vs_opponent}
              />

              {/* Home/Away Splits */}
              {teamData.splits && teamData.splits.length > 0 && (
                <TeamSplits
                  year={teamData.meta.year}
                  team={teamData.meta.team}
                  splits={teamData.splits}
                />
              )}

              {/* Promotion Badges */}
              {teamData.promotions && teamData.promotions.length > 0 && (
                <PromotionList
                  promotions={teamData.promotions}
                  title="昇格注目選手"
                />
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <TeamSchedule
                year={teamData.meta.year}
                team={teamData.meta.team}
              />
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-6">
              {/* Team Distribution Charts */}
              {teamData.distributions && teamData.distributions.length > 0 && (
                <TeamDistribution
                  year={teamData.meta.year}
                  team={teamData.meta.team}
                  distributions={teamData.distributions}
                />
              )}
              
              {/* Could add more advanced analysis here */}
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 text-center">
                <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">高度分析</h3>
                <p className="text-slate-400">
                  詳細な統計分析・トレンド・予測分析は今後追加予定です
                </p>
              </div>
            </div>
          )}

          {/* Cross Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Link
              href={teamData.links.season}
              className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-purple-500" />
                <div>
                  <h4 className="font-semibold text-white">{year}年シーズン</h4>
                  <p className="text-sm text-slate-400">全球団・記録・ハイライト</p>
                </div>
              </div>
            </Link>
            
            <Link
              href={teamData.links.players}
              className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-500" />
                <div>
                  <h4 className="font-semibold text-white">選手一覧</h4>
                  <p className="text-sm text-slate-400">{teamName}の全選手</p>
                </div>
              </div>
            </Link>
            
            <Link
              href={teamData.links.records}
              className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <div>
                  <h4 className="font-semibold text-white">記録・ランキング</h4>
                  <p className="text-sm text-slate-400">{year}年の記録一覧</p>
                </div>
              </div>
            </Link>
          </div>

          {/* 関連ナビゲーション - 深掘り導線固定 */}
          <div className="mt-8">
            <RelatedNavigation
              type="team"
              entityId={team}
              entityName={teamName}
              entityDivision={teamData.meta.league}
            />
          </div>

          {/* Next Navigation - Enhanced */}
          <NextNav 
            from={`teams-${year}-${team}`}
            entityType="team"
            entityId={team}
            contextualSuggestions={[
              {
                href: `/seasons/${year}`,
                label: `${year}年シーズン`,
                description: `${year}年全体の成績・記録`,
                icon: Trophy,
                priority: 10
              },
              {
                href: "/standings",
                label: "順位表",
                description: "リーグ順位・勝敗",
                icon: BarChart3,
                priority: 9
              }
            ]}
          />

          {/* JSON-LD Structured Data */}
          <JsonLd
            data={buildTeamJsonLd({
              site: process.env.NEXT_PUBLIC_SITE_URL || 'https://baseball-ai-media.vercel.app',
              year,
              teamCode: team,
              updatedAt: teamData.meta.updated_at || new Date().toISOString(),
              scheduleUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://baseball-ai-media.vercel.app'}/teams/${year}/${team}?tab=schedule`,
              analysisUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://baseball-ai-media.vercel.app'}/teams/${year}/${team}?tab=analysis`,
            })}
          />

          {/* Footer */}
          <div className="mt-8 text-xs text-slate-400 text-center space-y-1">
            <p>wRC+, FIP- 等の指標は年別リーグ平均を基準とした相対評価です。</p>
            <p>データ最終更新: {new Date(teamData.meta.updated_at || new Date()).toLocaleDateString('ja-JP')}</p>
            <p>出典: 静的データ（Vercel互換）</p>
          </div>
        </div>
      </div>
    </>
  );
}

// Note: ISR config would need to be in layout.tsx due to "use client" directive
// For now, relying on dynamic routing with client-side data fetching