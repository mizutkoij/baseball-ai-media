#!/usr/bin/env npx tsx

/**
 * 取得済みプレイヤーIDから詳細統計データを収集
 * - 基本成績 (season stats)
 * - Sabrメトリクス (_2.html)
 * - 状況別成績 (_3-5.html)
 * - コース別データ (_course.html)
 */

import fs from 'fs/promises';
import path from 'path';
import { 
  fetchPlayerSeasonData, 
  BaseballDataPlayer,
  SeasonStats,
  SabrEyeStats,
  SplitMonthStats,
  SituationalStats 
} from '../lib/baseballdata-scraper';

interface DetailedPlayerData extends BaseballDataPlayer {
  season_stats?: SeasonStats;
  sabr_eye_stats?: SabrEyeStats;
  split_month_stats?: SplitMonthStats[];
  situational_stats?: SituationalStats[];
  fetch_status: {
    basic_stats: boolean;
    sabr_eye: boolean;
    situational: boolean;
    course_data: boolean;
    errors: string[];
  };
}

interface CollectionOptions {
  inputDir: string;
  outputDir: string;
  entryYear: number;
  maxConcurrent?: number;
  delayMs?: number;
  includeAdvanced?: boolean;
}

class DetailedStatsCollector {
  private delayMs: number;
  private maxConcurrent: number;

