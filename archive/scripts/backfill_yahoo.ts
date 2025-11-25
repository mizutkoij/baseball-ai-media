#!/usr/bin/env npx tsx
/**
 * Yahoo! バックフィルスクリプト
 * 過去データの安全取得 (30s間隔, 進捗再開可能)
 */

import { YahooNPB1Connector } from '../lib/connectors/yahoo-ichigun';
import { YahooNPB2Connector } from '../lib/connectors/yahoo-farm';
import { promises as fs } from 'fs';
import * as path from 'path';

interface BackfillConfig {
  level: 'npb1' | 'npb2' | 'both';
  farmLeague?: 'EAST' | 'WEST' | 'both';
  fromDate: string;
  toDate?: string;
  sleepMs: number;
  contactEmail: string;
  resumeFile: string;
  maxRetries: number;
  batchSize: number;
}

interface BackfillProgress {
  currentDate: string;
  completedGames: string[];
  failedGames: { gameId: string; error: string; retryCount: number }[];
  statistics: {
    totalGames: number;
    completedGames: number;
    failedGames: number;
    totalPitches: number;
    startTime: string;
    lastUpdate: string;
  };
}

const DEFAULT_CONFIG: Partial<BackfillConfig> = {
  sleepMs: 30000,           // 30秒間隔
  contactEmail: 'contact@example.com',
  maxRetries: 3,
  batchSize: 5,             // 1日最大5試合まで
  resumeFile: 'data/backfill/progress.json'
};

export class YahooBackfillManager {
  private npb1Connector: YahooNPB1Connector;
  private npb2Connector: YahooNPB2Connector;
  private config: BackfillConfig;
  private progress: BackfillProgress;
  private isRunning = false;
  
