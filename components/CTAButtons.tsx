"use client";

import Link from "next/link";
import { Calendar, Users, Trophy } from "lucide-react";

// CTA ボタンクリックイベント
const handleCTAClick = (location: string, label: string) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'cta_click', {
      loc: location,
      label: label,
      source: 'hero'
    });
  }
};

export default function CTAButtons() {
  return (
    <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 animate-fade-in animation-delay-300">
      <Link 
        href="/today" 
        onClick={() => handleCTAClick('hero', '今日の試合')}
        className="group flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
      >
        <Calendar className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span className="font-semibold">今日の試合</span>
      </Link>
      
      <Link 
        href="/players" 
        onClick={() => handleCTAClick('hero', '選手データベース')}
        className="group flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
      >
        <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span className="font-semibold">選手データベース</span>
      </Link>
      
      <Link 
        href="/records" 
        onClick={() => handleCTAClick('hero', '記録')}
        className="group flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
      >
        <Trophy className="w-5 h-5 group-hover:bounce transition-transform" />
        <span className="font-semibold">記録</span>
      </Link>
    </div>
  );
}