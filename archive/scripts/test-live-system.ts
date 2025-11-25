#!/usr/bin/env npx tsx

/**
 * NPB Live Prediction System - Day 2 テスト
 * 
 * WE/RE24テーブルとライブ特徴量の動作確認
 */

// テストデータとシンプルなテスト実行
const testGameState = {
  gameId: 'test_game_001',
  date: '2025-08-11',
  inning: 3,
  top: false,  // 3回裏
  outs: 1,     // 1死
  bases: 3,    // 1・2塁 (1+2=3)
  homeScore: 2,
  awayScore: 1,
  pitcher: '田中 将大',
  batter: '大谷 翔平', 
  lastPlay: 'ヒット',
  timestamp: new Date().toISOString(),
  eventIndex: 3120
};

async function testWinExpectancy() {
  console.log('🎯 Win Expectancy テーブルテスト');
  
  try {
    // 型を動的にインポートしてテスト
    const { getWinExpectancy, gameStateToWinExpectancyKey, formatGameSituation } = await import('../lib/win-expectancy');
    
    const key = gameStateToWinExpectancyKey(testGameState);
    const expectancy = getWinExpectancy(key);
    
    console.log('📊 状況:', formatGameSituation(key));
    console.log('📈 ホーム勝率:', (expectancy.home_win_probability * 100).toFixed(1) + '%');
    console.log('🏃 得点期待値:', expectancy.run_expectancy.toFixed(2));
    console.log('🎯 信頼度:', expectancy.confidence);
    
    return true;
  } catch (error) {
    console.error('❌ Win Expectancy テスト失敗:', error);
    return false;
  }
}

async function testLiveFeatures() {
  console.log('\n🔬 Live Features テスト');
  
  try {
    const { extractLiveFeatures } = await import('../lib/live-features');
    
    const features = extractLiveFeatures(testGameState);
    
    console.log('🎮 ゲームID:', features.game_id);
    console.log('⚾ 状況:', `${features.inning}${features.top ? '表' : '裏'} ${features.outs}死`);
    console.log('📊 スコア:', `${features.away_score}-${features.home_score} (差${features.score_diff})`);
    console.log('📈 勝率期待:', (features.win_expectancy * 100).toFixed(1) + '%');
    console.log('🏃 得点期待:', features.run_expectancy.toFixed(2));
    console.log('⏰ 進行度:', (features.game_progress * 100).toFixed(1) + '%');
    console.log('🔥 後半戦:', features.is_late_game ? '✅' : '❌');
    console.log('⚡ 接戦:', features.is_close_game ? '✅' : '❌');
    console.log('⏱️ 処理時間:', features.extraction_latency_ms + 'ms');
    
    return true;
  } catch (error) {
    console.error('❌ Live Features テスト失敗:', error);
    return false;
  }
}

async function testLiveStateStore() {
  console.log('\n🏪 Live State Store テスト');
  
  try {
    const { getLiveStateStore } = await import('../lib/live-state');
    
    const store = getLiveStateStore();
    
    // 状態更新テスト
    const event = store.upsertState(testGameState);
    
    if (event) {
      console.log('📢 イベント生成:', event.type);
      console.log('🎯 ゲーム状況更新成功');
    }
    
    // 状態取得テスト
    const state = store.getState(testGameState.gameId);
    if (state) {
      console.log('💾 状態取得成功:', state.gameId);
      console.log('⚾ 現在状況:', `${state.inning}${state.top ? '表' : '裏'} ${state.outs}死`);
    }
    
    console.log('📊 デバッグ情報:', JSON.stringify(store.getDebugInfo(), null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Live State Store テスト失敗:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 NPB Live Prediction System - Day 2 テスト開始');
  console.log('=' * 50);
  
  const results = [];
  
  results.push(await testWinExpectancy());
  results.push(await testLiveFeatures());
  results.push(await testLiveStateStore());
  
  console.log('\n📋 テスト結果');
  console.log('=' * 30);
  console.log('Win Expectancy:', results[0] ? '✅ PASS' : '❌ FAIL');
  console.log('Live Features:', results[1] ? '✅ PASS' : '❌ FAIL');
  console.log('Live State Store:', results[2] ? '✅ PASS' : '❌ FAIL');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n🎯 総合結果: ${passed}/${total} テスト通過`);
  
  if (passed === total) {
    console.log('🎉 Day 2 実装完了！WE/RE24 + ライブ特徴量システム稼働中');
  } else {
    console.log('⚠️  一部テスト失敗 - デバッグが必要');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 テスト実行エラー:', error);
    process.exit(1);
  });
}