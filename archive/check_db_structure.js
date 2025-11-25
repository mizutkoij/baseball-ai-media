const Database = require('better-sqlite3');

console.log('Checking database structure...');

try {
  const db = new Database('./data/db_current.db');
  
  // Check games table structure
  const gamesSchema = db.prepare("PRAGMA table_info(games)").all();
  console.log('\nGames table columns:');
  gamesSchema.forEach(col => {
    console.log(`  ${col.name} (${col.type})`);
  });
  
  // Check recent games
  const games = db.prepare(`
    SELECT date, game_id, home_team, away_team, status 
    FROM games 
    WHERE date >= '2025-08-20' 
    ORDER BY date DESC 
    LIMIT 10
  `).all();
  
  console.log('\nRecent games:');
  games.forEach(g => {
    console.log(`${g.date} ${g.game_id} ${g.away_team} vs ${g.home_team} [${g.status}]`);
  });
  
  // Check available tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('\nAvailable tables:');
  tables.forEach(t => console.log(`  ${t.name}`));
  
  // Check if lineups table exists and has data
  const tablesWithData = [];
  tables.forEach(table => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      if (count.count > 0) {
        tablesWithData.push(`${table.name}: ${count.count} rows`);
      }
    } catch (e) {
      // Skip tables that can't be counted
    }
  });
  
  console.log('\nTables with data:');
  tablesWithData.forEach(t => console.log(`  ${t}`));
  
  db.close();
} catch (error) {
  console.error('Database error:', error.message);
}