"use client";

import { Sword, Clock, MapPin, Users, Target, TrendingUp } from "lucide-react";

// 型定義
type MatchupGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  home_pitcher: string;
  away_pitcher: string;
  ballpark?: string;
  game_time?: string;
  analysis?: {
    title?: string;
    description?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  };
};

interface MatchupPreviewCardProps {
  data: MatchupGame[];
}

// チーム色の取得
function getTeamColor(team: string): string {
  const teamColors: { [key: string]: string } = {
    '巨人': 'text-orange-400',
    'ヤクルト': 'text-green-400',
    'DeNA': 'text-blue-400',
    '阪神': 'text-yellow-400',
    '広島': 'text-red-400',
    '中日': 'text-blue-300',
    'ソフトバンク': 'text-yellow-300',
    'ロッテ': 'text-slate-300',
    '西武': 'text-blue-500',
    '楽天': 'text-red-300',
    'オリックス': 'text-blue-600',
    '日本ハム': 'text-blue-200',
  };
  
  return teamColors[team] || 'text-white';
}

// 優位性アイコンの取得
function getAdvantageIcon(value: string): JSX.Element {
  if (value.includes('大幅有利') || value.includes('🔥')) {
    return <span className="text-red-400">🔥</span>;
  } else if (value.includes('有利') || value.includes('⚾')) {
    return <span className="text-blue-400">⚾</span>;
  } else if (value.includes('互角') || value.includes('⚖️')) {
    return <span className="text-yellow-400">⚖️</span>;
  } else if (value.includes('投手有利') || value.includes('🛡️')) {
    return <span className="text-green-400">🛡️</span>;
  } else if (value.includes('投手大幅有利') || value.includes('🔒')) {
    return <span className="text-purple-400">🔒</span>;
  }
  return <span className="text-slate-400">⚾</span>;
}

// 個別試合カード
function GameCard({ game }: { game: MatchupGame }) {
  return (
    <div className="border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all duration-200 bg-gradient-to-br from-white/5 to-transparent">
      {/* ゲームヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className={`font-bold ${getTeamColor(game.away_team)}`}>
              {game.away_team}
            </span>
            <span className="text-slate-400">vs</span>
            <span className={`font-bold ${getTeamColor(game.home_team)}`}>
              {game.home_team}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          {game.game_time && (
            <>
              <Clock className="w-3 h-3" />
              <span>{game.game_time}</span>
            </>
          )}
        </div>
      </div>

      {/* 投手対決 */}
      <div className="mb-3">
        <div className="flex items-center space-x-2 mb-2">
          <Sword className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">先発投手対決</span>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <p className="font-semibold text-sm">{game.away_pitcher}</p>
              <p className={`text-xs ${getTeamColor(game.away_team)}`}>
                ({game.away_team})
              </p>
            </div>
            <div className="mx-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Sword className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <div className="text-center flex-1">
              <p className="font-semibold text-sm">{game.home_pitcher}</p>
              <p className={`text-xs ${getTeamColor(game.home_team)}`}>
                ({game.home_team})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 球場情報 */}
      {game.ballpark && (
        <div className="flex items-center space-x-2 mb-3 text-xs text-slate-400">
          <MapPin className="w-3 h-3" />
          <span>{game.ballpark}</span>
        </div>
      )}

      {/* 分析結果 */}
      {game.analysis?.fields && (
        <div className="space-y-2">
          {game.analysis.fields.slice(0, 2).map((field, index) => (
            <div key={index} className="bg-white/5 rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2 flex items-center space-x-2">
                <Target className="w-3 h-3 text-blue-400" />
                <span>{field.name}</span>
              </h4>
              <div className="text-xs text-slate-300 space-y-1">
                {field.value.split('\n').map((line, lineIndex) => {
                  if (line.trim() === '') return null;
                  return (
                    <div key={lineIndex} className="flex items-center space-x-2">
                      {getAdvantageIcon(line)}
                      <span>{line.replace(/[🔥⚾⚖️🛡️🔒]/g, '').trim()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 統計サマリー
function PreviewSummary({ data }: { data: MatchupGame[] }) {
  const totalGames = data.length;
  const uniqueTeams = new Set([...data.map(g => g.home_team), ...data.map(g => g.away_team)]).size;
  
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="flex items-center space-x-2">
        <Users className="w-4 h-4 text-slate-400" />
        <div>
          <p className="text-xs text-slate-400">今日の試合</p>
          <p className="font-semibold">{totalGames}試合</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Target className="w-4 h-4 text-blue-400" />
        <div>
          <p className="text-xs text-slate-400">対戦チーム</p>
          <p className="font-semibold">{uniqueTeams}球団</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <div>
          <p className="text-xs text-slate-400">分析対象</p>
          <p className="font-semibold text-emerald-400">全試合</p>
        </div>
      </div>
    </div>
  );
}

export default function MatchupPreviewCard({ data }: MatchupPreviewCardProps) {
  // データが空の場合
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Sword className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold">今日の見どころ</h2>
        </div>
        <div className="text-center py-8 text-slate-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="mb-2">今日の試合はありません</p>
          <p className="text-xs text-slate-500">
            試合がある日は、先発投手×主力打者の対戦分析をお届けします
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sword className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold">今日の見どころ</h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/30">
            Phase 7B
          </span>
          <span className="text-xs text-slate-400">
            対戦分析
          </span>
        </div>
      </div>

      {/* サマリー */}
      <PreviewSummary data={data} />

      {/* 試合一覧 */}
      <div className="space-y-4">
        {data.map((game) => (
          <GameCard key={game.game_id} game={game} />
        ))}
      </div>

      {/* 分析説明 */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <h4 className="text-sm font-medium mb-2 flex items-center space-x-2">
            <Target className="w-4 h-4 text-blue-400" />
            <span>マッチアップ分析について</span>
          </h4>
          <ul className="text-xs text-slate-300 space-y-1">
            <li>• プラトーン効果: 左右投手別打撃成績差分析</li>
            <li>• 球団相性: 過去対戦成績・投手陣特徴反映</li>
            <li>• 優位度スコア: 手法・成績・相性総合評価</li>
            <li>• 🔥⚾⚖️🛡️🔒: 打者大幅有利→投手大幅有利</li>
          </ul>
        </div>
      </div>

      {/* フッター */}
      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-slate-400">
        <span>
          毎日 12:00 JST 自動更新
        </span>
        <span>
          Phase 7B: Matchup Analysis System
        </span>
      </div>
    </div>
  );
}