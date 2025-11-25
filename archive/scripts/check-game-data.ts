// Quick script to check current game data issues
import { query } from '../lib/db';

async function checkGameData() {
  console.log('=== Database Game Data Analysis ===\n');
  
  try {
    // Check all games in database
    const allGames = await query('SELECT * FROM games ORDER BY date DESC LIMIT 20');
    console.log('📊 Recent games in database:');
    console.table(allGames);
    
    // Check for future dates (beyond today)
    const today = new Date().toISOString().split('T')[0];
    const futureGames = await query('SELECT * FROM games WHERE date > ? ORDER BY date', [today]);
    console.log(`\n🔮 Future games (after ${today}):`);
    console.table(futureGames);
    
    // Check for null/empty venues
    const badVenues = await query('SELECT * FROM games WHERE venue IS NULL OR venue = "" OR venue = "未定" ORDER BY date DESC');
    console.log('\n🏟️ Games with missing/placeholder venues:');
    console.table(badVenues);
    
    // Check for missing scores in finished games
    const finishedWithoutScores = await query(`
      SELECT * FROM games 
      WHERE status = 'finished' 
      AND (home_score IS NULL OR away_score IS NULL)
      ORDER BY date DESC
    `);
    console.log('\n❌ Finished games missing scores:');
    console.table(finishedWithoutScores);
    
    // Check for unrealistic scores
    const highScores = await query(`
      SELECT * FROM games 
      WHERE (home_score > 20 OR away_score > 20)
      AND (home_score IS NOT NULL AND away_score IS NOT NULL)
      ORDER BY date DESC
    `);
    console.log('\n🚨 Games with unrealistic high scores (>20):');
    console.table(highScores);
    
    // Summary stats
    const summary = await query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN date > '${today}' THEN 1 END) as future_games,
        COUNT(CASE WHEN venue IS NULL OR venue = '' OR venue = '未定' THEN 1 END) as bad_venues,
        COUNT(CASE WHEN status = 'finished' AND (home_score IS NULL OR away_score IS NULL) THEN 1 END) as finished_no_scores
      FROM games
    `);
    console.log('\n📈 Summary:');
    console.table(summary);
    
  } catch (error) {
    console.error('Database query error:', error);
  }
}

checkGameData().catch(console.error);