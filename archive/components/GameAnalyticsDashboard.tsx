'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface GameAnalyticsDashboardProps {
  gameId?: string;
  date?: string;
  team?: string;
  status?: string;
  includeAnalytics?: boolean;
}

interface GameAnalytics {
  game_id: string;
  date: string;
  teams: {
    home: { name: string; score: number; team_stats: any };
    away: { name: string; score: number; team_stats: any };
  };
  game_info: {
    venue: string;
    status: string;
    inning_scores: any;
    game_duration: string;
  };
  live_status?: {
    last_updated: string;
    current_situation: any;
    last_play: string;
  };
  analytics?: any;
  insights?: any;
}

export default function GameAnalyticsDashboard({
  gameId,
  date,
  team,
  status,
  includeAnalytics = true
}: GameAnalyticsDashboardProps) {
  const [games, setGames] = useState<GameAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    fetchGameAnalytics();
  }, [gameId, date, team, status, includeAnalytics]);

  const fetchGameAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (gameId) params.append('gameId', gameId);
      if (date) params.append('date', date);
      if (team) params.append('team', team);
      if (status) params.append('status', status);
      if (includeAnalytics) params.append('analytics', 'true');

      const response = await fetch(`/api/analytics/games?${params}`);
      const data = await response.json();

      if (data.success) {
        setGames(data.data);
      } else {
        setError(data.error || 'Failed to fetch game analytics');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching game analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderGameOverview = (game: GameAnalytics) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* チーム情報 */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">試合結果</h3>
          <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <div className="text-center">
                <div className="text-xl font-bold">{game.teams.away.name}</div>
                <div className="text-3xl font-bold text-blue-600">{game.teams.away.score}</div>
              </div>
              <div className="text-2xl font-bold text-gray-400">VS</div>
              <div className="text-center">
                <div className="text-xl font-bold">{game.teams.home.name}</div>
                <div className="text-3xl font-bold text-green-600">{game.teams.home.score}</div>
              </div>
            </div>
            <div className="text-center text-sm text-gray-600">
              {game.game_info.venue} - {game.date}
            </div>
          </div>
        </div>

        {/* 試合情報 */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">試合情報</h3>
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">状況:</span>
              <Badge variant={getStatusVariant(game.game_info.status)}>
                {getStatusLabel(game.game_info.status)}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">会場:</span>
              <span className="font-medium">{game.game_info.venue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">日付:</span>
              <span className="font-medium">{game.date}</span>
            </div>
            {game.game_info.game_duration && (
              <div className="flex justify-between">
                <span className="text-gray-600">試合時間:</span>
                <span className="font-medium">{game.game_info.game_duration}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ライブ情報 */}
      {game.live_status && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <h4 className="font-semibold text-red-800 mb-2">🔴 ライブ情報</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-red-600">イニング:</span>
              <span className="font-medium ml-2">
                {game.live_status.current_situation?.inning}回
                {game.live_status.current_situation?.half === 'top' ? '表' : '裏'}
              </span>
            </div>
            <div>
              <span className="text-red-600">アウト:</span>
              <span className="font-medium ml-2">{game.live_status.current_situation?.outs}</span>
            </div>
            <div>
              <span className="text-red-600">ランナー:</span>
              <span className="font-medium ml-2">
                {Object.keys(game.live_status.current_situation?.runners || {}).length}
              </span>
            </div>
            <div>
              <span className="text-red-600">最終更新:</span>
              <span className="font-medium ml-2 text-xs">
                {new Date(game.live_status.last_updated).toLocaleTimeString()}
              </span>
            </div>
          </div>
          {game.live_status.last_play && (
            <div className="mt-2 p-2 bg-white rounded text-sm">
              <strong>最新プレイ:</strong> {game.live_status.last_play}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderGameAnalytics = (game: GameAnalytics) => {
    if (!game.analytics) {
      return <p className="text-gray-600">分析データがありません</p>;
    }

    return (
      <div className="space-y-6">
        {/* 基本分析指標 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {(game.analytics.win_probability * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-blue-800">勝利確率</div>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {game.analytics.leverage_index?.toFixed(2) || '---'}
            </div>
            <div className="text-sm text-green-800">レバレッジ指数</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {game.analytics.performance_metrics?.offensive_efficiency?.toFixed(2) || '---'}
            </div>
            <div className="text-sm text-purple-800">攻撃効率</div>
          </div>
          
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {game.analytics.performance_metrics?.pitching_effectiveness?.toFixed(2) || '---'}
            </div>
            <div className="text-sm text-orange-800">投手効率</div>
          </div>
        </div>

        {/* 試合状況分析 */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-3">試合状況分析</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">試合状況:</span>
              <span className="ml-2 font-medium">{game.analytics.game_situation}</span>
            </div>
            <div>
              <span className="text-gray-600">勢い変化:</span>
              <span className={`ml-2 font-medium ${
                (game.analytics.momentum_analysis?.momentum_shift || 0) > 0 ? 'text-green-600' : 
                (game.analytics.momentum_analysis?.momentum_shift || 0) < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {game.analytics.momentum_analysis?.momentum_shift > 0 ? '+' : ''}
                {game.analytics.momentum_analysis?.momentum_shift || 0}
              </span>
            </div>
          </div>
        </div>

        {/* パフォーマンス指標 */}
        {game.analytics.performance_metrics && (
          <div>
            <h4 className="font-semibold mb-3">パフォーマンス指標</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>攻撃効率</span>
                  <span>{(game.analytics.performance_metrics.offensive_efficiency * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{width: `${game.analytics.performance_metrics.offensive_efficiency * 100}%`}}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>投手効率</span>
                  <span>{(game.analytics.performance_metrics.pitching_effectiveness * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{width: `${game.analytics.performance_metrics.pitching_effectiveness * 100}%`}}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>守備品質</span>
                  <span>{(game.analytics.performance_metrics.fielding_quality * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full" 
                    style={{width: `${game.analytics.performance_metrics.fielding_quality * 100}%`}}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGameInsights = (game: GameAnalytics) => {
    if (!game.insights) {
      return <p className="text-gray-600">インサイトデータがありません</p>;
    }

    return (
      <div className="space-y-6">
        {/* 重要な瞬間 */}
        {game.insights.key_moments && game.insights.key_moments.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">🔥 重要な瞬間</h4>
            <div className="space-y-3">
              {game.insights.key_moments.map((moment: any, index: number) => (
                <div key={index} className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{moment.inning}回</span>
                    <Badge variant="outline">影響度: {moment.impact_score}/10</Badge>
                  </div>
                  <p className="text-sm text-gray-700">{moment.description}</p>
                  {moment.players_involved && (
                    <div className="mt-2 text-xs text-gray-600">
                      関与選手: {moment.players_involved.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ターニングポイント */}
        {game.insights.turning_points && game.insights.turning_points.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">⚡ ターニングポイント</h4>
            <div className="space-y-3">
              {game.insights.turning_points.map((point: any, index: number) => (
                <div key={index} className="bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{point.inning}回</span>
                    <div className="text-sm">
                      <span className="text-red-600">{point.before_probability}%</span>
                      <span className="mx-2">→</span>
                      <span className="text-green-600">{point.after_probability}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{point.moment_description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* パフォーマンスハイライト */}
        {game.insights.performance_highlights && game.insights.performance_highlights.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">⭐ パフォーマンスハイライト</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {game.insights.performance_highlights.map((highlight: any, index: number) => (
                <div key={index} className="bg-green-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{highlight.player}</span>
                    <Badge variant="secondary">{highlight.team}</Badge>
                  </div>
                  <div className="text-sm text-gray-600 mb-1">
                    {highlight.performance_type}
                  </div>
                  <p className="text-sm text-gray-700">{highlight.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'live': return 'destructive';
      case 'final': return 'default';
      case 'scheduled': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'live': return '試合中';
      case 'final': return '試合終了';
      case 'scheduled': return '開始前';
      case 'postponed': return '延期';
      case 'cancelled': return '中止';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">試合分析データを読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">データ取得エラー</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <button 
            onClick={fetchGameAnalytics}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            再試行
          </button>
        </CardContent>
      </Card>
    );
  }

  if (games.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>試合データなし</CardTitle>
          <CardDescription>該当する試合データが見つかりませんでした</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {gameId && games.length === 1 ? (
        // 単一試合の詳細表示
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{games[0].teams.away.name} vs {games[0].teams.home.name}</span>
              <Badge variant={getStatusVariant(games[0].game_info.status)}>
                {getStatusLabel(games[0].game_info.status)}
              </Badge>
            </CardTitle>
            <CardDescription>
              {games[0].game_info.venue} - {games[0].date} - 包括的試合分析
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">試合概要</TabsTrigger>
                <TabsTrigger value="analytics">分析データ</TabsTrigger>
                <TabsTrigger value="insights">洞察・ハイライト</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-4">
                {renderGameOverview(games[0])}
              </TabsContent>
              
              <TabsContent value="analytics" className="mt-4">
                {renderGameAnalytics(games[0])}
              </TabsContent>
              
              <TabsContent value="insights" className="mt-4">
                {renderGameInsights(games[0])}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        // 複数試合のリスト表示
        <div className="grid gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">試合分析ダッシュボード</h2>
            <Badge variant="outline">
              {games.length}試合のデータ
            </Badge>
          </div>
          
          <div className="grid gap-4">
            {games.map((game) => (
              <Card key={game.game_id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>{game.teams.away.name} vs {game.teams.home.name}</span>
                    <div className="flex gap-2">
                      <span className="text-lg font-bold">
                        {game.teams.away.score} - {game.teams.home.score}
                      </span>
                      <Badge variant={getStatusVariant(game.game_info.status)}>
                        {getStatusLabel(game.game_info.status)}
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    {game.game_info.venue} - {game.date}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {game.analytics && (
                      <>
                        <div>
                          <span className="text-gray-600">勝利確率:</span>
                          <span className="ml-2 font-medium">
                            {(game.analytics.win_probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">レバレッジ:</span>
                          <span className="ml-2 font-medium">
                            {game.analytics.leverage_index?.toFixed(2) || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">攻撃効率:</span>
                          <span className="ml-2 font-medium">
                            {(game.analytics.performance_metrics?.offensive_efficiency * 100).toFixed(1) || '---'}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">投手効率:</span>
                          <span className="ml-2 font-medium">
                            {(game.analytics.performance_metrics?.pitching_effectiveness * 100).toFixed(1) || '---'}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {game.live_status && (
                    <div className="mt-3 p-2 bg-red-50 rounded text-sm">
                      <span className="font-medium text-red-800">🔴 ライブ:</span>
                      <span className="ml-2">
                        {game.live_status.current_situation?.inning}回
                        {game.live_status.current_situation?.half === 'top' ? '表' : '裏'}
                        - {game.live_status.current_situation?.outs}アウト
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}