"use client";
import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft, Clock, Users, BarChart3 } from 'lucide-react';

type PBPEvent = {
  game_id: string;
  ts: string;
  inning: number;
  half: string;
  batter: string;
  pitcher: string;
  pitch_seq: number;
  result: string;
  count_b: number;
  count_s: number;
  count_o: number;
  bases: string;
  away_runs: number;
  home_runs: number;
  wp_before: number;
  wp_after: number;
  pitch_type?: string;
  speed?: number;
  leverage?: number;
  re_before?: number;
  re_after?: number;
};

type PBPResponse = {
  source: string;
  game_id: string;
  total_events: number;
  events: PBPEvent[];
  last_updated: string;
};

type GameSummary = {
  game_id: string;
  latest_event: PBPEvent | null;
  stats: {
    total_pitches: number;
    strikes: number;
    balls: number;
    in_play: number;
    away_runs: number;
    home_runs: number;
    max_inning: number;
  } | null;
  has_pbp_data: boolean;
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(r => r.json());

export default function GameLive({ params }: { params: { game_id: string } }) {
  const { data: pbpData, error: pbpError } = useSWR<PBPResponse>(
    `${API}/pbp?game_id=${params.game_id}&limit=50`, 
    fetcher, 
    { refreshInterval: 15000, revalidateOnFocus: false }
  );

  const { data: summaryData } = useSWR<GameSummary>(
    `${API}/pbp/summary/${params.game_id}`, 
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false }
  );

  const formatInning = (inning: number, half: string) => {
    return half === "TOP" ? `${inning}表` : `${inning}裏`;
  };

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getResultBadge = (result: string) => {
    const baseClasses = "text-xs px-2 py-1 rounded font-medium";
    switch (result) {
      case "Strike":
        return `${baseClasses} bg-red-600 text-white`;
      case "Ball":
        return `${baseClasses} bg-blue-600 text-white`;
      case "InPlay":
        return `${baseClasses} bg-green-600 text-white`;
      case "Foul":
        return `${baseClasses} bg-yellow-600 text-black`;
      default:
        return `${baseClasses} bg-slate-600 text-white`;
    }
  };

  if (pbpError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6">
            <ArrowLeft className="w-4 h-4" />
            今日の試合に戻る
          </Link>
          <div className="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold mb-2">⚠️ データ取得エラー</h2>
            <p className="text-red-300">このゲームの詳細データを取得できませんでした</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300">
              <ArrowLeft className="w-4 h-4" />
              今日の試合
            </Link>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="w-4 h-4" />
              {pbpData?.last_updated && `最終更新: ${formatTime(pbpData.last_updated)}`}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Game Header */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">⚾ 一球速報</h1>
          <div className="text-lg text-slate-300">
            Game ID: <span className="font-mono text-blue-300">{params.game_id}</span>
          </div>
          
          {summaryData?.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{summaryData.stats.total_pitches}</div>
                <div className="text-xs text-slate-400">総投球数</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">
                  {summaryData.stats.away_runs}-{summaryData.stats.home_runs}
                </div>
                <div className="text-xs text-slate-400">スコア</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-400">{summaryData.stats.max_inning}</div>
                <div className="text-xs text-slate-400">イニング</div>
              </div>
              <div className="text-center">
                <div className="text-sm">
                  <span className="text-red-400">{summaryData.stats.strikes}</span>/
                  <span className="text-blue-400">{summaryData.stats.balls}</span>/
                  <span className="text-green-400">{summaryData.stats.in_play}</span>
                </div>
                <div className="text-xs text-slate-400">S/B/Play</div>
              </div>
            </div>
          )}
        </div>

        {/* PBP Events */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              投球記録
              {pbpData && (
                <span className="text-sm text-slate-400">
                  （直近{pbpData.total_events}球）
                </span>
              )}
            </h2>
          </div>
          
          {!pbpData && (
            <div className="p-8 text-center">
              <div className="animate-pulse">
                <div className="text-slate-400">データを読み込み中...</div>
              </div>
            </div>
          )}
          
          {pbpData && pbpData.total_events === 0 && (
            <div className="p-8 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>まだ投球データがありません</p>
            </div>
          )}

          {pbpData && pbpData.events.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">回</th>
                    <th className="px-3 py-2 text-left">打者</th>
                    <th className="px-3 py-2 text-left">投手</th>
                    <th className="px-3 py-2 text-left">結果</th>
                    <th className="px-3 py-2 text-center">カウント</th>
                    <th className="px-3 py-2 text-center">走者</th>
                    <th className="px-3 py-2 text-center">得点</th>
                    <th className="px-3 py-2 text-center">勝率</th>
                    <th className="px-3 py-2 text-center">球種</th>
                    <th className="px-3 py-2 text-right">時刻</th>
                  </tr>
                </thead>
                <tbody>
                  {pbpData.events.map((event, index) => (
                    <tr 
                      key={event.pitch_seq} 
                      className={`border-b border-slate-700 hover:bg-slate-750 ${
                        index === 0 ? 'bg-slate-750' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-sm">{event.pitch_seq}</td>
                      <td className="px-3 py-2 text-sm">{formatInning(event.inning, event.half)}</td>
                      <td className="px-3 py-2 text-sm">{event.batter}</td>
                      <td className="px-3 py-2 text-sm">{event.pitcher}</td>
                      <td className="px-3 py-2">
                        <span className={getResultBadge(event.result)}>
                          {event.result}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-sm">
                        {event.count_b}-{event.count_s}-{event.count_o}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-sm">{event.bases}</td>
                      <td className="px-3 py-2 text-center font-mono text-sm">
                        {event.away_runs}-{event.home_runs}
                      </td>
                      <td className="px-3 py-2 text-center text-sm">
                        {event.wp_after?.toFixed(3) || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm">
                        {event.pitch_type || '-'}
                        {event.speed && (
                          <div className="text-xs text-slate-400">
                            {event.speed.toFixed(1)}km/h
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">
                        {formatTime(event.ts)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Auto-refresh notice */}
        <div className="mt-4 text-center text-xs text-slate-500">
          📡 15秒間隔で自動更新中...
        </div>
      </div>
    </div>
  );
}