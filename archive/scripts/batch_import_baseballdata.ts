#!/usr/bin/env npx tsx

/**
 * BaseballData.jp 量産スクレイピング・DB投入スクリプト
 * 
 * 使用方法:
 * # 特定年の全選手をスキャン・取得
 * npx tsx scripts/batch_import_baseballdata.ts --year 2020
 * 
 * # 複数年一括処理
 * npx tsx scripts/batch_import_baseballdata.ts --start-year 2020 --end-year 2023
 * 
 * # 特定選手の詳細データ取得
 * npx tsx scripts/batch_import_baseballdata.ts --player 2000056
 * 
 * # 全打席ログ取得 (重い処理)
 * npx tsx scripts/batch_import_baseballdata.ts --player 2000056 --pa-logs
 */

import fs from 'fs/promises';
import path from 'path';
import {
  BaseballDataScraper,
  fetchPlayerSeasonData,
  scanYearPlayers,
  fetchPlateAppearanceLogs,
  DATA_TABLES,
  PLAYER_ID_RANGE,
  type BaseballDataPlayer,
  type SeasonStats,
  type PitcherSeasonStats,
  type SabrEyeStats,
  type SplitMonthStats,
  type SplitVsTeamStats,
  type CourseStats,
  type PlateAppearanceLog
} from '../lib/baseballdata-scraper';

interface BatchImportConfig {
  mode: 'year-scan' | 'multi-year' | 'single-player' | 'pa-logs';
  year?: number;
  startYear?: number;
  endYear?: number;
  playerId?: string;
  outputDir: string;
  delayMs: number;
  maxConcurrent: number;
  includePALogs: boolean;
}

interface ImportResult {
  totalPlayers: number;
  successfulImports: number;
  failedImports: number;
  errors: string[];
  outputFiles: string[];
}

class BaseballDataBatchImporter {
  private config: BatchImportConfig;
  private scraper: BaseballDataScraper;
  private results: ImportResult;

  constructor(config: BatchImportConfig) {
    this.config = config;
    this.scraper = new BaseballDataScraper();
    this.results = {
      totalPlayers: 0,
      successfulImports: 0,
      failedImports: 0,
      errors: [],
      outputFiles: []
    };
  }

  async run(): Promise<ImportResult> {
    console.log('🚀 BaseballData.jp バッチインポート開始');
    console.log(`📋 設定: ${JSON.stringify(this.config, null, 2)}`);

    await this.ensureOutputDirectory();

    switch (this.config.mode) {
      case 'year-scan':
        return await this.runYearScan();
      case 'multi-year':
        return await this.runMultiYearScan();
      case 'single-player':
        return await this.runSinglePlayerImport();
      case 'pa-logs':
        return await this.runPALogsImport();
      default:
        throw new Error(`Unknown mode: ${this.config.mode}`);
    }
  }

