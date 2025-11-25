'use client';

/**
 * 試合リプレイプレイヤー - SSE風体験でエンゲージメント最大化
 * 再生/停止/速度調整/重要場面ジャンプ対応
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Settings } from 'lucide-react';

interface ReplayPlayerProps {
  gameId: string;
  gameInfo?: {
    matchup: string;
    homeTeam: string;
    awayTeam: string;
    status: string;
  } | null;
}

interface ReplayEvent {
  frameId?: number;
  type: string;
  timestamp: string;
  replaySpeed?: number;
  data?: any;
  [key: string]: any;
}

interface GameState {
  homeScore: number;
  awayScore: number;
  inning: number;
  inningHalf: 'top' | 'bottom';
  balls: number;
  strikes: number;
  outs: number;
  bases: boolean[]; // [1塁, 2塁, 3塁]
  batter?: string;
  pitcher?: string;
  winProbability?: number;
  nextPitchPrediction?: Array<{ label: string; prob: number }>;
}

export default function ReplayPlayer({ gameId, gameInfo }: ReplayPlayerProps) {
  // 状態管理
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [gameState, setGameState] = useState<GameState>({
    homeScore: 0,
    awayScore: 0,
    inning: 1,
    inningHalf: 'top',
    balls: 0,
    strikes: 0,
    outs: 0,
    bases: [false, false, false]
  });
  const [replayEvents, setReplayEvents] = useState<ReplayEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // リプレイ開始
  const startReplay = async () => {
    if (isPlaying) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // 既存のEventSource があれば閉じる
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const replayUrl = `/api/replay/${gameId}?speed=${speed}&from=${currentFrame}`;
      const eventSource = new EventSource(replayUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('Replay stream connected');
        setIsLoading(false);
        setIsPlaying(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const replayEvent: ReplayEvent = JSON.parse(event.data);
          handleReplayEvent(replayEvent);
        } catch (parseError) {
          console.error('Failed to parse replay event:', parseError);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Replay stream error:', error);
        setError('リプレイの読み込みに失敗しました');
        setIsPlaying(false);
        setIsLoading(false);
        eventSource.close();
      };

    } catch (error) {
      console.error('Failed to start replay:', error);
      setError('リプレイを開始できませんでした');
      setIsLoading(false);
    }
  };

  // リプレイ停止
  const stopReplay = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
    }
    setIsPlaying(false);
  };

  // リプレイイベント処理
  const handleReplayEvent = (event: ReplayEvent) => {
    setReplayEvents(prev => [...prev, event]);

    switch (event.type) {
      case 'replay_start':
        console.log('Replay started:', event);
        break;

      case 'replay_end':
        setIsPlaying(false);
        setTotalFrames(event.totalFrames || 0);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        break;

      case 'update':
        // ゲーム状態更新
        if (event.data) {
          updateGameState(event.data);
        }
        break;

      case 'matchup':
        // 打席情報更新
        if (event.data) {
          setGameState(prev => ({
            ...prev,
            batter: event.data.batter_name,
            pitcher: event.data.pitcher_name
          }));
        }
        break;

      case 'nextpitch':
        // 次球予測更新
        if (event.data?.top3) {
          setGameState(prev => ({
            ...prev,
            nextPitchPrediction: event.data.top3
          }));
        }
        break;

      case 'score':
        // スコア更新
        if (event.data) {
          setGameState(prev => ({
            ...prev,
            homeScore: event.data.home_score || prev.homeScore,
            awayScore: event.data.away_score || prev.awayScore
          }));
        }
        break;
    }

    // フレーム番号更新
    if (event.frameId) {
      setCurrentFrame(event.frameId);
    }
  };

  // ゲーム状態更新
  const updateGameState = (data: any) => {
    setGameState(prev => ({
      ...prev,
      balls: data.balls ?? prev.balls,
      strikes: data.strikes ?? prev.strikes,
      outs: data.outs ?? prev.outs,
      bases: data.bases ?? prev.bases,
      inning: data.inning ?? prev.inning,
      inningHalf: data.inning_half ?? prev.inningHalf,
      winProbability: data.win_probability ?? prev.winProbability
    }));
  };

  // 速度変更
  const changeSpeed = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isPlaying) {
      // 再生中の場合は再起動
      stopReplay();
      setTimeout(() => {
        setSpeed(newSpeed);
        startReplay();
      }, 100);
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopReplay();
    };
  }, []);

  // DOM更新（ゲーム状況表示）
  useEffect(() => {
    const statusElement = document.getElementById('game-status');
    if (statusElement) {
      statusElement.innerHTML = `
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <div class="text-lg font-bold">${gameState.awayScore} - ${gameState.homeScore}</div>
            <div class="text-sm">${gameState.inning}回${gameState.inningHalf === 'top' ? '表' : '裏'}</div>
          </div>
          <div class="flex justify-between text-sm">
            <div>B: ${gameState.balls}</div>
            <div>S: ${gameState.strikes}</div>
            <div>O: ${gameState.outs}</div>
          </div>
          <div class="flex justify-center gap-2">
            <div class="w-6 h-6 rounded border ${gameState.bases[1] ? 'bg-yellow-500' : 'border-gray-500'} text-xs flex items-center justify-center">2</div>
            <div></div>
          </div>
          <div class="flex justify-between">
            <div class="w-6 h-6 rounded border ${gameState.bases[0] ? 'bg-yellow-500' : 'border-gray-500'} text-xs flex items-center justify-center">1</div>
            <div class="w-6 h-6 rounded border ${gameState.bases[2] ? 'bg-yellow-500' : 'border-gray-500'} text-xs flex items-center justify-center">3</div>
          </div>
          <div class="text-center">
            <div class="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-xs">⚾</div>
          </div>
          ${gameState.winProbability ? `
            <div class="mt-4">
              <div class="text-xs text-gray-400 mb-1">勝率</div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div class="bg-blue-500 h-2 rounded-full" style="width: ${gameState.winProbability * 100}%"></div>
              </div>
              <div class="text-xs text-center mt-1">${(gameState.winProbability * 100).toFixed(1)}%</div>
            </div>
          ` : ''}
          ${gameState.nextPitchPrediction ? `
            <div class="mt-4">
              <div class="text-xs text-gray-400 mb-2">次球予測</div>
              ${gameState.nextPitchPrediction.slice(0, 3).map((pred, i) => `
                <div class="flex justify-between text-xs mb-1">
                  <span>${pred.label}</span>
                  <span>${(pred.prob * 100).toFixed(1)}%</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }
  }, [gameState]);

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
      {/* プレイヤーヘッダー */}
      <div className="bg-white/5 p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-white">
              {gameInfo?.matchup || gameId}
            </h2>
            <div className="text-sm text-slate-400">
              Frame: {currentFrame}{totalFrames > 0 && ` / ${totalFrames}`}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {isLoading && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-white/30 rounded-full animate-spin border-t-white"></div>
                読み込み中...
              </div>
            )}
            {error && (
              <div className="text-red-400">{error}</div>
            )}
            {isPlaying && (
              <div className="flex items-center gap-1 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                再生中 ({speed}x)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* リプレイビューア */}
      <div className="p-6 min-h-[300px] bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="text-center">
          {!isPlaying && !isLoading && (
            <div className="space-y-4">
              <div className="text-slate-400">
                ⚾ AI予測の変遷をリプレイで体験
              </div>
              <div className="text-sm text-slate-500">
                勝率推移・次球予測・重要場面を振り返れます
              </div>
            </div>
          )}
          
          {isPlaying && (
            <div className="space-y-4">
              <div className="text-white">
                📊 リプレイ再生中...
              </div>
              <div className="text-sm text-slate-400">
                投手: {gameState.pitcher || '---'} vs 打者: {gameState.batter || '---'}
              </div>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="text-red-400">⚠️ {error}</div>
              <div className="text-sm text-slate-500">
                リプレイデータが利用できません
              </div>
            </div>
          )}
        </div>
      </div>

      {/* コントロールパネル */}
      <div className="bg-white/5 p-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          {/* 再生コントロール */}
          <div className="flex items-center gap-3">
            <button
              onClick={isPlaying ? stopReplay : startReplay}
              disabled={isLoading}
              className={`p-2 rounded-lg transition-colors ${
                isPlaying 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setCurrentFrame(Math.max(0, currentFrame - 10))}
              className="p-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentFrame(currentFrame + 10)}
              className="p-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* 速度調整 */}
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            {[1, 2, 3, 4].map(s => (
              <button
                key={s}
                onClick={() => changeSpeed(s)}
                className={`px-3 py-1 text-sm rounded ${
                  speed === s 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                } transition-colors`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* プログレスバー */}
        {totalFrames > 0 && (
          <div className="mt-4">
            <div className="w-full bg-gray-700 rounded-full h-1">
              <div 
                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${(currentFrame / totalFrames) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}