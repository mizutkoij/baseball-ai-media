'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, Search, Filter, Users, User, Trash2, Star, TrendingUp, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePersonalization } from '@/hooks/usePersonalization';
import FavoriteButton from '@/components/FavoriteButton';
import AuthModal from '@/components/AuthModal';

// Mock data for favorites (in production, this would come from API)
const mockFavoritePlayers = [
  {
    id: 'player_1',
    name: '山田哲人',
    team: 'ヤクルト',
    position: '内野手',
    stats: { avg: .285, hr: 24, rbi: 78 },
    lastUpdate: '2024-08-15',
    trend: 'up'
  },
  {
    id: 'player_2', 
    name: '村上宗隆',
    team: 'ヤクルト',
    position: '内野手',
    stats: { avg: .272, hr: 31, rbi: 89 },
    lastUpdate: '2024-08-15',
    trend: 'down'
  }
];

const mockFavoriteTeams = [
  {
    id: 'team_swallows',
    name: '東京ヤクルトスワローズ',
    league: 'セ・リーグ',
    rank: 2,
    stats: { wins: 65, losses: 58, games: 123 },
    lastUpdate: '2024-08-15',
    trend: 'up'
  }
];

export default function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<'players' | 'teams'>('players');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const { authState } = useAuth();
  const { personalization, hasFavorites, isLoaded } = usePersonalization();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-black/20 rounded-lg h-32"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">お気に入り管理</h1>
            <p className="text-xl text-slate-400 mb-8">
              選手やチームをお気に入りに追加して、最新情報を追跡しよう
            </p>
            
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">お気に入り機能でできること</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-white mb-1">選手の追跡</h4>
                    <p className="text-sm text-slate-400">お気に入り選手の最新成績と記録を自動更新</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-white mb-1">チーム情報</h4>
                    <p className="text-sm text-slate-400">応援チームの順位・試合結果をダッシュボードに表示</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-white mb-1">パフォーマンス分析</h4>
                    <p className="text-sm text-slate-400">成績トレンドとハイライトを個別に分析</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-yellow-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-white mb-1">試合アラート</h4>
                    <p className="text-sm text-slate-400">お気に入りが出場する試合の開始通知</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-8 py-3 rounded-lg transition-all duration-200"
            >
              ログインしてお気に入りを管理
            </button>
          </div>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode="login"
        />
      </div>
    );
  }

  const filteredPlayers = mockFavoritePlayers.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTeams = mockFavoriteTeams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.league.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-400 to-pink-500 bg-clip-text text-transparent">
                お気に入り管理
              </h1>
              <p className="text-slate-400">あなたがフォローしている選手・チーム</p>
            </div>
          </div>
          
          {/* Summary Stats */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{personalization.favoritePlayers.length}</div>
                <div className="text-sm text-slate-400">お気に入り選手</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{personalization.favoriteTeams.length}</div>
                <div className="text-sm text-slate-400">お気に入りチーム</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">12</div>
                <div className="text-sm text-slate-400">今日の更新</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">3</div>
                <div className="text-sm text-slate-400">今日の試合</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="選手名・チーム名で検索"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            {/* Tab Selection */}
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-1">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('players')}
                  className={`px-6 py-2 rounded-md transition-all ${
                    activeTab === 'players'
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    選手 ({mockFavoritePlayers.length})
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('teams')}
                  className={`px-6 py-2 rounded-md transition-all ${
                    activeTab === 'teams'
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    チーム ({mockFavoriteTeams.length})
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'players' && (
          <div className="space-y-6">
            {filteredPlayers.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-16 h-16 text-slate-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-white mb-2">お気に入り選手がいません</h3>
                <p className="text-slate-400 mb-6">選手ページでハートボタンをクリックしてお気に入りに追加しましょう</p>
                <Link
                  href="/players"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 inline-flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  選手を探す
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlayers.map((player) => (
                  <div key={player.id} className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="p-6">
                      {/* Player Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <Link href={`/players/${player.id}`} className="hover:text-blue-400 transition-colors">
                            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                              {player.name}
                            </h3>
                          </Link>
                          <p className="text-slate-400 text-sm">{player.team} • {player.position}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${player.trend === 'up' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <FavoriteButton
                            type="player"
                            id={player.id}
                            name={player.name}
                            size="sm"
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center bg-black/20 rounded p-2">
                          <div className="text-lg font-bold text-blue-400">{player.stats.avg.toFixed(3)}</div>
                          <div className="text-xs text-slate-400">打率</div>
                        </div>
                        <div className="text-center bg-black/20 rounded p-2">
                          <div className="text-lg font-bold text-green-400">{player.stats.hr}</div>
                          <div className="text-xs text-slate-400">本塁打</div>
                        </div>
                        <div className="text-center bg-black/20 rounded p-2">
                          <div className="text-lg font-bold text-purple-400">{player.stats.rbi}</div>
                          <div className="text-xs text-slate-400">打点</div>
                        </div>
                      </div>

                      {/* Last Update */}
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>最終更新: {new Date(player.lastUpdate).toLocaleDateString('ja-JP')}</span>
                        <div className="flex items-center gap-1">
                          <TrendingUp className={`w-3 h-3 ${player.trend === 'up' ? 'text-green-400' : 'text-red-400'}`} />
                          <span className={player.trend === 'up' ? 'text-green-400' : 'text-red-400'}>
                            {player.trend === 'up' ? '好調' : '不調'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-black/10 p-4 border-t border-white/10">
                      <div className="flex gap-2">
                        <Link
                          href={`/players/${player.id}`}
                          className="flex-1 text-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          詳細を見る
                        </Link>
                        <Link
                          href={`/players/${player.id}?view=savant`}
                          className="flex-1 text-center py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
                        >
                          分析データ
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="space-y-6">
            {filteredTeams.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-white mb-2">お気に入りチームがありません</h3>
                <p className="text-slate-400 mb-6">チームページでハートボタンをクリックしてお気に入りに追加しましょう</p>
                <Link
                  href="/teams"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 inline-flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  チームを探す
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredTeams.map((team) => (
                  <div key={team.id} className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="p-6">
                      {/* Team Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <Link href={`/teams/${team.id}`} className="hover:text-blue-400 transition-colors">
                            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                              {team.name}
                            </h3>
                          </Link>
                          <p className="text-slate-400 text-sm">{team.league}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            team.rank <= 3 ? 'bg-green-500/20 text-green-400' :
                            team.rank <= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {team.rank}位
                          </div>
                          <FavoriteButton
                            type="team"
                            id={team.id}
                            name={team.name}
                            size="sm"
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center bg-black/20 rounded p-2">
                          <div className="text-lg font-bold text-green-400">{team.stats.wins}</div>
                          <div className="text-xs text-slate-400">勝利</div>
                        </div>
                        <div className="text-center bg-black/20 rounded p-2">
                          <div className="text-lg font-bold text-red-400">{team.stats.losses}</div>
                          <div className="text-xs text-slate-400">敗北</div>
                        </div>
                        <div className="text-center bg-black/20 rounded p-2">
                          <div className="text-lg font-bold text-blue-400">
                            {(team.stats.wins / team.stats.games * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-slate-400">勝率</div>
                        </div>
                      </div>

                      {/* Last Update */}
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>最終更新: {new Date(team.lastUpdate).toLocaleDateString('ja-JP')}</span>
                        <div className="flex items-center gap-1">
                          <TrendingUp className={`w-3 h-3 ${team.trend === 'up' ? 'text-green-400' : 'text-red-400'}`} />
                          <span className={team.trend === 'up' ? 'text-green-400' : 'text-red-400'}>
                            {team.trend === 'up' ? '上昇' : '下降'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-black/10 p-4 border-t border-white/10">
                      <div className="flex gap-2">
                        <Link
                          href={`/teams/${team.id}`}
                          className="flex-1 text-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          詳細を見る
                        </Link>
                        <Link
                          href={`/games?team=${team.id}`}
                          className="flex-1 text-center py-2 px-3 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                        >
                          今日の試合
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}