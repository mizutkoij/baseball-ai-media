const Database = require("better-sqlite3");
const path = require("path");

const DB_DIR = path.resolve("./data");
const HISTORY_DB = path.join(DB_DIR, "db_history.db");

const db = new Database(HISTORY_DB);

console.log("=== Database Schema ===");

// Get all table names
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

tables.forEach((table: any) => {
  console.log(`\n--- Table: ${table.name} ---`);
  const schema = db.prepare(`PRAGMA table_info(${table.name})`).all();
  schema.forEach((col: any) => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
});

db.close();