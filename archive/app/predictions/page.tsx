'use client';

import { useState } from 'react';
import { Trophy, Target, Users, Zap, Crown, TrendingUp, Calendar, Award } from 'lucide-react';
import { PredictionProvider, usePredictions } from '@/lib/predictions';
import { useAuth } from '@/lib/auth';
import PredictionCard from '@/components/PredictionCard';
import AuthModal from '@/components/AuthModal';

function PredictionsContent() {
  const [activeTab, setActiveTab] = useState<'games' | 'leaderboard' | 'history'>('games');
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const { authState } = useAuth();
  const { 
    availableGames, 
    userPredictions, 
    userStats, 
    leaderboard, 
    isLoading, 
    submitPrediction 
  } = usePredictions();

  const handleSubmitPrediction = async (gameId: string, prediction: any) => {
    if (!authState.isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    await submitPrediction(gameId, prediction);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'diamond': return 'from-cyan-400 to-blue-500';
      case 'platinum': return 'from-gray-300 to-gray-500';
      case 'gold': return 'from-yellow-400 to-yellow-600';
      case 'silver': return 'from-gray-400 to-gray-600';
      default: return 'from-amber-600 to-amber-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-black/20 rounded-lg h-64"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                予測ゲーム
              </h1>
              <p className="text-slate-400">AIと一緒に野球の未来を予測しよう</p>
            </div>
          </div>
          
          {/* User Stats */}
          {authState.isAuthenticated && userStats && (
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">{userStats.totalPredictions}</div>
                  <div className="text-sm text-slate-400">総予測数</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">{userStats.accuracy.toFixed(1)}%</div>
                  <div className="text-sm text-slate-400">的中率</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">{userStats.totalPoints}</div>
                  <div className="text-sm text-slate-400">獲得ポイント</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-400">#{userStats.rank}</div>
                  <div className="text-sm text-slate-400">ランキング</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-1">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('games')}
                className={`px-6 py-2 rounded-md transition-all ${
                  activeTab === 'games'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  予測ゲーム
                </div>
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`px-6 py-2 rounded-md transition-all ${
                  activeTab === 'leaderboard'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  ランキング
                </div>
              </button>
              {authState.isAuthenticated && (
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-2 rounded-md transition-all ${
                    activeTab === 'history'
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    予測履歴
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'games' && (
          <div className="space-y-6">
            {availableGames.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-16 h-16 text-slate-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-white mb-2">現在予測可能な試合はありません</h3>
                <p className="text-slate-400">新しい予測ゲームをお待ちください</p>
              </div>
            ) : (
              availableGames.map((game) => {
                const userPrediction = userPredictions.find(p => p.gameId === game.id);
                return (
                  <PredictionCard
                    key={game.id}
                    game={game}
                    userPrediction={userPrediction}
                    onSubmitPrediction={handleSubmitPrediction}
                  />
                );
              })
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  予測マスターランキング
                </h2>
                <p className="text-slate-400 text-sm mt-2">
                  予測の的中率とポイントで決まるランキング
                </p>
              </div>
              
              <div className="divide-y divide-white/10">
                {leaderboard.map((entry, index) => (
                  <div key={entry.userId} className="p-6 flex items-center gap-4">
                    {/* Rank */}
                    <div className="text-center min-w-[3rem]">
                      {index < 3 ? (
                        <div className={`w-8 h-8 bg-gradient-to-r ${getTierColor(entry.tier)} rounded-full flex items-center justify-center text-white font-bold`}>
                          {index + 1}
                        </div>
                      ) : (
                        <span className="text-2xl font-bold text-slate-400">#{index + 1}</span>
                      )}
                    </div>

                    {/* Avatar & Name */}
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {entry.avatar ? (
                          <img src={entry.avatar} alt={entry.username} className="w-12 h-12 rounded-full" />
                        ) : (
                          entry.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          {entry.username}
                          <span className={`px-2 py-0.5 text-xs rounded-full bg-gradient-to-r ${getTierColor(entry.tier)} text-white font-medium`}>
                            {entry.tier.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-slate-400">
                          {entry.totalPredictions}回予測
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{entry.totalPoints}</div>
                      <div className="text-sm text-green-400">{entry.accuracy.toFixed(1)}% 的中</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier Explanation */}
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">ランクシステム</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { tier: 'bronze', name: 'ブロンズ', points: '0-99' },
                  { tier: 'silver', name: 'シルバー', points: '100-299' },
                  { tier: 'gold', name: 'ゴールド', points: '300-599' },
                  { tier: 'platinum', name: 'プラチナ', points: '600-999' },
                  { tier: 'diamond', name: 'ダイヤモンド', points: '1000+' }
                ].map((rank) => (
                  <div key={rank.tier} className="text-center">
                    <div className={`w-8 h-8 bg-gradient-to-r ${getTierColor(rank.tier)} rounded-full mx-auto mb-2`}></div>
                    <div className="text-sm font-medium text-white">{rank.name}</div>
                    <div className="text-xs text-slate-400">{rank.points}pt</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && authState.isAuthenticated && (
          <div className="space-y-6">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  あなたの予測履歴
                </h2>
              </div>
              
              {userPredictions.length === 0 ? (
                <div className="p-12 text-center">
                  <Award className="w-16 h-16 text-slate-400 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-white mb-2">まだ予測がありません</h3>
                  <p className="text-slate-400">上記の予測ゲームに参加してみましょう</p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {userPredictions.map((prediction) => (
                    <div key={prediction.id} className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-white">{prediction.awayTeam} vs {prediction.homeTeam}</h3>
                          <p className="text-sm text-slate-400">
                            {new Date(prediction.gameDate).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                        <div className="text-right">
                          {prediction.points !== undefined ? (
                            <div className="text-lg font-bold text-green-400">+{prediction.points} pt</div>
                          ) : (
                            <div className="text-sm text-yellow-400">結果待ち</div>
                          )}
                          {prediction.accuracy !== undefined && (
                            <div className="text-sm text-slate-400">{prediction.accuracy}% 的中</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">勝者予測:</span>
                          <div className="font-medium text-white">
                            {prediction.winnerPrediction === 'home' ? prediction.homeTeam : prediction.awayTeam}
                          </div>
                        </div>
                        {prediction.scorePrediction && (
                          <div>
                            <span className="text-slate-400">スコア予測:</span>
                            <div className="font-medium text-white">
                              {prediction.scorePrediction.away}-{prediction.scorePrediction.home}
                            </div>
                          </div>
                        )}
                        {prediction.homeRunsPrediction !== undefined && (
                          <div>
                            <span className="text-slate-400">本塁打数:</span>
                            <div className="font-medium text-white">{prediction.homeRunsPrediction}</div>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">自信度:</span>
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={`text-xs ${i < prediction.confidence ? 'text-yellow-400' : 'text-slate-600'}`}>
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA for unauthenticated users */}
        {!authState.isAuthenticated && (
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-8 text-center mt-12">
            <h3 className="text-2xl font-bold text-white mb-4">予測ゲームに参加しよう！</h3>
            <p className="text-slate-300 mb-6">
              アカウントを作成して予測ゲームに参加すると、ポイントを獲得してランキングで他のファンと競えます
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-8 py-3 rounded-lg transition-all duration-200"
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

export default function PredictionsPage() {
  return (
    <PredictionProvider>
      <PredictionsContent />
    </PredictionProvider>
  );
}