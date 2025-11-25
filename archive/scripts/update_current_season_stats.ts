#!/usr/bin/env npx tsx

/**
 * 既存137名の選手の2025年最新統計データ更新
 * - 2021年入団134名 + 2022年入団3名
 * - 現在シーズンの最新成績を取得
 * - 過去データとの比較分析
 */

import fs from 'fs/promises';
import path from 'path';
import { 
  fetchPlayerSeasonData, 
  BaseballDataPlayer,
  SeasonStats,
  SabrEyeStats 
} from '../lib/baseballdata-scraper';

interface CurrentSeasonPlayer extends BaseballDataPlayer {
  current_season_stats?: SeasonStats;
  current_sabr_stats?: SabrEyeStats;
  previous_season_stats?: SeasonStats; // 既存データ
  stats_comparison?: {
    games_diff: number;
    avg_diff: number;
    hr_diff: number;
    rbi_diff: number;
    ops_diff: number;
    improvement_indicators: string[];
  };
  update_status: {
    success: boolean;
    has_current_data: boolean;
    has_improvement: boolean;
    last_updated: string;
    errors: string[];
  };
}

class CurrentSeasonUpdater {
  private delayMs = 1500;
  private maxConcurrent = 2;

  /**
   * 既存選手リストを読み込み
   */
  async loadExistingPlayers(year: number): Promise<BaseballDataPlayer[]> {
    try {
      const playersFile = `./data/detailed_stats/detailed_stats_${year}/stats_only_${year}.json`;
      const content = await fs.readFile(playersFile, 'utf-8');
      const players = JSON.parse(content);
      
      console.log(`📖 ${year}年入団選手データ読み込み: ${players.length}名`);
      return players;
      
    } catch (error) {
      console.error(`❌ ${year}年データ読み込み失敗:`, error);
      return [];
    }
  }

  /**
   * 単一選手の2025年最新データを取得
   */
  async updatePlayerCurrentStats(player: any): Promise<CurrentSeasonPlayer> {
    const updatedPlayer: CurrentSeasonPlayer = {
      ...player,
      update_status: {
        success: false,
        has_current_data: false,
        has_improvement: false,
        last_updated: new Date().toISOString(),
        errors: []
      }
    };

    const playerName = this.cleanPlayerName(player.name);
    console.log(`  📊 更新中: ${playerName} (${player.player_id})`);

    try {
      // 最新の季節データを取得（2025年）
      const currentData = await fetchPlayerSeasonData(player.player_id);

      if (currentData.seasonStats) {
        updatedPlayer.current_season_stats = currentData.seasonStats;
        updatedPlayer.update_status.has_current_data = true;
        console.log(`    ✅ 2025年成績取得: G${currentData.seasonStats.games} AVG${currentData.seasonStats.batting_average.toFixed(3)}`);
      }

      if (currentData.sabrEye) {
        updatedPlayer.current_sabr_stats = currentData.sabrEye;
        console.log(`    ✅ Sabrメトリクス取得: OPS${currentData.sabrEye.babip?.toFixed(3) || 'N/A'}`);
      }

      // 過去データとの比較
      if (player.season_stats && updatedPlayer.current_season_stats) {
        updatedPlayer.previous_season_stats = player.season_stats;
        updatedPlayer.stats_comparison = this.compareStats(
          player.season_stats, 
          updatedPlayer.current_season_stats
        );
        
        updatedPlayer.update_status.has_improvement = 
          updatedPlayer.stats_comparison.improvement_indicators.length > 0;

        if (updatedPlayer.stats_comparison.improvement_indicators.length > 0) {
          console.log(`    📈 成長指標: ${updatedPlayer.stats_comparison.improvement_indicators.join(', ')}`);
        }
      }

      updatedPlayer.update_status.success = true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updatedPlayer.update_status.errors.push(errorMsg);
      console.log(`    ❌ エラー: ${errorMsg}`);
    }

    return updatedPlayer;
  }

