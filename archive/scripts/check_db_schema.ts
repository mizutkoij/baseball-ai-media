#!/usr/bin/env tsx
/**
 * check_db_schema.ts - データベーステーブル構造を確認
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = process.env.DB_PATH || join(process.cwd(), 'data', 'db_current.db');
const db = new Database(dbPath);

console.log('📋 Database Schema Information:');
console.log(`   📁 Database: ${dbPath}`);

// テーブル一覧
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('\n🗂️  Tables:');
tables.forEach((table: any) => {
  console.log(`   • ${table.name}`);
});

// gamesテーブルの構造
if (tables.some((t: any) => t.name === 'games')) {
  console.log('\n⚾ Games table schema:');
  const schema = db.prepare("PRAGMA table_info(games)").all();
  schema.forEach((col: any) => {
    console.log(`   ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
  });

  // サンプルデータ
  console.log('\n📊 Sample games data:');
  const samples = db.prepare("SELECT * FROM games LIMIT 3").all();
  samples.forEach((game: any) => {
    console.log(`   ${game.game_id}: ${game.date} ${game.away_team} vs ${game.home_team}`);
  });

  // 統計
  const count = db.prepare("SELECT COUNT(*) as count FROM games").get() as { count: number };
  console.log(`\n📈 Total games: ${count.count}`);
} else {
  console.log('\n❌ Games table not found');
}

db.close();