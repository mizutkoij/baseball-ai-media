"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, TrendingUp, Target, Activity } from 'lucide-react';

type GameData = {
  game: {
    game_id: string;
    league: string;
    date: string;
    start_time_jst: string;
    venue: string;
    status: string;
    inning: string | null;
    away_team: string;
    home_team: string;
    away_score: number | null;
    home_score: number | null;
    links: any;
  };
  lineups: Record<string, any[]>;
  batting: Record<string, any[]>;
  pitching: Record<string, any[]>;
  stats_summary: {
    lineups_count: number;
    batting_count: number;
    pitching_count: number;
  };
};

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lineups' | 'batting' | 'pitching'>('batting');

  useEffect(() => {
    if (!gameId) return;

    fetch(`/api/games/${gameId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setGameData(data);
        }
      })
      .catch(err => {
        setError('Failed to load game data');
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [gameId]);

  const formatStatus = (status: string, inning: string | null) => {
    switch (status) {
      case "SCHEDULED":
        return "試合前";
      case "IN_PROGRESS":
        return inning || "試合中";
      case "FINAL":
        return "試合終了";
      case "POSTPONED":
        return "中止";
      default:
        return status;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-slate-400">試合データを読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-4">データ取得エラー</h1>
            <p className="text-slate-300 mb-4">{error || '試合データの読み込みに失敗しました。'}</p>
            <Link
              href="/schedule"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              スケジュールに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { game, lineups, batting, pitching, stats_summary } = gameData;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/schedule"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            スケジュールに戻る
          </Link>
          
          {/* Game Info */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  {game.away_team} vs {game.home_team}
                </h1>
                <p className="text-slate-300">
                  {formatDate(game.date)} {game.start_time_jst} | {game.venue}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-4 text-3xl font-bold text-white mb-2">
                  <span>{game.away_score ?? "−"}</span>
                  <span className="text-slate-500">−</span>
                  <span>{game.home_score ?? "−"}</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  game.status === 'FINAL' ? 'bg-blue-100 text-blue-800' :
                  game.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {formatStatus(game.status, game.inning)}
                </span>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{stats_summary.lineups_count}選手登録</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                <span>{stats_summary.batting_count}打撃成績</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="w-4 h-4" />
                <span>{stats_summary.pitching_count}投手成績</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg mb-6">
          <div className="flex border-b border-white/10">
            {[
              { key: 'batting', label: '打撃成績', icon: Target },
              { key: 'pitching', label: '投手成績', icon: Activity },
              { key: 'lineups', label: 'スタメン', icon: Users }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === key
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'batting' && (
              <div className="space-y-6">
                {Object.entries(batting).map(([team, players]) => (
                  <div key={team}>
                    <h3 className="text-lg font-semibold text-white mb-4">{team} 打撃成績</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 text-slate-300">選手名</th>
                            <th className="text-center py-2 text-slate-300">守備</th>
                            <th className="text-center py-2 text-slate-300">打数</th>
                            <th className="text-center py-2 text-slate-300">安打</th>
                            <th className="text-center py-2 text-slate-300">本塁打</th>
                            <th className="text-center py-2 text-slate-300">打点</th>
                            <th className="text-center py-2 text-slate-300">四球</th>
                            <th className="text-center py-2 text-slate-300">三振</th>
                            <th className="text-center py-2 text-slate-300">打率</th>
                            <th className="text-center py-2 text-slate-300">出塁率</th>
                            <th className="text-center py-2 text-slate-300">長打率</th>
                            <th className="text-center py-2 text-slate-300">OPS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((player, idx) => (
                            <tr key={idx} className="border-b border-white/5">
                              <td className="py-2 text-white font-medium">{player.player_name}</td>
                              <td className="py-2 text-center text-slate-300">{player.pos}</td>
                              <td className="py-2 text-center text-slate-300">{player.AB}</td>
                              <td className="py-2 text-center text-slate-300">{player.H}</td>
                              <td className="py-2 text-center text-slate-300">{player.HR}</td>
                              <td className="py-2 text-center text-slate-300">{player.RBI}</td>
                              <td className="py-2 text-center text-slate-300">{player.BB}</td>
                              <td className="py-2 text-center text-slate-300">{player.SO}</td>
                              <td className="py-2 text-center text-blue-400 font-medium">{player.AVG?.toFixed(3)}</td>
                              <td className="py-2 text-center text-blue-400">{player.OBP?.toFixed(3)}</td>
                              <td className="py-2 text-center text-blue-400">{player.SLG?.toFixed(3)}</td>
                              <td className="py-2 text-center text-blue-400 font-bold">{player.OPS?.toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'pitching' && (
              <div className="space-y-6">
                {Object.entries(pitching).map(([team, players]) => (
                  <div key={team}>
                    <h3 className="text-lg font-semibold text-white mb-4">{team} 投手成績</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 text-slate-300">投手名</th>
                            <th className="text-center py-2 text-slate-300">投球回</th>
                            <th className="text-center py-2 text-slate-300">被安打</th>
                            <th className="text-center py-2 text-slate-300">失点</th>
                            <th className="text-center py-2 text-slate-300">自責点</th>
                            <th className="text-center py-2 text-slate-300">四球</th>
                            <th className="text-center py-2 text-slate-300">奪三振</th>
                            <th className="text-center py-2 text-slate-300">被本塁打</th>
                            <th className="text-center py-2 text-slate-300">防御率</th>
                            <th className="text-center py-2 text-slate-300">WHIP</th>
                            <th className="text-center py-2 text-slate-300">K/9</th>
                            <th className="text-center py-2 text-slate-300">FIP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((player, idx) => (
                            <tr key={idx} className="border-b border-white/5">
                              <td className="py-2 text-white font-medium">{player.player_name}</td>
                              <td className="py-2 text-center text-slate-300">{player.IP}</td>
                              <td className="py-2 text-center text-slate-300">{player.H}</td>
                              <td className="py-2 text-center text-slate-300">{player.R}</td>
                              <td className="py-2 text-center text-slate-300">{player.ER}</td>
                              <td className="py-2 text-center text-slate-300">{player.BB}</td>
                              <td className="py-2 text-center text-slate-300">{player.SO}</td>
                              <td className="py-2 text-center text-slate-300">{player.HR}</td>
                              <td className="py-2 text-center text-blue-400 font-medium">{player.ERA?.toFixed(2)}</td>
                              <td className="py-2 text-center text-blue-400">{player.WHIP?.toFixed(3)}</td>
                              <td className="py-2 text-center text-blue-400">{player.K9?.toFixed(1)}</td>
                              <td className="py-2 text-center text-blue-400 font-bold">{player.FIP?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'lineups' && (
              <div className="space-y-6">
                {Object.entries(lineups).map(([team, players]) => (
                  <div key={team}>
                    <h3 className="text-lg font-semibold text-white mb-4">{team} スターティングラインナップ</h3>
                    <div className="grid gap-3">
                      {players.map((player, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 bg-black/20 rounded-lg">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm">
                            {player.order_no}
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-medium">{player.player_name}</div>
                            <div className="text-slate-400 text-sm">{player.pos}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}