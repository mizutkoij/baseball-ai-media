'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface PitchData {
  id?: number;
  game_id: string;
  index_code?: string;
  inning?: number;
  side?: string;
  pitch_sequence: number;
  pitcher_name?: string;
  batter_name?: string;
  pitch_type: string;
  velocity: string | number;
  zone?: string;
  result: string;
  balls?: number;
  strikes?: number;
  count?: string;
  runners?: string;
  outs?: number;
  created_at?: string;
  scraped_at?: string;
}

interface InningData {
  inning: number;
  side: string;
  pitches: PitchData[];
}

interface PitchByPitchTabProps {
  gameId: string;
}

export function PitchByPitchTab({ gameId }: PitchByPitchTabProps) {
  const [pitchData, setPitchData] = useState<InningData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInning, setSelectedInning] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<string | null>(null);

  useEffect(() => {
    fetchPitchData();
  }, [gameId]);

  const fetchPitchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // まずYahooスクレイピングデータを確認
      const yahooResponse = await fetch(`/api/yahoo-pitch-data?type=game&gameId=${gameId}`);
      
      if (yahooResponse.ok) {
        const yahooData = await yahooResponse.json();
        
        if (yahooData.success && yahooData.data && yahooData.data.length > 0) {
          console.log('Yahoo pitch data available:', yahooData.data.length, 'pitches');
          
          // Yahooデータをイニング別にグループ化（index_codeから推測）
          const groupedData = groupYahooPitchesByBatter(yahooData.data);
          setPitchData(groupedData);
          
          if (groupedData.length > 0) {
            setSelectedInning(1);
            setSelectedSide('top');
          }
          return;
        }
      }

      // フォールバック: NPBデータベースから一球速報データを取得
      console.log('Falling back to NPB database');
      const response = await fetch(`/api/games/${gameId}/pitch-by-pitch`);
      
      if (!response.ok) {
        throw new Error('一球速報データの取得に失敗しました');
      }

      const data = await response.json();
      
      if (data.success) {
        // イニング・サイド別にグループ化
        const groupedData = groupPitchesByInning(data.data);
        setPitchData(groupedData);
        
        // 最初のイニングを自動選択
        if (groupedData.length > 0) {
          setSelectedInning(groupedData[0].inning);
          setSelectedSide(groupedData[0].side);
        }
      } else {
        setError(data.error || '一球速報データが見つかりません');
      }
    } catch (err) {
      setError('一球速報データの取得中にエラーが発生しました');
      console.error('Pitch data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupYahooPitchesByBatter = (pitches: PitchData[]): InningData[] => {
    const grouped = new Map<string, PitchData[]>();
    
    pitches.forEach(pitch => {
      // index_codeから推測（例: 0110100 -> 1回表1番）
      const indexCode = pitch.index_code || '';
      const inning = Math.floor(parseInt(indexCode.substring(0, 2)) / 10) || 1;
      const side = indexCode.charAt(1) === '1' ? 'top' : 'bottom';
      const key = `${inning}-${side}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(pitch);
    });

    return Array.from(grouped.entries()).map(([key, pitches]) => {
      const [inning, side] = key.split('-');
      return {
        inning: parseInt(inning),
        side,
        pitches: pitches.sort((a, b) => a.pitch_sequence - b.pitch_sequence)
      };
    }).sort((a, b) => {
      if (a.inning !== b.inning) return a.inning - b.inning;
      return a.side === 'top' ? -1 : 1;
    });
  };

  const groupPitchesByInning = (pitches: PitchData[]): InningData[] => {
    const grouped = new Map<string, PitchData[]>();
    
    pitches.forEach(pitch => {
      const key = `${pitch.inning}-${pitch.side}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(pitch);
    });

    return Array.from(grouped.entries()).map(([key, pitches]) => {
      const [inning, side] = key.split('-');
      return {
        inning: parseInt(inning),
        side,
        pitches: pitches.sort((a, b) => a.pitch_sequence - b.pitch_sequence)
      };
    }).sort((a, b) => {
      if (a.inning !== b.inning) return a.inning - b.inning;
      return a.side === '表' ? -1 : 1;
    });
  };

  const getSelectedInningData = () => {
    return pitchData.find(data => 
      data.inning === selectedInning && data.side === selectedSide
    );
  };

  const formatVelocity = (velocity: string | number) => {
    if (typeof velocity === 'string') {
      return velocity === '-' || velocity === '' ? '-' : velocity;
    }
    return velocity > 0 ? `${velocity}km/h` : '-';
  };

  const formatCount = (balls: number, strikes: number) => {
    return `${balls}-${strikes}`;
  };

  const getResultColor = (result: string) => {
    if (result.includes('ストライク') || result.includes('空振り')) {
      return 'text-blue-600 bg-blue-50';
    }
    if (result.includes('ボール')) {
      return 'text-green-600 bg-green-50';
    }
    if (result.includes('ヒット') || result.includes('安打')) {
      return 'text-orange-600 bg-orange-50';
    }
    if (result.includes('アウト')) {
      return 'text-red-600 bg-red-50';
    }
    return 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-red-600 mb-4">{error}</div>
            <button 
              onClick={fetchPitchData}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              再試行
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pitchData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            一球速報データはまだ収集されていません
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedData = getSelectedInningData();

  return (
    <div className="space-y-6">
      {/* イニング選択 */}
      <Card>
        <CardHeader>
          <CardTitle>イニング選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-2">
            {pitchData.map((data) => (
              <button
                key={`${data.inning}-${data.side}`}
                onClick={() => {
                  setSelectedInning(data.inning);
                  setSelectedSide(data.side);
                }}
                className={`p-2 text-sm rounded border ${
                  selectedInning === data.inning && selectedSide === data.side
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white hover:bg-gray-50 border-gray-300'
                }`}
              >
                {data.inning}回{data.side}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 一球速報詳細 */}
      {selectedData && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedData.inning}回{selectedData.side} 一球速報
              <span className="ml-4 text-sm font-normal text-gray-600">
                ({selectedData.pitches.length}球)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedData.pitches.map((pitch, index) => (
                <div
                  key={pitch.id || `${pitch.game_id}-${pitch.index_code}-${pitch.pitch_sequence}`}
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {pitch.pitch_sequence}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {pitch.outs ? `${pitch.outs}アウト` : ''}
                          {pitch.count ? `| カウント: ${pitch.count}` : (pitch.balls !== undefined && pitch.strikes !== undefined ? `| カウント: ${formatCount(pitch.balls, pitch.strikes)}` : '')}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {pitch.created_at ? pitch.created_at.substring(11, 19) : 
                       pitch.scraped_at ? pitch.scraped_at.substring(11, 19) : ''}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-sm font-medium text-gray-600">投手</div>
                      <div className="font-medium">{pitch.pitcher_name}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600">打者</div>
                      <div className="font-medium">{pitch.batter_name}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-gray-600">球種</div>
                      <div className="font-medium">{pitch.pitch_type || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">球速</div>
                      <div className="font-medium">{formatVelocity(pitch.velocity)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">コース</div>
                      <div className="font-medium">{pitch.zone || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">結果</div>
                      <div className={`text-sm font-medium px-2 py-1 rounded ${getResultColor(pitch.result)}`}>
                        {pitch.result}
                      </div>
                    </div>
                  </div>

                  {pitch.runners && (
                    <div className="text-sm">
                      <span className="text-gray-600">ランナー:</span> {pitch.runners}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 統計サマリー */}
      {selectedData && (
        <Card>
          <CardHeader>
            <CardTitle>投球統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {selectedData.pitches.length}
                </div>
                <div className="text-sm text-gray-600">総投球数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {selectedData.pitches.filter(p => p.result.includes('ストライク')).length}
                </div>
                <div className="text-sm text-gray-600">ストライク</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {selectedData.pitches.filter(p => p.result.includes('ボール')).length}
                </div>
                <div className="text-sm text-gray-600">ボール</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {selectedData.pitches.filter(p => p.velocity > 0).length > 0 
                    ? Math.round(
                        selectedData.pitches.filter(p => p.velocity > 0)
                          .reduce((sum, p) => sum + p.velocity, 0) /
                        selectedData.pitches.filter(p => p.velocity > 0).length
                      )
                    : 0}
                </div>
                <div className="text-sm text-gray-600">平均球速(km/h)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PitchByPitchTab;