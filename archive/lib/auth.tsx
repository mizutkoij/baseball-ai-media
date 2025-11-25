'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// Authentication types
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  isPremium: boolean;
  preferences: UserPreferences;
  stats: UserStats;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserPreferences {
  preferredLeague: 'npb' | 'mlb' | 'kbo' | 'international';
  defaultViewMode: 'card' | 'fangraphs' | 'savant';
  theme: 'dark' | 'light' | 'auto';
  language: 'ja' | 'en';
  notifications: {
    email: boolean;
    push: boolean;
    gameAlerts: boolean;
    favoritePlayerUpdates: boolean;
    weeklyDigest: boolean;
  };
  privacy: {
    profilePublic: boolean;
    showFavorites: boolean;
    allowRecommendations: boolean;
  };
}

export interface UserStats {
  loginCount: number;
  favoritePlayersCount: number;
  favoriteTeamsCount: number;
  predictionsCount: number;
  votesCount: number;
  articlesRead: number;
  lastActiveDate: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// Mock authentication service (replace with real backend integration)
class AuthService {
  private static instance: AuthService;
  private users: Map<string, User> = new Map();
  private currentSession: string | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('baseball-ai-auth');
      if (stored) {
        const { users, session } = JSON.parse(stored);
        this.users = new Map(users);
        this.currentSession = session;
      }
    } catch (error) {
      console.warn('Failed to load auth data:', error);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('baseball-ai-auth', JSON.stringify({
        users: Array.from(this.users.entries()),
        session: this.currentSession
      }));
    } catch (error) {
      console.warn('Failed to save auth data:', error);
    }
  }

  async register(email: string, username: string, password: string): Promise<User> {
    // Mock registration - in production, this would call your backend API
    if (this.users.has(email)) {
      throw new Error('このメールアドレスは既に登録されています');
    }

    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      email,
      username,
      displayName: username,
      isPremium: false,
      preferences: {
        preferredLeague: 'npb',
        defaultViewMode: 'card',
        theme: 'dark',
        language: 'ja',
        notifications: {
          email: true,
          push: false,
          gameAlerts: true,
          favoritePlayerUpdates: true,
          weeklyDigest: true,
        },
        privacy: {
          profilePublic: false,
          showFavorites: true,
          allowRecommendations: true,
        }
      },
      stats: {
        loginCount: 1,
        favoritePlayersCount: 0,
        favoriteTeamsCount: 0,
        predictionsCount: 0,
        votesCount: 0,
        articlesRead: 0,
        lastActiveDate: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    this.users.set(email, user);
    this.currentSession = user.id;
    this.saveToStorage();

    return user;
  }

  async login(email: string, password: string): Promise<User> {
    // Mock login - in production, this would validate credentials with your backend
    const user = this.users.get(email);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // Update login stats
    user.stats.loginCount += 1;
    user.lastLoginAt = new Date().toISOString();
    user.stats.lastActiveDate = new Date().toISOString();

    this.currentSession = user.id;
    this.saveToStorage();

    return user;
  }

  async logout(): Promise<void> {
    this.currentSession = null;
    this.saveToStorage();
  }

  getCurrentUser(): User | null {
    if (!this.currentSession) return null;
    
    for (const user of this.users.values()) {
      if (user.id === this.currentSession) {
        return user;
      }
    }
    return null;
  }

  async updateUser(updates: Partial<User>): Promise<User> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      throw new Error('ログインが必要です');
    }

    const updatedUser = { ...currentUser, ...updates };
    this.users.set(currentUser.email, updatedUser);
    this.saveToStorage();

    return updatedUser;
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<User> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      throw new Error('ログインが必要です');
    }

    const updatedUser = {
      ...currentUser,
      preferences: { ...currentUser.preferences, ...preferences }
    };

    this.users.set(currentUser.email, updatedUser);
    this.saveToStorage();

    return updatedUser;
  }

  // Migration helper: convert localStorage personalization to user account
  migrateLocalStorageData(): Partial<UserPreferences> | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem('baseball-ai-personalization');
      if (stored) {
        const data = JSON.parse(stored);
        return {
          preferredLeague: data.preferredLeague || 'npb',
          defaultViewMode: data.defaultViewMode || 'card',
          theme: data.theme || 'dark',
          language: data.language || 'ja',
        };
      }
    } catch (error) {
      console.warn('Failed to migrate localStorage data:', error);
    }
    return null;
  }
}

// Auth Context
const AuthContext = createContext<{
  authState: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
} | null>(null);

// Auth Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const authService = AuthService.getInstance();

  useEffect(() => {
    // Initialize auth state
    const user = authService.getCurrentUser();
    setAuthState({
      user,
      isLoading: false,
      isAuthenticated: !!user,
      error: null,
    });
  }, []);

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const user = await authService.login(email, password);
      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'ログインに失敗しました',
      }));
      throw error;
    }
  };

  const register = async (email: string, username: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Migrate existing localStorage data if available
      const migratedData = authService.migrateLocalStorageData();
      
      const user = await authService.register(email, username, password);
      
      // Apply migrated preferences
      if (migratedData) {
        await authService.updatePreferences(migratedData);
      }
      
      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '登録に失敗しました',
      }));
      throw error;
    }
  };

  const logout = async () => {
    await authService.logout();
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
  };

  const updateUser = async (updates: Partial<User>) => {
    try {
      const user = await authService.updateUser(updates);
      setAuthState(prev => ({ ...prev, user }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '更新に失敗しました',
      }));
      throw error;
    }
  };

  const updatePreferences = async (preferences: Partial<UserPreferences>) => {
    try {
      const user = await authService.updatePreferences(preferences);
      setAuthState(prev => ({ ...prev, user }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '設定の更新に失敗しました',
      }));
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      authState,
      login,
      register,
      logout,
      updateUser,
      updatePreferences,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Auth Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Auth Guard Hook
export function useAuthGuard(redirectTo?: string) {
  const { authState } = useAuth();
  
  useEffect(() => {
    if (!authState.isLoading && !authState.isAuthenticated && redirectTo) {
      window.location.href = redirectTo;
    }
  }, [authState.isLoading, authState.isAuthenticated, redirectTo]);

  return authState;
}