"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, TrendingUp, Target, BarChart3 } from 'lucide-react';

/**
 * オリジナル統計用語解説コンポーネント
 * 学術文献・概念理論に基づく独自執筆
 */

interface StatDefinition {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: 'batting' | 'pitching' | 'team' | 'methodology';
  shortDesc: string;
  formula?: string;
  usage: string;
  notes?: string;
  source: string;
}

const STAT_DEFINITIONS: StatDefinition[] = [
  // チーム指標
  {
    id: 'pythagorean_win_pct',
    name: 'ピタゴラス勝率（Pythagorean Win%）',
    icon: <TrendingUp className="w-4 h-4" />,
    category: 'team',
    shortDesc: 'チームの得点と失点から、長期的に見込まれる勝率を見積もる近似式。',
    formula: '勝率 = 得点^X ÷ ( 得点^X + 失点^X )',
    usage: '実勝率との差を見て、チームの「運」や今後の成績を予測する指標として。',
    notes: 'X=2 が基本。得点環境に合わせるなら PythagenPat： X ≈ { (得点+失点)/試合 }^0.287。',
    source: 'Bill James (1980s), 一般的な統計理論'
  },
  
  // 投手指標
  {
    id: 'dips_fip',
    name: 'DIPS と FIP',
    icon: <Target className="w-4 h-4" />,
    category: 'pitching',
    shortDesc: '守備の影響を極力外し、投手本人がコントロールしやすい要素（K, BB, HR）で評価する考え方。FIPはその代表。',
    formula: 'FIP = (13×HR + 3×BB/HBP − 2×K) ÷ IP + 定数（リーグ整合用）',
    usage: '"将来の防御率に近い"指標として先行指標に。',
    notes: '被安打を完全に無視するものではないという議論もある。長期ではxFIP等も併用。',
    source: 'Voros McCracken (2001), Baseball Prospectus'
  },
  
  // 球場補正
  {
    id: 'park_factor',
    name: 'パークファクター（PF）',
    icon: <BarChart3 className="w-4 h-4" />,
    category: 'team',
    shortDesc: '球場の得点・被得点がリーグ平均と比べてどれだけ出やすいか。',
    formula: 'PF（得点）=（本拠地の1試合あたり得点+失点）÷（ビジターでの1試合あたり得点+失点）',
    usage: '球場差を補正して選手やチームを比較。',
    notes: '1年だとブレる。3〜5年移動平均を推奨。',
    source: '"The Book" (Tango, Lichtman, Dolphin, 2007)'
  },
  
  // 統計手法
  {
    id: 'regression_sample_size',
    name: '平均への回帰 / サンプルサイズ',
    icon: <BookOpen className="w-4 h-4" />,
    category: 'methodology',
    shortDesc: '短期の極端な数値は、試行を重ねると平均に近づく。指標ごとに"安定するまでの目安"が存在。',
    usage: '小サンプルでの判断を避け、適切な期間での評価を行う。',
    notes: '打率は約500打席、OBPは約460打席、FIPは約70投球回で安定すると言われる。',
    source: '統計学の一般理論, "The Book"'
  },
  
  // 打撃指標
  {
    id: 'woba',
    name: 'wOBA (weighted On-Base Average)',
    icon: <Target className="w-4 h-4" />,
    category: 'batting',
    shortDesc: '各打撃結果に適切な重みを付けて、総合的な攻撃力を1つの数値で表現。',
    formula: 'wOBA = (uBB×wBB + HBP×wHBP + 1B×w1B + 2B×w2B + 3B×w3B + HR×wHR) ÷ PA',
    usage: 'OPSより正確な攻撃指標として。リーグ平均は約.320。',
    notes: '係数(w値)は年・リーグごとに得点価値から算出。当サイトでは独自推定。',
    source: '"The Book" (2007), FanGraphs概念解説'
  }
];

interface StatsGlossaryProps {
  defaultCategory?: StatDefinition['category'];
  compact?: boolean;
}

