'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface AdvancedPlayerStatsProps {
  playerId?: string;
  team?: string;
  entryYear?: number;
  limit?: number;
}

interface PlayerAnalytics {
  player_id: string;
  name: string;
  team: string;
  entry_year: number;
  current_stats: any;
  historical_stats: any;
  performance_comparison: any;
  update_status: any;
  analytics: {
    batting_metrics: any;
    trend_indicators: any;
    team_contribution: any;
  };
}

export default function AdvancedPlayerStats({ 
  playerId, 
  team, 
  entryYear, 
  limit = 20 
}: AdvancedPlayerStatsProps) {
  const [players, setPlayers] = useState<PlayerAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    fetchAdvancedStats();
  }, [playerId, team, entryYear, limit]);

  const fetchAdvancedStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (playerId) params.append('playerId', playerId);
      if (team) params.append('team', team);
      if (entryYear) params.append('entryYear', entryYear.toString());
      params.append('limit', limit.toString());

      const response = await fetch(`/api/analytics/players?${params}`);
      const data = await response.json();

      if (data.success) {
        setPlayers(data.data);
      } else {
        setError(data.error || 'Failed to fetch player analytics');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching advanced stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">高度な統計データを読み込み中...</span>
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
            onClick={fetchAdvancedStats}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            再試行
          </button>
        </CardContent>
      </Card>
    );
  }

  if (players.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>統計データなし</CardTitle>
          <CardDescription>該当する選手データが見つかりませんでした</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const renderPlayerOverview = (player: PlayerAnalytics) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-800">基本情報</h4>
          <p className="text-sm text-blue-600">チーム: {player.team}</p>
          <p className="text-sm text-blue-600">入団年: {player.entry_year}年</p>
          <p className="text-sm text-blue-600">
            データ品質: {player.update_status.data_quality}%
          </p>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
          <h4 className="font-semibold text-green-800">現在成績</h4>
          {player.current_stats ? (
            <>
              <p className="text-sm text-green-600">
                打率: {player.current_stats.batting_average?.toFixed(3) || '---'}
              </p>
              <p className="text-sm text-green-600">
                OPS: {player.current_stats.ops?.toFixed(3) || '---'}
              </p>
              <p className="text-sm text-green-600">
                試合数: {player.current_stats.games || 0}
              </p>
            </>
          ) : (
            <p className="text-sm text-green-600">データなし</p>
          )}
        </div>
        
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
          <h4 className="font-semibold text-purple-800">トレンド</h4>
          {player.analytics?.trend_indicators ? (
            <>
              <p className="text-sm text-purple-600">
                方向: {getTrendIcon(player.analytics.trend_indicators.trend_direction)} 
                {getTrendLabel(player.analytics.trend_indicators.trend_direction)}
              </p>
              <p className="text-sm text-purple-600">
                改善点: {player.analytics.trend_indicators.improvement_indicators?.length || 0}項目
              </p>
            </>
          ) : (
            <p className="text-sm text-purple-600">データなし</p>
          )}
        </div>
      </div>
      
      {player.update_status.has_current_data && (
        <Badge variant="outline" className="bg-green-50 text-green-700">
          ✅ 2025年データ更新済み
        </Badge>
      )}
    </div>
  );

  const renderBattingMetrics = (player: PlayerAnalytics) => {
    const metrics = player.analytics?.batting_metrics;
    if (!metrics) return <p>打撃データがありません</p>;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {metrics.batting_average?.toFixed(3) || '---'}
            </div>
            <div className="text-sm text-gray-600">打率</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {metrics.ops?.toFixed(3) || '---'}
            </div>
            <div className="text-sm text-gray-600">OPS</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {metrics.home_runs || 0}
            </div>
            <div className="text-sm text-gray-600">本塁打</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {metrics.rbis || 0}
            </div>
            <div className="text-sm text-gray-600">打点</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm">
              <span>出塁率</span>
              <span>{((metrics.on_base_percentage || 0) * 100).toFixed(1)}%</span>
            </div>
            <Progress value={(metrics.on_base_percentage || 0) * 100} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-sm">
              <span>長打率</span>
              <span>{((metrics.slugging_percentage || 0) * 100).toFixed(1)}%</span>
            </div>
            <Progress value={(metrics.slugging_percentage || 0) * 100} className="h-2" />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">出場記録</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">試合数:</span>
              <span className="font-medium ml-2">{metrics.games || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">打席:</span>
              <span className="font-medium ml-2">{metrics.at_bats || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">安打:</span>
              <span className="font-medium ml-2">{metrics.hits || 0}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTrendAnalysis = (player: PlayerAnalytics) => {
    const trends = player.analytics?.trend_indicators;
    const comparison = player.performance_comparison;
    
    if (!trends && !comparison) return <p>トレンドデータがありません</p>;

    return (
      <div className="space-y-6">
        {trends && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
            <h4 className="font-semibold text-indigo-800 mb-3">
              {getTrendIcon(trends.trend_direction)} 
              パフォーマンストレンド: {getTrendLabel(trends.trend_direction)}
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`text-lg font-bold ${
                  (trends.batting_average_change || 0) > 0 ? 'text-green-600' : 
                  (trends.batting_average_change || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {(trends.batting_average_change > 0 ? '+' : '') + 
                   (trends.batting_average_change?.toFixed(3) || '0.000')}
                </div>
                <div className="text-sm text-gray-600">打率変化</div>
              </div>
              
              <div className="text-center">
                <div className={`text-lg font-bold ${
                  (trends.power_change || 0) > 0 ? 'text-green-600' : 
                  (trends.power_change || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {(trends.power_change > 0 ? '+' : '') + (trends.power_change || 0)}
                </div>
                <div className="text-sm text-gray-600">本塁打変化</div>
              </div>
              
              <div className="text-center">
                <div className={`text-lg font-bold ${
                  (trends.production_change || 0) > 0 ? 'text-green-600' : 
                  (trends.production_change || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {(trends.production_change > 0 ? '+' : '') + (trends.production_change || 0)}
                </div>
                <div className="text-sm text-gray-600">打点変化</div>
              </div>
              
              <div className="text-center">
                <div className={`text-lg font-bold ${
                  (trends.overall_change || 0) > 0 ? 'text-green-600' : 
                  (trends.overall_change || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {(trends.overall_change > 0 ? '+' : '') + 
                   (trends.overall_change?.toFixed(3) || '0.000')}
                </div>
                <div className="text-sm text-gray-600">OPS変化</div>
              </div>
            </div>
          </div>
        )}

        {trends?.improvement_indicators && trends.improvement_indicators.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">🔥 成長指標</h4>
            <div className="flex flex-wrap gap-2">
              {trends.improvement_indicators.map((indicator: string, index: number) => (
                <Badge key={index} variant="secondary" className="bg-green-100 text-green-800">
                  {indicator}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {player.analytics?.team_contribution && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">チーム貢献度</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">攻撃貢献:</span>
                <span className="font-medium ml-2">
                  {player.analytics.team_contribution.offensive_contribution}
                </span>
              </div>
              <div>
                <span className="text-gray-600">試合影響:</span>
                <span className="font-medium ml-2">
                  {player.analytics.team_contribution.game_impact_score}
                </span>
              </div>
              <div>
                <span className="text-gray-600">出場貢献:</span>
                <span className="font-medium ml-2">
                  {player.analytics.team_contribution.games_contribution}試合
                </span>
              </div>
              <div>
                <span className="text-gray-600">一貫性:</span>
                <span className="font-medium ml-2">
                  {player.analytics.team_contribution.consistency_rating}/10
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  const getTrendLabel = (direction: string) => {
    switch (direction) {
      case 'improving': return '向上中';
      case 'declining': return '下降中';
      default: return '安定';
    }
  };

  return (
    <div className="space-y-6">
      {playerId && players.length === 1 ? (
        // 単一選手の詳細表示
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{players[0].name}</span>
              <Badge variant="outline">
                {players[0].update_status.data_quality}% データ品質
              </Badge>
            </CardTitle>
            <CardDescription>
              {players[0].team} - {players[0].entry_year}年入団 - 高度統計分析
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">概要</TabsTrigger>
                <TabsTrigger value="batting">打撃成績</TabsTrigger>
                <TabsTrigger value="trends">トレンド分析</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-4">
                {renderPlayerOverview(players[0])}
              </TabsContent>
              
              <TabsContent value="batting" className="mt-4">
                {renderBattingMetrics(players[0])}
              </TabsContent>
              
              <TabsContent value="trends" className="mt-4">
                {renderTrendAnalysis(players[0])}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        // 複数選手のリスト表示
        <div className="grid gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">高度統計分析</h2>
            <Badge variant="outline">
              {players.length}名の選手データ
            </Badge>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <Card key={player.player_id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{player.name}</CardTitle>
                  <CardDescription>
                    {player.team} - {player.entry_year}年入団
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {player.current_stats && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span>打率: {player.current_stats.batting_average?.toFixed(3) || '---'}</span>
                        <span>OPS: {player.current_stats.ops?.toFixed(3) || '---'}</span>
                        <span>本塁打: {player.current_stats.home_runs || 0}</span>
                        <span>打点: {player.current_stats.rbis || 0}</span>
                      </div>
                    )}
                    
                    {player.analytics?.trend_indicators && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {getTrendIcon(player.analytics.trend_indicators.trend_direction)}
                          {getTrendLabel(player.analytics.trend_indicators.trend_direction)}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={
                            player.update_status.has_current_data 
                              ? "bg-green-50 text-green-700" 
                              : "bg-yellow-50 text-yellow-700"
                          }
                        >
                          {player.update_status.has_current_data ? '最新' : '更新中'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}