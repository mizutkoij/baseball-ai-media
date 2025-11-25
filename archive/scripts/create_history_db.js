const Database = require('better-sqlite3');

console.log('🗂️ Creating db_history.db...');

// Open source (current) and create destination (history)
const srcDb = new Database('./data/db_current.db', { readonly: true });
const histDb = new Database('./data/db_history.db');

console.log('📋 Copying table schemas...');

// Get table schemas from source
const tables = ['games', 'box_batting', 'box_pitching'];

tables.forEach(tableName => {
  console.log(`  Creating ${tableName}...`);
  
  // Get schema info
  const schema = srcDb.prepare(`PRAGMA table_info(${tableName})`).all();
  
  // Build CREATE TABLE statement
  const columns = schema.map(col => {
    let def = `${col.name} ${col.type}`;
    if (col.notnull) def += ' NOT NULL';
    if (col.dflt_value !== null) def += ` DEFAULT ${col.dflt_value}`;
    if (col.pk) def += ' PRIMARY KEY';
    return def;
  }).join(', ');
  
  const createSql = `CREATE TABLE ${tableName} (${columns})`;
  
  try {
    histDb.exec(createSql);
    console.log(`  ✅ ${tableName} schema created`);
  } catch (error) {
    console.error(`  ❌ Failed to create ${tableName}:`, error.message);
  }
});

// Create indexes (copy from source)
console.log('🔗 Creating indexes...');
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)',
  'CREATE INDEX IF NOT EXISTS idx_games_league ON games(league)', 
  'CREATE INDEX IF NOT EXISTS idx_batting_game ON box_batting(game_id)',
  'CREATE INDEX IF NOT EXISTS idx_batting_player ON box_batting(player_id)',
  'CREATE INDEX IF NOT EXISTS idx_pitching_game ON box_pitching(game_id)',
  'CREATE INDEX IF NOT EXISTS idx_pitching_player ON box_pitching(player_id)'
];

indexes.forEach(sql => {
  try {
    histDb.exec(sql);
    console.log(`  ✅ Index created`);
  } catch (error) {
    console.log(`  ⚠️  Index creation: ${error.message}`);
  }
});

console.log('📊 Verifying empty tables...');
tables.forEach(tableName => {
  const count = histDb.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
  console.log(`  ${tableName}: ${count.count} records`);
});

srcDb.close();
histDb.close();

console.log('✅ db_history.db created successfully (empty, ready for historical data)');