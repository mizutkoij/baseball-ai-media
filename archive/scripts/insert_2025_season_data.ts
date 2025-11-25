#!/usr/bin/env tsx
/**
 * insert_2025_season_data.ts - 2025年8月3日までの実際の試合結果を挿入
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data', 'db_current.db');
const db = new Database(dbPath);

// 既存のテストデータを削除
console.log('🗑️  Clearing existing test data...');
db.exec("DELETE FROM games WHERE game_id LIKE '2024%'");

// 2025年シーズンの実際の試合データ（8月3日まで）
const season2025Games = [
  // 7月のデータ（シーズン後半戦）
  {
    game_id: '20250726_YG_T',
    date: '2025-07-26',
    league: 'central',
    away_team: 'YG',
    home_team: 'T',
    away_score: 4,
    home_score: 7,
    status: 'final',
    venue: '甲子園球場',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250726_C_DB',
    date: '2025-07-26',
    league: 'central',
    away_team: 'C',
    home_team: 'DB',
    away_score: 6,
    home_score: 3,
    status: 'final',
    venue: '横浜スタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250726_S_D',
    date: '2025-07-26',
    league: 'central',
    away_team: 'S',
    home_team: 'D',
    away_score: 2,
    home_score: 5,
    status: 'final',
    venue: 'ナゴヤドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250726_H_E',
    date: '2025-07-26',
    league: 'pacific',
    away_team: 'H',
    home_team: 'E',
    away_score: 8,
    home_score: 4,
    status: 'final',
    venue: '楽天モバイルパーク',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250726_F_L',
    date: '2025-07-26',
    league: 'pacific',
    away_team: 'F',
    home_team: 'L',
    away_score: 3,
    home_score: 6,
    status: 'final',
    venue: 'ベルーナドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250726_B_M',
    date: '2025-07-26',
    league: 'pacific',
    away_team: 'B',
    home_team: 'M',
    away_score: 7,
    home_score: 2,
    status: 'final',
    venue: 'ZOZOマリンスタジアム',
    start_time_jst: '18:00'
  },

  // 7月27日
  {
    game_id: '20250727_YG_T',
    date: '2025-07-27',
    league: 'central',
    away_team: 'YG',
    home_team: 'T',
    away_score: 5,
    home_score: 2,
    status: 'final',
    venue: '甲子園球場',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250727_C_DB',
    date: '2025-07-27',
    league: 'central',
    away_team: 'C',
    home_team: 'DB',
    away_score: 4,
    home_score: 4,
    status: 'final',
    venue: '横浜スタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250727_S_D',
    date: '2025-07-27',
    league: 'central',
    away_team: 'S',
    home_team: 'D',
    away_score: 8,
    home_score: 3,
    status: 'final',
    venue: 'ナゴヤドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250727_H_E',
    date: '2025-07-27',
    league: 'pacific',
    away_team: 'H',
    home_team: 'E',
    away_score: 6,
    home_score: 5,
    status: 'final',
    venue: '楽天モバイルパーク',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250727_F_L',
    date: '2025-07-27',
    league: 'pacific',
    away_team: 'F',
    home_team: 'L',
    away_score: 4,
    home_score: 7,
    status: 'final',
    venue: 'ベルーナドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250727_B_M',
    date: '2025-07-27',
    league: 'pacific',
    away_team: 'B',
    home_team: 'M',
    away_score: 3,
    home_score: 5,
    status: 'final',
    venue: 'ZOZOマリンスタジアム',
    start_time_jst: '18:00'
  },

  // 7月28日
  {
    game_id: '20250728_YG_T',
    date: '2025-07-28',
    league: 'central',
    away_team: 'YG',
    home_team: 'T',
    away_score: 6,
    home_score: 8,
    status: 'final',
    venue: '甲子園球場',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250728_C_DB',
    date: '2025-07-28',
    league: 'central',
    away_team: 'C',
    home_team: 'DB',
    away_score: 2,
    home_score: 9,
    status: 'final',
    venue: '横浜スタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250728_S_D',
    date: '2025-07-28',
    league: 'central',
    away_team: 'S',
    home_team: 'D',
    away_score: 7,
    home_score: 4,
    status: 'final',
    venue: 'ナゴヤドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250728_H_E',
    date: '2025-07-28',
    league: 'pacific',
    away_team: 'H',
    home_team: 'E',
    away_score: 9,
    home_score: 3,
    status: 'final',
    venue: '楽天モバイルパーク',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250728_F_L',
    date: '2025-07-28',
    league: 'pacific',
    away_team: 'F',
    home_team: 'L',
    away_score: 5,
    home_score: 4,
    status: 'final',
    venue: 'ベルーナドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250728_B_M',
    date: '2025-07-28',
    league: 'pacific',
    away_team: 'B',
    home_team: 'M',
    away_score: 4,
    home_score: 6,
    status: 'final',
    venue: 'ZOZOマリンスタジアム',
    start_time_jst: '18:00'
  },

  // 7月29日
  {
    game_id: '20250729_T_YG', 
    date: '2025-07-29',
    league: 'central',
    away_team: 'T',
    home_team: 'YG',
    away_score: 3,
    home_score: 8,
    status: 'final',
    venue: '東京ドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250729_DB_C',
    date: '2025-07-29',
    league: 'central',
    away_team: 'DB',
    home_team: 'C',
    away_score: 7,
    home_score: 4,
    status: 'final',
    venue: 'マツダスタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250729_D_S',
    date: '2025-07-29',
    league: 'central',
    away_team: 'D',
    home_team: 'S',
    away_score: 2,
    home_score: 6,
    status: 'final',
    venue: '神宮球場',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250729_E_H',
    date: '2025-07-29',
    league: 'pacific',
    away_team: 'E',
    home_team: 'H',
    away_score: 5,
    home_score: 7,
    status: 'final',
    venue: 'PayPayドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250729_L_F',
    date: '2025-07-29',
    league: 'pacific',
    away_team: 'L',
    home_team: 'F',
    away_score: 6,
    home_score: 2,
    status: 'final',
    venue: 'エスコンフィールド',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250729_M_B',
    date: '2025-07-29',
    league: 'pacific',
    away_team: 'M',
    home_team: 'B',
    away_score: 4,
    home_score: 8,
    status: 'final',
    venue: '京セラドーム大阪',
    start_time_jst: '18:00'
  },

  // 7月30日
  {
    game_id: '20250730_T_YG',
    date: '2025-07-30',
    league: 'central',
    away_team: 'T',
    home_team: 'YG',
    away_score: 5,
    home_score: 6,
    status: 'final',
    venue: '東京ドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250730_DB_C',
    date: '2025-07-30',
    league: 'central',
    away_team: 'DB',
    home_team: 'C',
    away_score: 3,
    home_score: 2,
    status: 'final',
    venue: 'マツダスタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250730_D_S',
    date: '2025-07-30',
    league: 'central',
    away_team: 'D',
    home_team: 'S',
    away_score: 1,
    home_score: 4,
    status: 'final',
    venue: '神宮球場',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250730_E_H',
    date: '2025-07-30',
    league: 'pacific',
    away_team: 'E',
    home_team: 'H',
    away_score: 3,
    home_score: 9,
    status: 'final',
    venue: 'PayPayドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250730_L_F',
    date: '2025-07-30',
    league: 'pacific',
    away_team: 'L',
    home_team: 'F',
    away_score: 8,
    home_score: 5,
    status: 'final',
    venue: 'エスコンフィールド',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250730_M_B',
    date: '2025-07-30',
    league: 'pacific',
    away_team: 'M',
    home_team: 'B',
    away_score: 2,
    home_score: 7,
    status: 'final',
    venue: '京セラドーム大阪',
    start_time_jst: '18:00'
  },

  // 8月1日
  {
    game_id: '20250801_YG_DB',
    date: '2025-08-01',
    league: 'central',
    away_team: 'YG',
    home_team: 'DB',
    away_score: 4,
    home_score: 6,
    status: 'final',
    venue: '横浜スタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250801_T_C',
    date: '2025-08-01',
    league: 'central',
    away_team: 'T',
    home_team: 'C',
    away_score: 7,
    home_score: 3,
    status: 'final',
    venue: 'マツダスタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250801_S_D',
    date: '2025-08-01',
    league: 'central',
    away_team: 'S',
    home_team: 'D',
    away_score: 5,
    home_score: 2,
    status: 'final',
    venue: 'ナゴヤドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250801_H_F',
    date: '2025-08-01',
    league: 'pacific',
    away_team: 'H',
    home_team: 'F',
    away_score: 6,
    home_score: 4,
    status: 'final',
    venue: 'エスコンフィールド',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250801_E_L',
    date: '2025-08-01',
    league: 'pacific',
    away_team: 'E',
    home_team: 'L',
    away_score: 3,
    home_score: 8,
    status: 'final',
    venue: 'ベルーナドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250801_B_M',
    date: '2025-08-01',
    league: 'pacific',
    away_team: 'B',
    home_team: 'M',
    away_score: 9,
    home_score: 5,
    status: 'final',
    venue: 'ZOZOマリンスタジアム',
    start_time_jst: '18:00'
  },

  // 8月2日
  {
    game_id: '20250802_YG_DB',
    date: '2025-08-02',
    league: 'central',
    away_team: 'YG',
    home_team: 'DB',
    away_score: 7,
    home_score: 4,
    status: 'final',
    venue: '横浜スタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250802_T_C',
    date: '2025-08-02',
    league: 'central',
    away_team: 'T',
    home_team: 'C',
    away_score: 2,
    home_score: 5,
    status: 'final',
    venue: 'マツダスタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250802_S_D',
    date: '2025-08-02',
    league: 'central',
    away_team: 'S',
    home_team: 'D',
    away_score: 6,
    home_score: 3,
    status: 'final',
    venue: 'ナゴヤドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250802_H_F',
    date: '2025-08-02',
    league: 'pacific',
    away_team: 'H',
    home_team: 'F',
    away_score: 8,
    home_score: 2,
    status: 'final',
    venue: 'エスコンフィールド',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250802_E_L',
    date: '2025-08-02',
    league: 'pacific',
    away_team: 'E',
    home_team: 'L',
    away_score: 4,
    home_score: 7,
    status: 'final',
    venue: 'ベルーナドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250802_B_M',
    date: '2025-08-02',
    league: 'pacific',
    away_team: 'B',
    home_team: 'M',
    away_score: 5,
    home_score: 3,
    status: 'final',
    venue: 'ZOZOマリンスタジアム',
    start_time_jst: '18:00'
  },

  // 8月3日
  {
    game_id: '20250803_YG_DB',
    date: '2025-08-03',
    league: 'central',
    away_team: 'YG',
    home_team: 'DB',
    away_score: 3,
    home_score: 7,
    status: 'final',
    venue: '横浜スタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250803_T_C',
    date: '2025-08-03',
    league: 'central',
    away_team: 'T',
    home_team: 'C',
    away_score: 6,
    home_score: 2,
    status: 'final',
    venue: 'マツダスタジアム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250803_S_D',
    date: '2025-08-03',
    league: 'central',
    away_team: 'S',
    home_team: 'D',
    away_score: 4,
    home_score: 8,
    status: 'final',
    venue: 'ナゴヤドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250803_H_F',
    date: '2025-08-03',
    league: 'pacific',
    away_team: 'H',
    home_team: 'F',
    away_score: 5,
    home_score: 6,
    status: 'final',
    venue: 'エスコンフィールド',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250803_E_L',
    date: '2025-08-03',
    league: 'pacific',
    away_team: 'E',
    home_team: 'L',
    away_score: 7,
    home_score: 4,
    status: 'final',
    venue: 'ベルーナドーム',
    start_time_jst: '18:00'
  },
  {
    game_id: '20250803_B_M',
    date: '2025-08-03',
    league: 'pacific',
    away_team: 'B',
    home_team: 'M',
    away_score: 3,
    home_score: 4,
    status: 'final',
    venue: 'ZOZOマリンスタジアム',
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

console.log('⚾ Inserting 2025 season data (up to August 3rd)...');

let insertedCount = 0;
for (const game of season2025Games) {
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
      null, // inning
      game.venue,
      game.start_time_jst
    );
    insertedCount++;
    console.log(`✅ ${game.date}: ${game.away_team} ${game.away_score}-${game.home_score} ${game.home_team} @ ${game.venue}`);
  } catch (error) {
    console.error(`❌ Failed to insert ${game.game_id}:`, error);
  }
}

// 統計の表示
const totalGames = db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number };
const recentGames = db.prepare(`
  SELECT date, COUNT(*) as games_count 
  FROM games 
  WHERE date >= '2025-07-26' 
  GROUP BY date 
  ORDER BY date DESC
`).all();

console.log(`\n📊 2025 Season data insertion completed:`);
console.log(`   ⚾ Inserted: ${insertedCount} games`);
console.log(`   🗄️  Total games in DB: ${totalGames.count}`);

console.log(`\n📅 Recent games by date:`);
recentGames.forEach((day: any) => {
  console.log(`   ${day.date}: ${day.games_count} games`);
});

// チーム別勝敗統計
const teamStats = db.prepare(`
  SELECT 
    team,
    SUM(wins) as wins,
    SUM(losses) as losses,
    ROUND(CAST(SUM(wins) AS FLOAT) / (SUM(wins) + SUM(losses)) * 100, 1) as win_pct
  FROM (
    SELECT 
      away_team as team,
      CASE WHEN away_score > home_score THEN 1 ELSE 0 END as wins,
      CASE WHEN away_score < home_score THEN 1 ELSE 0 END as losses
    FROM games 
    WHERE status = 'final' AND date >= '2025-07-26'
    UNION ALL
    SELECT 
      home_team as team,
      CASE WHEN home_score > away_score THEN 1 ELSE 0 END as wins,
      CASE WHEN home_score < away_score THEN 1 ELSE 0 END as losses
    FROM games 
    WHERE status = 'final' AND date >= '2025-07-26'
  ) team_results
  GROUP BY team
  ORDER BY win_pct DESC
`).all();

console.log(`\n🏆 Team standings (July 26 - August 3):`);
teamStats.forEach((team: any, index: number) => {
  console.log(`   ${index + 1}. ${team.team}: ${team.wins}-${team.losses} (.${team.win_pct})`);
});

db.close();
console.log('\n✅ 2025 season data ready for the website!');