"use client";

import Link from 'next/link';
import { buildCompareTeamsUrl } from '@/lib/urls';
import { TEAM_META, TeamSlug } from '@/lib/teams';
import { currentSeasonYear } from '@/lib/time';
import { track } from '@/lib/analytics';
import { QuickShareButton } from './ShareButton';

type Preset = {
  title: string;
  caption?: string;
  teams: TeamSlug[];
  pf?: boolean;
  highlight?: boolean;
};

const YEAR = currentSeasonYear();

const PRESETS: Preset[] = [
  { 
    title: '伝統の一戦（巨人 × 阪神）', 
    caption: '最も注目度の高い対戦カード',
    teams: ['G', 'T'], 
    pf: true, 
    highlight: true 
  },
  { 
    title: 'セ・リーグ上位4チーム比較', 
    caption: '優勝争いの主役たち',
    teams: ['G', 'T', 'C', 'YS'], 
    pf: true 
  },
  { 
    title: 'パ・リーグ強豪対決', 
    caption: 'ホークス vs バファローズ',
    teams: ['H', 'B'], 
    pf: true 
  },
  { 
    title: 'パ・リーグ上位4チーム比較', 
    caption: 'プレーオフ争いの激戦区',
    teams: ['H', 'B', 'M', 'L'], 
    pf: true 
  },
  {
    title: '関西ダービー（阪神 × オリックス）',
    caption: '関西の2球団対決',
    teams: ['T', 'B'],
    pf: true
  },
  {
    title: '首都圏対決（巨人 × ヤクルト × DeNA）',
    caption: '東京・神奈川の3球団',
    teams: ['G', 'S', 'YS'],
    pf: true
  }
];

function TeamChips({ teams }: { teams: TeamSlug[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {teams.map((t) => (
        <span
          key={t}
          className="rounded-full border border-slate-300 bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-700"
          title={TEAM_META[t].ja}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export default function HomeComparePresets() {
  return (
    <section className="container mx-auto px-4 my-8">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">ワンクリック比較</h2>
          <p className="text-sm text-slate-600">{YEAR}年シーズン • PF補正対応</p>
        </div>
        <Link
          href="/compare/teams"
          className="text-sm text-blue-600 hover:text-blue-800 underline"
          onClick={() => track('home_presets_more')}
        >
          カスタム比較へ →
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRESETS.map((preset, index) => {
          const href = buildCompareTeamsUrl(preset.teams, { year: YEAR, pf: preset.pf });
          
          return (
            <Link
              key={index}
              href={href}
              onClick={() =>
                track('home_preset_click', {
                  title: preset.title,
                  teams: preset.teams.join(','),
                  year: YEAR,
                  pf: !!preset.pf,
                  position: index + 1
                })
              }
              className={[
                'group rounded-lg border p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.02]',
                preset.highlight 
                  ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 hover:from-amber-100 hover:to-orange-100' 
                  : 'bg-white border-slate-200 hover:border-slate-300'
              ].join(' ')}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    プリセット比較
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {preset.title}
                  </div>
                  {preset.caption && (
                    <div className="mt-1 text-sm text-slate-600">
                      {preset.caption}
                    </div>
                  )}
                </div>
                <div className="ml-2 flex flex-col items-end gap-2">
                  {preset.highlight && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      人気
                    </span>
                  )}
                  <QuickShareButton 
                    url={href}
                    text={`${preset.title} - ${YEAR}年比較`}
                  />
                </div>
              </div>
              
              <TeamChips teams={preset.teams} />
              
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  PF補正: {preset.pf ? 'ON（中立化）' : 'OFF（生データ）'}
                </span>
                <span className="text-blue-600 group-hover:text-blue-800 font-medium">
                  比較開始 →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-xs text-slate-500">
          各プリセットは球場補正（PF）適用済み。中立環境での公正な比較が可能です。
        </p>
      </div>
    </section>
  );
}