#!/usr/bin/env tsx
/**
 * auto_update_schedule.ts - NPB試合日程・結果の自動更新システム
 * 
 * 機能:
 * - 定期的な今日の試合更新（1時間ごと）
 * - 月次スケジュール取得（月初に実行）
 * - Discord通知
 * - エラー監視・復旧
 * 
 * 使用例:
 *   npx tsx scripts/auto_update_schedule.ts --mode continuous
 *   npx tsx scripts/auto_update_schedule.ts --mode once
 *   npx tsx scripts/auto_update_schedule.ts --mode monthly
 */

import { Command } from 'commander';
import { NPBScheduleFetcher } from './fetch_npb_schedule';
import { notify } from './notify';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface UpdateConfig {
  mode: 'once' | 'continuous' | 'monthly';
  intervalMinutes: number;
  dbPath: string;
  notifySuccess: boolean;
  notifyErrors: boolean;
  maxRetries: number;
  healthCheckUrl?: string;
}

interface UpdateStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRun: string;
  lastSuccess: string;
  lastError?: string;
  uptimeMinutes: number;
}

class AutoUpdateSchedule {
  private config: UpdateConfig;
  private stats: UpdateStats;
  private fetcher: NPBScheduleFetcher;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private startTime: Date;
  private statsPath: string;

  constructor(config: UpdateConfig) {
    this.config = config;
    this.startTime = new Date();
    this.statsPath = join(process.cwd(), 'logs', 'auto_update_stats.json');
    
    // 統計データの読み込み
    this.stats = this.loadStats();
    
    // データベース初期化
    this.fetcher = new NPBScheduleFetcher(config.dbPath);
    
    // シャットダウンハンドラー
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
  }

  /**
   * 自動更新開始
   */
  async start(): Promise<void> {
    console.log('🚀 Starting NPB schedule auto-updater...');
    console.log(`   Mode: ${this.config.mode}`);
    console.log(`   Database: ${this.config.dbPath}`);
    
    if (this.config.mode === 'continuous') {
      console.log(`   Update interval: ${this.config.intervalMinutes} minutes`);
    }

    this.isRunning = true;

    try {
      // 初回実行
      await this.performUpdate();

      // 継続モードの場合はインターバル設定
      if (this.config.mode === 'continuous') {
        this.intervalId = setInterval(async () => {
          if (this.isRunning) {
            await this.performUpdate();
          }
        }, this.config.intervalMinutes * 60 * 1000);

        console.log(`⏰ Scheduled updates every ${this.config.intervalMinutes} minutes`);
        console.log('   Press Ctrl+C to stop');
        
        // プロセスを維持
        await this.keepAlive();
      }

    } catch (error) {
      console.error('❌ Fatal error in auto-updater:', error);
      await this.notifyError('Fatal error in auto-updater', error);
      throw error;
    }
  }

  /**
   * 更新実行
   */
  private async performUpdate(): Promise<void> {
    const runId = `run_${Date.now()}`;
    console.log(`\n🔄 [${runId}] Starting update cycle...`);
    
    this.stats.totalRuns++;
    this.stats.lastRun = new Date().toISOString();

    let success = false;
    let retryCount = 0;

    while (!success && retryCount < this.config.maxRetries) {
      try {
        let result;

        if (this.config.mode === 'monthly') {
          // 月次更新 - 当月のスケジュール全体を取得
          const now = new Date();
          result = await this.fetcher.fetchMonth({
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            league: 'both'
          });
        } else {
          // 日次更新 - 今日の試合のみ
          result = await this.fetcher.fetchToday({});
        }

        if (result.success) {
          success = true;
          this.stats.successfulRuns++;
          this.stats.lastSuccess = new Date().toISOString();
          
          console.log(`✅ [${runId}] Update completed successfully`);
          console.log(`   📊 Processed: ${result.totalGames} games`);
          console.log(`   📥 Inserted: ${result.insertedGames} new games`);
          console.log(`   🔄 Updated: ${result.updatedGames} existing games`);

          // 成功通知（設定されている場合のみ）
          if (this.config.notifySuccess && (result.insertedGames > 0 || result.updatedGames > 0)) {
            await this.notifySuccess(result);
          }

        } else {
          throw new Error(`Update failed: ${result.errors.join(', ')}`);
        }

      } catch (error) {
        retryCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        console.error(`❌ [${runId}] Update failed (attempt ${retryCount}/${this.config.maxRetries}): ${errorMsg}`);
        
        if (retryCount < this.config.maxRetries) {
          const backoffSeconds = Math.min(60, Math.pow(2, retryCount - 1) * 10);
          console.log(`   ⏳ Retrying in ${backoffSeconds} seconds...`);
          await this.delay(backoffSeconds * 1000);
        } else {
          // 最大リトライ回数に達した場合
          this.stats.failedRuns++;
          this.stats.lastError = errorMsg;
          
          if (this.config.notifyErrors) {
            await this.notifyError('Schedule update failed after all retries', error);
          }
        }
      }
    }

    // 統計の保存
    this.stats.uptimeMinutes = Math.floor((Date.now() - this.startTime.getTime()) / 60000);
    this.saveStats();
  }

