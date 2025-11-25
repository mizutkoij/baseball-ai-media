'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface YahooStats {
  games: {
    total_games: number;
    processed_games: number;
    pending_games: number;
    earliest_date: string;
    latest_date: string;
  };
  pitches: {
    total_pitches: number;
    games_with_pitches: number;
    unique_pitchers: number;
    unique_batters: number;
  };
  collection_status: {
    completion_rate: string;
    data_richness: string;
  };
}

interface RecentActivity {
  recent_games: Array<{
    game_id: string;
    date: string;
    home_team: string;
    away_team: string;
    status: string;
    processed: number;
    updated_at: string;
  }>;
  recent_pitches: Array<{
    game_id: string;
    inning: number;
    side: string;
    pitcher_name: string;
    batter_name: string;
    result: string;
    home_team: string;
    away_team: string;
  }>;
  last_updated: string;
}

export function YahooDataDashboard() {
  const [stats, setStats] = useState<YahooStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/yahoo-data?type=stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('統計データの取得に失敗しました');
      console.error('Stats fetch error:', err);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const response = await fetch('/api/yahoo-data?type=recent-activity&limit=10');
      const data = await response.json();
      
      if (data.success) {
        setRecentActivity(data.data);
      }
    } catch (err) {
      console.error('Recent activity fetch error:', err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/yahoo-data/sync', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        // 統計を再取得
        await fetchStats();
        await fetchRecentActivity();
        alert(`同期完了: ${data.synced_games}試合, ${data.synced_pitches}球のデータを統合`);
      } else {
        alert(`同期エラー: ${data.error}`);
      }
    } catch (err) {
      alert('同期処理に失敗しました');
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchRecentActivity()]);
      setLoading(false);
    };
    
    loadData();
    
    // 30秒ごとに自動更新
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-600">エラー: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              総試合数
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats?.games.total_games || 0}</div>
            <div className="text-sm text-gray-500">
              処理済み: {stats?.games.processed_games || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              一球速報データ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats?.pitches.total_pitches || 0}</div>
            <div className="text-sm text-gray-500">球数</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              完了率
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats?.collection_status.completion_rate || '0.0'}%</div>
            <div className="text-sm text-gray-500">処理完了</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              データ範囲
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm font-medium">
              {stats?.games.earliest_date || '-'} 〜
            </div>
            <div className="text-sm text-gray-500">
              {stats?.games.latest_date || '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 同期セクション */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            データ同期
            <Button 
              onClick={handleSync} 
              disabled={syncing}
              size="sm"
            >
              {syncing ? '同期中...' : 'NPBデータベースに同期'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">投手データ</div>
              <div className="text-lg">{stats?.pitches.unique_pitchers || 0}人</div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">打者データ</div>
              <div className="text-lg">{stats?.pitches.unique_batters || 0}人</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 最近の活動 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>最近の試合</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.recent_games.slice(0, 5).map((game) => (
                <div key={game.game_id} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <div className="font-medium text-sm">
                      {game.away_team} vs {game.home_team}
                    </div>
                    <div className="text-sm text-gray-500">
                      {game.date} | {game.status}
                    </div>
                  </div>
                  <div className={`text-sm px-2 py-1 rounded ${
                    game.processed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {game.processed ? '完了' : '処理中'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最新の一球速報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.recent_pitches.slice(0, 5).map((pitch, index) => (
                <div key={index} className="py-2 border-b">
                  <div className="text-sm font-medium">
                    {pitch.home_team} vs {pitch.away_team}
                  </div>
                  <div className="text-sm text-gray-600">
                    {pitch.inning}回{pitch.side} | {pitch.pitcher_name} → {pitch.batter_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {pitch.result}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {recentActivity && (
        <div className="text-center text-sm text-gray-500">
          最終更新: {new Date(recentActivity.last_updated).toLocaleString('ja-JP')}
        </div>
      )}
    </div>
  );
}

export default YahooDataDashboard;