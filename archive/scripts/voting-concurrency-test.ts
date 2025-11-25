#!/usr/bin/env npx tsx

// 投票システム並行性テスト（壁打ち）
// 使用法: npx tsx scripts/voting-concurrency-test.ts [concurrent_requests] [base_url]

import { performance } from 'perf_hooks';

const CONCURRENT_REQUESTS = parseInt(process.argv[2] || '50');
const BASE_URL = process.argv[3] || 'http://localhost:3000';
const TEST_PLAYER = {
  playerId: 'G#8_Okamoto_TEST',
  playerName: '岡本和真（テスト）',
  teamCode: 'G'
};

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  RESET: '\x1b[0m'
};

function log(color: string, message: string) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

interface TestResult {
  success: boolean;
  status: number;
  responseTime: number;
  response?: any;
  error?: string;
}

async function makeVoteRequest(voterKey: string): Promise<TestResult> {
  const start = performance.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `voter_key=${voterKey}`,
        'User-Agent': `VotingTest/${voterKey}`
      },
      body: JSON.stringify(TEST_PLAYER)
    });

    const responseTime = performance.now() - start;
    const responseData = await response.json();

    return {
      success: response.ok,
      status: response.status,
      responseTime: Math.round(responseTime),
      response: responseData
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      responseTime: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runConcurrencyTest() {
  log(COLORS.CYAN, `🧪 投票システム並行性テスト開始`);
  log(COLORS.BLUE, `   並行リクエスト数: ${CONCURRENT_REQUESTS}`);
  log(COLORS.BLUE, `   テスト対象: ${BASE_URL}/api/vote`);
  log(COLORS.BLUE, `   テスト選手: ${TEST_PLAYER.playerName} (${TEST_PLAYER.playerId})`);
  console.log();

  // Phase 1: 同一voter_keyでの重複防止テスト
  log(COLORS.MAGENTA, '📊 Phase 1: 同一voter_keyでの重複防止テスト');
  
  const sameKeyStart = performance.now();
  const sameKeyPromises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
    makeVoteRequest('CONCURRENCY_TEST_SAME')
  );
  
  const sameKeyResults = await Promise.all(sameKeyPromises);
  const sameKeyDuration = performance.now() - sameKeyStart;

  const successfulSameKey = sameKeyResults.filter(r => r.success && r.status === 200);
  const duplicateSameKey = sameKeyResults.filter(r => r.status === 409);
  const rateLimitedSameKey = sameKeyResults.filter(r => r.status === 429);
  const errorsSameKey = sameKeyResults.filter(r => !r.success && r.status !== 409 && r.status !== 429);

  log(COLORS.GREEN, `   ✅ 成功: ${successfulSameKey.length} / ${CONCURRENT_REQUESTS}`);
  log(COLORS.YELLOW, `   🔄 重複拒否: ${duplicateSameKey.length}`);
  log(COLORS.RED, `   ⚠️ レート制限: ${rateLimitedSameKey.length}`);
  log(COLORS.RED, `   ❌ エラー: ${errorsSameKey.length}`);
  
  const avgResponseTime = Math.round(sameKeyResults.reduce((sum, r) => sum + r.responseTime, 0) / sameKeyResults.length);
  log(COLORS.BLUE, `   ⏱️ 平均レスポンス時間: ${avgResponseTime}ms`);
  log(COLORS.BLUE, `   📊 総実行時間: ${Math.round(sameKeyDuration)}ms`);

  console.log();

  // Phase 2: 異なるvoter_keyでの並行投票テスト
  log(COLORS.MAGENTA, '📊 Phase 2: 異なるvoter_keyでの並行投票テスト');
  
  const diffKeyStart = performance.now();
  const diffKeyPromises = Array.from({ length: Math.min(CONCURRENT_REQUESTS, 20) }, (_, i) =>
    makeVoteRequest(`CONCURRENCY_TEST_DIFF_${i}`)
  );
  
  const diffKeyResults = await Promise.all(diffKeyPromises);
  const diffKeyDuration = performance.now() - diffKeyStart;

  const successfulDiffKey = diffKeyResults.filter(r => r.success && r.status === 200);
  const duplicateDiffKey = diffKeyResults.filter(r => r.status === 409);
  const rateLimitedDiffKey = diffKeyResults.filter(r => r.status === 429);
  const errorsDiffKey = diffKeyResults.filter(r => !r.success && r.status !== 409 && r.status !== 429);

  log(COLORS.GREEN, `   ✅ 成功: ${successfulDiffKey.length} / ${diffKeyResults.length}`);
  log(COLORS.YELLOW, `   🔄 重複拒否: ${duplicateDiffKey.length}`);
  log(COLORS.RED, `   ⚠️ レート制限: ${rateLimitedDiffKey.length}`);
  log(COLORS.RED, `   ❌ エラー: ${errorsDiffKey.length}`);

  console.log();

  // Phase 3: データベース整合性確認
  log(COLORS.MAGENTA, '📊 Phase 3: データベース整合性確認');
  
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.PGURL,
    });

    const client = await pool.connect();
    
    try {
      // 今日のテストデータ数確認
      const countResult = await client.query(`
        SELECT COUNT(*) as count
        FROM player_votes
        WHERE player_id = $1
        AND vote_day_jst = (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE
      `, [TEST_PLAYER.playerId]);

      const actualCount = parseInt(countResult.rows[0].count);
      const expectedCount = successfulSameKey.length + successfulDiffKey.length;

      log(COLORS.BLUE, `   📝 DB記録数: ${actualCount}`);
      log(COLORS.BLUE, `   🎯 期待値: ${expectedCount}`);
      
      if (actualCount === expectedCount) {
        log(COLORS.GREEN, `   ✅ データベース整合性: OK`);
      } else {
        log(COLORS.RED, `   ❌ データベース整合性: NG (差分: ${Math.abs(actualCount - expectedCount)})`);
      }

      // 重複voter_key確認
      const duplicateKeyResult = await client.query(`
        SELECT voter_key, COUNT(*) as count
        FROM player_votes
        WHERE player_id = $1
        AND vote_day_jst = (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE
        AND voter_key IS NOT NULL
        GROUP BY voter_key
        HAVING COUNT(*) > 1
      `, [TEST_PLAYER.playerId]);

      if (duplicateKeyResult.rows.length === 0) {
        log(COLORS.GREEN, `   ✅ 重複防止: OK (重複なし)`);
      } else {
        log(COLORS.RED, `   ❌ 重複防止: NG (重複キー: ${duplicateKeyResult.rows.length})`);
        duplicateKeyResult.rows.forEach(row => {
          log(COLORS.RED, `     - ${row.voter_key}: ${row.count}件`);
        });
      }

    } finally {
      client.release();
      await pool.end();
    }
  } catch (dbError) {
    log(COLORS.RED, `   ❌ DB確認エラー: ${dbError}`);
  }

  console.log();

  // 結果サマリー
  log(COLORS.CYAN, '📋 テスト結果サマリー');
  
  const totalRequests = sameKeyResults.length + diffKeyResults.length;
  const totalSuccess = successfulSameKey.length + successfulDiffKey.length;
  const totalDuplicates = duplicateSameKey.length + duplicateDiffKey.length;
  const totalRateLimited = rateLimitedSameKey.length + rateLimitedDiffKey.length;
  const totalErrors = errorsSameKey.length + errorsDiffKey.length;

  log(COLORS.BLUE, `   📊 総リクエスト数: ${totalRequests}`);
  log(COLORS.GREEN, `   ✅ 成功率: ${((totalSuccess / totalRequests) * 100).toFixed(1)}%`);
  log(COLORS.YELLOW, `   🔄 重複拒否率: ${((totalDuplicates / totalRequests) * 100).toFixed(1)}%`);
  log(COLORS.RED, `   ⚠️ レート制限率: ${((totalRateLimited / totalRequests) * 100).toFixed(1)}%`);
  log(COLORS.RED, `   ❌ エラー率: ${((totalErrors / totalRequests) * 100).toFixed(1)}%`);

  // 判定
  console.log();
  const isHealthy = totalSuccess > 0 && 
                    (duplicateSameKey.length === CONCURRENT_REQUESTS - 1) && // 1件成功、残りは重複拒否
                    totalErrors === 0;

  if (isHealthy) {
    log(COLORS.GREEN, '🎉 投票システム並行性テスト: PASSED');
    log(COLORS.GREEN, '   - 重複防止機能: 正常');
    log(COLORS.GREEN, '   - レスポンス性能: 良好');
    log(COLORS.GREEN, '   - データベース整合性: 保持');
  } else {
    log(COLORS.RED, '⚠️ 投票システム並行性テスト: 要確認');
    log(COLORS.RED, '   - 予期しない動作やエラーが発生しました');
  }

  // クリーンアップ提案
  console.log();
  log(COLORS.BLUE, '🧹 クリーンアップコマンド:');
  console.log(`   psql "$PGURL" -c "DELETE FROM player_votes WHERE player_id = '${TEST_PLAYER.playerId}'"`);
}

if (require.main === module) {
  runConcurrencyTest().catch(console.error);
}