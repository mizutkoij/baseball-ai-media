const { query, unionQuery, get, getDbStats, selectDbByYear } = require('../lib/db.ts');

async function testUnifiedDb() {
  console.log('🧪 Testing unified database access...');

  try {
    // 1. Database stats
    console.log('\n📊 Database statistics:');
    const stats = await getDbStats();
    console.log('  Current DB:', stats.current);
    console.log('  History DB:', stats.history);
    console.log('  Total games:', stats.current.games + stats.history.games);

    // 2. Year-based DB selection
    console.log('\n📅 Year-based database selection:');
    console.log('  2025 data → ', selectDbByYear(2025));
    console.log('  2023 data → ', selectDbByYear(2023));
    console.log('  2020 data → ', selectDbByYear(2020));

    // 3. Query with fallback
    console.log('\n🔍 Query with fallback (current → history):');
    const gamesQuery = 'SELECT COUNT(*) as count, MIN(date) as earliest, MAX(date) as latest FROM games';
    const gameStats = await get(gamesQuery);
    console.log('  Query result:', gameStats);

    // 4. Union query (both databases)
    console.log('\n🔗 Union query (both databases):');
    const allGames = await unionQuery('SELECT game_id, date, away_team, home_team FROM games ORDER BY date LIMIT 5');
    console.log(`  Retrieved ${allGames.length} games from union query`);
    allGames.forEach(game => {
      console.log(`    ${game.date}: ${game.away_team} vs ${game.home_team}`);
    });

    // 5. Specific year query
    console.log('\n📋 2025 games query:');
    const games2025 = await query(
      "SELECT COUNT(*) as count FROM games WHERE date >= '2025-01-01' AND date < '2026-01-01'"
    );
    console.log('  2025 games count:', games2025[0]);

    console.log('\n✅ Unified database access test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testUnifiedDb();