#!/usr/bin/env tsx
/**
 * insert_test_games.ts - テスト用の試合データを挿入
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data', 'db_current.db');
const db = new Database(dbPath);

// テーブルの存在確認・作成
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    game_id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    league TEXT,
    away_team TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_score INTEGER,
    home_score INTEGER,
    status TEXT DEFAULT 'scheduled',
    inning INTEGER,
    venue TEXT,
    start_time_jst TEXT,
    box_score_url TEXT,
    play_by_play_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// インデックスの作成
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_games_date ON games(date);
  CREATE INDEX IF NOT EXISTS idx_games_teams ON games(away_team, home_team);
  CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
`);

// テストデータの準備
const testGames = [
  // 8月4日（今日）の試合
  {
    game_id: '20240804_YG_T',
    date: '2024-08-04',
    league: 'central',
    away_team: 'YG',
    home_team: 'T',
    away_score: 5,
    home_score: 3,
    status: 'final',
    venue: '甲子園球場',
    start_time_jst: '18:00'
  },
  {
    game_id: '20240804_C_D',
    date: '2024-08-04', 
    league: 'central',
    away_team: 'C',
    home_team: 'D',
    away_score: 2,
    home_score: 4,
    status: 'final',
    venue: 'ナゴヤドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20240804_H_F',
    date: '2024-08-04',
    league: 'pacific', 
    away_team: 'H',
    home_team: 'F',
    away_score: 7,
    home_score: 2,
    status: 'final',
    venue: '札幌ドーム',
    start_time_jst: '18:00'
  },
  // 8月5日（明日）の試合
  {
    game_id: '20240805_YG_S',
    date: '2024-08-05',
    league: 'central',
    away_team: 'YG',
    home_team: 'S',
    away_score: null,
    home_score: null,
    status: 'scheduled',
    venue: '神宮球場',
    start_time_jst: '18:00'
  },
  {
    game_id: '20240805_T_DB',
    date: '2024-08-05',
    league: 'central',
    away_team: 'T',
    home_team: 'DB',
    away_score: null,
    home_score: null,
    status: 'scheduled',
    venue: '横浜スタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20240805_E_M',
    date: '2024-08-05',
    league: 'pacific',
    away_team: 'E',
    home_team: 'M',
    away_score: 3,
    home_score: 1,
    status: 'live',
    inning: 7,
    venue: 'ZOZOマリンスタジアム',
    start_time_jst: '18:00'
  },
  // 8月6日の試合
  {
    game_id: '20240806_D_C',
    date: '2024-08-06',
    league: 'central',
    away_team: 'D',
    home_team: 'C',
    away_score: null,
    home_score: null,
    status: 'scheduled',
    venue: 'マツダスタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20240806_L_B',
    date: '2024-08-06',
    league: 'pacific',
    away_team: 'L',
    home_team: 'B',
    away_score: null,
    home_score: null,
    status: 'scheduled',
    venue: '京セラドーム大阪',
    start_time_jst: '18:00'
  }
];

// データの挿入
const stmt = db.prepare(`
  INSERT OR REPLACE INTO games (
    game_id, date, league, away_team, home_team,
    away_score, home_score, status, inning, venue,
    start_time_jst, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
  )
`);

console.log('🎾 Inserting test game data...');

let insertedCount = 0;
for (const game of testGames) {
  try {
    stmt.run(
      game.game_id,
      game.date,
      game.league,
      game.away_team,
      game.home_team,
      game.away_score,
      game.home_score,
      game.status,
      game.inning || null,
      game.venue,
      game.start_time_jst
    );
    insertedCount++;
    console.log(`✅ Inserted: ${game.game_id} (${game.away_team} vs ${game.home_team})`);
  } catch (error) {
    console.error(`❌ Failed to insert ${game.game_id}:`, error);
  }
}

// 結果の確認
const totalGames = db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number };
console.log(`\n📊 Test data insertion completed:`);
console.log(`   📥 Inserted: ${insertedCount} games`);
console.log(`   🗄️  Total games in DB: ${totalGames.count}`);

// サンプルデータの表示
const sampleGames = db.prepare(`
  SELECT game_id, date, away_team, home_team, status, venue
  FROM games 
  ORDER BY date DESC 
  LIMIT 5
`).all();

console.log(`\n🎯 Sample games in database:`);
sampleGames.forEach((game: any) => {
  console.log(`   ${game.date}: ${game.away_team} vs ${game.home_team} (${game.status}) @ ${game.venue}`);
});

db.close();
console.log('\n✅ Database operations completed successfully!');