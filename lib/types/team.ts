/**
 * Team-related TypeScript interfaces
 * Extracted from database modules to avoid client-side bundling issues
 */

export interface TeamSplitStats {
  split_type: 'home' | 'away';
  games: number;
  reliability: 'high' | 'medium' | 'low';
  
  // Batting stats
  runs: number;
  runs_per_game: number;
  wRC_plus: number;
  wRC_plus_neutral?: number;
  OPS: number;
  OPS_neutral?: number;
  
  // Pitching stats
  runs_allowed: number;
  runs_allowed_per_game: number;
  ERA_minus: number;
  ERA_minus_neutral?: number;
  FIP_minus: number;
  FIP_minus_neutral?: number;
  
  // Park factor adjustments
  venue_pf?: number;
  pf_impact?: {
    batting_boost: number;
    pitching_penalty: number;
    overall_rating: number;
  };
}

export interface TeamStandings {
  team: string;
  W: number;
  L: number;
  D: number;
  RD: number; // Run differential
  rank: number;
  last10: { W: number; L: number; D: number };
}

export interface LeaderRow {
  player_id: string;
  player_name: string;
  team: string;
  PA?: number;
  IP?: number;
  wRC_plus?: number;
  FIP_minus?: number;
  // Core stats for display
  avg?: number;
  obp?: number;
  slg?: number;
  HR?: number;
  era?: number;
  whip?: number;
  SO?: number;
}

export interface TeamSummary {
  batting: {
    wRC_plus: number;
    wOBA: number;
    OPS: number;
    R: number;
    HR: number;
    SB: number;
  };
  pitching: {
    ERA_minus: number;
    FIP_minus: number;
    WHIP: number;
    SO_9: number;
    BB_9: number;
    RA: number;
  };
  record: {
    W: number;
    L: number;
    D: number;
    GB: number;
    rank: number;
  };
}