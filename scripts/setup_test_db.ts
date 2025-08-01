import Database from 'better-sqlite3';
import { existsSync, unlinkSync } from 'fs';

const dbPath = './data/baseball_test.db';

// 既存ファイルを削除
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log('🗑️  Removed existing test database');
}

console.log('🚀 Creating new test database...');

const db = new Database(dbPath);

// スキーマ作成
db.exec(`
  -- ゲーム基本情報
  CREATE TABLE games (
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
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- 打撃成績
  CREATE TABLE box_batting (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    team TEXT NOT NULL,
    league TEXT,
    player_id TEXT NOT NULL,
    name TEXT,
    batting_order INTEGER,
    position TEXT,
    AB INTEGER DEFAULT 0,
    R INTEGER DEFAULT 0,
    H INTEGER DEFAULT 0,
    singles_2B INTEGER DEFAULT 0,
    singles_3B INTEGER DEFAULT 0,
    HR INTEGER DEFAULT 0,
    RBI INTEGER DEFAULT 0,
    BB INTEGER DEFAULT 0,
    SO INTEGER DEFAULT 0,
    SB INTEGER DEFAULT 0,
    CS INTEGER DEFAULT 0,
    AVG REAL,
    OPS REAL,
    HBP INTEGER DEFAULT 0,
    SF INTEGER DEFAULT 0,
    FOREIGN KEY (game_id) REFERENCES games(game_id)
  );

  -- 投球成績
  CREATE TABLE box_pitching (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    team TEXT NOT NULL,
    league TEXT,
    opponent TEXT,
    player_id TEXT NOT NULL,
    name TEXT,
    IP REAL DEFAULT 0,
    H INTEGER DEFAULT 0,
    R INTEGER DEFAULT 0,
    ER INTEGER DEFAULT 0,
    BB INTEGER DEFAULT 0,
    SO INTEGER DEFAULT 0,
    HR_allowed INTEGER DEFAULT 0,
    ERA REAL,
    WHIP REAL,
    FOREIGN KEY (game_id) REFERENCES games(game_id)
  );

  -- インデックス作成
  CREATE INDEX idx_games_date ON games(date);
  CREATE INDEX idx_games_league ON games(league);
  CREATE INDEX idx_batting_game ON box_batting(game_id);
  CREATE INDEX idx_batting_player ON box_batting(player_id);
  CREATE INDEX idx_pitching_game ON box_pitching(game_id);
  CREATE INDEX idx_pitching_player ON box_pitching(player_id);
`);

console.log('✅ Database schema created successfully');

// サンプルデータ挿入
const sampleGame = {
  game_id: '20250701_001',
  date: '2025-07-01',
  league: 'Central',
  away_team: '巨人',
  home_team: '阪神',
  away_score: 5,
  home_score: 3,
  status: 'final',
  venue: '阪神甲子園球場'
};

db.prepare(`
  INSERT INTO games (game_id, date, league, away_team, home_team, away_score, home_score, status, venue)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  sampleGame.game_id, sampleGame.date, sampleGame.league,
  sampleGame.away_team, sampleGame.home_team, sampleGame.away_score, 
  sampleGame.home_score, sampleGame.status, sampleGame.venue
);

// サンプル打撃データ
const sampleBatting = [
  { game_id: '20250701_001', team: '巨人', player_id: 'player_001', name: '選手1', AB: 4, H: 2, HR: 1, RBI: 2 },
  { game_id: '20250701_001', team: '阪神', player_id: 'player_002', name: '選手2', AB: 3, H: 1, HR: 0, RBI: 1 }
];

for (const bat of sampleBatting) {
  db.prepare(`
    INSERT INTO box_batting (game_id, team, player_id, name, AB, R, H, HR, RBI, AVG, OPS)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `).run(
    bat.game_id, bat.team, bat.player_id, bat.name, bat.AB, bat.H, bat.HR, bat.RBI,
    bat.H / bat.AB, (bat.H / bat.AB) * 1.5  // 簡易OPS
  );
}

// サンプル投球データ
const samplePitching = [
  { game_id: '20250701_001', team: '巨人', opponent: '阪神', player_id: 'pitcher_001', name: '投手1', IP: 6.0, H: 5, R: 3, ER: 2, SO: 8 },
  { game_id: '20250701_001', team: '阪神', opponent: '巨人', player_id: 'pitcher_002', name: '投手2', IP: 5.0, H: 7, R: 5, ER: 4, SO: 6 }
];

for (const pit of samplePitching) {
  db.prepare(`
    INSERT INTO box_pitching (game_id, team, opponent, player_id, name, IP, H, R, ER, SO, ERA, WHIP)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    pit.game_id, pit.team, pit.opponent, pit.player_id, pit.name, pit.IP, pit.H, pit.R, pit.ER, pit.SO,
    (pit.ER * 9) / pit.IP,  // ERA
    (pit.H + 2) / pit.IP    // 簡易WHIP
  );
}

console.log('✅ Sample data inserted');

// データ確認
const gameCount = db.prepare('SELECT COUNT(*) as count FROM games').get() as any;
const battingCount = db.prepare('SELECT COUNT(*) as count FROM box_batting').get() as any;
const pitchingCount = db.prepare('SELECT COUNT(*) as count FROM box_pitching').get() as any;

console.log(`📊 Test database ready:`);
console.log(`  - Games: ${gameCount.count}`);
console.log(`  - Batting records: ${battingCount.count}`);
console.log(`  - Pitching records: ${pitchingCount.count}`);

db.close();
console.log(`💾 Database saved to: ${dbPath}`);