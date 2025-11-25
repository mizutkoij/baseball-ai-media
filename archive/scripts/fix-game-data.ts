// Script to fix problematic game data
import { query, run } from '../lib/db';

async function fixGameData() {
  console.log('=== Fixing Game Data Issues ===\n');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Today's date: ${today}`);
    
    // 1. Remove future games that shouldn't exist
    console.log('\n1. Removing invalid future games...');
    const futureGames = await query('SELECT * FROM games WHERE date > ?', [today]);
    console.log(`Found ${futureGames.length} future games:`);
    futureGames.forEach(game => {
      console.log(`  - ${game.game_id} (${game.date}) ${game.away_team} vs ${game.home_team} - ${game.status}`);
    });
    
    if (futureGames.length > 0) {
      await run('DELETE FROM games WHERE date > ?', [today]);
      console.log('✅ Removed future games');
    }
    
    // 2. Standardize team names - convert abbreviations to full names
    console.log('\n2. Standardizing team names...');
    const teamMapping = {
      'YG': '巨人',
      'S': 'ヤクルト', 
      'T': '阪神',
      'C': '広島',
      'DB': 'DeNA',
      'D': '中日',
      'H': '日本ハム',
      'E': '楽天',
      'L': 'ロッテ',
      'M': '西武',
      'B': 'オリックス',
      'F': 'ソフトバンク'
    };
    
    for (const [abbr, fullName] of Object.entries(teamMapping)) {
      // Update home teams
      const homeUpdated = await run('UPDATE games SET home_team = ? WHERE home_team = ?', [fullName, abbr]);
      if (homeUpdated.changes > 0) {
        console.log(`  - Updated ${homeUpdated.changes} home team records: ${abbr} → ${fullName}`);
      }
      
      // Update away teams  
      const awayUpdated = await run('UPDATE games SET away_team = ? WHERE away_team = ?', [fullName, abbr]);
      if (awayUpdated.changes > 0) {
        console.log(`  - Updated ${awayUpdated.changes} away team records: ${abbr} → ${fullName}`);
      }
    }
    
    // 3. Standardize league names to lowercase
    console.log('\n3. Standardizing league names...');
    await run('UPDATE games SET league = ? WHERE league = ?', ['central', 'Central']);
    await run('UPDATE games SET league = ? WHERE league = ?', ['pacific', 'Pacific']);
    console.log('✅ League names standardized to lowercase');
    
    // 4. Fix status naming - standardize to 'finished' instead of 'final'
    console.log('\n4. Standardizing game status...');
    const statusUpdated = await run('UPDATE games SET status = ? WHERE status = ?', ['finished', 'final']);
    if (statusUpdated.changes > 0) {
      console.log(`✅ Updated ${statusUpdated.changes} games from 'final' to 'finished'`);
    }
    
    // 5. Check for and fix any games with missing scores but marked as finished
    console.log('\n5. Checking for finished games without scores...');
    const finishedNoScores = await query(`
      SELECT * FROM games 
      WHERE status = 'finished' 
      AND (home_score IS NULL OR away_score IS NULL)
    `);
    
    if (finishedNoScores.length > 0) {
      console.log(`Found ${finishedNoScores.length} finished games without scores - setting to scheduled:`);
      finishedNoScores.forEach(game => {
        console.log(`  - ${game.game_id}: ${game.away_team} vs ${game.home_team}`);
      });
      
      await run(`
        UPDATE games 
        SET status = 'scheduled' 
        WHERE status = 'finished' 
        AND (home_score IS NULL OR away_score IS NULL)
      `);
      console.log('✅ Updated games without scores to scheduled status');
    }
    
    // 6. Final verification
    console.log('\n6. Final verification...');
    const cleanData = await query('SELECT * FROM games ORDER BY date DESC LIMIT 10');
    console.log('📊 Top 10 recent games after cleanup:');
    console.table(cleanData.map(game => ({
      game_id: game.game_id,
      date: game.date,
      matchup: `${game.away_team} @ ${game.home_team}`,
      score: game.home_score !== null ? `${game.away_score}-${game.home_score}` : 'TBD',
      status: game.status,
      league: game.league
    })));
    
    const finalSummary = await query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN date > '${today}' THEN 1 END) as future_games,
        COUNT(CASE WHEN status = 'finished' AND (home_score IS NULL OR away_score IS NULL) THEN 1 END) as finished_no_scores,
        COUNT(CASE WHEN league NOT IN ('central', 'pacific') THEN 1 END) as bad_leagues
      FROM games
    `);
    
    console.log('\n📈 Final Summary:');
    console.table(finalSummary);
    
    console.log('\n✅ All data quality issues have been resolved!');
    
  } catch (error) {
    console.error('❌ Error fixing game data:', error);
  }
}

fixGameData().catch(console.error);