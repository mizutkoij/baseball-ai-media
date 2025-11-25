#!/usr/bin/env npx tsx
/**
 * 監視アラートしきい値とアクション実装
 * "出たら動く"自動対応システム
 */

import { promises as fs } from 'fs';

interface MonitoringThresholds {
  yahoo304RatioMinWarning: number;    // 0.40 (警告)
  yahoo304RatioMinCritical: number;   // 0.60 (正常)
  yahoo429RateMaxWarning: number;     // 0.01 (1%)
  pbpLagP95Warning: number;           // 15000ms
  windowSizeMinutes: number;          // 10分窓
}

interface SystemMetrics {
  yahoo304Ratio: number;
  yahoo429Rate: number;
  pbpLagP95: number;
  expectedGamesTotal: number;
  sseConnections: number;
  networkErrors: number;
  timestamp: string;
}

export class MonitoringActions {
  private thresholds: MonitoringThresholds = {
    yahoo304RatioMinWarning: 0.40,
    yahoo304RatioMinCritical: 0.60,
    yahoo429RateMaxWarning: 0.01,
    pbpLagP95Warning: 15000,
    windowSizeMinutes: 10
  };

  private lastActionTime = new Map<string, number>();

  constructor(private dataDir: string = './data') {}

  /**
   * メイン監視ループ - 10分窓での継続監視
   */
  async runMonitoringLoop(): Promise<void> {
    console.log('🔍 Starting monitoring loop with action thresholds');
    console.log('================================================');

    while (true) {
      try {
        const metrics = await this.collectCurrentMetrics();
        await this.evaluateAndTakeAction(metrics);
        
        // 10分間隔で監視
        await this.sleep(this.thresholds.windowSizeMinutes * 60 * 1000);
      } catch (error) {
        console.error('Monitoring loop error:', error);
        await this.sleep(60000); // 1分後にリトライ
      }
    }
  }

  /**
   * 現在のシステムメトリクス収集
   */
  private async collectCurrentMetrics(): Promise<SystemMetrics> {
    const now = new Date().toISOString();
    
    // ログファイルから304比率計算
    const yahoo304Ratio = await this.calculate304Ratio();
    
    // 429エラー率計算 (10分窓)
    const yahoo429Rate = await this.calculate429Rate();
    
    // PBP遅延P95計算
    const pbpLagP95 = await this.calculatePbpLag();
    
    // その他メトリクス
    const expectedGamesTotal = await this.getExpectedGamesTotal();
    const sseConnections = await this.countSSEConnections();
    const networkErrors = await this.countNetworkErrors();

    return {
      yahoo304Ratio,
      yahoo429Rate,
      pbpLagP95,
      expectedGamesTotal,
      sseConnections,
      networkErrors,
      timestamp: now
    };
  }

  /**
   * しきい値評価と自動アクション実行
   */
  private async evaluateAndTakeAction(metrics: SystemMetrics): Promise<void> {
    console.log(`📊 Metrics: 304=${(metrics.yahoo304Ratio*100).toFixed(1)}% | 429=${(metrics.yahoo429Rate*100).toFixed(2)}% | P95=${metrics.pbpLagP95}ms`);

    // 304比率低下 → expected_games_total 再取り込み + ポーリング拡大
    if (metrics.yahoo304Ratio < this.thresholds.yahoo304RatioMinWarning) {
      await this.handle304RatioLow(metrics);
    }

    // 429エラー率高 → 自動クールダウン
    if (metrics.yahoo429Rate > this.thresholds.yahoo429RateMaxWarning) {
      await this.handle429RateHigh(metrics);
    }

    // P95遅延高 → SSE確認 + stale許可
    if (metrics.pbpLagP95 > this.thresholds.pbpLagP95Warning) {
      await this.handleHighLatency(metrics);
    }
  }