  constructor(config: Partial<BackfillConfig> & { fromDate: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as BackfillConfig;
    this.npb1Connector = new YahooNPB1Connector(this.config.contactEmail);
    this.npb2Connector = new YahooNPB2Connector(this.config.contactEmail);
    
    // 初期進捗状態
    this.progress = {
      currentDate: this.config.fromDate,
      completedGames: [],
      failedGames: [],
      statistics: {
        totalGames: 0,
        completedGames: 0,
        failedGames: 0,
        totalPitches: 0,
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
      }
    };
    
    // 進捗ディレクトリ作成
    fs.mkdir(path.dirname(this.config.resumeFile), { recursive: true }).catch(() => {});
  }
  
  /**
   * バックフィル実行
   */
  async run(): Promise<void> {
    console.log(`🚀 Starting Yahoo backfill from ${this.config.fromDate}`);
    console.log(`Level: ${this.config.level}, Farm: ${this.config.farmLeague || 'N/A'}`);
    console.log(`Sleep: ${this.config.sleepMs}ms, Resume: ${this.config.resumeFile}`);
    
    // 進捗復旧
    await this.loadProgress();
    
    this.isRunning = true;
    const endDate = this.config.toDate || new Date().toISOString().split('T')[0];
    
    let currentDate = this.progress.currentDate;
    
    while (this.isRunning && currentDate <= endDate) {
      console.log(`\n📅 Processing ${currentDate}...`);
      
      try {
        await this.processDate(currentDate);
        this.progress.currentDate = this.getNextDate(currentDate);
        currentDate = this.progress.currentDate;
        
        // 進捗保存
        await this.saveProgress();
        
        // 日付間の大きな休憩
        if (this.isRunning && currentDate <= endDate) {
          console.log(`😴 Sleeping ${this.config.sleepMs}ms before next date...`);
          await this.sleep(this.config.sleepMs);
        }
        
      } catch (error) {
        console.error(`Failed to process ${currentDate}:`, error);
        
        // 日付レベルの失敗は次の日に進む
        this.progress.currentDate = this.getNextDate(currentDate);
        currentDate = this.progress.currentDate;
        await this.saveProgress();
      }
    }
    
    console.log('🏁 Backfill completed');
    this.printSummary();
  }
  
  /**
   * 日付単位の処理
   */
  private async processDate(date: string): Promise<void> {
    const games = await this.discoverGamesForDate(date);
    
    if (games.length === 0) {
      console.log(`  📭 No games found for ${date}`);
      return;
    }
    
    console.log(`  📋 Found ${games.length} games for ${date}`);
    this.progress.statistics.totalGames += games.length;
    
    // バッチ処理
    for (let i = 0; i < games.length; i += this.config.batchSize) {
      const batch = games.slice(i, i + this.config.batchSize);
      
      console.log(`  🔄 Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(games.length / this.config.batchSize)}`);
      
      for (const game of batch) {
        if (!this.isRunning) break;
        
        const gameKey = `${game.level}_${game.gameId}`;
        
        // 既に完了済みかチェック
        if (this.progress.completedGames.includes(gameKey)) {
          console.log(`  ⏭️  Skipping completed game ${gameKey}`);
          continue;
        }
        
        await this.processGame(game);
        
        // ゲーム間の小休憩
        if (this.isRunning) {
          await this.sleep(Math.min(this.config.sleepMs / 2, 15000)); // 最大15秒
        }
      }
    }
  }
  
  /**
   * 試合発見
   */
  private async discoverGamesForDate(date: string): Promise<Array<{level: string, gameId: string, farmLeague?: 'EAST' | 'WEST'}>> {
    const games: Array<{level: string, gameId: string, farmLeague?: 'EAST' | 'WEST'}> = [];
    
    try {
      // NPB1
      if (this.config.level === 'npb1' || this.config.level === 'both') {
        const npb1Games = await this.npb1Connector.getGamesForDate(date);
        games.push(...npb1Games.map(g => ({ level: 'NPB1', gameId: g.gameId })));
      }
      
      // NPB2
      if (this.config.level === 'npb2' || this.config.level === 'both') {
        const farmLeagues: ('EAST' | 'WEST')[] = [];
        
        if (this.config.farmLeague === 'both' || !this.config.farmLeague) {
          farmLeagues.push('EAST', 'WEST');
        } else {
          farmLeagues.push(this.config.farmLeague);
        }
        
        for (const league of farmLeagues) {
          const npb2Games = await this.npb2Connector.getFarmGamesForDate(date, league);
          games.push(...npb2Games.map(g => ({ 
            level: 'NPB2', 
            gameId: g.gameId, 
            farmLeague: g.farmLeague 
          })));
        }
      }
      
    } catch (error) {
      console.error(`Failed to discover games for ${date}:`, error);
    }
    
    return games;
  }
  
  /**
   * 個別試合処理
   */
  private async processGame(game: {level: string, gameId: string, farmLeague?: 'EAST' | 'WEST'}): Promise<void> {
    const gameKey = `${game.level}_${game.gameId}`;
    
    // 失敗履歴チェック
    const existingFailure = this.progress.failedGames.find(f => f.gameId === gameKey);
    if (existingFailure && existingFailure.retryCount >= this.config.maxRetries) {
      console.log(`  ❌ Skipping ${gameKey} (max retries exceeded)`);
      return;
    }
    
    try {
      console.log(`  🎯 Processing ${gameKey}...`);
      
      let totalPitches = 0;
      
      if (game.level === 'NPB1') {
        // NPB1 処理
        const indexes = await this.npb1Connector.getValidIndexes(game.gameId);
        
        for (const index of indexes) {
          const result = await this.npb1Connector.ingestPitchData(game.gameId, index, 'high');
          totalPitches += result.totalRows;
          
          // インデックス間の小休憩
          if (indexes.length > 1) {
            await this.sleep(2000); // 2秒
          }
        }
        
      } else if (game.level === 'NPB2' && game.farmLeague) {
        // NPB2 処理
        const result = await this.npb2Connector.ingestFarmPitchData(
          game.gameId, '1', game.farmLeague, 'medium'
        );
        totalPitches += result.totalRows;
      }
      
      // 成功記録
      this.progress.completedGames.push(gameKey);
      this.progress.statistics.completedGames += 1;
      this.progress.statistics.totalPitches += totalPitches;
      
      // 失敗履歴から削除
      this.progress.failedGames = this.progress.failedGames.filter(f => f.gameId !== gameKey);
      
      console.log(`  ✅ Completed ${gameKey} (${totalPitches} pitches)`);
      
    } catch (error) {
      console.error(`  ❌ Failed ${gameKey}:`, error);
      
      // 失敗記録
      const existingFailure = this.progress.failedGames.find(f => f.gameId === gameKey);
      if (existingFailure) {
        existingFailure.retryCount += 1;
        existingFailure.error = String(error);
      } else {
        this.progress.failedGames.push({
          gameId: gameKey,
          error: String(error),
          retryCount: 1
        });
      }
      
      this.progress.statistics.failedGames += 1;
    } finally {
      this.progress.statistics.lastUpdate = new Date().toISOString();
    }
  }
  
  /**
   * 進捗読み込み
   */
  private async loadProgress(): Promise<void> {
    try {
      if (await this.fileExists(this.config.resumeFile)) {
        const data = await fs.readFile(this.config.resumeFile, 'utf-8');
        const saved = JSON.parse(data);
        
        // 設定が変わっていなければ復旧
        if (saved.config?.fromDate === this.config.fromDate && 
            saved.config?.level === this.config.level) {
          this.progress = saved.progress;
          console.log(`📁 Resumed from ${this.progress.currentDate} (${this.progress.completedGames.length} games completed)`);
        } else {
          console.log('🆕 Configuration changed, starting fresh');
        }
      }
    } catch (error) {
      console.warn('Failed to load progress, starting fresh:', error);
    }
  }
  
  /**
   * 進捗保存
   */
  private async saveProgress(): Promise<void> {
    try {
      const data = {
        config: {
          fromDate: this.config.fromDate,
          level: this.config.level,
          farmLeague: this.config.farmLeague
        },
        progress: this.progress,
        savedAt: new Date().toISOString()
      };
      
      await fs.writeFile(this.config.resumeFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to save progress:', error);
    }
  }
  
  /**
   * ユーティリティ
   */
  private getNextDate(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  stop(): void {
    console.log('\n🛑 Stopping backfill...');
    this.isRunning = false;
  }
  
  private printSummary(): void {
    const stats = this.progress.statistics;
    const duration = new Date().getTime() - new Date(stats.startTime).getTime();
    
    console.log('\n📊 Backfill Summary:');
    console.log(`  Duration: ${Math.round(duration / 1000 / 60)} minutes`);
    console.log(`  Total games: ${stats.totalGames}`);
    console.log(`  Completed: ${stats.completedGames}`);
    console.log(`  Failed: ${stats.failedGames}`);
    console.log(`  Total pitches: ${stats.totalPitches}`);
    console.log(`  Success rate: ${(stats.completedGames / stats.totalGames * 100).toFixed(1)}%`);
    
    if (this.progress.failedGames.length > 0) {
      console.log(`\n❌ Failed games:`);
      this.progress.failedGames.forEach(f => {
        console.log(`  ${f.gameId}: ${f.error} (${f.retryCount} retries)`);
      });
    }
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Yahoo Backfill Usage:
  npm run backfill:yahoo -- --from 2022-01-01 [--to 2022-12-31] [--level npb1|npb2|both] [--farm-league EAST|WEST|both] [--sleep 30000]
  
Options:
  --from DATE         Start date (required)
  --to DATE           End date (default: today)
  --level LEVEL       npb1, npb2, or both (default: both)
  --farm-league LEAGUE EAST, WEST, or both for NPB2 (default: both)
  --sleep MS          Sleep between requests in ms (default: 30000)
  --resume FILE       Progress file path (default: data/backfill/progress.json)
  --contact EMAIL     Contact email (default: env CONTACT_EMAIL)
    `);
    return;
  }
  
  const parseArg = (flag: string, defaultValue?: string): string | undefined => {
    const index = args.findIndex(arg => arg === flag);
    return index !== -1 && index + 1 < args.length ? args[index + 1] : defaultValue;
  };
  
  const fromDate = parseArg('--from');
  if (!fromDate) {
    console.error('❌ --from date is required');
    process.exit(1);
  }
  
  const config: Partial<BackfillConfig> & { fromDate: string } = {
    fromDate,
    toDate: parseArg('--to'),
    level: parseArg('--level', 'both') as 'npb1' | 'npb2' | 'both',
    farmLeague: parseArg('--farm-league', 'both') as 'EAST' | 'WEST' | 'both',
    sleepMs: parseInt(parseArg('--sleep', '30000') || '30000'),
    resumeFile: parseArg('--resume', 'data/backfill/progress.json'),
    contactEmail: parseArg('--contact') || process.env.CONTACT_EMAIL || 'contact@example.com'
  };
  
  console.log('Yahoo Backfill Configuration:', config);
  
  const manager = new YahooBackfillManager(config);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    manager.stop();
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    manager.stop();
  });
  
  try {
    await manager.run();
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}