  /**
   * 統計データの比較分析
   */
  private compareStats(previousStats: SeasonStats, currentStats: SeasonStats) {
    const comparison = {
      games_diff: currentStats.games - previousStats.games,
      avg_diff: currentStats.batting_average - previousStats.batting_average,
      hr_diff: currentStats.home_runs - previousStats.home_runs,
      rbi_diff: currentStats.rbis - previousStats.rbis,
      ops_diff: currentStats.ops - previousStats.ops,
      improvement_indicators: [] as string[]
    };

    // 成長指標の判定
    if (comparison.avg_diff > 0.050) comparison.improvement_indicators.push('打率大幅向上');
    else if (comparison.avg_diff > 0.020) comparison.improvement_indicators.push('打率向上');

    if (comparison.hr_diff > 10) comparison.improvement_indicators.push('長打力向上');
    else if (comparison.hr_diff > 5) comparison.improvement_indicators.push('本塁打増加');

    if (comparison.rbi_diff > 20) comparison.improvement_indicators.push('打点大幅増');
    else if (comparison.rbi_diff > 10) comparison.improvement_indicators.push('打点向上');

    if (comparison.ops_diff > 0.150) comparison.improvement_indicators.push('OPS大幅向上');
    else if (comparison.ops_diff > 0.050) comparison.improvement_indicators.push('OPS向上');

    if (comparison.games_diff > 30) comparison.improvement_indicators.push('出場機会増加');

    return comparison;
  }

  /**
   * 複数選手の一括更新
   */
  async updateMultiplePlayers(
    players: BaseballDataPlayer[], 
    outputDir: string,
    batchName: string
  ): Promise<void> {
    console.log(`🚀 ${batchName}: ${players.length}名の2025年データ更新開始`);
    
    await fs.mkdir(outputDir, { recursive: true });

    const updatedPlayers: CurrentSeasonPlayer[] = [];
    let successCount = 0;
    let currentDataCount = 0;
    let improvementCount = 0;

    // バッチ処理
    for (let i = 0; i < players.length; i += this.maxConcurrent) {
      const batch = players.slice(i, i + this.maxConcurrent);
      console.log(`\n📦 バッチ ${Math.floor(i / this.maxConcurrent) + 1}/${Math.ceil(players.length / this.maxConcurrent)}: ${batch.length}名処理中`);

      const batchPromises = batch.map(async (player) => {
        const updatedPlayer = await this.updatePlayerCurrentStats(player);
        
        if (updatedPlayer.update_status.success) successCount++;
        if (updatedPlayer.update_status.has_current_data) currentDataCount++;
        if (updatedPlayer.update_status.has_improvement) improvementCount++;

        return updatedPlayer;
      });

      const batchResults = await Promise.all(batchPromises);
      updatedPlayers.push(...batchResults);

      // レート制限
      if (i + this.maxConcurrent < players.length) {
        console.log(`  ⏱️  ${this.delayMs}ms待機中...`);
        await this.delay(this.delayMs);
      }
    }

    // 結果保存
    await this.saveUpdatedData(updatedPlayers, outputDir, batchName);

    // サマリー表示
    console.log(`\n📈 ${batchName}更新完了:`);
    console.log(`  ✅ 更新成功: ${successCount}名`);
    console.log(`  📊 現在データ有: ${currentDataCount}名`);
    console.log(`  📈 成長確認: ${improvementCount}名`);
    console.log(`  📊 成功率: ${((successCount / players.length) * 100).toFixed(1)}%`);
  }

  /**
   * 更新データの保存
   */
  private async saveUpdatedData(
    updatedPlayers: CurrentSeasonPlayer[], 
    outputDir: string, 
    batchName: string
  ): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // 全データ保存
    const allDataFile = path.join(outputDir, `updated_players_${batchName}_${timestamp}.json`);
    await fs.writeFile(allDataFile, JSON.stringify(updatedPlayers, null, 2), 'utf-8');

    // 現在シーズンデータのみ抽出
    const currentSeasonData = updatedPlayers
      .filter(p => p.update_status.has_current_data)
      .map(p => ({
        player_id: p.player_id,
        name: this.cleanPlayerName(p.name),
        team: p.team,
        entry_year: p.entry_year,
        current_season_stats: p.current_season_stats,
        current_sabr_stats: p.current_sabr_stats,
        stats_comparison: p.stats_comparison,
        last_updated: p.update_status.last_updated
      }));

