#!/usr/bin/env npx tsx

/**
 * 2021-2025年入団選手の効率的バッチスクレイピング
 * 正しいID構造: 入団年-1 + 連番
 */

import fs from 'fs/promises';
import path from 'path';
import { BaseballDataScraper, BaseballDataPlayer } from '../lib/baseballdata-scraper';

interface ModernScrapingOptions {
  startEntryYear?: number;
  endEntryYear?: number;
  entryYear?: number;
  maxPlayersPerYear?: number;
  outputDir: string;
}

class ModernPlayerScraper {
  private scraper: BaseballDataScraper;
  
  constructor() {
    this.scraper = new BaseballDataScraper();
  }

  /**
   * 入団年からプレイヤーIDを生成
   */
  generatePlayerIds(entryYear: number, maxPlayers: number = 200): string[] {
    const entryYearMinus1 = entryYear - 2001; // 2021 → 20, 2020 → 19
    const ids: string[] = [];
    
    for (let i = 1; i <= maxPlayers; i++) {
      const sequence = i.toString().padStart(5, '0'); // 00001, 00002...
      const playerId = `${entryYearMinus1}${sequence}`;
      ids.push(playerId);
    }
    
    return ids;
  }

  /**
   * 指定入団年の選手を効率的に発見
   */
  async discoverPlayersForEntryYear(entryYear: number, maxPlayers: number = 200): Promise<BaseballDataPlayer[]> {
    console.log(`🔍 ${entryYear}年入団選手検索開始`);
    
    const playerIds = this.generatePlayerIds(entryYear, maxPlayers);
    const discoveredPlayers: BaseballDataPlayer[] = [];
    let consecutiveNotFound = 0;
    const maxConsecutiveNotFound = 30; // 連続30名未発見で終了
    
    for (const [index, playerId] of playerIds.entries()) {
      try {
        console.log(`  📊 検索: ${playerId} (${index + 1}/${maxPlayers})`);
        
        const player = await this.scraper.discoverPlayer(playerId);
        
        if (player) {
          discoveredPlayers.push(player);
          consecutiveNotFound = 0;
          console.log(`    ✅ 発見: ${this.cleanPlayerName(player.name)} (${player.team || 'チーム不明'})`);
        } else {
          consecutiveNotFound++;
          if (consecutiveNotFound >= maxConsecutiveNotFound) {
            console.log(`    🛑 ${maxConsecutiveNotFound}名連続未発見のため検索終了`);
            break;
          }
        }
        
        // レート制限（respectful scraping）
        await this.delay(1200);
        
      } catch (error) {
        console.error(`    ❌ エラー (${playerId}):`, error);
        consecutiveNotFound++;
        
        if (consecutiveNotFound >= maxConsecutiveNotFound) {
          console.log(`    🛑 エラー多発のため検索終了`);
          break;
        }
        
        await this.delay(2000);
      }
    }
    
    console.log(`📈 ${entryYear}年入団選手発見: ${discoveredPlayers.length}名`);
    return discoveredPlayers;
  }

  /**
   * 複数年の一括処理
   */
  async processMultipleYears(startYear: number, endYear: number, outputDir: string, maxPerYear: number = 200): Promise<void> {
    console.log(`🚀 ${startYear}-${endYear}年入団選手一括スクレイピング開始`);
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const totalStats = {
      years_processed: 0,
      total_players: 0,
      yearly_breakdown: {} as Record<number, number>
    };
    
    for (let entryYear = startYear; entryYear <= endYear; entryYear++) {
      console.log(`\\n--- ${entryYear}年入団選手処理開始 ---`);
      
      const yearOutputDir = path.join(outputDir, `entry_year_${entryYear}`);
      await fs.mkdir(yearOutputDir, { recursive: true });
      
      const players = await this.discoverPlayersForEntryYear(entryYear, maxPerYear);
      
      if (players.length > 0) {
        // プレイヤーデータ保存
        const playersFile = path.join(yearOutputDir, `players_${entryYear}.json`);
        await fs.writeFile(playersFile, JSON.stringify(players, null, 2), 'utf-8');
        
        // サマリー保存
        const summary = {
          entry_year: entryYear,
          players_found: players.length,
          players: players.map(p => ({
            id: p.player_id,
            name: this.cleanPlayerName(p.name),
            team: p.team,
            type: p.player_type,
            position: p.position
          }))
        };
        
        const summaryFile = path.join(yearOutputDir, `summary_${entryYear}.json`);
        await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
        
        console.log(`💾 保存完了: ${players.length}名 → ${playersFile}`);
      } else {
        console.log(`⚠️  ${entryYear}年: 選手が見つかりませんでした`);
      }
      
      totalStats.years_processed++;
      totalStats.total_players += players.length;
      totalStats.yearly_breakdown[entryYear] = players.length;
      
      console.log(`✅ ${entryYear}年完了\\n`);
      
      // 年度間の間隔
      await this.delay(3000);
    }
    
    // 全体サマリー保存
    const overallSummary = {
      ...totalStats,
      period: `${startYear}-${endYear}`,
      generated_at: new Date().toISOString(),
      data_source: 'baseballdata.jp (modern players)',
      id_structure: '入団年-1 + 連番 (例: 2000001 = 2021年入団1番目)'
    };
    
    const summaryFile = path.join(outputDir, 'overall_summary.json');
    await fs.writeFile(summaryFile, JSON.stringify(overallSummary, null, 2), 'utf-8');
    
    console.log(`\\n🎉 全期間処理完了!`);
    console.log(`📊 総計: ${totalStats.total_players}名 (${totalStats.years_processed}年間)`);
    console.log(`📁 出力先: ${outputDir}`);
    console.log(`📋 サマリー: ${summaryFile}`);
    
    // 年別結果表示
    console.log('\\n📈 年別発見数:');
    for (const [year, count] of Object.entries(totalStats.yearly_breakdown)) {
      if (count > 0) {
        console.log(`  ${year}年入団: ${count}名`);
      }
    }
  }

