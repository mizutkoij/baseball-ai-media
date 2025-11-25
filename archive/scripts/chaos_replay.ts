#!/usr/bin/env npx tsx
/**
 * カオステスト - 2倍速リプレイ + 障害注入システム
 * オフピーク時間にライブ予測の安定性をテスト
 */

import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import { logger } from "../lib/logger";
import { predictAndPersistLive, type GameState } from "../lib/live-predictor";

const log = logger.child({ job: "chaos-test" });

interface ChaosConfig {
  speed: number; // リプレイ速度倍率
  faults: {
    network_drop?: number; // ネットワーク障害率 (0-1)
    latency_spike?: number; // レイテンシスパイク（ms）
    memory_pressure?: boolean; // メモリ圧迫シミュレーション
  };
  jitter: number; // タイミングジッター（ms）
  monitoring: {
    alert_on_error_rate?: number; // エラー率閾値
    alert_on_latency?: number; // レイテンシ閾値（ms）
  };
}

interface ChaosMetrics {
  total_events: number;
  successful_predictions: number;
  failed_predictions: number;
  network_faults_injected: number;
  latency_spikes_injected: number;
  avg_latency_ms: number;
  max_latency_ms: number;
  error_rate: number;
}

let metrics: ChaosMetrics = {
  total_events: 0,
  successful_predictions: 0,
  failed_predictions: 0,
  network_faults_injected: 0,
  latency_spikes_injected: 0,
  avg_latency_ms: 0,
  max_latency_ms: 0,
  error_rate: 0
};

/**
 * タイムライン読み込み
 */
