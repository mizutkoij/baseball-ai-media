// lib/api.ts - Updated types for highlights
export async function apiGet<T>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""; // 空=同一オリジン  
  const r = await fetch(`${base}${path}`, { 
    next: { revalidate: 0 },
    cache: 'no-store'
  });
  
  if (!r.ok) {
    throw new Error(`API Error ${r.status}: ${r.statusText}`);
  }
  
  return r.json();
}

// Updated type definitions
export interface TodayGame {
  game_id: string;
  date: string;
  start_time_jst: string;
  status: string;
  inning: string | null;
  away_team: string;
  home_team: string;
  away_score: number | null;
  home_score: number | null;
  venue: string;
  tv: string | null;
  league: string;                   // NEW: リーグ（first/farm）
  highlights_count?: number;        // NEW: ハイライト件数
  last_highlight_ts?: string;       // NEW: 最終ハイライト時刻
}

export interface PBPEvent {
  game_id: string;
  ts: string;
  inning: number;
  half: string;
  batter: string;
  pitcher: string;
  pitch_seq: number;
  result: string;
  count_b: number;
  count_s: number;
  count_o: number;
  bases: string;
  away_runs: number;
  home_runs: number;
  wp_v2_after?: number;
  re_after?: number;
  wpa?: number;
}

export interface HighlightEvent {
  pitch_seq: number;
  inning: number;
  half: string;
  batter: string;
  pitcher: string;
  result: string;
  bases: string;
  away_runs: number;
  home_runs: number;
  wp_after: number;
  wpa: number;
  ts: string;
}

export interface WPPoint {
  pitch_seq: number;
  ts: string;
  wp: number;
}

// API Response types
export interface TodayGamesResponse {
  source: string;
  league: string;                   // NEW: リーグ
  games: number;                    // NEW: 試合数
  ts: string;
  wpa_threshold?: number;           // NEW: ハイライト閾値
  data: TodayGame[];
}

export interface PBPResponse {
  source: string;
  game_id: string;
  total_events: number;
  events: PBPEvent[];
  last_updated: string | null;
}

export interface HighlightsResponse {
  source: string;
  game_id: string;
  threshold: number;
  events: HighlightEvent[];
  count: number;
}

export interface WPSeriesResponse {
  source: string;
  game_id: string;
  points: WPPoint[];
  count: number;
}

// WARランキングデータ取得関数
export async function getWarLeaders(): Promise<string[]> {
  return apiGet<string[]>("/api/war-leaders");
}
