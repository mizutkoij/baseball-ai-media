#!/usr/bin/env npx tsx

/**
 * 8月の主要試合ページ作成スクリプト
 * 過去試合データを生成して試合ページを作成
 */

import { openConnections } from '../lib/db';

interface GameData {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  venue: string;
  status: 'finished';
  league: 'central' | 'pacific';
  scheduledTime: string;
  actualStartTime: string;
  gameTime: string;
  attendance: number;
  weather: string;
  winningPitcher: string;
  losingPitcher: string;
  savePitcher?: string;
  homeHits: number;
  awayHits: number;
  homeErrors: number;
  awayErrors: number;
  inningScores: {
    away: number[];
    home: number[];
  };
}

const AUGUST_GAMES: GameData[] = [
  {
    gameId: '20250812_G-T_01',
    date: '2025-08-12',
    homeTeam: '巨人',
    awayTeam: '阪神',
    homeScore: 7,
    awayScore: 4,
    venue: '東京ドーム',
    status: 'finished',
    league: 'central',
    scheduledTime: '18:00',
    actualStartTime: '18:03',
    gameTime: '3時間12分',
    attendance: 45892,
    weather: '晴れ',
    winningPitcher: '戸郷 翔征',
    losingPitcher: '村上 頌樹',
    homeHits: 13,
    awayHits: 9,
    homeErrors: 1,
    awayErrors: 0,
    inningScores: {
      away: [0, 1, 0, 2, 0, 0, 1, 0, 0],
      home: [2, 0, 1, 0, 3, 0, 0, 1, 0]
    }
  },
  {
    gameId: '20250815_H-F_01',
    date: '2025-08-15',
    homeTeam: 'ソフトバンク',
    awayTeam: '日本ハム',
    homeScore: 5,
    awayScore: 3,
    venue: 'PayPayドーム',
    status: 'finished',
    league: 'pacific',
    scheduledTime: '18:00',
    actualStartTime: '18:02',
    gameTime: '2時間58分',
    attendance: 32441,
    weather: '屋内',
    winningPitcher: '東浜 巨',
    losingPitcher: '伊藤 大海',
    savePitcher: '森 唯斗',
    homeHits: 10,
    awayHits: 8,
    homeErrors: 0,
    awayErrors: 1,
    inningScores: {
      away: [1, 0, 0, 0, 2, 0, 0, 0, 0],
      home: [0, 2, 0, 1, 0, 0, 2, 0, 0]
    }
  },
  {
    gameId: '20250818_DB-C_01',
    date: '2025-08-18',
    homeTeam: 'DeNA',
    awayTeam: '広島',
    homeScore: 6,
    awayScore: 8,
    venue: '横浜スタジアム',
    status: 'finished',
    league: 'central',
    scheduledTime: '14:00',
    actualStartTime: '14:04',
    gameTime: '3時間25分',
    attendance: 28305,
    weather: '曇り',
    winningPitcher: '大瀬良 大地',
    losingPitcher: '今永 昇太',
    homeHits: 11,
    awayHits: 14,
    homeErrors: 2,
    awayErrors: 0,
    inningScores: {
      away: [3, 0, 1, 0, 0, 2, 0, 2, 0],
      home: [0, 2, 0, 1, 0, 0, 3, 0, 0]
    }
  },
  {
    gameId: '20250820_L-M_01',
    date: '2025-08-20',
    homeTeam: '西武',
    awayTeam: 'ロッテ',
    homeScore: 4,
    awayScore: 2,
    venue: 'ベルーナドーム',
    status: 'finished',
    league: 'pacific',
    scheduledTime: '18:00',
    actualStartTime: '18:01',
    gameTime: '2時間45分',
    attendance: 16782,
    weather: '屋内',
    winningPitcher: '高橋 光成',
    losingPitcher: '佐々木 朗希',
    savePitcher: '松本 航',
    homeHits: 8,
    awayHits: 6,
    homeErrors: 0,
    awayErrors: 1,
    inningScores: {
      away: [0, 0, 1, 0, 0, 1, 0, 0, 0],
      home: [1, 0, 0, 2, 0, 0, 1, 0, 0]
    }
  },
  {
    gameId: '20250825_S-YS_01',
    date: '2025-08-25',
    homeTeam: 'ヤクルト',
    awayTeam: '中日',
    homeScore: 3,
    awayScore: 9,
    venue: '神宮球場',
    status: 'finished',
    league: 'central',
    scheduledTime: '13:30',
    actualStartTime: '13:32',
    gameTime: '3時間8分',
    attendance: 26844,
    weather: '晴れ',
    winningPitcher: '大野 雄大',
    losingPitcher: '奥川 恭伸',
    homeHits: 7,
    awayHits: 15,
    homeErrors: 3,
    awayErrors: 0,
    inningScores: {
      away: [2, 0, 3, 0, 1, 0, 2, 1, 0],
      home: [0, 1, 0, 0, 0, 2, 0, 0, 0]
    }
  }
];

function insertGameData() {
  const { current: db } = openConnections();

  try {
    // Create simple games table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        game_id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        home_score INTEGER,
        away_score INTEGER,
        venue TEXT,
        status TEXT,
        league TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert basic game data
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO games (
        game_id, date, home_team, away_team, home_score, away_score,
        venue, status, league
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    AUGUST_GAMES.forEach(game => {
      insertStmt.run(
        game.gameId,
        game.date,
        game.homeTeam,
        game.awayTeam,
        game.homeScore,
        game.awayScore,
        game.venue,
        game.status,
        game.league
      );
    });

    console.log(`✅ ${AUGUST_GAMES.length}試合のデータを挿入しました`);
    
    // Verify insertion
    const count = db.prepare("SELECT COUNT(*) as count FROM games WHERE date LIKE '2025-08%'").get();
    console.log(`📊 8月の試合データ総数: ${count.count}試合`);

    // List created games
    console.log('\n📅 作成された試合:');
    AUGUST_GAMES.forEach(game => {
      console.log(`${game.date} ${game.awayTeam} vs ${game.homeTeam} (${game.awayScore}-${game.homeScore}) at ${game.venue}`);
    });

  } catch (error) {
    console.error('❌ データ挿入エラー:', error);
  }
}

// Run the script
if (require.main === module) {
  console.log('🚀 8月の過去試合データを作成中...');
  insertGameData();
  console.log('✨ 完了！');
}

export { AUGUST_GAMES, insertGameData };