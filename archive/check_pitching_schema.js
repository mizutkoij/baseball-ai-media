const Database = require('better-sqlite3');

console.log('Checking pitching table schema...');

try {
  const db = new Database('./data/db_current.db');
  
  // Check box_pitching table structure
  const pitchingSchema = db.prepare("PRAGMA table_info(box_pitching)").all();
  console.log('\nbox_pitching table columns:');
  pitchingSchema.forEach(col => {
    console.log(`  ${col.name} (${col.type})`);
  });
  
  // Sample data
  const samplePitching = db.prepare("SELECT * FROM box_pitching LIMIT 3").all();
  console.log('\nSample pitching data:');
  samplePitching.forEach((row, i) => {
    console.log(`Row ${i + 1}:`, row);
  });
  
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}