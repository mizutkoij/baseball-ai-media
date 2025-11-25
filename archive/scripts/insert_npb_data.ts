#!/usr/bin/env tsx
/**
 * insert_npb_data.ts - NPBから取得した詳細な試合データをデータベースに挿入
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

// データベースパス
const dbPath = process.env.DB_PATH || join(process.cwd(), 'data', 'db_current.db');

if (!existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

// NPBデータファイルのパス
const detailedDataPath = join(process.cwd(), 'data', 'npb_2025_detailed_complete.json');
const allGamesDataPath = join(process.cwd(), 'data', 'npb_2025_all_games_simple.json');

// データファイルの存在確認
if (!existsSync(detailedDataPath)) {
  console.error(`❌ Detailed NPB data not found: ${detailedDataPath}`);
  process.exit(1);
}

if (!existsSync(allGamesDataPath)) {
  console.error(`❌ All games NPB data not found: ${allGamesDataPath}`);
  process.exit(1);
}

console.log('📋 Loading NPB data files...');

// NPBデータを読み込み
const detailedData = JSON.parse(readFileSync(detailedDataPath, 'utf-8'));
const allGamesData = JSON.parse(readFileSync(allGamesDataPath, 'utf-8'));

console.log(`📊 Loaded data:`);
console.log(`   📝 Detailed games: ${detailedData.length}`);
console.log(`   🗓️  All games dates: ${Object.keys(allGamesData).length}`);

// チーム名の正規化マッピング
const teamNameMap: { [key: string]: string } = {
  '巨人': 'G', 'G': 'G', 'YG': 'G', '読売ジャイアンツ': 'G',
  '阪神': 'T', 'T': 'T', '阪神タイガース': 'T',
  '中日': 'D', 'D': 'D', '中日ドラゴンズ': 'D',
  '広島': 'C', 'C': 'C', 'カープ': 'C', '広島東洋カープ': 'C',
  'DeNA': 'DB', 'DB': 'DB', 'ベイスターズ': 'DB', '横浜DeNAベイスターズ': 'DB',
  'ヤクルト': 'S', 'S': 'S', 'スワローズ': 'S', '東京ヤクルトスワローズ': 'S',
  'ソフトバンク': 'H', 'H': 'H', 'ホークス': 'H', 'ソフトバンクホークス': 'H',
  'オリックス': 'B', 'B': 'B', 'バファローズ': 'B', 'オリックス・バファローズ': 'B',
  '日本ハム': 'F', 'F': 'F', 'ファイターズ': 'F', '日本ハムファイターズ': 'F',
  'ロッテ': 'M', 'M': 'M', 'マリーンズ': 'M', '千葉ロッテマリーンズ': 'M',
  '楽天': 'E', 'E': 'E', 'イーグルス': 'E', '東北楽天ゴールデンイーグルス': 'E',
  '西武': 'L', 'L': 'L', 'ライオンズ': 'L', '埼玉西武ライオンズ': 'L'
};

// チーム名正規化関数
function normalizeTeamName(teamName: string): string {
  return teamNameMap[teamName] || teamName;
}

// ゲームIDの正規化（形式を統一）
function normalizeGameId(gameId: string): string {
  // 既存の形式をチェック
  if (gameId.includes('_')) {
    return gameId;
  }
  
  // 新しい形式の場合は変換
  const match = gameId.match(/^(\d{4}-\d{2}-\d{2})[-_](.+)$/);
  if (match) {
    const [, date, matchup] = match;
    const formattedDate = date.replace(/-/g, '');
    return `${formattedDate}_${matchup}`;
  }
  
  return gameId;
}

// データベーステーブル準備
// 既存テーブルに新しいカラムを追加
try {
  db.exec(`ALTER TABLE games ADD COLUMN attendance INTEGER`);
  console.log('✅ Added attendance column');
} catch (e) {
  // カラムが既に存在する場合は無視
}

try {
  db.exec(`ALTER TABLE games ADD COLUMN game_time TEXT`);
  console.log('✅ Added game_time column');
} catch (e) {
  // カラムが既に存在する場合は無視
}

try {
  db.exec(`ALTER TABLE games ADD COLUMN inning_scores TEXT`);
  console.log('✅ Added inning_scores column');
} catch (e) {
  // カラムが既に存在する場合は無視
}

// 詳細データの挿入準備
const detailedStmt = db.prepare(`
  INSERT OR REPLACE INTO games (
    game_id, date, league, away_team, home_team,
    away_score, home_score, status, venue,
    start_time_jst, inning_scores, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

// 全試合データの挿入準備
const allGamesStmt = db.prepare(`
  INSERT OR REPLACE INTO games (
    game_id, date, league, away_team, home_team,
    away_score, home_score, status, venue,
    start_time_jst, attendance, game_time, inning_scores, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

console.log('⚾ Inserting detailed NPB games...');

let detailedInserted = 0;
let detailedErrors = 0;

// 詳細データの挿入
for (const game of detailedData) {
  try {
    const gameId = normalizeGameId(game.gameId);
    const awayTeam = normalizeTeamName(game.awayTeam);
    const homeTeam = normalizeTeamName(game.homeTeam);
    
    // リーグ判定
    const centralTeams = ['G', 'T', 'D', 'C', 'DB', 'S'];
    const league = centralTeams.includes(homeTeam) ? 'central' : 'pacific';
    
    detailedStmt.run(
      gameId,
      game.date,
      league,
      awayTeam,
      homeTeam,
      game.awayScore,
      game.homeScore,
      'final',
      game.venue,
      null, // start_time_jst は詳細データにはない
      JSON.stringify(game.inningScores)
    );
    
    detailedInserted++;
    console.log(`✅ ${game.date}: ${awayTeam} ${game.awayScore}-${game.homeScore} ${homeTeam} @ ${game.venue}`);
  } catch (error) {
    detailedErrors++;
    console.error(`❌ Failed to insert detailed game ${game.gameId}:`, error);
  }
}

console.log('\n⚾ Inserting all NPB games...');

let allGamesInserted = 0;
let allGamesErrors = 0;

// 全試合データの挿入
for (const [date, gamesOfDay] of Object.entries(allGamesData)) {
  for (const [matchup, game] of Object.entries(gamesOfDay as any)) {
    try {
      const gameData = game as any;
      const gameId = `${date.replace(/-/g, '')}_${matchup}`;
      const awayTeam = normalizeTeamName(gameData.awayTeam);
      const homeTeam = normalizeTeamName(gameData.homeTeam);
      
      allGamesStmt.run(
        gameId,
        gameData.date,
        gameData.league,
        awayTeam,
        homeTeam,
        gameData.awayScore,
        gameData.homeScore,
        gameData.status,
        gameData.venue,
        gameData.time,
        gameData.attendance ? parseInt(gameData.attendance.replace(/[^\d]/g, '')) : null,
        gameData.gameTime,
        JSON.stringify(gameData.inningScores)
      );
      
      allGamesInserted++;
      if (gameData.status === 'finished') {
        console.log(`✅ ${gameData.date}: ${awayTeam} ${gameData.awayScore}-${gameData.homeScore} ${homeTeam}`);
      } else {
        console.log(`📅 ${gameData.date}: ${awayTeam} vs ${homeTeam} (${gameData.status})`);
      }
    } catch (error) {
      allGamesErrors++;
      console.error(`❌ Failed to insert game ${date}_${matchup}:`, error);
    }
  }
}

// 統計情報の表示
const totalGames = db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number };
const finishedGames = db.prepare("SELECT COUNT(*) as count FROM games WHERE status = 'final' OR status = 'finished'").get() as { count: number };

console.log(`\n📊 NPB Data insertion completed:`);
console.log(`   📝 Detailed games inserted: ${detailedInserted} (errors: ${detailedErrors})`);
console.log(`   🗓️  All games inserted: ${allGamesInserted} (errors: ${allGamesErrors})`);
console.log(`   🗄️  Total games in DB: ${totalGames.count}`);
console.log(`   ✅ Finished games: ${finishedGames.count}`);

// 最新の試合情報
const recentGames = db.prepare(`
  SELECT date, COUNT(*) as games_count 
  FROM games 
  WHERE date >= '2025-07-01'
  GROUP BY date 
  ORDER BY date DESC
  LIMIT 10
`).all();

console.log(`\n📅 Recent games (last 10 days with games):`);
recentGames.forEach((day: any) => {
  console.log(`   ${day.date}: ${day.games_count} games`);
});

// リーグ別統計
const leagueStats = db.prepare(`
  SELECT 
    league,
    COUNT(*) as total_games,
    SUM(CASE WHEN status IN ('final', 'finished') THEN 1 ELSE 0 END) as finished_games
  FROM games 
  WHERE date >= '2025-03-01'
  GROUP BY league
`).all();

console.log(`\n🏆 League statistics (2025 season):`);
leagueStats.forEach((league: any) => {
  console.log(`   ${league.league}: ${league.finished_games}/${league.total_games} games finished`);
});

// データベースを閉じる
db.close();
console.log('\n✅ NPB data insertion completed successfully!');