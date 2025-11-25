const Database = require('better-sqlite3');
const { existsSync } = require('fs');

function checkDatabase(dbPath, name) {
  if (!existsSync(dbPath)) {
    console.log(`${name}: NOT FOUND (${dbPath})`);
    return;
  }
  
  try {
    const db = new Database(dbPath);
    
    // Get available years
    const years = db.prepare(`
      SELECT DISTINCT substr(game_id, 1, 4) as year, COUNT(*) as games
      FROM games 
      GROUP BY substr(game_id, 1, 4)
      ORDER BY year
    `).all();
    
    console.log(`${name}:`, years);
    
    // Check specific test years
    const testYears = [2021, 2022, 2023, 2024];
    testYears.forEach(year => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM games WHERE game_id LIKE ?`).get(`${year}%`);
      console.log(`  ${year}: ${count.count} games`);
    });
    
    db.close();
  } catch (error) {
    console.log(`${name}: ERROR - ${error.message}`);
  }
}

console.log('=== DATABASE YEAR CHECK ===');
checkDatabase('./data/db_current.db', 'CURRENT');
checkDatabase('./data/db_history.db', 'HISTORY');