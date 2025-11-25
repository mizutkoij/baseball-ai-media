/**
 * カノニカル化・ハッシュ・キー設計システム
 * 
 * 機能:
 * - レコードの正規化とハッシュ化
 * - 種別ごとの一意キー生成
 * - 集合レベルでの重複検出
 * - 揮発性フィールドの除外
 */

import * as crypto from 'crypto';

export type Kind = "starters" | "games" | "details" | "keyplays";

/** ハッシュに含めないフィールド（揮発項目） */
const VOLATILE_FIELDS = new Set([
  "scrapedAt", 
  "retrievedAt", 
  "sourceTs", 
  "warnings",
  "updatedAt",
  "createdAt",
  "_metadata",
  "_temp"
]);

/**
 * オブジェクトのキーを再帰的にソートして安定化
 */
export function deepSortKeys<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(deepSortKeys) as unknown as T;
  }
  
  if (obj && typeof obj === "object" && obj !== null) {
    const out: any = {};
    const keys = Object.keys(obj as any).sort();
    
    for (const key of keys) {
      out[key] = deepSortKeys((obj as any)[key]);
    }
    
    return out;
  }
  
  return obj;
}

/**
 * レコードをカノニカル形式に変換
 * - 揮発性フィールドを除外
 * - キーを辞書順にソート
 * - ネストした構造も再帰的に処理
 */
export function canonicalizeRecord(kind: Kind, rec: any): any {
  if (!rec || typeof rec !== 'object') {
    return rec;
  }
  
  const copy: any = {};
  
  // 揮発性フィールドを除外しながらコピー
  for (const [key, value] of Object.entries(rec)) {
    if (VOLATILE_FIELDS.has(key)) {
      continue;
    }
    copy[key] = value;
  }
  
  return deepSortKeys(copy);
}

/**
 * SHA256ハッシュを計算
 */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, 'utf8').digest("hex");
}

/**
 * 種別ごとの一意キー生成
 * 重複判定やdiff計算に使用
 */
export function keyOf(kind: Kind, rec: any): string {
  if (!rec) {
    throw new Error(`Cannot generate key for null/undefined record of kind: ${kind}`);
  }
  
  switch (kind) {
    case "starters":
      // 同日の同一ゲーム = 1行（gameId で一意識別）
      if (!rec.gameId) {
        throw new Error(`Missing gameId for starters key: ${JSON.stringify(rec)}`);
      }
      return rec.gameId;
      
    case "games":
      // ゲームIDで一意識別
      if (!rec.gameId && !rec.game_id) {
        throw new Error(`Missing gameId/game_id for games key: ${JSON.stringify(rec)}`);
      }
      return rec.gameId || rec.game_id;
      
    case "keyplays":
      // 試合 + イニング + ハーフ + 順序で一意
      if (!rec.gameId || !rec.inning || !rec.half) {
        throw new Error(`Missing required fields for keyplays key: gameId=${rec.gameId}, inning=${rec.inning}, half=${rec.half}`);
      }
      const seq = rec.index ?? rec.sequence ?? rec.order ?? 0;
      return `${rec.gameId}#${rec.inning}${rec.half}#${seq}`;
      
    case "details":
      // 試合 + 打席/イベントindex
      if (!rec.gameId) {
        throw new Error(`Missing gameId for details key: ${JSON.stringify(rec)}`);
      }
      const eventId = rec.eventIndex ?? rec.atBatIndex ?? rec.seq ?? rec.index ?? 0;
      return `${rec.gameId}#${eventId}`;
      
    default:
      throw new Error(`Unknown kind: ${kind}`);
  }
}

/**
 * レコード単位のハッシュ生成（キー + 正規化された内容）
 */
export function hashRecord(kind: Kind, rec: any): string {
  const canonical = canonicalizeRecord(kind, rec);
  const json = JSON.stringify(canonical);
  return sha256(json);
}

/**
 * 集合全体のハッシュ生成（順序不問で安定）
 * 同じレコード群なら常に同じハッシュを生成
 */
export function hashSet(kind: Kind, records: any[]): string {
  if (!Array.isArray(records)) {
    throw new Error(`Records must be an array for kind: ${kind}`);
  }
  
  if (records.length === 0) {
    return sha256("[]"); // 空集合の標準ハッシュ
  }
  
  try {
    // キーとハッシュのペアを作成し、キーでソート（安定性確保）
    const pairs = records.map(record => {
      const key = keyOf(kind, record);
      const hash = hashRecord(kind, record);
      return [key, hash] as const;
    });
    
    // キーでソートして順序を安定化
    pairs.sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
    
    const json = JSON.stringify(pairs);
    return sha256(json);
    
  } catch (error) {
    throw new Error(`Failed to hash set of kind ${kind}: ${error}`);
  }
}

/**
 * 二つのレコード集合の差分を計算
 */
export interface SetDiff {
  added: string[];      // 新しく追加されたキー
  removed: string[];    // 削除されたキー  
  updated: string[];    // 内容が変更されたキー
  unchanged: string[];  // 変更されていないキー
}

export function diffSets(kind: Kind, prevRecords: any[], nextRecords: any[]): SetDiff {
  const prevMap = new Map<string, string>();
  const nextMap = new Map<string, string>();
  
  // 前回のレコードをマップ化
  for (const record of prevRecords) {
    const key = keyOf(kind, record);
    const hash = hashRecord(kind, record);
    prevMap.set(key, hash);
  }
  
  // 今回のレコードをマップ化
  for (const record of nextRecords) {
    const key = keyOf(kind, record);
    const hash = hashRecord(kind, record);
    nextMap.set(key, hash);
  }
  
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  
  // 追加・更新を検出
  for (const [key, hash] of nextMap.entries()) {
    if (!prevMap.has(key)) {
      added.push(key);
    } else if (prevMap.get(key) !== hash) {
      updated.push(key);
    } else {
      unchanged.push(key);
    }
  }
  
  // 削除を検出
  for (const key of prevMap.keys()) {
    if (!nextMap.has(key)) {
      removed.push(key);
    }
  }
  
  return { added, removed, updated, unchanged };
}

/**
 * キー衝突の検出（同一キーで異なる内容）
 */
export interface KeyCollision {
  key: string;
  records: any[];
  hashes: string[];
}

export function detectKeyCollisions(kind: Kind, records: any[]): KeyCollision[] {
  const keyToRecords = new Map<string, any[]>();
  
  // キーごとにレコードをグループ化
  for (const record of records) {
    const key = keyOf(kind, record);
    
    if (!keyToRecords.has(key)) {
      keyToRecords.set(key, []);
    }
    keyToRecords.get(key)!.push(record);
  }
  
  const collisions: KeyCollision[] = [];
  
  // 複数レコードが同一キーに紐付いている場合をチェック
  for (const [key, recs] of keyToRecords.entries()) {
    if (recs.length > 1) {
      const hashes = recs.map(rec => hashRecord(kind, rec));
      const uniqueHashes = new Set(hashes);
      
      // ハッシュが異なる場合のみ衝突として報告
      if (uniqueHashes.size > 1) {
        collisions.push({
          key,
          records: recs,
          hashes: Array.from(uniqueHashes)
        });
      }
    }
  }
  
  return collisions;
}