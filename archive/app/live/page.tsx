'use client';

import { useState } from 'react';
import { Clock, Calendar, MapPin, Users, Zap, TrendingUp, AlertCircle } from 'lucide-react';

// 試合データの型定義
interface LiveGame {
  game_id: string;
  date: string;
  start_time: string;
  status: 'scheduled' | 'live' | 'final' | 'postponed' | 'cancelled';
  inning?: string;
  away_team: string;
  home_team: string;
  away_score: number;
  home_score: number;
  venue: string;
  tv?: string;
  league: 'central' | 'pacific' | 'interleague';
  highlights?: string[];
  last_play?: string;
}


// チーム色とロゴの定義
const TEAM_COLORS: Record<string, string> = {
  'YG': 'from-orange-500 to-orange-600',
  'T': 'from-yellow-500 to-yellow-600', 
  'C': 'from-red-500 to-red-600',
  'DB': 'from-blue-500 to-blue-600',
  'S': 'from-green-500 to-green-600',
  'D': 'from-blue-600 to-blue-700',
  'H': 'from-yellow-600 to-yellow-700',
  'L': 'from-blue-400 to-blue-500',
  'E': 'from-red-600 to-red-700',
  'M': 'from-gray-600 to-gray-700',
  'B': 'from-blue-700 to-blue-800',
  'F': 'from-blue-500 to-blue-600'
};

const TEAM_NAMES: Record<string, string> = {
  'YG': '読売ジャイアンツ',
  'T': '阪神タイガース',
  'C': '広島東洋カープ', 
  'DB': '横浜DeNAベイスターズ',
  'S': '東京ヤクルトスワローズ',
  'D': '中日ドラゴンズ',
  'H': '福岡ソフトバンクホークス',
  'L': '埼玉西武ライオンズ',
  'E': '東北楽天ゴールデンイーグルス',
  'M': '千葉ロッテマリーンズ',
  'B': 'オリックス・バファローズ',
  'F': '北海道日本ハムファイターズ'
};

// ステータス表示コンポーネント
function GameStatus({ game }: { game: LiveGame }) {
  const getStatusDisplay = () => {
    switch (game.status) {
      case 'live':
        return (
          <div className="flex items-center gap-2 text-red-600 font-bold">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            LIVE {game.inning}
          </div>
        );
      case 'final':
        return <div className="text-gray-600 font-semibold">試合終了</div>;
      case 'scheduled':
        return (
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className="w-4 h-4" />
            {game.start_time}
          </div>
        );
      case 'postponed':
        return <div className="text-yellow-600 font-semibold">中止</div>;
      case 'cancelled':
        return <div className="text-red-600 font-semibold">中断</div>;
      default:
        return <div className="text-gray-500">-</div>;
    }
  };

  return getStatusDisplay();
}

