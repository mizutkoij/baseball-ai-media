/**
 * 正規化→重複抑止→差分保存システム
 * 
 * 機能:
 * - カノニカル化されたデータの保存
 * - ハッシュベースの重複検出
 * - 差分の自動計算と保存
 * - メトリクス統合
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { canonicalizeRecord, keyOf, hashRecord, hashSet, diffSets, detectKeyCollisions, type Kind, type SetDiff, type KeyCollision } from './canonical';
import { itemsTotal, scrapeJobs, validationResults } from './prometheus-metrics';
import { logger } from './logger';
import { notifyDataDiff, sendJsonAttachment } from './discord-notifier';

export interface WriteResult {
  action: "skip" | "write";
  filePath?: string;
  items: number;
  diff?: SetDiff;
  collisions?: KeyCollision[];
  newHash?: string;
  prevHash?: string;
  skippedReason?: string;
}

/**
 * パーティション化されたディレクトリパスを生成
 * 例: data/starters/date=2025-08-11
 */
function partitionPath(baseDir: string, kind: Kind, date: string): string {
  return path.join(baseDir, kind, `date=${date}`);
}

/**
 * ファイルを安全に読み込み（存在しない場合はnullを返す）
 */
async function readTextSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    return null;
  }
}

/**
 * JSONファイルを安全に読み込み
 */
async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  const text = await readTextSafe(filePath);
  if (!text) return null;
  
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    logger.warn({ filePath, error: String(error) }, 'Failed to parse JSON file');
    return null;
  }
}

/**
 * タイムスタンプ形式のファイル名を生成
 * 例: 20250811T091530
 */
function generateTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .slice(0, 15); // YYYYMMDDTHHMMSS
}

/**
 * カノニカル化されたレコードセットを書き込み
 * 
 * @param opts 書き込みオプション
 * @returns 書き込み結果
 */
export async function writeCanonicalSet(opts: {
  baseDir: string;
  kind: Kind; 
  date: string;
  records: any[];
  skipOnNoChange?: boolean;
}): Promise<WriteResult> {
  
  const { baseDir, kind, date, skipOnNoChange = true } = opts;
  const startTime = Date.now();
  
  logger.debug({ 
    kind, 
    date, 
    recordCount: opts.records.length 
  }, 'Starting canonical write');
  
  try {
    // パーティションディレクトリを作成
    const partitionDir = partitionPath(baseDir, kind, date);
    await fs.mkdir(partitionDir, { recursive: true });
    
    // 前回ハッシュの読み込み
    const latestHashPath = path.join(partitionDir, "latest.hash");
    const prevHash = (await readTextSafe(latestHashPath))?.trim() ?? "";
    
    // レコードの正規化とカノニカル化
    const normalized = opts.records.map(record => canonicalizeRecord(kind, record));
    
    // キー衝突の検出
    const collisions = detectKeyCollisions(kind, normalized);
    if (collisions.length > 0) {
      logger.warn({ 
        kind, 
        date, 
        collisions: collisions.map(c => ({ key: c.key, count: c.records.length }))
      }, 'Key collisions detected');
      
      // メトリクス記録
      validationResults.inc({ type: 'canonical', result: 'warning' }, collisions.length);
    }
    
    // 新しいハッシュを計算
    const newHash = hashSet(kind, normalized);
    
    // 変更なしの場合はスキップ
    if (skipOnNoChange && newHash === prevHash) {
      scrapeJobs.inc({ job: kind, result: "skip" });
      
      logger.debug({ 
        kind, 
        date, 
        hash: newHash,
        duration: Date.now() - startTime
      }, 'No changes detected, skipping write');
      
      return { 
        action: "skip", 
        items: normalized.length,
        newHash,
        prevHash,
        skippedReason: "no_hash_change"
      };
    }
    
    // 前回のデータを読み込んで差分計算
    const latestJsonPath = path.join(partitionDir, "latest.json");
    const prevRecords: any[] = (await readJsonSafe<any[]>(latestJsonPath)) ?? [];
    
    const diff = diffSets(kind, prevRecords, normalized);
    
    // ファイル名生成
    const timestamp = generateTimestamp();
    const snapshotPath = path.join(partitionDir, `${timestamp}.json`);
    const diffPath = path.join(partitionDir, `${timestamp}.diff.json`);
    
    // ファイル書き込み
    const jsonContent = JSON.stringify(normalized, null, 2);
    
    // 1. タイムスタンプ付きスナップショット
    await fs.writeFile(snapshotPath, jsonContent, "utf-8");
    
    // 2. latest.json の更新
    await fs.writeFile(latestJsonPath, jsonContent, "utf-8");
    
    // 3. latest.hash の更新  
    await fs.writeFile(latestHashPath, newHash, "utf-8");
    
    // 4. 差分情報の保存
    const diffData = {
      ...diff,
      metadata: {
        kind,
        date,
        timestamp,
        prevHash,
        newHash,
        totalItems: normalized.length,
        collisions: collisions.length
      }
    };
    await fs.writeFile(diffPath, JSON.stringify(diffData, null, 2), "utf-8");
    
    // メトリクス記録
    scrapeJobs.inc({ job: kind, result: "success" });
    itemsTotal.inc({ job: kind }, normalized.length);
    
    if (diff.added.length > 0) {
      validationResults.inc({ type: 'canonical', result: 'added' }, diff.added.length);
    }
    if (diff.updated.length > 0) {
      validationResults.inc({ type: 'canonical', result: 'updated' }, diff.updated.length);
    }
    if (diff.removed.length > 0) {
      validationResults.inc({ type: 'canonical', result: 'removed' }, diff.removed.length);
    }
    
    logger.info({ 
      kind, 
      date,
      action: 'write',
      items: normalized.length,
      added: diff.added.length,
      updated: diff.updated.length, 
      removed: diff.removed.length,
      collisions: collisions.length,
      filePath: snapshotPath,
      duration: Date.now() - startTime
    }, 'Canonical write completed');
    
    // Discord通知: 差分データ送信
    notifyDataDiff(kind, {
      added: diff.added,
      removed: diff.removed,
      updated: diff.updated,
      date
    });
    
    // 実際のレコードも添付で送信（"毎回"）
    if (normalized.length > 0) {
      sendJsonAttachment(`canonical_${kind}_${date}`, {
        records: normalized,
        metadata: {
          timestamp,
          items: normalized.length,
          hash: newHash
        }
      });
    }
    
    return {
      action: "write",
      filePath: snapshotPath,
      items: normalized.length,
      diff,
      collisions: collisions.length > 0 ? collisions : undefined,
      newHash,
      prevHash
    };
    
  } catch (error) {
    logger.error({ 
      kind, 
      date, 
      error: String(error),
      duration: Date.now() - startTime
    }, 'Canonical write failed');
    
    scrapeJobs.inc({ job: kind, result: "fail" });
    throw error;
  }
}

