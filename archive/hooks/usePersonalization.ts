'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export type League = 'npb' | 'mlb' | 'kbo' | 'international';
export type ViewPreference = 'card' | 'fangraphs' | 'savant';

interface PersonalizationData {
  // User preferences
  preferredLeague: League;
  defaultViewMode: ViewPreference;
  favoriteTeams: string[];
  favoritePlayers: string[];
  
  // Dashboard customization
  dashboardSections: {
    todayGames: boolean;
    leaderboards: boolean;
    favoriteUpdates: boolean;
    recentArticles: boolean;
    predictions: boolean;
  };
  
  // Settings
  enableNotifications: boolean;
  theme: 'dark' | 'light' | 'auto';
  language: 'ja' | 'en';
}

const DEFAULT_PERSONALIZATION: PersonalizationData = {
  preferredLeague: 'npb',
  defaultViewMode: 'card',
  favoriteTeams: [],
  favoritePlayers: [],
  dashboardSections: {
    todayGames: true,
    leaderboards: true,
    favoriteUpdates: false, // Requires favorites
    recentArticles: true,
    predictions: false
  },
  enableNotifications: false,
  theme: 'dark',
  language: 'ja'
};

export function usePersonalization() {
  const [personalization, setPersonalization] = useState<PersonalizationData>(DEFAULT_PERSONALIZATION);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const { authState, updatePreferences } = useAuth();

  // Load personalization data (from user account or localStorage)
  useEffect(() => {
    if (authState.isAuthenticated && authState.user) {
      // User is logged in - use account preferences
      const userPrefs = authState.user.preferences;
      setPersonalization({
        preferredLeague: userPrefs.preferredLeague,
        defaultViewMode: userPrefs.defaultViewMode,
        favoriteTeams: [], // TODO: Load from user account
        favoritePlayers: [], // TODO: Load from user account
        dashboardSections: {
          todayGames: true,
          leaderboards: true,
          favoriteUpdates: false,
          recentArticles: true,
          predictions: false
        },
        enableNotifications: userPrefs.notifications.email,
        theme: userPrefs.theme,
        language: userPrefs.language
      });
      setIsLoaded(true);
    } else if (!authState.isLoading) {
      // No user account - use localStorage
      try {
        const stored = localStorage.getItem('baseball-ai-personalization');
        if (stored) {
          const parsed = JSON.parse(stored);
          setPersonalization({ ...DEFAULT_PERSONALIZATION, ...parsed });
        }
      } catch (error) {
        console.warn('Failed to load personalization settings:', error);
      } finally {
        setIsLoaded(true);
      }
    }
  }, [authState.isAuthenticated, authState.isLoading, authState.user]);

  // Save preferences (to user account or localStorage)
  const updatePersonalization = async (updates: Partial<PersonalizationData>) => {
    const newData = { ...personalization, ...updates };
    setPersonalization(newData);
    
    if (authState.isAuthenticated) {
      // Save to user account
      try {
        await updatePreferences({
          preferredLeague: newData.preferredLeague,
          defaultViewMode: newData.defaultViewMode,
          theme: newData.theme,
          language: newData.language,
          notifications: {
            ...authState.user!.preferences.notifications,
            email: newData.enableNotifications
          }
        });
      } catch (error) {
        console.warn('Failed to save to user account:', error);
        // Fallback to localStorage
        try {
          localStorage.setItem('baseball-ai-personalization', JSON.stringify(newData));
        } catch (storageError) {
          console.warn('Failed to save to localStorage:', storageError);
        }
      }
    } else {
      // Save to localStorage
      try {
        localStorage.setItem('baseball-ai-personalization', JSON.stringify(newData));
      } catch (error) {
        console.warn('Failed to save personalization settings:', error);
      }
    }
  };

  // Specific update functions
  const setPreferredLeague = (league: League) => {
    updatePersonalization({ preferredLeague: league });
  };

  const setDefaultViewMode = (mode: ViewPreference) => {
    updatePersonalization({ defaultViewMode: mode });
  };

  const toggleFavoriteTeam = (teamId: string) => {
    const currentFavorites = personalization.favoriteTeams;
    const isCurrentlyFavorite = currentFavorites.includes(teamId);
    
    const newFavorites = isCurrentlyFavorite
      ? currentFavorites.filter(id => id !== teamId)
      : [...currentFavorites, teamId];
      
    updatePersonalization({ favoriteTeams: newFavorites });
    
    // Auto-enable favorite updates if user has favorites
    if (newFavorites.length > 0) {
      updatePersonalization({ 
        favoriteTeams: newFavorites,
        dashboardSections: {
          ...personalization.dashboardSections,
          favoriteUpdates: true
        }
      });
    }
  };

  const toggleFavoritePlayer = (playerId: string) => {
    const currentFavorites = personalization.favoritePlayers;
    const isCurrentlyFavorite = currentFavorites.includes(playerId);
    
    const newFavorites = isCurrentlyFavorite
      ? currentFavorites.filter(id => id !== playerId)
      : [...currentFavorites, playerId];
      
    updatePersonalization({ favoritePlayers: newFavorites });
    
    // Auto-enable favorite updates if user has favorites
    if (newFavorites.length > 0) {
      updatePersonalization({ 
        favoritePlayers: newFavorites,
        dashboardSections: {
          ...personalization.dashboardSections,
          favoriteUpdates: true
        }
      });
    }
  };

  const updateDashboardSection = (section: keyof PersonalizationData['dashboardSections'], enabled: boolean) => {
    updatePersonalization({
      dashboardSections: {
        ...personalization.dashboardSections,
        [section]: enabled
      }
    });
  };

  // Utility functions
  const isFavoriteTeam = (teamId: string) => personalization.favoriteTeams.includes(teamId);
  const isFavoritePlayer = (playerId: string) => personalization.favoritePlayers.includes(playerId);
  const hasFavorites = personalization.favoriteTeams.length > 0 || personalization.favoritePlayers.length > 0;
  
  // Get personalized dashboard configuration
  const getDashboardConfig = () => {
    const sections = personalization.dashboardSections;
    
    return {
      showTodayGames: sections.todayGames,
      showLeaderboards: sections.leaderboards,
      showFavoriteUpdates: sections.favoriteUpdates && hasFavorites,
      showRecentArticles: sections.recentArticles,
      showPredictions: sections.predictions,
      
      // Enhanced sections based on user preferences
      prioritizeLeague: personalization.preferredLeague,
      defaultView: personalization.defaultViewMode,
      hasFavorites,
      favoriteCount: personalization.favoriteTeams.length + personalization.favoritePlayers.length
    };
  };

  // Reset to defaults
  const resetPersonalization = () => {
    setPersonalization(DEFAULT_PERSONALIZATION);
    try {
      localStorage.removeItem('baseball-ai-personalization');
    } catch (error) {
      console.warn('Failed to clear personalization settings:', error);
    }
  };

  return {
    // Data
    personalization,
    isLoaded,
    hasAccount: authState.isAuthenticated,
    hasFavorites,
    
    // Update functions
    setPreferredLeague,
    setDefaultViewMode,
    toggleFavoriteTeam,
    toggleFavoritePlayer,
    updateDashboardSection,
    updatePersonalization,
    resetPersonalization,
    
    // Utility functions
    isFavoriteTeam,
    isFavoritePlayer,
    getDashboardConfig
  };
}