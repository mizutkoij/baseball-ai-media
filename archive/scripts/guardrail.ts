#!/usr/bin/env npx tsx
/**
 * ガードレール監視システム
 * rolling_logloss/brier監視 → フィーチャーフラグ段階的無効化 → 設定ロールバック
 */

import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { logger } from "../lib/logger";
import { ConfigVersionManager } from "../lib/config-version-manager";
import { guardrailActions } from "../lib/prometheus-metrics";

const log = logger.child({ job: "guardrail" });

// メトリクス（Prometheus形式パース用）
interface PrometheusMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
}

interface GuardrailConfig {
  metrics_url: string;
  thresholds: {
    rolling_logloss_10m: number;
    rolling_brier_10m: number;
  };
  consecutive_failures: number;
  feature_flags: string[];
  admin_reload_url?: string;
}

interface GuardrailState {
  consecutive_failures: number;
  last_check: string;
  disabled_features: string[];
  rollback_version?: string;
}

const DEFAULT_CONFIG: GuardrailConfig = {
  metrics_url: "http://localhost:8787/metrics",
  thresholds: {
    rolling_logloss_10m: 0.69,
    rolling_brier_10m: 0.22
  },
  consecutive_failures: 3,
  feature_flags: ["fatigue", "bullpen", "lineup"],
  admin_reload_url: "http://localhost:8787/admin/reload-params"
};

let state: GuardrailState = {
  consecutive_failures: 0,
  last_check: new Date().toISOString(),
  disabled_features: []
};

async function parsePrometheusMetrics(metricsText: string): Promise<PrometheusMetric[]> {
  const lines = metricsText.split("\n");
  const metrics: PrometheusMetric[] = [];
  
  for (const line of lines) {
    if (line.startsWith("#") || !line.trim()) continue;
    
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*(?:\{[^}]*\})?)?\s+([0-9.-]+(?:e[+-]?[0-9]+)?)/);
    if (!match) continue;
    
    const [, nameWithLabels, valueStr] = match;
    const value = parseFloat(valueStr);
    
    // ラベル解析
    const labelMatch = nameWithLabels?.match(/^([^{]+)(?:\{([^}]*)\})?$/);
    if (!labelMatch) continue;
    
    const [, name, labelsStr] = labelMatch;
    const labels: Record<string, string> = {};
    
    if (labelsStr) {
      const labelPairs = labelsStr.split(",");
      for (const pair of labelPairs) {
        const [key, value] = pair.split("=");
        if (key && value) {
          labels[key.trim()] = value.replace(/"/g, "").trim();
        }
      }
    }
    
    metrics.push({ name: name.trim(), value, labels });
  }
  
  return metrics;
}

async function fetchMetrics(url: string): Promise<PrometheusMetric[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    return await parsePrometheusMetrics(text);
  } catch (error) {
    log.error({ url, error: error.message }, "Failed to fetch metrics");
    throw error;
  }
}

async function checkThresholds(config: GuardrailConfig): Promise<boolean> {
  const metrics = await fetchMetrics(config.metrics_url);
  
  let violations = 0;
  
  for (const metric of metrics) {
    if (metric.name === "rolling_logloss_10m" && metric.value > config.thresholds.rolling_logloss_10m) {
      log.warn({ 
        metric: "rolling_logloss_10m", 
        value: metric.value, 
        threshold: config.thresholds.rolling_logloss_10m 
      }, "LogLoss threshold violation");
      violations++;
    }
    
    if (metric.name === "rolling_brier_10m" && metric.value > config.thresholds.rolling_brier_10m) {
      log.warn({ 
        metric: "rolling_brier_10m", 
        value: metric.value, 
        threshold: config.thresholds.rolling_brier_10m 
      }, "Brier threshold violation");
      violations++;
    }
  }
  
  return violations > 0;
}

