const Database = require('better-sqlite3');
const { existsSync } = require('fs');

function debugYearCheck() {
  console.log('=== DEBUGGING YEAR CHECK ===');
  
  // Load golden samples
  const goldenSamples = require('../data/golden_samples.json');
  
  const allYears = [
    ...new Set([
      ...goldenSamples.samples.players.flatMap(p => p.test_years),
      ...goldenSamples.samples.teams.flatMap(t => t.test_years)
    ])
  ];
  
  console.log('All years in golden samples:', allYears);
  
  // Check what isExpectedYear function would return
  function isExpectedYear(year) {
    return year >= 2024;
  }
  
  const expectedYears = allYears.filter(isExpectedYear);
  console.log('Expected years (filtered):', expectedYears);
  
  if (expectedYears.length === 0) {
    console.log('NO EXPECTED YEARS - test should pass early');
    return;
  }
  
  // Check database
  const dbPaths = ['./data/db_current.db', './data/db_history.db'];
  
  for (const dbPath of dbPaths) {
    if (existsSync(dbPath)) {
      const db = new Database(dbPath);
      console.log(`\nChecking ${dbPath}:`);
      
      for (const year of expectedYears) {
        const count = db.prepare(`SELECT COUNT(*) as count FROM games WHERE game_id LIKE ?`).get(`${year}%`);
        console.log(`  ${year}: ${count.count} games`);
      }
      
      db.close();
    }
  }
}

debugYearCheck();