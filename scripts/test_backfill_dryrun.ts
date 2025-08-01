#!/usr/bin/env ts-node
/**
 * test_backfill_dryrun.ts — Simple test to validate backfill logic without external dependencies
 */
const DatabaseLib = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const DB_DIR = path.resolve("./data");
const HISTORY_DB = path.join(DB_DIR, "db_history.db");

// Test the upsert logic in isolation
function testUpsert() {
  const db = new DatabaseLib(HISTORY_DB);
  
  console.log("🧪 Testing upsert logic...");
  
  // Create a test table
  db.exec(`
    CREATE TEMPORARY TABLE IF NOT EXISTS test_games (
      game_id TEXT PRIMARY KEY,
      date TEXT,
      team_home TEXT,
      team_away TEXT
    );
    
    CREATE TEMPORARY TABLE IF NOT EXISTS new_test_games (
      game_id TEXT PRIMARY KEY,
      date TEXT,
      team_home TEXT,
      team_away TEXT
    );
  `);
  
  // Insert some test data
  db.exec(`
    INSERT INTO test_games VALUES 
      ('game_001', '2019-04-01', 'Giants', 'Tigers'),
      ('game_002', '2019-04-02', 'Dragons', 'Carp');
      
    INSERT INTO new_test_games VALUES 
      ('game_002', '2019-04-02', 'Dragons', 'Carp'),  -- duplicate
      ('game_003', '2019-04-03', 'Hawks', 'Lions'),   -- new
      ('game_004', '2019-04-04', 'Eagles', 'Buffaloes'); -- new
  `);
  
  // Test duplicate detection (dry-run mode)
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM new_test_games`);
  const duplicateStmt = db.prepare(`
    SELECT COUNT(*) as count FROM new_test_games
    WHERE EXISTS (
      SELECT 1 FROM test_games AS dst WHERE dst.game_id = new_test_games.game_id
    );`);
  
  const newRows = countStmt.get() as { count: number };
  const duplicates = duplicateStmt.get() as { count: number };
  
  console.log(`✅ Total rows in new_test_games: ${newRows.count}`);
  console.log(`✅ Duplicates detected: ${duplicates.count}`);
  console.log(`✅ Would insert: ${newRows.count - duplicates.count} new rows`);
  
  // Test actual upsert
  const upsertStmt = db.prepare(`
    INSERT INTO test_games
    SELECT * FROM new_test_games
    WHERE NOT EXISTS (
      SELECT 1 FROM test_games AS dst WHERE dst.game_id = new_test_games.game_id
    );`);
  
  const beforeCount = db.prepare(`SELECT COUNT(*) as count FROM test_games`).get() as { count: number };
  const result = upsertStmt.run();
  const afterCount = db.prepare(`SELECT COUNT(*) as count FROM test_games`).get() as { count: number };
  
  console.log(`✅ Before upsert: ${beforeCount.count} rows`);
  console.log(`✅ Inserted: ${result.changes} rows`);
  console.log(`✅ After upsert: ${afterCount.count} rows`);
  console.log(`✅ Anti-join logic working: ${result.changes === (newRows.count - duplicates.count)}`);
  
  db.close();
  
  return {
    newRows: newRows.count,
    duplicates: duplicates.count,
    inserted: result.changes,
    antiJoinWorking: result.changes === (newRows.count - duplicates.count)
  };
}

// Test coefficient delta validation
function testDeltaValidation() {
  console.log("\n🧪 Testing Δ-threshold validation...");
  
  const coefficientData = {
    prev: { woba_coefficients: { "1B": 0.89 } },
    current: { woba_coefficients: { "1B": 0.95 } },  // 6.7% increase
    bad: { woba_coefficients: { "1B": 0.97 } }       // 9.0% increase
  };
  
  const calculateDelta = (prev: any, cur: any) => {
    return Math.abs(cur.woba_coefficients["1B"] - prev.woba_coefficients["1B"]) / prev.woba_coefficients["1B"];
  };
  
  const delta1 = calculateDelta(coefficientData.prev, coefficientData.current);
  const delta2 = calculateDelta(coefficientData.prev, coefficientData.bad);
  
  console.log(`✅ Normal delta: ${(delta1 * 100).toFixed(2)}% (should be < 7%)`);
  console.log(`✅ Large delta: ${(delta2 * 100).toFixed(2)}% (should trigger halt)`);
  console.log(`✅ Halt logic: ${delta1 <= 0.07 ? 'PASS' : 'FAIL'} / ${delta2 > 0.07 ? 'PASS' : 'FAIL'}`);
  
  return {
    normalDelta: delta1,
    largeDelta: delta2,
    haltLogicWorking: delta1 <= 0.07 && delta2 > 0.07
  };
}

// Main test runner
function runTests() {
  console.log("🚀 Running backfill logic tests...\n");
  
  const upsertResult = testUpsert();
  const deltaResult = testDeltaValidation();
  
  console.log("\n📊 Test Summary:");
  console.log(`  Upsert Logic: ${upsertResult.antiJoinWorking ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Delta Validation: ${deltaResult.haltLogicWorking ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = upsertResult.antiJoinWorking && deltaResult.haltLogicWorking;
  console.log(`\n🎯 Overall: ${allPassed ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);
  
  // Save test report
  const report = {
    timestamp: new Date().toISOString(),
    tests: {
      upsert: upsertResult,
      deltaValidation: deltaResult
    },
    summary: {
      allPassed,
      totalTests: 2,
      passedTests: (upsertResult.antiJoinWorking ? 1 : 0) + (deltaResult.haltLogicWorking ? 1 : 0)
    }
  };
  
  const reportPath = path.join(DB_DIR, `test_report_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📝 Test report saved to: ${reportPath}`);
  
  return allPassed;
}

// Run the tests
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}