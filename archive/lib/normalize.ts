/**
 * NPBデータ正規化システム
 * 
 * 機能:
 * - チーム名/選手名/球場名の統一
 * - 日本語文字の正規化（髙→高、﨑→崎など）
 * - 全角/半角スペース、中黒の処理
 * - NFKC正規化
 */

import type { TeamId } from './schemas';

/** 漢字統一マップ */
const KANJI_FIX: Record<string, string> = {
  "髙": "高", "﨑": "崎", "齊": "斉", "齋": "斎", "槇": "槙",
  "邉": "辺", "邊": "辺", "渡邊": "渡辺", "渡邉": "渡辺",
  "沢": "澤", "澤": "沢", // 球界では「沢」が主流
  "竜": "龍", "龍": "竜", // 中日は「竜」
};

function fixKanji(s: string): string {
  return s.replace(/./g, ch => KANJI_FIX[ch] ?? ch);
}

/** 基本クリーニング（NFKC + トリミング） */
function basicClean(input: string): string {
  if (!input) return "";
  return input.normalize("NFKC").trim();
}

// =====================================
// Team Normalization
// =====================================

const TEAM_ALIASES: Record<string, TeamId> = {
  // セ・リーグ
  "巨人": "G", "読売": "G", "読売ジャイアンツ": "G", "ジャイアンツ": "G",
  "阪神": "T", "阪神タイガース": "T", "タイガース": "T",
  "横浜": "DB", "DeNA": "DB", "ＤｅＮＡ": "DB", "横浜DeNA": "DB", 
  "横浜DeNAベイスターズ": "DB", "ベイスターズ": "DB", "横浜ベイスターズ": "DB",
  "広島": "C", "広島東洋": "C", "広島東洋カープ": "C", "カープ": "C",
  "ヤクルト": "S", "東京ヤクルト": "S", "東京ヤクルトスワローズ": "S", "スワローズ": "S",
  "中日": "D", "中日ドラゴンズ": "D", "ドラゴンズ": "D",
  
  // パ・リーグ  
  "日本ハム": "F", "北海道日本ハム": "F", "北海道日本ハムファイターズ": "F", "ファイターズ": "F",
  "ソフトバンク": "H", "福岡ソフトバンク": "H", "福岡ソフトバンクホークス": "H", "ホークス": "H",
  "西武": "L", "埼玉西武": "L", "埼玉西武ライオンズ": "L", "ライオンズ": "L",
  "オリックス": "Bs", "オリックスバファローズ": "Bs", "バファローズ": "Bs",
  "ロッテ": "M", "千葉ロッテ": "M", "千葉ロッテマリーンズ": "M", "マリーンズ": "M",
  "楽天": "E", "東北楽天": "E", "東北楽天ゴールデンイーグルス": "E", "イーグルス": "E",
};

export function normalizeTeamId(input: string): TeamId {
  if (!input) throw new Error("Team name is required");
  
  const cleaned = basicClean(input);
  const normalized = TEAM_ALIASES[cleaned];
  
  if (!normalized) {
    // 既にTeamId形式かチェック
    if (['G', 'T', 'DB', 'C', 'S', 'D', 'F', 'H', 'L', 'Bs', 'M', 'E'].includes(cleaned as TeamId)) {
      return cleaned as TeamId;
    }
    throw new Error(`Unknown team alias: ${input}`);
  }
  
  return normalized;
}

// =====================================
// Stadium Normalization  
// =====================================

const STADIUM_ALIASES: Record<string, string> = {
  "東京D": "東京ドーム", "東京ドーム": "東京ドーム",
  "甲子園": "阪神甲子園球場", "阪神甲子園球場": "阪神甲子園球場",
  "神宮": "明治神宮野球場", "明治神宮野球場": "明治神宮野球場", "神宮球場": "明治神宮野球場",
  "横浜": "横浜スタジアム", "横浜スタジアム": "横浜スタジアム",
  "マツダ": "MAZDA Zoom-Zoom スタジアム広島", "マツダスタジアム": "MAZDA Zoom-Zoom スタジアム広島",
  "MAZDA Zoom-Zoom スタジアム広島": "MAZDA Zoom-Zoom スタジアム広島",
  "ナゴヤドーム": "バンテリンドーム ナゴヤ", "バンテリン": "バンテリンドーム ナゴヤ", 
  "バンテリンドーム": "バンテリンドーム ナゴヤ", "バンテリンドーム ナゴヤ": "バンテリンドーム ナゴヤ",
  "ベルーナ": "ベルーナドーム", "西武ドーム": "ベルーナドーム", "ベルーナドーム": "ベルーナドーム",
  "PayPay": "福岡PayPayドーム", "福岡ドーム": "福岡PayPayドーム", "福岡PayPayドーム": "福岡PayPayドーム",
  "札幌ドーム": "札幌ドーム",
  "エスコン": "ES CON FIELD HOKKAIDO", "ES CON FIELD HOKKAIDO": "ES CON FIELD HOKKAIDO",
  "楽天生命": "楽天生命パーク宮城", "楽天生命パーク": "楽天生命パーク宮城", 
  "楽天生命パーク宮城": "楽天生命パーク宮城", "Koboパーク": "楽天生命パーク宮城",
  "ZOZOマリン": "ZOZOマリンスタジアム", "ZOZOマリンスタジアム": "ZOZOマリンスタジアム",
  "マリンスタジアム": "ZOZOマリンスタジアム", "千葉マリン": "ZOZOマリンスタジアム",
};

