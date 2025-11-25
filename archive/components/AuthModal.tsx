'use client';

import { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, register, authState } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      if (mode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          setLocalError('パスワードが一致しません');
          return;
        }
        if (formData.password.length < 6) {
          setLocalError('パスワードは6文字以上で入力してください');
          return;
        }
        if (!formData.username.trim()) {
          setLocalError('ユーザー名を入力してください');
          return;
        }
        await register(formData.email, formData.username, formData.password);
      } else {
        await login(formData.email, formData.password);
      }
      
      // Success - close modal
      onClose();
      setFormData({ email: '', username: '', password: '', confirmPassword: '' });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '処理に失敗しました');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setLocalError(null);
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setLocalError(null);
    setFormData({ email: '', username: '', password: '', confirmPassword: '' });
  };

  const error = localError || authState.error;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">
              {mode === 'login' ? 'ログイン' : 'アカウント作成'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {mode === 'login' 
                ? 'お気に入りの選手・チームを保存しよう' 
                : '無料でアカウントを作成して、パーソナライズされた体験を始めましょう'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              メールアドレス
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="your@email.com"
              />
            </div>
          </div>

          {/* Username (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                ユーザー名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="ユーザー名"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              パスワード
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-black/20 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder={mode === 'register' ? '6文字以上' : 'パスワード'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                パスワード確認
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="パスワードを再入力"
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={authState.isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            {authState.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </button>

          {/* Switch Mode */}
          <div className="text-center pt-4 border-t border-white/10">
            <p className="text-slate-400 text-sm">
              {mode === 'login' ? 'アカウントをお持ちでない方は' : '既にアカウントをお持ちの方は'}
              <button
                type="button"
                onClick={switchMode}
                className="text-blue-400 hover:text-blue-300 font-medium ml-1 transition-colors"
              >
                {mode === 'login' ? 'アカウント作成' : 'ログイン'}
              </button>
            </p>
          </div>
        </form>

        {/* Benefits (Register mode) */}
        {mode === 'register' && (
          <div className="px-6 pb-6">
            <div className="bg-black/20 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">アカウント作成の特典</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• お気に入り選手・チームの保存</li>
                <li>• パーソナライズされたダッシュボード</li>
                <li>• 予測ゲームとランキング参加</li>
                <li>• 記事の読書履歴と推奨機能</li>
                <li>• モバイル・PC間でのデータ同期</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}