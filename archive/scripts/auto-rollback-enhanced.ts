#!/usr/bin/env npx tsx
/**
 * 強化版オートロールバック - モデル/設定世代管理統合
 * しきい値超過 → 前バージョンへ即座ロールバック
 */

import { register } from "prom-client";
import { logger } from "../lib/logger";
import { switchModelVersion, switchConfigVersion, listVersions } from "./model-version-manager";

const log = logger.child({ component: "auto-rollback-enhanced" });

interface RollbackConfig {
  logLossThreshold: number;
  brierThreshold: number;
  consecutiveFailures: number;
  checkInterval: number; // seconds
  cooldownPeriod: number; // seconds
}

interface RollbackState {
  lastCheck: number;
  consecutiveFailures: number;
  lastRollback: number;
  rollbackCount: number;
}

const defaultConfig: RollbackConfig = {
  logLossThreshold: 0.69,
  brierThreshold: 0.22,
  consecutiveFailures: 3,
  checkInterval: 30,
  cooldownPeriod: 300 // 5分
};

let rollbackState: RollbackState = {
  lastCheck: 0,
  consecutiveFailures: 0,
  lastRollback: 0,
  rollbackCount: 0
};

/**
 * Prometheusメトリクスから現在の性能指標取得
 */
async function getCurrentMetrics(): Promise<{ logLoss: number; brier: number } | null> {
  try {
    const metrics = await register.metrics();
    
    // rolling_logloss_10m と rolling_brier_10m を解析
    const logLossMatch = metrics.match(/rolling_logloss_10m\s+([\d.]+)/);
    const brierMatch = metrics.match(/rolling_brier_10m\s+([\d.]+)/);
    
    if (!logLossMatch || !brierMatch) {
      log.warn("Could not find performance metrics");
      return null;
    }
    
    return {
      logLoss: parseFloat(logLossMatch[1]),
      brier: parseFloat(brierMatch[1])
    };
    
  } catch (error) {
    log.error({ error: error.message }, "Failed to get current metrics");
    return null;
  }
}

/**
 * 前のバージョンにロールバック実行
 */
async function executeRollback(): Promise<boolean> {
  try {
    log.warn("Executing automatic rollback");
    
    const versions = await listVersions();
    
    // 現在のバージョンより1つ前を特定
    let targetModelVersion: string | undefined;
    let targetConfigVersion: string | undefined;
    
    if (versions.current.model && versions.models.length > 1) {
      const currentIndex = versions.models.indexOf(versions.current.model);
      if (currentIndex > 0 && currentIndex < versions.models.length) {
        targetModelVersion = versions.models[currentIndex + 1]; // 前のバージョン
      }
    }
    
    if (versions.current.config && versions.configs.length > 1) {
      const currentIndex = versions.configs.indexOf(versions.current.config);
      if (currentIndex > 0 && currentIndex < versions.configs.length) {
        targetConfigVersion = versions.configs[currentIndex + 1]; // 前のバージョン
      }
    }
    
    let rollbackSuccess = false;
    
    // モデルロールバック
    if (targetModelVersion) {
      await switchModelVersion(targetModelVersion);
      log.info({ targetModelVersion }, "Model rolled back successfully");
      rollbackSuccess = true;
    }
    
    // 設定ロールバック
    if (targetConfigVersion) {
      await switchConfigVersion(targetConfigVersion);
      log.info({ targetConfigVersion }, "Config rolled back successfully");
      rollbackSuccess = true;
    }
    
    if (rollbackSuccess) {
      // reload-params API経由で設定反映
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://127.0.0.1:8787/admin/reload-params', {
          method: 'POST'
        });
        
        if (response.ok) {
          log.info("Parameters reloaded successfully after rollback");
        } else {
          log.warn({ status: response.status }, "Failed to reload parameters");
        }
      } catch (error) {
        log.warn({ error: error.message }, "Could not reload parameters via API");
      }
      
      rollbackState.lastRollback = Date.now();
      rollbackState.rollbackCount++;
      rollbackState.consecutiveFailures = 0;
      
      return true;
    } else {
      log.error("No previous version available for rollback");
      return false;
    }
    
  } catch (error) {
    log.error({ error: error.message }, "Rollback execution failed");
    return false;
  }
}