  /**
   * 特定年の全選手スキャン・インポート
   */
  private async runYearScan(): Promise<ImportResult> {
    const { year } = this.config;
    if (!year) throw new Error('Year is required for year-scan mode');

    console.log(`🔍 ${year}年入団選手スキャン開始`);
    
    const players = await scanYearPlayers(year);
    console.log(`📊 発見した選手: ${players.length}名`);
    
    this.results.totalPlayers = players.length;

    // 選手基本情報をファイル出力
    const playersFile = await this.saveToFile(players, `players_${year}.json`);
    this.results.outputFiles.push(playersFile);

    // 各選手の詳細データを取得
    for (const player of players) {
      try {
        console.log(`📥 取得中: ${player.name} (${player.player_id})`);
        
        const playerData = await fetchPlayerSeasonData(player.player_id, year);
        
        if (playerData.seasonStats) {
          // シーズン成績
          const seasonFile = await this.saveToFile([playerData.seasonStats], 
            `season_stats_${year}_${player.player_id}.json`);
          this.results.outputFiles.push(seasonFile);
          
          // Sabrデータ
          if (playerData.sabrEye) {
            const sabrFile = await this.saveToFile([playerData.sabrEye], 
              `sabr_eye_${year}_${player.player_id}.json`);
            this.results.outputFiles.push(sabrFile);
          }
          
          // 月別成績
          if (playerData.monthlyStats && playerData.monthlyStats.length > 0) {
            const monthlyFile = await this.saveToFile(playerData.monthlyStats, 
              `split_month_${year}_${player.player_id}.json`);
            this.results.outputFiles.push(monthlyFile);
          }
          
          // 対戦別成績
          if (playerData.vsTeamStats && playerData.vsTeamStats.length > 0) {
            const vsTeamFile = await this.saveToFile(playerData.vsTeamStats, 
              `split_vs_team_${year}_${player.player_id}.json`);
            this.results.outputFiles.push(vsTeamFile);
          }
          
          // コース別成績
          if (playerData.courseStats && playerData.courseStats.length > 0) {
            const courseFile = await this.saveToFile(playerData.courseStats, 
              `course_stats_${year}_${player.player_id}.json`);
            this.results.outputFiles.push(courseFile);
          }
          
          this.results.successfulImports++;
        } else {
          this.results.failedImports++;
          this.results.errors.push(`No stats data for player ${player.player_id}`);
        }
        
        // レート制限
        await this.delay(this.config.delayMs);
        
      } catch (error) {
        console.error(`❌ エラー: ${player.name} (${player.player_id}):`, error);
        this.results.failedImports++;
        this.results.errors.push(`${player.player_id}: ${error}`);
      }
    }

    console.log(`✅ ${year}年スキャン完了: ${this.results.successfulImports}名成功, ${this.results.failedImports}名失敗`);
    return this.results;
  }

  /**
   * 複数年一括スキャン
   */
  private async runMultiYearScan(): Promise<ImportResult> {
    const { startYear, endYear } = this.config;
    if (!startYear || !endYear) throw new Error('Start year and end year are required');

    console.log(`📅 複数年スキャン: ${startYear}-${endYear}`);

    for (let year = startYear; year <= endYear; year++) {
      console.log(`\n🎯 ${year}年処理中...`);
      
      const yearConfig: BatchImportConfig = {
        ...this.config,
        mode: 'year-scan',
        year
      };
      
      const yearImporter = new BaseballDataBatchImporter(yearConfig);
      const yearResult = await yearImporter.run();
      
      // 結果をマージ
      this.results.totalPlayers += yearResult.totalPlayers;
      this.results.successfulImports += yearResult.successfulImports;
      this.results.failedImports += yearResult.failedImports;
      this.results.errors.push(...yearResult.errors);
      this.results.outputFiles.push(...yearResult.outputFiles);
      
      // 年間の休憩
      await this.delay(this.config.delayMs * 5);
    }

    console.log(`🎉 複数年スキャン完了: 合計${this.results.successfulImports}名成功`);
    return this.results;
  }

