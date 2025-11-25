#!/usr/bin/env node
import NPBHistoricalScraper from './scrape_npb_historical_data';
import NPBScraper from './scrape_npb_real_data';
import { promises as fs } from 'fs';
import path from 'path';

interface DataManagerOptions {
  currentYear?: number;
  historicalYears?: { start: number; end: number };
  leagues?: string[];
  skipCurrent?: boolean;
  skipHistorical?: boolean;
  export?: boolean;
}

class NPBDataManager {
  private currentYear: number;
  
  constructor() {
    this.currentYear = new Date().getFullYear();
  }

  // データディレクトリの初期化
  private async initializeDirectories(): Promise<void> {
    const dirs = [
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'data', 'exports'),
      path.join(process.cwd(), 'data', 'logs')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  // ログファイルへの出力
  private async logOperation(operation: string, result: string): Promise<void> {
    const logPath = path.join(process.cwd(), 'data', 'logs', `npb_scraping_${new Date().toISOString().slice(0, 10)}.log`);
    const logEntry = `[${new Date().toISOString()}] ${operation}: ${result}\n`;
    
    try {
      await fs.appendFile(logPath, logEntry, 'utf-8');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  // 現在年度データのスクレイピング
  async scrapeCurrentYear(year?: number): Promise<boolean> {
    const targetYear = year || this.currentYear;
    console.log(`\n🎯 Scraping current year data: ${targetYear}`);
    
    try {
      const scraper = new NPBScraper();
      await scraper.run();
      
      await this.logOperation('CURRENT_YEAR_SCRAPE', `SUCCESS: ${targetYear}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to scrape current year ${targetYear}:`, error);
      await this.logOperation('CURRENT_YEAR_SCRAPE', `FAILED: ${targetYear} - ${error}`);
      return false;
    }
  }

  // 歴史データのスクレイピング
  async scrapeHistoricalData(startYear: number, endYear: number, leagues: string[] = ['central', 'pacific']): Promise<boolean> {
    console.log(`\n📚 Scraping historical data: ${startYear}-${endYear}`);
    
    try {
      const historicalScraper = new NPBHistoricalScraper();
      await historicalScraper.run({
        startYear,
        endYear,
        leagues
      });
      
      await this.logOperation('HISTORICAL_SCRAPE', `SUCCESS: ${startYear}-${endYear}, leagues: ${leagues.join(',')}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to scrape historical data ${startYear}-${endYear}:`, error);
      await this.logOperation('HISTORICAL_SCRAPE', `FAILED: ${startYear}-${endYear} - ${error}`);
      return false;
    }
  }

  // データ統合レポート生成
  async generateDataReport(): Promise<void> {
    console.log('\n📊 Generating data report...');
    
    const reportData: any = {
      generated_at: new Date().toISOString(),
      current_year: this.currentYear,
      databases: {},
      summary: {}
    };

    // 現在年度データベースのチェック
    const currentDbPath = path.join(process.cwd(), 'data', 'db_current.db');
    try {
      const currentStats = await fs.stat(currentDbPath);
      reportData.databases.current = {
        path: currentDbPath,
        size: currentStats.size,
        modified: currentStats.mtime,
        exists: true
      };
    } catch {
      reportData.databases.current = { exists: false };
    }

    // 歴史データベースのチェック
    const historicalDbPath = path.join(process.cwd(), 'data', 'db_historical.db');
    try {
      const historicalStats = await fs.stat(historicalDbPath);
      reportData.databases.historical = {
        path: historicalDbPath,
        size: historicalStats.size,
        modified: historicalStats.mtime,
        exists: true
      };
    } catch {
      reportData.databases.historical = { exists: false };
    }

    // エクスポートディレクトリのチェック
    const exportDir = path.join(process.cwd(), 'data', 'exports');
    try {
      const exportFiles = await fs.readdir(exportDir);
      reportData.exports = exportFiles.map(file => ({
        filename: file,
        path: path.join(exportDir, file)
      }));
    } catch {
      reportData.exports = [];
    }

    // レポート保存
    const reportPath = path.join(process.cwd(), 'data', 'npb_data_report.json');
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
    
    console.log(`📋 Data report generated: ${reportPath}`);
    console.log('📊 Summary:');
    console.log(`  Current DB: ${reportData.databases.current.exists ? '✅ Available' : '❌ Missing'}`);
    console.log(`  Historical DB: ${reportData.databases.historical.exists ? '✅ Available' : '❌ Missing'}`);
    console.log(`  Exports: ${reportData.exports.length} files`);
  }

  // メイン管理実行
  async manage(options: DataManagerOptions = {}): Promise<void> {
    console.log('🚀 Starting NPB Data Manager...');
    
    const {
      currentYear,
      historicalYears = { start: 2020, end: 2024 },
      leagues = ['central', 'pacific'],
      skipCurrent = false,
      skipHistorical = false,
      export: shouldExport = true
    } = options;

    try {
      // ディレクトリ初期化
      await this.initializeDirectories();
      await this.logOperation('INIT', 'Data Manager started');

      let currentSuccess = true;
      let historicalSuccess = true;

      // 現在年度データスクレイピング
      if (!skipCurrent) {
        currentSuccess = await this.scrapeCurrentYear(currentYear);
        
        // 現在年度が失敗した場合、短時間待機してリトライ
        if (!currentSuccess) {
          console.log('⏳ Retrying current year scraping in 30 seconds...');
          await new Promise(resolve => setTimeout(resolve, 30000));
          currentSuccess = await this.scrapeCurrentYear(currentYear);
        }
      } else {
        console.log('⏭️  Skipping current year scraping');
      }

      // 歴史データスクレイピング
      if (!skipHistorical) {
        historicalSuccess = await this.scrapeHistoricalData(
          historicalYears.start,
          historicalYears.end,
          leagues
        );
      } else {
        console.log('⏭️  Skipping historical data scraping');
      }

      // レポート生成
      if (shouldExport) {
        await this.generateDataReport();
      }

      // 結果サマリー
      console.log('\n🎯 NPB Data Manager Summary:');
      console.log(`  Current Year (${currentYear || this.currentYear}): ${currentSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`  Historical (${historicalYears.start}-${historicalYears.end}): ${historicalSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);

      if (currentSuccess && historicalSuccess) {
        console.log('🎉 All data collection completed successfully!');
        await this.logOperation('COMPLETE', 'All operations successful');
      } else {
        console.log('⚠️  Some operations failed. Check logs for details.');
        await this.logOperation('COMPLETE', 'Some operations failed');
      }

    } catch (error) {
      console.error('❌ NPB Data Manager failed:', error);
      await this.logOperation('ERROR', `Manager failed: ${error}`);
      throw error;
    }
  }

  // クイックセットアップ（最近5年間データ）
  async quickSetup(): Promise<void> {
    const currentYear = new Date().getFullYear();
    await this.manage({
      currentYear,
      historicalYears: { start: currentYear - 4, end: currentYear - 1 },
      leagues: ['central', 'pacific'],
      skipCurrent: false,
      skipHistorical: false,
      export: true
    });
  }

  // フル歴史データセットアップ（2015年以降）
  async fullHistoricalSetup(): Promise<void> {
    const currentYear = new Date().getFullYear();
    await this.manage({
      currentYear,
      historicalYears: { start: 2015, end: currentYear - 1 },
      leagues: ['central', 'pacific'],
      skipCurrent: false,
      skipHistorical: false,
      export: true
    });
  }
}

// スクリプト実行（コマンドライン対応）
if (require.main === module) {
  const args = process.argv.slice(2);
  const manager = new NPBDataManager();

  // コマンド判定
  if (args.includes('--quick')) {
    console.log('🚀 Running quick setup (recent 5 years)...');
    manager.quickSetup().catch(console.error);
  } else if (args.includes('--full')) {
    console.log('🚀 Running full historical setup (2015+)...');
    manager.fullHistoricalSetup().catch(console.error);
  } else if (args.includes('--current-only')) {
    manager.manage({ skipHistorical: true }).catch(console.error);
  } else if (args.includes('--historical-only')) {
    // カスタム年度範囲の解析
    let startYear = 2020;
    let endYear = 2024;
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--start' && i + 1 < args.length) {
        startYear = parseInt(args[i + 1]);
        i++;
      } else if (args[i] === '--end' && i + 1 < args.length) {
        endYear = parseInt(args[i + 1]);
        i++;
      }
    }
    
    manager.manage({ 
      skipCurrent: true,
      historicalYears: { start: startYear, end: endYear }
    }).catch(console.error);
  } else {
    // デフォルト：両方実行
    manager.manage().catch(console.error);
  }
}

export default NPBDataManager;