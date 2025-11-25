#!/usr/bin/env npx tsx
/**
 * スケジュールテーブル作成スクリプト
 */

import { Client } from 'pg';

async function setupSchedulesTable() {
  const client = new Client({
    connectionString: process.env.PGURL
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL');

    // Create schedules table
    await client.query(`
      create table if not exists schedules (
        date           date not null,
        level          text not null,
        game_id        text primary key,
        home_team      text not null,
        away_team      text not null,
        start_time_jst time,
        venue          text,
        status         text not null default 'SCHEDULED'
      );
    `);

    await client.query(`
      create index if not exists ix_schedules_date_level on schedules(date, level);
    `);

    console.log('✅ Schedules table and index created successfully');

    // Verify table exists
    const result = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'schedules' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 Table structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ Error setting up schedules table:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  setupSchedulesTable().catch(console.error);
}