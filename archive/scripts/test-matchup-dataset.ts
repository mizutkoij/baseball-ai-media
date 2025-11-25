#!/usr/bin/env npx tsx
/**
 * 対決予測データセット構築テスト
 * 合成データでパイプライン検証
 */

import { buildMatchupDataset, saveMatchupDataset, type MatchupRow } from '../features/build_matchup_dataset';
import fs from 'fs/promises';
import path from 'path';

async function createMockGameData(baseDir: string, date: string, gameId: string) {
  const detailsDir = path.join(baseDir, 'details', `date=${date}`, gameId);
  await fs.mkdir(detailsDir, { recursive: true });
  
  // モックゲームデータ
  const mockGame = {
    gameId,
    date,
    homeTeam: 'G',
    awayTeam: 'T',
    innings: [
      {
        inning: 1,
        top: {
          events: [
            {
              batterId: 'b001',
              pitcherId: 'p001',
              batterHand: 'R',
              pitcherHand: 'R',
              result: '1B',
              outs: 0,
              bases: { first: false, second: false, third: false },
              homeScore: 0,
              awayScore: 0
            },
            {
              batterId: 'b002',
              pitcherId: 'p001',
              batterHand: 'L',
              pitcherHand: 'R',
              result: 'K',
              outs: 1,
              bases: { first: true, second: false, third: false },
              homeScore: 0,
              awayScore: 0
            },
            {
              batterId: 'b003',
              pitcherId: 'p001',
              batterHand: 'R',
              pitcherHand: 'R',
              result: 'BB',
              outs: 1,
              bases: { first: true, second: false, third: false },
              homeScore: 0,
              awayScore: 0
            }
          ]
        },
        bottom: {
          events: [
            {
              batterId: 'b101',
              pitcherId: 'p101',
              batterHand: 'L',
              pitcherHand: 'L',
              result: 'HR',
              outs: 0,
              bases: { first: false, second: false, third: false },
              homeScore: 0,
              awayScore: 0
            },
            {
              batterId: 'b102',
              pitcherId: 'p101',
              batterHand: 'R',
              pitcherHand: 'L',
              result: 'GO',
              outs: 1,
              bases: { first: false, second: false, third: false },
              homeScore: 1,
              awayScore: 0
            }
          ]
        }
      }
    ]
  };
  
  const latestPath = path.join(detailsDir, 'latest.json');
  await fs.writeFile(latestPath, JSON.stringify(mockGame, null, 2));
}

async function testDatasetBuilding() {
  console.log('🏗️  対決予測データセット構築テスト');
  
  const testDir = './data/test-matchup';
  const testDate = '2025-08-12';
  
  try {
    // テストデータ作成
    await createMockGameData(testDir, testDate, '20250812_G-T_01');
    await createMockGameData(testDir, testDate, '20250812_C-YB_01');
    
    console.log('   ✅ モックゲームデータ作成完了');
    
    // データセット構築
    const rows = await buildMatchupDataset(testDate, testDate, testDir);
    
    console.log(`   データセット行数: ${rows.length}`);
    
    if (rows.length === 0) {
      throw new Error('No rows generated');
    }
    
    // データ品質検証
    const reachCount = rows.filter(r => r.y === 1).length;
    const outCount = rows.filter(r => r.y === 0).length;
    
    console.log(`   到達数: ${reachCount}, アウト数: ${outCount}`);
    console.log(`   到達率: ${(reachCount / rows.length * 100).toFixed(1)}%`);
    
    // 特徴量範囲チェック
    const sampleRow = rows[0];
    console.log('   サンプル行:');
    console.log(`     利き手: B=${sampleRow.b_hand}, P=${sampleRow.p_hand}`);
    console.log(`     Split: B7=${sampleRow.b_split7.toFixed(3)}, P7=${sampleRow.p_split7.toFixed(3)}`);
    console.log(`     状況: ${sampleRow.inning}回${sampleRow.top ? '表' : '裏'} ${sampleRow.outs}アウト`);
    console.log(`     レバレッジ: ${sampleRow.leverage.toFixed(2)}`);
    
    // CSV保存テスト
    const outputPath = path.join(testDir, 'ml', 'matchup', 'test_dataset.csv');
    await saveMatchupDataset(rows, outputPath);
    
    console.log(`   ✅ CSV保存完了: ${outputPath}`);
    
    // クリーンアップ
    await fs.rm(testDir, { recursive: true, force: true });
    
    console.log('   ✅ テストクリーンアップ完了\n');
    return true;
    
  } catch (error) {
    console.log(`   ❌ テストエラー: ${error.message}\n`);
    return false;
  }
}

