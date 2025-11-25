"use client";

import { useEffect, useState } from "react";

const LIVE_API = process.env.NEXT_PUBLIC_LIVE_API_BASE || "http://127.0.0.1:8787";

interface NextPitchPanelProps {
  gameId: string;
}

export default function NextPitchPanel({ gameId }: NextPitchPanelProps) {
  const [top3, setTop3] = useState<{label:string; prob:number}[]|null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    
    try {
      const streamUrl = `${LIVE_API}/live/${gameId}/stream`;
      eventSource = new EventSource(streamUrl);
      
      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
      };

      eventSource.addEventListener("nextpitch", (e: any) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setTop3(data?.top3 || null);
        } catch (parseError) {
          console.error('Failed to parse nextpitch data:', parseError);
        }
      });

      eventSource.onerror = (e) => {
        console.error('SSE connection error:', e);
        setConnected(false);
        setError('接続エラー');
      };

      return () => {
        if (eventSource) {
          eventSource.close();
        }
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setError('接続に失敗');
      return () => {};
    }
  }, [gameId]);

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-400 text-sm mb-2">⚠️ {error}</div>
        <div className="text-xs text-slate-500">
          SSEサーバーに接続できません
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400 mx-auto mb-2"></div>
        <div className="text-slate-400 text-sm">接続中...</div>
      </div>
    );
  }

  if (!top3) {
    return (
      <div className="text-center py-8">
        <div className="text-slate-400 text-sm mb-2">📡 待機中...</div>
        <div className="text-xs text-slate-500">
          次球予測データを待っています
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <div className="text-xs text-green-400">Live</div>
      </div>
      
      <ul className="space-y-2">
        {top3.map((prediction, index) => (
          <li key={prediction.label} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? 'bg-yellow-600 text-white' : 
                index === 1 ? 'bg-gray-600 text-white' : 
                'bg-orange-800 text-white'
              }`}>
                {index + 1}
              </div>
              <span className="text-white">{prediction.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-16 h-2 bg-gray-700 rounded-full overflow-hidden`}>
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-500' : 
                    'bg-orange-600'
                  }`}
                  style={{ width: `${prediction.prob * 100}%` }}
                ></div>
              </div>
              <span className="text-slate-300 text-sm font-mono min-w-[40px] text-right">
                {(prediction.prob * 100).toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
      
      <div className="text-xs text-slate-500 text-center mt-4">
        リアルタイム次球予測 - Game: {gameId}
      </div>
    </div>
  );
}