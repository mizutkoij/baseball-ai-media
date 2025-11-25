'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, ChevronDown, Database } from 'lucide-react';

interface YearData {
  year: string;
  game_count: number;
  first_game: string;
  last_game: string;
}

export default function YearSelector() {
  const [years, setYears] = useState<YearData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    async function fetchYears() {
      try {
        const response = await fetch('/api/years');
        const data = await response.json();
        setYears(data.years || []);
      } catch (error) {
        console.error('Failed to fetch years:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchYears();
  }, []);

  if (loading) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-600 rounded w-24 mb-2"></div>
          <div className="h-6 bg-slate-600 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-medium text-slate-300">シーズン別データ</h3>
      </div>
      
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
        >
          <span className="text-white font-medium">年度選択</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden">
            {years.map((yearData) => (
              <Link
                key={yearData.year}
                href={`/games/season/${yearData.year}`}
                className={`block px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0 ${
                  pathname === `/games/season/${yearData.year}` ? 'bg-blue-500/20 text-blue-300' : 'text-white'
                }`}
                onClick={() => setIsOpen(false)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{yearData.year}年</div>
                    <div className="text-xs text-slate-400">
                      {new Date(yearData.first_game).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 〜 
                      {new Date(yearData.last_game).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-400">{yearData.game_count}</div>
                    <div className="text-xs text-slate-400">試合</div>
                  </div>
                </div>
              </Link>
            ))}
            
            {years.length === 0 && (
              <div className="px-4 py-3 text-slate-400 text-sm">
                データなし
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-3 space-y-2">
        {years.slice(0, 3).map((yearData) => (
          <Link
            key={yearData.year}
            href={`/games/season/${yearData.year}`}
            className={`block p-2 rounded-lg transition-colors ${
              pathname === `/games/season/${yearData.year}` 
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{yearData.year}年</span>
              <span className="text-xs text-slate-400">{yearData.game_count}試合</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}