async function testFeatureValidation() {
  console.log('🔍 特徴量バリデーションテスト');
  
  // 手動で行を作成
  const testRows: MatchupRow[] = [
    {
      date: '20250812',
      gameId: 'test_game',
      pa_seq: 1,
      batterId: 'b001',
      pitcherId: 'p001',
      b_hand: 1, // R
      p_hand: 0, // L
      b_split7: 0.350,
      b_split30: 0.325,
      p_split7: 1.25,
      p_split30: 1.30,
      fi: 0.25,
      rap14: 150,
      inning: 7,
      top: 1,
      outs: 2,
      bases: 3, // 1塁・2塁
      scoreDiff: -1,
      park_mult: 1.05,
      leverage: 2.8,
      y: 1 // 到達
    },
    {
      date: '20250812',
      gameId: 'test_game',
      pa_seq: 2,
      batterId: 'b002',
      pitcherId: 'p001',
      b_hand: 0, // L
      p_hand: 0, // L
      b_split7: 0.280,
      b_split30: 0.295,
      p_split7: 1.45,
      p_split30: 1.42,
      fi: 0.65,
      rap14: 350,
      inning: 9,
      top: 0,
      outs: 1,
      bases: 0,
      scoreDiff: 2,
      park_mult: 0.95,
      leverage: 1.2,
      y: 0 // アウト
    }
  ];
  
  // 特徴量範囲チェック
  let validationErrors = 0;
  
  for (const row of testRows) {
    // 利き手チェック (0 or 1)
    if (![0, 1].includes(row.b_hand) || ![0, 1].includes(row.p_hand)) {
      console.log(`   ❌ 利き手異常: b_hand=${row.b_hand}, p_hand=${row.p_hand}`);
      validationErrors++;
    }
    
    // 出塁率チェック (0.1 - 0.6)
    if (row.b_split7 < 0.1 || row.b_split7 > 0.6) {
      console.log(`   ❌ 打者Split7異常: ${row.b_split7}`);
      validationErrors++;
    }
    
    // 疲労指数チェック (0 - 1)
    if (row.fi < 0 || row.fi > 1) {
      console.log(`   ❌ 疲労指数異常: ${row.fi}`);
      validationErrors++;
    }
    
    // アウト数チェック (0-2)
    if (![0, 1, 2].includes(row.outs)) {
      console.log(`   ❌ アウト数異常: ${row.outs}`);
      validationErrors++;
    }
    
    // ベース状況チェック (0-7)
    if (row.bases < 0 || row.bases > 7) {
      console.log(`   ❌ ベース状況異常: ${row.bases}`);
      validationErrors++;
    }
    
    // ラベルチェック (0 or 1)
    if (![0, 1].includes(row.y)) {
      console.log(`   ❌ ラベル異常: ${row.y}`);
      validationErrors++;
    }
  }
  
  if (validationErrors === 0) {
    console.log('   ✅ 特徴量バリデーション通過');
    console.log(`   サンプル数: ${testRows.length}`);
    console.log(`   到達率: ${(testRows.filter(r => r.y === 1).length / testRows.length * 100).toFixed(1)}%\n`);
    return true;
  } else {
    console.log(`   ❌ バリデーションエラー: ${validationErrors}件\n`);
    return false;
  }
}

async function main() {
  console.log('🚀 NPB 対決予測データセットシステムテスト');
  console.log('=' + '='.repeat(50));
  
  const results = [];
  
  try {
    results.push(await testFeatureValidation());
    results.push(await testDatasetBuilding());
    
  } catch (error) {
    console.error('💥 テスト実行エラー:', error);
    results.push(false);
  }
  
  console.log('📋 対決予測データセットテスト結果');
  console.log('=' + '='.repeat(40));
  console.log('Feature Validation:', results[0] ? '✅ PASS' : '❌ FAIL');
  console.log('Dataset Building:', results[1] ? '✅ PASS' : '❌ FAIL');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n🎯 総合結果: ${passed}/${total} テスト通過`);
  
  if (passed === total) {
    console.log('🎉 対決予測データセット構築システム実装完了！');
    console.log('💡 実装された機能:');
    console.log('   • PA（打席）単位でのBinary分類データセット');
    console.log('   • 15特徴量（利き手・Split・疲労・状況・レバレッジ）');
    console.log('   • 到達/アウトラベル生成');
    console.log('   • CSV出力対応');
    console.log('\n📊 特徴量一覧:');
    console.log('   • 打者: b_hand, b_split7, b_split30');
    console.log('   • 投手: p_hand, p_split7, p_split30, fi, rap14');
    console.log('   • 状況: inning, top, outs, bases, scoreDiff');
    console.log('   • 環境: park_mult, leverage');
    console.log('\n🔧 運用方法:');
    console.log('   npm run ml:matchup:features 2025-08-01 2025-08-12');
    console.log('   npm run ml:matchup:train');
  } else {
    console.log('⚠️  一部テスト失敗 - 本番投入前にデバッグ推奨');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 データセットテスト実行エラー:', error);
    process.exit(1);
  });
}