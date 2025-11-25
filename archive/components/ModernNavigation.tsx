'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, Users, Calendar, BarChart3, TrendingUp, Target, 
  Globe, Activity, BookOpen, Menu, X, ChevronDown, Crown
} from 'lucide-react';
import QualityBadge from './QualityBadge';
import UserMenu from './UserMenu';

const navigationItems = [
  {
    name: 'ホーム',
    href: '/',
    icon: Home,
    description: 'トップページ'
  },
  {
    name: '選手データベース',
    href: '/players',
    icon: Users,
    description: '全選手情報'
  },
  {
    name: '試合情報',
    href: '/games',
    icon: Calendar,
    description: '試合結果・予定'
  },
  {
    name: '順位表',
    href: '/standings',
    icon: BarChart3,
    description: 'リーグ順位'
  },
  {
    name: 'ランキング',
    href: '/rankings',
    icon: TrendingUp,
    description: '成績トップ20'
  },
  {
    name: '対戦分析',
    href: '/matchups',
    icon: Target,
    description: 'H2H分析'
  },
  {
    name: '高度分析',
    href: '/analytics',
    icon: Activity,
    description: 'セイバーメトリクス',
    badge: 'PRO'
  },
  {
    name: 'KBO',
    href: '/kbo',
    icon: Globe,
    description: '韓国プロ野球',
    badge: '🇰🇷'
  },
  {
    name: 'コラム',
    href: '/column',
    icon: BookOpen,
    description: '分析記事'
  },
  {
    name: '予測ゲーム',
    href: '/predictions',
    icon: Target,
    description: '試合結果を予測',
    badge: 'HOT'
  },
  {
    name: 'カスタムランキング',
    href: '/leaderboards',
    icon: BarChart3,
    description: 'オリジナルリーダーボード',
    badge: 'NEW'
  },
  {
    name: 'Pro機能',
    href: '/premium',
    icon: Crown,
    description: 'プレミアム機能',
    badge: '👑'
  }
];

export default function ModernNavigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-slate-900/95 backdrop-blur-lg border-b border-white/10 shadow-lg' 
        : 'bg-slate-900/80 backdrop-blur-md border-b border-white/5'
    }`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 lg:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="text-2xl lg:text-3xl">⚾</div>
            <div>
              <div className="text-lg lg:text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Baseball AI Media
              </div>
              <div className="text-xs text-slate-400 hidden sm:block">
                Advanced Analytics Platform
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group relative px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-500/20 text-blue-400' 
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.badge && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.badge === 'PRO' 
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-slate-800 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap">
                      {item.description}
                    </div>
                  </div>
                  
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full"></div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Quality Badge - Desktop */}
            <div className="hidden sm:block">
              <QualityBadge />
            </div>
            
            {/* Live indicator */}
            <div className="hidden md:flex items-center space-x-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-slate-400">Live</span>
              </div>
            </div>

            {/* User Menu - Desktop */}
            <div className="hidden lg:block">
              <UserMenu />
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-lg">
            <div className="py-4 space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                      isActive 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-slate-400">{item.description}</div>
                    </div>
                    {item.badge && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        item.badge === 'PRO' 
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              
              {/* Mobile User Menu */}
              <div className="px-4 py-2 border-t border-white/10 mt-2 pt-4">
                <UserMenu />
              </div>
              
              {/* Mobile Quality Badge */}
              <div className="px-4 py-2">
                <QualityBadge />
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}