async function disableNextFeature(config: GuardrailConfig): Promise<string | null> {
  const availableFeatures = config.feature_flags.filter(f => 
    !state.disabled_features.includes(f)
  );
  
  if (availableFeatures.length === 0) {
    log.warn("All features already disabled");
    return null;
  }
  
  const featureToDisable = availableFeatures[0]; // 順番通り（fatigue → bullpen → lineup）
  
  try {
    // 対応する設定ファイルを更新
    const configMap: Record<string, string> = {
      "fatigue": "fatigue-params",
      "bullpen": "relief-params", 
      "lineup": "lineup-params"
    };
    
    const configName = configMap[featureToDisable];
    if (!configName) {
      throw new Error(`Unknown feature: ${featureToDisable}`);
    }
    
    const configPath = path.join("config", `${configName}.json`);
    const configContent = await fs.readFile(configPath, "utf-8");
    const configData = JSON.parse(configContent);
    
    // enable フラグを無効化
    configData.enable = false;
    
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
    state.disabled_features.push(featureToDisable);
    
    log.warn({ 
      feature: featureToDisable, 
      config: configName 
    }, "Feature disabled due to quality degradation");
    
    guardrailActions.inc({ action: "feature_off" });
    
    return featureToDisable;
    
  } catch (error) {
    log.error({ 
      feature: featureToDisable, 
      error: error.message 
    }, "Failed to disable feature");
    
    return null;
  }
}

async function rollbackConfig(): Promise<boolean> {
  try {
    const versionManager = new ConfigVersionManager("live-params");
    const rolledBackVersion = await versionManager.rollbackToSafe();
    
    if (rolledBackVersion) {
      state.rollback_version = rolledBackVersion;
      log.warn({ version: rolledBackVersion }, "Configuration rolled back to safe version");
      guardrailActions.inc({ action: "rollback" });
      return true;
    } else {
      log.error("No safe configuration version available for rollback");
      return false;
    }
    
  } catch (error) {
    log.error({ error: error.message }, "Configuration rollback failed");
    return false;
  }
}

async function reloadParams(config: GuardrailConfig): Promise<boolean> {
  if (!config.admin_reload_url) {
    log.warn("Admin reload URL not configured");
    return false;
  }
  
  try {
    const response = await fetch(config.admin_reload_url, { method: "POST" });
    
    if (response.ok) {
      log.info("Parameters reloaded successfully");
      guardrailActions.inc({ action: "reload" });
      return true;
    } else {
      log.error({ status: response.status }, "Parameter reload failed");
      return false;
    }
    
  } catch (error) {
    log.error({ error: error.message }, "Parameter reload request failed");
    return false;
  }
}

async function runGuardrailCheck(config: GuardrailConfig): Promise<void> {
  try {
    const hasViolations = await checkThresholds(config);
    
    if (hasViolations) {
      state.consecutive_failures++;
      log.warn({ 
        consecutive: state.consecutive_failures, 
        threshold: config.consecutive_failures 
      }, "Quality threshold violation detected");
      
      if (state.consecutive_failures >= config.consecutive_failures) {
        log.error("Consecutive failure threshold exceeded, initiating recovery");
        
        // Step 1: フィーチャーフラグ段階的無効化
        const disabledFeature = await disableNextFeature(config);
        
        // Step 2: 全フィーチャー無効でも改善しない場合は設定ロールバック
        if (!disabledFeature) {
          const rollbackSuccess = await rollbackConfig();
          
          if (rollbackSuccess) {
            // Step 3: 無停止反映
            await reloadParams(config);
          }
        } else {
          // フィーチャー無効化後も無停止反映
          await reloadParams(config);
        }
        
        // カウンタリセット（対処済み）
        state.consecutive_failures = 0;
      }
    } else {
      // 品質正常 → カウンタリセット
      if (state.consecutive_failures > 0) {
        log.info("Quality metrics back to normal");
        state.consecutive_failures = 0;
      }
    }
    
    state.last_check = new Date().toISOString();
    
  } catch (error) {
    log.error({ error: error.message }, "Guardrail check failed");
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  let config = { ...DEFAULT_CONFIG };
  
  // CLI引数パース
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case "--metrics":
        config.metrics_url = value;
        break;
      case "--ll-thresh":
        config.thresholds.rolling_logloss_10m = parseFloat(value);
        break;
      case "--br-thresh":
        config.thresholds.rolling_brier_10m = parseFloat(value);
        break;
      case "--consec":
        config.consecutive_failures = parseInt(value);
        break;
      case "--admin-url":
        config.admin_reload_url = value;
        break;
    }
  }
  
  log.info({ config }, "Guardrail system starting");
  
  // 1分間隔でチェック
  const interval = 60 * 1000; // 60秒
  
  while (true) {
    await runGuardrailCheck(config);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("💥 Guardrail system error:", error);
    process.exit(1);
  });
}