  /**
   * 成功通知
   */
  private async notifySuccess(result: any): Promise<void> {
    try {
      const message = `📊 NPB Schedule Updated\n` +
                     `🎯 Total: ${result.totalGames} games\n` +
                     `📥 New: ${result.insertedGames} games\n` +
                     `🔄 Updated: ${result.updatedGames} games\n` +
                     `⏱️ Duration: ${result.duration}ms`;

      await notify({
        message,
        title: 'NPB Schedule Update Success',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to send success notification:', error);
    }
  }

  /**
   * エラー通知
   */
  private async notifyError(title: string, error: any): Promise<void> {
    try {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const message = `❌ ${title}\n\nError: ${errorMsg}\n\n` +
                     `Stats: ${this.stats.successfulRuns}/${this.stats.totalRuns} successful runs\n` +
                     `Last success: ${this.stats.lastSuccess || 'Never'}`;

      await notify({
        message,
        title: 'NPB Auto-Updater Error',
        type: 'error'
      });
    } catch (notifyError) {
      console.error('Failed to send error notification:', notifyError);
    }
  }

  /**
   * 統計データの読み込み
   */
  private loadStats(): UpdateStats {
    try {
      if (existsSync(this.statsPath)) {
        const data = readFileSync(this.statsPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load stats, starting fresh:', error);
    }

    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRun: '',
      lastSuccess: '',
      uptimeMinutes: 0
    };
  }

  /**
   * 統計データの保存
   */
  private saveStats(): void {
    try {
      const dir = join(process.cwd(), 'logs');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      console.error('Failed to save stats:', error);
    }
  }

  /**
   * 統計情報の表示
   */
  printStats(): void {
    console.log('\n📊 Auto-Updater Statistics:');
    console.log(`   🔄 Total runs: ${this.stats.totalRuns}`);
    console.log(`   ✅ Successful: ${this.stats.successfulRuns}`);
    console.log(`   ❌ Failed: ${this.stats.failedRuns}`);
    
    if (this.stats.totalRuns > 0) {
      const successRate = (this.stats.successfulRuns / this.stats.totalRuns * 100).toFixed(1);
      console.log(`   📈 Success rate: ${successRate}%`);
    }
    
    console.log(`   ⏰ Uptime: ${this.stats.uptimeMinutes} minutes`);
    console.log(`   🕐 Last run: ${this.stats.lastRun || 'Never'}`);
    console.log(`   ✅ Last success: ${this.stats.lastSuccess || 'Never'}`);
    
    if (this.stats.lastError) {
      console.log(`   ❌ Last error: ${this.stats.lastError}`);
    }
  }

  /**
   * プロセス維持
   */
  private async keepAlive(): Promise<void> {
    return new Promise((resolve) => {
      // 継続モードでは無限待機
      if (this.config.mode === 'continuous') {
        // プロセスが終了するまで待機
        const checkInterval = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      } else {
        resolve();
      }
    });
  }

  /**
   * シャットダウン処理
   */
  private async shutdown(signal: string): Promise<void> {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.printStats();
    this.saveStats();
    
    try {
      this.fetcher.close();
    } catch (error) {
      console.error('Error closing database:', error);
    }

    console.log('👋 Shutdown complete');
    process.exit(0);
  }

  /**
   * 遅延実行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI実行部分
async function main() {
  const program = new Command();

  program
    .name('auto-update-schedule')
    .description('Automatic NPB schedule updater')
    .version('1.0.0');

  program
    .option('-m, --mode <mode>', 'Update mode (once, continuous, monthly)', 'once')
    .option('-i, --interval <minutes>', 'Update interval in minutes for continuous mode', '60')
    .option('--db <path>', 'Database path', './data/db_current.db')
    .option('--notify-success', 'Send notifications on successful updates')
    .option('--notify-errors', 'Send notifications on errors', true)
    .option('--max-retries <count>', 'Maximum retry attempts', '3')
    .option('--health-check <url>', 'Health check URL to ping after updates');

  program.parse();

  const options = program.opts();

  // 設定の構築
  const config: UpdateConfig = {
    mode: options.mode as 'once' | 'continuous' | 'monthly',
    intervalMinutes: parseInt(options.interval),
    dbPath: options.db,
    notifySuccess: options.notifySuccess || false,
    notifyErrors: options.notifyErrors !== false,
    maxRetries: parseInt(options.maxRetries),
    healthCheckUrl: options.healthCheck
  };

  // バリデーション
  if (!['once', 'continuous', 'monthly'].includes(config.mode)) {
    console.error('❌ Invalid mode. Must be: once, continuous, or monthly');
    process.exit(1);
  }

  if (config.intervalMinutes < 1) {
    console.error('❌ Interval must be at least 1 minute');
    process.exit(1);
  }

  // データベースディレクトリの作成
  const dbDir = join(process.cwd(), 'data');
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // ログディレクトリの作成
  const logDir = join(process.cwd(), 'logs');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  // 自動更新開始
  const updater = new AutoUpdateSchedule(config);
  
  try {
    await updater.start();
    console.log('✅ Auto-updater completed successfully');
  } catch (error) {
    console.error('❌ Auto-updater failed:', error);
    process.exit(1);
  }
}

// 直接実行された場合のみmainを実行
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { AutoUpdateSchedule };