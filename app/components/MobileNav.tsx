"use client";

import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const navLinks = [
    { href: '/', label: 'ホーム' },
    { href: '/players', label: '選手データベース' },
    { href: '/teams', label: 'チーム' },
    { href: '/rankings', label: 'ランキング' },
    { href: '/records', label: '記録' },
    { href: '/matchups', label: '対戦分析' },
    { href: '/columns', label: 'AIコラム' },
    { href: '/about', label: 'About・データ方針' },
  ];

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
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={toggleMenu}
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
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={toggleMenu}
                    className="block px-4 py-3 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
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