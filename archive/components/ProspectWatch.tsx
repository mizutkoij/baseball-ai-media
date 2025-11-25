'use client';

import React, { useState, useEffect } from 'react';
import { Sprout, TrendingUp, Target, RefreshCw } from 'lucide-react';

interface ProspectData {
  playerId: string;
  playerName: string;
  position: string;
  farmTeam: string;
  farmLeague: 'EAST' | 'WEST';
  promotionScore: {
    overall: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

interface ProspectWatchProps {
  farmLeague?: 'EAST' | 'WEST' | 'ALL';
  position?: string;
  limit?: number;
}

export default function ProspectWatch({ 
  farmLeague = 'ALL', 
  position = 'ALL',
  limit = 10 
}: ProspectWatchProps) {
  const [prospects, setProspects] = useState<ProspectData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProspectData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        filter: 'NPB2',
        farmLeague: farmLeague !== 'ALL' ? farmLeague : '',
        position: position !== 'ALL' ? position : '',
        limit: limit.toString()
      });
      
      const response = await fetch(`/api/prospects?${params}`);
      const data = await response.json();
      
      // Mock data for demonstration if API doesn't return data
      if (!data.prospects || data.prospects.length === 0) {
        setProspects([
          {
            playerId: 'system_status',
            playerName: 'NPB2システム稼働中',
            position: 'データ監視',
            farmTeam: '収集システム',
            farmLeague: 'EAST',
            promotionScore: {
              overall: 95,
              trend: 'improving'
            }
          },
          {
            playerId: 'monitoring',
            playerName: 'ファーム試合待機中',
            position: '監視モード',
            farmTeam: '本システム',
            farmLeague: 'WEST',
            promotionScore: {
              overall: 90,
              trend: 'stable'
            }
          }
        ]);
      } else {
        setProspects(data.prospects);
      }
    } catch (error) {
      console.error('Prospect data fetch error:', error);
      // Fallback mock data
      setProspects([
        {
          playerId: 'fallback',
          playerName: 'システム監視中',
          position: '待機',
          farmTeam: 'NPB2収集',
          farmLeague: 'EAST',
          promotionScore: {
            overall: 88,
            trend: 'stable'
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspectData();
  }, [farmLeague, position]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining': return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
      default: return <Target className="w-4 h-4 text-gray-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500 bg-green-500/20';
    if (score >= 60) return 'text-yellow-500 bg-yellow-500/20';
    return 'text-red-500 bg-red-500/20';
  };

  if (loading) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sprout className="w-6 h-6 text-orange-500" />
          <h2 className="text-xl font-semibold text-white">Prospect Watch</h2>
          <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white/10 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sprout className="w-6 h-6 text-orange-500" />
          <h2 className="text-xl font-semibold text-white">Prospect Watch</h2>
          <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">
            {farmLeague === 'ALL' ? '全リーグ' : farmLeague}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-400">
            {prospects.length} 名監視中
          </div>
          <button
            onClick={fetchProspectData}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {prospects.map((prospect) => (
          <div 
            key={prospect.playerId}
            className="bg-white/5 backdrop-blur-sm rounded-lg p-4 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg text-white">{prospect.playerName}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">{prospect.farmTeam}</span>
                  <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">{prospect.farmLeague}</span>
                  <span>{prospect.position}</span>
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getScoreColor(prospect.promotionScore.overall)}`}>
                  {prospect.promotionScore.overall}点
                </span>
                {getTrendIcon(prospect.promotionScore.trend)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {prospects.length === 0 && (
        <div className="text-center py-8">
          <div className="text-slate-400">現在監視中の有望株はありません</div>
          <div className="text-xs text-orange-400 mt-2">
            ファーム試合開始後に有望株データが表示されます
          </div>
        </div>
      )}
    </div>
  );
}