/**
 * 特定期間のデータを一括で再処理
 */
export async function reprocessDateRange(opts: {
  baseDir: string;
  kind: Kind;
  startDate: string;
  endDate: string;
  processor: (date: string) => Promise<any[]>;
}): Promise<WriteResult[]> {
  
  const { baseDir, kind, startDate, endDate, processor } = opts;
  const results: WriteResult[] = [];
  
  logger.info({ kind, startDate, endDate }, 'Starting date range reprocessing');
  
  // 日付範囲を生成（簡易実装）
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let current = start; current <= end; current.setDate(current.getDate() + 1)) {
    dates.push(current.toISOString().slice(0, 10));
  }
  
  for (const date of dates) {
    try {
      const records = await processor(date);
      const result = await writeCanonicalSet({
        baseDir,
        kind,
        date,
        records,
        skipOnNoChange: false // 再処理時は強制書き込み
      });
      
      results.push(result);
      
    } catch (error) {
      logger.error({ kind, date, error: String(error) }, 'Failed to reprocess date');
      
      results.push({
        action: "skip",
        items: 0,
        skippedReason: `error: ${String(error)}`
      });
    }
  }
  
  logger.info({ 
    kind, 
    total: results.length,
    written: results.filter(r => r.action === 'write').length,
    skipped: results.filter(r => r.action === 'skip').length
  }, 'Date range reprocessing completed');
  
  return results;
}

/**
 * データ整合性チェック
 */
export interface IntegrityReport {
  kind: Kind;
  date: string;
  issues: {
    missingLatest: boolean;
    missingHash: boolean;
    hashMismatch: boolean;
    keyCollisions: number;
    corruptedJson: boolean;
  };
  recommendations: string[];
}

export async function checkDataIntegrity(
  baseDir: string, 
  kind: Kind, 
  date: string
): Promise<IntegrityReport> {
  
  const partitionDir = partitionPath(baseDir, kind, date);
  const latestJsonPath = path.join(partitionDir, "latest.json");
  const latestHashPath = path.join(partitionDir, "latest.hash");
  
  const report: IntegrityReport = {
    kind,
    date,
    issues: {
      missingLatest: false,
      missingHash: false,
      hashMismatch: false,
      keyCollisions: 0,
      corruptedJson: false
    },
    recommendations: []
  };
  
  // latest.json の存在確認
  const latestData = await readJsonSafe<any[]>(latestJsonPath);
  if (!latestData) {
    report.issues.missingLatest = true;
    report.recommendations.push('latest.json が見つかりません。データの再取得が必要です。');
    return report;
  }
  
  // latest.hash の存在確認
  const storedHash = await readTextSafe(latestHashPath);
  if (!storedHash) {
    report.issues.missingHash = true;
    report.recommendations.push('latest.hash が見つかりません。ハッシュの再計算が必要です。');
  } else {
    // ハッシュの整合性チェック
    const computedHash = hashSet(kind, latestData);
    if (storedHash.trim() !== computedHash) {
      report.issues.hashMismatch = true;
      report.recommendations.push('ハッシュの不整合が検出されました。データの再検証が必要です。');
    }
  }
  
  // キー衝突の検出
  try {
    const collisions = detectKeyCollisions(kind, latestData);
    report.issues.keyCollisions = collisions.length;
    
    if (collisions.length > 0) {
      report.recommendations.push(`${collisions.length}件のキー衝突が検出されました。重複データの確認が必要です。`);
    }
  } catch (error) {
    report.issues.corruptedJson = true;
    report.recommendations.push('データの解析中にエラーが発生しました。JSONファイルが破損している可能性があります。');
  }
  
  return report;
}