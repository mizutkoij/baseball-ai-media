'use client';

import { useState, useEffect } from 'react';
import { Search, Trophy, Users, TrendingUp, Clock, Star } from 'lucide-react';

interface Player {
  player_id: string;
  name: string;
  team: string;
  position: string;
  teamName: string;
}

interface VoteStats {
  totalVotes: number;
  uniqueVoters: number;
  teamsRepresented: number;
  topPlayer: string | null;
  topPlayerVotes: number;
}

interface RankingPlayer extends Player {
  total_votes: number;
  rank_overall: number;
  rank_by_team: number;
}

interface VotingInterfaceProps {
  players: Player[];
  teamColors: Record<string, string>;
}

export default function VotingInterface({ players, teamColors }: VotingInterfaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [stats, setStats] = useState<VoteStats | null>(null);
  const [message, setMessage] = useState('');
  const [votedPlayer, setVotedPlayer] = useState<string | null>(null);
  const [canVote, setCanVote] = useState(true);

  // チーム一覧
  const teams = [
    { code: '', name: 'すべて' },
    { code: 'G', name: '巨人' },
    { code: 'T', name: '阪神' },
    { code: 'C', name: '広島' },
    { code: 'S', name: 'ヤクルト' },
    { code: 'D', name: '中日' },
    { code: 'B', name: 'オリックス' },
    { code: 'H', name: 'ソフトバンク' },
    { code: 'L', name: '西武' },
    { code: 'M', name: 'ロッテ' },
    { code: 'F', name: '日本ハム' },
    { code: 'E', name: '楽天' }
  ];

  // 初期データ取得
  useEffect(() => {
    checkVoteStatus();
    fetchRanking();
  }, [selectedTeam]);

  // 投票状況確認
  const checkVoteStatus = async () => {
    try {
      const response = await fetch('/api/vote', { method: 'PATCH' });
      const data = await response.json();
      setHasVoted(data.hasVotedToday);
      setCanVote(data.canVote);
    } catch (error) {
      console.error('Failed to check vote status:', error);
    }
  };

  // ランキング取得
  const fetchRanking = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTeam) params.set('team', selectedTeam);
      params.set('limit', '20');

      const response = await fetch(`/api/vote?${params}`);
      const data = await response.json();
      
      setRanking(data.ranking || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to fetch ranking:', error);
    }
  };

  // 投票処理
  const handleVote = async (player: Player) => {
    if (hasVoted || !canVote) {
      setMessage('今日はすでに投票済みです。明日また投票してください！');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: player.player_id,
          playerName: player.name,
          teamCode: player.team,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setHasVoted(true);
        setCanVote(false);
        setVotedPlayer(player.name);
        setMessage(data.message);
        await fetchRanking(); // ランキング更新
      } else if (data.code === 'ALREADY_VOTED') {
        setHasVoted(true);
        setCanVote(false);
        setMessage('今日はすでに投票済みです。明日また投票してください！');
      } else {
        setMessage('投票に失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('Vote error:', error);
      setMessage('投票に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  // 選手フィルタリング
  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.includes(searchTerm) || 
                         player.teamName.includes(searchTerm) ||
                         player.position.includes(searchTerm);
    const matchesTeam = !selectedTeam || player.team === selectedTeam;
    return matchesSearch && matchesTeam;
  });

  return (
    <div className="space-y-8">
      {/* 統計情報 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-center">
            <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{stats.totalVotes}</div>
            <div className="text-sm text-gray-400">総投票数</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-center">
            <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{stats.uniqueVoters}</div>
            <div className="text-sm text-gray-400">参加者数</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-center">
            <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{stats.teamsRepresented}</div>
            <div className="text-sm text-gray-400">参戦チーム</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-center">
            <Star className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-lg font-bold text-white truncate">
              {stats.topPlayer || '---'}
            </div>
            <div className="text-sm text-gray-400">
              {stats.topPlayerVotes > 0 ? `${stats.topPlayerVotes}票` : '1位'}
            </div>
          </div>
        </div>
      )}

      {/* メッセージ */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          hasVoted ? 'bg-green-900/20 border-green-500/30 text-green-200' : 
          'bg-red-900/20 border-red-500/30 text-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {hasVoted ? <Trophy className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            {message}
            {votedPlayer && (
              <span className="font-semibold">（{votedPlayer}）</span>
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* 選手選択エリア */}
        <div className="md:col-span-2 space-y-6">
          {/* 検索・フィルター */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="選手名、チーム、ポジションで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
            >
              {teams.map(team => (
                <option key={team.code} value={team.code} className="bg-gray-800">
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {/* 選手一覧 */}
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredPlayers.map((player) => (
              <div
                key={player.player_id}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${teamColors[player.team]}`}></div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{player.name}</h3>
                    <p className="text-sm text-gray-400">
                      {player.teamName} • {player.position}
                    </p>
                  </div>
                  <button
                    onClick={() => handleVote(player)}
                    disabled={hasVoted || isLoading}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      hasVoted || isLoading
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isLoading ? '投票中...' : hasVoted ? '投票済み' : '投票する'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              条件に一致する選手が見つかりません
            </div>
          )}
        </div>

        {/* ランキング */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            今日のランキング
            {selectedTeam && (
              <span className="text-sm text-gray-400">
                ({teams.find(t => t.code === selectedTeam)?.name})
              </span>
            )}
          </h3>
          
          <div className="space-y-2">
            {ranking.slice(0, 10).map((player, index) => (
              <div
                key={player.player_id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  index === 0 ? 'bg-yellow-500/20 border border-yellow-500/30' :
                  index === 1 ? 'bg-gray-500/20 border border-gray-500/30' :
                  index === 2 ? 'bg-orange-500/20 border border-orange-500/30' :
                  'bg-white/5 border border-white/10'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-500 text-white' :
                  index === 2 ? 'bg-orange-500 text-white' :
                  'bg-white/20 text-white'
                }`}>
                  {player.rank_overall}
                </div>
                <div className={`w-3 h-3 rounded-full ${teamColors[player.team]}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{player.name}</div>
                  <div className="text-xs text-gray-400">
                    {teams.find(t => t.code === player.team)?.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">{player.total_votes}</div>
                  <div className="text-xs text-gray-400">票</div>
                </div>
              </div>
            ))}
            
            {ranking.length === 0 && (
              <div className="text-center py-4 text-gray-400 text-sm">
                まだ投票がありません
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}