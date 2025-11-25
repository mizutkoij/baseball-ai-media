#!/usr/bin/env npx tsx

/**
 * 正しいBaseballData.jp URL構造でのテストスクリプト
 * ID形式: 入団年-1 + 連番
 */

import { BaseballDataScraper } from '../lib/baseballdata-scraper';

async function testCorrectURLStructure() {
  const scraper = new BaseballDataScraper();
  
  console.log('🔍 正しいBaseballData.jp URL構造テスト開始');
  console.log('ID形式: 入団年-1 + 連番');
  
  // テスト対象のプレイヤーID
  const testCases = [
    { playerId: '2000001', expectedEntry: 2021, expectedData: 2022 },
    { playerId: '2000002', expectedEntry: 2021, expectedData: 2022 },
    { playerId: '1900001', expectedEntry: 2020, expectedData: 2021 },
    { playerId: '1900002', expectedEntry: 2020, expectedData: 2021 },
    { playerId: '1800001', expectedEntry: 2019, expectedData: 2020 },
    { playerId: '700001', expectedEntry: 2008, expectedData: 2009 },
  ];
  
  console.log('\\n📋 テストケース:');
  testCases.forEach(test => {
    console.log(`  ${test.playerId} → ${test.expectedEntry}年入団 (${test.expectedData}年データ)`);
  });
  
  console.log('\\n🚀 実行開始...');
  
  for (const testCase of testCases) {
    try {
      console.log(`\\n--- ${testCase.playerId} テスト ---`);
      
      // ID解析テスト
      const parsed = scraper.parsePlayerId(testCase.playerId);
      console.log(`  解析結果: 入団年=${parsed.entryYear}, データ年=${parsed.dataYear}`);
      
      if (parsed.entryYear !== testCase.expectedEntry) {
        console.log(`  ❌ 入団年不一致: 期待=${testCase.expectedEntry}, 実際=${parsed.entryYear}`);
        continue;
      }
      
      if (parsed.dataYear !== testCase.expectedData) {
        console.log(`  ❌ データ年不一致: 期待=${testCase.expectedData}, 実際=${parsed.dataYear}`);
        continue;
      }
      
      console.log(`  ✅ ID解析正常`);
      
      // プレイヤー検索テスト
      const player = await scraper.discoverPlayer(testCase.playerId);
      
      if (player) {
        console.log(`  ✅ プレイヤー発見:`);
        console.log(`     名前: ${player.name}`);
        console.log(`     チーム: ${player.team}`);
        console.log(`     タイプ: ${player.player_type}`);
        console.log(`     ポジション: ${player.position}`);
      } else {
        console.log(`  ⚠️  プレイヤー未発見 (ルーキー未出場の可能性)`);
      }
      
      // 間隔を開ける
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.log(`  ❌ エラー: ${error}`);
    }
  }
  
  console.log('\\n🎯 テスト完了!');
  console.log('\\n📊 結果サマリー:');
  console.log('  - ID解析ロジックの検証');
  console.log('  - URL構造の確認');  
  console.log('  - プレイヤーデータの取得テスト');
}

if (require.main === module) {
  testCorrectURLStructure().catch(console.error);
}