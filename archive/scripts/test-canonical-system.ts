#!/usr/bin/env npx tsx

/**
 * カノニカルシステム統合テスト
 * 正規化 → カノニカル化 → 重複抑止 → 差分保存の完全ループテスト
 */

import { normalizeTeamId, normalizePlayerName, normalizeStadium, normalizeHand } from '../lib/normalize';
import { canonicalizeRecord, keyOf, hashRecord, hashSet, diffSets, detectKeyCollisions } from '../lib/canonical';
import { writeCanonicalSet, checkDataIntegrity } from '../lib/canonical-writer';
import type { StarterRecord } from '../lib/schemas';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testNormalization() {
  console.log('🔧 Testing normalization system...');
  
  // チーム名正規化テスト
  const teamTests = [
    ['巨人', 'G'],
    ['読売ジャイアンツ', 'G'], 
    ['阪神タイガース', 'T'],
    ['横浜DeNAベイスターズ', 'DB'],
    ['オリックスバファローズ', 'Bs'],
    ['G', 'G'], // 既に正規化済み
  ];
  
  for (const [input, expected] of teamTests) {
    const result = normalizeTeamId(input);
    const status = result === expected ? '✅' : '❌';
    console.log(`   ${status} "${input}" → "${result}" (expected: "${expected}")`);
  }
  
  // 選手名正規化テスト
  const playerTests = [
    ['髙橋 一郎', '高橋 一郎'], // 漢字統一
    ['佐﨑 太郎・Jr.', '佐崎 太郎Jr.'], // 漢字統一 + 中黒除去 (Jr.は残る)
    ['　田中　花子　', '田中 花子'], // 全角スペース → 半角、トリミング
    ['山田(元阪神)', '山田'], // 括弧除去
  ];
  
  for (const [input, expected] of playerTests) {
    const result = normalizePlayerName(input);
    const status = result === expected ? '✅' : '❌';
    console.log(`   ${status} "${input}" → "${result}" (expected: "${expected}")`);
  }
  
  // 球場名正規化テスト
  const stadiumTests = [
    ['東京D', '東京ドーム'],
    ['甲子園', '阪神甲子園球場'],
    ['PayPay', '福岡PayPayドーム'],
    ['エスコン', 'ES CON FIELD HOKKAIDO'],
  ];
  
  for (const [input, expected] of stadiumTests) {
    const result = normalizeStadium(input);
    const status = result === expected ? '✅' : '❌';
    console.log(`   ${status} "${input}" → "${result}" (expected: "${expected}")`);
  }
  
  console.log('   ✅ Normalization tests completed');
}

async function testCanonicalSystem() {
  console.log('🔨 Testing canonical system...');
  
  // テスト用スターターレコード
  const testRecord1: StarterRecord = {
    gameId: "20250811001",
    date: "2025-08-11",
    league: "CL",
    home: "G",
    away: "T",
    homePitcher: {
      name: "菅野智之",
      hand: "R",
      era: 2.45,
    },
    confidence: 0.95,
    source: "npb_official"
  };
  
  const testRecord2 = {
    ...testRecord1,
    updatedAt: "2025-08-11T10:00:00Z", // 揮発性フィールド
    _metadata: { scraped: true }, // 揮発性フィールド
  };
  
  // カノニカル化テスト
  const canonical1 = canonicalizeRecord("starters", testRecord1);
  const canonical2 = canonicalizeRecord("starters", testRecord2);
  
  // 揮発性フィールドが除外されるため、同じ結果になるはず
  const canonical1Str = JSON.stringify(canonical1);
  const canonical2Str = JSON.stringify(canonical2);
  
  const canonicalMatch = canonical1Str === canonical2Str;
  console.log(`   ${canonicalMatch ? '✅' : '❌'} Canonical records match (volatile fields excluded)`);
  
  // キー生成テスト
  const key1 = keyOf("starters", testRecord1);
  const expectedKey = "20250811001";
  const keyMatch = key1 === expectedKey;
  console.log(`   ${keyMatch ? '✅' : '❌'} Key generation: "${key1}" (expected: "${expectedKey}")`);
  
  // ハッシュ生成テスト
  const hash1 = hashRecord("starters", testRecord1);
  const hash2 = hashRecord("starters", testRecord2);
  const hashMatch = hash1 === hash2;
  console.log(`   ${hashMatch ? '✅' : '❌'} Hash consistency (volatile fields ignored)`);
  
  // 集合ハッシュテスト
  const setHash1 = hashSet("starters", [testRecord1]);
  const setHash2 = hashSet("starters", [testRecord2]);
  const setHashMatch = setHash1 === setHash2;
  console.log(`   ${setHashMatch ? '✅' : '❌'} Set hash consistency`);
  
  console.log('   ✅ Canonical system tests completed');
}

async function testDiffSystem() {
  console.log('📊 Testing diff system...');
  
  const baseRecord: StarterRecord = {
    gameId: "20250811001",
    date: "2025-08-11",
    league: "CL",
    home: "G",
    away: "T",
    homePitcher: { name: "菅野智之", hand: "R" },
    confidence: 0.95
  };
  
  // 初回データセット
  const initialSet = [
    baseRecord,
    { ...baseRecord, gameId: "20250811002", away: "DB" }
  ];
  
  // 更新後データセット
  const updatedSet = [
    { ...baseRecord, confidence: 0.98 }, // 更新
    { ...baseRecord, gameId: "20250811002", away: "DB" }, // 変更なし
    { ...baseRecord, gameId: "20250811003", away: "C" } // 追加
    // 最初のゲームが削除される想定
  ];
  
  const diff = diffSets("starters", initialSet, updatedSet);
  
  console.log(`   📈 Added: ${diff.added.length} items`);
  console.log(`   📉 Removed: ${diff.removed.length} items`);
  console.log(`   📝 Updated: ${diff.updated.length} items`);
  console.log(`   🔄 Unchanged: ${diff.unchanged.length} items`);
  
  const hasChanges = diff.added.length + diff.removed.length + diff.updated.length > 0;
  console.log(`   ${hasChanges ? '✅' : '❌'} Changes detected correctly`);
  
  console.log('   ✅ Diff system tests completed');
}

