'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Database, Users, Calendar, Trophy, Zap } from 'lucide-react';

interface StatsData {
  totalGames: number;
  totalPlayers: number;
  avgAttendance: string;
  topStat: {
    player: string;
    value: string;
    category: string;
  };
  recentUpdates: {
    count: number;
    timestamp: string;
  };
  prediction: {
    accuracy: number;
    trend: 'up' | 'down';
  };
}

interface StatsDashboardProps {
  league: 'npb' | 'mlb' | 'kbo' | 'international';
}

export default function StatsDashboard({ league }: StatsDashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [animationClass, setAnimationClass] = useState('');

  // Mock data - in real app, this would come from API
  const mockStats: Record<string, StatsData> = {
    npb: {
      totalGames: 1247,
      totalPlayers: 856,
      avgAttendance: '32,450',
      topStat: {
        player: '村上宗隆',
        value: '1.124',
        category: 'OPS'
      },
      recentUpdates: {
        count: 23,
        timestamp: '2分前'
      },
      prediction: {
        accuracy: 89.3,
        trend: 'up'
      }
    },
    mlb: {
      totalGames: 5832,
      totalPlayers: 2456,
      avgAttendance: '28,730',
      topStat: {
        player: 'Aaron Judge',
        value: '62',
        category: 'HR'
      },
      recentUpdates: {
        count: 47,
        timestamp: '1分前'
      },
      prediction: {
        accuracy: 91.7,
        trend: 'up'
      }
    },
    kbo: {
      totalGames: 720,
      totalPlayers: 480,
      avgAttendance: '15,280',
      topStat: {
        player: '이정후',
        value: '.354',
        category: 'AVG'
      },
      recentUpdates: {
        count: 12,
        timestamp: '5分前'
      },
      prediction: {
        accuracy: 87.1,
        trend: 'down'
      }
    },
    international: {
      totalGames: 7799,
      totalPlayers: 3792,
      avgAttendance: '25,487',
      topStat: {
        player: '大谷翔平',
        value: '10.2',
        category: 'WAR'
      },
      recentUpdates: {
        count: 82,
        timestamp: '30秒前'
      },
      prediction: {
        accuracy: 88.9,
        trend: 'up'
      }
    }
  };

  useEffect(() => {
    // Simulate API call
    setIsLoading(true);
    const timer = setTimeout(() => {
      setStats(mockStats[league]);
      setIsLoading(false);
      setAnimationClass('animate-in');
    }, 500);

    return () => clearTimeout(timer);
  }, [league]);

  useEffect(() => {
    // Animation trigger
    if (stats) {
      setAnimationClass('');
      setTimeout(() => setAnimationClass('animate-in'), 50);
    }
  }, [stats]);

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 animate-pulse">
            <div className="h-12 bg-white/10 rounded mb-2"></div>
            <div className="h-6 bg-white/5 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      icon: Calendar,
      label: '総試合数',
      value: stats.totalGames.toLocaleString(),
      color: 'text-blue-400',
      bg: 'bg-blue-500/10'
    },
    {
      icon: Users,
      label: '選手数',
      value: stats.totalPlayers.toLocaleString(),
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    {
      icon: Trophy,
      label: '平均観客数',
      value: stats.avgAttendance,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10'
    },
    {
      icon: Zap,
      label: `トップ${stats.topStat.category}`,
      value: stats.topStat.value,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      subtitle: stats.topStat.player
    },
    {
      icon: Database,
      label: '最新更新',
      value: stats.recentUpdates.count.toString(),
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      subtitle: stats.recentUpdates.timestamp
    },
    {
      icon: stats.prediction.trend === 'up' ? TrendingUp : TrendingDown,
      label: '予測精度',
      value: `${stats.prediction.accuracy}%`,
      color: stats.prediction.trend === 'up' ? 'text-green-400' : 'text-red-400',
      bg: stats.prediction.trend === 'up' ? 'bg-green-500/10' : 'bg-red-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">リアルタイム統計</h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Activity className="w-4 h-4 text-green-400" />
          ライブ更新中
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>

      <div className={`grid grid-cols-2 lg:grid-cols-6 gap-4 transition-all duration-700 ${animationClass === 'animate-in' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {statItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className={`group bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:scale-105 transition-all duration-300 hover:border-white/20 ${item.bg} hover:shadow-lg`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${item.color} group-hover:scale-110 transition-transform`} />
                <div className={`w-2 h-2 ${item.color.replace('text-', 'bg-')} rounded-full opacity-50`}></div>
              </div>
              
              <div className="space-y-1">
                <div className={`text-xl font-bold ${item.color} transition-colors`}>
                  {item.value}
                </div>
                <div className="text-xs text-slate-400 leading-tight">
                  {item.label}
                </div>
                {item.subtitle && (
                  <div className="text-xs text-slate-500">
                    {item.subtitle}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Updates Feed */}
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-white">最新更新</span>
          <div className="flex gap-1 ml-auto">
            <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
            <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse delay-150"></div>
            <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse delay-300"></div>
          </div>
        </div>
        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>試合データ更新</span>
            <span className="text-green-400">{stats.recentUpdates.timestamp}</span>
          </div>
          <div className="flex justify-between">
            <span>選手成績同期</span>
            <span className="text-blue-400">3分前</span>
          </div>
          <div className="flex justify-between">
            <span>AI予測モデル更新</span>
            <span className="text-purple-400">8分前</span>
          </div>
        </div>
      </div>
    </div>
  );
}