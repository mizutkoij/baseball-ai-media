/**
 * メモリー・GC監視システム
 * 緑/黄/赤の3段階でメモリー状況を監視
 */

import { performance } from "perf_hooks";
import { memoryUsage, gcDuration, gcCount, eventLoopLag, memoryPressure } from "./prometheus-metrics";
import { logger } from "./logger";

const log = logger.child({ component: "memory-monitor" });

interface MemoryThresholds {
  heapUsed: { yellow: number; red: number }; // bytes
  rss: { yellow: number; red: number }; // bytes
  gcDuration: { yellow: number; red: number }; // seconds
  eventLoopLag: { yellow: number; red: number }; // seconds
}

// デフォルトしきい値（環境に応じて調整）
const defaultThresholds: MemoryThresholds = {
  heapUsed: { yellow: 1024 * 1024 * 1024, red: 1.5 * 1024 * 1024 * 1024 }, // 1GB / 1.5GB
  rss: { yellow: 2 * 1024 * 1024 * 1024, red: 3 * 1024 * 1024 * 1024 }, // 2GB / 3GB
  gcDuration: { yellow: 0.1, red: 0.5 }, // 100ms / 500ms
  eventLoopLag: { yellow: 0.01, red: 0.05 } // 10ms / 50ms
};

let eventLoopStart = performance.now();
let monitoringInterval: NodeJS.Timeout | null = null;

/**
 * メモリー使用量をPrometheusメトリクスに記録
 */
function recordMemoryMetrics(): void {
  const memInfo = process.memoryUsage();
  
  memoryUsage.set({ type: "rss" }, memInfo.rss);
  memoryUsage.set({ type: "heapUsed" }, memInfo.heapUsed);
  memoryUsage.set({ type: "heapTotal" }, memInfo.heapTotal);
  memoryUsage.set({ type: "external" }, memInfo.external);
}

/**
 * Event Loopラグ測定
 */
function measureEventLoopLag(): void {
  const now = performance.now();
  const lag = (now - eventLoopStart) / 1000; // seconds
  
  eventLoopLag.observe(lag);
  eventLoopStart = performance.now();
}

/**
 * メモリー圧迫状況評価
 */
function assessMemoryPressure(thresholds: MemoryThresholds = defaultThresholds): 0 | 1 | 2 {
  const memInfo = process.memoryUsage();
  
  // Heap使用量チェック
  if (memInfo.heapUsed >= thresholds.heapUsed.red) return 2;
  if (memInfo.heapUsed >= thresholds.heapUsed.yellow) return 1;
  
  // RSS使用量チェック
  if (memInfo.rss >= thresholds.rss.red) return 2;
  if (memInfo.rss >= thresholds.rss.yellow) return 1;
  
  return 0; // 緑（正常）
}

/**
 * GCイベント監視設定
 */
function setupGCMonitoring(): void {
  // Node.js v14+ のGC統計API使用
  if (typeof (performance as any).measureUserAgentSpecificMemory === 'function') {
    // Chrome/V8 specific GC monitoring
    setInterval(async () => {
      try {
        const gcInfo = await (performance as any).measureUserAgentSpecificMemory();
        
        if (gcInfo && gcInfo.breakdown) {
          // GC関連情報があれば記録
          log.debug({ gcInfo }, "GC information collected");
        }
      } catch (error) {
        // GC監視APIが利用できない場合は無視
      }
    }, 30000); // 30秒ごと
  }
  
  // プロセス統計ベースのGC推定
  let lastMemInfo = process.memoryUsage();
  
  setInterval(() => {
    const currentMemInfo = process.memoryUsage();
    
    // ヒープサイズが大幅減少した場合はGCと推定
    const heapDrop = lastMemInfo.heapUsed - currentMemInfo.heapUsed;
    const significantDrop = heapDrop > 50 * 1024 * 1024; // 50MB以上減少
    
    if (significantDrop) {
      // GCイベントと推定してカウント
      gcCount.inc({ type: "estimated" });
      
      log.debug({
        heapBefore: lastMemInfo.heapUsed,
        heapAfter: currentMemInfo.heapUsed,
        freed: heapDrop
      }, "Estimated GC event detected");
    }
    
    lastMemInfo = currentMemInfo;
  }, 5000); // 5秒ごと
}

/**
 * メモリー監視開始
 */
export function startMemoryMonitoring(intervalMs: number = 10000): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  log.info({ intervalMs }, "Starting memory monitoring");
  
  // GC監視設定
  setupGCMonitoring();
  
  // 定期メトリクス記録
  monitoringInterval = setInterval(() => {
    recordMemoryMetrics();
    measureEventLoopLag();
    
    const pressure = assessMemoryPressure();
    memoryPressure.set(pressure);
    
    // 圧迫状況をログ出力
    if (pressure >= 1) {
      const memInfo = process.memoryUsage();
      const level = pressure === 2 ? "RED" : "YELLOW";
      
      log.warn({
        level,
        heapUsed: Math.round(memInfo.heapUsed / 1024 / 1024),
        rss: Math.round(memInfo.rss / 1024 / 1024),
        heapTotal: Math.round(memInfo.heapTotal / 1024 / 1024)
      }, `Memory pressure detected: ${level}`);
    }
    
  }, intervalMs);
}

/**
 * メモリー監視停止
 */
export function stopMemoryMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    log.info("Memory monitoring stopped");
  }
}

/**
 * 現在のメモリー状況取得
 */
export function getMemoryStatus(): {
  usage: NodeJS.MemoryUsage;
  pressure: 0 | 1 | 2;
  pressureLabel: "GREEN" | "YELLOW" | "RED";
} {
  const usage = process.memoryUsage();
  const pressure = assessMemoryPressure();
  const pressureLabel = pressure === 2 ? "RED" : pressure === 1 ? "YELLOW" : "GREEN";
  
  return { usage, pressure, pressureLabel };
}

/**
 * メモリー使用量を人間可読形式で取得
 */
export function formatMemoryUsage(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)}MB`;
}

// プロセス終了時にクリーンアップ
process.on('exit', stopMemoryMonitoring);
process.on('SIGTERM', stopMemoryMonitoring);
process.on('SIGINT', stopMemoryMonitoring);