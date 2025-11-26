'use client';

import Link from 'next/link';
import { Trophy, Zap, TrendingUp, Target } from 'lucide-react';

interface PresetComparison {
  id: string;
  title: string;
  description: string;
  teams: string[];
  year: number;
  icon: React.ReactNode;
  category: 'rivalry' | 'performance' | 'league';
}

const TEAM_PRESETS: PresetComparison[] = [
  {
    id: 'giants-tigers',
    title: '巨人 vs 阪神',
    description: '永遠のライバル対決',
    teams: ['G', 'T'],
    year: 2024,
    icon: <Trophy className="w-5 h-5" />,
    category: 'rivalry'
  },
  {
    id: 'central-leaders',
    title: 'セ・リーグ上位4チーム',
    description: '優勝争い激戦区',
    teams: ['T', 'G', 'C', 'YS'],
    year: 2024,
    icon: <TrendingUp className="w-5 h-5" />,
    category: 'performance'
  },
  {
    id: 'pacific-powerhouse',
    title: 'パ・リーグ強豪比較',
    description: 'ホークス・バファローズ・マリーンズ・ライオンズ',
    teams: ['H', 'B', 'M', 'L'],
    year: 2024,
    icon: <Zap className="w-5 h-5" />,
    category: 'performance'
  },
  {
    id: 'interleague-top',
    title: '両リーグ首位対決',
    description: 'セパ各リーグトップチーム',
    teams: ['T', 'H'],
    year: 2024,
    icon: <Target className="w-5 h-5" />,
    category: 'league'
  },
  {
    id: 'rookie-teams',
    title: '若手育成重視チーム',
    description: 'ドラゴンズ・スワローズ・イーグルス・ファイターズ',
    teams: ['D', 'S', 'E', 'F'],
    year: 2024,
    icon: <TrendingUp className="w-5 h-5" />,
    category: 'performance'
  },
  {
    id: 'tokyo-teams',
    title: '東京ダービー',
    description: '巨人・スワローズ・ライオンズ',
    teams: ['G', 'S', 'L'],
    year: 2024,
    icon: <Trophy className="w-5 h-5" />,
    category: 'rivalry'
  }
];

export default function TeamComparisonPresets({ 
  location = 'standalone' 
}: { 
  location?: 'standalone' | 'home' | 'teams' 
}) {
  const displayPresets = location === 'home' ? TEAM_PRESETS.slice(0, 3) : TEAM_PRESETS;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'rivalry': return 'bg-red-50 border-red-200 text-red-800';
      case 'performance': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'league': return 'bg-green-50 border-green-200 text-green-800';
      default: return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  const handlePresetClick = (preset: PresetComparison) => {
    // Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'preset_comparison_click', {
        preset_id: preset.id,
        preset_title: preset.title,
        teams: preset.teams.join(','),
        location: location
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          人気のチーム比較
        </h2>
        <p className="text-slate-600">
          よく見られる組み合わせからワンクリックで比較開始
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayPresets.map((preset) => (
          <Link
            key={preset.id}
            href={`/compare/teams?teams=${preset.teams.join(',')}&year=${preset.year}`}
            onClick={() => handlePresetClick(preset)}
            className="block group"
          >
            <div className="bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all duration-200">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-blue-600">
                  {preset.icon}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(preset.category)}`}>
                    {preset.category === 'rivalry' ? 'ライバル' :
                     preset.category === 'performance' ? 'パフォーマンス' : 'リーグ戦'}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{preset.year}年</span>
              </div>

              {/* Content */}
              <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                {preset.title}
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                {preset.description}
              </p>

              {/* Team badges */}
              <div className="flex flex-wrap gap-2">
                {preset.teams.map((teamCode) => {
                  const teamNames: Record<string, string> = {
                    'G': '巨人', 'T': '阪神', 'C': 'カープ', 'YS': 'DeNA', 'D': '中日', 'S': 'ヤクルト',
                    'H': 'ホークス', 'L': 'ライオンズ', 'E': 'イーグルス', 'M': 'マリーンズ', 'F': 'ファイターズ', 'B': 'バファローズ'
                  };
                  
                  return (
                    <span
                      key={teamCode}
                      className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full"
                    >
                      {teamNames[teamCode] || teamCode}
                    </span>
                  );
                })}
              </div>

              {/* Call to action */}
              <div className="mt-4 text-right">
                <span className="text-sm text-blue-600 group-hover:text-blue-700 font-medium">
                  比較を見る →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {location === 'home' && (
        <div className="text-center">
          <Link
            href="/compare/teams"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            すべてのプリセットを見る
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

// カスタム比較セクション
export function CustomTeamComparison() {
  return (
    <div className="bg-slate-50 rounded-lg p-6 mt-8">
      <h3 className="font-bold text-lg text-slate-900 mb-4">
        カスタム比較を作成
      </h3>
      <p className="text-slate-600 mb-4">
        任意のチームを選んで独自の比較を作成できます
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {['G', 'T', 'C', 'YS', 'D', 'S', 'H', 'L', 'E', 'M', 'F', 'B'].map((teamCode) => {
          const teamNames: Record<string, string> = {
            'G': '巨人', 'T': '阪神', 'C': 'カープ', 'YS': 'DeNA', 'D': '中日', 'S': 'ヤクルト',
            'H': 'ホークス', 'L': 'ライオンズ', 'E': 'イーグルス', 'M': 'マリーンズ', 'F': 'ファイターズ', 'B': 'バファローズ'
          };
          
          return (
            <button
              key={teamCode}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
              onClick={() => {
                // カスタム選択ロジック（状態管理が必要）
                console.log('Selected team:', teamCode);
              }}
            >
              {teamNames[teamCode]}
            </button>
          );
        })}
      </div>
      
      <p className="text-xs text-slate-500">
        ※ 2-6チームを選択してカスタム比較を作成（将来実装予定）
      </p>
    </div>
  );
}