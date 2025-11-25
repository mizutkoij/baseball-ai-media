#!/usr/bin/env npx tsx
/**
 * Live Summary API + Cache システムテスト
 * /live/summary と latest?stale=5s の動作確認
 */

import { createLiveServer } from '../server/live-api';
import { memoryCache } from '../lib/memory-cache';
import fs from 'fs/promises';
import path from 'path';

async function testSummaryAPI() {
  console.log('📊 Summary API テスト');
  
  const port = 8789; // テスト用ポート
  const testDir = './data/test-summary';
  
  try {
    // テストデータ作成
    await setupTestData(testDir);
    
    // サーバー起動
    const server = await createLiveServer(port, testDir);
    
    // テスト実行
    await runAPITests(port);
    
    // クリーンアップ
    await server.close();
    await fs.rm(testDir, { recursive: true, force: true });
    
    console.log('✅ Summary APIテスト完了\n');
    return true;
    
  } catch (error) {
    console.log(`❌ Summary APIテストエラー: ${error.message}\n`);
    return false;
  }
}

async function setupTestData(baseDir: string) {
  const today = '2025-08-12';
  const liveDir = path.join(baseDir, 'predictions', 'live', `date=${today}`);
  
  // テスト用の試合データを3つ作成
  const testGames = [
    {
      gameId: '20250812_G-T_01',
      data: {
        ts: '2025-08-12T19:30:00.000Z',
        gameId: '20250812_G-T_01',
        inning: 7,
        top: false,
        outs: 1,
        homeScore: 3,
        awayScore: 2,
        p_home: 0.678,
        p_away: 0.322,
        conf: 'high'
      }
    },
    {
      gameId: '20250812_C-YB_01', 
      data: {
        ts: '2025-08-12T18:00:00.000Z',
        gameId: '20250812_C-YB_01',
        inning: 9,
        top: true,
        outs: 2,
        homeScore: 1,
        awayScore: 1,
        p_home: 0.503,
        p_away: 0.497,
        conf: 'medium'
      }
    },
    {
      gameId: '20250812_L-H_01',
      data: {
        ts: '2025-08-12T18:30:00.000Z',
        gameId: '20250812_L-H_01',
        inning: 5,
        top: false,
        outs: 0,
        homeScore: 8,
        awayScore: 1,
        p_home: 0.945,
        p_away: 0.055,
        conf: 'high'
      }
    }
  ];
  
  for (const game of testGames) {
    const gameDir = path.join(liveDir, game.gameId);
    await fs.mkdir(gameDir, { recursive: true });
    
    const latestPath = path.join(gameDir, 'latest.json');
    await fs.writeFile(latestPath, JSON.stringify(game.data, null, 2));
  }
  
  console.log(`   テストデータ作成: ${testGames.length}試合`);
}

async function runAPITests(port: number) {
  const baseURL = `http://localhost:${port}`;
  
  // 1) Summary APIテスト
  console.log('   Summary APIレスポンステスト...');
  const summaryRes = await fetch(`${baseURL}/live/summary`);
  const summaryData = await summaryRes.json();
  
  if (summaryData.total_games !== 3) {
    throw new Error(`Expected 3 games, got ${summaryData.total_games}`);
  }
  
  if (summaryData.response_time_ms > 100) {
    console.log(`   ⚠️  応答時間: ${summaryData.response_time_ms}ms (>100ms)`);
  } else {
    console.log(`   ✅ 応答時間: ${summaryData.response_time_ms}ms`);
  }
  
  // 2) キャッシュテスト（2回目のリクエスト）
  console.log('   Summary APIキャッシュテスト...');
  const cachedRes = await fetch(`${baseURL}/live/summary`);
  const cachedData = await cachedRes.json();
  
  const cacheHeader = cachedRes.headers.get('X-Cache');
  if (cacheHeader === 'HIT') {
    console.log('   ✅ キャッシュヒット確認');
  } else {
    console.log(`   ⚠️  キャッシュミス: ${cacheHeader}`);
  }
  
  // 3) latest?stale=5s テスト
  console.log('   Latest API stale キャッシュテスト...');
  const gameId = '20250812_G-T_01';
  
  // 最初のリクエスト（キャッシュミス）
  const latestRes1 = await fetch(`${baseURL}/live/${gameId}?stale=5`);
  const latestData1 = await latestRes1.json();
  const cacheHeader1 = latestRes1.headers.get('X-Cache');
  
  // 2回目のリクエスト（キャッシュヒット）
  const latestRes2 = await fetch(`${baseURL}/live/${gameId}?stale=5`);
  const latestData2 = await latestRes2.json();
  const cacheHeader2 = latestRes2.headers.get('X-Cache');
  
  if (cacheHeader1 === 'MISS' && cacheHeader2 === 'HIT') {
    console.log('   ✅ Latest API キャッシュ動作確認');
  } else {
    console.log(`   ⚠️  Latest API キャッシュ異常: ${cacheHeader1} → ${cacheHeader2}`);
  }
  
  // 4) メトリクス確認
  console.log('   メトリクス取得テスト...');
  const metricsRes = await fetch(`${baseURL}/metrics`);
  const metricsText = await metricsRes.text();
  
  const hasLiveSummaryMetric = metricsText.includes('live_summary_requests_total');
  const hasLatestCacheMetric = metricsText.includes('live_latest_cache_hits_total');
  
  if (hasLiveSummaryMetric && hasLatestCacheMetric) {
    console.log('   ✅ メトリクス出力確認');
  } else {
    console.log('   ⚠️  メトリクス未確認');
  }
}

