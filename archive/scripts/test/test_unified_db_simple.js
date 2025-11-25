const Database = require('better-sqlite3');
const { existsSync } = require('fs');

const CURRENT_PATH = './data/db_current.db';
const HISTORY_PATH = './data/db_history.db';

// Simple query function for testing
function testQuery(sql, params = []) {
  console.log(`🔍 Testing query: ${sql}`);
  
  if (!existsSync(CURRENT_PATH) || !existsSync(HISTORY_PATH)) {
    console.error('❌ Database files not found');
    return;
  }

  const dbCurrent = new Database(CURRENT_PATH, { readonly: true });
  const dbHistory = new Database(HISTORY_PATH, { readonly: true });

  try {
    // Try current first
    console.log('  📊 Current DB results:');
    const currentResults = dbCurrent.prepare(sql).all(...params);
    console.log('   ', currentResults);

    console.log('  📚 History DB results:');
    const historyResults = dbHistory.prepare(sql).all(...params);
    console.log('   ', historyResults);

    const totalResults = [...currentResults, ...historyResults];
    console.log(`  ✅ Combined: ${totalResults.length} records`);
    
    return totalResults;
  } catch (error) {
    console.error('  ❌ Query failed:', error.message);
  } finally {
    dbCurrent.close();
    dbHistory.close();
  }
}

console.log('🧪 Testing unified database access (simple version)...');

// Test 1: Basic counts
console.log('\n=== Test 1: Record counts ===');
testQuery('SELECT COUNT(*) as count FROM games');

// Test 2: Date ranges
console.log('\n=== Test 2: Date ranges ===');
testQuery('SELECT MIN(date) as earliest, MAX(date) as latest FROM games');

// Test 3: Sample games
console.log('\n=== Test 3: Sample games ===');
testQuery('SELECT game_id, date, away_team, home_team FROM games ORDER BY date LIMIT 3');

// Test 4: Year-specific query
console.log('\n=== Test 4: 2025 games ===');
testQuery("SELECT COUNT(*) as count FROM games WHERE date >= '2025-01-01'");

console.log('\n✅ Simple unified database test completed!');