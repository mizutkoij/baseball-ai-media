'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './auth';

// Leaderboard Builder Types
export interface LeaderboardMetric {
  id: string;
  name: string;
  category: 'batting' | 'pitching' | 'fielding' | 'advanced';
  dataType: 'rate' | 'counting' | 'percentage';
  description: string;
  formula?: string;
  minGames?: number;
  isPremium: boolean;
}

export interface LeaderboardFilter {
  league: 'npb' | 'mlb' | 'kbo' | 'all';
  position: string | 'all';
  team: string | 'all';
  minAge?: number;
  maxAge?: number;
  year: number;
  minGames?: number;
}

export interface CustomLeaderboard {
  id: string;
  userId: string;
  name: string;
  description: string;
  isPublic: boolean;
  
  // Configuration
  primaryMetric: string;
  secondaryMetrics: string[];
  filters: LeaderboardFilter;
  limit: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  views: number;
  likes: number;
  
  // Sharing
  shareUrl?: string;
  tags: string[];
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  rank: number;
  metrics: Record<string, number | string>;
  trend?: 'up' | 'down' | 'same';
}

export interface LeaderboardResult {
  leaderboard: CustomLeaderboard;
  entries: LeaderboardEntry[];
  totalPlayers: number;
  lastUpdated: string;
}

// Available metrics
const AVAILABLE_METRICS: LeaderboardMetric[] = [
  // Batting - Basic
  {
    id: 'avg',
    name: '打率',
    category: 'batting',
    dataType: 'rate',
    description: '安打数 ÷ 打数',
    formula: 'H / AB',
    minGames: 50,
    isPremium: false
  },
  {
    id: 'hr',
    name: '本塁打',
    category: 'batting',
    dataType: 'counting',
    description: '本塁打数',
    isPremium: false
  },
  {
    id: 'rbi',
    name: '打点',
    category: 'batting',
    dataType: 'counting',
    description: '打点数',
    isPremium: false
  },
  {
    id: 'ops',
    name: 'OPS',
    category: 'batting',
    dataType: 'rate',
    description: '出塁率 + 長打率',
    formula: 'OBP + SLG',
    minGames: 50,
    isPremium: false
  },
  
  // Batting - Advanced
  {
    id: 'wrc_plus',
    name: 'wRC+',
    category: 'advanced',
    dataType: 'rate',
    description: 'リーグ平均を100とした得点創出指標',
    formula: '((wOBA - lgwOBA) / wOBAscale) * PA + lgR/PA) * 100',
    minGames: 100,
    isPremium: true
  },
  {
    id: 'war',
    name: 'WAR',
    category: 'advanced',
    dataType: 'rate',
    description: '代替可能選手との勝利数差',
    isPremium: true
  },
  {
    id: 'babip',
    name: 'BABIP',
    category: 'advanced',
    dataType: 'rate',
    description: 'インプレー時打率',
    formula: '(H - HR) / (AB - SO - HR + SF)',
    minGames: 50,
    isPremium: true
  },
  
  // Pitching - Basic
  {
    id: 'era',
    name: '防御率',
    category: 'pitching',
    dataType: 'rate',
    description: '9イニングあたりの失点',
    formula: 'ER * 9 / IP',
    minGames: 10,
    isPremium: false
  },
  {
    id: 'wins',
    name: '勝利',
    category: 'pitching',
    dataType: 'counting',
    description: '勝利数',
    isPremium: false
  },
  {
    id: 'strikeouts',
    name: '奪三振',
    category: 'pitching',
    dataType: 'counting',
    description: '奪三振数',
    isPremium: false
  },
  {
    id: 'whip',
    name: 'WHIP',
    category: 'pitching',
    dataType: 'rate',
    description: 'イニングあたり許した走者',
    formula: '(BB + H) / IP',
    minGames: 10,
    isPremium: false
  },
  
  // Pitching - Advanced
  {
    id: 'fip',
    name: 'FIP',
    category: 'advanced',
    dataType: 'rate',
    description: '守備独立投球指標',
    formula: '((13*HR) + (3*(BB+HBP)) - (2*K)) / IP + constant',
    minGames: 50,
    isPremium: true
  },
  {
    id: 'era_minus',
    name: 'ERA-',
    category: 'advanced',
    dataType: 'rate',
    description: 'リーグ平均を100とした防御率指標',
    minGames: 50,
    isPremium: true
  },
  {
    id: 'k_pct',
    name: 'K%',
    category: 'advanced',
    dataType: 'percentage',
    description: '奪三振率',
    formula: 'K / TBF * 100',
    minGames: 20,
    isPremium: true
  }
];

// Mock service
class LeaderboardBuilderService {
  private static instance: LeaderboardBuilderService;
  private leaderboards: Map<string, CustomLeaderboard> = new Map();
  private results: Map<string, LeaderboardResult> = new Map();

  static getInstance(): LeaderboardBuilderService {
    if (!LeaderboardBuilderService.instance) {
      LeaderboardBuilderService.instance = new LeaderboardBuilderService();
    }
    return LeaderboardBuilderService.instance;
  }

