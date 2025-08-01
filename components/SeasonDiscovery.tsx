"use client";

import { Calendar, TrendingUp, Trophy } from 'lucide-react';

interface SeasonDiscoveryProps {
  years?: number[];
  location?: string;
  className?: string;
}

export function SeasonDiscovery({ 
  years = [2025, 2024, 2023],
  location = 'home',
  className = "" 
}: SeasonDiscoveryProps) {
  
  const handleTileClick = (year: number) => {
    // Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'season_tile_click', {
        year,
        location,
        event_category: 'discovery',
        event_label: `season_${year}`
      });
    }
  };

  return (
    <section className={`mt-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">シーズンまとめ</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {years.map((year, index) => (
          <a
            key={year}
            href={`/seasons/${year}`}
            onClick={() => handleTileClick(year)}
            className="group rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all duration-200 bg-white"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                {year}年シーズン
              </h3>
              {index === 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  最新
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-600 mb-3">
              順位・主要指標・リーダーを一望
            </p>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{year}</span>
              </div>
              <div className="flex items-center gap-1 group-hover:text-blue-600">
                <TrendingUp className="h-3 w-3" />
                <span>詳細を見る</span>
              </div>
            </div>
          </a>
        ))}
      </div>
      
      <div className="mt-3 text-center">
        <a 
          href="/seasons" 
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          onClick={() => handleTileClick(0)} // Track "see all" clicks
        >
          すべてのシーズンを見る →
        </a>
      </div>
    </section>
  );
}