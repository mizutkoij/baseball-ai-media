import React, { Suspense } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Clock, Trophy, Star, ExternalLink } from 'lucide-react';

interface GameOfTheDayData {
  game_id: string;
  date: string;
  start_time_jst?: string;
  status: string;
  inning?: string;
  away_team: string;
  home_team: string;
  away_score?: number;
  home_score?: number;
  venue?: string;
  league: string;
  selection_score: number;
  description: string;
  ogp_title: string;
  ogp_description: string;
}

interface GameOfTheDayResponse {
  source: string;
  league: string;
  date: string;
  total_games: number;
  game_of_the_day: GameOfTheDayData | null;
  selection_reason?: string;
  ts: string;
}

async function fetchGameOfTheDay(): Promise<GameOfTheDayResponse> {
  try {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${api}/api/game-of-the-day`, { 
      next: { revalidate: 300 } // 5分キャッシュ
    });
    
    if (!res.ok) {
      throw new Error(`Game of the Day API failed: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch Game of the Day:', error);
    return {
      source: "error",
      league: "first",
      date: new Date().toISOString().split('T')[0],
      total_games: 0,
      game_of_the_day: null,
      selection_reason: "データ取得エラー",
      ts: new Date().toISOString()
    };
  }
}

function GameOfTheDayContent({ data }: { data: GameOfTheDayResponse }) {
  if (!data.game_of_the_day) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Star className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold text-white">今日の注目試合</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-slate-400 mb-4">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{data.selection_reason || "本日の試合情報はありません"}</p>
          </div>
          <p className="text-xs text-slate-500">
            総試合数: {data.total_games}試合 | 更新: {new Date(data.ts).toLocaleTimeString('ja-JP')}
          </p>
        </div>
      </div>
    );
  }

  const game = data.game_of_the_day;
  
  // Status display
  const getStatusDisplay = () => {
    switch (game.status) {
      case 'live':
      case 'inprogress':
        return (
          <div className="flex items-center gap-2 text-red-400">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            <span className="font-semibold">LIVE</span>
            {game.inning && <span className="text-sm">({game.inning})</span>}
          </div>
        );
      case 'scheduled':
      case 'pregame':
        return (
          <div className="flex items-center gap-2 text-green-400">
            <Clock className="w-4 h-4" />
            <span>{game.start_time_jst || '開始時刻未定'}</span>
          </div>
        );
      case 'final':
        return (
          <div className="flex items-center gap-2 text-blue-400">
            <Trophy className="w-4 h-4" />
            <span>試合終了</span>
          </div>
        );
      default:
        return (
          <div className="text-slate-400">
            <span>{game.status}</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-b border-yellow-500/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">今日の注目試合</h2>
          </div>
          <div className="text-xs text-yellow-300 bg-yellow-900/30 px-2 py-1 rounded">
            スコア: {game.selection_score}pt
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="p-6">
        {/* Teams & Score */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-right">
              <div className="text-lg font-bold text-white">{game.away_team}</div>
              <div className="text-sm text-slate-400">アウェイ</div>
            </div>
            
            <div className="flex items-center gap-3">
              {game.away_score !== null && game.home_score !== null ? (
                <div className="text-2xl font-bold text-blue-400">
                  {game.away_score} - {game.home_score}
                </div>
              ) : (
                <div className="text-xl text-slate-400">VS</div>
              )}
            </div>
            
            <div className="text-left">
              <div className="text-lg font-bold text-white">{game.home_team}</div>
              <div className="text-sm text-slate-400">ホーム</div>
            </div>
          </div>
          
          {/* Status */}
          <div className="flex justify-center mb-4">
            {getStatusDisplay()}
          </div>
        </div>

        {/* Game Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-sm">{game.date}</span>
          </div>
          {game.venue && (
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-green-400" />
              <span className="text-sm">{game.venue}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
          <p className="text-slate-300 text-sm">
            {game.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link 
            href={`/games/${game.game_id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            詳細分析を見る
          </Link>
          <Link 
            href="/today"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            今日の全試合
          </Link>
        </div>

        {/* Meta Info */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>データソース: {data.source}</span>
            <span>更新: {new Date(data.ts).toLocaleString('ja-JP')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameOfTheDayLoading() {
  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 bg-yellow-400/20 rounded"></div>
        <div className="h-6 bg-white/10 rounded w-32"></div>
      </div>
      <div className="space-y-4">
        <div className="flex justify-center gap-4">
          <div className="text-center">
            <div className="h-6 bg-white/10 rounded w-20 mb-2"></div>
            <div className="h-4 bg-white/10 rounded w-16"></div>
          </div>
          <div className="h-8 bg-white/10 rounded w-16"></div>
          <div className="text-center">
            <div className="h-6 bg-white/10 rounded w-20 mb-2"></div>
            <div className="h-4 bg-white/10 rounded w-16"></div>
          </div>
        </div>
        <div className="h-4 bg-white/10 rounded w-full"></div>
        <div className="flex gap-3">
          <div className="h-10 bg-white/10 rounded flex-1"></div>
          <div className="h-10 bg-white/10 rounded flex-1"></div>
        </div>
      </div>
    </div>
  );
}

export default async function GameOfTheDay() {
  const data = await fetchGameOfTheDay();
  
  return (
    <Suspense fallback={<GameOfTheDayLoading />}>
      <GameOfTheDayContent data={data} />
    </Suspense>
  );
}

// Client component version for dynamic updates
export function GameOfTheDayClient() {
  return (
    <Suspense fallback={<GameOfTheDayLoading />}>
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Star className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold text-white">今日の注目試合</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>クライアントサイドでの動的更新対応</p>
          </div>
        </div>
      </div>
    </Suspense>
  );
}