  constructor(delayMs = 1500, maxConcurrent = 3) {
    this.delayMs = delayMs;
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * プレイヤーリストファイルを読み込み
   */
  async loadPlayerList(inputDir: string, entryYear: number): Promise<BaseballDataPlayer[]> {
    try {
      const playersFile = path.join(inputDir, `players_${entryYear}.json`);
      const content = await fs.readFile(playersFile, 'utf-8');
      const players = JSON.parse(content) as BaseballDataPlayer[];
      
      console.log(`📖 ${entryYear}年入団選手リスト読み込み: ${players.length}名`);
      return players;
      
    } catch (error) {
      console.error(`❌ プレイヤーリスト読み込み失敗 (${entryYear}年):`, error);
      return [];
    }
  }

  /**
   * 単一プレイヤーの詳細データを取得
   */
  async collectPlayerDetailedStats(player: BaseballDataPlayer): Promise<DetailedPlayerData> {
    const detailedPlayer: DetailedPlayerData = {
      ...player,
      fetch_status: {
        basic_stats: false,
        sabr_eye: false,
        situational: false,
        course_data: false,
        errors: []
      }
    };

    const playerName = this.cleanPlayerName(player.name);
    console.log(`  📊 データ収集中: ${playerName} (${player.player_id})`);

    try {
      // 基本成績 + Sabrメトリクス一括取得
      const seasonData = await fetchPlayerSeasonData(player.player_id);

      if (seasonData.seasonStats) {
        detailedPlayer.season_stats = seasonData.seasonStats;
        detailedPlayer.fetch_status.basic_stats = true;
        console.log(`    ✅ 基本成績取得成功`);
      }

      if (seasonData.sabrEye) {
        detailedPlayer.sabr_eye_stats = seasonData.sabrEye;
        detailedPlayer.fetch_status.sabr_eye = true;
        console.log(`    ✅ Sabrメトリクス取得成功`);
      }

      // 基本データがない場合は警告
      if (!seasonData.seasonStats && !seasonData.sabrEye) {
        detailedPlayer.fetch_status.errors.push('基本データが見つかりません（ルーキー未出場の可能性）');
        console.log(`    ⚠️  基本データなし（${playerName}）`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      detailedPlayer.fetch_status.errors.push(`データ取得エラー: ${errorMsg}`);
      console.log(`    ❌ エラー: ${errorMsg}`);
    }

    return detailedPlayer;
  }

  /**
   * プレイヤーリストの詳細データを並列収集
   */
  async collectMultiplePlayersStats(
    players: BaseballDataPlayer[], 
    outputDir: string, 
    entryYear: number
  ): Promise<void> {
    console.log(`🚀 ${entryYear}年入団選手の詳細データ収集開始 (${players.length}名)`);
    
    const yearOutputDir = path.join(outputDir, `detailed_stats_${entryYear}`);
    await fs.mkdir(yearOutputDir, { recursive: true });

    const detailedPlayers: DetailedPlayerData[] = [];
    let successCount = 0;
    let errorCount = 0;

    // バッチ処理（並列度制限）
    for (let i = 0; i < players.length; i += this.maxConcurrent) {
      const batch = players.slice(i, i + this.maxConcurrent);
      console.log(`\\n📦 バッチ ${Math.floor(i / this.maxConcurrent) + 1}/${Math.ceil(players.length / this.maxConcurrent)}: ${batch.length}名処理中`);

      const batchPromises = batch.map(async (player) => {
        const detailedPlayer = await this.collectPlayerDetailedStats(player);
        
        if (detailedPlayer.season_stats || detailedPlayer.sabr_eye_stats) {
          successCount++;
        } else {
          errorCount++;
        }

        return detailedPlayer;
      });

      const batchResults = await Promise.all(batchPromises);
      detailedPlayers.push(...batchResults);

      // レート制限
      if (i + this.maxConcurrent < players.length) {
        console.log(`  ⏱️  ${this.delayMs}ms待機中...`);
        await this.delay(this.delayMs);
      }
    }

    // 結果保存
    await this.saveDetailedData(detailedPlayers, yearOutputDir, entryYear);

    // サマリー表示
    console.log(`\\n📈 ${entryYear}年データ収集完了:`);
    console.log(`  ✅ 成功: ${successCount}名`);
    console.log(`  ⚠️  データなし: ${errorCount}名`);
    console.log(`  📊 成功率: ${((successCount / players.length) * 100).toFixed(1)}%`);
  }

  /**
   * 詳細データをファイル保存
   */
  private async saveDetailedData(
    detailedPlayers: DetailedPlayerData[], 
    outputDir: string, 
    entryYear: number
  ): Promise<void> {
    // 全データ保存
    const allDataFile = path.join(outputDir, `detailed_players_${entryYear}.json`);
    await fs.writeFile(allDataFile, JSON.stringify(detailedPlayers, null, 2), 'utf-8');

    // 統計データのみ抽出
    const statsOnly = detailedPlayers
      .filter(p => p.season_stats || p.sabr_eye_stats)
      .map(p => ({
        player_id: p.player_id,
        name: this.cleanPlayerName(p.name),
        team: p.team,
        player_type: p.player_type,
        position: p.position,
        season_stats: p.season_stats,
        sabr_eye_stats: p.sabr_eye_stats,
        entry_year: p.entry_year
      }));

    const statsFile = path.join(outputDir, `stats_only_${entryYear}.json`);
    await fs.writeFile(statsFile, JSON.stringify(statsOnly, null, 2), 'utf-8');

    // レポート作成
    const report = {
      entry_year: entryYear,
      total_players: detailedPlayers.length,
      players_with_stats: statsOnly.length,
      players_without_stats: detailedPlayers.length - statsOnly.length,
      success_rate: ((statsOnly.length / detailedPlayers.length) * 100).toFixed(1),
      data_types: {
        basic_stats: detailedPlayers.filter(p => p.fetch_status.basic_stats).length,
        sabr_eye_stats: detailedPlayers.filter(p => p.fetch_status.sabr_eye).length,
        total_errors: detailedPlayers.reduce((sum, p) => sum + p.fetch_status.errors.length, 0)
      },
      generated_at: new Date().toISOString(),
      files: {
        all_data: allDataFile,
        stats_only: statsFile
      }
    };

    const reportFile = path.join(outputDir, `collection_report_${entryYear}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`\\n💾 保存完了:`);
    console.log(`  📄 全データ: ${allDataFile}`);
    console.log(`  📊 統計のみ: ${statsFile}`);
    console.log(`  📋 レポート: ${reportFile}`);
  }

  /**
   * 複数年度の一括処理
   */
  async collectMultipleYears(
    inputBaseDir: string,
    outputDir: string,
    years: number[]
  ): Promise<void> {
    console.log(`🚀 複数年度詳細データ収集開始: ${years.join(', ')}年`);
    
    await fs.mkdir(outputDir, { recursive: true });

    for (const year of years) {
      console.log(`\\n--- ${year}年処理開始 ---`);
      
      const yearInputDir = path.join(inputBaseDir, `entry_year_${year}`);
      const players = await this.loadPlayerList(yearInputDir, year);

      if (players.length > 0) {
        await this.collectMultiplePlayersStats(players, outputDir, year);
      } else {
        console.log(`⚠️  ${year}年: プレイヤーデータがありません`);
      }

      console.log(`✅ ${year}年完了\\n`);
    }

    console.log(`🎯 全年度詳細データ収集完了!`);
  }

  private cleanPlayerName(name: string): string {
    return name
      .replace(/\\d{4}年度版\\s*/, '')
      .replace(/【.*?】.*$/, '')
      .trim();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * コマンドライン引数解析
 */
function parseArgs(): CollectionOptions & { years?: number[] } {
  const args = process.argv.slice(2);
  let inputDir = './data/modern_players';
  let outputDir = './data/detailed_stats';
  let entryYear: number | undefined;
  let years: number[] | undefined;
  let maxConcurrent = 3;
  let delayMs = 1500;
  let includeAdvanced = true;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input-dir':
        inputDir = args[i + 1];
        i++;
        break;
      case '--output-dir':
        outputDir = args[i + 1];
        i++;
        break;
      case '--year':
        entryYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--years':
        years = args[i + 1].split(',').map(y => parseInt(y.trim()));
        i++;
        break;
      case '--max-concurrent':
        maxConcurrent = parseInt(args[i + 1]);
        i++;
        break;
      case '--delay':
        delayMs = parseInt(args[i + 1]);
        i++;
        break;
      case '--help':
        console.log(`
プレイヤー詳細統計データ収集

使用方法:
  # 単一年度の詳細データ収集
  npx tsx scripts/collect_detailed_player_stats.ts --year 2021
  
  # 複数年度の一括収集
  npx tsx scripts/collect_detailed_player_stats.ts --years 2021,2022
  
  # すべての取得済み年度
  npx tsx scripts/collect_detailed_player_stats.ts --years 2021,2022

オプション:
  --input-dir DIR      入力ディレクトリ (デフォルト: ./data/modern_players)
  --output-dir DIR     出力ディレクトリ (デフォルト: ./data/detailed_stats)
  --max-concurrent N   同時実行数 (デフォルト: 3)
  --delay MS          リクエスト間隔ms (デフォルト: 1500)

例:
  npx tsx scripts/collect_detailed_player_stats.ts --year 2021 --max-concurrent 2
  npx tsx scripts/collect_detailed_player_stats.ts --years 2021,2022 --delay 2000
        `);
        process.exit(0);
    }
  }

  return { inputDir, outputDir, entryYear: entryYear!, maxConcurrent, delayMs, includeAdvanced, years };
}

/**
 * メイン実行
 */
async function main() {
  try {
    const options = parseArgs();
    const collector = new DetailedStatsCollector(options.delayMs, options.maxConcurrent);

    console.log('🚀 プレイヤー詳細統計データ収集開始');
    console.log(`📁 入力: ${options.inputDir}`);
    console.log(`📁 出力: ${options.outputDir}`);
    console.log(`⚙️  並列度: ${options.maxConcurrent}, 間隔: ${options.delayMs}ms`);

    if (options.years) {
      await collector.collectMultipleYears(options.inputDir, options.outputDir, options.years);
    } else if (options.entryYear) {
      const yearInputDir = path.join(options.inputDir, `entry_year_${options.entryYear}`);
      const players = await collector.loadPlayerList(yearInputDir, options.entryYear);
      
      if (players.length > 0) {
        await collector.collectMultiplePlayersStats(players, options.outputDir, options.entryYear);
      } else {
        throw new Error(`${options.entryYear}年のプレイヤーデータが見つかりません`);
      }
    } else {
      throw new Error('--year または --years が必要です');
    }

    console.log('\\n🎯 詳細統計データ収集完了!');

  } catch (error) {
    console.error('❌ データ収集中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}