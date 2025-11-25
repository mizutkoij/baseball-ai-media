'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './auth';

// Prediction types
export interface GamePrediction {
  id: string;
  gameId: string;
  userId: string;
  homeTeam: string;
  awayTeam: string;
  gameDate: string;
  
  // Predictions
  winnerPrediction: 'home' | 'away';
  scorePrediction?: {
    home: number;
    away: number;
  };
  homeRunsPrediction?: number;
  mvpPrediction?: string; // player name
  
  // Metadata
  confidence: 1 | 2 | 3 | 4 | 5; // 1=low, 5=high
  createdAt: string;
  points?: number; // awarded after game completion
  accuracy?: number; // 0-100%
}

export interface PredictionGame {
  id: string;
  title: string;
  description: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  gameDate: string;
  deadline: string;
  
  // Prediction options
  allowWinnerPrediction: boolean;
  allowScorePrediction: boolean;
  allowHomeRunsPrediction: boolean;
  allowMvpPrediction: boolean;
  
  // Status
  status: 'open' | 'closed' | 'completed';
  totalPredictions: number;
  completedAt?: string;
  
  // Results (after game completion)
  actualWinner?: 'home' | 'away';
  actualScore?: {
    home: number;
    away: number;
  };
  actualHomeRuns?: number;
  actualMvp?: string;
}

export interface PredictionStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  totalPoints: number;
  rank: number;
  streak: number;
  favoritePredictionType: 'winner' | 'score' | 'homeruns' | 'mvp';
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  totalPoints: number;
  accuracy: number;
  totalPredictions: number;
  rank: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
}

// Mock prediction service
class PredictionService {
  private static instance: PredictionService;
  private predictions: Map<string, GamePrediction> = new Map();
  private games: Map<string, PredictionGame> = new Map();
  private userStats: Map<string, PredictionStats> = new Map();

  static getInstance(): PredictionService {
    if (!PredictionService.instance) {
      PredictionService.instance = new PredictionService();
    }
    return PredictionService.instance;
  }

  constructor() {
    this.loadFromStorage();
    this.initializeMockGames();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('baseball-ai-predictions');
      if (stored) {
        const data = JSON.parse(stored);
        this.predictions = new Map(data.predictions || []);
        this.games = new Map(data.games || []);
        this.userStats = new Map(data.userStats || []);
      }
    } catch (error) {
      console.warn('Failed to load prediction data:', error);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('baseball-ai-predictions', JSON.stringify({
        predictions: Array.from(this.predictions.entries()),
        games: Array.from(this.games.entries()),
        userStats: Array.from(this.userStats.entries())
      }));
    } catch (error) {
      console.warn('Failed to save prediction data:', error);
    }
  }

  private initializeMockGames() {
    if (this.games.size > 0) return; // Already initialized

    // Create mock prediction games for the next few days
    const mockGames: PredictionGame[] = [
      {
        id: 'pred_game_1',
        title: '巨人 vs 阪神 勝敗予測',
        description: '伝統の一戦！どちらが勝利するか予測しよう',
        gameId: 'game_2025_giants_tigers',
        homeTeam: '読売ジャイアンツ',
        awayTeam: '阪神タイガース',
        gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        deadline: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
        allowWinnerPrediction: true,
        allowScorePrediction: true,
        allowHomeRunsPrediction: true,
        allowMvpPrediction: true,
        status: 'open',
        totalPredictions: 42
      },
      {
        id: 'pred_game_2',
        title: 'ヤクルト vs 中日 MVP予測',
        description: '今日の試合で最も活躍する選手は？',
        gameId: 'game_2025_swallows_dragons',
        homeTeam: '東京ヤクルトスワローズ',
        awayTeam: '中日ドラゴンズ',
        gameDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000).toISOString(),
        allowWinnerPrediction: true,
        allowScorePrediction: false,
        allowHomeRunsPrediction: false,
        allowMvpPrediction: true,
        status: 'open',
        totalPredictions: 28
      }
    ];

    mockGames.forEach(game => this.games.set(game.id, game));
    this.saveToStorage();
  }

  async getAvailableGames(): Promise<PredictionGame[]> {
    return Array.from(this.games.values())
      .filter(game => game.status === 'open')
      .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
  }

  async getUserPredictions(userId: string): Promise<GamePrediction[]> {
    return Array.from(this.predictions.values())
      .filter(prediction => prediction.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async submitPrediction(userId: string, gameId: string, prediction: Partial<GamePrediction>): Promise<GamePrediction> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('ゲームが見つかりません');
    }

    if (game.status !== 'open') {
      throw new Error('予測の受付は終了しています');
    }

    if (new Date() > new Date(game.deadline)) {
      throw new Error('予測の締切を過ぎています');
    }

    const predictionId = `pred_${userId}_${gameId}_${Date.now()}`;
    
    const newPrediction: GamePrediction = {
      id: predictionId,
      gameId,
      userId,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      gameDate: game.gameDate,
      winnerPrediction: prediction.winnerPrediction!,
      scorePrediction: prediction.scorePrediction,
      homeRunsPrediction: prediction.homeRunsPrediction,
      mvpPrediction: prediction.mvpPrediction,
      confidence: prediction.confidence || 3,
      createdAt: new Date().toISOString()
    };

    // Remove any existing prediction for this game by this user
    for (const [key, existingPred] of this.predictions.entries()) {
      if (existingPred.userId === userId && existingPred.gameId === gameId) {
        this.predictions.delete(key);
      }
    }

    this.predictions.set(predictionId, newPrediction);

    // Update game total predictions count
    game.totalPredictions += 1;
    this.games.set(gameId, game);

    this.saveToStorage();
    return newPrediction;
  }

  async getUserStats(userId: string): Promise<PredictionStats> {
    let stats = this.userStats.get(userId);
    
    if (!stats) {
      // Calculate stats from predictions
      const userPredictions = await this.getUserPredictions(userId);
      const completedPredictions = userPredictions.filter(p => p.points !== undefined);
      
      stats = {
        totalPredictions: userPredictions.length,
        correctPredictions: completedPredictions.filter(p => p.accuracy! > 50).length,
        accuracy: completedPredictions.length > 0 
          ? completedPredictions.reduce((sum, p) => sum + (p.accuracy || 0), 0) / completedPredictions.length 
          : 0,
        totalPoints: completedPredictions.reduce((sum, p) => sum + (p.points || 0), 0),
        rank: 1, // TODO: Calculate real rank
        streak: 0, // TODO: Calculate streak
        favoritePredictionType: 'winner'
      };
      
      this.userStats.set(userId, stats);
      this.saveToStorage();
    }
    
    return stats;
  }

  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    // Mock leaderboard data
    const mockLeaderboard: LeaderboardEntry[] = [
      {
        userId: 'user_mock_1',
        username: '野球マスター',
        totalPoints: 1250,
        accuracy: 78.5,
        totalPredictions: 45,
        rank: 1,
        tier: 'diamond'
      },
      {
        userId: 'user_mock_2',
        username: 'セイバー分析家',
        totalPoints: 1180,
        accuracy: 82.1,
        totalPredictions: 38,
        rank: 2,
        tier: 'platinum'
      },
      {
        userId: 'user_mock_3',
        username: 'NPBファン',
        totalPoints: 1050,
        accuracy: 69.2,
        totalPredictions: 52,
        rank: 3,
        tier: 'gold'
      }
    ];

    return mockLeaderboard.slice(0, limit);
  }
}

