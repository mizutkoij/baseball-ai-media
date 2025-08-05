'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, Target, TrendingUp, Trophy, Users, Calendar, 
  ArrowUpRight, Zap 
} from 'lucide-react';
import BattingStatsTable from '@/components/BattingStatsTable';
import PitchingStatsTable from '@/components/PitchingStatsTable';

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState<'batting' | 'pitching'>('batting');
  const [selectedLeague, setSelectedLeague] = useState<'both' | 'central' | 'pacific'>('both');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4 flex items-center justify-center gap-3">
              <BarChart3 className="w-12 h-12 text-blue-400" />
              NPB選手成績
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              セントラル・リーグとパシフィック・リーグの選手成績をランキング形式で表示。
              打者・投手の詳細データと最新記録を確認できます。
            </p>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>2025年シーズン</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span>リアルタイム更新</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span>詳細統計</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
            {/* Category Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('batting')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'batting'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                打者成績
              </button>
              <button
                onClick={() => setActiveTab('pitching')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'pitching'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Zap className="w-4 h-4" />
                投手成績
              </button>
            </div>

            {/* League Filter */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedLeague('both')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedLeague === 'both'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                両リーグ
              </button>
              <button
                onClick={() => setSelectedLeague('central')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedLeague === 'central'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                セ・リーグ
              </button>
              <button
                onClick={() => setSelectedLeague('pacific')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedLeague === 'pacific'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                パ・リーグ
              </button>
            </div>
          </div>
        </div>

        {/* Stats Tables */}
        <div className="space-y-8">
          {activeTab === 'batting' ? (
            <BattingStatsTable league={selectedLeague === 'both' ? null : selectedLeague} />
          ) : (
            <PitchingStatsTable league={selectedLeague === 'both' ? null : selectedLeague} />
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            関連ツール
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/standings"
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:shadow-md transition-all group"
            >
              <Trophy className="w-8 h-8 text-blue-600" />
              <div>
                <div className="font-semibold text-gray-900 group-hover:text-blue-600">順位表</div>
                <div className="text-sm text-gray-600">チーム順位・勝率</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
            </Link>
            
            <Link
              href="/players"
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg hover:shadow-md transition-all group"
            >
              <Users className="w-8 h-8 text-green-600" />
              <div>
                <div className="font-semibold text-gray-900 group-hover:text-green-600">選手一覧</div>
                <div className="text-sm text-gray-600">詳細プロフィール</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
            </Link>
            
            <Link
              href="/schedule"
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg hover:shadow-md transition-all group"
            >
              <Calendar className="w-8 h-8 text-purple-600" />
              <div>
                <div className="font-semibold text-gray-900 group-hover:text-purple-600">試合日程</div>
                <div className="text-sm text-gray-600">今後の試合予定</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}