'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Clock, MapPin, Users, Target, Trophy, ChevronRight } from 'lucide-react';

interface GameData {
  game_id: string;
  date: string;
  league: 'NPB' | 'farm';
  away_team: string;
  home_team: string;
  away_score?: number;
  home_score?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed';
  inning?: string;
  venue: string;
  start_time_jst: string;
  highlights?: string[];
  preview?: {
    pitching_matchup?: string;
    key_players?: string[];
    weather?: string;
  };
}

interface HomeScorebboardProps {
  className?: string;
}

const TEAM_NAMES: Record<string, string> = {
  'G': '巨人', 'T': '阪神', 'C': '広島', 'YS': 'DeNA', 'D': '中日', 'S': 'ヤクルト',
  'H': 'ソフトバンク', 'L': '西武', 'E': '楽天', 'M': 'ロッテ', 'F': '日本ハム', 'B': 'オリックス'
};

const TEAM_COLORS: Record<string, string> = {
  'G': 'border-orange-500', 'T': 'border-yellow-500', 'C': 'border-red-500',
  'YS': 'border-blue-500', 'D': 'border-blue-700', 'S': 'border-green-500',
  'H': 'border-yellow-400', 'L': 'border-blue-600', 'E': 'border-red-600',
  'M': 'border-black', 'F': 'border-blue-400', 'B': 'border-blue-800'
};

const MOCK_GAMES: GameData[] = [
  {
    game_id: 'NPB_20250201_001',
    date: '2025-02-01',
    league: 'NPB',
    away_team: 'G',
    home_team: 'T',
    away_score: 3,
    home_score: 5,
    status: 'completed',
    venue: '甲子園球場',
    start_time_jst: '18:00',
    highlights: ['阪神サヨナラ勝ち', '巨人先制も逆転許す'],
    preview: {
      pitching_matchup: '菅野 vs 才木',
      key_players: ['岡本和真', '佐藤輝明'],
      weather: '曇り 15℃'
    }
  },
  {
    game_id: 'NPB_20250201_002',
    date: '2025-02-01',
    league: 'NPB',
    away_team: 'C',
    home_team: 'YS',
    status: 'in_progress',
    inning: '7回裏',
    away_score: 2,
    home_score: 4,
    venue: '横浜スタジアム',
    start_time_jst: '18:00',
    highlights: ['DeNA 2点リード', '広島反撃なるか'],
    preview: {
      pitching_matchup: '森下 vs 今永',
      key_players: ['鈴木誠也', '佐野恵太'],
      weather: '晴れ 18℃'
    }
  },
  {
    game_id: 'NPB_20250201_003',
    date: '2025-02-01',
    league: 'NPB',
    away_team: 'H',
    home_team: 'L',
    status: 'scheduled',
    venue: 'メットライフドーム',
    start_time_jst: '18:00',
    highlights: ['開幕戦', '今季初対戦'],
    preview: {
      pitching_matchup: '千賀 vs 平良',
      key_players: ['柳田悠岐', '山川穂高'],
      weather: '晴れ 16℃'
    }
  }
];

const MOCK_FARM_GAMES: GameData[] = [
  {
    game_id: 'FARM_20250201_001',
    date: '2025-02-01',
    league: 'farm',
    away_team: 'G',
    home_team: 'T',
    away_score: 1,
    home_score: 3,
    status: 'completed',
    venue: 'ウエスタン・リーグ',
    start_time_jst: '13:00',
    highlights: ['若手中心の対戦', '阪神2軍快勝']
  },
  {
    game_id: 'FARM_20250201_002',
    date: '2025-02-01',
    league: 'farm',
    away_team: 'H',
    home_team: 'L',
    status: 'in_progress',
    inning: '5回表',
    away_score: 0,
    home_score: 2,
    venue: 'イースタン・リーグ',
    start_time_jst: '13:00',
    highlights: ['投手戦', '西武2軍リード']
  }
];