  /**
   * 個別選手の詳細データ取得
   */
  private async runSinglePlayerImport(): Promise<ImportResult> {
    const { playerId } = this.config;
    if (!playerId) throw new Error('Player ID is required for single-player mode');

    console.log(`👤 個別選手データ取得: ${playerId}`);
    
    try {
      // 現在シーズンデータ
      const currentData = await fetchPlayerSeasonData(playerId);
      
      if (currentData.player) {
        console.log(`🏷️  選手名: ${currentData.player.name}`);
        console.log(`🏢 所属: ${currentData.player.team}`);
        console.log(`📍 ポジション: ${currentData.player.position}`);
        
        // 各種データをファイル出力
        const playerFile = await this.saveToFile([currentData.player], `player_${playerId}.json`);
        this.results.outputFiles.push(playerFile);
        
        if (currentData.seasonStats) {
          const statsFile = await this.saveToFile([currentData.seasonStats], 
            `season_stats_${playerId}.json`);
          this.results.outputFiles.push(statsFile);
        }
        
        if (currentData.sabrEye) {
          const sabrFile = await this.saveToFile([currentData.sabrEye], 
            `sabr_eye_${playerId}.json`);
          this.results.outputFiles.push(sabrFile);
        }
        
        if (currentData.monthlyStats?.length) {
          const monthlyFile = await this.saveToFile(currentData.monthlyStats, 
            `split_month_${playerId}.json`);
          this.results.outputFiles.push(monthlyFile);
        }
        
        if (currentData.vsTeamStats?.length) {
          const vsTeamFile = await this.saveToFile(currentData.vsTeamStats, 
            `split_vs_team_${playerId}.json`);
          this.results.outputFiles.push(vsTeamFile);
        }
        
        if (currentData.courseStats?.length) {
          const courseFile = await this.saveToFile(currentData.courseStats, 
            `course_stats_${playerId}.json`);
          this.results.outputFiles.push(courseFile);
        }

        // キャリア成績も取得
        console.log('📈 キャリア成績取得中...');
        const careerData = await this.scraper.fetchPlayerCareerStats(playerId, 2011);
        
        if (careerData.careerData.length > 0) {
          const careerFile = await this.saveToFile(careerData.careerData, 
            `career_stats_${playerId}.json`);
          this.results.outputFiles.push(careerFile);
        }
        
        this.results.totalPlayers = 1;
        this.results.successfulImports = 1;
      }
      
    } catch (error) {
      console.error(`❌ 選手データ取得失敗: ${playerId}:`, error);
      this.results.failedImports = 1;
      this.results.errors.push(`${playerId}: ${error}`);
    }

    return this.results;
  }

  /**
   * 全打席ログ取得 (重い処理)
   */
  private async runPALogsImport(): Promise<ImportResult> {
    const { playerId } = this.config;
    if (!playerId) throw new Error('Player ID is required for PA logs mode');

    console.log(`🔥 全打席ログ取得: ${playerId} (重い処理)`);
    
    try {
      const paLogs = await fetchPlateAppearanceLogs(playerId);
      
      if (paLogs.length > 0) {
        console.log(`📊 取得した打席数: ${paLogs.length}`);
        
        const logsFile = await this.saveToFile(paLogs, `pa_logs_${playerId}.json`);
        this.results.outputFiles.push(logsFile);
        
        // 統計サマリー
        const summary = this.analyzePALogs(paLogs);
        const summaryFile = await this.saveToFile([summary], `pa_logs_summary_${playerId}.json`);
        this.results.outputFiles.push(summaryFile);
        
        this.results.totalPlayers = 1;
        this.results.successfulImports = 1;
      }
      
    } catch (error) {
      console.error(`❌ 全打席ログ取得失敗: ${playerId}:`, error);
      this.results.failedImports = 1;
      this.results.errors.push(`PA logs for ${playerId}: ${error}`);
    }

    return this.results;
  }

  /**
   * 打席ログの統計サマリーを作成
   */
  private analyzePALogs(logs: PlateAppearanceLog[]) {
    const summary = {
      total_pas: logs.length,
      outcomes: {} as Record<string, number>,
      risp_situations: 0,
      by_inning: {} as Record<number, number>,
      by_opponent: {} as Record<string, number>,
      by_count: {} as Record<string, number>
    };

    logs.forEach(log => {
      // 結果別集計
      summary.outcomes[log.outcome_type] = (summary.outcomes[log.outcome_type] || 0) + 1;
      
      // RISP状況
      if (log.risp) summary.risp_situations++;
      
      // イニング別
      summary.by_inning[log.inning] = (summary.by_inning[log.inning] || 0) + 1;
      
      // 対戦相手別
      summary.by_opponent[log.opponent] = (summary.by_opponent[log.opponent] || 0) + 1;
      
      // カウント別
      summary.by_count[log.count] = (summary.by_count[log.count] || 0) + 1;
    });

    return summary;
  }

