'use client';

import { useState } from 'react';
import { Calendar, Clock, Trophy, Users, Target, Zap, Star } from 'lucide-react';
import { PredictionGame, GamePrediction } from '@/lib/predictions';
import { useAuth } from '@/lib/auth';

interface PredictionCardProps {
  game: PredictionGame;
  userPrediction?: GamePrediction;
  onSubmitPrediction: (gameId: string, prediction: Partial<GamePrediction>) => void;
}

export default function PredictionCard({ game, userPrediction, onSubmitPrediction }: PredictionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    winnerPrediction: userPrediction?.winnerPrediction || 'home' as 'home' | 'away',
    scorePrediction: userPrediction?.scorePrediction || { home: 0, away: 0 },
    homeRunsPrediction: userPrediction?.homeRunsPrediction || 0,
    mvpPrediction: userPrediction?.mvpPrediction || '',
    confidence: userPrediction?.confidence || 3 as 1 | 2 | 3 | 4 | 5
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { authState } = useAuth();

  const gameDate = new Date(game.gameDate);
  const deadline = new Date(game.deadline);
  const isExpired = new Date() > deadline;
  const timeUntilDeadline = deadline.getTime() - Date.now();
  const hoursUntilDeadline = Math.max(0, Math.floor(timeUntilDeadline / (1000 * 60 * 60)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.isAuthenticated) return;

    setIsSubmitting(true);
    try {
      await onSubmitPrediction(game.id, formData);
      setIsExpanded(false);
    } catch (error) {
      console.error('Failed to submit prediction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confidenceLabels = {
    1: '🤔 自信なし',
    2: '😐 やや自信なし', 
    3: '😊 普通',
    4: '😄 自信あり',
    5: '🔥 絶対的自信'
  };

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{game.title}</h3>
            <p className="text-slate-400 text-sm">{game.description}</p>
          </div>
          <div className="flex items-center gap-2 text-right">
            {userPrediction && (
              <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-medium">
                予測済み
              </div>
            )}
            {isExpired && (
              <div className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-medium">
                締切済み
              </div>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <div className="text-lg font-bold text-white">{game.awayTeam}</div>
            <div className="text-sm text-slate-400">away</div>
          </div>
          <div className="flex items-center gap-2 px-4">
            <span className="text-2xl">VS</span>
          </div>
          <div className="text-center flex-1">
            <div className="text-lg font-bold text-white">{game.homeTeam}</div>
            <div className="text-sm text-slate-400">home</div>
          </div>
        </div>

        {/* Game Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4" />
            <span>{gameDate.toLocaleDateString('ja-JP')}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4" />
            <span className={isExpired ? 'text-red-400' : hoursUntilDeadline < 2 ? 'text-yellow-400' : ''}>
              {isExpired ? '締切済み' : `締切まで${hoursUntilDeadline}時間`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Users className="w-4 h-4" />
            <span>{game.totalPredictions}人が予測中</span>
          </div>
        </div>

        {/* Prediction Types */}
        <div className="flex flex-wrap gap-2 mt-4">
          {game.allowWinnerPrediction && (
            <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">勝敗予測</span>
          )}
          {game.allowScorePrediction && (
            <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">スコア予測</span>
          )}
          {game.allowHomeRunsPrediction && (
            <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs">本塁打数予測</span>
          )}
          {game.allowMvpPrediction && (
            <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">MVP予測</span>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="p-6">
        {!authState.isAuthenticated ? (
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-3">予測に参加するにはログインが必要です</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
              ログインして参加
            </button>
          </div>
        ) : isExpired ? (
          <div className="text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>予測の受付は終了しました</p>
          </div>
        ) : (
          <div>
            {userPrediction ? (
              <div className="text-center">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">予測完了！</span>
                  </div>
                  <div className="text-sm text-slate-300">
                    勝者予測: <span className="font-medium">{userPrediction.winnerPrediction === 'home' ? game.homeTeam : game.awayTeam}</span>
                    {userPrediction.confidence && (
                      <span className="ml-2">• 自信度: {confidenceLabels[userPrediction.confidence]}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  予測を変更する
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Target className="w-4 h-4" />
                予測を投稿する
              </button>
            )}
          </div>
        )}
      </div>

      {/* Prediction Form */}
      {isExpanded && authState.isAuthenticated && !isExpired && (
        <div className="border-t border-white/10 p-6 bg-black/10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Winner Prediction */}
            {game.allowWinnerPrediction && (
              <div>
                <label className="block text-sm font-medium text-white mb-3">勝利チーム予測</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, winnerPrediction: 'away' }))}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.winnerPrediction === 'away'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-white/20 text-slate-300 hover:border-white/40'
                    }`}
                  >
                    {game.awayTeam}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, winnerPrediction: 'home' }))}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.winnerPrediction === 'home'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-white/20 text-slate-300 hover:border-white/40'
                    }`}
                  >
                    {game.homeTeam}
                  </button>
                </div>
              </div>
            )}

            {/* Score Prediction */}
            {game.allowScorePrediction && (
              <div>
                <label className="block text-sm font-medium text-white mb-3">スコア予測</label>
                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{game.awayTeam}</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={formData.scorePrediction.away}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        scorePrediction: { ...prev.scorePrediction, away: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded text-white text-center"
                    />
                  </div>
                  <div className="text-center text-slate-400">-</div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{game.homeTeam}</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={formData.scorePrediction.home}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        scorePrediction: { ...prev.scorePrediction, home: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded text-white text-center"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Home Runs Prediction */}
            {game.allowHomeRunsPrediction && (
              <div>
                <label className="block text-sm font-medium text-white mb-3">合計本塁打数予測</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.homeRunsPrediction}
                  onChange={(e) => setFormData(prev => ({ ...prev, homeRunsPrediction: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded text-white"
                />
              </div>
            )}

            {/* MVP Prediction */}
            {game.allowMvpPrediction && (
              <div>
                <label className="block text-sm font-medium text-white mb-3">MVP予測</label>
                <input
                  type="text"
                  placeholder="選手名を入力"
                  value={formData.mvpPrediction}
                  onChange={(e) => setFormData(prev => ({ ...prev, mvpPrediction: e.target.value }))}
                  className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded text-white placeholder-slate-400"
                />
              </div>
            )}

            {/* Confidence */}
            <div>
              <label className="block text-sm font-medium text-white mb-3">自信度</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, confidence: level as 1 | 2 | 3 | 4 | 5 }))}
                    className={`flex-1 p-2 rounded border-2 transition-all ${
                      formData.confidence === level
                        ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                        : 'border-white/20 text-slate-400 hover:border-white/40'
                    }`}
                  >
                    <Star className={`w-4 h-4 mx-auto ${formData.confidence >= level ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1 text-center">
                {confidenceLabels[formData.confidence]}
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="flex-1 py-2 px-4 border border-white/20 text-slate-300 rounded-lg hover:bg-white/5 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {isSubmitting ? '投稿中...' : '予測を投稿'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}