export function normalizeStadium(input: string): string {
  if (!input) return input;
  
  const cleaned = basicClean(input);
  return STADIUM_ALIASES[cleaned] ?? cleaned;
}

// =====================================
// Player Name Normalization
// =====================================

export function normalizePlayerName(input: string): string {
  if (!input) return input;
  
  let name = fixKanji(basicClean(input));
  
  // スペース整理（全角→半角、複数→単一）
  name = name.replace(/[\u3000\u00A0]/g, " "); // 全角スペース、NBSPを半角に
  name = name.replace(/\s+/g, " "); // 複数スペースを単一に
  
  // 中黒除去（登録名は中黒なしで統一）
  name = name.replace(/・/g, "");
  
  // 括弧内の情報除去（元○○など）
  name = name.replace(/[（(].*?[）)]/g, "");
  
  return name.trim();
}

// =====================================
// Pitching Hand Normalization
// =====================================

export function normalizeHand(input?: string): "R" | "L" | undefined {
  if (!input) return undefined;
  
  const cleaned = basicClean(input);
  if (/右/.test(cleaned) || /^R$/i.test(cleaned)) return "R";
  if (/左/.test(cleaned) || /^L$/i.test(cleaned)) return "L";
  
  return undefined;
}

// =====================================
// Position Normalization
// =====================================

const POSITION_ALIASES: Record<string, string> = {
  "投": "投手", "P": "投手", "投手": "投手",
  "捕": "捕手", "C": "捕手", "捕手": "捕手",
  "一": "一塁手", "1B": "一塁手", "一塁手": "一塁手", "一塁": "一塁手",
  "二": "二塁手", "2B": "二塁手", "二塁手": "二塁手", "二塁": "二塁手", 
  "三": "三塁手", "3B": "三塁手", "三塁手": "三塁手", "三塁": "三塁手",
  "遊": "遊撃手", "SS": "遊撃手", "遊撃手": "遊撃手", "ショート": "遊撃手",
  "左": "左翼手", "LF": "左翼手", "左翼手": "左翼手", "レフト": "左翼手",
  "中": "中堅手", "CF": "中堅手", "中堅手": "中堅手", "センター": "中堅手",
  "右": "右翼手", "RF": "右翼手", "右翼手": "右翼手", "ライト": "右翼手",
  "指": "指名打者", "DH": "指名打者", "指名打者": "指名打者",
};

export function normalizePosition(input?: string): string | undefined {
  if (!input) return undefined;
  
  const cleaned = basicClean(input);
  return POSITION_ALIASES[cleaned] ?? cleaned;
}

// =====================================
// 警告収集（未知エイリアス検出用）
// =====================================

export interface NormalizationWarning {
  type: 'unknown_team' | 'unknown_stadium' | 'unknown_position';
  input: string;
  context?: string;
}

const warnings: NormalizationWarning[] = [];

export function getAndClearWarnings(): NormalizationWarning[] {
  const result = [...warnings];
  warnings.length = 0;
  return result;
}

function addWarning(type: NormalizationWarning['type'], input: string, context?: string) {
  warnings.push({ type, input, context });
}

// 警告付きバージョン（本番では必要に応じてこちらを使用）
export function normalizeTeamIdSafe(input: string): TeamId {
  try {
    return normalizeTeamId(input);
  } catch (error) {
    addWarning('unknown_team', input);
    // フォールバック：最初の文字をTeamIdとして扱う（危険だが継続可能）
    const fallback = input.charAt(0).toUpperCase();
    if (['G', 'T', 'D', 'C', 'S', 'F', 'H', 'L', 'M', 'E'].includes(fallback)) {
      return fallback as TeamId;
    }
    // 最後の手段
    return 'G';
  }
}