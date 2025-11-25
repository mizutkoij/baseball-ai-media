'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, Search, Filter, BarChart3, Zap, Crown, Globe, 
  Heart, Share2, Edit, Trash2, Eye, TrendingUp, Users,
  Settings, Star, Clock, Award, Trophy
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { LeaderboardBuilderProvider, useLeaderboardBuilder } from '@/lib/leaderboard-builder';
import AuthModal from '@/components/AuthModal';

function LeaderboardsContent() {
  const [activeTab, setActiveTab] = useState<'public' | 'mine' | 'create'>('public');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const { authState } = useAuth();
  const {
    userLeaderboards,
    publicLeaderboards,
    availableMetrics,
    isLoading,
    getLeaderboardResult,
    likeLeaderboard,
    deleteLeaderboard
  } = useLeaderboardBuilder();

  const handleLikeLeaderboard = async (id: string) => {
    if (!authState.isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    await likeLeaderboard(id);
  };

  const handleDeleteLeaderboard = async (id: string) => {
    if (confirm('このリーダーボードを削除してもよろしいですか？')) {
      await deleteLeaderboard(id);
    }
  };

  const filteredPublicLeaderboards = publicLeaderboards.filter(lb =>
    lb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lb.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lb.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredUserLeaderboards = userLeaderboards.filter(lb =>
    lb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lb.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                カスタムリーダーボード
              </h1>
              <p className="text-slate-400">自分だけのランキングを作成・共有</p>
            </div>
          </div>
          
          {/* Feature Highlights */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-2">完全カスタマイズ</h3>
                <p className="text-sm text-slate-400">指標・フィルター・表示設定を自由に組み合わせ</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-2">簡単共有</h3>
                <p className="text-sm text-slate-400">作成したランキングをワンクリックで共有</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-2">リアルタイム更新</h3>
                <p className="text-sm text-slate-400">最新データで自動更新される動的ランキング</p>
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
                placeholder="リーダーボードを検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            {/* Tab Selection */}
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-1">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('public')}
                  className={`px-6 py-2 rounded-md transition-all ${
                    activeTab === 'public'
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    人気ランキング
                  </div>
                </button>
                {authState.isAuthenticated && (
                  <button
                    onClick={() => setActiveTab('mine')}
                    className={`px-6 py-2 rounded-md transition-all ${
                      activeTab === 'mine'
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      マイランキング ({userLeaderboards.length})
                    </div>
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!authState.isAuthenticated) {
                      setShowAuthModal(true);
                      return;
                    }
                    setActiveTab('create');
                  }}
                  className={`px-6 py-2 rounded-md transition-all ${
                    activeTab === 'create'
                      ? 'bg-green-500 text-white'
                      : 'text-slate-400 hover:text-white bg-green-500/10 hover:bg-green-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    作成
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'public' && (
          <div className="space-y-6">
            {filteredPublicLeaderboards.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-white mb-2">リーダーボードが見つかりません</h3>
                <p className="text-slate-400">検索条件を変更するか、新しいリーダーボードを作成してください</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPublicLeaderboards.map((leaderboard) => (
                  <div key={leaderboard.id} className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <Link href={`/leaderboards/${leaderboard.id}`} className="hover:text-blue-400 transition-colors">
                            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-1">
                              {leaderboard.name}
                            </h3>
                          </Link>
                          <p className="text-slate-400 text-sm line-clamp-2">{leaderboard.description}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleLikeLeaderboard(leaderboard.id)}
                            className="flex items-center gap-1 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Heart className="w-4 h-4" />
                            <span className="text-xs">{leaderboard.likes}</span>
                          </button>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-xs text-slate-400">主要指標:</div>
                          <div className="text-sm font-medium text-blue-400">
                            {availableMetrics.find(m => m.id === leaderboard.primaryMetric)?.name || leaderboard.primaryMetric}
                          </div>
                        </div>
                        {leaderboard.secondaryMetrics.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {leaderboard.secondaryMetrics.slice(0, 3).map((metric) => (
                              <span key={metric} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                                {availableMetrics.find(m => m.id === metric)?.name || metric}
                              </span>
                            ))}
                            {leaderboard.secondaryMetrics.length > 3 && (
                              <span className="text-xs text-slate-400">+{leaderboard.secondaryMetrics.length - 3}他</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {leaderboard.tags.length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-1">
                            {leaderboard.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="bg-black/20 rounded p-2">
                          <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                            <Eye className="w-3 h-3" />
                            <span className="text-xs">閲覧数</span>
                          </div>
                          <div className="text-sm font-bold text-white">{leaderboard.views.toLocaleString()}</div>
                        </div>
                        <div className="bg-black/20 rounded p-2">
                          <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                            <Clock className="w-3 h-3" />
                            <span className="text-xs">更新</span>
                          </div>
                          <div className="text-sm font-bold text-white">
                            {new Date(leaderboard.updatedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-black/10 p-4 border-t border-white/10">
                      <div className="flex gap-2">
                        <Link
                          href={`/leaderboards/${leaderboard.id}`}
                          className="flex-1 text-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          ランキングを見る
                        </Link>
                        <button className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors">
                          <Share2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'mine' && authState.isAuthenticated && (
          <div className="space-y-6">
            {filteredUserLeaderboards.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-white mb-2">マイリーダーボードがありません</h3>
                <p className="text-slate-400 mb-6">新しいリーダーボードを作成しましょう</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  リーダーボード作成
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUserLeaderboards.map((leaderboard) => (
                  <div key={leaderboard.id} className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <Link href={`/leaderboards/${leaderboard.id}`} className="hover:text-blue-400 transition-colors">
                            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-1">
                              {leaderboard.name}
                            </h3>
                          </Link>
                          <p className="text-slate-400 text-sm line-clamp-2">{leaderboard.description}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <button className="p-1 text-slate-400 hover:text-blue-400 transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteLeaderboard(leaderboard.id)}
                            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Visibility & Stats */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {leaderboard.isPublic ? (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              公開中
                            </span>
                          ) : (
                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                              非公開
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {leaderboard.views} 閲覧 • {leaderboard.likes} いいね
                        </div>
                      </div>

                      {/* Metrics Info */}
                      <div className="text-sm text-slate-400 mb-4">
                        主要指標: <span className="text-blue-400">
                          {availableMetrics.find(m => m.id === leaderboard.primaryMetric)?.name || leaderboard.primaryMetric}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        作成: {new Date(leaderboard.createdAt).toLocaleDateString('ja-JP')} • 
                        更新: {new Date(leaderboard.updatedAt).toLocaleDateString('ja-JP')}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-black/10 p-4 border-t border-white/10">
                      <div className="grid grid-cols-3 gap-2">
                        <Link
                          href={`/leaderboards/${leaderboard.id}`}
                          className="text-center py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          表示
                        </Link>
                        <button className="py-2 px-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors">
                          編集
                        </button>
                        <button className="py-2 px-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors">
                          <Share2 className="w-3 h-3 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">リーダーボード作成</h2>
                <p className="text-slate-400">あなただけのカスタムランキングを作成しましょう</p>
              </div>

              <div className="space-y-8">
                {/* Coming Soon Message */}
                <div className="text-center py-12 border border-dashed border-slate-600 rounded-lg">
                  <Award className="w-16 h-16 text-slate-400 mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold text-white mb-4">リーダーボード作成機能</h3>
                  <p className="text-slate-400 mb-6 max-w-md mx-auto">
                    詳細な作成フォームを実装中です。まもなく以下の機能が利用可能になります：
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-3 h-3 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white text-sm">指標選択</h4>
                        <p className="text-xs text-slate-400">打撃・投手・守備・高度指標から選択</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-green-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <Filter className="w-3 h-3 text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white text-sm">フィルター設定</h4>
                        <p className="text-xs text-slate-400">リーグ・ポジション・チーム・期間</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <Settings className="w-3 h-3 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white text-sm">表示設定</h4>
                        <p className="text-xs text-slate-400">並び順・表示件数・スタイル</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-yellow-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <Share2 className="w-3 h-3 text-yellow-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white text-sm">公開・共有</h4>
                        <p className="text-xs text-slate-400">SNSシェア・埋め込みコード</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="text-sm text-slate-400 mb-4">現在は人気のリーダーボードをお楽しみください</p>
                    <button
                      onClick={() => setActiveTab('public')}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 inline-flex items-center gap-2"
                    >
                      <Trophy className="w-4 h-4" />
                      人気ランキングを見る
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA for unauthenticated users */}
        {!authState.isAuthenticated && (
          <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-500/30 rounded-lg p-8 text-center mt-12">
            <h3 className="text-2xl font-bold text-white mb-4">カスタムリーダーボードを作成しよう！</h3>
            <p className="text-slate-300 mb-6">
              アカウントを作成して、自分だけのランキングを作成・共有・管理できます
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium px-8 py-3 rounded-lg transition-all duration-200"
            >
              無料でアカウント作成
            </button>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="register"
      />
    </div>
  );
}

export default function LeaderboardsPage() {
  return (
    <LeaderboardBuilderProvider>
      <LeaderboardsContent />
    </LeaderboardBuilderProvider>
  );
}