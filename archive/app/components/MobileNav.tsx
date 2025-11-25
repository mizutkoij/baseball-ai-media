"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Menu, X } from 'lucide-react';

const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);
  const searchParams = useSearchParams();
  const currentLeague = searchParams.get('league') || 'npb';

  const toggleMenu = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // スクロールロック制御
    if (typeof document !== 'undefined') {
      document.body.style.overflow = newIsOpen ? 'hidden' : '';
    }
  };

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, []);

  const getNavLinks = (league: string) => [
    { href: `/?league=${league}`, label: 'ホーム' },
    { href: `/database?league=${league}`, label: '🔍 包括的データベース', featured: true },
    { href: `/players?league=${league}`, label: '選手データベース' },
    { href: `/teams?league=${league}`, label: 'チーム' },
    { href: `/standings?league=${league}`, label: '順位表' },
    { href: `/schedule?league=${league}`, label: '試合スケジュール' },
    { href: `/rankings?league=${league}`, label: 'ランキング' },
    { href: `/records?league=${league}`, label: '記録' },
    { href: `/matchups?league=${league}`, label: '対戦分析' },
    { href: `/analytics?league=${league}`, label: '📊 高度分析', featured: true },
    { href: `/columns?league=${league}`, label: 'AIコラム' },
    { href: '/about', label: 'About・データ方針' },
  ];

  const navLinks = getNavLinks(currentLeague);

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden">
        <button
          onClick={toggleMenu}
          className="p-2 rounded-md text-white hover:text-blue-400 hover:bg-white/10 transition-colors"
          aria-label="メニューを開く"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={toggleMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile menu panel */}
      <div className={`
        fixed top-0 right-0 z-50 h-full w-80 max-w-sm bg-white text-slate-900 border-l border-slate-200 shadow-xl
        transform transition-transform duration-300 ease-in-out md:hidden
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">メニュー</h2>
            <button
              onClick={toggleMenu}
              className="p-2 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors"
              aria-label="メニューを閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6">
            <ul className="space-y-4">
              {navLinks.map((link: any) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={toggleMenu}
                    className={`block px-4 py-3 rounded-lg transition-colors font-medium ${
                      link.featured 
                        ? 'text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' 
                        : 'text-slate-700 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer info */}
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>リアルタイム分析</span>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileNav;