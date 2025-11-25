const Database = require('better-sqlite3');

console.log('Checking recent games...');

try {
  const db = new Database('./data/db_current.db');
  
  // Check recent games
  const games = db.prepare(`
    SELECT date, game_id, home_team, away_team, status, data_source 
    FROM games 
    WHERE date >= '2025-08-20' 
    ORDER BY date DESC 
    LIMIT 10
  `).all();
  
  console.log('Recent games:');
  games.forEach(g => {
    console.log(`${g.date} ${g.game_id} ${g.away_team} vs ${g.home_team} [${g.status}] (${g.data_source || 'none'})`);
  });
  
  // Check Yahoo data presence
  const yahooGames = db.prepare(`
    SELECT COUNT(*) as count 
    FROM games 
    WHERE data_source LIKE '%yahoo%' OR data_source LIKE '%live%'
  `).get();
  
  console.log(`\nYahoo/Live games in DB: ${yahooGames.count}`);
  
  // Check if any lineups or batting data exists
  const lineupCount = db.prepare(`SELECT COUNT(*) as count FROM lineups`).get();
  const battingCount = db.prepare(`SELECT COUNT(*) as count FROM batting_box`).get();
  
  console.log(`Lineups in DB: ${lineupCount.count}`);
  console.log(`Batting stats in DB: ${battingCount.count}`);
  
  db.close();
} catch (error) {
  console.error('Database error:', error.message);
}