"use client";

import React, { useState } from 'react';
import { Info } from 'lucide-react';

/**
 * PF補正についての説明ツールチップ
 * ホバーまたはクリックで表示
 */
export function PFHelpTooltip() {
  const [isVisible, setIsVisible] = useState(false);

  const helpText = "PF補正＝球場差を中立化した比較用スコア。ONで\"どこでも同条件なら\"の実力に近づきます。";

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="flex items-center text-slate-400 hover:text-slate-300 transition-colors"
        aria-label="PF補正について"
      >
        <Info className="w-4 h-4" />
      </button>
      
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 backdrop-blur-md border border-white/20 rounded-lg text-xs text-white max-w-xs z-10">
          <div className="text-center">{helpText}</div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-l-transparent border-r-transparent border-t-white/20"></div>
          </div>
        </div>
      )}
    </div>
  );
}