function GameCard({ game }: { game: GameData }) {
  const getStatusBadge = () => {
    switch (game.status) {
      case 'scheduled':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">試合前</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full animate-pulse">{game.inning}</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">試合終了</span>;
      case 'postponed':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">中止</span>;
      default:
        return null;
    }
  };

  const getScore = (team: 'away' | 'home') => {
    const score = team === 'away' ? game.away_score : game.home_score;
    return score !== undefined ? score : '-';
  };

  const awayTeamColor = TEAM_COLORS[game.away_team] || 'border-gray-300';
  const homeTeamColor = TEAM_COLORS[game.home_team] || 'border-gray-300';

  return (
    <Link href={`/games/${game.game_id}`}>
      <div className="bg-white/90 border border-slate-200 rounded-lg p-4 hover:bg-white hover:shadow-md transition-all duration-200 cursor-pointer">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-600">{game.venue}</span>
          </div>
          {getStatusBadge()}
        </div>

        {/* スコア */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            {/* アウェイチーム */}
            <div className={`flex items-center justify-between p-2 border-l-4 ${awayTeamColor} mb-2`}>
              <span className="font-medium text-slate-900">{TEAM_NAMES[game.away_team] || game.away_team}</span>
              <span className="text-xl font-bold text-slate-900">{getScore('away')}</span>
            </div>
            
            {/* ホームチーム */}
            <div className={`flex items-center justify-between p-2 border-l-4 ${homeTeamColor}`}>
              <span className="font-medium text-slate-900">{TEAM_NAMES[game.home_team] || game.home_team}</span>
              <span className="text-xl font-bold text-slate-900">{getScore('home')}</span>
            </div>
          </div>
        </div>

        {/* 見どころ・ハイライト */}
        {game.highlights && game.highlights.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {game.highlights.slice(0, 2).map((highlight, index) => (
                <span key={index} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">
                  {highlight}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 投手対戦・開始時刻 */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{game.start_time_jst}</span>
          </div>
          {game.preview?.pitching_matchup && (
            <span className="text-xs">{game.preview.pitching_matchup}</span>
          )}
        </div>

        {/* 詳細へのリンク示唆 */}
        <div className="flex items-center justify-end mt-2">
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </Link>
  );
}

export default function HomeScoreboard({ className = "" }: HomeScorebboardProps) {
  const [activeTab, setActiveTab] = useState<'npb' | 'farm'>('npb');
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 実際の実装では API からデータを取得
    // const fetchTodayGames = async () => {
    //   try {
    //     const response = await fetch('/api/games/today');
    //     const data = await response.json();
    //     setGames(data.games || []);
    //   } catch (error) {
    //     console.error('Failed to fetch today games:', error);
    //   } finally {
    //     setLoading(false);
    //   }
    // };
    
    // Mock データを使用
    const mockData = activeTab === 'npb' ? MOCK_GAMES : MOCK_FARM_GAMES;
    setTimeout(() => {
      setGames(mockData);
      setLoading(false);
    }, 500);
  }, [activeTab]);

  const getTabStyle = (tab: 'npb' | 'farm') => {
    const isActive = activeTab === tab;
    return `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive 
        ? 'bg-blue-600 text-white' 
        : 'bg-white/50 text-slate-600 hover:bg-white/80'
    }`;
  };

  return (
    <section className={`bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl p-6 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">今日の試合</h2>
          <span className="text-sm text-slate-500">
            {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
          </span>
        </div>

        {/* タブ */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('npb')}
            className={getTabStyle('npb')}
          >
            1軍
          </button>
          <button
            onClick={() => setActiveTab('farm')}
            className={getTabStyle('farm')}
          >
            ファーム
          </button>
        </div>
      </div>

      {/* 試合カード */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/50 border border-slate-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded mb-3"></div>
              <div className="h-8 bg-slate-200 rounded mb-2"></div>
              <div className="h-8 bg-slate-200 rounded mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : games.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => (
            <GameCard key={game.game_id} game={game} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">今日は{activeTab === 'npb' ? '1軍' : 'ファーム'}の試合がありません</p>
        </div>
      )}

      {/* フッター */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users className="w-4 h-4" />
          <span>リアルタイム更新</span>
        </div>
        <Link 
          href="/schedule" 
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          全試合スケジュール →
        </Link>
      </div>
    </section>
  );
}