async function loadTimeline(baseDir: string, date: string, gameId: string): Promise<any[]> {
  const timelinePath = path.join(baseDir, "predictions", "live", `date=${date}`, gameId, "timeline.jsonl");
  
  try {
    const content = await fs.readFile(timelinePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    log.error({ timelinePath, error: error.message }, "Failed to load timeline");
    return [];
  }
}

/**
 * ネットワーク障害シミュレーション
 */
function shouldInjectNetworkFault(config: ChaosConfig): boolean {
  return Math.random() < (config.faults.network_drop || 0);
}

/**
 * レイテンシスパイク注入
 */
async function injectLatencySpike(config: ChaosConfig): Promise<void> {
  if (config.faults.latency_spike && Math.random() < 0.1) { // 10%の確率
    const spikeMs = config.faults.latency_spike;
    await new Promise(resolve => setTimeout(resolve, spikeMs));
    metrics.latency_spikes_injected++;
    log.debug({ spike_ms: spikeMs }, "Latency spike injected");
  }
}

/**
 * ジッター付きスリープ
 */
async function jitteredSleep(baseMs: number, jitterMs: number): Promise<void> {
  const jitter = (Math.random() - 0.5) * 2 * jitterMs; // -jitterMs ~ +jitterMs
  const actualMs = Math.max(0, baseMs + jitter);
  await new Promise(resolve => setTimeout(resolve, actualMs));
}

/**
 * モックWE Lookup（簡易実装）
 */
function createMockWELookup() {
  return (state: GameState) => {
    // 簡易的な勝率計算
    const baseProb = 0.5;
    const scoreDiff = state.homeScore - state.awayScore;
    const inningFactor = state.inning / 9;
    
    let p_home = baseProb + (scoreDiff * 0.1) + (inningFactor * 0.05);
    p_home = Math.max(0.1, Math.min(0.9, p_home));
    
    const conf = Math.abs(p_home - 0.5) > 0.2 ? "high" : 
                 Math.abs(p_home - 0.5) > 0.1 ? "medium" : "low";
    
    return { p_home, conf };
  };
}

/**
 * カオステスト実行
 */
async function runChaosTest(
  baseDir: string,
  date: string, 
  gameId: string,
  config: ChaosConfig
): Promise<ChaosMetrics> {
  log.info({ date, gameId, config }, "Starting chaos test");
  
  // タイムライン読み込み
  const timeline = await loadTimeline(baseDir, date, gameId);
  
  if (timeline.length === 0) {
    throw new Error(`No timeline data found for ${gameId}`);
  }
  
  log.info({ events: timeline.length, speed: config.speed }, "Timeline loaded");
  
  // メトリクス初期化
  metrics = {
    total_events: 0,
    successful_predictions: 0,
    failed_predictions: 0,
    network_faults_injected: 0,
    latency_spikes_injected: 0,
    avg_latency_ms: 0,
    max_latency_ms: 0,
    error_rate: 0
  };
  
  const weLookup = createMockWELookup();
  let latencySum = 0;
  
  // タイムラインリプレイ
  for (let i = 0; i < timeline.length; i++) {
    const event = timeline[i];
    const nextEvent = timeline[i + 1];
    
    metrics.total_events++;
    
    // ネットワーク障害注入
    if (shouldInjectNetworkFault(config)) {
      metrics.network_faults_injected++;
      metrics.failed_predictions++;
      log.debug({ event_index: i }, "Network fault injected - skipping prediction");
      continue;
    }
    
    // レイテンシスパイク注入
    await injectLatencySpike(config);
    
    // 予測実行
    const startTime = Date.now();
    
    try {
      const gameState: GameState = {
        gameId: event.gameId,
        inning: event.inning,
        top: event.top,
        outs: event.outs,
        bases: event.bases,
        homeScore: event.homeScore,
        awayScore: event.awayScore,
        ts: event.ts
      };
      
      await predictAndPersistLive({
        date,
        baseDir: path.join(baseDir, "chaos-test"),
        state: gameState,
        weLookup,
        pregameProb: 0.5
      });
      
      metrics.successful_predictions++;
      
    } catch (error) {
      metrics.failed_predictions++;
      log.warn({ 
        event_index: i, 
        error: error.message 
      }, "Prediction failed during chaos test");
    }
    
    // レイテンシ記録
    const latency = Date.now() - startTime;
    latencySum += latency;
    metrics.max_latency_ms = Math.max(metrics.max_latency_ms, latency);
    
    // 次のイベントまでの間隔（速度調整 + ジッター）
    if (nextEvent) {
      const originalInterval = new Date(nextEvent.ts).getTime() - new Date(event.ts).getTime();
      const adjustedInterval = originalInterval / config.speed;
      
      if (adjustedInterval > 0) {
        await jitteredSleep(adjustedInterval, config.jitter);
      }
    }
    
    // 進捗表示（10%刻み）
    if (i % Math.ceil(timeline.length / 10) === 0) {
      const progress = (i / timeline.length * 100).toFixed(1);
      log.info({ 
        progress: `${progress}%`, 
        successful: metrics.successful_predictions,
        failed: metrics.failed_predictions 
      }, "Chaos test progress");
    }
  }
  
  // メトリクス計算
  metrics.avg_latency_ms = latencySum / Math.max(1, metrics.successful_predictions);
  metrics.error_rate = metrics.failed_predictions / metrics.total_events;
  
  return metrics;
}

/**
 * カオステスト結果の評価
 */
function evaluateResults(metrics: ChaosMetrics, config: ChaosConfig): {
  passed: boolean;
  alerts: string[];
} {
  const alerts: string[] = [];
  let passed = true;
  
  // エラー率チェック
  if (config.monitoring.alert_on_error_rate && 
      metrics.error_rate > config.monitoring.alert_on_error_rate) {
    alerts.push(`Error rate ${(metrics.error_rate * 100).toFixed(1)}% exceeds threshold ${(config.monitoring.alert_on_error_rate * 100).toFixed(1)}%`);
    passed = false;
  }
  
  // レイテンシチェック
  if (config.monitoring.alert_on_latency && 
      metrics.avg_latency_ms > config.monitoring.alert_on_latency) {
    alerts.push(`Average latency ${metrics.avg_latency_ms.toFixed(1)}ms exceeds threshold ${config.monitoring.alert_on_latency}ms`);
    passed = false;
  }
  
  return { passed, alerts };
}

async function main() {
  const args = process.argv.slice(2);
  
  let date = "";
  let gameId = "";
  let speed = 2;
  let networkFaultRate = 0;
  let latencySpike = 0;
  let jitter = 200;
  
  // CLI引数パース
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case "--date":
        date = value;
        break;
      case "--gameId":
        gameId = value;
        break;
      case "--speed":
        speed = parseFloat(value);
        break;
      case "--fault":
        if (value.startsWith("net:")) {
          networkFaultRate = parseFloat(value.replace("net:", "").replace("%", "")) / 100;
        }
        break;
      case "--latency-spike":
        latencySpike = parseInt(value);
        break;
      case "--jitter":
        jitter = parseInt(value);
        break;
    }
  }
  
  if (!date || !gameId) {
    console.error("Usage: npx tsx scripts/chaos_replay.ts --date YYYY-MM-DD --gameId GAME_ID [options]");
    console.error("Options:");
    console.error("  --speed N           Replay speed multiplier (default: 2)");
    console.error("  --fault net:X%      Network fault injection rate (default: 0%)");
    console.error("  --latency-spike MS  Latency spike injection (default: 0ms)");
    console.error("  --jitter MS         Timing jitter (default: 200ms)");
    process.exit(1);
  }
  
  const config: ChaosConfig = {
    speed,
    faults: {
      network_drop: networkFaultRate,
      latency_spike: latencySpike > 0 ? latencySpike : undefined
    },
    jitter,
    monitoring: {
      alert_on_error_rate: 0.1, // 10%
      alert_on_latency: 2000     // 2秒
    }
  };
  
  try {
    console.log("🌪️  Starting chaos test...");
    console.log(`📅 Date: ${date}, Game: ${gameId}`);
    console.log(`⚡ Speed: ${speed}x, Network faults: ${(networkFaultRate * 100).toFixed(1)}%`);
    console.log(`🎯 Jitter: ${jitter}ms, Latency spike: ${latencySpike}ms`);
    
    const startTime = Date.now();
    const result = await runChaosTest("data", date, gameId, config);
    const duration = Date.now() - startTime;
    
    console.log("\n📊 Chaos Test Results");
    console.log("=" + "=".repeat(40));
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`📈 Total events: ${result.total_events}`);
    console.log(`✅ Successful: ${result.successful_predictions}`);
    console.log(`❌ Failed: ${result.failed_predictions}`);
    console.log(`📊 Error rate: ${(result.error_rate * 100).toFixed(1)}%`);
    console.log(`🌊 Network faults: ${result.network_faults_injected}`);
    console.log(`⚡ Latency spikes: ${result.latency_spikes_injected}`);
    console.log(`📡 Avg latency: ${result.avg_latency_ms.toFixed(1)}ms`);
    console.log(`🔥 Max latency: ${result.max_latency_ms}ms`);
    
    const evaluation = evaluateResults(result, config);
    
    if (evaluation.passed) {
      console.log("\n🎉 Chaos test PASSED!");
      console.log("💪 System showed good resilience under stress");
    } else {
      console.log("\n⚠️  Chaos test FAILED!");
      for (const alert of evaluation.alerts) {
        console.log(`❗ ${alert}`);
      }
    }
    
    process.exit(evaluation.passed ? 0 : 1);
    
  } catch (error) {
    console.error("💥 Chaos test error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });
}