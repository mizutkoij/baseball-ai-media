const Database = require('better-sqlite3');

console.log('🔍 Verifying database split integrity...');

const currentDb = new Database('./data/db_current.db', { readonly: true });
const historyDb = new Database('./data/db_history.db', { readonly: true });

const tables = ['games', 'box_batting', 'box_pitching'];

console.log('\n📊 Record counts comparison:');
console.log('Table              Current    History    Total');
console.log('─'.repeat(45));

let totalRecords = { current: 0, history: 0 };

tables.forEach(table => {
  try {
    const currentCount = currentDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
    const historyCount = historyDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
    const total = currentCount + historyCount;
    
    console.log(`${table.padEnd(18)} ${currentCount.toString().padStart(8)} ${historyCount.toString().padStart(8)} ${total.toString().padStart(8)}`);
    
    totalRecords.current += currentCount;
    totalRecords.history += historyCount;
  } catch (error) {
    console.log(`${table.padEnd(18)} ERROR: ${error.message}`);
  }
});

console.log('─'.repeat(45));
console.log(`${'TOTAL'.padEnd(18)} ${totalRecords.current.toString().padStart(8)} ${totalRecords.history.toString().padStart(8)} ${(totalRecords.current + totalRecords.history).toString().padStart(8)}`);

// Schema verification
console.log('\n🗂️  Schema verification:');
tables.forEach(table => {
  try {
    const currentSchema = currentDb.prepare(`PRAGMA table_info(${table})`).all();
    const historySchema = historyDb.prepare(`PRAGMA table_info(${table})`).all();
    
    const match = currentSchema.length === historySchema.length && 
                  currentSchema.every((col, i) => 
                    col.name === historySchema[i].name && 
                    col.type === historySchema[i].type
                  );
    
    console.log(`  ${table}: ${match ? '✅' : '❌'} Schema ${match ? 'matches' : 'mismatch'} (${currentSchema.length} columns)`);
  } catch (error) {
    console.log(`  ${table}: ❌ Schema check failed: ${error.message}`);
  }
});

// Date range verification
console.log('\n📅 Date range verification:');
try {
  const currentDates = currentDb.prepare(`
    SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(*) as count 
    FROM games
  `).get();
  
  const historyDates = historyDb.prepare(`
    SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(*) as count 
    FROM games
  `).get();
  
  console.log(`  Current DB: ${currentDates.count} games from ${currentDates.min_date || 'N/A'} to ${currentDates.max_date || 'N/A'}`);
  console.log(`  History DB: ${historyDates.count} games from ${historyDates.min_date || 'N/A'} to ${historyDates.max_date || 'N/A'}`);
  
  // Check for overlaps (should be none in properly split databases)
  if (currentDates.count > 0 && historyDates.count > 0) {
    const currentYear = parseInt(currentDates.min_date.substr(0, 4));
    const historyYear = parseInt(historyDates.max_date.substr(0, 4));
    
    if (currentYear <= historyYear) {
      console.log(`  ⚠️  Potential date overlap: Current starts ${currentYear}, History ends ${historyYear}`);
    } else {
      console.log(`  ✅ No date overlap: Clean separation`);
    }
  } else {
    console.log(`  ✅ Clean separation (one database empty)`);
  }
  
} catch (error) {
  console.log(`  ❌ Date range check failed: ${error.message}`);
}

// File size comparison
const fs = require('fs');
const currentSize = fs.statSync('./data/db_current.db').size;
const historySize = fs.statSync('./data/db_history.db').size;

console.log('\n💾 File sizes:');
console.log(`  db_current.db: ${(currentSize / 1024).toFixed(1)} KB`);
console.log(`  db_history.db: ${(historySize / 1024).toFixed(1)} KB`);
console.log(`  Total: ${((currentSize + historySize) / 1024).toFixed(1)} KB`);

currentDb.close();
historyDb.close();

console.log('\n✅ Database split verification complete!');