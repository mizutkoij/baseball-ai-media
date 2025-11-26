import Database from 'better-sqlite3';

const dbPath = process.env.DB_PATH || './data/npb.db';
console.log(`Checking database: ${dbPath}`);

try {
  const db = new Database(dbPath);
  
  // テーブル一覧を確認
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
  `).all();
  
  console.log('\n📊 Available tables:');
  tables.forEach((table: any) => {
    console.log(`  - ${table.name}`);
  });

  // 各テーブルのスキーマと行数を確認
  for (const table of tables) {
    if ((table as any).name.startsWith('sqlite_')) continue;
    
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${(table as any).name}`).get() as any;
      const schema = db.prepare(`PRAGMA table_info(${(table as any).name})`).all();
      
      console.log(`\n🔍 ${(table as any).name} (${count.count} rows):`);
      schema.forEach((col: any) => {
        console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
      });
      
      // サンプルデータ表示
      if (count.count > 0) {
        const sample = db.prepare(`SELECT * FROM ${(table as any).name} LIMIT 2`).all();
        console.log('  Sample data:', JSON.stringify(sample[0], null, 2));
      }
    } catch (error) {
      console.log(`  Error accessing ${(table as any).name}: ${error}`);
    }
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ Database error:', error);
}