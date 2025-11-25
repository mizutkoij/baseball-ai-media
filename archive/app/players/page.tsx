"use client";

import Link from "next/link";
import { ArrowLeft, Search, Users, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import LeagueSelector from "@/components/LeagueSelector";
import FavoriteButton from "@/components/FavoriteButton";

export const dynamic = 'force-dynamic';

interface Player {
  player_id: string;
  name: string;
  team: string;
  position: string;
  league: string;
  level?: string;
  jersey_number?: number;
  age?: number;
  nationality?: string;
}

interface PlayersResponse {
  players: Player[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  league: {
    code: string;
    name: string;
  };
}

export default function PlayersPage() {
  const searchParams = useSearchParams();
  const currentLeague = (searchParams.get('league') || 'npb') as 'npb' | 'mlb' | 'kbo' | 'international';
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
  });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchPlayers = async (page: number = 1) => {
    console.log('fetchPlayers called', { page, currentLeague, search });
    setLoading(true);
    setError(null); // Clear any previous errors
    
    try {
      const limit = 20;
      const offset = (page - 1) * limit;
      
      const params = new URLSearchParams({
        league: currentLeague,
        limit: limit.toString(),
        offset: offset.toString()
      });
      
      if (search.trim()) params.append('search', search.trim());

      const url = `/api/league-players?${params}`;
      console.log('Fetching URL:', url);
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to fetch players'}`);
      }

      const data: PlayersResponse = await response.json();
      console.log('Received data:', { playerCount: data.players?.length || 0, total: data.pagination?.total || 0 });
      
      if (!data.players || !Array.isArray(data.players)) {
        throw new Error('Invalid data format received from API');
      }
      
      setPlayers(data.players);
      setPagination(data.pagination);
      setCurrentPage(page);
      setError(null);
    } catch (err) {
      console.error('fetchPlayers error:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('リクエストがタイムアウトしました。もう一度お試しください。');
      } else {
        setError('選手データの読み込みに失敗しました: ' + (err instanceof Error ? err.message : String(err)));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Players page useEffect triggered', { search, currentLeague });
    console.log('About to call fetchPlayers...');
    
    // Add error handling to useEffect
    try {
      fetchPlayers();
    } catch (error) {
      console.error('Error in useEffect:', error);
      setError('useEffect error: ' + (error instanceof Error ? error.message : String(error)));
      setLoading(false);
    }
  }, [search, currentLeague]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPlayers(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            ホームに戻る
          </Link>
        </div>

        {/* League Selector */}
        <div className="mb-8">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <LeagueSelector currentLeague={currentLeague} />
          </div>
        </div>

        <div className="text-center mb-8">
          <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">選手一覧</h1>
          <p className="text-xl text-slate-300">
            {currentLeague === 'npb' && 'NPB選手データベース'}
            {currentLeague === 'mlb' && 'MLB選手データベース'}
            {currentLeague === 'kbo' && 'KBO選手データベース'}
            {currentLeague === 'international' && '国際野球選手データベース'}
          </p>
        </div>

        {/* 検索・フィルター */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Search className="w-4 h-4 inline-block mr-2" />
                選手名検索
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="選手名を入力..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
              >
                検索
              </button>
            </div>
          </form>
        </div>

        {/* Debug info */}
        <div className="bg-red-600/20 text-red-400 p-4 rounded-lg mb-4">
          <p>Debug: Loading={loading ? 'true' : 'false'}, Error={error || 'none'}, Players count={players.length}</p>
          <p>Current league: {currentLeague}</p>
        </div>

        {/* 選手一覧 */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-slate-400">選手データを読み込み中...</p>
            <p className="text-xs text-slate-500 mt-2">If this persists, check console for errors</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => fetchPlayers()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
            >
              再試行
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 text-slate-300">
              {pagination.total}人の選手が見つかりました
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {players.map(player => (
                <div
                  key={player.player_id}
                  className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-colors relative group"
                >
                  <Link href={`/players/${player.player_id}?league=${currentLeague}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{player.name}</h3>
                      <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                        {player.position}
                      </span>
                    </div>
                  </Link>
                  
                  {/* Favorite Button */}
                  <div className="absolute top-4 right-4">
                    <FavoriteButton
                      type="player"
                      id={player.player_id}
                      name={player.name}
                      size="sm"
                    />
                  </div>
                  <p className="text-slate-300 mb-2">{player.team}</p>
                  {player.jersey_number && (
                    <div className="text-sm text-slate-400">
                      背番号: {player.jersey_number}
                    </div>
                  )}
                  {player.age && (
                    <div className="text-sm text-slate-400">
                      年齢: {player.age}歳
                    </div>
                  )}
                  {player.nationality && (
                    <div className="text-sm text-slate-400">
                      国籍: {player.nationality}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ページネーション */}
            {pagination.hasMore && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => fetchPlayers(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                >
                  前へ
                </button>
                <span className="px-4 py-2 text-slate-300">
                  ページ {currentPage}
                </span>
                <button
                  onClick={() => fetchPlayers(currentPage + 1)}
                  disabled={!pagination.hasMore}
                  className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}