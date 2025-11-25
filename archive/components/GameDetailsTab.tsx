'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface GameInfo {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  venue: string;
  status: string;
  league: string;
}

interface GameLineup {
  home_lineup: Array<{
    batting_order: number;
    position: string;
    player_name: string;
    position_name: string;
  }>;
  away_lineup: Array<{
    batting_order: number;
    position: string;
    player_name: string;
    position_name: string;
  }>;
  home_battery: {
    starter: string;
    catcher: string;
    bullpen: string[];
  };
  away_battery: {
    starter: string;
    catcher: string;
    bullpen: string[];
  };
  home_bench: string[];
  away_bench: string[];
  officials: {
    chief_umpire: string;
    first_base: string;
    second_base: string;
    third_base: string;
  };
}

interface GameDetailsTabProps {
  gameId: string;
}

export function GameDetailsTab({ gameId }: GameDetailsTabProps) {
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [lineup, setLineup] = useState<GameLineup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGameDetails();
  }, [gameId]);

  const fetchGameDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Yahoo試合データから詳細情報を取得
      const response = await fetch(`/api/yahoo-data?type=game-detail&gameId=${gameId}`);
      const data = await response.json();

      if (data.success) {
        setGameInfo(data.data.game);
        
        // ラインナップ情報も取得（将来の拡張）
        // const lineupResponse = await fetch(`/api/yahoo-data?type=lineup&gameId=${gameId}`);
        // if (lineupResponse.ok) {
        //   const lineupData = await lineupResponse.json();
        //   setLineup(lineupData.data);
        // }
      } else {
        setError(data.error || '試合情報の取得に失敗しました');
      }
    } catch (err) {
      setError('データの取得中にエラーが発生しました');
      console.error('Game details fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
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
          <div className="text-red-600">{error}</div>
          <button 
            onClick={fetchGameDetails}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            再試行
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 試合基本情報 */}
      {gameInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {gameInfo.away_team} vs {gameInfo.home_team}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">日時</div>
                <div className="text-lg">{gameInfo.date}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">球場</div>
                <div className="text-lg">{gameInfo.venue}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">リーグ</div>
                <div className="text-lg">{gameInfo.league}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">状況</div>
                <div className={`text-lg font-medium ${
                  gameInfo.status === '試合終了' ? 'text-green-600' :
                  gameInfo.status === '試合中' ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {gameInfo.status}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* スターティングメンバー（模擬データ） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{gameInfo?.away_team} スターティングメンバー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { order: 1, position: '中', name: '近藤 健介', pos_name: '中堅手' },
                { order: 2, position: '二', name: '中島 卓也', pos_name: '二塁手' },
                { order: 3, position: '指', name: '清宮 幸太郎', pos_name: '指名打者' },
                { order: 4, position: '三', name: '万波 中正', pos_name: '三塁手' },
                { order: 5, position: '左', name: '松本 剛', pos_name: '左翼手' },
                { order: 6, position: '一', name: '宇佐見 真吾', pos_name: '一塁手' },
                { order: 7, position: '右', name: '福田 俊', pos_name: '右翼手' },
                { order: 8, position: '捕', name: '郡司 裕也', pos_name: '捕手' },
                { order: 9, position: '遊', name: '平沢 大河', pos_name: '遊撃手' }
              ].map((player) => (
                <div key={player.order} className="flex items-center gap-3 py-2 border-b border-gray-100">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {player.order}
                  </div>
                  <div className="w-8 text-center font-medium">{player.position}</div>
                  <div className="flex-1 font-medium">{player.name}</div>
                  <div className="text-sm text-gray-500">{player.pos_name}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{gameInfo?.home_team} スターティングメンバー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { order: 1, position: '中', name: '佐藤 輝明', pos_name: '中堅手' },
                { order: 2, position: '右', name: '近本 光司', pos_name: '右翼手' },
                { order: 3, position: '指', name: '大山 悠輔', pos_name: '指名打者' },
                { order: 4, position: '一', name: '佐藤 輝明', pos_name: '一塁手' },
                { order: 5, position: '三', name: '中野 拓夢', pos_name: '三塁手' },
                { order: 6, position: '左', name: '森下 翔太', pos_name: '左翼手' },
                { order: 7, position: '二', name: '木浪 聖也', pos_name: '二塁手' },
                { order: 8, position: '捕', name: '坂本 誠志郎', pos_name: '捕手' },
                { order: 9, position: '遊', name: '木浪 聖也', pos_name: '遊撃手' }
              ].map((player) => (
                <div key={player.order} className="flex items-center gap-3 py-2 border-b border-gray-100">
                  <div className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {player.order}
                  </div>
                  <div className="w-8 text-center font-medium">{player.position}</div>
                  <div className="flex-1 font-medium">{player.name}</div>
                  <div className="text-sm text-gray-500">{player.pos_name}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* バッテリー情報 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">バッテリー・ベンチ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">先発投手</div>
                <div className="font-medium">田中 将大</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">先発捕手</div>
                <div className="font-medium">郡司 裕也</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">ブルペン</div>
                <div className="text-sm space-y-1">
                  <div>宮西 尚生 (左)</div>
                  <div>河野 竜生 (右)</div>
                  <div>栗山 巧 (右)</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">ベンチ入り</div>
                <div className="text-sm space-y-1">
                  <div>五十幡 亮汰 (外)</div>
                  <div>石井 一成 (内)</div>
                  <div>谷内 亮太 (捕)</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">審判員</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">球審</span>
                <span className="font-medium">橘高 淳</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">一塁</span>
                <span className="font-medium">深謝 大</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">二塁</span>
                <span className="font-medium">川口 高史</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">三塁</span>
                <span className="font-medium">岩下 修一</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default GameDetailsTab;