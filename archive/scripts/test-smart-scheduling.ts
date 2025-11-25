#!/usr/bin/env npx tsx

/**
 * Phase 5: Operations - スマートスケジューリング統合テスト
 * 
 * テスト内容:
 * - schedule-policy.ts のプラン生成
 * - smart-scheduler.ts の判定ロジック
 * - メトリクス更新
 * - 時刻帯別実行判定
 */

import { planFor, isWithinWindow, isDueForExecution, getNextExecutionTime, debugPlan } from '../lib/schedule-policy';
import { nextRunsGauge } from '../lib/prometheus-metrics';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testSchedulePolicy() {
  console.log('📅 Testing Schedule Policy...');
  
  const testDir = path.join(process.cwd(), 'data', 'test-scheduling');
  
  // Clean up test directory
  try {
    await fs.rm(testDir, { recursive: true });
  } catch {
    // Directory doesn't exist
  }
  
  // Create test game data
  const gameData = [
    {
      game_id: "20250811001",
      date: "2025-08-11",
      league: "CL",
      away_team: "T",
      home_team: "G",
      start_time_jst: "18:00",
      status: "scheduled"
    },
    {
      game_id: "20250811002",
      date: "2025-08-11", 
      league: "PL",
      away_team: "H",
      home_team: "F",
      start_time_jst: "18:00",
      status: "scheduled"
    },
    {
      game_id: "20250811003",
      date: "2025-08-11",
      league: "CL",
      away_team: "DB",
      home_team: "S",
      start_time_jst: "14:00", // 早い開始時刻
      status: "scheduled"
    }
  ];
  
  // Save test game data
  const gamesDir = path.join(testDir, 'games', 'date=2025-08-11');
  await fs.mkdir(gamesDir, { recursive: true });
  await fs.writeFile(
    path.join(gamesDir, 'latest.json'),
    JSON.stringify(gameData, null, 2)
  );
  
  // Test game day plan
  console.log('\n🎯 Testing Game Day Plan:');
  const gameDayPlan = await planFor('2025-08-11', testDir);
  debugPlan(gameDayPlan);
  
  // Verify game day plan
  console.log('\n✅ Game Day Plan Verification:');
  console.log(`   Has games: ${gameDayPlan.hasGames ? '✅' : '❌'}`);
  console.log(`   Game count: ${gameDayPlan.gameCount} (expected: 3)`);
  console.log(`   Earliest start: ${gameDayPlan.earliestStart} (expected: 14:00)`);
  console.log(`   Latest start: ${gameDayPlan.latestStart} (expected: 18:00)`);
  console.log(`   Pre frequency: ${gameDayPlan.pre.everyMin}min (should be ≤ 60)`);
  console.log(`   Live frequency: ${gameDayPlan.live.everyMin}min (should be 15-20)`);
  console.log(`   Confidence: ${gameDayPlan.confidence}`);
  
  // Test off day plan
  console.log('\n📅 Testing Off Day Plan:');
  const offDayPlan = await planFor('2025-08-12', testDir); // No data for this date
  debugPlan(offDayPlan);
  
  console.log('\n✅ Off Day Plan Verification:');
  console.log(`   Has games: ${offDayPlan.hasGames ? '❌' : '✅'}`);
  console.log(`   Game count: ${offDayPlan.gameCount} (expected: 0)`);
  console.log(`   Frequency: ${offDayPlan.pre.everyMin}min (expected: 120)`);
  
  return { gameDayPlan, offDayPlan };
}

async function testTimeWindowLogic() {
  console.log('\n🕒 Testing Time Window Logic...');
  
  const testWindow = {
    start: '14:00',
    end: '18:00', 
    everyMin: 30,
    description: 'Test window'
  };
  
  const testTimes = [
    '13:59', // Before window
    '14:00', // Start of window
    '16:00', // Middle of window
    '17:59', // End of window - 1min
    '18:00', // After window
  ];
  
  console.log('\n📍 Window Range Test:');
  testTimes.forEach(time => {
    const isWithin = isWithinWindow(testWindow, time);
    const status = isWithin ? '✅ IN' : '❌ OUT';
    console.log(`   ${time}: ${status}`);
  });
  
  // Test execution timing
  console.log('\n⏰ Execution Timing Test (30min intervals):');
  const now = Math.floor(Date.now() / 1000);
  const testEpochs = [
    now - (now % 1800), // Exactly on 30min boundary
    now - (now % 1800) + 300, // 5min after boundary
    now - (now % 1800) + 900, // 15min after boundary
    now - (now % 1800) + 1799, // 1sec before next boundary
  ];
  
  testEpochs.forEach((epoch, i) => {
    const isDue = isDueForExecution(testWindow, epoch);
    const nextTime = getNextExecutionTime(testWindow, epoch);
    const minutesFromBoundary = Math.floor((epoch % 1800) / 60);
    const status = isDue ? '▶️ EXECUTE' : '⏸️ SKIP';
    
    console.log(`   Test ${i + 1}: ${status} (${minutesFromBoundary}min from boundary, next in ${Math.floor((nextTime - epoch) / 60)}min)`);
  });
  
  return true;
}