    const currentStatsFile = path.join(outputDir, `current_season_${batchName}_${timestamp}.json`);
    await fs.writeFile(currentStatsFile, JSON.stringify(currentSeasonData, null, 2), 'utf-8');

    // 成長選手レポート
    const improvingPlayers = updatedPlayers.filter(p => p.update_status.has_improvement);
    if (improvingPlayers.length > 0) {
      const improvementReport = improvingPlayers.map(p => ({
        player_id: p.player_id,
        name: this.cleanPlayerName(p.name),
        team: p.team,
        improvement_indicators: p.stats_comparison?.improvement_indicators,
        stats_changes: {
          avg_change: p.stats_comparison?.avg_diff?.toFixed(3),
          hr_change: p.stats_comparison?.hr_diff,
          rbi_change: p.stats_comparison?.rbi_diff,
          ops_change: p.stats_comparison?.ops_diff?.toFixed(3)
        }
      }));

      const improvementFile = path.join(outputDir, `improvement_report_${batchName}_${timestamp}.json`);
      await fs.writeFile(improvementFile, JSON.stringify(improvementReport, null, 2), 'utf-8');
    }

    // 更新レポート
    const updateReport = {
      batch_name: batchName,
      update_date: timestamp,
      total_players: updatedPlayers.length,
      successful_updates: updatedPlayers.filter(p => p.update_status.success).length,
      players_with_current_data: updatedPlayers.filter(p => p.update_status.has_current_data).length,
      players_showing_improvement: updatedPlayers.filter(p => p.update_status.has_improvement).length,
      success_rate: ((updatedPlayers.filter(p => p.update_status.success).length / updatedPlayers.length) * 100).toFixed(1),
      files: {
        all_data: allDataFile,
        current_stats: currentStatsFile,
        improvement_report: improvingPlayers.length > 0 ? path.join(outputDir, `improvement_report_${batchName}_${timestamp}.json`) : null
      }
    };

    const reportFile = path.join(outputDir, `update_report_${batchName}_${timestamp}.json`);
    await fs.writeFile(reportFile, JSON.stringify(updateReport, null, 2), 'utf-8');

    console.log(`\n💾 保存完了:`);
    console.log(`  📄 全データ: ${allDataFile}`);
    console.log(`  📊 現在成績: ${currentStatsFile}`);
    if (improvingPlayers.length > 0) {
      console.log(`  📈 成長レポート: ${improvementFile}`);
    }
    console.log(`  📋 更新レポート: ${reportFile}`);
  }

  /**
   * 全選手（137名）の一括更新
   */
  async updateAllPlayers(outputDir: string = './data/current_season_2025'): Promise<void> {
    console.log('🚀 137名全選手の2025年データ更新開始');
    
    // 2021年入団選手（134名）
    const players2021 = await this.loadExistingPlayers(2021);
    if (players2021.length > 0) {
      await this.updateMultiplePlayers(players2021, outputDir, '2021_entrants');
    }

    // 2022年入団選手（3名）
    const players2022 = await this.loadExistingPlayers(2022);
    if (players2022.length > 0) {
      await this.updateMultiplePlayers(players2022, outputDir, '2022_entrants');
    }

    // 全体サマリー
    console.log(`\n🎯 137名全選手2025年データ更新完了!`);
    console.log(`📁 出力先: ${outputDir}`);
  }

  private cleanPlayerName(name: string): string {
    return name
      .replace(/\d{4}年度版\s*/, '')
      .replace(/【.*?】.*$/, '')
      .trim();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * メイン実行
 */
async function main() {
  try {
    const updater = new CurrentSeasonUpdater();
    
    console.log('🚀 既存137名選手の2025年最新データ更新開始');
    
    await updater.updateAllPlayers();
    
    console.log('\n🎯 2025年データ更新完了!');
    
  } catch (error) {
    console.error('❌ 更新処理中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}