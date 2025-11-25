#!/usr/bin/env npx tsx
/**
 * SSE接続負荷テスト - autocannon equivalent for SSE streams
 * autocannon http://127.0.0.1:8787/live/<gameId>/stream -c 50 -d 60
 */

import { EventSource } from 'eventsource';
import { logger } from "../lib/logger";

const log = logger.child({ component: "sse-load-test" });

interface LoadTestConfig {
  baseUrl: string;
  gameId: string;
  connections: number;
  duration: number; // seconds
  rampUp: number; // seconds to reach full connections
}

interface ConnectionStats {
  id: number;
  connected: boolean;
  messageCount: number;
  errorCount: number;
  lastMessage: number;
  connectTime: number;
  totalBytes: number;
}

interface TestResults {
  totalConnections: number;
  successfulConnections: number;
  totalMessages: number;
  totalErrors: number;
  totalBytes: number;
  duration: number;
  messagesPerSecond: number;
  avgConnectionTime: number;
  concurrentPeak: number;
}

/**
 * SSE負荷テスト実行
 */
export async function runSSELoadTest(config: LoadTestConfig): Promise<TestResults> {
  const stats: ConnectionStats[] = [];
  const startTime = Date.now();
  let activeConnections = 0;
  let peakConnections = 0;
  
  log.info(config, "Starting SSE load test");
  
  return new Promise((resolve) => {
    const connectionInterval = config.rampUp * 1000 / config.connections;
    let connectionsCreated = 0;
    
    // 段階的接続作成
    const createConnectionTimer = setInterval(() => {
      if (connectionsCreated >= config.connections) {
        clearInterval(createConnectionTimer);
        return;
      }
      
      const connectionId = connectionsCreated++;
      const connectionStat: ConnectionStats = {
        id: connectionId,
        connected: false,
        messageCount: 0,
        errorCount: 0,
        lastMessage: 0,
        connectTime: 0,
        totalBytes: 0
      };
      
      stats.push(connectionStat);
      
      // SSE接続開始
      const url = `${config.baseUrl}/live/${config.gameId}/stream`;
      const eventSource = new EventSource(url);
      
      const connectionStart = Date.now();
      
      eventSource.onopen = () => {
        connectionStat.connected = true;
        connectionStat.connectTime = Date.now() - connectionStart;
        activeConnections++;
        peakConnections = Math.max(peakConnections, activeConnections);
        
        log.debug({ connectionId, connectTime: connectionStat.connectTime }, "SSE connection established");
      };
      
      eventSource.onmessage = (event) => {
        connectionStat.messageCount++;
        connectionStat.lastMessage = Date.now();
        connectionStat.totalBytes += event.data.length;
      };
      
      eventSource.onerror = (error) => {
        connectionStat.errorCount++;
        log.debug({ connectionId, error }, "SSE connection error");
      };
      
      // テスト期間終了後に接続クローズ
      setTimeout(() => {
        eventSource.close();
        activeConnections--;
      }, config.duration * 1000);
      
    }, connectionInterval);
    
    // テスト完了後の結果集計
    setTimeout(() => {
      const endTime = Date.now();
      const actualDuration = (endTime - startTime) / 1000;
      
      const totalConnections = stats.length;
      const successfulConnections = stats.filter(s => s.connected).length;
      const totalMessages = stats.reduce((sum, s) => sum + s.messageCount, 0);
      const totalErrors = stats.reduce((sum, s) => sum + s.errorCount, 0);
      const totalBytes = stats.reduce((sum, s) => sum + s.totalBytes, 0);
      const avgConnectionTime = stats
        .filter(s => s.connected)
        .reduce((sum, s) => sum + s.connectTime, 0) / successfulConnections;
      
      const results: TestResults = {
        totalConnections,
        successfulConnections,
        totalMessages,
        totalErrors,
        totalBytes,
        duration: actualDuration,
        messagesPerSecond: totalMessages / actualDuration,
        avgConnectionTime,
        concurrentPeak: peakConnections
      };
      
      log.info(results, "SSE load test completed");
      resolve(results);
      
    }, config.duration * 1000 + 2000); // 余裕をもって2秒後
  });
}

/**
 * デフォルトゲームIDを取得（本日の試合から）
 */
async function getDefaultGameId(): Promise<string> {
  try {
    const fetch = (await import('node-fetch')).default;
    const today = new Date().toISOString().slice(0, 10);
    const response = await fetch(`http://127.0.0.1:8787/live/summary?date=${today}`);
    
    if (response.ok) {
      const summary = await response.json();
      if (summary.games && summary.games.length > 0) {
        return summary.games[0].gameId;
      }
    }
  } catch (error) {
    log.warn({ error: error.message }, "Could not fetch default game ID");
  }
  
  // フォールバック: ダミーゲームID
  return `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_G-T_01`;
}

// CLI実行部分
async function main() {
  const args = process.argv.slice(2);
  
  const config: LoadTestConfig = {
    baseUrl: args[0] || "http://127.0.0.1:8787",
    gameId: args[1] || await getDefaultGameId(),
    connections: parseInt(args[2]) || 50,
    duration: parseInt(args[3]) || 60,
    rampUp: parseInt(args[4]) || 10
  };
  
  try {
    const results = await runSSELoadTest(config);
    
    console.log("\n📊 SSE Load Test Results:");
    console.log("=========================");
    console.log(`URL: ${config.baseUrl}/live/${config.gameId}/stream`);
    console.log(`Duration: ${results.duration.toFixed(1)}s`);
    console.log(`Connections: ${results.successfulConnections}/${results.totalConnections} (${(results.successfulConnections/results.totalConnections*100).toFixed(1)}%)`);
    console.log(`Messages: ${results.totalMessages} (${results.messagesPerSecond.toFixed(1)}/s)`);
    console.log(`Errors: ${results.totalErrors}`);
    console.log(`Data: ${(results.totalBytes/1024/1024).toFixed(2)} MB`);
    console.log(`Avg Connect Time: ${results.avgConnectionTime.toFixed(0)}ms`);
    console.log(`Peak Concurrent: ${results.concurrentPeak}`);
    
    // パフォーマンス評価
    const successRate = results.successfulConnections / results.totalConnections;
    const errorRate = results.totalErrors / Math.max(results.totalMessages, 1);
    
    console.log("\n🎯 Performance Assessment:");
    if (successRate >= 0.95 && errorRate <= 0.05) {
      console.log("✅ EXCELLENT - System handling load well");
    } else if (successRate >= 0.90 && errorRate <= 0.10) {
      console.log("🟡 GOOD - Minor issues under load");
    } else {
      console.log("❌ POOR - System struggling with load");
    }
    
  } catch (error) {
    console.error("❌ Load test failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}