/**
 * メトリクス監視とロールバック判定
 */
async function checkAndRollback(config: RollbackConfig): Promise<void> {
  const now = Date.now();
  
  // チェック間隔確認
  if (now - rollbackState.lastCheck < config.checkInterval * 1000) {
    return;
  }
  
  // クールダウン期間確認
  if (now - rollbackState.lastRollback < config.cooldownPeriod * 1000) {
    log.debug("In cooldown period, skipping rollback check");
    rollbackState.lastCheck = now;
    return;
  }
  
  rollbackState.lastCheck = now;
  
  const metrics = await getCurrentMetrics();
  if (!metrics) {
    return;
  }
  
  // しきい値判定
  const logLossExceeded = metrics.logLoss > config.logLossThreshold;
  const brierExceeded = metrics.brier > config.brierThreshold;
  
  if (logLossExceeded || brierExceeded) {
    rollbackState.consecutiveFailures++;
    
    log.warn({
      logLoss: metrics.logLoss,
      brier: metrics.brier,
      thresholds: {
        logLoss: config.logLossThreshold,
        brier: config.brierThreshold
      },
      consecutiveFailures: rollbackState.consecutiveFailures,
      requiredFailures: config.consecutiveFailures
    }, "Performance threshold exceeded");
    
    // 連続失敗回数チェック
    if (rollbackState.consecutiveFailures >= config.consecutiveFailures) {
      const rollbackSuccess = await executeRollback();
      
      if (rollbackSuccess) {
        log.info("Automatic rollback completed successfully");
      } else {
        log.error("Automatic rollback failed");
      }
    }
  } else {
    // メトリクス正常 - 連続失敗リセット
    if (rollbackState.consecutiveFailures > 0) {
      log.info("Performance metrics returned to normal");
      rollbackState.consecutiveFailures = 0;
    }
  }
}

/**
 * 継続監視モード
 */
async function runMonitoring(config: RollbackConfig): Promise<void> {
  log.info(config, "Starting enhanced auto-rollback monitoring");
  
  const interval = setInterval(async () => {
    try {
      await checkAndRollback(config);
    } catch (error) {
      log.error({ error: error.message }, "Error in rollback monitoring");
    }
  }, config.checkInterval * 1000);
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    log.info("Shutting down auto-rollback monitoring");
    clearInterval(interval);
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log.info("Shutting down auto-rollback monitoring");
    clearInterval(interval);
    process.exit(0);
  });
}

// CLI実行部分
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'monitor':
        const config = { ...defaultConfig };
        
        // CLI引数でしきい値オーバーライド
        for (let i = 1; i < args.length; i += 2) {
          const key = args[i];
          const value = parseFloat(args[i + 1]);
          
          switch (key) {
            case '--ll-thresh':
              config.logLossThreshold = value;
              break;
            case '--br-thresh':
              config.brierThreshold = value;
              break;
            case '--consec':
              config.consecutiveFailures = Math.floor(value);
              break;
            case '--interval':
              config.checkInterval = Math.floor(value);
              break;
            case '--cooldown':
              config.cooldownPeriod = Math.floor(value);
              break;
          }
        }
        
        await runMonitoring(config);
        break;
        
      case 'check':
        await checkAndRollback(defaultConfig);
        console.log("Single check completed");
        break;
        
      case 'force-rollback':
        const success = await executeRollback();
        console.log(success ? "Rollback completed" : "Rollback failed");
        break;
        
      case 'status':
        const metrics = await getCurrentMetrics();
        const versions = await listVersions();
        
        console.log(JSON.stringify({
          metrics,
          versions: versions.current,
          rollbackState,
          available: {
            models: versions.models.length,
            configs: versions.configs.length
          }
        }, null, 2));
        break;
        
      default:
        console.log(`Usage: ${process.argv[1]} <command> [options]`);
        console.log("Commands:");
        console.log("  monitor [--ll-thresh 0.69] [--br-thresh 0.22] [--consec 3]");
        console.log("  check                       - Single performance check");
        console.log("  force-rollback             - Force immediate rollback");
        console.log("  status                     - Show current status");
        break;
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}