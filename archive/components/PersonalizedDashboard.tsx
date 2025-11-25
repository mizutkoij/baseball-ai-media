'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, Star, TrendingUp, Calendar, Newspaper, Zap, Plus, ChevronRight } from 'lucide-react';
import { usePersonalization } from '@/hooks/usePersonalization';

interface DashboardSectionProps {
  title: string;
  children: React.ReactNode;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
}

function DashboardSection({ title, children, action, className = "" }: DashboardSectionProps) {
  return (
    <div className={`bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {action && (
          <Link 
            href={action.href}
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {action.label}
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// モックデータ（実際の実装では API から取得）
const mockLeaderboardData = [
  { name: '山田哲人', team: 'YS', stat: 'wRC+', value: 145 },
  { name: '村上宗隆', team: 'YS', stat: 'wRC+', value: 138 },
  { name: '中野拓夢', team: 'T', stat: 'wRC+', value: 132 }
];

const mockTodayGames = [
  { id: 1, home: '巨人', away: '阪神', time: '18:00', status: 'scheduled' },
  { id: 2, home: 'ヤクルト', away: '広島', time: '18:00', status: 'scheduled' }
];

const mockArticles = [
  { id: 1, title: 'NPB 2025シーズン序盤の注目選手', slug: 'npb-2025-breakout-players' },
  { id: 2, title: 'セイバーメトリクスで見る投手成績', slug: 'pitcher-analytics-2025' }
];

export default function PersonalizedDashboard() {
  const {
    personalization,
    isLoaded,
    hasFavorites,
    getDashboardConfig,
    setPreferredLeague,
    toggleFavoritePlayer,
    toggleFavoriteTeam
  } = usePersonalization();

  const [showSettings, setShowSettings] = useState(false);
  const config = getDashboardConfig();

  if (!isLoaded) {
    return (
      <div className="animate-pulse space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-black/20 rounded-lg h-48"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {hasFavorites ? 'あなたの野球ダッシュボード' : 'NPB野球ダッシュボード'}
          </h2>
          <p className="text-slate-400">
            {hasFavorites 
              ? `お気に入り ${config.favoriteCount} 件を追跡中`
              : 'お気に入りの選手・チームを追加してカスタマイズしましょう'
            }
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
          設定
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <DashboardSection title="ダッシュボード設定" className="border-blue-500/30">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">優先リーグ</label>
              <select
                value={personalization.preferredLeague}
                onChange={(e) => setPreferredLeague(e.target.value as any)}
                className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white"
              >
                <option value="npb">🇯🇵 NPB</option>
                <option value="mlb">🇺🇸 MLB</option>
                <option value="kbo">🇰🇷 KBO</option>
                <option value="international">🌍 国際比較</option>
              </select>
            </div>
            
            <div className="pt-4 border-t border-white/10">
              <div className="text-sm text-slate-400 mb-2">表示セクション</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="checkbox" defaultChecked className="rounded" />
                  今日の試合
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="checkbox" defaultChecked className="rounded" />
                  リーダーボード
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="checkbox" defaultChecked={hasFavorites} className="rounded" />
                  お気に入り更新
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="checkbox" defaultChecked className="rounded" />
                  最新記事
                </label>
              </div>
            </div>
          </div>
        </DashboardSection>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Today's Games */}
        {config.showTodayGames && (
          <DashboardSection 
            title="今日の試合" 
            action={{ label: 'すべて見る', href: '/games' }}
          >
            {mockTodayGames.length > 0 ? (
              <div className="space-y-3">
                {mockTodayGames.map((game) => (
                  <div key={game.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-white font-medium">
                        {game.away} vs {game.home}
                      </span>
                    </div>
                    <span className="text-slate-400 text-sm">{game.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                今日の試合予定はありません
              </div>
            )}
          </DashboardSection>
        )}

        {/* Leaderboard Preview */}
        {config.showLeaderboards && (
          <DashboardSection 
            title={`${personalization.preferredLeague.toUpperCase()} リーダーボード`}
            action={{ label: 'ランキング', href: '/rankings' }}
          >
            <div className="space-y-3">
              {mockLeaderboardData.map((player, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center text-sm font-bold text-black">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-white font-medium">{player.name}</div>
                      <div className="text-xs text-slate-400">{player.team}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">{player.value}</div>
                    <div className="text-xs text-slate-400">{player.stat}</div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSection>
        )}

        {/* Favorites Updates */}
        {config.showFavoriteUpdates && (
          <DashboardSection 
            title="お気に入り更新" 
            action={{ label: 'すべて見る', href: '/players' }}
          >
            <div className="text-center py-8">
              <Star className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <p className="text-white font-medium mb-2">お気に入り選手の最新成績</p>
              <p className="text-slate-400 text-sm">
                お気に入りに追加した選手の試合結果や成績更新をここに表示
              </p>
            </div>
          </DashboardSection>
        )}

        {/* Recent Articles */}
        {config.showRecentArticles && (
          <DashboardSection 
            title="最新記事" 
            action={{ label: 'コラム一覧', href: '/column' }}
          >
            <div className="space-y-3">
              {mockArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/column/${article.slug}`}
                  className="block p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Newspaper className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-medium mb-1 leading-tight">
                        {article.title}
                      </h4>
                      <p className="text-xs text-slate-400">
                        データ駆動型の分析記事
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </DashboardSection>
        )}

      </div>

      {/* Add Favorites CTA (if no favorites) */}
      {!hasFavorites && (
        <DashboardSection title="パーソナライゼーション" className="border-dashed border-blue-500/30">
          <div className="text-center py-6">
            <Plus className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h4 className="text-white font-medium mb-2">お気に入りを追加してカスタマイズ</h4>
            <p className="text-slate-400 text-sm mb-4">
              お気に入りの選手やチームを追加すると、専用の更新情報が表示されます
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/players"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                選手を探す
              </Link>
              <Link
                href="/teams"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
              >
                チームを選ぶ
              </Link>
            </div>
          </div>
        </DashboardSection>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/stats"
          className="flex items-center gap-3 p-4 bg-black/20 border border-white/10 rounded-lg hover:bg-black/30 transition-colors"
        >
          <TrendingUp className="w-5 h-5 text-green-400" />
          <span className="text-white text-sm font-medium">統計ハブ</span>
        </Link>
        <Link
          href="/players/compare"
          className="flex items-center gap-3 p-4 bg-black/20 border border-white/10 rounded-lg hover:bg-black/30 transition-colors"
        >
          <Zap className="w-5 h-5 text-yellow-400" />
          <span className="text-white text-sm font-medium">選手比較</span>
        </Link>
        <Link
          href="/standings"
          className="flex items-center gap-3 p-4 bg-black/20 border border-white/10 rounded-lg hover:bg-black/30 transition-colors"
        >
          <Calendar className="w-5 h-5 text-blue-400" />
          <span className="text-white text-sm font-medium">順位表</span>
        </Link>
        <Link
          href="/column"
          className="flex items-center gap-3 p-4 bg-black/20 border border-white/10 rounded-lg hover:bg-black/30 transition-colors"
        >
          <Newspaper className="w-5 h-5 text-purple-400" />
          <span className="text-white text-sm font-medium">コラム</span>
        </Link>
      </div>
    </div>
  );
}