  /**
   * Action: 304比率低下対応
   */
  private async handle304RatioLow(metrics: SystemMetrics): Promise<void> {
    const actionKey = '304_ratio_low';
    if (this.isActionRecentlyTaken(actionKey, 30 * 60 * 1000)) { // 30分クールダウン
      return;
    }

    console.log('🔄 ACTION: 304比率低下対応開始');
    
    try {
      // 1. expected_games_total 再取り込み
      const expectedGames = await this.refreshExpectedGamesTotal();
      
      // 2. ポーリング間隔拡大
      const newInterval = expectedGames === 0 ? 600000 : 450000; // 10分 or 7.5分
      process.env.BACKFILL_SLEEP_MS = newInterval.toString();
      
      console.log(`Expected games: ${expectedGames}, New polling interval: ${newInterval/1000}s`);
      
      // 3. Discord通知
      await this.sendDiscordAlert({
        title: '🔄 304比率低下 - 自動対応実行',
        description: `304比率: ${(metrics.yahoo304Ratio*100).toFixed(1)}% → expected_games再取得 + ポーリング拡大`,
        color: 0xffaa00,
        fields: [
          { name: 'Expected Games', value: expectedGames.toString(), inline: true },
          { name: 'New Interval', value: `${newInterval/1000}s`, inline: true },
          { name: 'Action', value: 'Auto-adjusted polling', inline: false }
        ]
      });

      this.markActionTaken(actionKey);
      
    } catch (error) {
      console.error('304 ratio action failed:', error);
      await this.sendDiscordAlert({
        title: '❌ 304比率対応失敗',
        description: `Action failed: ${error}`,
        color: 0xff0000
      });
    }
  }

  /**
   * Action: 429エラー率高対応
   */
  private async handle429RateHigh(metrics: SystemMetrics): Promise<void> {
    const actionKey = '429_rate_high';
    if (this.isActionRecentlyTaken(actionKey, 15 * 60 * 1000)) { // 15分クールダウン
      return;
    }

    console.log('🛑 ACTION: 429エラー率高 - 緊急停止開始');
    
    try {
      // 1. 緊急停止フラグ設定
      process.env.YAHOO_STOP = 'true';
      
      // 2. Discord緊急通知
      await this.sendDiscordAlert({
        title: '🛑 429エラー率高 - 緊急停止',
        description: `429エラー率: ${(metrics.yahoo429Rate*100).toFixed(2)}% → 自動クールダウン開始`,
        color: 0xff0000,
        fields: [
          { name: 'Threshold', value: '1.00%', inline: true },
          { name: 'Actual', value: `${(metrics.yahoo429Rate*100).toFixed(2)}%`, inline: true },
          { name: 'Action', value: '10分間停止 → 自動再開', inline: false }
        ]
      });

      console.log('YAHOO_STOP=true set, waiting 10 minutes for cooldown');
      
      // 3. 10分後の自動再開をスケジュール
      setTimeout(async () => {
        delete process.env.YAHOO_STOP;
        console.log('Auto-restart: YAHOO_STOP flag removed');
        
        await this.sendDiscordAlert({
          title: '🔄 自動再開完了',
          description: '10分クールダウン完了 → システム再開',
          color: 0x00ff00
        });
      }, 10 * 60 * 1000);

      this.markActionTaken(actionKey);
      
    } catch (error) {
      console.error('429 rate action failed:', error);
    }
  }

  /**
   * Action: 高遅延対応
   */
  private async handleHighLatency(metrics: SystemMetrics): Promise<void> {
    const actionKey = 'high_latency';
    if (this.isActionRecentlyTaken(actionKey, 20 * 60 * 1000)) { // 20分クールダウン
      return;
    }

    console.log('⚠️ ACTION: 高遅延対応開始');
    
    try {
      // ネットワーク要因判定
      const isNetworkIssue = metrics.networkErrors > 10 || metrics.sseConnections < 2;
      
      if (isNetworkIssue) {
        // 一時的にstaleデータ許可
        process.env.ALLOW_STALE_DATA = 'true';
        console.log('Network issue detected, allowing stale data temporarily');
        
        // 30分後に制限解除
        setTimeout(() => {
          delete process.env.ALLOW_STALE_DATA;
          console.log('Stale data allowance expired');
        }, 30 * 60 * 1000);
      }

      await this.sendDiscordAlert({
        title: '⚠️ P95遅延高 - 対応実行',
        description: `P95遅延: ${metrics.pbpLagP95}ms → ${isNetworkIssue ? 'stale許可' : 'SSE確認'}`,
        color: 0xffaa00,
        fields: [
          { name: 'P95 Lag', value: `${metrics.pbpLagP95}ms`, inline: true },
          { name: 'SSE Connections', value: metrics.sseConnections.toString(), inline: true },
          { name: 'Network Errors', value: metrics.networkErrors.toString(), inline: true },
          { name: 'Action', value: isNetworkIssue ? 'Stale data allowed (30min)' : 'Monitoring SSE', inline: false }
        ]
      });

      this.markActionTaken(actionKey);
      
    } catch (error) {
      console.error('High latency action failed:', error);
    }
  }