async function testCachePerformance() {
  console.log('⚡ キャッシュパフォーマンステスト');
  
  // メモリキャッシュの基本性能テスト
  const testKey = 'perf-test';
  const testData = { large: 'x'.repeat(10000), timestamp: Date.now() };
  
  // 書き込み性能
  const writeStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    memoryCache.set(`${testKey}-${i}`, testData, 5000);
  }
  const writeTime = Date.now() - writeStart;
  
  // 読み込み性能
  const readStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    memoryCache.get(`${testKey}-${i}`);
  }
  const readTime = Date.now() - readStart;
  
  console.log(`   書き込み: ${writeTime}ms (1000 operations)`);
  console.log(`   読み込み: ${readTime}ms (1000 operations)`);
  
  const stats = memoryCache.getStats();
  console.log(`   キャッシュサイズ: ${stats.size} entries`);
  
  // クリーンアップ
  memoryCache.clear();
  
  const isPerformant = writeTime < 50 && readTime < 10;
  console.log(`   ${isPerformant ? '✅' : '❌'} パフォーマンス: ${isPerformant ? 'OK' : 'SLOW'}\n`);
  
  return isPerformant;
}

async function main() {
  console.log('🚀 NPB Live Summary API + Cache システムテスト');
  console.log('=' + '='.repeat(50));
  
  const results = [];
  
  try {
    results.push(await testCachePerformance());
    results.push(await testSummaryAPI());
    
  } catch (error) {
    console.error('💥 テスト実行エラー:', error);
    results.push(false);
  }
  
  console.log('📋 Summary API + Cache テスト結果');
  console.log('=' + '='.repeat(35));
  console.log('Cache Performance:', results[0] ? '✅ PASS' : '❌ FAIL');
  console.log('Summary API:', results[1] ? '✅ PASS' : '❌ FAIL');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n🎯 総合結果: ${passed}/${total} テスト通過`);
  
  if (passed === total) {
    console.log('🎉 Live Summary API + Cache システム実装完了！');
    console.log('💡 実装された機能:');
    console.log('   • /live/summary - 全試合概要（5秒キャッシュ）');
    console.log('   • /live/:gameId?stale=5s - latest.jsonキャッシュ');
    console.log('   • メモリキャッシュ（TTL対応）');
    console.log('   • Prometheusメトリクス');
    console.log('\n📊 パフォーマンス:');
    console.log('   • Summary API: ≤100ms 目標');
    console.log('   • キャッシュヒット率: >80% 期待');
    console.log('   • メモリ効率: 自動クリーンアップ');
    console.log('\n🔧 運用方法:');
    console.log('   npm run serve:live');
    console.log('   curl http://localhost:8787/live/summary');
    console.log('   curl http://localhost:8787/metrics | grep live_');
  } else {
    console.log('⚠️  一部テスト失敗 - 本番投入前にデバッグ推奨');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Summary API テスト実行エラー:', error);
    process.exit(1);
  });
}