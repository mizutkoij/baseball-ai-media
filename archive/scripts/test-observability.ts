#!/usr/bin/env npx tsx

/**
 * Phase 3 Observability テスト
 * ログ・メトリクス・計測の統合テスト
 */

import { AutomatedScraper } from './automated-scraper';
import { httpClient } from '../lib/http-client';
import { registry } from '../lib/prometheus-metrics';
import { logger, withCtx, logJobEvent, generateRunId } from '../lib/logger';

async function testStructuredLogging() {
  console.log('📝 Testing structured logging...');
  
  const runId = generateRunId();
  const log = withCtx({ runId, job: 'test', date: '2025-08-11' });
  
  // 各種ログレベルのテスト
  log.debug({ stage: 'init' }, 'Test debug log');
  log.info({ stage: 'processing', items: 5 }, 'Test info log');
  log.warn({ stage: 'validation', issues: 2 }, 'Test warning log');
  
  // 標準化ログイベント
  logJobEvent(
    { runId, job: 'test', date: '2025-08-11' },
    'start',
    {}
  );
  
  logJobEvent(
    { runId, job: 'test', date: '2025-08-11' },
    'success',
    { duration_ms: 1500, items: 10 }
  );
  
  return { runId, success: true };
}

async function testHttpMetrics() {
  console.log('🌐 Testing HTTP client with metrics...');
  
  try {
    // HTTPリクエストでメトリクス生成をテスト
    const response = await httpClient.request({
      url: 'https://httpbin.org/status/200',
      timeout: 5000,
    });
    
    // 2回目のリクエスト（キャッシュテスト）
    await httpClient.request({
      url: 'https://httpbin.org/status/200',
      timeout: 5000,
    });
    
    return {
      success: true,
      status: response.status,
      fromCache: response.fromCache,
    };
  } catch (error) {
    console.log('   HTTP request failed (expected in some environments)');
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testScraperMetrics() {
  console.log('⚾ Testing scraper with metrics...');
  
  const scraper = new AutomatedScraper({
    scheduleEnabled: false,
    startersEnabled: false, 
    detailedEnabled: false,
    dataDir: './data/test',
  });
  
  const result = await scraper.run();
  
  return {
    success: result.success,
    duration: result.duration,
    runId: result.timestamp, // 代用
  };
}

async function testMetricsCollection() {
  console.log('📊 Testing metrics collection...');
  
  // Prometheusメトリクス取得
  const metrics = await registry.metrics();
  const metricsLines = metrics.split('\n').filter(line => 
    line.includes('http_requests_total') || 
    line.includes('scrape_jobs_total') ||
    line.includes('scrape_duration_seconds')
  );
  
  return {
    totalLines: metrics.split('\n').length,
    relevantMetrics: metricsLines.length,
    hasHttpMetrics: metricsLines.some(line => line.includes('http_requests_total')),
    hasScrapeMetrics: metricsLines.some(line => line.includes('scrape_jobs_total')),
  };
}

async function main() {
  console.log('🚀 Phase 3 Observability Testing');
  console.log('==================================');
  
  const results = {
    logging: await testStructuredLogging(),
    httpMetrics: await testHttpMetrics(),
    scraperMetrics: await testScraperMetrics(),
    metricsCollection: await testMetricsCollection(),
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`Structured Logging: ${results.logging.success ? '✅' : '❌'} (runId: ${results.logging.runId})`);
  console.log(`HTTP Metrics: ${results.httpMetrics.success ? '✅' : '⚠️'} (${results.httpMetrics.success ? 'network dependent' : 'expected'})`);
  console.log(`Scraper Metrics: ${results.scraperMetrics.success ? '✅' : '❌'} (${results.scraperMetrics.duration}ms)`);
  console.log(`Metrics Collection: ${results.metricsCollection.hasHttpMetrics && results.metricsCollection.hasScrapeMetrics ? '✅' : '❌'} (${results.metricsCollection.totalLines} lines)`);
  
  const allPassed = results.logging.success && 
                   results.scraperMetrics.success &&
                   results.metricsCollection.hasHttpMetrics &&
                   results.metricsCollection.hasScrapeMetrics;
  
  console.log(`\n🎯 Overall Phase 3 Status: ${allPassed ? '✅ PASSED' : '⚠️ PARTIAL'}`);
  console.log('\n💡 To see metrics in action:');
  console.log('   1. Start metrics server: npm run metrics');
  console.log('   2. Run scraper: npm run scrape:test');
  console.log('   3. Check metrics: curl localhost:9464/metrics');
  
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

export { main as testObservability };