// Prediction Context
const PredictionContext = createContext<{
  availableGames: PredictionGame[];
  userPredictions: GamePrediction[];
  userStats: PredictionStats | null;
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  submitPrediction: (gameId: string, prediction: Partial<GamePrediction>) => Promise<void>;
  refreshData: () => Promise<void>;
} | null>(null);

// Prediction Provider
export function PredictionProvider({ children }: { children: ReactNode }) {
  const [availableGames, setAvailableGames] = useState<PredictionGame[]>([]);
  const [userPredictions, setUserPredictions] = useState<GamePrediction[]>([]);
  const [userStats, setUserStats] = useState<PredictionStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { authState } = useAuth();
  const predictionService = PredictionService.getInstance();

  const loadData = async () => {
    setIsLoading(true);
    
    try {
      const [games, predictions, stats, leaders] = await Promise.all([
        predictionService.getAvailableGames(),
        authState.user ? predictionService.getUserPredictions(authState.user.id) : Promise.resolve([]),
        authState.user ? predictionService.getUserStats(authState.user.id) : Promise.resolve(null),
        predictionService.getLeaderboard()
      ]);

      setAvailableGames(games);
      setUserPredictions(predictions);
      setUserStats(stats);
      setLeaderboard(leaders);
    } catch (error) {
      console.error('Failed to load prediction data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [authState.user]);

  const submitPrediction = async (gameId: string, prediction: Partial<GamePrediction>) => {
    if (!authState.user) {
      throw new Error('ログインが必要です');
    }

    await predictionService.submitPrediction(authState.user.id, gameId, prediction);
    await loadData(); // Refresh data
  };

  const refreshData = async () => {
    await loadData();
  };

  return (
    <PredictionContext.Provider value={{
      availableGames,
      userPredictions,
      userStats,
      leaderboard,
      isLoading,
      submitPrediction,
      refreshData
    }}>
      {children}
    </PredictionContext.Provider>
  );
}

// Prediction Hook
export function usePredictions() {
  const context = useContext(PredictionContext);
  if (!context) {
    throw new Error('usePredictions must be used within a PredictionProvider');
  }
  return context;
}