  // ヘルパーメソッド群
  private async calculate304Ratio(): Promise<number> {
    try {
      const logPath = `${this.dataDir}/../logs/npb2-daemon.log`;
      const logContent = await fs.readFile(logPath, 'utf-8').catch(() => '');
      
      // 過去10分のログから304比率計算
      const lines = logContent.split('\n');
      let totalRequests = 0;
      let cached304s = 0;
      
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
      
      for (const line of lines) {
        if (line.includes('GET https://baseball.yahoo.co.jp')) {
          totalRequests++;
          if (line.includes('304') || line.includes('fromCache: true')) {
            cached304s++;
          }
        }
      }
      
      return totalRequests > 0 ? cached304s / totalRequests : 0;
    } catch (error) {
      console.warn('Could not calculate 304 ratio:', error);
      return 0;
    }
  }

  private async calculate429Rate(): Promise<number> {
    try {
      const logPath = `${this.dataDir}/../logs/npb2-daemon.log`;
      const logContent = await fs.readFile(logPath, 'utf-8').catch(() => '');
      
      const lines = logContent.split('\n');
      let totalRequests = 0;
      let error429s = 0;
      
      for (const line of lines) {
        if (line.includes('GET https://baseball.yahoo.co.jp')) {
          totalRequests++;
          if (line.includes('429') || line.includes('Rate limited')) {
            error429s++;
          }
        }
      }
      
      return totalRequests > 0 ? error429s / totalRequests : 0;
    } catch (error) {
      console.warn('Could not calculate 429 rate:', error);
      return 0;
    }
  }

  private async calculatePbpLag(): Promise<number> {
    // プレースホルダー - 実際のPBP遅延計算
    return 5000; // 5秒
  }

  private async refreshExpectedGamesTotal(): Promise<number> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`https://baseball.yahoo.co.jp/npb/schedule/farm?date=${today}`, {
        headers: {
          'User-Agent': 'NPB-ResearchBot/1.0 (+admin@baseball-ai-media.com)'
        }
      });

      if (response.ok) {
        const html = await response.text();
        const gamesMatch = html.match(/試合.*?(\d+)件/);
        return gamesMatch ? parseInt(gamesMatch[1]) : 0;
      }
      return 0;
    } catch (error) {
      console.error('Failed to refresh expected games:', error);
      return 0;
    }
  }

  private async getExpectedGamesTotal(): Promise<number> {
    // キャッシュから取得または再計算
    return 0;
  }

  private async countSSEConnections(): Promise<number> {
    // SSE接続数カウント（プレースホルダー）
    return 3;
  }

  private async countNetworkErrors(): Promise<number> {
    // ネットワークエラー数カウント（プレースホルダー）
    return 0;
  }

  private isActionRecentlyTaken(actionKey: string, cooldownMs: number): boolean {
    const lastTime = this.lastActionTime.get(actionKey);
    if (!lastTime) return false;
    
    return Date.now() - lastTime < cooldownMs;
  }

  private markActionTaken(actionKey: string): void {
    this.lastActionTime.set(actionKey, Date.now());
  }

  private async sendDiscordAlert(embed: any): Promise<void> {
    try {
      const webhookUrl = process.env.WEBHOOK_DISCORD_URL;
      if (!webhookUrl) return;

      const payload = {
        embeds: [{
          ...embed,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'NPB2 Monitoring Actions',
            icon_url: 'https://via.placeholder.com/20x20/ff0000/ffffff?text=🚨'
          }
        }]
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Discord alert failed:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  const monitor = new MonitoringActions(process.env.DATA_DIR || './data');

  if (command === 'run') {
    await monitor.runMonitoringLoop();
  } else {
    console.log('Usage: npx tsx scripts/monitoring-actions.ts [run]');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default MonitoringActions;