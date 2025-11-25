'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, Target, BarChart3, Zap, Sprout, Globe, 
  Activity, ChevronRight, Star, Calendar, Users, Trophy 
} from 'lucide-react';

interface HeroProps {
  currentLeague: 'npb' | 'mlb' | 'kbo' | 'international';
  isNPB2Mode: boolean;
}

export default function ModernHero({ currentLeague, isNPB2Mode }: HeroProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStat, setCurrentStat] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentStat(prev => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic stats based on league
  const stats = {
    npb: [
      { label: 'NPB選手データ', value: '850+', icon: Users },
      { label: '試合分析', value: '1,200+', icon: Calendar },
      { label: 'AI予測精度', value: '89%', icon: Activity },
      { label: '登録チーム', value: '12', icon: Trophy }
    ],
    mlb: [
      { label: 'MLB選手データ', value: '2,400+', icon: Users },
      { label: '試合分析', value: '5,800+', icon: Calendar },
      { label: 'AI予測精度', value: '91%', icon: Activity },
      { label: '登録チーム', value: '30', icon: Trophy }
    ],
    kbo: [
      { label: 'KBO選手データ', value: '480+', icon: Users },
      { label: '試合分析', value: '720+', icon: Calendar },
      { label: 'AI予測精度', value: '87%', icon: Activity },
      { label: '登録チーム', value: '10', icon: Trophy }
    ],
    international: [
      { label: 'リーグ連携', value: '3', icon: Globe },
      { label: '総試合数', value: '7,700+', icon: Calendar },
      { label: '比較分析', value: '∞', icon: Activity },
      { label: '国際統計', value: '52', icon: Trophy }
    ]
  };

  const currentStats = stats[currentLeague];
  const CurrentStatIcon = currentStats[currentStat].icon;

  const getHeroTitle = () => {
    if (isNPB2Mode) return 'NPB2 ファーム Analytics';
    switch (currentLeague) {
      case 'mlb': return 'MLB Analytics & AI Predictions';
      case 'kbo': return 'KBO Analytics Platform';
      case 'international': return 'International Baseball Analytics';
      default: return 'Baseball AI Media';
    }
  };

  const getHeroSubtitle = () => {
    if (isNPB2Mode) return 'NPBファームリーグの詳細データと有望株監視システム';
    switch (currentLeague) {
      case 'mlb': return 'MLBメジャーリーグの詳細分析とAI予測システム';
      case 'kbo': return 'KBO韓国プロ野球の包括的データ分析プラットフォーム';
      case 'international': return '世界の野球リーグ横断比較分析システム';
      default: return 'NPBのデータ分析と統計情報を提供する日本語野球サイト';
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-purple-500/10 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/3 w-40 h-40 bg-green-500/10 rounded-full blur-xl animate-pulse delay-2000"></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="text-center">
          {/* Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <Star className="w-4 h-4" />
            リアルタイム分析システム
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-2"></div>
          </div>

          {/* Main Title */}
          <h1 className={`text-5xl md:text-7xl lg:text-8xl font-black mb-6 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
              {getHeroTitle()}
            </span>
          </h1>

          {/* Subtitle */}
          <p className={`text-xl md:text-2xl text-slate-300 mb-12 max-w-4xl mx-auto leading-relaxed transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {getHeroSubtitle()}
          </p>

          {/* Animated Stats */}
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12 transition-all duration-1000 delay-600 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {currentStats.map((stat, index) => {
              const Icon = stat.icon;
              const isActive = currentStat === index;
              return (
                <div 
                  key={index}
                  className={`bg-black/20 backdrop-blur-md border rounded-xl p-6 transition-all duration-500 ${
                    isActive ? 'border-blue-500/50 bg-blue-500/10 scale-105' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <Icon className={`w-8 h-8 mx-auto mb-3 transition-colors duration-500 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <div className={`text-2xl font-bold transition-colors duration-500 ${isActive ? 'text-blue-400' : 'text-white'}`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-400">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* CTA Buttons */}
          <div className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-800 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <Link
              href={`/standings?league=${currentLeague}`}
              className="group inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <BarChart3 className="w-5 h-5" />
              順位表を見る
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <Link
              href={`/games?league=${currentLeague}`}
              className="group inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Target className="w-5 h-5" />
              試合情報
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <Link
              href={`/rankings?league=${currentLeague}`}
              className="group inline-flex items-center gap-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <TrendingUp className="w-5 h-5" />
              ランキング
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Live Data Indicator */}
          <div className={`mt-8 inline-flex items-center gap-2 text-sm text-slate-400 transition-all duration-1000 delay-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <Activity className="w-4 h-4 text-green-400" />
            リアルタイムデータ更新中
            <div className="flex gap-1 ml-2">
              <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse delay-150"></div>
              <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse delay-300"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}