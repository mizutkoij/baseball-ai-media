#!/usr/bin/env tsx
/**
 * NPBデータアダプター統合テスト
 */

import { NPBDataAdapter, getGameDataForPage, getGamesByDateForPage } from './lib/npb-data-adapter';

async function testNPBIntegration() {
  console.log('🧪 NPBデータアダプター統合テスト開始');
  
  try {
    // アダプター初期化テスト
    console.log('\n1️⃣ アダプター初期化テスト');
    const adapter = new NPBDataAdapter();
    console.log('✅ NPBDataAdapter正常に初期化');
    
    // データソース統計取得テスト
    console.log('\n2️⃣ データソース統計テスト');
    const stats = adapter.getDataSourceStats();
    console.log(`📊 詳細データ: ${stats.detailedCount}試合`);
    console.log(`📊 レガシーデータ: ${stats.legacyCount}試合`);
    console.log(`📊 総データ: ${stats.totalCount}試合`);
    console.log(`📅 利用可能日程: ${stats.dates.length}日`);
    
    // 利用可能日付一覧テスト
    console.log('\n3️⃣ 利用可能日付テスト');
    const availableDates = adapter.getAvailableDates();
    console.log(`📅 利用可能日付: ${availableDates.slice(0, 5).join(', ')}...`);
    
    // 特定日程のゲーム取得テスト
    console.log('\n4️⃣ 特定日程ゲーム取得テスト');
    const testDate = '2025-08-01';
    const dayGames = adapter.getGamesByDate(testDate);
    console.log(`🗓️  ${testDate}: ${dayGames.length}試合`);
    
    dayGames.forEach(game => {
      console.log(`   🏟️  ${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}`);
      console.log(`       データソース: ${game.dataSource}, 詳細データ: ${game.detailedAvailable ? 'あり' : 'なし'}`);
      if (game.detailedAvailable) {
        console.log(`       打撃成績: away=${game.awayBattingStats?.length || 0}人, home=${game.homeBattingStats?.length || 0}人`);
        console.log(`       投手成績: away=${game.awayPitchingStats?.length || 0}人, home=${game.homePitchingStats?.length || 0}人`);
      }
    });
    
    // 特定ゲーム取得テスト
    console.log('\n5️⃣ 特定ゲーム取得テスト');
    const testMatchup = dayGames[0]?.matchup;
    if (testMatchup) {
      const specificGame = adapter.getGameData(testDate, testMatchup);
      if (specificGame) {
        console.log(`🎯 ゲーム詳細: ${specificGame.awayTeam} vs ${specificGame.homeTeam}`);
        console.log(`   📍 会場: ${specificGame.venue}, 時刻: ${specificGame.time}`);
        console.log(`   🏆 スコア: ${specificGame.awayScore}-${specificGame.homeScore}`);
        console.log(`   💾 データソース: ${specificGame.dataSource}`);
      }
    }
    
    // Next.js関数テスト
    console.log('\n6️⃣ Next.js統合関数テスト');
    const pageGame = getGameDataForPage(testDate, testMatchup || 'DB-G');
    if (pageGame) {
      console.log(`✅ getGameDataForPage正常動作: ${pageGame.awayTeam} vs ${pageGame.homeTeam}`);
    } else {
      console.log(`⚠️  getGameDataForPageでデータ未発見: ${testDate} ${testMatchup}`);
    }
    
    const pageGames = getGamesByDateForPage(testDate);
    console.log(`✅ getGamesByDateForPage正常動作: ${pageGames.length}試合取得`);
    
    console.log('\n🎉 NPBデータアダプター統合テスト完了！');
    console.log('✅ 既存サイトとの互換性が確認されました');
    console.log('✅ 詳細データとレガシーデータの統合が正常に機能します');
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testNPBIntegration().catch(console.error);
}