#!/usr/bin/env npx tsx

/**
 * BaseballData.jp スクレイピングテストスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/test_baseballdata_scraping.ts
 * 
 * テスト対象:
 * - 現役選手データ取得
 * - Sabr & 選球眼データ
 * - 月別・対戦別成績
 * - コース別データ
 * - 全打席ログ (重い処理)
 */

import { 
  BaseballDataScraper,
  fetchPlayerSeasonData,
  scanYearPlayers,
  DATA_TABLES,
  PLAYER_ID_RANGE
} from '../lib/baseballdata-scraper';

async function testBaseballDataScraping() {
  console.log('🏁 BaseballData.jp スクレイピングテスト開始');
  
  const scraper = new BaseballDataScraper();
  
  // テスト用プレイヤーID (中野拓夢 - 阪神)
  const testPlayerId = '2000056';
  const testYear = 2025;
  
  console.log(`\n📊 テスト対象選手: ${testPlayerId}`);
  console.log(`📅 対象年度: ${testYear}`);
  
  try {
    // 1. プレイヤーID解析テスト
    console.log('\n🔍 1. プレイヤーID解析テスト');
    const { entryYear, yearNumber } = scraper.parsePlayerId(testPlayerId);
    console.log(`   入団年: ${entryYear}, 連番: ${yearNumber}`);
    
    // 2. メインシーズン成績取得テスト
    console.log('\n📈 2. シーズン成績取得テスト');
    const seasonStats = await scraper.fetchSeasonStats(testPlayerId, testYear);
    console.log(`   打率: ${seasonStats.batting_average}`);
    console.log(`   本塁打: ${seasonStats.home_runs}本`);
    console.log(`   打点: ${seasonStats.rbis}打点`);
    console.log(`   OPS: ${seasonStats.ops}`);
    
    // 3. Sabr & 選球眼データテスト
    console.log('\n🎯 3. Sabr & 選球眼データテスト');
    try {
      const sabrEye = await scraper.fetchSabrEyeStats(testPlayerId, testYear);
      console.log(`   BABIP: ${sabrEye.babip}`);
      console.log(`   IsoP: ${sabrEye.isop}`);
      console.log(`   BB/K: ${sabrEye.bb_k}`);
    } catch (error) {
      console.log('   ⚠️  Sabrデータは利用できませんでした');
    }
    
    // 4. 月別成績テスト
    console.log('\n📅 4. 月別成績テスト');
    const monthlyStats = await scraper.fetchSplitMonthStats(testPlayerId, testYear);
    console.log(`   月別データ: ${monthlyStats.length}ヶ月分`);
    monthlyStats.slice(0, 3).forEach(month => {
      console.log(`     ${month.month}月: 打率${month.batting_average} OPS${month.ops}`);
    });
    
    // 5. コース別成績テスト
    console.log('\n🎯 5. コース別成績テスト');
    const courseStats = await scraper.fetchCourseStats(testPlayerId, testYear);
    console.log(`   コース別データ: ${courseStats.length}種類`);
    courseStats.slice(0, 3).forEach(course => {
      console.log(`     ${course.zone}: 打率${course.batting_average} (${course.at_bats}打数${course.hits}安打)`);
    });
    
    // 6. 対戦別成績テスト
    console.log('\n🆚 6. 対戦別成績テスト');
    const vsTeamStats = await scraper.fetchExtendedStats(testPlayerId, 5, testYear);
    console.log(`   対戦別データ: ${vsTeamStats.length}チーム`);
    vsTeamStats.slice(0, 3).forEach(vs => {
      console.log(`     vs ${vs.opp_team}: 打率${vs.batting_average} OPS${vs.ops}`);
    });
    
    // 7. 統合データ取得テスト
    console.log('\n🔄 7. 統合データ取得テスト');
    const completeData = await fetchPlayerSeasonData(testPlayerId, testYear);
    console.log(`   プレイヤー名: ${completeData.player?.name}`);
    console.log(`   所属チーム: ${completeData.player?.team}`);
    console.log(`   ポジション: ${completeData.player?.position}`);
    console.log(`   データ取得状況:`);
    console.log(`     - 基本成績: ${completeData.seasonStats ? '✅' : '❌'}`);
    console.log(`     - Sabrデータ: ${completeData.sabrEye ? '✅' : '❌'}`);
    console.log(`     - 月別データ: ${completeData.monthlyStats?.length || 0}件`);
    console.log(`     - 対戦別データ: ${completeData.vsTeamStats?.length || 0}件`);
    console.log(`     - コース別データ: ${completeData.courseStats?.length || 0}件`);
    
    // 8. プレイヤースキャンテスト (軽量版)
    console.log('\n🔍 8. プレイヤースキャンテスト (2000年入団 最初の10人)');
    const scanResults = await scraper.scanPlayersFromYear(2000, 10);
    console.log(`   発見した選手: ${scanResults.length}名`);
    scanResults.slice(0, 5).forEach(player => {
      console.log(`     ${player.player_id}: ${player.name} (${player.team} ${player.position})`);
    });
    
    // 9. キャリア成績テスト (軽量版: 直近3年)
    console.log('\n📊 9. キャリア成績テスト (2023-2025)');
    const careerData = await scraper.fetchPlayerCareerStats(testPlayerId, 2023, 2025);
    console.log(`   キャリアデータ: ${careerData.careerData.length}年分`);
    console.log(`   プレイヤータイプ: ${careerData.playerType}`);
    careerData.careerData.forEach(season => {
      if ('batting_average' in season) {
        console.log(`     ${season.season}: 打率${season.batting_average} ${season.home_runs}本 OPS${season.ops}`);
      }
    });
    
    console.log('\n🎉 すべてのテストが完了しました！');
    console.log('\n📋 データベーステーブル仕様:');
    Object.entries(DATA_TABLES).forEach(([key, table]) => {
      console.log(`   ${key}: ${table}`);
    });
    
    console.log('\n⚙️  設定:');
    console.log(`   ID年範囲: ${PLAYER_ID_RANGE.MIN_YEAR}-${PLAYER_ID_RANGE.MAX_YEAR}`);
    console.log(`   年間最大選手数: ${PLAYER_ID_RANGE.MAX_PLAYERS_PER_YEAR}`);
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// 全打席ログテスト (重い処理のため個別実行)
async function testPlateAppearanceLog() {
  console.log('\n🔥 全打席ログテスト (重い処理)');
  
  const scraper = new BaseballDataScraper();
  const testPlayerId = '2000056';
  
  try {
    const paLogs = await scraper.fetchPlateAppearanceLog(testPlayerId, 2025);
    console.log(`   打席ログ: ${paLogs.length}打席`);
    
    // サンプル表示
    paLogs.slice(0, 5).forEach((pa, index) => {
      console.log(`     ${index + 1}. ${pa.game_date} vs${pa.opponent} ${pa.inning}回 ${pa.count} → ${pa.result} (${pa.outcome_type})`);
    });
    
    // 統計サマリー
    const outcomes = paLogs.reduce((acc, pa) => {
      acc[pa.outcome_type] = (acc[pa.outcome_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n   結果サマリー:');
    Object.entries(outcomes).forEach(([outcome, count]) => {
      console.log(`     ${outcome}: ${count}回`);
    });
    
  } catch (error) {
    console.error('   ❌ 全打席ログの取得に失敗:', error);
  }
}

// メイン実行
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--full') || args.includes('--pa-log')) {
    // 全機能テスト (打席ログ含む)
    testBaseballDataScraping().then(() => testPlateAppearanceLog());
  } else {
    // 軽量テスト
    testBaseballDataScraping();
  }
}