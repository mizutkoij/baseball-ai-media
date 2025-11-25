#!/usr/bin/env tsx
/**
 * fetch_detailed_npb_data.ts - 詳細なNPBデータの取得・更新
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { NPBDetailedScraper, DetailedGameData, TeamStanding, BattingStats, PitchingStats } from '../lib/npb-detailed-scraper';

const dbPath = join(process.cwd(), 'data', 'db_current.db');
const db = new Database(dbPath);
const scraper = new NPBDetailedScraper();

interface Options {
  mode: 'all' | 'standings' | 'stats' | 'games';
  year?: number;
  force?: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const options: Options = {
    mode: 'all',
    year: new Date().getFullYear(),
    force: false
  };

  // コマンドライン引数の解析
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode':
        options.mode = args[++i] as Options['mode'];
        break;
      case '--year':
        options.year = parseInt(args[++i]);
        break;
      case '--force':
        options.force = true;
        break;
    }
  }

  console.log(`🚀 Fetching detailed NPB data...`);
  console.log(`   📅 Year: ${options.year}`);
  console.log(`   🎯 Mode: ${options.mode}`);
  console.log(`   🔄 Force update: ${options.force}`);

  try {
    if (options.mode === 'all' || options.mode === 'standings') {
      await fetchAndUpdateStandings(options.year!);
    }

    if (options.mode === 'all' || options.mode === 'stats') {
      await fetchAndUpdatePlayerStats(options.year!);
    }

    if (options.mode === 'all' || options.mode === 'games') {
      await fetchAndUpdateDetailedGames();
    }

    console.log('\n✅ Detailed NPB data fetch completed!');
  } catch (error) {
    console.error('❌ Error fetching detailed NPB data:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

/**
 * チーム順位表の取得・更新
 */
