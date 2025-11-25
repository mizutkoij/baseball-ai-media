/**
 * NPB統一型定義 (Single Source of Truth)
 * 全スクレイパー・バリデーター・アダプターで共有
 */

// =====================================
// Core Types
// =====================================

export type League = 'CL' | 'PL' | 'interleague';
export type GameStatus = 'scheduled' | 'live' | 'final' | 'postponed' | 'cancelled';
export type TeamId = 'G' | 'T' | 'D' | 'C' | 'S' | 'DB' | 'H' | 'F' | 'L' | 'Bs' | 'M' | 'E';
export type Hand = 'R' | 'L';

// =====================================
// Game Data
// =====================================

export interface BaseGameData {
  game_id: string;
  date: string; // YYYY-MM-DD
  league: League;
  away_team: TeamId;
  home_team: TeamId;
  venue?: string;
  start_time_jst?: string;
  updated_at: string; // ISO string
}

export interface GameData extends BaseGameData {
  away_score?: number;
  home_score?: number;
  status: GameStatus;
  inning?: number;
  links?: {
    box_score?: string;
    play_by_play?: string;
  };
}

export interface DetailedGameData extends BaseGameData {
  homeScore: number;
  awayScore: number;
  startTime: string;
  endTime?: string;
  duration?: string;
  attendance?: string;
  weather?: string;
  status: 'finished' | 'scheduled' | 'live';
  inningScores?: {
    away: number[];
    home: number[];
  };
  teamStats?: {
    away: { hits: number; errors: number; };
    home: { hits: number; errors: number; };
  };
  playerStats?: {
    away: PlayerBattingStats[];
    home: PlayerBattingStats[];
  };
  pitchers?: {
    away: PitcherStats[];
    home: PitcherStats[];
  };
}

// =====================================
// Player Data
// =====================================

export interface PlayerBattingStats {
  battingOrder: number;
  position: string;
  name: string;
  atBats: number;
  runs: number;
  hits: number;
  rbis: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  walks?: number;
  strikeouts?: number;
}

export interface PitcherStats {
  name: string;
  hand?: Hand;
  inningsPitched: number;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  era?: number;
  result?: 'W' | 'L' | 'S' | 'H' | '-';
}

// =====================================
// Starting Pitchers
// =====================================

export interface PitcherInfo {
  name: string;
  hand?: Hand;
  era?: number;
  eraMinus?: number;
  wins?: number;
  losses?: number;
  note?: string;
}

export interface StarterRecord {
  gameId: string;
  date: string; // YYYY-MM-DD
  league?: League;
  home: TeamId;
  away: TeamId;
  homePitcher?: PitcherInfo;
  awayPitcher?: PitcherInfo;
  confidence?: number; // 0-1
  source?: string; // "manual" | "npb_official" | "provider" | "heuristic"
  updatedAt?: string; // ISO string
}

// =====================================
// Key Plays (RE24/WPA)
// =====================================

export interface KeyPlay {
  index?: number;
  inning: number; // 1..15
  half: "top" | "bottom";
  team: TeamId;
  description: string;
  batterId?: string;
  pitcherId?: string;
  re24?: number;
  wpa?: number; // -1..+1
  leverage?: number;
  source?: string;
  at?: string; // ISO timestamp
}

// =====================================
// Scraping Configuration
// =====================================

export interface ScrapingOptions {
  year: number;
  month?: number;
  league?: 'first' | 'farm' | 'both';
  includeDetails?: boolean;
  retryAttempts?: number;
  delayMs?: number;
  userAgent?: string;
}

export interface ScrapingConfig {
  scheduleEnabled: boolean;
  startersEnabled: boolean;
  detailedEnabled: boolean;
  maxRetries: number;
  delayMs: number;
  dataDir: string;
  notificationWebhook?: string;
  rateLimiting?: {
    requestsPerSecond: number;
    burstSize: number;
  };
}

// =====================================
// Validation & Quality
// =====================================

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  fixedIssues: string[];
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface DataMetrics {
  totalItems: number;
  validItems: number;
  duplicateItems: number;
  incompleteItems: number;
  errorRate: number;
}

// =====================================
// Scraping Results & Logs
// =====================================

export interface ScrapingResult {
  timestamp: string; // ISO
  taskName?: string;
  success: boolean;
  dataTypes: string[];
  itemsProcessed: number;
  errors: string[];
  warnings: string[];
  duration: number; // ms
  metrics?: {
    requestsMade: number;
    bytesTransferred: number;
    averageResponseTime: number;
  };
}

// =====================================
// Structured Logging
// =====================================

export interface LogEntry {
  timestamp: string; // ISO
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string; // e.g., 'automated-scraper', 'npb-starters-scraper'
  message: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// =====================================
// HTTP & Rate Limiting
// =====================================

export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  useJitter?: boolean;
}