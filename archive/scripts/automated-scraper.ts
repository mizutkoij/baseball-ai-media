#!/usr/bin/env npx tsx

/**
 * NPB自動スクレイピングシステム
 * 
 * 機能:
 * - 日程・結果の自動取得
 * - 予告先発の自動取得
 * - 試合詳細データの自動取得
 * - データベース自動更新
 * - エラーハンドリング・通知
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

// 統一型定義をインポート
import type { 
  StarterRecord,
  GameData
} from '../lib/schemas';

// 既存のスクレイパーをインポート  
// import { scrapeNPBStarters } from '../lib/npb-starters-scraper'; // TODO: Fix Cheerio types
import { NPBDataValidator } from '../lib/data-validator';

// Phase 4: カノニカルシステム統合
import { persistStarters, persistGames, persistDetails } from '../lib/persist';
import { withCtx } from '../lib/logger';
import { httpClient } from '../lib/http-client';
import { scrapeJobs, scrapeLatency, itemsTotal } from '../lib/prometheus-metrics';
import { logJobEvent, generateRunId, classifyError } from '../lib/logger';
import { nanoid } from 'nanoid';

// ローカル型定義
interface DetailedGameData {
  gameId: string;
  date: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

interface ScrapingOptions {
  year: number;
  month?: number;
  includeDetails?: boolean;
  retryAttempts?: number;
  delayMs?: number;
}

interface ScrapingConfig {
  scheduleEnabled: boolean;
  startersEnabled: boolean;
  detailedEnabled: boolean;
  maxRetries: number;
  delayMs: number;
  dataDir: string;
  notificationWebhook?: string;
}

interface ScrapingResult {
  timestamp: string;
  success: boolean;
  dataTypes: string[];
  itemsProcessed: number;
  errors: string[];
  warnings: string[];
  duration: number;
}

interface LogEntry {
  level: string;
  message: string;
  [key: string]: any;
}

class AutomatedScraper {
  private config: ScrapingConfig;
  private startTime: number;
  private logger: (entry: LogEntry) => void;
  private runId: string;

  constructor(config: Partial<ScrapingConfig> = {}) {
    this.config = {
      scheduleEnabled: true,
      startersEnabled: true,
      detailedEnabled: true,
      maxRetries: 3,
      delayMs: 2000,
      dataDir: path.join(process.cwd(), 'data'),
      ...config,
    };
    this.startTime = Date.now();
    this.runId = generateRunId();
    
    // 構造化ログ設定
    this.logger = (entry: LogEntry) => {
      const timestamp = new Date().toISOString();
      console.log(JSON.stringify({ ...entry, timestamp, runId: this.runId }));
    };
  }

  async run(): Promise<ScrapingResult> {
    logJobEvent(
      { runId: this.runId, job: 'scraper' },
      'start',
      { config: this.config }
    );
    
    const result: ScrapingResult = {
      timestamp: new Date().toISOString(),
      success: true,
      dataTypes: [],
      itemsProcessed: 0,
      errors: [],
      warnings: [],
      duration: 0,
    };

    try {
      // 1. 試合日程・結果の取得
      if (this.config.scheduleEnabled) {
        await this.scrapeSchedule(result);
      }

      // 2. 予告先発の取得
      if (this.config.startersEnabled) {
        await this.scrapeStarters(result);
      }

      // 3. 試合詳細データの取得
      if (this.config.detailedEnabled) {
        await this.scrapeDetailedGames(result);
      }

      result.duration = Date.now() - this.startTime;
      
      // メトリクス記録
      scrapeJobs.inc({ job: 'scraper', result: 'success' });
      scrapeLatency.observe({ job: 'scraper' }, result.duration / 1000);
      if (result.itemsProcessed > 0) {
        itemsTotal.inc({ job: 'scraper' }, result.itemsProcessed);
      }
      
      logJobEvent(
        { runId: this.runId, job: 'scraper' },
        'success',
        { 
          duration_ms: result.duration,
          items: result.itemsProcessed,
          warn_count: result.warnings.length,
        }
      );
      
    } catch (error) {
      result.success = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
      result.duration = Date.now() - this.startTime;
      
      // エラーメトリクス
      scrapeJobs.inc({ job: 'scraper', result: 'fail' });
      scrapeLatency.observe({ job: 'scraper' }, result.duration / 1000);
      
      logJobEvent(
        { runId: this.runId, job: 'scraper' },
        'fail',
        { 
          duration_ms: result.duration,
          error: errorMsg,
          error_code: classifyError(error),
        }
      );
    }

    // 結果をログファイルに保存
    await this.saveResult(result);
    
    // 通知送信（設定されている場合）
    if (this.config.notificationWebhook) {
      await this.sendNotification(result);
    }

    return result;
  }

  private async scrapeSchedule(result: ScrapingResult): Promise<void> {
    console.log('📅 日程・結果データを取得中...');
    
    try {
      const today = new Date();
      const options: ScrapingOptions = {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        includeDetails: false,
        retryAttempts: this.config.maxRetries,
        delayMs: this.config.delayMs,
      };

      // NPB公式から今日の試合データを取得（暫定的にダミーデータ）
      const games: GameData[] = []; // 実際の実装は既存のスクレイパーを使用
      
      if (games.length > 0) {
        // Phase 4: カノニカル書き込みシステムを使用
        const writeResult = await persistGames({
          date: format(today, 'yyyy-MM-dd'),
          items: games,
          dataDir: this.config.dataDir,
          runId: this.runId,
        });

        result.dataTypes.push('schedule');
        result.itemsProcessed += writeResult.items;
        
        const actionMsg = writeResult.action === 'skip' ? 'スキップ（変更なし）' : '保存完了';
        console.log(`✅ 日程データ ${writeResult.items}件を${actionMsg}`);
        
        if (writeResult.diff && writeResult.action === 'write') {
          console.log(`   📊 追加:${writeResult.diff.added.length} 更新:${writeResult.diff.updated.length} 削除:${writeResult.diff.removed.length}`);
        }
      }
      
    } catch (error) {
      const errorMsg = `Schedule scraping failed: ${error}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  private async scrapeStarters(result: ScrapingResult): Promise<void> {
    console.log('⚾ 予告先発データを取得中...');
    
    try {
      // 今日から3日先までの予告先発を取得
      const dates = this.getUpcomingDates(3);
      
      for (const date of dates) {
        const starters = await this.fetchStartersForDate(date);
        
        if (starters.length > 0) {
          // Phase 4: カノニカル書き込みシステムを使用
          const writeResult = await persistStarters({
            date,
            items: starters,
            dataDir: this.config.dataDir,
            runId: this.runId,
          });

          result.itemsProcessed += writeResult.items;
          
          const actionMsg = writeResult.action === 'skip' ? 'スキップ（変更なし）' : '保存完了';
          console.log(`✅ ${date}の先発データ ${writeResult.items}件を${actionMsg}`);
          
          if (writeResult.diff && writeResult.action === 'write') {
            console.log(`   📊 追加:${writeResult.diff.added.length} 更新:${writeResult.diff.updated.length} 削除:${writeResult.diff.removed.length}`);
          }
          
          if (writeResult.collisions && writeResult.collisions.length > 0) {
            console.warn(`   ⚠️  キー衝突検出: ${writeResult.collisions.length}件`);
          }
        }
      }
      
      if (result.itemsProcessed > 0) {
        result.dataTypes.push('starters');
      }
      
    } catch (error) {
      const errorMsg = `Starters scraping failed: ${error}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  private async scrapeDetailedGames(result: ScrapingResult): Promise<void> {
    console.log('📊 試合詳細データを取得中...');
    
    try {
      // 今日と昨日の試合詳細を取得
      const dates = [
        format(new Date(), 'yyyy-MM-dd'),
        format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      ];

      for (const date of dates) {
        const games = await this.fetchDetailedGamesForDate(date);
        
        if (games.length > 0) {
          // Phase 4: カノニカル書き込みシステムを使用
          const writeResult = await persistDetails({
            date,
            items: games,
            dataDir: this.config.dataDir,
            runId: this.runId,
          });

          result.itemsProcessed += writeResult.items;
          
          const actionMsg = writeResult.action === 'skip' ? 'スキップ（変更なし）' : '保存完了';
          console.log(`✅ ${date}の詳細データ ${writeResult.items}件を${actionMsg}`);
          
          if (writeResult.diff && writeResult.action === 'write') {
            console.log(`   📊 追加:${writeResult.diff.added.length} 更新:${writeResult.diff.updated.length} 削除:${writeResult.diff.removed.length}`);
          }
        }
      }
      
      if (result.itemsProcessed > 0) {
        result.dataTypes.push('detailed');
      }
      
    } catch (error) {
      const errorMsg = `Detailed games scraping failed: ${error}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  private async fetchStartersForDate(date: string): Promise<StarterRecord[]> {
    try {
      // 実装済みのNPBStartersScraperを使用
      // TODO: Fix Cheerio type issues before enabling this
      const starters: StarterRecord[] = []; // await scrapeNPBStarters(date);
      
      // データ検証・正規化
      if (starters.length > 0) {
        const validator = new NPBDataValidator();
        const validationResult = await validator.validateStarters(starters);
        
        if (!validationResult.isValid) {
          console.warn(`⚠️ ${date}の先発データに問題があります:`, validationResult.errors);
        }
        
        if (validationResult.warnings.length > 0) {
          console.warn(`⚠️ ${date}の先発データの警告:`, validationResult.warnings);
        }
        
        console.log(`✅ データ品質: ${validationResult.dataQuality}`);
      }
      
      return starters;
      
    } catch (error) {
      console.error(`Failed to fetch starters for ${date}:`, error);
      return [];
    }
  }

  private async fetchDetailedGamesForDate(date: string): Promise<DetailedGameData[]> {
    // 詳細な試合データを取得
    try {
      // 既存のスクレイパーを使用（暫定的に空実装）
      const gameIds = await this.getGameIdsForDate(date);
      const games: DetailedGameData[] = [];
      
      // 実際の実装では既存のスクレイピングライブラリを使用
      console.log(`詳細データ取得予定: ${gameIds.length}件 (${date})`);
      
      for (const gameId of gameIds) {
        // レート制限対応
        await this.sleep(this.config.delayMs);
      }
      
      return games;
      
    } catch (error) {
      console.error(`Failed to fetch detailed games for ${date}:`, error);
      return [];
    }
  }

  private async getGameIdsForDate(date: string): Promise<string[]> {
    // 指定日の試合IDリストを取得
    // スケジュールデータまたはNPB公式から取得
    try {
      const scheduleFile = path.join(this.config.dataDir, 'schedule', `${date}.json`);
      const content = await fs.readFile(scheduleFile, 'utf-8');
      const data = JSON.parse(content);
      return data.games.map((g: GameData) => g.game_id);
    } catch {
      return [];
    }
  }

  private getUpcomingDates(days: number): string[] {
    const dates: string[] = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      dates.push(format(date, 'yyyy-MM-dd'));
    }
    
    return dates;
  }

  private async saveResult(result: ScrapingResult): Promise<void> {
    try {
      const logsDir = path.join(this.config.dataDir, 'logs');
      await fs.mkdir(logsDir, { recursive: true });
      
      const filename = `scraping-${format(new Date(), 'yyyy-MM-dd')}.json`;
      const filepath = path.join(logsDir, filename);
      
      // 既存のログがあれば読み込んで追記
      let logs: ScrapingResult[] = [];
      try {
        const existing = await fs.readFile(filepath, 'utf-8');
        logs = JSON.parse(existing);
      } catch {
        // ファイルが存在しない場合は新規作成
      }
      
      logs.push(result);
      await fs.writeFile(filepath, JSON.stringify(logs, null, 2));
      
    } catch (error) {
      console.error('Failed to save scraping result:', error);
    }
  }

  private async sendNotification(result: ScrapingResult): Promise<void> {
    try {
      const status = result.success ? '✅ 成功' : '❌ 失敗';
      const message = `
NPB自動スクレイピング結果

状態: ${status}
時刻: ${result.timestamp}
処理時間: ${result.duration}ms
データ種別: ${result.dataTypes.join(', ')}
処理件数: ${result.itemsProcessed}件
エラー: ${result.errors.length}件

${result.errors.length > 0 ? '\\nエラー詳細:\\n' + result.errors.join('\\n') : ''}
      `.trim();

      await fetch(this.config.notificationWebhook!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI実行時の処理
async function main() {
  const args = process.argv.slice(2);
  const options: Partial<ScrapingConfig> = {};
  
  // コマンドライン引数の解析
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    switch (key) {
      case '--schedule-only':
        options.startersEnabled = false;
        options.detailedEnabled = false;
        break;
      case '--starters-only':
        options.scheduleEnabled = false;
        options.detailedEnabled = false;
        break;
      case '--detailed-only':
        options.scheduleEnabled = false;
        options.startersEnabled = false;
        break;
      case '--webhook':
        options.notificationWebhook = value;
        break;
      case '--data-dir':
        options.dataDir = value;
        break;
    }
  }
  
  const scraper = new AutomatedScraper(options);
  const result = await scraper.run();
  
  process.exit(result.success ? 0 : 1);
}

// スクリプトとして直接実行された場合
if (require.main === module) {
  main().catch(console.error);
}

export { AutomatedScraper };
export type { ScrapingConfig, ScrapingResult };