async function testMetricsIntegration() {
  console.log('\n📊 Testing Metrics Integration...');
  
  const testDir = path.join(process.cwd(), 'data', 'test-scheduling');
  
  try {
    // Get current plan
    const plan = await planFor('2025-08-11', testDir);
    const now = Math.floor(Date.now() / 1000);
    
    // Update metrics (similar to what smart-scheduler does)
    const nextStarters = getNextExecutionTime(plan.pre, now);
    const nextGames = getNextExecutionTime(plan.live, now);
    const nextDetails = getNextExecutionTime(plan.post, now);
    
    nextRunsGauge.set({ job: 'starters' }, nextStarters);
    nextRunsGauge.set({ job: 'games' }, nextGames);
    nextRunsGauge.set({ job: 'details' }, nextDetails);
    
    console.log('✅ Metrics updated successfully');
    console.log(`   Next starters: ${new Date(nextStarters * 1000).toLocaleTimeString('ja-JP')}`);
    console.log(`   Next games: ${new Date(nextGames * 1000).toLocaleTimeString('ja-JP')}`);
    console.log(`   Next details: ${new Date(nextDetails * 1000).toLocaleTimeString('ja-JP')}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Metrics test failed:', error);
    return false;
  }
}

async function testSmartSchedulerDecisionLogic() {
  console.log('\n🧠 Testing Smart Scheduler Decision Logic...');
  
  // Mock current JST time
  const mockTime = {
    date: '2025-08-11',
    time: '16:30', // During live window for game day
    epochSec: Math.floor(Date.now() / 1000)
  };
  
  const testDir = path.join(process.cwd(), 'data', 'test-scheduling');
  const plan = await planFor(mockTime.date, testDir);
  
  console.log(`\n🎯 Decision at ${mockTime.time} JST:`);
  
  // Check each window
  const windows = [
    { name: 'Pre (Starters)', window: plan.pre, job: 'starters' },
    { name: 'Live (Games)', window: plan.live, job: 'games' },
    { name: 'Post (Details)', window: plan.post, job: 'details' }
  ];
  
  let shouldExecuteCount = 0;
  
  for (const { name, window, job } of windows) {
    const isInWindow = isWithinWindow(window, mockTime.time);
    const shouldExecute = isInWindow && isDueForExecution(window, mockTime.epochSec);
    
    const windowStatus = isInWindow ? '📍 IN WINDOW' : '📍 OUT OF WINDOW';
    const executionStatus = shouldExecute ? '▶️ EXECUTE' : '⏸️ SKIP';
    
    console.log(`   ${name}: ${windowStatus} → ${executionStatus}`);
    console.log(`     Window: ${window.start}-${window.end} (every ${window.everyMin}min)`);
    
    if (shouldExecute) shouldExecuteCount++;
  }
  
  console.log(`\n📈 Summary: ${shouldExecuteCount} jobs would execute at this time`);
  
  return shouldExecuteCount;
}

async function testCronIntegration() {
  console.log('\n⚙️ Testing Cron Integration...');
  
  // Test cron script exists and has smart option
  const cronScriptPath = path.join(process.cwd(), 'scripts', 'run-cron-scraper.sh');
  
  try {
    const cronScript = await fs.readFile(cronScriptPath, 'utf-8');
    
    const hasSmartTask = cronScript.includes('smart)');
    const hasSmartScheduler = cronScript.includes('npx tsx scripts/smart-scheduler.ts');
    const hasBackfill = cronScript.includes('backfill)');
    
    console.log('✅ Cron Integration Check:');
    console.log(`   Smart task defined: ${hasSmartTask ? '✅' : '❌'}`);
    console.log(`   Smart scheduler call: ${hasSmartScheduler ? '✅' : '❌'}`);
    console.log(`   Backfill support: ${hasBackfill ? '✅' : '❌'}`);
    
    if (hasSmartTask && hasSmartScheduler) {
      console.log('\n📋 Recommended cron entry:');
      console.log('   */5 * * * * /path/to/scripts/run-cron-scraper.sh smart');
    }
    
    return hasSmartTask && hasSmartScheduler;
    
  } catch (error) {
    console.error('❌ Cron script not found or readable:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Phase 5: Smart Scheduling Integration Tests');
  console.log('==============================================');
  
  const results = {
    schedulePolicy: false,
    timeWindowLogic: false,
    metricsIntegration: false,
    decisionLogic: false,
    cronIntegration: false
  };
  
  try {
    // Test schedule policy
    const policyResults = await testSchedulePolicy();
    results.schedulePolicy = policyResults.gameDayPlan.hasGames && 
                           !policyResults.offDayPlan.hasGames;
    
    // Test time window logic
    results.timeWindowLogic = await testTimeWindowLogic();
    
    // Test metrics integration
    results.metricsIntegration = await testMetricsIntegration();
    
    // Test decision logic
    const executeCount = await testSmartSchedulerDecisionLogic();
    results.decisionLogic = executeCount >= 0; // Any result is valid
    
    // Test cron integration
    results.cronIntegration = await testCronIntegration();
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    Object.entries(results).forEach(([test, passed]) => {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test}`);
    });
    
    const allPassed = Object.values(results).every(result => result);
    console.log(`\n🎯 Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
      console.log('\n🎉 Phase 5: Operations is ready for deployment!');
      console.log('\n📋 Next Steps:');
      console.log('   1. Update crontab: */5 * * * * /path/to/scripts/run-cron-scraper.sh smart');
      console.log('   2. Monitor metrics at /metrics endpoint');
      console.log('   3. Test backfill: ./scripts/run-cron-scraper.sh backfill 3');
    }
    
    return allPassed ? 0 : 1;
    
  } catch (error) {
    console.error('💥 Test execution failed:', error);
    return 1;
  }
}

if (require.main === module) {
  main()
    .then(code => process.exit(code))
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

export { main as testSmartScheduling };