#!/usr/bin/env npx tsx

/**
 * BaseballData.jp 2011年以降プレイヤーデータ効率的バッチ処理
 * 
 * 重要制約:
 * - BaseballData.jpは2011年以降のデータのみ保持
 * - 2011年以前入団選手は現役時のみデータ存在
 * 
 * このスクリプトは効率的に2011-2025年入団選手をスクレイピング
 * 
 * 使用方法:
 * npx tsx scripts/batch_import_baseballdata_2011_plus.ts --start-year 2011 --end-year 2025
 * npx tsx scripts/batch_import_baseballdata_2011_plus.ts --year 2020
 * npx tsx scripts/batch_import_baseballdata_2011_plus.ts --mode discover-all
 */

import fs from 'fs/promises';
import path from 'path';
import { BaseballDataScraper, BaseballDataPlayer } from '../lib/baseballdata-scraper';

interface BatchProcessingOptions {
  startYear?: number;
  endYear?: number;
  year?: number;
  mode: 'single-year' | 'multi-year' | 'discover-all';
  outputDir: string;
  maxPlayersPerYear?: number;
}

class BaseballDataBatchProcessor2011Plus {
  private scraper: BaseballDataScraper;
  
  constructor() {
    this.scraper = new BaseballDataScraper();
  }

  /**
   * 2011年以降の効率的なプレイヤー発見
   * 各年ごとに最大200名まで検索
   */
  async discoverPlayersForYear(year: number): Promise<BaseballDataPlayer[]> {
    console.log(`🔍 ${year}年入団選手検索開始 (BaseballData.jp 2011+ 対応)`);
    
    if (year < 2011) {
      console.log(`⚠️  警告: ${year}年は2011年以前です。データが限定的な可能性があります`);
    }
    
    const discoveredPlayers: BaseballDataPlayer[] = [];
    const maxSearchAttempts = 200; // 各年最大200名検索
    let consecutiveNotFound = 0;
    const maxConsecutiveNotFound = 20; // 連続20名見つからなければ停止
    
    for (let sequence = 1; sequence <= maxSearchAttempts; sequence++) {
      const playerId = `${year}${sequence.toString().padStart(3, '0')}`;
      
      try {
        console.log(`  📊 検索中: ${playerId}`);
        const player = await this.scraper.discoverPlayer(playerId);
        
        if (player) {
          discoveredPlayers.push(player);
          consecutiveNotFound = 0;
          console.log(`  ✅ 発見: ${player.name} (${player.player_id})`);
        } else {
          consecutiveNotFound++;
          if (consecutiveNotFound >= maxConsecutiveNotFound) {
            console.log(`  🛑 ${maxConsecutiveNotFound}名連続で見つからないため検索終了`);
            break;
          }
        }
        
        // レート制限
        await this.delay(1000);
        
      } catch (error) {
        console.error(`  ❌ エラー (${playerId}):`, error);
        consecutiveNotFound++;
        
        if (consecutiveNotFound >= maxConsecutiveNotFound) {
          console.log(`  🛑 エラー多発のため検索終了`);
          break;
        }
      }
    }
    
    console.log(`📈 ${year}年発見結果: ${discoveredPlayers.length}名`);
    return discoveredPlayers;
  }

  /**
   * 複数年の効率的一括発見処理
   */
  async discoverPlayersMultiYear(startYear: number, endYear: number, outputDir: string): Promise<void> {
    console.log(`🚀 ${startYear}-${endYear}年一括選手発見開始`);
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const totalStats = {
      years_processed: 0,
      total_players: 0,
      yearly_breakdown: {} as Record<number, number>
    };
    
    for (let year = startYear; year <= endYear; year++) {
      const yearOutputDir = path.join(outputDir, `baseballdata_${year}`);
      await fs.mkdir(yearOutputDir, { recursive: true });
      
      const players = await this.discoverPlayersForYear(year);
      
      if (players.length > 0) {
        const playersFile = path.join(yearOutputDir, `players_${year}.json`);
        await fs.writeFile(playersFile, JSON.stringify(players, null, 2), 'utf-8');
        
        console.log(`💾 保存完了: ${playersFile}`);
      }
      
      totalStats.years_processed++;
      totalStats.total_players += players.length;
      totalStats.yearly_breakdown[year] = players.length;
      
      console.log(`✅ ${year}年完了: ${players.length}名\\n`);
      
      // 年度間の間隔
      await this.delay(2000);
    }
    
    // 全体サマリー保存
    const summaryFile = path.join(outputDir, 'discovery_summary.json');
    const summary = {
      ...totalStats,
      period: `${startYear}-${endYear}`,
      generated_at: new Date().toISOString(),
      data_source: 'baseballdata.jp',
      constraint_note: '2011年以降のデータのみ。2011年以前入団選手は現役時のみ存在'
    };
    
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
    
    console.log(`\\n🎉 全期間発見完了!`);
    console.log(`📊 総計: ${totalStats.total_players}名 (${totalStats.years_processed}年間)`);
    console.log(`📁 出力先: ${outputDir}`);
    console.log(`📋 サマリー: ${summaryFile}`);
  }

