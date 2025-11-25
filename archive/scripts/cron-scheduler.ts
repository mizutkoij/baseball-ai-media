#!/usr/bin/env npx tsx

/**
 * NPB自動スクレイピング スケジューラー
 * 
 * 機能:
 * - cron形式でのスケジューリング
 * - 時間帯別の処理内容切り替え
 * - ロック機能（重複実行防止）
 * - ログローテーション
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AutomatedScraper, ScrapingConfig } from './automated-scraper';

const execAsync = promisify(exec);

interface CronConfig {
  timezone: string;
  lockfile: string;
  logDir: string;
  webhookUrl?: string;
  schedules: CronSchedule[];
}

interface CronSchedule {
  name: string;
  cron: string;
  description: string;
  config: Partial<ScrapingConfig>;
  enabled: boolean;
}

class CronScheduler {
  private config: CronConfig;
  private isRunning = false;

  constructor() {
    this.config = {
      timezone: 'Asia/Tokyo',
      lockfile: path.join(process.cwd(), 'data', 'scraper.lock'),
      logDir: path.join(process.cwd(), 'data', 'logs'),
      webhookUrl: process.env.WEBHOOK_DISCORD_URL,
      schedules: [
        {
          name: 'morning-update',
          cron: '0 7 * * *', // 毎朝7時
          description: '朝の定期更新（当日の試合情報・先発予告）',
          config: {
            scheduleEnabled: true,
            startersEnabled: true,
            detailedEnabled: false,
          },
          enabled: true,
        },
        {
          name: 'afternoon-starters',
          cron: '0 12 * * *', // 正午12時
          description: '午後の先発予告更新',
          config: {
            scheduleEnabled: false,
            startersEnabled: true,
            detailedEnabled: false,
          },
          enabled: true,
        },
        {
          name: 'evening-results',
          cron: '0 18 * * *', // 夕方6時
          description: '夕方の試合開始前チェック',
          config: {
            scheduleEnabled: true,
            startersEnabled: true,
            detailedEnabled: false,
          },
          enabled: true,
        },
        {
          name: 'night-detailed',
          cron: '0 23 * * *', // 深夜23時
          description: '深夜の試合結果・詳細データ取得',
          config: {
            scheduleEnabled: true,
            startersEnabled: false,
            detailedEnabled: true,
          },
          enabled: true,
        },
        {
          name: 'frequent-update',
          cron: '*/30 * * * *', // 30分毎（試合期間中のみ）
          description: 'シーズン中の頻繁更新（3-11月）',
          config: {
            scheduleEnabled: true,
            startersEnabled: false,
            detailedEnabled: false,
          },
          enabled: this.isBaseballSeason(),
        },
      ],
    };
  }

  async start(): Promise<void> {
    console.log('🕐 NPB自動スクレイピング スケジューラー開始');
    console.log(`タイムゾーン: ${this.config.timezone}`);
    
    // ログディレクトリ作成
    await fs.mkdir(this.config.logDir, { recursive: true });
    
    // 有効なスケジュール一覧表示
    const enabledSchedules = this.config.schedules.filter(s => s.enabled);
    console.log('\n📋 有効なスケジュール:');
    enabledSchedules.forEach(schedule => {
      console.log(`  ${schedule.name}: ${schedule.cron} - ${schedule.description}`);
    });

    // 実際の本番環境では、cron daemonやsupervisorを使用
    console.log('\n⚠️  本番環境では以下のcrontabエントリを設定してください:');
    this.generateCrontabEntries();

    // 開発・テスト用の単発実行
    if (process.argv.includes('--test-run')) {
      await this.runScheduledTask('morning-update');
    }
  }

  private async runScheduledTask(scheduleName: string): Promise<void> {
    const schedule = this.config.schedules.find(s => s.name === scheduleName);
    if (!schedule || !schedule.enabled) {
      console.log(`❌ スケジュール '${scheduleName}' が見つからないか、無効です`);
      return;
    }

    // ロックファイルチェック（重複実行防止）
    if (await this.isLocked()) {
      console.log('🔒 他のスクレイピング処理が実行中のため、スキップします');
      return;
    }

    try {
      // ロック作成
      await this.createLock(schedule.name);

      console.log(`🚀 スケジュール実行開始: ${schedule.name}`);
      console.log(`📝 ${schedule.description}`);

      // スクレイピング実行
      const scraper = new AutomatedScraper({
        ...schedule.config,
        notificationWebhook: this.config.webhookUrl,
      });

      const result = await scraper.run();

      // 結果をログ出力
      const status = result.success ? '✅ 成功' : '❌ 失敗';
      console.log(`${status}: ${schedule.name} - ${result.itemsProcessed}件処理`);

      if (result.errors.length > 0) {
        console.error('エラー一覧:', result.errors);
      }

    } catch (error) {
      console.error(`❌ スケジュール実行失敗 [${schedule.name}]:`, error);
    } finally {
      // ロック解除
      await this.removeLock();
    }
  }

  private async isLocked(): Promise<boolean> {
    try {
      await fs.access(this.config.lockfile);
      
      // ロックファイルが古い場合（1時間以上）は削除
      const stat = await fs.stat(this.config.lockfile);
      const ageMs = Date.now() - stat.mtime.getTime();
      if (ageMs > 60 * 60 * 1000) { // 1時間
        await this.removeLock();
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  private async createLock(taskName: string): Promise<void> {
    const lockData = {
      task: taskName,
      pid: process.pid,
      started_at: new Date().toISOString(),
    };
    
    await fs.writeFile(this.config.lockfile, JSON.stringify(lockData, null, 2));
  }

  private async removeLock(): Promise<void> {
    try {
      await fs.unlink(this.config.lockfile);
    } catch {
      // ロックファイルが存在しない場合は無視
    }
  }

  private generateCrontabEntries(): void {
    const scriptPath = path.resolve(__dirname, 'run-scheduled-scraping.sh');
    
    this.config.schedules
      .filter(s => s.enabled)
      .forEach(schedule => {
        console.log(`${schedule.cron} cd /home/mizu/baseball-ai-media && npm run scrape:${schedule.name} >> logs/cron.log 2>&1`);
      });

    console.log('\n📜 package.jsonに追加するスクリプト:');
    this.config.schedules
      .filter(s => s.enabled)
      .forEach(schedule => {
        const configArgs = Object.entries(schedule.config)
          .map(([key, value]) => `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}=${value}`)
          .join(' ');
        
        console.log(`    "scrape:${schedule.name}": "npx tsx scripts/automated-scraper.ts ${configArgs}",`);
      });
  }

  private isBaseballSeason(): boolean {
    const month = new Date().getMonth() + 1; // 1-12
    return month >= 3 && month <= 11; // 3月-11月
  }

  // 手動実行用メソッド
  async runNow(scheduleName?: string): Promise<void> {
    if (scheduleName) {
      await this.runScheduledTask(scheduleName);
    } else {
      // 現在時刻に最も適したスケジュールを実行
      const hour = new Date().getHours();
      
      if (hour >= 6 && hour < 12) {
        await this.runScheduledTask('morning-update');
      } else if (hour >= 12 && hour < 18) {
        await this.runScheduledTask('afternoon-starters');
      } else if (hour >= 18 && hour < 23) {
        await this.runScheduledTask('evening-results');
      } else {
        await this.runScheduledTask('night-detailed');
      }
    }
  }
}

// CLI実行時の処理
async function main() {
  const args = process.argv.slice(2);
  const scheduler = new CronScheduler();

  if (args.includes('--start')) {
    await scheduler.start();
  } else if (args.includes('--run-now')) {
    const taskName = args[args.indexOf('--run-now') + 1];
    await scheduler.runNow(taskName);
  } else if (args.includes('--test-run')) {
    console.log('🧪 テスト実行モード');
    await scheduler.runNow('morning-update');
  } else {
    console.log('NPB自動スクレイピング スケジューラー');
    console.log('');
    console.log('使用方法:');
    console.log('  --start        スケジューラー開始（設定表示）');
    console.log('  --run-now      今すぐ実行（時間帯に応じた処理）');
    console.log('  --run-now <task>  指定タスクを今すぐ実行');
    console.log('  --test-run     テスト実行');
    console.log('');
    console.log('利用可能なタスク: morning-update, afternoon-starters, evening-results, night-detailed');
  }
}

// スクリプトとして直接実行された場合
if (require.main === module) {
  main().catch(console.error);
}

export { CronScheduler };