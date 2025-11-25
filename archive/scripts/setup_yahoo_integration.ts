#!/usr/bin/env tsx
/**
 * Yahoo データ統合用のデータベーススキーマ拡張スクリプト
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.COMPREHENSIVE_DB_PATH || './comprehensive_baseball_database.db';

function setupYahooIntegration() {
  console.log('🔄 Yahoo データ統合用スキーマ拡張開始...');
  
  const db = new Database(DB_PATH);
  
  try {
    // 基本テーブルが存在するかチェック
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='games'").all();
    
    if (tables.length === 0) {
      console.log('📊 基本gamesテーブルの作成...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS games (
          game_id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          home_team TEXT NOT NULL,
          away_team TEXT NOT NULL,
          venue TEXT,
          status TEXT DEFAULT 'scheduled',
          league TEXT DEFAULT 'npb',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ 基本gamesテーブル作成完了');
    }

    // gamesテーブルにYahoo関連カラム追加
    console.log('📊 gamesテーブルの拡張...');
    
    // data_sourceカラム追加（データソースの識別）
    try {
      db.exec(`ALTER TABLE games ADD COLUMN data_source TEXT DEFAULT 'npb'`);
      console.log('✅ data_sourceカラム追加完了');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
      console.log('ℹ️ data_sourceカラムは既に存在します');
    }
    
    // yahoo_game_idカラム追加（Yahoo側のゲームID）
    try {
      db.exec(`ALTER TABLE games ADD COLUMN yahoo_game_id TEXT`);
      console.log('✅ yahoo_game_idカラム追加完了');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
      console.log('ℹ️ yahoo_game_idカラムは既に存在します');
    }

    // updated_atカラム追加（更新日時）
    try {
      db.exec(`ALTER TABLE games ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
      console.log('✅ updated_atカラム追加完了');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
      console.log('ℹ️ updated_atカラムは既に存在します');
    }

    // 一球速報データ用テーブル作成
    console.log('⚾ 一球速報テーブルの作成...');
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS pitch_by_pitch (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        inning INTEGER NOT NULL,
        side TEXT NOT NULL, -- '表' or '裏'
        pitch_sequence INTEGER NOT NULL,
        pitcher_name TEXT,
        batter_name TEXT,
        pitch_type TEXT,
        velocity INTEGER,
        zone TEXT,
        result TEXT,
        balls INTEGER,
        strikes INTEGER,
        runners TEXT,
        outs INTEGER,
        data_source TEXT DEFAULT 'yahoo',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(game_id)
      )
    `);
    console.log('✅ pitch_by_pitchテーブル作成完了');

    // インデックス作成
    console.log('🔍 インデックスの作成...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_games_data_source ON games(data_source)',
      'CREATE INDEX IF NOT EXISTS idx_games_yahoo_game_id ON games(yahoo_game_id)',
      'CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_pitch_game_id ON pitch_by_pitch(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_pitch_inning_side ON pitch_by_pitch(inning, side)',
      'CREATE INDEX IF NOT EXISTS idx_pitch_data_source ON pitch_by_pitch(data_source)',
      'CREATE INDEX IF NOT EXISTS idx_pitch_created_at ON pitch_by_pitch(created_at)'
    ];

    for (const indexSql of indexes) {
      db.exec(indexSql);
    }
    console.log('✅ インデックス作成完了');

    // Yahoo統合統計ビュー作成
    console.log('📈 統計ビューの作成...');
    
    db.exec(`
      CREATE VIEW IF NOT EXISTS yahoo_integration_stats AS
      SELECT 
        (SELECT COUNT(*) FROM games WHERE data_source = 'yahoo') as yahoo_games_count,
        (SELECT COUNT(*) FROM pitch_by_pitch WHERE data_source = 'yahoo') as yahoo_pitches_count,
        (SELECT COUNT(DISTINCT game_id) FROM pitch_by_pitch WHERE data_source = 'yahoo') as games_with_pitches,
        (SELECT COUNT(DISTINCT pitcher_name) FROM pitch_by_pitch WHERE data_source = 'yahoo') as unique_pitchers,
        (SELECT COUNT(DISTINCT batter_name) FROM pitch_by_pitch WHERE data_source = 'yahoo') as unique_batters,
        (SELECT MAX(updated_at) FROM games WHERE data_source = 'yahoo') as last_sync_time
    `);
    console.log('✅ 統計ビュー作成完了');

    // データベース情報確認
    console.log('\n📋 データベース構造確認:');
    
    const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('テーブル一覧:', allTables.map(t => t.name).join(', '));
    
    const gamesColumns = db.prepare("PRAGMA table_info(games)").all();
    console.log('gamesテーブルカラム:', gamesColumns.map(c => c.name).join(', '));
    
    const pitchColumns = db.prepare("PRAGMA table_info(pitch_by_pitch)").all();
    console.log('pitch_by_pitchテーブルカラム:', pitchColumns.map(c => c.name).join(', '));

    // 統計情報表示
    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM games) as total_games,
        (SELECT COUNT(*) FROM games WHERE data_source = 'yahoo') as yahoo_games,
        (SELECT COUNT(*) FROM pitch_by_pitch) as total_pitches
    `).get();
    
    console.log('\n📊 データベース統計:');
    console.log(`総試合数: ${stats.total_games}`);
    console.log(`Yahoo試合数: ${stats.yahoo_games}`);
    console.log(`一球速報データ: ${stats.total_pitches}球`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  } finally {
    db.close();
  }
  
  console.log('\n✅ Yahoo データ統合用スキーマ拡張完了！');
}

if (require.main === module) {
  setupYahooIntegration();
}

export default setupYahooIntegration;