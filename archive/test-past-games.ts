// Test script to verify past game functionality
import Database from 'better-sqlite3';

async function testPastGameSystem() {
  console.log('🧪 Testing Past Game System...\n');
  
  // Test 1: Database connectivity and sample data
  console.log('1. Testing database connectivity...');
  try {
    const db = new Database('./data/db_current.db');
    
    const totalGames = db.prepare('SELECT COUNT(*) as count FROM games').get();
    console.log(`   ✅ Database connected - ${totalGames.count} total games\n`);
    
    // Test 2: Recent games data
    console.log('2. Testing recent games (last 5 days)...');
    const recentDates = db.prepare(`
      SELECT date, COUNT(*) as games 
      FROM games 
      WHERE date >= date('now', '-5 days')
      GROUP BY date 
      ORDER BY date DESC 
      LIMIT 5
    `).all();
    
    if (recentDates.length > 0) {
      console.log('   Recent dates with games:');
      recentDates.forEach(row => {
        console.log(`     ${row.date}: ${row.games} games`);
      });
    } else {
      console.log('   ℹ️ No games in last 5 days');
    }
    
    console.log('');
    
    // Test 3: Sample game data structure
    console.log('3. Testing sample game data structure...');
    const sampleGame = db.prepare(`
      SELECT game_id, date, home_team, away_team, home_score, away_score, venue, status
      FROM games 
      WHERE date = '2025-08-21' 
      LIMIT 1
    `).get();
    
    if (sampleGame) {
      console.log('   ✅ Sample game found:');
      console.log(`     Game ID: ${sampleGame.game_id}`);
      console.log(`     Teams: ${sampleGame.away_team} vs ${sampleGame.home_team}`);
      console.log(`     Score: ${sampleGame.away_score} - ${sampleGame.home_score}`);
      console.log(`     Venue: ${sampleGame.venue}`);
      console.log(`     Status: ${sampleGame.status}`);
    } else {
      console.log('   ⚠️ No sample game found for 2025-08-21');
    }
    
    console.log('');
    
    // Test 4: Box score data availability
    console.log('4. Testing box score data...');
    const playerBoxScores = db.prepare('SELECT COUNT(*) as count FROM player_box_scores').get();
    const pitcherBoxScores = db.prepare('SELECT COUNT(*) as count FROM pitcher_box_scores').get();
    
    console.log(`   Player box scores: ${playerBoxScores.count}`);
    console.log(`   Pitcher box scores: ${pitcherBoxScores.count}`);
    
    if (playerBoxScores.count > 0 || pitcherBoxScores.count > 0) {
      console.log('   ✅ Box score data available');
    } else {
      console.log('   ℹ️ No box score data yet');
    }
    
    console.log('');
    
    // Test 5: Monthly distribution
    console.log('5. Testing monthly data distribution...');
    const monthlyData = db.prepare(`
      SELECT 
        substr(date, 1, 7) as month,
        COUNT(*) as games
      FROM games
      WHERE date LIKE '2025-%'
      GROUP BY substr(date, 1, 7)
      ORDER BY month DESC
    `).all();
    
    if (monthlyData.length > 0) {
      console.log('   Monthly game distribution:');
      monthlyData.forEach(row => {
        console.log(`     ${row.month}: ${row.games} games`);
      });
    } else {
      console.log('   ⚠️ No 2025 data found');
    }
    
    db.close();
    
    console.log('\n🎉 Past Game System Test Complete!\n');
    
    // Summary
    console.log('📊 SUMMARY:');
    console.log(`  • Total games: ${totalGames.count}`);
    console.log(`  • Recent activity: ${recentDates.length} days with games`);
    console.log(`  • Box score entries: ${playerBoxScores.count + pitcherBoxScores.count}`);
    console.log(`  • Monthly coverage: ${monthlyData.length} months`);
    
    if (totalGames.count > 500) {
      console.log('  ✅ Good data coverage - Past game pages ready!');
    } else {
      console.log('  ⚠️ Limited data - Consider expanding collection');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

// Run the test
testPastGameSystem().catch(console.error);