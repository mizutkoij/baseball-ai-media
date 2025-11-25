'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface BatterStats {
  player_name: string;
  position: string;
  at_bats: number;
  hits: number;
  runs: number;
  rbis: number;
  doubles: number;
  triples: number;
  home_runs: number;
  walks: number;
  strikeouts: number;
  batting_average: number;
  on_base_percentage: number;
  slugging_percentage: number;
}

interface PitcherStats {
  player_name: string;
  role: string; // 'starter' | 'reliever' | 'closer'
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  walks_allowed: number;
  strikeouts: number;
  home_runs_allowed: number;
  pitches_thrown: number;
  strikes: number;
  era: number;
  whip: number;
  result: string; // 'win' | 'loss' | 'save' | 'hold' | 'blown_save' | 'no_decision'
}

interface GameResults {
  final_score: {
    home: number;
    away: number;
  };
  inning_scores: {
    home: number[];
    away: number[];
  };
  game_stats: {
    home_hits: number;
    away_hits: number;
    home_errors: number;
    away_errors: number;
  };
  winning_pitcher: string;
  losing_pitcher: string;
  save_pitcher?: string;
  home_batting: BatterStats[];
  away_batting: BatterStats[];
  home_pitching: PitcherStats[];
  away_pitching: PitcherStats[];
}

interface GameResultsTabProps {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
}

