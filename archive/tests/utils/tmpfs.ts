/**
 * Test Filesystem Utilities
 * 
 * 機能:
 * - テスト用一時ディレクトリ作成
 * - テストデータファイル作成
 * - パス操作ヘルパー
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * テスト用一時ディレクトリを作成
 */
export async function makeTmpDir(prefix: string): Promise<string> {
  const baseDir = process.env.DATA_DIR ?? "tmp";
  const dir = path.join(baseDir, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * テストデータファイルを作成
 */
export async function createTestDataFile(
  dir: string, 
  kind: string, 
  date: string, 
  data: any[]
): Promise<string> {
  const partitionDir = path.join(dir, kind, `date=${date}`);
  await fs.mkdir(partitionDir, { recursive: true });
  
  const filePath = path.join(partitionDir, 'latest.json');
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  
  return filePath;
}

/**
 * JSONファイルを読み込み
 */
export async function readTestDataFile(filePath: string): Promise<any> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * ディレクトリ内のファイル一覧を取得
 */
export async function listFiles(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

/**
 * パスが存在するかチェック
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}