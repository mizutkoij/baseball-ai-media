/**
 * Test Environment Setup - Phase 6: Testing/DX
 * 
 * 機能:
 * - JST時間帯設定
 * - 隔離されたテストデータディレクトリ
 * - テスト前後のクリーンアップ
 * - 共通環境変数設定
 */

import { afterAll, beforeAll } from "vitest";
import * as fs from 'fs/promises';
import * as path from 'path';

// JST時間帯設定（スケジューリングテスト用）
process.env.TZ = "Asia/Tokyo";

// テスト用データディレクトリ
const TEST_DATA_DIR = path.join(process.cwd(), "tmp_test_data");
process.env.DATA_DIR = TEST_DATA_DIR;
(process.env as any).NODE_ENV = "test";

// ログレベルを抑制（テスト出力をクリーンに）
process.env.LOG_LEVEL = "warn";

// メトリクスポートをテスト用に変更
process.env.METRICS_PORT = "9999";

beforeAll(async () => {
  // テスト用データディレクトリの作成
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  
  console.log(`🧪 Test setup: DATA_DIR=${TEST_DATA_DIR}`);
});

afterAll(async () => {
  // CIでは残してもいいが、ローカルは掃除
  if (process.env.CI !== "true") {
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
      console.log(`🧹 Test cleanup: Removed ${TEST_DATA_DIR}`);
    } catch (error) {
      // 削除失敗は無視（Windowsでファイルロックされることがある）
      console.warn(`⚠️ Test cleanup warning: ${error}`);
    }
  }
});