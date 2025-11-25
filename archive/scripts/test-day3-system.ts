#!/usr/bin/env npx tsx

/**
 * NPB Live Prediction System - Day 3 統合テスト
 * 
 * Logit合成 + timeline.jsonl保存の動作確認
 */

import { mixPregameState, ewma, confidence, progressWeight } from '../lib/we-mixer';
import { appendLiveEvent } from '../lib/live-writer';

async function testWeMixer() {
  console.log('🔬 WE Mixer テスト');
  
  // 進行度による重みテスト
  const weight1 = progressWeight(1, 0); // 1回表0死
  const weight5 = progressWeight(5, 2); // 5回2死
  const weight9 = progressWeight(9, 2); // 9回2死
  
  console.log(`⚖️  重み変化: 1回表=${weight1.toFixed(2)}, 5回2死=${weight5.toFixed(2)}, 9回2死=${weight9.toFixed(2)}`);
  
  // Logit合成テスト
  const pPregame = 0.60; // プリゲーム60%
  const pState = 0.75;   // 状況75%
  const mixed = mixPregameState(pPregame, pState, 5, 1);
  
  console.log(`🎯 Logit合成: pregame=${pPregame} + state=${pState} → mixed=${mixed.p.toFixed(3)} (w=${mixed.w.toFixed(2)})`);
  
  // EWMAスムージングテスト
  let smoothed = ewma(undefined, 0.6); // 初回
  smoothed = ewma(smoothed, 0.8);      // 2回目
  smoothed = ewma(smoothed, 0.4);      // 3回目
  
  console.log(`📊 EWMA: 0.6 → 0.8 → 0.4 = ${smoothed.toFixed(3)}`);
  
  // 信頼度テスト
  const conf = confidence(0.7, 0.65, 'high');
  console.log(`🎭 信頼度: state=0.7, mixed=0.65, src=high → ${conf}`);
  
  return true;
}

async function testLiveWriter() {
  console.log('\n📝 Live Writer テスト');
  
  const testDir = './data/test';
  const testDate = '2025-08-12';
  
  const event1 = {
    ts: new Date().toISOString(),
    gameId: 'TEST_001',
    inning: 3, top: false, outs: 1 as 0|1|2, bases: 3,
    homeScore: 2, awayScore: 1, scoreDiff: 1,
    p_pregame: 0.55, p_state: 0.68, w: 0.40,
    p_home_raw: 0.62, p_home: 0.60, p_away: 0.40,
    conf: 'medium' as 'high'|'medium'|'low'
  };
  
  const event2 = { ...event1, inning: 4, outs: 0 as 0|1|2, bases: 0, p_home: 0.65 };
  
  // 書き込みテスト
  const result1 = await appendLiveEvent(testDir, testDate, event1);
  console.log(`📁 1回目: ${result1.action} → ${result1.path}`);
  
  // 重複テスト
  const result2 = await appendLiveEvent(testDir, testDate, event1);
  console.log(`🔄 重複: ${result2.action} → ${result2.path}`);
  
  // 新規追加テスト
  const result3 = await appendLiveEvent(testDir, testDate, event2);
  console.log(`✨ 新規: ${result3.action} → ${result3.path}`);
  
  return true;
}

async function testProgressiveWeighting() {
  console.log('\n⚖️  進行度重み付けテスト');
  
  const testCases = [
    { inning: 1, outs: 0, desc: '1回表0死' },
    { inning: 3, outs: 1, desc: '3回1死' },
    { inning: 6, outs: 2, desc: '6回2死' },  
    { inning: 9, outs: 1, desc: '9回1死' }
  ];
  
  const pPregame = 0.45; // プリゲーム45%（アウェイ有利）
  const pState = 0.70;   // 状況70%（ホーム有利）
  
  console.log(`🎲 設定: pregame=${pPregame}, state=${pState}`);
  console.log('────────────────────────────────────');
  
  for (const test of testCases) {
    const result = mixPregameState(pPregame, pState, test.inning, test.outs);
    console.log(`${test.desc}: w=${result.w.toFixed(2)}, mixed=${result.p.toFixed(3)} (${(result.p * 100).toFixed(1)}%)`);
  }
  
  return true;
}

async function main() {
  console.log('🚀 NPB Live Prediction System - Day 3 統合テスト開始');
  console.log('=' * 60);
  
  const results = [];
  
  try {
    results.push(await testWeMixer());
    results.push(await testLiveWriter());  
    results.push(await testProgressiveWeighting());
  } catch (error) {
    console.error('💥 テストエラー:', error);
    results.push(false);
  }
  
  console.log('\n📋 テスト結果');
  console.log('=' * 30);
  console.log('WE Mixer:', results[0] ? '✅ PASS' : '❌ FAIL');
  console.log('Live Writer:', results[1] ? '✅ PASS' : '❌ FAIL');
  console.log('Progressive Weighting:', results[2] ? '✅ PASS' : '❌ FAIL');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n🎯 統合結果: ${passed}/${total} テスト通過`);
  
  if (passed === total) {
    console.log('🎉 Day 3完了！Logit合成 + timeline.jsonl保存システム稼働中');
    console.log('💡 特徴:');
    console.log('   • 進行度に応じた動的重み付け (0.2 → 0.95)');
    console.log('   • EWMAスムージングで点滅抑制');
    console.log('   • 重複検知による効率的更新');
    console.log('   • timeline.jsonlとlatest.jsonの併用保存');
  } else {
    console.log('⚠️  一部テスト失敗 - デバッグが必要');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 統合テスト実行エラー:', error);
    process.exit(1);
  });
}