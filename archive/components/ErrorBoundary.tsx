'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // エラー報告（プロダクションのみ）
    if (process.env.NODE_ENV === 'production') {
      // 将来的にSentryやLogRocketなどに送信
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // カスタムフォールバック
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // デフォルトエラーUI
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
              <div className="flex justify-center mb-4">
                <AlertCircle className="w-16 h-16 text-red-500" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">
                エラーが発生しました
              </h2>
              
              <p className="text-slate-300 mb-6">
                申し訳ございません。予期しないエラーが発生しました。
                ページを再読み込みするか、ホームに戻ってお試しください。
              </p>

              {this.props.showDetails && this.state.error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-left">
                  <div className="text-red-400 text-sm font-mono">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <pre className="text-red-300/60 text-xs mt-2 overflow-x-auto">
                      {this.state.error.stack.slice(0, 200)}...
                    </pre>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  再試行
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md font-medium transition-colors"
                >
                  <Home className="w-4 h-4" />
                  ホーム
                </button>
              </div>

              <div className="mt-6 text-xs text-slate-500">
                問題が継続する場合は、しばらく時間をおいてから再度お試しください。
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 特定用途向けのエラーバウンダリ
export function APIErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-4 m-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <div className="text-yellow-200">
              <div className="font-medium">データ読み込みエラー</div>
              <div className="text-sm">一時的にデータを取得できません。しばらく後に自動的に再試行されます。</div>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function SSEErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-red-600/20 border border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div className="text-red-200">
              <div className="font-medium">リアルタイム更新エラー</div>
              <div className="text-sm">ライブデータの接続に問題があります。ページを更新してください。</div>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}