  /**
   * 単一年度処理
   */
  async processSingleYear(year: number, outputDir: string): Promise<void> {
    console.log(`🎯 ${year}年単独処理開始`);
    
    const yearOutputDir = path.join(outputDir, `baseballdata_${year}`);
    await fs.mkdir(yearOutputDir, { recursive: true });
    
    const players = await this.discoverPlayersForYear(year);
    
    if (players.length > 0) {
      const playersFile = path.join(yearOutputDir, `players_${year}.json`);
      await fs.writeFile(playersFile, JSON.stringify(players, null, 2), 'utf-8');
      
      const report = {
        year,
        players_found: players.length,
        generated_at: new Date().toISOString(),
        output_file: playersFile
      };
      
      const reportFile = path.join(yearOutputDir, `report_${year}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf-8');
      
      console.log(`💾 保存完了: ${players.length}名`);
      console.log(`📁 ファイル: ${playersFile}`);
      console.log(`📋 レポート: ${reportFile}`);
    } else {
      console.log(`⚠️  ${year}年のプレイヤーが見つかりませんでした`);
    }
  }

  /**
   * 2011-2025年全体の自動発見モード
   */
  async discoverAllMode(outputDir: string): Promise<void> {
    console.log('🌟 2011-2025年全選手自動発見モード');
    console.log('⚡ BaseballData.jpデータ制約に最適化された効率処理');
    
    await this.discoverPlayersMultiYear(2011, 2025, outputDir);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * コマンドライン引数解析
 */
function parseArgs(): BatchProcessingOptions {
  const args = process.argv.slice(2);
  let startYear: number | undefined;
  let endYear: number | undefined;
  let year: number | undefined;
  let mode: BatchProcessingOptions['mode'] = 'single-year';
  let outputDir = './data/baseballdata_2011_plus';
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--start-year':
        startYear = parseInt(args[i + 1]);
        mode = 'multi-year';
        i++;
        break;
      case '--end-year':
        endYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--year':
        year = parseInt(args[i + 1]);
        mode = 'single-year';
        i++;
        break;
      case '--output-dir':
        outputDir = args[i + 1];
        i++;
        break;
      case '--mode':
        if (args[i + 1] === 'discover-all') {
          mode = 'discover-all';
        }
        i++;
        break;
      case '--help':
        console.log(`
BaseballData.jp 2011年以降効率的バッチ処理

⚠️  重要制約:
  - BaseballData.jpは2011年以降のデータのみ保持
  - 2011年以前の入団選手は現役時のみデータ存在

使用方法:
  # 推奨: 2011-2025年全選手自動発見
  npx tsx scripts/batch_import_baseballdata_2011_plus.ts --mode discover-all
  
  # 効率的な期間指定
  npx tsx scripts/batch_import_baseballdata_2011_plus.ts --start-year 2011 --end-year 2025
  
  # 単一年度
  npx tsx scripts/batch_import_baseballdata_2011_plus.ts --year 2020

オプション:
  --output-dir DIR    出力ディレクトリ (デフォルト: ./data/baseballdata_2011_plus)

例:
  npx tsx scripts/batch_import_baseballdata_2011_plus.ts --mode discover-all
  npx tsx scripts/batch_import_baseballdata_2011_plus.ts --start-year 2015 --end-year 2025
        `);
        process.exit(0);
    }
  }
  
  return { startYear, endYear, year, mode, outputDir };
}

/**
 * メイン実行
 */
async function main() {
  try {
    const options = parseArgs();
    const processor = new BaseballDataBatchProcessor2011Plus();
    
    console.log('🚀 BaseballData.jp 2011+ 効率的バッチ処理開始');
    console.log(`📁 出力先: ${options.outputDir}`);
    
    switch (options.mode) {
      case 'discover-all':
        await processor.discoverAllMode(options.outputDir);
        break;
        
      case 'multi-year':
        if (!options.startYear || !options.endYear) {
          throw new Error('複数年処理には --start-year と --end-year が必要です');
        }
        await processor.discoverPlayersMultiYear(options.startYear, options.endYear, options.outputDir);
        break;
        
      case 'single-year':
        if (!options.year) {
          throw new Error('単一年処理には --year が必要です');
        }
        await processor.processSingleYear(options.year, options.outputDir);
        break;
    }
    
    console.log('\\n🎯 処理完了!');
    
  } catch (error) {
    console.error('❌ バッチ処理中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}