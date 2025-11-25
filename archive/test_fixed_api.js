const Database = require('better-sqlite3');

console.log('Testing fixed API logic...');

const gameId = '20170413_db-t-02';

try {
  const db = new Database('./data/db_current.db');
  
  // Get basic game information
  const gameQuery = `
    SELECT game_id, date, league, home_team, away_team, 
           home_score, away_score, venue, status, start_time_jst, updated_at
    FROM games 
    WHERE game_id = ?
  `;
  
  const game = db.prepare(gameQuery).get(gameId);
  
  if (!game) {
    console.log('Game not found');
    db.close();
    process.exit(1);
  }
  
  console.log('Game found:', game.game_id);
  
  // Fixed batting query
  const battingQuery = `
    SELECT team, name, batting_order, position, 
           AB, R, H, RBI, BB, SO, HR, AVG, OPS
    FROM box_batting 
    WHERE game_id = ?
    ORDER BY team, batting_order
  `;
  
  let battingStats = [];
  try {
    battingStats = db.prepare(battingQuery).all(gameId) || [];
    console.log(`Batting stats: ${battingStats.length} records`);
  } catch (error) {
    console.log('Batting stats error:', error.message);
  }

  // Fixed pitching query
  const pitchingQuery = `
    SELECT team, name, IP, H, R, ER, BB, SO, ERA, WHIP
    FROM box_pitching 
    WHERE game_id = ?
    ORDER BY team
  `;
  
  let pitchingStats = [];
  try {
    pitchingStats = db.prepare(pitchingQuery).all(gameId) || [];
    console.log(`Pitching stats: ${pitchingStats.length} records`);
  } catch (error) {
    console.log('Pitching stats error:', error.message);
  }

  // Test with a game that has data
  console.log('\n--- Testing with recent game that might have data ---');
  const recentGame = db.prepare(`
    SELECT game_id FROM games 
    WHERE date >= '2025-08-20' 
    ORDER BY date DESC 
    LIMIT 1
  `).get();
  
  if (recentGame) {
    console.log(`Testing recent game: ${recentGame.game_id}`);
    
    const recentBatting = db.prepare(battingQuery).all(recentGame.game_id);
    const recentPitching = db.prepare(pitchingQuery).all(recentGame.game_id);
    
    console.log(`Recent batting: ${recentBatting.length} records`);
    console.log(`Recent pitching: ${recentPitching.length} records`);
    
    if (recentBatting.length > 0) {
      console.log('Sample batting:', recentBatting[0]);
    }
    if (recentPitching.length > 0) {
      console.log('Sample pitching:', recentPitching[0]);
    }
  }

  db.close();
  console.log('\nAPI query tests completed successfully!');
  
} catch (error) {
  console.error('Error:', error.message);
}