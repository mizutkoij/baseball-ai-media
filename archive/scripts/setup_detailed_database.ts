#!/usr/bin/env tsx
/**
 * setup_detailed_database.ts - 詳細なNPBデータ用のデータベーススキーマ拡張
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data', 'db_current.db');
const db = new Database(dbPath);

console.log('🔧 Setting up detailed NPB database schema...');

// 詳細な試合データテーブル
db.exec(`
  CREATE TABLE IF NOT EXISTS detailed_games (
    game_id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    league TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_score INTEGER,
    home_score INTEGER,
    status TEXT NOT NULL,
    inning INTEGER,
    venue TEXT,
    start_time_jst TEXT,
    
    -- 詳細データ
    away_hits INTEGER,
    home_hits INTEGER,
    away_errors INTEGER,
    home_errors INTEGER,
    away_starter TEXT,
    home_starter TEXT,
    attendance INTEGER,
    weather TEXT,
    game_time TEXT,
    
    -- イニング別スコア（JSON形式で保存）
    inning_scores TEXT,
    
    -- その他の情報
    umpire_home_plate TEXT,
    umpire_first_base TEXT,
    umpire_second_base TEXT,
    umpire_third_base TEXT,
    
    updated_at TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(game_id)
  )
`);

// チーム順位表
db.exec(`
  CREATE TABLE IF NOT EXISTS team_standings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team TEXT NOT NULL,
    league TEXT NOT NULL,
    year INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    wins INTEGER NOT NULL,
    losses INTEGER NOT NULL,
    draws INTEGER NOT NULL,
    win_percentage REAL NOT NULL,
    games_behind REAL NOT NULL,
    streak TEXT,
    last_10 TEXT,
    home_record TEXT,
    away_record TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(team, league, year)
  )
`);

// 打者成績
db.exec(`
  CREATE TABLE IF NOT EXISTS batting_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    name TEXT NOT NULL,
    team TEXT NOT NULL,
    position TEXT,
    year INTEGER NOT NULL,
    games INTEGER NOT NULL DEFAULT 0,
    at_bats INTEGER NOT NULL DEFAULT 0,
    hits INTEGER NOT NULL DEFAULT 0,
    runs INTEGER NOT NULL DEFAULT 0,
    rbis INTEGER NOT NULL DEFAULT 0,
    doubles INTEGER NOT NULL DEFAULT 0,
    triples INTEGER NOT NULL DEFAULT 0,
    home_runs INTEGER NOT NULL DEFAULT 0,
    walks INTEGER NOT NULL DEFAULT 0,
    strikeouts INTEGER NOT NULL DEFAULT 0,
    stolen_bases INTEGER NOT NULL DEFAULT 0,
    caught_stealing INTEGER NOT NULL DEFAULT 0,
    sacrifice_flies INTEGER NOT NULL DEFAULT 0,
    sacrifice_hits INTEGER NOT NULL DEFAULT 0,
    hit_by_pitch INTEGER NOT NULL DEFAULT 0,
    batting_average REAL NOT NULL DEFAULT 0,
    on_base_percentage REAL NOT NULL DEFAULT 0,
    slugging_percentage REAL NOT NULL DEFAULT 0,
    ops REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(player_id, team, year)
  )
`);

// 投手成績
db.exec(`
  CREATE TABLE IF NOT EXISTS pitching_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    name TEXT NOT NULL,
    team TEXT NOT NULL,
    year INTEGER NOT NULL,
    games INTEGER NOT NULL DEFAULT 0,
    games_started INTEGER NOT NULL DEFAULT 0,
    complete_games INTEGER NOT NULL DEFAULT 0,
    shutouts INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    saves INTEGER NOT NULL DEFAULT 0,
    holds INTEGER NOT NULL DEFAULT 0,
    innings_pitched REAL NOT NULL DEFAULT 0,
    hits_allowed INTEGER NOT NULL DEFAULT 0,
    runs_allowed INTEGER NOT NULL DEFAULT 0,
    earned_runs INTEGER NOT NULL DEFAULT 0,
    walks INTEGER NOT NULL DEFAULT 0,
    strikeouts INTEGER NOT NULL DEFAULT 0,
    home_runs_allowed INTEGER NOT NULL DEFAULT 0,
    hit_batters INTEGER NOT NULL DEFAULT 0,
    wild_pitches INTEGER NOT NULL DEFAULT 0,
    balks INTEGER NOT NULL DEFAULT 0,
    era REAL NOT NULL DEFAULT 0,
    whip REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(player_id, team, year)
  )
`);

// 選手マスタ
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_english TEXT,
    team TEXT NOT NULL,
    position TEXT,
    uniform_number INTEGER,
    height INTEGER,
    weight INTEGER,
    birthdate TEXT,
    debut_date TEXT,
    throws TEXT,
    bats TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// チームマスタ
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    team_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_english TEXT,
    league TEXT NOT NULL,
    city TEXT,
    stadium TEXT,
    founded INTEGER,
    colors TEXT,
    logo_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// 試合イベント（プレイバイプレイ用）
db.exec(`
  CREATE TABLE IF NOT EXISTS game_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    inning INTEGER NOT NULL,
    inning_half TEXT NOT NULL, -- 'top' or 'bottom'
    batter_order INTEGER,
    batter_name TEXT,
    batter_team TEXT,
    pitcher_name TEXT,
    pitcher_team TEXT,
    event_type TEXT NOT NULL, -- 'at_bat', 'substitution', 'inning_end', etc.
    event_description TEXT NOT NULL,
    ball_count TEXT, -- '2-1' など
    outs INTEGER,
    runners TEXT, -- JSON形式でランナー状況
    score_change TEXT, -- JSON形式でスコア変化
    event_time TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(game_id)
  )
`);

// インデックスの作成
console.log('📊 Creating database indexes...');

db.exec(`CREATE INDEX IF NOT EXISTS idx_detailed_games_date ON detailed_games(date)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_detailed_games_teams ON detailed_games(away_team, home_team)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_team_standings_league_year ON team_standings(league, year)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_batting_stats_team_year ON batting_stats(team, year)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_pitching_stats_team_year ON pitching_stats(team, year)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_players_team ON players(team)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events(game_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_game_events_inning ON game_events(game_id, inning)`);

// 初期チームデータの挿入
console.log('🏟️  Inserting initial team data...');

const teams = [
  // セントラル・リーグ
  { code: 'YG', name: '読売ジャイアンツ', name_english: 'Yomiuri Giants', league: 'central', city: '東京', stadium: '東京ドーム' },
  { code: 'T', name: '阪神タイガース', name_english: 'Hanshin Tigers', league: 'central', city: '兵庫', stadium: '甲子園球場' },
  { code: 'D', name: '中日ドラゴンズ', name_english: 'Chunichi Dragons', league: 'central', city: '愛知', stadium: 'バンテリンドーム' },
  { code: 'C', name: '広島東洋カープ', name_english: 'Hiroshima Carp', league: 'central', city: '広島', stadium: 'マツダスタジアム' },
  { code: 'S', name: '東京ヤクルトスワローズ', name_english: 'Tokyo Yakult Swallows', league: 'central', city: '東京', stadium: '神宮球場' },
  { code: 'DB', name: '横浜DeNAベイスターズ', name_english: 'Yokohama DeNA BayStars', league: 'central', city: '神奈川', stadium: '横浜スタジアム' },
  
  // パシフィック・リーグ
  { code: 'H', name: '福岡ソフトバンクホークス', name_english: 'Fukuoka SoftBank Hawks', league: 'pacific', city: '福岡', stadium: 'PayPayドーム' },
  { code: 'F', name: '北海道日本ハムファイターズ', name_english: 'Hokkaido Nippon-Ham Fighters', league: 'pacific', city: '北海道', stadium: 'エスコンフィールド' },
  { code: 'L', name: '埼玉西武ライオンズ', name_english: 'Saitama Seibu Lions', league: 'pacific', city: '埼玉', stadium: 'ベルーナドーム' },
  { code: 'M', name: '千葉ロッテマリーンズ', name_english: 'Chiba Lotte Marines', league: 'pacific', city: '千葉', stadium: 'ZOZOマリンスタジアム' },
  { code: 'B', name: 'オリックス・バファローズ', name_english: 'Orix Buffaloes', league: 'pacific', city: '大阪', stadium: '京セラドーム大阪' },
  { code: 'E', name: '東北楽天ゴールデンイーグルス', name_english: 'Tohoku Rakuten Golden Eagles', league: 'pacific', city: '宮城', stadium: '楽天モバイルパーク' }
];

const teamStmt = db.prepare(`
  INSERT OR REPLACE INTO teams (team_code, name, name_english, league, city, stadium, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

for (const team of teams) {
  teamStmt.run(team.code, team.name, team.name_english, team.league, team.city, team.stadium);
  console.log(`   ✅ ${team.name} (${team.code})`);
}

// データベース統計の表示
const tableStats = db.prepare(`
  SELECT name, COUNT(*) as count FROM sqlite_master WHERE type='table' GROUP BY name
`).all();

console.log(`\n📊 Database setup completed:`);
console.log(`   🗄️  Tables created: ${tableStats.length}`);

tableStats.forEach((stat: any) => {
  if (stat.name.startsWith('sqlite_')) return;
  console.log(`   📋 ${stat.name}: ready`);
});

// 既存のgamesテーブルの確認
const existingGamesCount = db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number };
console.log(`   ⚾ Existing games: ${existingGamesCount.count}`);

db.close();
console.log('\n✅ Detailed NPB database schema setup completed!');