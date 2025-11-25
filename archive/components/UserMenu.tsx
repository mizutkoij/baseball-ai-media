'use client';

import { useState } from 'react';
import { User, Settings, LogOut, Crown, BarChart3, Heart, Trophy, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import AuthModal from './AuthModal';

export default function UserMenu() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  
  const { authState, logout } = useAuth();

  const handleLoginClick = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const handleRegisterClick = () => {
    setAuthModalMode('register');
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    setIsDropdownOpen(false);
  };

  // Unauthenticated state
  if (!authState.isAuthenticated) {
    return (
      <>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLoginClick}
            className="text-slate-300 hover:text-white transition-colors text-sm font-medium"
          >
            ログイン
          </button>
          <button
            onClick={handleRegisterClick}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          >
            無料登録
          </button>
        </div>
        
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authModalMode}
        />
      </>
    );
  }

  // Authenticated state
  const user = authState.user!;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-3 bg-black/20 hover:bg-black/30 border border-white/10 rounded-lg px-3 py-2 transition-colors"
        >
          {/* Avatar */}
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            {user.avatar ? (
              <img src={user.avatar} alt={user.displayName} className="w-8 h-8 rounded-full" />
            ) : (
              <span className="text-white text-sm font-bold">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          
          {/* User Info */}
          <div className="hidden sm:block text-left">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">{user.displayName}</span>
              {user.isPremium && <Crown className="w-4 h-4 text-yellow-400" />}
            </div>
            <div className="text-xs text-slate-400">
              {user.stats.favoritePlayersCount + user.stats.favoriteTeamsCount} お気に入り
            </div>
          </div>

          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-white/10 rounded-lg shadow-xl z-50">
            {/* User Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.displayName} className="w-12 h-12 rounded-full" />
                  ) : (
                    <span className="text-white font-bold">
                      {user.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{user.displayName}</span>
                    {user.isPremium && <Crown className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <div className="text-sm text-slate-400">{user.email}</div>
                  <div className="text-xs text-slate-500">
                    登録日: {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-4 border-b border-white/10">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-black/20 rounded p-2">
                  <div className="text-lg font-bold text-blue-400">{user.stats.favoritePlayersCount}</div>
                  <div className="text-xs text-slate-400">お気に入り選手</div>
                </div>
                <div className="bg-black/20 rounded p-2">
                  <div className="text-lg font-bold text-purple-400">{user.stats.favoriteTeamsCount}</div>
                  <div className="text-xs text-slate-400">お気に入りチーム</div>
                </div>
                <div className="bg-black/20 rounded p-2">
                  <div className="text-lg font-bold text-green-400">{user.stats.predictionsCount}</div>
                  <div className="text-xs text-slate-400">予測参加</div>
                </div>
                <div className="bg-black/20 rounded p-2">
                  <div className="text-lg font-bold text-yellow-400">{user.stats.articlesRead}</div>
                  <div className="text-xs text-slate-400">記事閲覧</div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <a
                href="/profile"
                className="flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-black/20 rounded-lg transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <User className="w-4 h-4" />
                プロフィール
              </a>
              
              <a
                href="/favorites"
                className="flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-black/20 rounded-lg transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Heart className="w-4 h-4" />
                お気に入り管理
              </a>

              <a
                href="/predictions"
                className="flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-black/20 rounded-lg transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Trophy className="w-4 h-4" />
                予測ゲーム
              </a>

              <a
                href="/analytics"
                className="flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-black/20 rounded-lg transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <BarChart3 className="w-4 h-4" />
                分析ツール
              </a>

              <a
                href="/settings"
                className="flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-black/20 rounded-lg transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Settings className="w-4 h-4" />
                設定
              </a>

              <div className="border-t border-white/10 my-2"></div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>

            {/* Premium Upgrade (if not premium) */}
            {!user.isPremium && (
              <div className="p-4 border-t border-white/10">
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-medium text-sm">Premium</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2">
                    より詳細な分析機能と予測ツールを利用
                  </p>
                  <button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-xs font-medium py-2 rounded transition-all duration-200">
                    Premiumにアップグレード
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </>
  );
}