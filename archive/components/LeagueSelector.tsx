'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type League = 'npb' | 'mlb' | 'kbo' | 'international';

interface LeagueOption {
  code: League;
  name: string;
  flag: string;
  description: string;
}

const leagues: LeagueOption[] = [
  {
    code: 'npb',
    name: 'NPB',
    flag: '🇯🇵',
    description: '日本プロ野球'
  },
  {
    code: 'mlb',
    name: 'MLB',
    flag: '🇺🇸',
    description: 'メジャーリーグ'
  },
  {
    code: 'kbo',
    name: 'KBO',
    flag: '🇰🇷',
    description: '韓国プロ野球'
  },
  {
    code: 'international',
    name: '国際比較',
    flag: '🌍',
    description: '国際野球比較'
  }
];

interface LeagueSelectorProps {
  currentLeague?: League;
  onLeagueChange?: (league: League) => void;
  showDescription?: boolean;
  className?: string;
}

export default function LeagueSelector({
  currentLeague = 'npb',
  onLeagueChange,
  showDescription = true,
  className = ''
}: LeagueSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLeague, setSelectedLeague] = useState<League>(currentLeague);

  const handleLeagueChange = (league: League) => {
    setSelectedLeague(league);
    
    if (onLeagueChange) {
      onLeagueChange(league);
    } else {
      // Update URL with new league parameter
      const params = new URLSearchParams(searchParams);
      params.set('league', league);
      router.push(`?${params.toString()}`);
    }
  };

  const currentLeagueInfo = leagues.find(l => l.code === selectedLeague) || leagues[0];

  return (
    <div className={`league-selector ${className}`}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">リーグ選択:</span>
          <select
            value={selectedLeague}
            onChange={(e) => handleLeagueChange(e.target.value as League)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium min-w-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {leagues.map((league) => (
              <option key={league.code} value={league.code}>
                {league.flag} {league.name}
              </option>
            ))}
          </select>
        </div>

        {showDescription && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="text-lg">{currentLeagueInfo.flag}</span>
            <span>{currentLeagueInfo.description}</span>
            <div className="hidden sm:flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>データ利用可能</span>
            </div>
          </div>
        )}
      </div>

      {/* League-specific quick links */}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/teams?league=${selectedLeague}`}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
        >
          <span>チーム</span>
        </a>
        <a
          href={`/players?league=${selectedLeague}`}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-green-50 text-green-700 rounded-full hover:bg-green-100 transition-colors"
        >
          <span>選手</span>
        </a>
        <a
          href={`/stats?league=${selectedLeague}`}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
        >
          <span>統計</span>
        </a>
        <a
          href={`/standings?league=${selectedLeague}`}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-orange-50 text-orange-700 rounded-full hover:bg-orange-100 transition-colors"
        >
          <span>順位表</span>
        </a>
      </div>
    </div>
  );
}