async function fetchAndUpdateStandings(year: number) {
  console.log('\n📊 Fetching team standings...');
  
  try {
    const standings = await scraper.fetchTeamStandings(year);
    
    if (standings.length === 0) {
      console.log('⚠️  No standings data found, using mock data');
      await insertMockStandings(year);
      return;
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO team_standings (
        team, league, year, rank, wins, losses, draws, 
        win_percentage, games_behind, streak, last_10, 
        home_record, away_record, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const standing of standings) {
      stmt.run(
        standing.team,
        standing.league,
        year,
        standing.rank,
        standing.wins,
        standing.losses,
        standing.draws,
        standing.win_percentage,
        standing.games_behind,
        standing.streak,
        standing.last_10,
        standing.home_record,
        standing.away_record,
        new Date().toISOString()
      );
      console.log(`   ✅ ${standing.team}: ${standing.wins}-${standing.losses} (.${standing.win_percentage})`);
    }

    console.log(`📊 Updated ${standings.length} team standings`);
  } catch (error) {
    console.error('❌ Failed to fetch standings:', error);
    await insertMockStandings(year);
  }
}

/**
 * モック順位表データの挿入
 */
async function insertMockStandings(year: number) {
  console.log('📊 Inserting mock standings data...');
  
  const mockStandings = [
    // セントラル・リーグ
    { team: 'YG', league: 'central', rank: 1, wins: 65, losses: 45, draws: 5, win_percentage: 0.591 },
    { team: 'T', league: 'central', rank: 2, wins: 62, losses: 48, draws: 5, win_percentage: 0.564 },
    { team: 'C', league: 'central', rank: 3, wins: 58, losses: 52, draws: 5, win_percentage: 0.527 },
    { team: 'DB', league: 'central', rank: 4, wins: 55, losses: 55, draws: 5, win_percentage: 0.500 },
    { team: 'S', league: 'central', rank: 5, wins: 52, losses: 58, draws: 5, win_percentage: 0.473 },
    { team: 'D', league: 'central', rank: 6, wins: 48, losses: 62, draws: 5, win_percentage: 0.436 },
    
    // パシフィック・リーグ
    { team: 'H', league: 'pacific', rank: 1, wins: 68, losses: 42, draws: 5, win_percentage: 0.618 },
    { team: 'B', league: 'pacific', rank: 2, wins: 62, losses: 48, draws: 5, win_percentage: 0.564 },
    { team: 'L', league: 'pacific', rank: 3, wins: 58, losses: 52, draws: 5, win_percentage: 0.527 },
    { team: 'M', league: 'pacific', rank: 4, wins: 55, losses: 55, draws: 5, win_percentage: 0.500 },
    { team: 'E', league: 'pacific', rank: 5, wins: 52, losses: 58, draws: 5, win_percentage: 0.473 },
    { team: 'F', league: 'pacific', rank: 6, wins: 45, losses: 65, draws: 5, win_percentage: 0.409 }
  ];

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO team_standings (
      team, league, year, rank, wins, losses, draws, 
      win_percentage, games_behind, streak, last_10, 
      home_record, away_record, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const standing of mockStandings) {
    const gamesBehind = standing.rank === 1 ? 0 : (mockStandings.find(s => s.league === standing.league && s.rank === 1)!.wins - standing.wins);
    
    stmt.run(
      standing.team,
      standing.league,
      year,
      standing.rank,
      standing.wins,
      standing.losses,
      standing.draws,
      standing.win_percentage,
      gamesBehind,
      'W2', // モックストリーク
      '7-3', // モック直近10試合
      '30-25', // モックホーム成績
      '25-30', // モックアウェー成績
      new Date().toISOString()
    );
    console.log(`   ✅ ${standing.team}: ${standing.wins}-${standing.losses} (.${standing.win_percentage})`);
  }
}

/**
 * 選手成績の取得・更新
 */
async function fetchAndUpdatePlayerStats(year: number) {
  console.log('\n⚾ Fetching player statistics...');
  
  // 打者成績の取得
  for (const league of ['central', 'pacific'] as const) {
    console.log(`\n🏏 Fetching ${league} league batting stats...`);
    
    try {
      const battingStats = await scraper.fetchBattingStats(year, league);
      
      if (battingStats.length === 0) {
        console.log(`⚠️  No batting stats found for ${league}, using mock data`);
        await insertMockBattingStats(year, league);
        continue;
      }

      await updateBattingStats(battingStats, year);
      console.log(`✅ Updated ${battingStats.length} batting records for ${league} league`);
    } catch (error) {
      console.error(`❌ Failed to fetch ${league} batting stats:`, error);
      await insertMockBattingStats(year, league);
    }

    // 投手成績の取得
    console.log(`\n⚾ Fetching ${league} league pitching stats...`);
    
    try {
      const pitchingStats = await scraper.fetchPitchingStats(year, league);
      
      if (pitchingStats.length === 0) {
        console.log(`⚠️  No pitching stats found for ${league}, using mock data`);
        await insertMockPitchingStats(year, league);
        continue;
      }

      await updatePitchingStats(pitchingStats, year);
      console.log(`✅ Updated ${pitchingStats.length} pitching records for ${league} league`);
    } catch (error) {
      console.error(`❌ Failed to fetch ${league} pitching stats:`, error);
      await insertMockPitchingStats(year, league);
    }
  }
}

/**
 * 打者成績の更新
 */
async function updateBattingStats(stats: BattingStats[], year: number) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO batting_stats (
      player_id, name, team, position, year, games, at_bats, hits, runs, rbis,
      doubles, triples, home_runs, walks, strikeouts, stolen_bases,
      batting_average, on_base_percentage, slugging_percentage, ops, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const stat of stats) {
    stmt.run(
      stat.player_id, stat.name, stat.team, stat.position, year, stat.games,
      stat.at_bats, stat.hits, stat.runs, stat.rbis, stat.doubles, stat.triples,
      stat.home_runs, stat.walks, stat.strikeouts, stat.stolen_bases,
      stat.batting_average, stat.on_base_percentage, stat.slugging_percentage,
      stat.ops, new Date().toISOString()
    );
  }
}