  /**
   * 単一年度処理
   */
  async processSingleYear(entryYear: number, outputDir: string, maxPlayers: number = 200): Promise<void> {
    console.log(`🎯 ${entryYear}年入団選手単独処理開始`);
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const players = await this.discoverPlayersForEntryYear(entryYear, maxPlayers);
    
    if (players.length > 0) {
      const playersFile = path.join(outputDir, `players_${entryYear}.json`);
      await fs.writeFile(playersFile, JSON.stringify(players, null, 2), 'utf-8');
      
      const report = {
        entry_year: entryYear,
        players_found: players.length,
        generated_at: new Date().toISOString(),
        max_search_attempted: maxPlayers,
        output_file: playersFile,
        players_summary: players.map(p => ({
          id: p.player_id,
          name: this.cleanPlayerName(p.name),
          team: p.team,
          type: p.player_type
        }))
      };
      
      const reportFile = path.join(outputDir, `report_${entryYear}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf-8');
      
      console.log(`\\n✅ ${entryYear}年完了: ${players.length}名発見`);
      console.log(`📁 データ: ${playersFile}`);
      console.log(`📋 レポート: ${reportFile}`);
      
    } else {
      console.log(`\\n⚠️  ${entryYear}年: 選手が見つかりませんでした`);
    }
  }

  /**
   * プレイヤー名をクリーンアップ
   */
  private cleanPlayerName(name: string): string {
    return name
      .replace(/\\d{4}年度版\\s*/, '') // 年度版を削除
      .replace(/【.*?】.*$/, '') // チーム情報以降を削除
      .trim();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * コマンドライン引数解析
 */
function parseArgs(): ModernScrapingOptions {
  const args = process.argv.slice(2);
  let startEntryYear: number | undefined;
  let endEntryYear: number | undefined;
  let entryYear: number | undefined;
  let outputDir = './data/modern_players';
  let maxPlayersPerYear = 200;
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--start-year':
        startEntryYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--end-year':
        endEntryYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--year':
        entryYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--output-dir':
        outputDir = args[i + 1];
        i++;
        break;
      case '--max-players':
        maxPlayersPerYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--help':
        console.log(`
現代選手バッチスクレイピング (2021年以降対応)

✅ 確認済み: 正しいID構造で2021年入団選手データ取得成功

使用方法:
  # 2021-2025年入団選手の一括取得 (推奨)
  npx tsx scripts/batch_import_modern_players.ts --start-year 2021 --end-year 2025
  
  # 単一年度 (例: 2021年入団)
  npx tsx scripts/batch_import_modern_players.ts --year 2021

オプション:
  --max-players NUM    各年の最大検索数 (デフォルト: 200)
  --output-dir DIR     出力ディレクトリ (デフォルト: ./data/modern_players)

例:
  npx tsx scripts/batch_import_modern_players.ts --year 2021 --max-players 100
  npx tsx scripts/batch_import_modern_players.ts --start-year 2022 --end-year 2025
        `);
        process.exit(0);
    }
  }
  
  return { 
    startEntryYear, 
    endEntryYear, 
    entryYear, 
    outputDir, 
    maxPlayersPerYear 
  };
}

/**
 * メイン実行
 */
async function main() {
  try {
    const options = parseArgs();
    const scraper = new ModernPlayerScraper();
    
    console.log('🚀 現代選手バッチスクレイピング開始');
    console.log(`📁 出力先: ${options.outputDir}`);
    console.log(`🎯 各年最大検索: ${options.maxPlayersPerYear}名`);
    console.log('✅ ID構造: 入団年-1 + 連番 (例: 2000001 = 2021年入団1番目)');
    
    if (options.startEntryYear && options.endEntryYear) {
      await scraper.processMultipleYears(
        options.startEntryYear, 
        options.endEntryYear, 
        options.outputDir,
        options.maxPlayersPerYear
      );
    } else if (options.entryYear) {
      await scraper.processSingleYear(
        options.entryYear, 
        options.outputDir, 
        options.maxPlayersPerYear
      );
    } else {
      throw new Error('--year または --start-year と --end-year が必要です');
    }
    
    console.log('\\n🎯 現代選手バッチスクレイピング完了!');
    
  } catch (error) {
    console.error('❌ スクレイピング処理中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}