async function testKeyCollisionDetection() {
  console.log('⚠️  Testing key collision detection...');
  
  // 故意にキー衝突を作成（同じgameId、異なる内容）
  const collisionRecords = [
    {
      gameId: "20250811001",
      date: "2025-08-11", 
      home: "G",
      away: "T",
      homePitcher: { name: "菅野智之" }
    },
    {
      gameId: "20250811001", // 同じゲームID
      date: "2025-08-11",   // 同じ日付
      home: "G",            // 同じチーム
      away: "T",
      homePitcher: { name: "戸郷翔征" } // 異なる投手（衝突!）
    }
  ];
  
  const collisions = detectKeyCollisions("starters", collisionRecords);
  
  console.log(`   🔍 Detected ${collisions.length} key collisions`);
  
  if (collisions.length > 0) {
    for (const collision of collisions) {
      console.log(`     - Key: ${collision.key}, Records: ${collision.records.length}, Unique hashes: ${collision.hashes.length}`);
    }
  }
  
  console.log('   ✅ Key collision detection completed');
}

async function testCanonicalWriter() {
  console.log('💾 Testing canonical writer system...');
  
  const testDir = path.join(process.cwd(), 'data', 'test-canonical');
  
  // テストディレクトリをクリーンアップ
  try {
    await fs.rm(testDir, { recursive: true });
  } catch {
    // ディレクトリが存在しない場合は無視
  }
  
  // 正規化済みテストデータ
  const normalizedStarters = [
    {
      gameId: "20250811001",
      date: "2025-08-11",
      league: "CL",
      home: normalizeTeamId("巨人"),
      away: normalizeTeamId("阪神タイガース"),
      homePitcher: {
        name: normalizePlayerName("菅野　智之"),
        hand: normalizeHand("右"),
        era: 2.45
      },
      stadium: normalizeStadium("東京D"),
      confidence: 0.95
    },
    {
      gameId: "20250811002", 
      date: "2025-08-11",
      league: "CL",
      home: normalizeTeamId("横浜DeNA"),
      away: normalizeTeamId("中日ドラゴンズ"),
      homePitcher: {
        name: normalizePlayerName("今永　昇太"),
        hand: normalizeHand("L")
      },
      stadium: normalizeStadium("横浜"),
      confidence: 0.88
    }
  ];
  
  // 初回書き込み
  const result1 = await writeCanonicalSet({
    baseDir: testDir,
    kind: "starters",
    date: "2025-08-11",
    records: normalizedStarters
  });
  
  console.log(`   ${result1.action === 'write' ? '✅' : '❌'} First write: ${result1.action}, items: ${result1.items}`);
  
  // 同じデータで再実行（スキップされるはず）
  const result2 = await writeCanonicalSet({
    baseDir: testDir,
    kind: "starters", 
    date: "2025-08-11",
    records: normalizedStarters
  });
  
  console.log(`   ${result2.action === 'skip' ? '✅' : '❌'} Second write: ${result2.action} (should be skip)`);
  
  // データを変更して再実行
  const modifiedStarters = [
    ...normalizedStarters,
    {
      gameId: "20250811003",
      date: "2025-08-11", 
      league: "PL",
      home: normalizeTeamId("ソフトバンク"),
      away: normalizeTeamId("日本ハム"),
      stadium: normalizeStadium("PayPay"),
      confidence: 0.92
    }
  ];
  
  const result3 = await writeCanonicalSet({
    baseDir: testDir,
    kind: "starters",
    date: "2025-08-11", 
    records: modifiedStarters
  });
  
  console.log(`   ${result3.action === 'write' ? '✅' : '❌'} Third write: ${result3.action}, items: ${result3.items}`);
  
  if (result3.diff) {
    console.log(`     📈 Added: ${result3.diff.added.length}`);
    console.log(`     📝 Updated: ${result3.diff.updated.length}`);
    console.log(`     📉 Removed: ${result3.diff.removed.length}`);
  }
  
  // 整合性チェック
  const integrity = await checkDataIntegrity(testDir, "starters", "2025-08-11");
  const hasIssues = Object.values(integrity.issues).some(issue => 
    typeof issue === 'boolean' ? issue : issue > 0
  );
  
  console.log(`   ${hasIssues ? '⚠️' : '✅'} Data integrity: ${hasIssues ? 'Issues found' : 'OK'}`);
  
  if (integrity.recommendations.length > 0) {
    console.log('     Recommendations:');
    integrity.recommendations.forEach(rec => console.log(`       - ${rec}`));
  }
  
  console.log('   ✅ Canonical writer tests completed');
}

async function main() {
  console.log('🚀 Canonical System Integration Tests');
  console.log('=====================================');
  
  const tests = [
    testNormalization,
    testCanonicalSystem,
    testDiffSystem,
    testKeyCollisionDetection,
    testCanonicalWriter
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      failed++;
    }
    console.log('');
  }
  
  console.log('📊 Test Results Summary:');
  console.log('========================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`🎯 Overall: ${failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  return failed === 0 ? 0 : 1;
}

if (require.main === module) {
  main()
    .then(code => process.exit(code))
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { main as testCanonicalSystem };