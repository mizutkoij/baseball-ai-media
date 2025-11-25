#!/usr/bin/env npx tsx
/**
 * ゲームデー運用スクリプト
 * T-24h / T-0 / Live の3段階でのシステム準備・監視
 */

import { logger } from "../lib/logger";
import { execSync } from "child_process";

const log = logger.child({ component: "game-day-ops" });

interface GameDayConfig {
  date: string;
  phase: "T-24h" | "T-0" | "Live";
  gameIds?: string[];
  dryRun?: boolean;
}

/**
 * T-24h: 本番前24時間チェック
 * - dry-run deploy + chaos testing
 * - SLO全項目緑確認でGo判定
 */
async function prepare24h(config: GameDayConfig): Promise<boolean> {
  log.info({ phase: "T-24h", date: config.date }, "24時間前準備開始");
  
  try {
    // Dry-run deploy テスト
    log.info("Dry-run deploy実行...");
    const deployTest = execSync('./deploy/production-ops.sh deploy --dry-run', { 
      encoding: 'utf-8',
      timeout: 300000 // 5分
    });
    
    if (!deployTest.includes('SUCCESS')) {
      log.error("Dry-run deploy失敗");
      return false;
    }
    
    // Chaos testing (1時間 / 2倍速 / 5%ネット障害)
    log.info("Chaos testing開始 (1時間)...");
    const chaosCmd = `timeout 3600 npm run ops:chaos -- --speed=2 --fault=net:5% --duration=3600`;
    
    try {
      execSync(chaosCmd, { encoding: 'utf-8' });
      log.info("Chaos testing完了");
    } catch (error) {
      log.warn({ error: error.message }, "Chaos testing中にエラー");
    }
    
    // SLO確認
    log.info("SLO全項目確認...");
    const sloResult = execSync('./deploy/production-ops.sh slo-check', { 
      encoding: 'utf-8' 
    });
    
    const sloGreen = !sloResult.includes('WARNING') && !sloResult.includes('ERROR');
    
    if (sloGreen) {
      log.info("✅ T-24h準備完了 - Go判定");
      return true;
    } else {
      log.warn("⚠️ SLO項目に問題あり - 要対応");
      return false;
    }
    
  } catch (error) {
    log.error({ error: error.message }, "T-24h準備失敗");
    return false;
  }
}

/**
 * T-0: 試合開始60分前準備
 * - ラインアップ同期ループ開始
 * - カバレッジ率≥98%をダッシュボード固定表示
 */
async function prepareT0(config: GameDayConfig): Promise<void> {
  log.info({ phase: "T-0", date: config.date }, "試合開始60分前準備");
  
  try {
    // ラインアップ同期ループ開始
    log.info("ラインアップ同期ループ開始...");
    
    const lineupSyncCmd = `npm run sync:lineups -- --date=${config.date} --loop --interval=300`; // 5分間隔
    const syncProcess = execSync(`nohup ${lineupSyncCmd} > logs/lineup-sync-${config.date}.log 2>&1 &`, {
      encoding: 'utf-8'
    });
    
    log.info("ラインアップ同期ループ開始完了");
    
    // Coverage監視開始
    log.info("カバレッジ監視開始...");
    
    const coverageInterval = setInterval(async () => {
      try {
        const fetch = (await import('node-fetch')).default;
        const metricsResponse = await fetch('http://127.0.0.1:8787/metrics');
        const metrics = await metricsResponse.text();
        
        // カバレッジ率計算
        const coverageMatch = metrics.match(/coverage_pitches_total\{.*?\}\s+([\d.]+)/);
        const expectedMatch = metrics.match(/expected_pitches_total\{.*?\}\s+([\d.]+)/);
        
        if (coverageMatch && expectedMatch) {
          const coverage = parseFloat(coverageMatch[1]);
          const expected = parseFloat(expectedMatch[1]);
          const rate = expected > 0 ? coverage / expected : 0;
          
          if (rate >= 0.98) {
            log.info({ coverageRate: Math.round(rate * 100) }, "✅ カバレッジ率良好");
          } else {
            log.warn({ coverageRate: Math.round(rate * 100) }, "⚠️ カバレッジ率低下");
          }
        }
        
      } catch (error) {
        log.warn({ error: error.message }, "カバレッジ確認エラー");
      }
    }, 60000); // 1分間隔
    
    // プロセス終了時にクリーンアップ
    process.on('SIGTERM', () => clearInterval(coverageInterval));
    process.on('SIGINT', () => clearInterval(coverageInterval));
    
    log.info("T-0準備完了 - ライブ監視継続中");
    
  } catch (error) {
    log.error({ error: error.message }, "T-0準備失敗");
    throw error;
  }
}

