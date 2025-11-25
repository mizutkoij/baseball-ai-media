'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, Users, BarChart3, Calendar, Trophy, Target } from 'lucide-react';

interface EnhancedRelatedNavigationProps {
  currentPage: 'players' | 'teams' | 'games' | 'analytics';
  currentTeam?: string;
  currentPlayerId?: string;
  currentPlayerPosition?: string;
  className?: string;
}

interface NavigationBlock {
  title: string;
  description: string;
  icon: React.ReactNode;
  links: {
    label: string;
    href: string;
    description: string;
    badge?: string;
    isNew?: boolean;
    isPremium?: boolean;
  }[];
  gradient: string;
}

export default function EnhancedRelatedNavigation({
  currentPage,
  currentTeam,
  currentPlayerId,
  currentPlayerPosition,
  className = ''
}: EnhancedRelatedNavigationProps) {
  const [isVisible, setIsVisible] = useState(false);

  // スクロール検出でアナリティクス計測
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            setIsVisible(true);
            // アナリティクスイベント送信
            if (typeof window !== 'undefined' && (window as any).gtag) {
              (window as any).gtag('event', 'enhanced_related_navigation_view', {
                event_category: 'engagement',
                event_label: currentPage,
                current_team: currentTeam || 'none',
                current_player: currentPlayerId || 'none'
              });
            }
          }
        });
      },
      { threshold: 0.3 }
    );

    const element = document.getElementById('enhanced-related-navigation');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, [isVisible, currentPage, currentTeam, currentPlayerId]);

  const handleLinkClick = (link: any, blockTitle: string) => {
    // アナリティクスイベント送信
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'enhanced_related_navigation_click', {
        event_category: 'navigation',
        event_label: link.label,
        block_title: blockTitle,
        current_page: currentPage,
        link_href: link.href
      });
    }
  };

  const getPlayerNavigationBlocks = (): NavigationBlock[] => [
    {
      title: '📊 高度分析・統計',
      description: '詳細な選手データと最新の分析指標',
      icon: <BarChart3 className="w-5 h-5" />,
      gradient: 'from-blue-500 to-purple-600',
      links: [
        {
          label: '高度分析ダッシュボード',
          href: '/analytics',
          description: '137名の包括的分析データ',
          badge: 'NEW',
          isNew: true
        },
        {
          label: '個人詳細分析',
          href: currentPlayerId ? `/analytics/players/${currentPlayerId}` : '/analytics?tab=players',
          description: 'トレンド・比較・予測分析'
        },
        {
          label: 'セイバーメトリクス',
          href: currentPlayerId ? `/players/${currentPlayerId}/advanced` : '/stats/advanced',
          description: 'WAR・wRC+・FIP等の詳細指標',
          isPremium: true
        }
      ]
    },
    {
      title: '⚡ 試合・パフォーマンス',
      description: 'リアルタイムデータと成績分析',
      icon: <Calendar className="w-5 h-5" />,
      gradient: 'from-green-500 to-teal-600',
      links: [
        {
          label: '最新試合成績',
          href: currentPlayerId ? `/players/${currentPlayerId}/games` : '/games/recent',
          description: '直近10試合の詳細データ'
        },
        {
          label: '対戦別成績',
          href: currentPlayerId ? `/players/${currentPlayerId}/matchups` : '/matchups',
          description: 'チーム・投手別対戦成績'
        },
        {
          label: '球場別データ',
          href: currentPlayerId ? `/players/${currentPlayerId}/venues` : '/stats/venues',
          description: 'ホーム・ビジター・球場別成績'
        }
      ]
    },
    {
      title: '🏆 比較・ランキング',
      description: 'リーグ内での位置づけと競合分析',
      icon: <Trophy className="w-5 h-5" />,
      gradient: 'from-orange-500 to-red-600',
      links: [
        {
          label: `${currentPlayerPosition || '全'}ポジション別順位`,
          href: currentPlayerPosition ? `/rankings/position/${currentPlayerPosition}` : '/rankings',
          description: 'リーグ内での詳細順位'
        },
        {
          label: '類似選手比較',
          href: currentPlayerId ? `/compare/players?base=${currentPlayerId}` : '/compare/players',
          description: '能力・成績の類似選手分析'
        },
        {
          label: '同世代成績比較',
          href: currentPlayerId ? `/players/${currentPlayerId}/age-peers` : '/stats/age-curve',
          description: '同年代選手との比較分析'
        }
      ]
    }
  ];

  const getTeamNavigationBlocks = (): NavigationBlock[] => [
    {
      title: '📈 チーム総合分析',
      description: 'チーム全体のパフォーマンス詳細分析',
      icon: <BarChart3 className="w-5 h-5" />,
      gradient: 'from-purple-500 to-pink-600',
      links: [
        {
          label: 'チーム統計ダッシュボード',
          href: currentTeam ? `/teams/${currentTeam}` : '/teams',
          description: '打撃・投手・守備の総合データ'
        },
        {
          label: '戦力分析レポート',
          href: currentTeam ? `/teams/${currentTeam}/analysis` : '/analytics?tab=teams',
          description: 'ポジション別・年代別戦力分析'
        },
        {
          label: '年俸効率性分析',
          href: currentTeam ? `/teams/${currentTeam}/salary` : '/teams/salary-analysis',
          description: 'コストパフォーマンス詳細評価'
        }
      ]
    },
    {
      title: '⚔️ 対戦・スケジュール',
      description: 'ライバル分析と試合データ',
      icon: <Users className="w-5 h-5" />,
      gradient: 'from-green-500 to-blue-600',
      links: [
        {
          label: 'ライバルチーム分析',
          href: currentTeam ? `/matchups/team/${currentTeam}` : '/matchups/teams',
          description: '同地区・相手チーム別詳細成績'
        },
        {
          label: 'ホーム・ビジター成績',
          href: currentTeam ? `/teams/${currentTeam}/venues` : '/stats/home-away',
          description: '本拠地・遠征別パフォーマンス'
        },
        {
          label: '直近・予定試合',
          href: currentTeam ? `/games?team=${currentTeam}` : '/games',
          description: '試合結果とスケジュール'
        }
      ]
    },
    {
      title: '🎯 順位・展望',
      description: '順位争いと戦力評価',
      icon: <Target className="w-5 h-5" />,
      gradient: 'from-orange-500 to-yellow-600',
      links: [
        {
          label: '詳細順位表・展望',
          href: '/standings',
          description: 'ゲーム差・勝率・残試合分析'
        },
        {
          label: 'チーム比較ツール',
          href: currentTeam ? `/compare/teams?base=${currentTeam}` : '/compare/teams',
          description: '他チームとの詳細比較分析'
        },
        {
          label: 'プレイオフ確率',
          href: currentTeam ? `/teams/${currentTeam}/playoff-odds` : '/playoffs/probability',
          description: 'CS・日本S進出可能性分析'
        }
      ]
    }
  ];

  const getNavigationBlocks = (): NavigationBlock[] => {
    switch (currentPage) {
      case 'players':
        return getPlayerNavigationBlocks();
      case 'teams':
        return getTeamNavigationBlocks();
      default:
        return getPlayerNavigationBlocks(); // デフォルト
    }
  };

  const blocks = getNavigationBlocks();

  return (
    <div id="enhanced-related-navigation" className={`space-y-6 ${className}`}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          🔍 さらに詳しく分析
        </h2>
        <p className="text-slate-600">
          関連データと深掘り分析で、より深い洞察を得よう
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 md:grid-cols-2 grid-cols-1">
        {blocks.map((block, blockIndex) => (
          <Card 
            key={blockIndex} 
            className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white via-slate-50 to-gray-100 overflow-hidden"
          >
            <CardHeader className="pb-4 relative">
              <div className="flex items-center space-x-3 mb-3">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${block.gradient} text-white shadow-lg`}>
                  {block.icon}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                    {block.title}
                  </CardTitle>
                </div>
              </div>
              <CardDescription className="text-sm text-slate-600">
                {block.description}
              </CardDescription>
              
              {/* グラデーション装飾 */}
              <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-l ${block.gradient} opacity-10 rounded-bl-full`}></div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                {block.links.map((link, linkIndex) => (
                  <Link
                    key={linkIndex}
                    href={link.href}
                    onClick={() => handleLinkClick(link, block.title)}
                    className="group/link flex items-center justify-between p-4 rounded-xl hover:bg-white hover:shadow-md transition-all duration-200 border border-transparent hover:border-gray-200 bg-gradient-to-r from-transparent to-slate-50/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-slate-900 group-hover/link:text-blue-600 transition-colors text-sm">
                          {link.label}
                        </span>
                        
                        {link.badge && (
                          <Badge 
                            variant={link.isNew ? "default" : "secondary"}
                            className={`text-xs px-2 py-1 font-medium ${
                              link.isNew 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm' 
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {link.badge}
                          </Badge>
                        )}
                        
                        {link.isPremium && (
                          <Badge 
                            variant="outline" 
                            className="text-xs px-2 py-1 border-amber-300 text-amber-700 bg-amber-50 font-medium"
                          >
                            ⭐ PRO
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {link.description}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover/link:text-blue-600 group-hover/link:translate-x-1 transition-all duration-200 flex-shrink-0 ml-3" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 追加CTAセクション */}
      <div className="mt-10 p-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-blue-100">
        <div className="text-center">
          <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            もっと深く分析したい方へ
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            137名の選手データと包括的試合分析で、NPBをより深く理解しよう
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/analytics"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium"
            >
              <BarChart3 className="w-4 h-4" />
              高度分析ダッシュボード
            </Link>
            <Link
              href={currentPage === 'players' ? '/compare/players' : '/compare/teams'}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 px-6 py-3 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md font-medium"
            >
              <Users className="w-4 h-4" />
              {currentPage === 'players' ? '選手比較ツール' : 'チーム比較ツール'}
            </Link>
          </div>
        </div>
      </div>

      {/* パフォーマンス測定用の非表示要素 */}
      <div 
        id="enhanced-related-navigation-end" 
        className="h-px opacity-0 pointer-events-none" 
        aria-hidden="true"
      />
    </div>
  );
}