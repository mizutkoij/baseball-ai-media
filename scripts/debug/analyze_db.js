const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('./data/baseball_test.db', { readonly: true });

console.log('📊 Current database analysis:');

// Games table analysis by year
try {
  const gamesByYear = db.prepare(`
    SELECT 
      substr(date, 1, 4) as year,
      COUNT(*) as game_count,
      MIN(date) as earliest,
      MAX(date) as latest
    FROM games 
    GROUP BY substr(date, 1, 4) 
    ORDER BY year
  `).all();

  console.log('\n🏟️ Games by year:');
  gamesByYear.forEach(row => {
    console.log(`  ${row.year}: ${row.game_count} games (${row.earliest} to ${row.latest})`);
  });
} catch (e) {
  console.log('\n🏟️ Games analysis failed:', e.message);
}

// Total record counts
const tables = ['games', 'box_batting', 'box_pitching'];
console.log('\n📈 Total records:');
tables.forEach(table => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`  ${table}: ${count.count.toLocaleString()}`);
  } catch (e) {
    console.log(`  ${table}: N/A (${e.message})`);
  }
});

// File size
const stats = fs.statSync('./data/npb.db');
console.log(`\n💾 File size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

// Check schema
console.log('\n🗂️ Table schemas:');
tables.forEach(table => {
  try {
    const schema = db.prepare(`PRAGMA table_info(${table})`).all();
    console.log(`  ${table}: ${schema.length} columns`);
  } catch (e) {
    console.log(`  ${table}: Schema check failed`);
  }
});

db.close();