/**
 * Live: 試合中リアルタイム監視
 * - SSE接続数・age・latency監視
 * - p95 > 10s でSlack/Pager通知
 */
async function monitorLive(config: GameDayConfig): Promise<void> {
  log.info({ phase: "Live", gameIds: config.gameIds }, "ライブ監視開始");
  
  const liveInterval = setInterval(async () => {
    try {
      const fetch = (await import('node-fetch')).default;
      const metricsResponse = await fetch('http://127.0.0.1:8787/metrics');
      const metrics = await metricsResponse.text();
      
      // SSE接続数
      const sseConnectionsMatch = metrics.match(/live_sse_connections\s+([\d.]+)/);
      const sseConnections = sseConnectionsMatch ? parseInt(sseConnectionsMatch[1]) : 0;
      
      // レイテンシP95
      const latencyP95Match = metrics.match(/nextpitch_predict_latency_ms\{.*quantile="0.95".*?\}\s+([\d.]+)/);
      const latencyP95 = latencyP95Match ? parseFloat(latencyP95Match[1]) : 0;
      
      // PbP遅延P95
      const pbpLagP95Match = metrics.match(/pbp_event_lag_seconds\{.*quantile="0.95".*?\}\s+([\d.]+)/);
      const pbpLagP95 = pbpLagP95Match ? parseFloat(pbpLagP95Match[1]) : 0;
      
      // アラート判定
      let alertLevel = "green";
      let alertMessages: string[] = [];
      
      if (latencyP95 > 100) { // 100ms threshold
        alertLevel = "red";
        alertMessages.push(`予測レイテンシ高い: ${latencyP95.toFixed(1)}ms`);
      }
      
      if (pbpLagP95 > 10) { // 10秒 threshold
        alertLevel = "red";
        alertMessages.push(`PbP遅延高い: ${pbpLagP95.toFixed(1)}s`);
      }
      
      if (sseConnections > 1000) { // 接続数監視
        alertLevel = alertLevel === "red" ? "red" : "yellow";
        alertMessages.push(`SSE接続数多い: ${sseConnections}`);
      }
      
      // ログ出力
      const logData = {
        sseConnections,
        latencyP95: latencyP95.toFixed(1),
        pbpLagP95: pbpLagP95.toFixed(1),
        alertLevel
      };
      
      if (alertLevel === "red") {
        log.error(logData, `🚨 ライブ監視アラート: ${alertMessages.join(', ')}`);
        
        // TODO: Slack/Pager通知実装
        // await sendAlert('critical', alertMessages.join(', '));
        
      } else if (alertLevel === "yellow") {
        log.warn(logData, `⚠️ ライブ監視警告: ${alertMessages.join(', ')}`);
      } else {
        log.info(logData, "✅ ライブ監視正常");
      }
      
    } catch (error) {
      log.error({ error: error.message }, "ライブ監視エラー");
    }
  }, 30000); // 30秒間隔
  
  // クリーンアップ
  process.on('SIGTERM', () => clearInterval(liveInterval));
  process.on('SIGINT', () => clearInterval(liveInterval));
  
  log.info("ライブ監視開始完了");
}

// CLI実行部分
async function main() {
  const args = process.argv.slice(2);
  const phase = args[0] as "T-24h" | "T-0" | "Live";
  const date = args[1] || new Date().toISOString().slice(0, 10);
  
  const config: GameDayConfig = {
    phase,
    date,
    gameIds: args.slice(2)
  };
  
  try {
    switch (phase) {
      case "T-24h":
        const ready = await prepare24h(config);
        process.exit(ready ? 0 : 1);
        break;
        
      case "T-0":
        await prepareT0(config);
        break;
        
      case "Live":
        await monitorLive(config);
        break;
        
      default:
        console.log("使用方法:");
        console.log("  npx tsx scripts/game-day-ops.ts T-24h [date]");
        console.log("  npx tsx scripts/game-day-ops.ts T-0 [date]");
        console.log("  npx tsx scripts/game-day-ops.ts Live [date] [gameId1] [gameId2]");
        process.exit(1);
    }
  } catch (error) {
    console.error("ゲームデー運用エラー:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}