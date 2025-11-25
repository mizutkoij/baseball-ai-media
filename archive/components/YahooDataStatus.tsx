'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import Link from 'next/link';

interface YahooStatusData {
  collection_active: boolean;
  latest_game: {
    date: string;
    home_team: string;
    away_team: string;
    status: string;
  } | null;
  stats: {
    total_games: number;
    processed_games: number;
    total_pitches: number;
    completion_rate: string;
  };
  last_updated: string;
}

export function YahooDataStatus() {
  const [status, setStatus] = useState<YahooStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/yahoo-data?type=stats');
      const data = await response.json();
      
      if (data.success) {
        // 最新試合情報も取得
        const gamesResponse = await fetch('/api/yahoo-data?type=games&limit=1');
        const gamesData = await gamesResponse.json();
        
        setStatus({
          collection_active: true, // スクレイピングシステムが稼働中
          latest_game: gamesData.success && gamesData.data.length > 0 ? 
            gamesData.data[0] : null,
          stats: {
            total_games: data.data.games.total_games,
            processed_games: data.data.games.processed_games,
            total_pitches: data.data.pitches.total_pitches,
            completion_rate: data.data.collection_status.completion_rate
          },
          last_updated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Status fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // 1分ごとに更新
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              status.collection_active ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            Yahoo 野球データ収集
          </span>
          <Link 
            href="/admin/yahoo"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            詳細 →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {status.stats.total_games}
            </div>
            <div className="text-sm text-gray-600">試合</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {status.stats.processed_games}
            </div>
            <div className="text-sm text-gray-600">処理済み</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {status.stats.total_pitches.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">球</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {status.stats.completion_rate}%
            </div>
            <div className="text-sm text-gray-600">完了率</div>
          </div>
        </div>

        {status.latest_game && (
          <div className="bg-white p-3 rounded border">
            <div className="text-sm font-medium text-gray-900 mb-1">
              最新処理試合
            </div>
            <div className="text-sm text-gray-600">
              {status.latest_game.date} | {status.latest_game.away_team} vs {status.latest_game.home_team}
            </div>
            <div className="text-xs text-gray-500">
              {status.latest_game.status}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>
            {status.collection_active ? '24時間連続収集中' : '収集停止中'}
          </span>
          <span>
            更新: {new Date(status.last_updated).toLocaleTimeString('ja-JP')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default YahooDataStatus;