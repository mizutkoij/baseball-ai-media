#!/usr/bin/env npx tsx

/**
 * 2011年以前入団で2011年以降現役だった選手の発見
 * 
 * BaseballData.jpの制約:
 * - 2011年以前入団選手でも、2011年以降に現役だった場合のみデータ存在
 * - このスクリプトは2000-2010年入団選手で2011年以降活動した選手を検出
 * 
 * 戦略:
 * 1. 2000-2010年の各年から推定100名ずつサンプリング
 * 2. データが存在すれば現役だった証拠
 * 3. 早期終了で効率化
 * 
 * 使用方法:
 * npx tsx scripts/discover_pre2011_active_players.ts --start-year 2000 --end-year 2010
 * npx tsx scripts/discover_pre2011_active_players.ts --year 2005
 */

import fs from 'fs/promises';
import path from 'path';
import { BaseballDataScraper, BaseballDataPlayer } from '../lib/baseballdata-scraper';

interface Pre2011DiscoveryOptions {
  startYear?: number;
  endYear?: number;
  year?: number;
  outputDir: string;
  maxSamplePerYear: number;
  earlyTerminationThreshold: number;
}

class Pre2011ActivePlayerDiscoverer {
  private scraper: BaseballDataScraper;
  
  constructor() {
    this.scraper = new BaseballDataScraper();
  }

  /**
   * 2011年以前入団で2011年以降現役だった選手の発見
   */
  async discoverPre2011ActivePlayers(year: number, maxSample: number = 100): Promise<BaseballDataPlayer[]> {
    console.log(`🔍 ${year}年入団選手の2011年以降現役検索開始`);
    console.log(`   対象: BaseballData.jpにデータ存在 = 2011年以降現役の証拠`);
    
    const discoveredPlayers: BaseballDataPlayer[] = [];
    let consecutiveNotFound = 0;
    const maxConsecutiveNotFound = 30; // 30名連続で見つからなければ終了
    
    for (let sequence = 1; sequence <= maxSample; sequence++) {
      const playerId = `${year}${sequence.toString().padStart(3, '0')}`;
      
      try {
        console.log(`  📊 検索: ${playerId}`);
        const player = await this.scraper.discoverPlayer(playerId);
        
        if (player) {
          discoveredPlayers.push(player);
          consecutiveNotFound = 0;
          console.log(`  ✅ 2011年以降現役選手発見: ${player.name} (${player.player_id})`);
          console.log(`     → チーム: ${player.team}, タイプ: ${player.player_type}`);
        } else {
          consecutiveNotFound++;
          
          if (consecutiveNotFound >= maxConsecutiveNotFound) {
            console.log(`  🛑 ${maxConsecutiveNotFound}名連続未発見のため検索終了`);
            break;
          }
        }
        
        // レート制限
        await this.delay(1200);
        
      } catch (error) {
        console.error(`  ❌ エラー (${playerId}):`, error);
        consecutiveNotFound++;
        
        if (consecutiveNotFound >= maxConsecutiveNotFound) {
          console.log(`  🛑 エラー多発のため検索終了`);
          break;
        }
        
        await this.delay(2000); // エラー時は長めの間隔
      }
    }
    
    console.log(`📈 ${year}年入団現役選手発見: ${discoveredPlayers.length}名`);
    return discoveredPlayers;
  }

  /**
   * 複数年の2011年以前現役選手一括発見
   */
  async discoverMultipleYears(
    startYear: number, 
    endYear: number, 
    outputDir: string,
    maxSample: number = 100
  ): Promise<void> {
    console.log(`🚀 ${startYear}-${endYear}年入団選手の2011年以降現役検索開始`);
    console.log(`🎯 各年最大${maxSample}名サンプリング`);
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const totalStats = {
      years_processed: 0,
      total_active_players: 0,
      yearly_breakdown: {} as Record<number, number>,
      discovery_notes: [] as string[]
    };
    
    for (let year = startYear; year <= endYear; year++) {
      console.log(`\\n--- ${year}年処理開始 ---`);
      
      const yearOutputDir = path.join(outputDir, `pre2011_active_${year}`);
      await fs.mkdir(yearOutputDir, { recursive: true });
      
      const players = await this.discoverPre2011ActivePlayers(year, maxSample);
      
      if (players.length > 0) {
        const playersFile = path.join(yearOutputDir, `active_players_${year}.json`);
        await fs.writeFile(playersFile, JSON.stringify(players, null, 2), 'utf-8');
        
        // 選手リストも作成
        const playerList = players.map(p => ({
          id: p.player_id,
          name: p.name,
          team: p.team,
          type: p.player_type,
          entry_year: p.entry_year
        }));
        
        const listFile = path.join(yearOutputDir, `player_list_${year}.json`);
        await fs.writeFile(listFile, JSON.stringify(playerList, null, 2), 'utf-8');
        
        console.log(`💾 保存完了: ${players.length}名`);
        console.log(`📁 データ: ${playersFile}`);
        console.log(`📋 リスト: ${listFile}`);
        
        totalStats.discovery_notes.push(
          `${year}年: ${players.length}名の2011年以降現役選手を発見`
        );
      } else {
        console.log(`⚠️  ${year}年: 2011年以降現役選手は発見されませんでした`);
        totalStats.discovery_notes.push(`${year}年: 現役選手なし (データ未存在)`);
      }
      
      totalStats.years_processed++;
      totalStats.total_active_players += players.length;
      totalStats.yearly_breakdown[year] = players.length;
      
      console.log(`✅ ${year}年完了\\n`);
      
      // 年度間の間隔
      await this.delay(3000);
    }
    
    // 全体サマリー作成
    const summaryFile = path.join(outputDir, 'pre2011_discovery_summary.json');
    const summary = {
      ...totalStats,
      period: `${startYear}-${endYear}`,
      strategy: '2011年以前入団選手の2011年以降現役検索',
      constraint_explanation: 'BaseballData.jpにデータ存在 = 2011年以降現役の証拠',
      generated_at: new Date().toISOString(),
      max_sample_per_year: maxSample
    };
    
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
    
    console.log(`\\n🎉 2011年以前入団現役選手発見完了!`);
    console.log(`📊 発見総計: ${totalStats.total_active_players}名`);
    console.log(`📅 処理期間: ${startYear}-${endYear}年 (${totalStats.years_processed}年間)`);
    console.log(`📁 出力先: ${outputDir}`);
    console.log(`📋 サマリー: ${summaryFile}`);
    
    // 年別発見数を表示
    console.log('\\n📈 年別発見数:');
    for (const [year, count] of Object.entries(totalStats.yearly_breakdown)) {
      if (count > 0) {
        console.log(`  ${year}年: ${count}名`);
      }
    }
  }

