#!/usr/bin/env npx tsx

/**
 * NPB詳細スクレイピングテストスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/test_detailed_scraping.ts
 * 
 * テスト対象:
 * - https://npb.jp/scores/2025/0806/g-s-15/box.html
 * - https://npb.jp/scores/2025/0806/g-s-15/roster.html
 */

import { scrapeNPBGameDetails, scrapeNPBGameRoster, generateNPBDetailUrls } from '../lib/npb-detailed-scraper';

async function testDetailedScraping() {
  console.log('🏁 NPB詳細スクレイピングテスト開始');
  
  // テスト用試合ID (2025年8月6日の巨人vs ヤクルト戦)
  const gameId = '2025-0806-g-s-15';
  const urls = generateNPBDetailUrls(gameId);
  
  console.log(`\n📍 対象試合: ${gameId}`);
  console.log(`📄 box.html: ${urls.box}`);
  console.log(`👥 roster.html: ${urls.roster}`);
  
  try {
    console.log('\n🔍 試合詳細データ取得中...');
    
    // 1. 試合詳細データのテスト (box.html)
    const gameDetails = await scrapeNPBGameDetails(urls.box);
    console.log('\n✅ 試合詳細データ取得成功');
    console.log(`🏟️  球場: ${gameDetails.venue}`);
    console.log(`📅 日付: ${gameDetails.date}`);
    console.log(`🏠 ホーム: ${gameDetails.homeTeam} ${gameDetails.homeScore}点`);
    console.log(`✈️  アウェイ: ${gameDetails.awayTeam} ${gameDetails.awayScore}点`);
    console.log(`⏰ 試合時間: ${gameDetails.startTime} - ${gameDetails.endTime} (${gameDetails.duration})`);
    console.log(`👥 観客数: ${gameDetails.attendance}`);
    console.log(`📊 ステータス: ${gameDetails.status}`);
    
    // イニング別スコア
    console.log('\n📈 イニング別スコア:');
    console.log(`${gameDetails.awayTeam}: [${gameDetails.inningScores.away.join(', ')}] = ${gameDetails.awayScore}`);
    console.log(`${gameDetails.homeTeam}: [${gameDetails.inningScores.home.join(', ')}] = ${gameDetails.homeScore}`);
    
    // H-E (安打-エラー)
    console.log('\n⚾ H-E:');
    console.log(`${gameDetails.awayTeam}: ${gameDetails.teamStats.away.hits}H-${gameDetails.teamStats.away.errors}E`);
    console.log(`${gameDetails.homeTeam}: ${gameDetails.teamStats.home.hits}H-${gameDetails.teamStats.home.errors}E`);
    
    // 選手成績サンプル
    console.log('\n🏃 打者成績サンプル (トップ3):');
    gameDetails.playerStats.away.slice(0, 3).forEach(player => {
      console.log(`  ${player.battingOrder}番 (${player.position}) ${player.name}: ${player.atBats}打数${player.hits}安打 ${player.runs}得点${player.rbis}打点`);
      if (player.inningResults.length > 0) {
        console.log(`    打席結果: [${player.inningResults.join(', ')}]`);
      }
    });
    
    // 2. ロースターデータのテスト (roster.html)
    console.log('\n👥 ロースターデータ取得中...');
    const rosterData = await scrapeNPBGameRoster(urls.roster);
    console.log('\n✅ ロースターデータ取得成功');
    
    console.log(`\n🏠 ${rosterData.home.teamName} ロースター:`);
    console.log(`  投手: ${rosterData.home.pitchers.length}名`);
    console.log(`  野手: ${rosterData.home.fielders.length}名`);
    
    console.log(`\n✈️  ${rosterData.away.teamName} ロースター:`);
    console.log(`  投手: ${rosterData.away.pitchers.length}名`);
    console.log(`  野手: ${rosterData.away.fielders.length}名`);
    
    // ロースターサンプル表示
    console.log(`\n👨‍💼 ${rosterData.home.teamName} 投手陣 (サンプル 3名):`);
    rosterData.home.pitchers.slice(0, 3).forEach(pitcher => {
      console.log(`  ${pitcher.number}番 ${pitcher.name} (${pitcher.throwingHand}投${pitcher.battingHand}打)`);
    });
    
    console.log(`\n⚾ ${rosterData.home.teamName} 野手陣 (サンプル 5名):`);
    rosterData.home.fielders.slice(0, 5).forEach(fielder => {
      console.log(`  ${fielder.number}番 ${fielder.name} (${fielder.throwingHand}投${fielder.battingHand}打)`);
    });
    
    console.log('\n🎉 テスト完了！全ての機能が正常に動作しています。');
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  testDetailedScraping();
}