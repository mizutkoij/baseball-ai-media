import crypto from "crypto";
import { readFileSync } from "fs";
import path from "path";

// チーム・選手マッピング読み込み
const TEAM_MAP = JSON.parse(readFileSync(path.join(__dirname, '../maps/team_map.json'), 'utf8'));
const PLAYER_MAP = JSON.parse(readFileSync(path.join(__dirname, '../maps/player_map.json'), 'utf8'));

export interface GameMeta {
  gameId: string;
  dateISO: string;
  venue: string;
  league: 'central' | 'pacific';
  status: 'scheduled' | 'live' | 'finished';
  home: { id: string; name: string };
  away: { id: string; name: string };
  start?: string;
  startTimeLocal?: string;
}

export interface BoxScore {
  gameId: string;
  teams: {
    home: TeamStats;
    away: TeamStats;
  };
  players: {
    home: PlayerStats[];
    away: PlayerStats[];
  };
  pitchers: {
    home: PitcherStats[];
    away: PitcherStats[];
  };
}

export interface TeamStats {
  runs: number;
  hits: number;
  errors: number;
  lob?: number;
}

export interface PlayerStats {
  name: string;
  position: string;
  battingOrder: number;
  ab: number;
  runs: number;
  hits: number;
  rbi: number;
  bb?: number;
  so?: number;
  hr?: number;
}

export interface PitcherStats {
  name: string;
  decision?: 'W' | 'L' | 'S' | 'H';
  innings: string;
  hits: number;
  runs: number;
  earnedRuns: number;
  bb: number;
  so: number;
  hr?: number;
}

export interface SourceScore {
  source: string;
  reliability: number; // 0..1
  timestamp: string;
  conflicts?: string[];
}

/**
 * 正規化されたチーム名を取得
 */
function normTeam(teamId: string): string {
  // まず正規化マップを確認
  if (TEAM_MAP.normalization[teamId]) {
    return TEAM_MAP.normalization[teamId];
  }
  
  // チーム名の別名から正規化
  for (const [canonical, data] of Object.entries(TEAM_MAP.teams) as Array<[string, any]>) {
    if (data.names.includes(teamId)) {
      return canonical;
    }
  }
  
  // 見つからない場合は大文字・トリム
  return teamId.toUpperCase().trim();
}

/**
 * 開始時刻を10分単位に丸める
 */
function nearest10Min(iso: string): string {
  const d = new Date(iso);
  const minutes = Math.round(d.getMinutes() / 10) * 10;
  d.setMinutes(minutes, 0, 0);
  return d.toISOString().slice(11, 16); // "HH:MM"
}

/**
 * 試合の正規化キーを生成（重複検出用）
 */
export function canonicalKey(meta: GameMeta): string {
  const date = meta.dateISO.slice(0, 10);
  const startLocal10 = nearest10Min(meta.start ?? meta.startTimeLocal ?? meta.dateISO);
  const awayNorm = normTeam(meta.away.id);
  const homeNorm = normTeam(meta.home.id);
  
  return `${date}:${awayNorm}@${homeNorm}:${startLocal10}`;
}

/**
 * オブジェクトの指紋（ハッシュ）を生成
 */
export function fingerprint(obj: unknown): string {
  // 正規化されたJSONを生成（キーソート、不要フィールド除外）
  const normalized = JSON.stringify(obj, Object.keys(obj as object).sort());
  return crypto.createHash("sha256").update(normalized, 'utf8').digest("hex");
}

/**
 * 複数のソースから最良の値を選択
 */
export function chooseBest<T>(candidates: Array<{ value: T; score: SourceScore }>): T {
  if (candidates.length === 0) {
    throw new Error("No candidates provided");
  }
  
  // 信頼度でソート（降順）
  const sorted = candidates.sort((a, b) => {
    // 信頼度が同じ場合は、新しいタイムスタンプを優先
    if (b.score.reliability === a.score.reliability) {
      return new Date(b.score.timestamp).getTime() - new Date(a.score.timestamp).getTime();
    }
    return b.score.reliability - a.score.reliability;
  });
  
  return sorted[0].value;
}

/**
 * データ品質スコアを計算
 */