// 試合カードコンポーネント
function GameCard({ game }: { game: LiveGame }) {
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const awayTeamGradient = TEAM_COLORS[game.away_team] || 'from-gray-400 to-gray-500';
  const homeTeamGradient = TEAM_COLORS[game.home_team] || 'from-gray-400 to-gray-500';

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg ${
      isLive ? 'ring-2 ring-red-500 ring-opacity-50' : ''
    }`}>
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{game.venue}</span>
          </div>
          <GameStatus game={game} />
        </div>
      </div>

      {/* メインスコア */}
      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 items-center">
          {/* アウェイチーム */}
          <div className="text-center">
            <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br ${awayTeamGradient} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
              {game.away_team}
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">
              {TEAM_NAMES[game.away_team]}
            </div>
            {(isLive || isFinal) && (
              <div className="text-3xl font-bold text-gray-900">
                {game.away_score}
              </div>
            )}
          </div>

          {/* VS / スコア */}
          <div className="text-center">
            {isLive || isFinal ? (
              <div className="text-6xl font-bold text-gray-300">-</div>
            ) : (
              <div className="text-2xl font-bold text-gray-400">VS</div>
            )}
          </div>

          {/* ホームチーム */}
          <div className="text-center">
            <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br ${homeTeamGradient} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
              {game.home_team}
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">
              {TEAM_NAMES[game.home_team]}
            </div>
            {(isLive || isFinal) && (
              <div className="text-3xl font-bold text-gray-900">
                {game.home_score}
              </div>
            )}
          </div>
        </div>

        {/* 追加情報 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(game.date).toLocaleDateString('ja-JP', {
                month: 'short',
                day: 'numeric',
                weekday: 'short'
              })}
            </div>
            {game.tv && (
              <div className="text-blue-600 font-medium">
                📺 {game.tv}
              </div>
            )}
          </div>
        </div>

        {/* ライブ情報 */}
        {isLive && game.last_play && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
            <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
              <Zap className="w-4 h-4" />
              最新プレイ
            </div>
            <div className="text-sm text-gray-700 mt-1">
              {game.last_play}
            </div>
          </div>
        )}

        {/* 詳細ボタン */}
        <div className="mt-4">
          <button className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium">
            詳細を見る
          </button>
        </div>
      </div>
    </div>
  );
}

// フィルタータブ
function FilterTabs({ activeFilter, onFilterChange }: { 
  activeFilter: string; 
  onFilterChange: (filter: string) => void;
}) {
  const filters = [
    { id: 'all', label: '全試合', icon: Users },
    { id: 'live', label: 'LIVE', icon: TrendingUp },
    { id: 'today', label: '今日', icon: Calendar },
    { id: 'central', label: 'セ・リーグ', icon: null },
    { id: 'pacific', label: 'パ・リーグ', icon: null }
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {filters.map((filter) => {
        const Icon = filter.icon;
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeFilter === filter.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {filter.label}
            {filter.id === 'live' && (
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function LiveScoresPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  
  // モックデータ（後でAPIに置き換え）
  const mockGames: LiveGame[] = [
    {
      game_id: '2024-08-05-YG-S',
      date: '2024-08-05',
      start_time: '18:00',
      status: 'live',
      inning: '7回表',
      away_team: 'YG',
      home_team: 'S',
      away_score: 4,
      home_score: 2,
      venue: '明治神宮野球場',
      tv: 'BS朝日',
      league: 'central',
      last_play: '村上宗隆、レフトフライでチェンジ'
    },
    {
      game_id: '2024-08-05-T-C', 
      date: '2024-08-05',
      start_time: '18:00',
      status: 'live',
      inning: '6回裏',
      away_team: 'T',
      home_team: 'C',
      away_score: 1,
      home_score: 3,
      venue: 'マツダスタジアム',
      tv: 'RCC中国放送',
      league: 'central',
      last_play: '佐藤輝明、センター前ヒット'
    },
    {
      game_id: '2024-08-05-H-M',
      date: '2024-08-05', 
      start_time: '18:00',
      status: 'scheduled',
      away_team: 'H',
      home_team: 'M',
      away_score: 0,
      home_score: 0,
      venue: 'ZOZOマリンスタジアム',
      tv: '千葉テレビ',
      league: 'pacific'
    },
    {
      game_id: '2024-08-05-L-F',
      date: '2024-08-05',
      start_time: '14:00', 
      status: 'final',
      away_team: 'L',
      home_team: 'F',
      away_score: 7,
      home_score: 3,
      venue: 'エスコンフィールド',
      league: 'pacific'
    }
  ];

  // フィルタリング処理
  const filteredGames = mockGames.filter(game => {
    switch (activeFilter) {
      case 'live':
        return game.status === 'live';
      case 'today':
        return game.date === new Date().toISOString().split('T')[0];
      case 'central':
        return game.league === 'central';
      case 'pacific':
        return game.league === 'pacific';
      default:
        return true;
    }
  });

  // 自動更新は後で実装

  const liveGamesCount = mockGames.filter(g => g.status === 'live').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4 flex items-center justify-center gap-3">
              <Zap className="w-12 h-12 text-red-400" />
              試合速報
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              NPB全試合のリアルタイム速報をお届け。ライブスコア、試合状況、最新プレイを随時更新中。
            </p>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <TrendingUp className="w-4 h-4 text-red-400" />
                <span>LIVE {liveGamesCount}試合</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>自動更新 30秒</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span>リアルタイム速報</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* フィルター */}
        <FilterTabs 
          activeFilter={activeFilter} 
          onFilterChange={setActiveFilter} 
        />

        {/* 試合一覧 */}
        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <GameCard key={game.game_id} game={game} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">
              該当する試合がありません
            </div>
          </div>
        )}

        {/* 更新情報 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          最終更新: {new Date().toLocaleString('ja-JP')}
        </div>
      </div>
    </div>
  );
}