/**
 * 投手成績の更新
 */
async function updatePitchingStats(stats: PitchingStats[], year: number) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO pitching_stats (
      player_id, name, team, year, games, wins, losses, saves,
      era, innings_pitched, hits_allowed, runs_allowed, earned_runs,
      walks, strikeouts, home_runs_allowed, whip, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const stat of stats) {
    stmt.run(
      stat.player_id, stat.name, stat.team, year, stat.games, stat.wins,
      stat.losses, stat.saves, stat.era, stat.innings_pitched, stat.hits_allowed,
      stat.runs_allowed, stat.earned_runs, stat.walks, stat.strikeouts,
      stat.home_runs_allowed, stat.whip, new Date().toISOString()
    );
  }
}

/**
 * モック打者成績の挿入
 */
async function insertMockBattingStats(year: number, league: 'central' | 'pacific') {
  console.log(`🏏 Inserting mock batting stats for ${league} league...`);
  
  const teams = league === 'central' ? ['YG', 'T', 'C', 'DB', 'S', 'D'] : ['H', 'F', 'L', 'M', 'B', 'E'];
  const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO batting_stats (
      player_id, name, team, position, year, games, at_bats, hits, runs, rbis,
      doubles, triples, home_runs, walks, strikeouts, stolen_bases,
      batting_average, on_base_percentage, slugging_percentage, ops, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let playerCount = 0;
  for (const team of teams) {
    for (let i = 0; i < 25; i++) { // 各チーム25選手
      const playerId = `${team}_batter_${i + 1}`;
      const position = positions[i % positions.length];
      const atBats = Math.floor(Math.random() * 400) + 200;
      const hits = Math.floor(atBats * (0.200 + Math.random() * 0.150)); // .200-.350の打率
      const battingAverage = hits / atBats;
      
      stmt.run(
        playerId,
        `選手${playerCount + 1}`,
        team,
        position,
        year,
        Math.floor(Math.random() * 50) + 100, // 試合数
        atBats,
        hits,
        Math.floor(Math.random() * 80) + 20, // 得点
        Math.floor(Math.random() * 100) + 30, // 打点
        Math.floor(hits * 0.2), // 二塁打
        Math.floor(hits * 0.03), // 三塁打
        Math.floor(Math.random() * 30) + 5, // 本塁打
        Math.floor(Math.random() * 80) + 20, // 四球
        Math.floor(Math.random() * 120) + 50, // 三振
        Math.floor(Math.random() * 20) + 5, // 盗塁
        Math.round(battingAverage * 1000) / 1000,
        Math.round((battingAverage + 0.050) * 1000) / 1000, // OBP
        Math.round((battingAverage + 0.100) * 1000) / 1000, // SLG
        Math.round((battingAverage * 2 + 0.150) * 1000) / 1000, // OPS
        new Date().toISOString()
      );
      playerCount++;
    }
  }
  
  console.log(`   ✅ Created ${playerCount} mock batting records`);
}

/**
 * モック投手成績の挿入
 */
async function insertMockPitchingStats(year: number, league: 'central' | 'pacific') {
  console.log(`⚾ Inserting mock pitching stats for ${league} league...`);
  
  const teams = league === 'central' ? ['YG', 'T', 'C', 'DB', 'S', 'D'] : ['H', 'F', 'L', 'M', 'B', 'E'];
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO pitching_stats (
      player_id, name, team, year, games, wins, losses, saves,
      era, innings_pitched, hits_allowed, runs_allowed, earned_runs,
      walks, strikeouts, home_runs_allowed, whip, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let playerCount = 0;
  for (const team of teams) {
    for (let i = 0; i < 15; i++) { // 各チーム15投手
      const playerId = `${team}_pitcher_${i + 1}`;
      const inningsPitched = Math.floor(Math.random() * 150) + 50;
      const earnedRuns = Math.floor(inningsPitched * (0.02 + Math.random() * 0.04)); // ERA 2.00-6.00
      const era = (earnedRuns * 9) / inningsPitched;
      
      stmt.run(
        playerId,
        `投手${playerCount + 1}`,
        team,
        year,
        Math.floor(Math.random() * 40) + 20, // 試合数
        Math.floor(Math.random() * 15) + 3, // 勝利
        Math.floor(Math.random() * 12) + 2, // 敗戦
        Math.floor(Math.random() * 25), // セーブ
        Math.round(era * 100) / 100,
        inningsPitched,
        Math.floor(inningsPitched * 1.1), // 被安打
        Math.floor(earnedRuns * 1.2), // 失点
        earnedRuns,
        Math.floor(inningsPitched * 0.4), // 四球
        Math.floor(inningsPitched * 0.8), // 奪三振
        Math.floor(inningsPitched * 0.1), // 被本塁打
        Math.round(((inningsPitched * 1.1) + (inningsPitched * 0.4)) / inningsPitched * 100) / 100, // WHIP
        new Date().toISOString()
      );
      playerCount++;
    }
  }
  
  console.log(`   ✅ Created ${playerCount} mock pitching records`);
}

/**
 * 詳細な試合データの取得・更新
 */
async function fetchAndUpdateDetailedGames() {
  console.log('\n🎯 Fetching detailed game data...');
  
  // 既存の試合から最新の10試合を取得
  const recentGames = db.prepare(`
    SELECT game_id FROM games 
    WHERE status = 'final' 
    ORDER BY date DESC, start_time_jst DESC 
    LIMIT 10
  `).all() as { game_id: string }[];

  console.log(`Found ${recentGames.length} recent games to process`);

  let processedCount = 0;
  for (const game of recentGames) {
    try {
      console.log(`   🔄 Processing ${game.game_id}...`);
      
      // 詳細データが既に存在するかチェック
      const existingData = db.prepare('SELECT game_id FROM detailed_games WHERE game_id = ?').get(game.game_id);
      if (existingData) {
        console.log(`   ⏭️  ${game.game_id} already has detailed data, skipping`);
        continue;
      }

      // 詳細データを取得（実際のスクレイピングの代わりにモックデータ）
      await insertMockDetailedGameData(game.game_id);
      processedCount++;
      
      // 礼儀正しい間隔
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ Failed to process ${game.game_id}:`, error);
    }
  }

  console.log(`✅ Processed ${processedCount} detailed game records`);
}

/**
 * モック詳細試合データの挿入
 */
async function insertMockDetailedGameData(gameId: string) {
  const gameInfo = db.prepare('SELECT * FROM games WHERE game_id = ?').get(gameId) as any;
  if (!gameInfo) return;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO detailed_games (
      game_id, date, league, away_team, home_team, away_score, home_score,
      status, venue, start_time_jst, away_hits, home_hits, away_errors, home_errors,
      away_starter, home_starter, attendance, weather, game_time, 
      inning_scores, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // モックイニング別スコア
  const inningScores = {
    away: [0, 1, 0, 2, 0, 0, 1, 0, 0],
    home: [1, 0, 0, 0, 1, 0, 0, 1, 0]
  };

  stmt.run(
    gameInfo.game_id,
    gameInfo.date,
    gameInfo.league,
    gameInfo.away_team,
    gameInfo.home_team,
    gameInfo.away_score,
    gameInfo.home_score,
    gameInfo.status,
    gameInfo.venue,
    gameInfo.start_time_jst,
    Math.floor(Math.random() * 5) + 8, // 安打数
    Math.floor(Math.random() * 5) + 7,
    Math.floor(Math.random() * 3), // エラー数
    Math.floor(Math.random() * 3),
    '田中太郎', // 先発投手（モック）
    '佐藤次郎',
    Math.floor(Math.random() * 20000) + 25000, // 観客数
    '晴れ',
    '3時間12分',
    JSON.stringify(inningScores),
    new Date().toISOString()
  );

  console.log(`   ✅ ${gameId}: detailed data inserted`);
}

// スクリプト実行
if (require.main === module) {
  main().catch(console.error);
}