export function calculateQualityScore(meta: GameMeta, boxScore?: BoxScore): number {
  let score = 100;
  
  // 必須フィールドチェック
  if (!meta.gameId) score -= 20;
  if (!meta.dateISO) score -= 15;
  if (!meta.venue) score -= 10;
  if (!meta.home?.name || !meta.away?.name) score -= 15;
  
  // スコア情報の整合性
  if (boxScore) {
    const homeRuns = boxScore.teams.home.runs;
    const awayRuns = boxScore.teams.away.runs;
    
    if (homeRuns < 0 || awayRuns < 0) score -= 25;
    if (homeRuns > 30 || awayRuns > 30) score -= 10; // 異常値
    
    // 選手データの整合性
    const homePlayers = boxScore.players.home.length;
    const awayPlayers = boxScore.players.away.length;
    
    if (homePlayers < 9 || awayPlayers < 9) score -= 15; // 規定選手数不足
    if (homePlayers > 15 || awayPlayers > 15) score -= 5; // 代打・代走多数
  }
  
  // 時刻の妥当性
  if (meta.start) {
    const startTime = new Date(meta.start);
    const hour = startTime.getHours();
    if (hour < 12 || hour > 20) score -= 5; // 通常の試合時間外
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * チーム名を正規化
 */
export function normalizeTeamName(rawName: string): string {
  return normTeam(rawName);
}

/**
 * 選手名を正規化
 */
export function normalizePlayerName(rawName: string, teamId?: string): string {
  // サフィックス除去
  let normalized = rawName.trim();
  for (const suffix of PLAYER_MAP.normalization_patterns.suffix_removal) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
    }
  }
  
  // 名前のバリエーション統一
  for (const [canonical, variations] of Object.entries(PLAYER_MAP.normalization_patterns.name_variations) as [string, string[]][]) {
    if (variations.includes(normalized)) {
      return canonical;
    }
  }
  
  // プレイヤーマップから検索
  for (const [canonical, data] of Object.entries(PLAYER_MAP.players) as Array<[string, any]>) {
    if (data.names.includes(normalized)) {
      return canonical;
    }
  }
  
  return normalized;
}

/**
 * ゲームメタデータをマージ
 */
export function mergeGameMeta(
  existing: GameMeta,
  incoming: GameMeta,
  incomingScore: SourceScore
): GameMeta {
  const result = { ...existing };
  
  // より信頼度の高いソースの情報を採用
  const candidates = [
    { value: existing, score: { source: 'existing', reliability: 0.8, timestamp: new Date().toISOString() } },
    { value: incoming, score: incomingScore }
  ];
  
  const bestMeta = chooseBest(candidates);
  
  return {
    ...result,
    ...bestMeta,
    // 特定フィールドは個別に判定
    gameId: existing.gameId, // 既存のIDを保持
    venue: bestMeta.venue || existing.venue,
    start: bestMeta.start || existing.start
  };
}

/**
 * 試合データの整合性を検証
 */
export function validateGameData(meta: GameMeta, boxScore?: BoxScore): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 基本検証
  if (!meta.gameId) errors.push("Missing gameId");
  if (!meta.dateISO || isNaN(Date.parse(meta.dateISO))) errors.push("Invalid dateISO");
  if (!meta.home?.name || !meta.away?.name) errors.push("Missing team names");
  
  // ボックススコア検証
  if (boxScore) {
    const { home, away } = boxScore.teams;
    
    if (home.runs < 0 || away.runs < 0) {
      errors.push("Negative runs detected");
    }
    
    if (home.hits < 0 || away.hits < 0) {
      errors.push("Negative hits detected");
    }
    
    // 選手データ検証
    if (boxScore.players.home.length === 0 || boxScore.players.away.length === 0) {
      errors.push("Missing player data");
    }
    
    // 打席数の妥当性（簡易チェック）
    for (const team of [boxScore.players.home, boxScore.players.away]) {
      for (const player of team) {
        if (player.ab < 0 || player.hits < 0 || player.runs < 0 || player.rbi < 0) {
          errors.push(`Invalid stats for player ${player.name}`);
        }
        if (player.hits > player.ab && player.bb === undefined) {
          errors.push(`Hits > AB for player ${player.name} without BB data`);
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}