  constructor() {
    this.loadFromStorage();
    this.initializeMockData();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('baseball-ai-leaderboards');
      if (stored) {
        const data = JSON.parse(stored);
        this.leaderboards = new Map(data.leaderboards || []);
        this.results = new Map(data.results || []);
      }
    } catch (error) {
      console.warn('Failed to load leaderboard data:', error);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('baseball-ai-leaderboards', JSON.stringify({
        leaderboards: Array.from(this.leaderboards.entries()),
        results: Array.from(this.results.entries())
      }));
    } catch (error) {
      console.warn('Failed to save leaderboard data:', error);
    }
  }

  private initializeMockData() {
    if (this.leaderboards.size > 0) return;

    // Sample public leaderboards
    const sampleLeaderboards: CustomLeaderboard[] = [
      {
        id: 'lb_power_hitters',
        userId: 'system',
        name: 'パワーヒッター番付',
        description: '本塁打とOPSで評価する長打力ランキング',
        isPublic: true,
        primaryMetric: 'hr',
        secondaryMetrics: ['ops', 'rbi', 'slg'],
        filters: {
          league: 'npb',
          position: 'all',
          team: 'all',
          year: 2024,
          minGames: 80
        },
        limit: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        views: 1240,
        likes: 89,
        tags: ['本塁打', '長打力', 'NPB']
      },
      {
        id: 'lb_ace_pitchers',
        userId: 'system',
        name: 'エース投手ランキング',
        description: '防御率・WHIP・奪三振で評価する総合投手力',
        isPublic: true,
        primaryMetric: 'era',
        secondaryMetrics: ['whip', 'strikeouts', 'fip'],
        filters: {
          league: 'npb',
          position: 'P',
          team: 'all',
          year: 2024,
          minGames: 15
        },
        limit: 15,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        views: 890,
        likes: 67,
        tags: ['投手', '防御率', 'エース']
      }
    ];

    sampleLeaderboards.forEach(lb => this.leaderboards.set(lb.id, lb));
    this.saveToStorage();
  }

  getAvailableMetrics(isPremium: boolean = false): LeaderboardMetric[] {
    return AVAILABLE_METRICS.filter(metric => !metric.isPremium || isPremium);
  }

  async createLeaderboard(userId: string, config: Omit<CustomLeaderboard, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'views' | 'likes'>): Promise<CustomLeaderboard> {
    const id = `lb_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const leaderboard: CustomLeaderboard = {
      ...config,
      id,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
      likes: 0
    };

    this.leaderboards.set(id, leaderboard);
    this.saveToStorage();

    // Generate initial results
    await this.generateLeaderboardResults(leaderboard);

    return leaderboard;
  }

  async updateLeaderboard(id: string, updates: Partial<CustomLeaderboard>): Promise<CustomLeaderboard> {
    const existing = this.leaderboards.get(id);
    if (!existing) {
      throw new Error('リーダーボードが見つかりません');
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.leaderboards.set(id, updated);
    this.saveToStorage();

    // Regenerate results if configuration changed
    if (updates.primaryMetric || updates.secondaryMetrics || updates.filters) {
      await this.generateLeaderboardResults(updated);
    }

    return updated;
  }

  async deleteLeaderboard(id: string, userId: string): Promise<void> {
    const leaderboard = this.leaderboards.get(id);
    if (!leaderboard) {
      throw new Error('リーダーボードが見つかりません');
    }

    if (leaderboard.userId !== userId && leaderboard.userId !== 'system') {
      throw new Error('削除権限がありません');
    }

    this.leaderboards.delete(id);
    this.results.delete(id);
    this.saveToStorage();
  }

  async getUserLeaderboards(userId: string): Promise<CustomLeaderboard[]> {
    return Array.from(this.leaderboards.values())
      .filter(lb => lb.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getPublicLeaderboards(limit: number = 10): Promise<CustomLeaderboard[]> {
    return Array.from(this.leaderboards.values())
      .filter(lb => lb.isPublic)
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  }

  async getLeaderboardResult(id: string): Promise<LeaderboardResult | null> {
    const leaderboard = this.leaderboards.get(id);
    if (!leaderboard) return null;

    // Increment view count
    leaderboard.views += 1;
    this.leaderboards.set(id, leaderboard);
    this.saveToStorage();

    let result = this.results.get(id);
    if (!result) {
      result = await this.generateLeaderboardResults(leaderboard);
    }

    return result;
  }

  private async generateLeaderboardResults(leaderboard: CustomLeaderboard): Promise<LeaderboardResult> {
    // Mock data generation - in production, this would query the real database
    const mockEntries: LeaderboardEntry[] = [
      {
        playerId: 'player_1',
        playerName: '山田哲人',
        team: 'ヤクルト',
        position: '内野手',
        rank: 1,
        metrics: {
          [leaderboard.primaryMetric]: leaderboard.primaryMetric === 'hr' ? 31 : 0.285,
          'ops': 0.889,
          'rbi': 89,
          'avg': 0.285
        },
        trend: 'up'
      },
      {
        playerId: 'player_2',
        playerName: '村上宗隆',
        team: 'ヤクルト',
        position: '内野手',
        rank: 2,
        metrics: {
          [leaderboard.primaryMetric]: leaderboard.primaryMetric === 'hr' ? 28 : 0.272,
          'ops': 0.864,
          'rbi': 78,
          'avg': 0.272
        },
        trend: 'same'
      },
      {
        playerId: 'player_3',
        playerName: '佐藤輝明',
        team: '阪神',
        position: '外野手',
        rank: 3,
        metrics: {
          [leaderboard.primaryMetric]: leaderboard.primaryMetric === 'hr' ? 26 : 0.268,
          'ops': 0.851,
          'rbi': 82,
          'avg': 0.268
        },
        trend: 'down'
      }
    ];

    const result: LeaderboardResult = {
      leaderboard,
      entries: mockEntries.slice(0, leaderboard.limit),
      totalPlayers: 150,
      lastUpdated: new Date().toISOString()
    };

    this.results.set(leaderboard.id, result);
    this.saveToStorage();

    return result;
  }

  async likeLeaderboard(id: string, userId: string): Promise<void> {
    const leaderboard = this.leaderboards.get(id);
    if (leaderboard) {
      leaderboard.likes += 1;
      this.leaderboards.set(id, leaderboard);
      this.saveToStorage();
    }
  }
}

// Context
const LeaderboardBuilderContext = createContext<{
  userLeaderboards: CustomLeaderboard[];
  publicLeaderboards: CustomLeaderboard[];
  availableMetrics: LeaderboardMetric[];
  isLoading: boolean;
  createLeaderboard: (config: Omit<CustomLeaderboard, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'views' | 'likes'>) => Promise<CustomLeaderboard>;
  updateLeaderboard: (id: string, updates: Partial<CustomLeaderboard>) => Promise<CustomLeaderboard>;
  deleteLeaderboard: (id: string) => Promise<void>;
  getLeaderboardResult: (id: string) => Promise<LeaderboardResult | null>;
  likeLeaderboard: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
} | null>(null);

// Provider
export function LeaderboardBuilderProvider({ children }: { children: ReactNode }) {
  const [userLeaderboards, setUserLeaderboards] = useState<CustomLeaderboard[]>([]);
  const [publicLeaderboards, setPublicLeaderboards] = useState<CustomLeaderboard[]>([]);
  const [availableMetrics, setAvailableMetrics] = useState<LeaderboardMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { authState } = useAuth();
  const service = LeaderboardBuilderService.getInstance();

  const loadData = async () => {
    setIsLoading(true);
    
    try {
      const isPremium = authState.user?.isPremium || false;
      const metrics = service.getAvailableMetrics(isPremium);
      
      const [userLbs, publicLbs] = await Promise.all([
        authState.user ? service.getUserLeaderboards(authState.user.id) : Promise.resolve([]),
        service.getPublicLeaderboards()
      ]);

      setAvailableMetrics(metrics);
      setUserLeaderboards(userLbs);
      setPublicLeaderboards(publicLbs);
    } catch (error) {
      console.error('Failed to load leaderboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [authState.user]);

  const createLeaderboard = async (config: Omit<CustomLeaderboard, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'views' | 'likes'>) => {
    if (!authState.user) {
      throw new Error('ログインが必要です');
    }

    const leaderboard = await service.createLeaderboard(authState.user.id, config);
    await loadData(); // Refresh data
    return leaderboard;
  };

  const updateLeaderboard = async (id: string, updates: Partial<CustomLeaderboard>) => {
    const updated = await service.updateLeaderboard(id, updates);
    await loadData(); // Refresh data
    return updated;
  };

  const deleteLeaderboard = async (id: string) => {
    if (!authState.user) {
      throw new Error('ログインが必要です');
    }

    await service.deleteLeaderboard(id, authState.user.id);
    await loadData(); // Refresh data
  };

  const getLeaderboardResult = async (id: string) => {
    return await service.getLeaderboardResult(id);
  };

  const likeLeaderboard = async (id: string) => {
    if (!authState.user) {
      throw new Error('ログインが必要です');
    }

    await service.likeLeaderboard(id, authState.user.id);
    await loadData(); // Refresh data
  };

  const refreshData = async () => {
    await loadData();
  };

  return (
    <LeaderboardBuilderContext.Provider value={{
      userLeaderboards,
      publicLeaderboards,
      availableMetrics,
      isLoading,
      createLeaderboard,
      updateLeaderboard,
      deleteLeaderboard,
      getLeaderboardResult,
      likeLeaderboard,
      refreshData
    }}>
      {children}
    </LeaderboardBuilderContext.Provider>
  );
}

// Hook
export function useLeaderboardBuilder() {
  const context = useContext(LeaderboardBuilderContext);
  if (!context) {
    throw new Error('useLeaderboardBuilder must be used within a LeaderboardBuilderProvider');
  }
  return context;
}