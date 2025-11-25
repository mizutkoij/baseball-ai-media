const Database = require('better-sqlite3');

console.log('Checking detailed game data...');

try {
  const db = new Database('./data/db_current.db');
  
  // Get a recent finished game
  const recentGame = db.prepare(`
    SELECT * FROM games 
    WHERE status = 'finished' AND date >= '2025-08-20'
    ORDER BY date DESC 
    LIMIT 1
  `).get();
  
  if (recentGame) {
    console.log('\nRecent finished game:');
    console.log(`Game: ${recentGame.game_id}`);
    console.log(`Date: ${recentGame.date}`);
    console.log(`Matchup: ${recentGame.away_team} vs ${recentGame.home_team}`);
    console.log(`Score: ${recentGame.away_score}-${recentGame.home_score}`);
    console.log(`Status: ${recentGame.status}`);
    
    // Check batting data for this game
    const battingData = db.prepare(`
      SELECT * FROM box_batting 
      WHERE game_id = ?
    `).all(recentGame.game_id);
    
    console.log(`\nBatting data: ${battingData.length} records`);
    if (battingData.length > 0) {
      console.log('Sample batting record:');
      console.log(battingData[0]);
    }
    
    // Check pitching data for this game
    const pitchingData = db.prepare(`
      SELECT * FROM box_pitching 
      WHERE game_id = ?
    `).all(recentGame.game_id);
    
    console.log(`\nPitching data: ${pitchingData.length} records`);
    if (pitchingData.length > 0) {
      console.log('Sample pitching record:');
      console.log(pitchingData[0]);
    }
  } else {
    console.log('No recent finished games found');
  }
  
  // Also check the 2017 game that was having issues
  console.log('\n--- Checking 2017 game ---');
  const oldGame = db.prepare(`
    SELECT * FROM games 
    WHERE game_id = '20170413_db-t-02'
  `).get();
  
  if (oldGame) {
    console.log('Old game found:');
    console.log(oldGame);
    
    const oldBatting = db.prepare(`
      SELECT COUNT(*) as count FROM box_batting 
      WHERE game_id = ?
    `).get('20170413_db-t-02');
    
    const oldPitching = db.prepare(`
      SELECT COUNT(*) as count FROM box_pitching 
      WHERE game_id = ?
    `).get('20170413_db-t-02');
    
    console.log(`Batting records: ${oldBatting.count}`);
    console.log(`Pitching records: ${oldPitching.count}`);
  } else {
    console.log('2017 game not found in database');
  }
  
  db.close();
} catch (error) {
  console.error('Database error:', error.message);
}