export function GameResultsTab({ gameId, homeTeam, awayTeam }: GameResultsTabProps) {
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'batting' | 'pitching'>('batting');

  useEffect(() => {
    fetchGameResults();
  }, [gameId]);

  const fetchGameResults = async () => {
    try {
      setLoading(true);
      setError(null);

      // First try NPB official results
      try {
        const npbResponse = await fetch(`/api/npb-official-results?gameId=${gameId}`);
        if (npbResponse.ok) {
          const npbData = await npbResponse.json();
          if (npbData.success) {
            console.log('Using NPB official results');
            setResults(npbData.data);
            return;
          }
        }
      } catch (npbError) {
        console.log('NPB official data not available, falling back to other sources');
      }

      // Fallback to existing API
      const response = await fetch(`/api/games/${gameId}/results`);
      
      if (!response.ok) {
        throw new Error('試合結果の取得に失敗しました');
      }

      const data = await response.json();
      
      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error || '試合結果データが見つかりません');
      }
    } catch (err) {
      setError('試合結果の取得中にエラーが発生しました');
      console.error('Game results fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatInnings = (innings: number) => {
    const fullInnings = Math.floor(innings);
    const outs = Math.round((innings - fullInnings) * 3);
    return outs === 0 ? `${fullInnings}` : `${fullInnings} ${outs}/3`;
  };

  const BattingStatsTable = ({ stats, teamName }: { stats: BatterStats[], teamName: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>{teamName} 打撃成績</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">選手名</th>
                <th className="text-center p-2">守備</th>
                <th className="text-center p-2">打数</th>
                <th className="text-center p-2">安打</th>
                <th className="text-center p-2">得点</th>
                <th className="text-center p-2">打点</th>
                <th className="text-center p-2">本塁打</th>
                <th className="text-center p-2">四球</th>
                <th className="text-center p-2">三振</th>
                <th className="text-center p-2">打率</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((player, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-medium">{player.player_name}</td>
                  <td className="p-2 text-center">{player.position}</td>
                  <td className="p-2 text-center">{player.at_bats}</td>
                  <td className="p-2 text-center">{player.hits}</td>
                  <td className="p-2 text-center">{player.runs}</td>
                  <td className="p-2 text-center">{player.rbis}</td>
                  <td className="p-2 text-center">{player.home_runs}</td>
                  <td className="p-2 text-center">{player.walks}</td>
                  <td className="p-2 text-center">{player.strikeouts}</td>
                  <td className="p-2 text-center">{player.batting_average.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const PitchingStatsTable = ({ stats, teamName }: { stats: PitcherStats[], teamName: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>{teamName} 投手成績</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">投手名</th>
                <th className="text-center p-2">役割</th>
                <th className="text-center p-2">投球回</th>
                <th className="text-center p-2">被安打</th>
                <th className="text-center p-2">失点</th>
                <th className="text-center p-2">自責点</th>
                <th className="text-center p-2">与四球</th>
                <th className="text-center p-2">奪三振</th>
                <th className="text-center p-2">投球数</th>
                <th className="text-center p-2">結果</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((pitcher, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-medium">{pitcher.player_name}</td>
                  <td className="p-2 text-center">{pitcher.role}</td>
                  <td className="p-2 text-center">{formatInnings(pitcher.innings_pitched)}</td>
                  <td className="p-2 text-center">{pitcher.hits_allowed}</td>
                  <td className="p-2 text-center">{pitcher.runs_allowed}</td>
                  <td className="p-2 text-center">{pitcher.earned_runs}</td>
                  <td className="p-2 text-center">{pitcher.walks_allowed}</td>
                  <td className="p-2 text-center">{pitcher.strikeouts}</td>
                  <td className="p-2 text-center">{pitcher.pitches_thrown}</td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      pitcher.result === 'win' ? 'bg-green-100 text-green-800' :
                      pitcher.result === 'loss' ? 'bg-red-100 text-red-800' :
                      pitcher.result === 'save' ? 'bg-blue-100 text-blue-800' :
                      pitcher.result === 'hold' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {pitcher.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
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
              onClick={fetchGameResults}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              再試行
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 模擬データ（実際のAPIが実装されるまで）
  const mockResults: GameResults = {
    final_score: { home: 7, away: 4 },
    inning_scores: {
      away: [0, 1, 0, 2, 0, 0, 1, 0, 0],
      home: [2, 0, 1, 0, 3, 0, 1, 0, 0]
    },
    game_stats: {
      home_hits: 12,
      away_hits: 8,
      home_errors: 1,
      away_errors: 2
    },
    winning_pitcher: '西 勇輝',
    losing_pitcher: '田中 将大',
    save_pitcher: '岩崎 優',
    home_batting: [
      { player_name: '近本 光司', position: '中', at_bats: 4, hits: 2, runs: 2, rbis: 1, doubles: 1, triples: 0, home_runs: 0, walks: 1, strikeouts: 0, batting_average: 0.500, on_base_percentage: 0.600, slugging_percentage: 0.750 },
      { player_name: '中野 拓夢', position: '二', at_bats: 5, hits: 3, runs: 1, rbis: 2, doubles: 0, triples: 0, home_runs: 1, walks: 0, strikeouts: 1, batting_average: 0.600, on_base_percentage: 0.600, slugging_percentage: 1.000 },
      { player_name: '佐藤 輝明', position: '三', at_bats: 4, hits: 1, runs: 1, rbis: 1, doubles: 0, triples: 0, home_runs: 0, walks: 1, strikeouts: 2, batting_average: 0.250, on_base_percentage: 0.400, slugging_percentage: 0.250 },
      { player_name: '大山 悠輔', position: '一', at_bats: 4, hits: 2, runs: 0, rbis: 2, doubles: 1, triples: 0, home_runs: 0, walks: 0, strikeouts: 0, batting_average: 0.500, on_base_percentage: 0.500, slugging_percentage: 0.750 }
    ],
    away_batting: [
      { player_name: '近藤 健介', position: '中', at_bats: 4, hits: 1, runs: 1, rbis: 0, doubles: 0, triples: 0, home_runs: 0, walks: 1, strikeouts: 1, batting_average: 0.250, on_base_percentage: 0.400, slugging_percentage: 0.250 },
      { player_name: '中島 卓也', position: '二', at_bats: 4, hits: 2, runs: 1, rbis: 1, doubles: 0, triples: 0, home_runs: 1, walks: 0, strikeouts: 0, batting_average: 0.500, on_base_percentage: 0.500, slugging_percentage: 1.000 },
      { player_name: '清宮 幸太郎', position: '指', at_bats: 3, hits: 0, runs: 0, rbis: 0, doubles: 0, triples: 0, home_runs: 0, walks: 1, strikeouts: 2, batting_average: 0.000, on_base_percentage: 0.250, slugging_percentage: 0.000 },
      { player_name: '万波 中正', position: '三', at_bats: 4, hits: 1, runs: 1, rbis: 2, doubles: 0, triples: 0, home_runs: 1, walks: 0, strikeouts: 1, batting_average: 0.250, on_base_percentage: 0.250, slugging_percentage: 1.000 }
    ],
    home_pitching: [
      { player_name: '西 勇輝', role: '先発', innings_pitched: 6.0, hits_allowed: 6, runs_allowed: 3, earned_runs: 3, walks_allowed: 2, strikeouts: 8, home_runs_allowed: 2, pitches_thrown: 98, strikes: 65, era: 4.50, whip: 1.33, result: 'win' },
      { player_name: '岩崎 優', role: '抑え', innings_pitched: 1.0, hits_allowed: 0, runs_allowed: 0, earned_runs: 0, walks_allowed: 0, strikeouts: 2, home_runs_allowed: 0, pitches_thrown: 13, strikes: 9, era: 0.00, whip: 0.00, result: 'save' }
    ],
    away_pitching: [
      { player_name: '田中 将大', role: '先発', innings_pitched: 5.1, hits_allowed: 8, runs_allowed: 6, earned_runs: 5, walks_allowed: 3, strikeouts: 6, home_runs_allowed: 1, pitches_thrown: 89, strikes: 56, era: 8.44, whip: 2.06, result: 'loss' },
      { player_name: '宮西 尚生', role: 'リリーフ', innings_pitched: 1.2, hits_allowed: 2, runs_allowed: 1, earned_runs: 1, walks_allowed: 0, strikeouts: 1, home_runs_allowed: 0, pitches_thrown: 24, strikes: 16, era: 5.40, whip: 1.20, result: 'no_decision' }
    ]
  };

  const currentResults = results || mockResults;

  return (
    <div className="space-y-6">
      {/* スコアボード */}
      <Card>
        <CardHeader>
          <CardTitle>試合結果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* イニングスコア */}
            <div>
              <h3 className="font-medium mb-3">イニングスコア</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left border">チーム</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i} className="p-2 text-center border">{i + 1}</th>
                      ))}
                      <th className="p-2 text-center border font-bold">R</th>
                      <th className="p-2 text-center border">H</th>
                      <th className="p-2 text-center border">E</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 font-medium border">{awayTeam}</td>
                      {currentResults.inning_scores.away.map((score, i) => (
                        <td key={i} className="p-2 text-center border">{score}</td>
                      ))}
                      <td className="p-2 text-center border font-bold text-lg">{currentResults.final_score.away}</td>
                      <td className="p-2 text-center border">{currentResults.game_stats.away_hits}</td>
                      <td className="p-2 text-center border">{currentResults.game_stats.away_errors}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium border">{homeTeam}</td>
                      {currentResults.inning_scores.home.map((score, i) => (
                        <td key={i} className="p-2 text-center border">{score}</td>
                      ))}
                      <td className="p-2 text-center border font-bold text-lg">{currentResults.final_score.home}</td>
                      <td className="p-2 text-center border">{currentResults.game_stats.home_hits}</td>
                      <td className="p-2 text-center border">{currentResults.game_stats.home_errors}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 勝敗投手 */}
            <div>
              <h3 className="font-medium mb-3">勝敗投手</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-green-700 font-medium">勝利投手</span>
                  <span className="font-medium">{currentResults.winning_pitcher}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <span className="text-red-700 font-medium">敗戦投手</span>
                  <span className="font-medium">{currentResults.losing_pitcher}</span>
                </div>
                {currentResults.save_pitcher && (
                  <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                    <span className="text-blue-700 font-medium">セーブ投手</span>
                    <span className="font-medium">{currentResults.save_pitcher}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* タブ切り替え */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('batting')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'batting'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          打撃成績
        </button>
        <button
          onClick={() => setActiveTab('pitching')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'pitching'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          投手成績
        </button>
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'batting' && (
        <div className="space-y-6">
          <BattingStatsTable stats={currentResults.away_batting} teamName={awayTeam} />
          <BattingStatsTable stats={currentResults.home_batting} teamName={homeTeam} />
        </div>
      )}

      {activeTab === 'pitching' && (
        <div className="space-y-6">
          <PitchingStatsTable stats={currentResults.away_pitching} teamName={awayTeam} />
          <PitchingStatsTable stats={currentResults.home_pitching} teamName={homeTeam} />
        </div>
      )}
    </div>
  );
}

export default GameResultsTab;