import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdvancedPlayerStats from '@/components/AdvancedPlayerStats';
import GameAnalyticsDashboard from '@/components/GameAnalyticsDashboard';

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">NPB 高度分析ダッシュボード</h1>
        <p className="text-gray-600">
          包括的な選手統計と試合分析データを提供します
        </p>
      </div>

      <Tabs defaultValue="players" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="players">選手分析</TabsTrigger>
          <TabsTrigger value="games">試合分析</TabsTrigger>
        </TabsList>

        <TabsContent value="players">
          <div className="space-y-6">
            {/* 選手分析セクション */}
            <Card>
              <CardHeader>
                <CardTitle>選手統計分析</CardTitle>
                <CardDescription>
                  137名の選手（2021-2022年入団）の包括的な成績データと分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">137</div>
                    <div className="text-sm text-blue-800">対象選手数</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">100%</div>
                    <div className="text-sm text-green-800">2025年データ更新率</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">47</div>
                    <div className="text-sm text-purple-800">高品質レコード数</div>
                  </div>
                </div>
                
                <AdvancedPlayerStats limit={20} />
              </CardContent>
            </Card>

            {/* 2021年入団選手特集 */}
            <Card>
              <CardHeader>
                <CardTitle>2021年入団選手（134名）</CardTitle>
                <CardDescription>
                  ルーキーイヤーから5年目を迎える選手たちの成長分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdvancedPlayerStats entryYear={2021} limit={12} />
              </CardContent>
            </Card>

            {/* 2022年入団選手特集 */}
            <Card>
              <CardHeader>
                <CardTitle>2022年入団選手（3名）</CardTitle>
                <CardDescription>
                  4年目を迎える注目選手の詳細分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdvancedPlayerStats entryYear={2022} limit={10} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="games">
          <div className="space-y-6">
            {/* 試合分析セクション */}
            <Card>
              <CardHeader>
                <CardTitle>試合詳細分析</CardTitle>
                <CardDescription>
                  包括的な試合データと高度な分析指標
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">🔴</div>
                    <div className="text-sm text-red-800">リアルタイム監視</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">📊</div>
                    <div className="text-sm text-blue-800">高度分析</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">⚡</div>
                    <div className="text-sm text-green-800">勢い分析</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">🧠</div>
                    <div className="text-sm text-purple-800">AI洞察</div>
                  </div>
                </div>
                
                <GameAnalyticsDashboard includeAnalytics={true} />
              </CardContent>
            </Card>

            {/* 本日の試合 */}
            <Card>
              <CardHeader>
                <CardTitle>本日の試合</CardTitle>
                <CardDescription>
                  今日開催予定・進行中の試合の詳細分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GameAnalyticsDashboard 
                  date={new Date().toISOString().split('T')[0]}
                  includeAnalytics={true}
                />
              </CardContent>
            </Card>

            {/* ライブ試合監視 */}
            <Card>
              <CardHeader>
                <CardTitle>ライブ試合監視</CardTitle>
                <CardDescription>
                  進行中の試合のリアルタイム更新と重要な展開の追跡
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GameAnalyticsDashboard 
                  status="live"
                  includeAnalytics={true}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* データソース情報 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>データソースと更新情報</CardTitle>
          <CardDescription>
            分析データの詳細情報
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-semibold">選手統計データ</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 2021年入団: 134名（100%更新完了）</li>
                <li>• 2022年入団: 3名（100%更新完了）</li>
                <li>• BaseballData.jp統合済み</li>
                <li>• 2025年現在シーズン対応</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">試合分析データ</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• NPB公式データ統合</li>
                <li>• リアルタイム監視システム</li>
                <li>• 勝利確率・レバレッジ分析</li>
                <li>• 勢い変化検出機能</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">更新頻度</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 選手統計: 毎日更新</li>
                <li>• 試合データ: リアルタイム</li>
                <li>• 分析指標: 30秒間隔</li>
                <li>• 最終更新: {new Date().toLocaleString('ja-JP')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}