  /**
   * データをJSONファイルに保存
   */
  private async saveToFile(data: any[], filename: string): Promise<string> {
    const filepath = path.join(this.config.outputDir, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 保存完了: ${filepath} (${data.length}件)`);
    return filepath;
  }

  /**
   * 出力ディレクトリの確認・作成
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.config.outputDir);
    } catch {
      await fs.mkdir(this.config.outputDir, { recursive: true });
      console.log(`📁 出力ディレクトリ作成: ${this.config.outputDir}`);
    }
  }

  /**
   * 遅延処理
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * コマンドライン引数の解析
 */
function parseArgs(): BatchImportConfig {
  const args = process.argv.slice(2);
  const config: BatchImportConfig = {
    mode: 'year-scan',
    outputDir: './data/baseballdata_import',
    delayMs: 1000,
    maxConcurrent: 3,
    includePALogs: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--year':
        config.mode = 'year-scan';
        config.year = parseInt(next);
        i++;
        break;
        
      case '--start-year':
        config.mode = 'multi-year';
        config.startYear = parseInt(next);
        i++;
        break;
        
      case '--end-year':
        config.endYear = parseInt(next);
        i++;
        break;
        
      case '--player':
        config.mode = 'single-player';
        config.playerId = next;
        i++;
        break;
        
      case '--pa-logs':
        if (config.mode === 'single-player') {
          config.mode = 'pa-logs';
        }
        config.includePALogs = true;
        break;
        
      case '--output-dir':
        config.outputDir = next;
        i++;
        break;
        
      case '--delay':
        config.delayMs = parseInt(next);
        i++;
        break;
        
      case '--help':
        console.log(`
BaseballData.jp バッチインポートツール

使用方法:
  npx tsx scripts/batch_import_baseballdata.ts [オプション]

オプション:
  --year YYYY              特定年の全選手をスキャン・取得
  --start-year YYYY        複数年スキャンの開始年
  --end-year YYYY          複数年スキャンの終了年
  --player PLAYER_ID       特定選手の詳細データ取得
  --pa-logs                全打席ログを取得 (--playerと併用)
  --output-dir DIR         出力ディレクトリ (デフォルト: ./data/baseballdata_import)
  --delay MS               リクエスト間隔 (デフォルト: 1000ms)
  --help                   このヘルプを表示

例:
  # 2020年入団選手の全データ取得
  npx tsx scripts/batch_import_baseballdata.ts --year 2020
  
  # 2020-2023年の全選手データ取得
  npx tsx scripts/batch_import_baseballdata.ts --start-year 2020 --end-year 2023
  
  # 特定選手の詳細データ取得
  npx tsx scripts/batch_import_baseballdata.ts --player 2000056
  
  # 全打席ログ取得 (重い処理)
  npx tsx scripts/batch_import_baseballdata.ts --player 2000056 --pa-logs
        `);
        process.exit(0);
    }
  }

  return config;
}

/**
 * メイン実行
 */
async function main() {
  try {
    const config = parseArgs();
    const importer = new BaseballDataBatchImporter(config);
    const results = await importer.run();
    
    console.log('\n🎉 バッチインポート完了！');
    console.log('📊 結果サマリー:');
    console.log(`  総選手数: ${results.totalPlayers}`);
    console.log(`  成功: ${results.successfulImports}`);
    console.log(`  失敗: ${results.failedImports}`);
    console.log(`  出力ファイル数: ${results.outputFiles.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ エラー詳細:');
      results.errors.forEach(error => console.log(`  ${error}`));
    }
    
    console.log('\n📁 出力ファイル:');
    results.outputFiles.forEach(file => console.log(`  ${file}`));
    
    // 最終レポートをファイル出力
    const reportFile = path.join(config.outputDir, `import_report_${new Date().toISOString().slice(0, 10)}.json`);
    await fs.writeFile(reportFile, JSON.stringify(results, null, 2));
    console.log(`\n📋 レポートファイル: ${reportFile}`);
    
  } catch (error) {
    console.error('❌ バッチインポート失敗:', error);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  main();
}