  /**
   * 単一年度の2011年以前現役選手発見
   */
  async processSingleYear(year: number, outputDir: string, maxSample: number = 100): Promise<void> {
    console.log(`🎯 ${year}年入団選手の2011年以降現役検索`);
    
    const yearOutputDir = path.join(outputDir, `pre2011_active_${year}`);
    await fs.mkdir(yearOutputDir, { recursive: true });
    
    const players = await this.discoverPre2011ActivePlayers(year, maxSample);
    
    if (players.length > 0) {
      const playersFile = path.join(yearOutputDir, `active_players_${year}.json`);
      await fs.writeFile(playersFile, JSON.stringify(players, null, 2), 'utf-8');
      
      const report = {
        year,
        strategy: '2011年以降現役選手発見',
        active_players_found: players.length,
        explanation: 'BaseballData.jpにデータ存在 = 2011年以降現役の証拠',
        generated_at: new Date().toISOString(),
        max_sample_searched: maxSample,
        output_file: playersFile
      };
      
      const reportFile = path.join(yearOutputDir, `discovery_report_${year}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf-8');
      
      console.log(`✅ ${year}年完了: ${players.length}名の2011年以降現役選手を発見`);
      console.log(`📁 データ: ${playersFile}`);
      console.log(`📋 レポート: ${reportFile}`);
      
    } else {
      console.log(`⚠️  ${year}年: 2011年以降現役選手は発見されませんでした`);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * コマンドライン引数解析
 */
function parseArgs(): Pre2011DiscoveryOptions {
  const args = process.argv.slice(2);
  let startYear: number | undefined;
  let endYear: number | undefined;
  let year: number | undefined;
  let outputDir = './data/pre2011_active_players';
  let maxSamplePerYear = 100;
  let earlyTerminationThreshold = 30;
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--start-year':
        startYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--end-year':
        endYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--year':
        year = parseInt(args[i + 1]);
        i++;
        break;
      case '--output-dir':
        outputDir = args[i + 1];
        i++;
        break;
      case '--max-sample':
        maxSamplePerYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--help':
        console.log(`
2011年以前入団で2011年以降現役選手の発見

戦略:
  BaseballData.jpは2011年以降のデータのみ保持
  → 2011年以前入団選手でもデータ存在 = 2011年以降現役の証拠

使用方法:
  # 2000-2010年入団の2011年以降現役選手を全検索
  npx tsx scripts/discover_pre2011_active_players.ts --start-year 2000 --end-year 2010
  
  # 単一年度 (例: 2005年入団)
  npx tsx scripts/discover_pre2011_active_players.ts --year 2005

オプション:
  --max-sample NUM    各年の最大サンプル数 (デフォルト: 100)
  --output-dir DIR    出力ディレクトリ

例:
  npx tsx scripts/discover_pre2011_active_players.ts --start-year 2005 --end-year 2010 --max-sample 150
        `);
        process.exit(0);
    }
  }
  
  return { 
    startYear, 
    endYear, 
    year, 
    outputDir, 
    maxSamplePerYear, 
    earlyTerminationThreshold 
  };
}

/**
 * メイン実行
 */
async function main() {
  try {
    const options = parseArgs();
    const discoverer = new Pre2011ActivePlayerDiscoverer();
    
    console.log('🔍 2011年以前入団→2011年以降現役選手発見開始');
    console.log(`📁 出力先: ${options.outputDir}`);
    console.log(`🎯 各年最大サンプル: ${options.maxSamplePerYear}名`);
    
    if (options.startYear && options.endYear) {
      await discoverer.discoverMultipleYears(
        options.startYear, 
        options.endYear, 
        options.outputDir,
        options.maxSamplePerYear
      );
    } else if (options.year) {
      await discoverer.processSingleYear(
        options.year, 
        options.outputDir, 
        options.maxSamplePerYear
      );
    } else {
      throw new Error('--year または --start-year と --end-year が必要です');
    }
    
    console.log('\\n🎯 2011年以前現役選手発見完了!');
    
  } catch (error) {
    console.error('❌ 発見処理中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}