export default function StatsGlossary({ 
  defaultCategory = 'batting', 
  compact = false 
}: StatsGlossaryProps) {
  const [activeCategory, setActiveCategory] = useState<StatDefinition['category']>(defaultCategory);
  const [expandedStat, setExpandedStat] = useState<string | null>(null);

  const categories = [
    { key: 'batting' as const, label: '打撃', icon: <Target className="w-4 h-4" /> },
    { key: 'pitching' as const, label: '投手', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'team' as const, label: 'チーム', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'methodology' as const, label: '手法', icon: <BookOpen className="w-4 h-4" /> }
  ];

  const filteredStats = STAT_DEFINITIONS.filter(stat => stat.category === activeCategory);

  const toggleExpanded = (statId: string) => {
    setExpandedStat(expandedStat === statId ? null : statId);
  };

  if (compact) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          統計用語解説
        </h3>
        <div className="space-y-2">
          {STAT_DEFINITIONS.slice(0, 3).map((stat) => (
            <div key={stat.id} className="text-sm">
              <button
                onClick={() => toggleExpanded(stat.id)}
                className="flex items-center justify-between w-full text-left p-2 rounded hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {stat.icon}
                  <span className="text-blue-400">{stat.name}</span>
                </div>
                {expandedStat === stat.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              
              {expandedStat === stat.id && (
                <div className="ml-6 p-3 bg-black/30 rounded mt-2 text-xs text-slate-300 space-y-2">
                  <p><strong>概要:</strong> {stat.shortDesc}</p>
                  {stat.formula && <p><strong>式:</strong> <code className="bg-black/50 px-1 rounded">{stat.formula}</code></p>}
                  <p><strong>用途:</strong> {stat.usage}</p>
                  {stat.notes && <p><strong>注意:</strong> {stat.notes}</p>}
                  <p className="text-xs text-slate-500"><strong>出典:</strong> {stat.source}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
      {/* カテゴリタブ */}
      <div className="flex border-b border-white/10 bg-black/30">
        {categories.map((category) => (
          <button
            key={category.key}
            onClick={() => setActiveCategory(category.key)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeCategory === category.key
                ? 'text-blue-400 bg-blue-900/20 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {category.icon}
            {category.label}
          </button>
        ))}
      </div>

      {/* 統計解説リスト */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {filteredStats.map((stat) => (
          <div key={stat.id} className="border border-white/10 rounded-lg">
            <button
              onClick={() => toggleExpanded(stat.id)}
              className="flex items-center justify-between w-full text-left p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-blue-400">
                  {stat.icon}
                </div>
                <div>
                  <h4 className="font-medium text-white">{stat.name}</h4>
                  <p className="text-sm text-slate-400 mt-1">{stat.shortDesc}</p>
                </div>
              </div>
              {expandedStat === stat.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            
            {expandedStat === stat.id && (
              <div className="px-4 pb-4 pt-0 space-y-3 text-sm">
                <div className="bg-black/30 p-3 rounded border-l-4 border-blue-400">
                  {stat.formula && (
                    <div className="mb-3">
                      <strong className="text-blue-400">計算式:</strong>
                      <div className="mt-1 p-2 bg-black/50 rounded font-mono text-xs">
                        {stat.formula}
                      </div>
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <strong className="text-green-400">使用例:</strong>
                    <p className="mt-1 text-slate-300">{stat.usage}</p>
                  </div>
                  
                  {stat.notes && (
                    <div className="mb-3">
                      <strong className="text-yellow-400">注意点:</strong>
                      <p className="mt-1 text-slate-300">{stat.notes}</p>
                    </div>
                  )}
                  
                  <div className="text-xs text-slate-500 pt-2 border-t border-white/10">
                    <strong>出典・参考:</strong> {stat.source}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {filteredStats.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>このカテゴリの用語解説は準備中です</p>
          </div>
        )}
      </div>
      
      {/* フッター */}
      <div className="px-4 py-3 bg-black/30 border-t border-white/10">
        <p className="text-xs text-slate-500 text-center">
          <strong>🔍 独自執筆:</strong> 統計手法は学術文献・一般理論に基づく独自実装。第三者DBの複製なし。
        </p>
      </div>
    </div>
  );
}