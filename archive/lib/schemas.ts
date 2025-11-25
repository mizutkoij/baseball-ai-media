/**
 * Zodスキーマ定義 - データ品質の単一ソース
 * 
 * 機能:
 * - 厳密な型チェック
 * - ランタイム検証
 * - 自動型推論
 * - エラー詳細報告
 */

import { z } from "zod";

// =====================================
// 基本型定義
// =====================================

export const TeamId = z.enum(["G","T","DB","C","S","D","F","H","M","E","L","Bs"]);
export const League = z.enum(["CL", "PL", "interleague"]);
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");
export const Hand = z.enum(["R", "L"]);

// =====================================
// 投手情報
// =====================================

export const PitcherInfo = z.object({
  name: z.string().min(1, "Pitcher name is required"),
  hand: Hand.optional(),
  era: z.number().min(0).optional(),
  eraMinus: z.number().optional(),
  wins: z.number().min(0).optional(),
  losses: z.number().min(0).optional(),
  note: z.string().optional(),
});

// =====================================
// 予告先発記録
// =====================================

export const StarterRecord = z.object({
  gameId: z.string().min(1, "Game ID is required"),
  date: IsoDate,
  league: League.optional(),
  home: TeamId,
  away: TeamId,
  homePitcher: PitcherInfo.optional(),
  awayPitcher: PitcherInfo.optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(["manual", "npb_official", "provider", "heuristic"]).optional(),
  updatedAt: z.string().optional(),
});

// =====================================
// 試合データ
// =====================================

export const BaseGameData = z.object({
  game_id: z.string().min(1),
  date: IsoDate,
  league: League,
  away_team: TeamId,
  home_team: TeamId,
  venue: z.string().optional(),
  start_time_jst: z.string().optional(),
  updated_at: z.string(),
});

export const GameData = BaseGameData.extend({
  away_score: z.number().optional(),
  home_score: z.number().optional(),
  status: z.enum(["scheduled", "live", "final", "postponed", "cancelled"]),
  inning: z.number().optional(),
  links: z.object({
    box_score: z.string().optional(),
    play_by_play: z.string().optional(),
  }).optional(),
});

// =====================================
// キープレー（RE24/WPA）
// =====================================

export const KeyPlay = z.object({
  index: z.number().optional(),
  inning: z.number().min(1).max(15),
  half: z.enum(["top", "bottom"]),
  team: TeamId,
  description: z.string().min(1),
  batterId: z.string().optional(),
  pitcherId: z.string().optional(),
  re24: z.number().optional(),
  wpa: z.number().min(-1).max(1).optional(),
  leverage: z.number().optional(),
  source: z.string().optional(),
  at: z.string().optional(), // ISO timestamp
});

// =====================================
// 検証結果
// =====================================

export const ValidationResult = z.object({
  isValid: z.boolean(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  fixedIssues: z.array(z.string()),
  dataQuality: z.enum(["excellent", "good", "fair", "poor"]),
});

// =====================================
// 型エクスポート
// =====================================

export type TeamId = z.infer<typeof TeamId>;
export type League = z.infer<typeof League>;
export type Hand = z.infer<typeof Hand>;
export type PitcherInfo = z.infer<typeof PitcherInfo>;
export type StarterRecord = z.infer<typeof StarterRecord>;
export type BaseGameData = z.infer<typeof BaseGameData>;
export type GameData = z.infer<typeof GameData>;
export type KeyPlay = z.infer<typeof KeyPlay>;
export type ValidationResult = z.infer<typeof ValidationResult>;

// =====================================
// 検証ヘルパー関数
// =====================================

export function validateStarters(data: unknown[]): {
  valid: StarterRecord[];
  invalid: { data: unknown; error: z.ZodError }[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    validationRate: number;
  };
} {
  const valid: StarterRecord[] = [];
  const invalid: { data: unknown; error: z.ZodError }[] = [];
  
  for (const item of data) {
    const result = StarterRecord.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ data: item, error: result.error });
    }
  }
  
  return {
    valid,
    invalid,
    summary: {
      total: data.length,
      valid: valid.length,
      invalid: invalid.length,
      validationRate: data.length > 0 ? valid.length / data.length : 0,
    },
  };
}

export function validateGames(data: unknown[]): {
  valid: GameData[];
  invalid: { data: unknown; error: z.ZodError }[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    validationRate: number;
  };
} {
  const valid: GameData[] = [];
  const invalid: { data: unknown; error: z.ZodError }[] = [];
  
  for (const item of data) {
    const result = GameData.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ data: item, error: result.error });
    }
  }
  
  return {
    valid,
    invalid,
    summary: {
      total: data.length,
      valid: valid.length,
      invalid: invalid.length,
      validationRate: data.length > 0 ? valid.length / data.length : 0,
    },
  };
}

export function validateKeyPlays(data: unknown[]): {
  valid: KeyPlay[];
  invalid: { data: unknown; error: z.ZodError }[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    validationRate: number;
  };
} {
  const valid: KeyPlay[] = [];
  const invalid: { data: unknown; error: z.ZodError }[] = [];
  
  for (const item of data) {
    const result = KeyPlay.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ data: item, error: result.error });
    }
  }
  
  return {
    valid,
    invalid,
    summary: {
      total: data.length,
      valid: valid.length,
      invalid: invalid.length,
      validationRate: data.length > 0 ? valid.length / data.length : 0,
    },
  };
}

// デバッグ用：スキーマ形状の出力
export function getSchemaShapes(): {
  StarterRecord: any;
  GameData: any;
  KeyPlay: any;
} {
  return {
    StarterRecord: StarterRecord.shape,
    GameData: GameData.shape,
    KeyPlay: KeyPlay.shape,
  };
}