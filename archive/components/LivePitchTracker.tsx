'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface LivePitchData {
  game_id: string;
  index_code: string;
  pitch_sequence: number;
  pitch_type: string;
  velocity: string;
  result: string;
  count: string;
  scraped_at: string;
}

export default function LivePitchTracker() {
  const [liveData, setLiveData] = useState<LivePitchData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('--:--:--');
  const [mounted, setMounted] = useState(false);

  const fetchLiveData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/yahoo-pitch-data?type=live');
      
      if (!response.ok) {
        throw new Error('ライブデータの取得に失敗しました');
      }

      const data = await response.json();
      
      if (data.success) {
        // データのバリデーションとフィルタリング
        const validData = (data.data || []).filter((pitch: any) => {
          // 基本フィールドの存在チェック
          if (!pitch.game_id || !pitch.index_code || !pitch.scraped_at) {
            return false;
          }
          
          // 不正なgame_idを除外（コメントや特殊文字を含むもの）
          if (pitch.game_id.includes('[') || pitch.game_id.includes('ワンバウンド') || pitch.game_id.length > 15) {
            return false;
          }
          
          // pitch_sequenceが異常に大きい値を除外
          if (pitch.pitch_sequence > 100) {
            return false;
          }
          
          // scraped_atが有効な日付文字列かチェック
          const date = new Date(pitch.scraped_at);
          if (isNaN(date.getTime())) {
            return false;
          }
          
          return true;
        });
        
        setLiveData(validData);
        setLastUpdated(new Date().toLocaleTimeString('ja-JP'));
      } else {
        setError(data.error || 'ライブデータが見つかりません');
      }
    } catch (err) {
      setError('ライブデータの取得中にエラーが発生しました');
      console.error('Live data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchLiveData();
    
    // 30秒ごとに更新
    const interval = setInterval(fetchLiveData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatGameId = (gameId: string | undefined) => {
    if (!gameId || gameId.length < 4) return '不明';
    // 通常のゲームIDの形式 (例: 2021030342) から短縮版を作成
    if (gameId.length >= 10) {
      return gameId.substring(0, 4) + '...' + gameId.substring(gameId.length - 2);
    }
    return gameId;
  };

  const getVelocityColor = (velocity: string | undefined) => {
    if (!velocity || velocity === '-') return 'text-gray-600';
    const speed = parseInt(velocity.replace(/[^\d]/g, ''));
    if (isNaN(speed) || speed === 0) return 'text-gray-600';
    if (speed >= 150) return 'text-red-600 font-bold';
    if (speed >= 140) return 'text-orange-600 font-semibold';
    if (speed >= 130) return 'text-blue-600';
    return 'text-gray-600';
  };

  const getPitchTypeColor = (pitchType: string | undefined) => {
    if (!pitchType || pitchType === '-') return 'bg-gray-100 text-gray-800';
    if (pitchType.includes('ストレート')) return 'bg-red-100 text-red-800';
    if (pitchType.includes('スライダー')) return 'bg-blue-100 text-blue-800';
    if (pitchType.includes('カーブ')) return 'bg-green-100 text-green-800';
    if (pitchType.includes('フォーク')) return 'bg-purple-100 text-purple-800';
    if (pitchType.includes('チェンジアップ')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getResultColor = (result: string | undefined) => {
    if (!result) return 'bg-gray-50 text-gray-700';
    if (result.includes('ストライク') || result.includes('見逃し')) {
      return 'bg-blue-50 text-blue-700';
    }
    if (result.includes('ボール')) {
      return 'bg-green-50 text-green-700';
    }
    if (result.includes('ヒット') || result.includes('安打')) {
      return 'bg-orange-50 text-orange-700';
    }
    if (result.includes('アウト')) {
      return 'bg-red-50 text-red-700';
    }
    return 'bg-gray-50 text-gray-700';
  };

  if (loading && liveData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔴 ライブ一球速報
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            🔴 ライブ一球速報
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          </span>
          <span className="text-sm font-normal text-gray-500">
            最終更新: {mounted ? lastUpdated : '--:--:--'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <div className="text-red-600 mb-2">{error}</div>
            <button 
              onClick={fetchLiveData}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              再読み込み
            </button>
          </div>
        ) : liveData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            現在収集中のライブデータがありません
          </div>
        ) : (
          <div className="space-y-3">
            {liveData.map((pitch, index) => (
              <div key={`${pitch.game_id}-${pitch.index_code}-${pitch.pitch_sequence}`} 
                   className="border rounded-lg p-4 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {pitch.pitch_sequence}
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        試合ID: {formatGameId(pitch.game_id)}
                      </div>
                      <div className="text-xs text-gray-500">
                        打席: {pitch.index_code} | カウント: {pitch.count}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {pitch.scraped_at 
                      ? pitch.scraped_at.substring(0, 19).replace('T', ' ')
                      : '不明'}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="text-xs text-gray-600">球種</div>
                    <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPitchTypeColor(pitch.pitch_type)}`}>
                      {pitch.pitch_type || '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">球速</div>
                    <div className={`font-bold ${getVelocityColor(pitch.velocity)}`}>
                      {pitch.velocity || '-'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-gray-600">結果</div>
                    <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getResultColor(pitch.result)}`}>
                      {pitch.result || '-'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}