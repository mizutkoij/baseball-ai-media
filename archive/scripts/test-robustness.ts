#!/usr/bin/env npx tsx

/**
 * Phase 2 Robustness テスト
 * HTTP層・レート制御・サーキットブレーカー・キャッシュのテスト
 */

import { HttpClient } from '../lib/http-client';
import { npbCircuitBreaker } from '../lib/circuit-breaker';
import { httpCache } from '../lib/http-cache';
import { htmlSnapshots } from '../lib/html-snapshots';

async function testCircuitBreaker() {
  console.log('🔧 Testing Circuit Breaker...');
  
  // 意図的に失敗を起こす関数
  const failingFunction = async () => {
    throw new Error('Test failure');
  };
  
  let failures = 0;
  let circuitOpened = false;
  
  // 失敗を重ねてサーキットブレーカーを開く
  for (let i = 0; i < 5; i++) {
    try {
      await npbCircuitBreaker.exec(failingFunction);
    } catch (error) {
      failures++;
      if (error instanceof Error && error.message.includes('CB_OPEN')) {
        circuitOpened = true;
        break;
      }
    }
  }
  
  const state = npbCircuitBreaker.getState();
  console.log(`   Failures: ${failures}, Circuit state: ${state.state}, Opened: ${circuitOpened}`);
  
  // リセット
  npbCircuitBreaker.reset();
  console.log(`   Reset complete. New state: ${npbCircuitBreaker.getState().state}`);
  
  return { failures, circuitOpened, finalState: state.state };
}

async function testHttpCache() {
  console.log('💾 Testing HTTP Cache...');
  
  await httpCache.init();
  
  const testUrl = 'https://example.com/test';
  const testHeaders = {
    etag: '"test-etag"',
    lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT',
  };
  
  // キャッシュ書き込み
  await httpCache.writeHeaders(testUrl, testHeaders, '<html>test</html>', 'text/html');
  
  // キャッシュ読み込み
  const cachedHeaders = await httpCache.readHeaders(testUrl);
  const cachedContent = await httpCache.get(testUrl);
  
  const cacheStats = httpCache.getStats();
  
  console.log(`   Headers cached: ${!!cachedHeaders.etag}`);
  console.log(`   Content cached: ${!!cachedContent?.content}`);
  console.log(`   Cache stats: ${cacheStats.memoryEntries} entries`);
  
  return {
    headersCached: !!cachedHeaders.etag,
    contentCached: !!cachedContent?.content,
    stats: cacheStats,
  };
}

async function testHtmlSnapshots() {
  console.log('📸 Testing HTML Snapshots...');
  
  const testError = new Error('Test parsing error');
  const testHtml = '<html><body>Test HTML for snapshot</body></html>';
  const testUrl = 'https://npb.jp/test-page';
  
  // スナップショット保存
  const filepath = await htmlSnapshots.saveSnapshot(testUrl, testHtml, {
    error: testError,
    scraper: 'test-scraper',
  });
  
  const stats = await htmlSnapshots.getStats();
  
  console.log(`   Snapshot saved: ${filepath}`);
  console.log(`   Total files: ${stats.totalFiles}`);
  console.log(`   Disk usage: ${(stats.diskUsageBytes / 1024).toFixed(1)} KB`);
  
  return {
    savedPath: filepath,
    stats,
  };
}

async function testHttpClientWithRobustness() {
  console.log('🌐 Testing HTTP Client with robustness features...');
  
  const client = new HttpClient({
    requestsPerSecond: 10, // テスト用に高く設定
    burstSize: 5,
    enableCache: true,
    logger: (entry) => {
      if (entry.level !== 'debug') {
        console.log(`     [${entry.level}] ${entry.component}: ${entry.message}`);
      }
    },
  });
  
  try {
    // 存在するサイトで簡単にテスト（実際にはNPBサイトは使わない）
    const response = await client.request({
      url: 'https://httpbin.org/status/200',
      timeout: 5000,
    });
    
    console.log(`   Response status: ${response.status}`);
    console.log(`   Content length: ${response.content.length}`);
    console.log(`   From cache: ${response.fromCache}`);
    
    return {
      success: true,
      status: response.status,
      contentLength: response.content.length,
      fromCache: response.fromCache,
    };
  } catch (error) {
    console.log(`   Request failed (expected in some environments): ${error instanceof Error ? error.message : error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('🚀 Phase 2 Robustness Testing');
  console.log('================================');
  
  const results = {
    circuitBreaker: await testCircuitBreaker(),
    httpCache: await testHttpCache(),
    htmlSnapshots: await testHtmlSnapshots(),
    httpClient: await testHttpClientWithRobustness(),
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`Circuit Breaker: ${results.circuitBreaker.circuitOpened ? '✅' : '❌'} (opened after ${results.circuitBreaker.failures} failures)`);
  console.log(`HTTP Cache: ${results.httpCache.headersCached && results.httpCache.contentCached ? '✅' : '❌'} (${results.httpCache.stats.memoryEntries} entries)`);
  console.log(`HTML Snapshots: ${results.htmlSnapshots.stats.totalFiles > 0 ? '✅' : '❌'} (${results.htmlSnapshots.stats.totalFiles} files)`);
  console.log(`HTTP Client: ${results.httpClient.success ? '✅' : '⚠️'} (${results.httpClient.success ? 'success' : 'network dependent'})`);
  
  const allPassed = results.circuitBreaker.circuitOpened && 
                   results.httpCache.headersCached && 
                   results.httpCache.contentCached &&
                   results.htmlSnapshots.stats.totalFiles > 0;
  
  console.log(`\n🎯 Overall Phase 2 Status: ${allPassed ? '✅ PASSED' : '⚠️ PARTIAL'}`);
  
  return allPassed ? 0 : 1;
}

if (require.main === module) {
  main()
    .then(code => process.exit(code))
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { main as testRobustness };