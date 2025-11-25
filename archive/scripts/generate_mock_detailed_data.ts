#!/usr/bin/env tsx
/**
 * generate_mock_detailed_data.ts - モック詳細NPBデータの生成
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data', 'db_current.db');
const db = new Database(dbPath);

async function main() {
  console.log('🚀 Generating mock detailed NPB data...');
  
  try {
    await generateTeamStandings();
    await generatePlayerStats();
    await generateDetailedGameData();
    
    console.log('\n✅ Mock detailed NPB data generation completed!');
  } catch (error) {
    console.error('❌ Error generating mock data:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

/**
 * チーム順位表の生成
 */
async function generateTeamStandings() {
  console.log('\n📊 Generating team standings...');
  
  const year = new Date().getFullYear();
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
      Math.random() > 0.5 ? `W${Math.floor(Math.random() * 5) + 1}` : `L${Math.floor(Math.random() * 3) + 1}`,
      `${Math.floor(Math.random() * 4) + 6}-${Math.floor(Math.random() * 4) + 2}`,
      `${Math.floor(standing.wins * 0.55)}-${Math.floor(standing.losses * 0.45)}`,
      `${Math.floor(standing.wins * 0.45)}-${Math.floor(standing.losses * 0.55)}`,
      new Date().toISOString()
    );
    console.log(`   ✅ ${standing.team}: ${standing.wins}-${standing.losses} (.${standing.win_percentage})`);
  }

  console.log(`📊 Generated ${mockStandings.length} team standings`);
}

/**
 * 選手成績の生成
 */
async function generatePlayerStats() {
  console.log('\n⚾ Generating player statistics...');
  
  const year = new Date().getFullYear();
  
  // 打者成績の生成
  await generateBattingStats(year);
  
  // 投手成績の生成
  await generatePitchingStats(year);
}

/**
 * 打者成績の生成
 */
async function generateBattingStats(year: number) {
  console.log('\n🏏 Generating batting statistics...');
  
  const teams = ['YG', 'T', 'C', 'DB', 'S', 'D', 'H', 'F', 'L', 'M', 'B', 'E'];
  const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  const firstNames = ['太郎', '次郎', '三郎', '四郎', '五郎', '六郎', '七郎', '八郎', '九郎', '十郎'];
  const lastNames = ['田中', '佐藤', '鈴木', '高橋', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO batting_stats (
      player_id, name, team, position, year, games, at_bats, hits, runs, rbis,
      doubles, triples, home_runs, walks, strikeouts, stolen_bases,
      batting_average, on_base_percentage, slugging_percentage, ops, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalPlayers = 0;
  for (const team of teams) {
    for (let i = 0; i < 25; i++) { // 各チーム25選手
      const playerId = `${team}_batter_${String(i + 1).padStart(2, '0')}`;
      const position = positions[i % positions.length];
      const name = `${lastNames[Math.floor(Math.random() * lastNames.length)]} ${firstNames[Math.floor(Math.random() * firstNames.length)]}`;
      
      // リアルな打撃成績を生成
      const games = Math.floor(Math.random() * 50) + 100; // 100-149試合
      const atBats = Math.floor(games * (3 + Math.random() * 2)); // 1試合3-5打席
      const baseAverage = 0.200 + Math.random() * 0.150; // .200-.350の打率
      const hits = Math.floor(atBats * baseAverage);
      const battingAverage = hits / atBats;
      
      const doubles = Math.floor(hits * (0.15 + Math.random() * 0.10)); // 15-25%が二塁打
      const triples = Math.floor(hits * (0.01 + Math.random() * 0.03)); // 1-4%が三塁打
      const homeRuns = Math.floor(hits * (0.05 + Math.random() * 0.15)); // 5-20%が本塁打
      const walks = Math.floor(atBats * (0.08 + Math.random() * 0.07)); // 8-15%四球率
      const strikeouts = Math.floor(atBats * (0.15 + Math.random() * 0.10)); // 15-25%三振率
      
      const totalBases = hits + doubles + (triples * 2) + (homeRuns * 3);
      const sluggingPercentage = totalBases / atBats;
      const onBasePercentage = (hits + walks) / (atBats + walks);
      const ops = onBasePercentage + sluggingPercentage;
      
      stmt.run(
        playerId, name, team, position, year, games, atBats, hits,
        Math.floor(Math.random() * 80) + 20, // 得点
        Math.floor(Math.random() * 100) + 30, // 打点
        doubles, triples, homeRuns, walks, strikeouts,
        Math.floor(Math.random() * 20) + 5, // 盗塁
        Math.round(battingAverage * 1000) / 1000,
        Math.round(onBasePercentage * 1000) / 1000,
        Math.round(sluggingPercentage * 1000) / 1000,
        Math.round(ops * 1000) / 1000,
        new Date().toISOString()
      );
      totalPlayers++;
    }
  }
  
  console.log(`   ✅ Generated ${totalPlayers} batting records`);
}

/**
 * 投手成績の生成
 */
async function generatePitchingStats(year: number) {
  console.log('\n⚾ Generating pitching statistics...');
  
  const teams = ['YG', 'T', 'C', 'DB', 'S', 'D', 'H', 'F', 'L', 'M', 'B', 'E'];
  const firstNames = ['太郎', '次郎', '三郎', '四郎', '五郎', '六郎', '七郎', '八郎', '九郎', '十郎'];
  const lastNames = ['田中', '佐藤', '鈴木', '高橋', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO pitching_stats (
      player_id, name, team, year, games, wins, losses, saves,
      era, innings_pitched, hits_allowed, runs_allowed, earned_runs,
      walks, strikeouts, home_runs_allowed, whip, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalPitchers = 0;
  for (const team of teams) {
    for (let i = 0; i < 15; i++) { // 各チーム15投手
      const playerId = `${team}_pitcher_${String(i + 1).padStart(2, '0')}`;
      const name = `${lastNames[Math.floor(Math.random() * lastNames.length)]} ${firstNames[Math.floor(Math.random() * firstNames.length)]}`;
      
      // リアルな投手成績を生成
      const isStarter = i < 5; // 最初の5人は先発投手
      const games = isStarter ? Math.floor(Math.random() * 10) + 25 : Math.floor(Math.random() * 30) + 40;
      const inningsPitched = isStarter ? 
        Math.floor(Math.random() * 50) + 150 : 
        Math.floor(Math.random() * 40) + 30;
      
      const baseERA = 2.50 + Math.random() * 2.50; // 2.50-5.00のERA
      const earnedRuns = Math.floor((inningsPitched * baseERA) / 9);
      const runsAllowed = Math.floor(earnedRuns * (1.1 + Math.random() * 0.2));
      const hitsAllowed = Math.floor(inningsPitched * (0.8 + Math.random() * 0.4));
      const walks = Math.floor(inningsPitched * (0.2 + Math.random() * 0.3));
      const strikeouts = Math.floor(inningsPitched * (0.6 + Math.random() * 0.6));
      const homeRunsAllowed = Math.floor(inningsPitched * (0.05 + Math.random() * 0.10));
      
      const whip = (hitsAllowed + walks) / inningsPitched;
      const era = (earnedRuns * 9) / inningsPitched;
      
      // 勝敗・セーブの設定
      let wins, losses, saves;
      if (isStarter) {
        wins = Math.floor(Math.random() * 12) + 3;
        losses = Math.floor(Math.random() * 10) + 2;
        saves = 0;
      } else {
        wins = Math.floor(Math.random() * 6) + 1;
        losses = Math.floor(Math.random() * 5) + 1;
        saves = i < 8 ? Math.floor(Math.random() * 25) : 0; // リリーフの一部はセーブ持ち
      }
      
      stmt.run(
        playerId, name, team, year, games, wins, losses, saves,
        Math.round(era * 100) / 100, inningsPitched, hitsAllowed,
        runsAllowed, earnedRuns, walks, strikeouts, homeRunsAllowed,
        Math.round(whip * 100) / 100, new Date().toISOString()
      );
      totalPitchers++;
    }
  }
  
  console.log(`   ✅ Generated ${totalPitchers} pitching records`);
}

/**
 * 詳細な試合データの生成
 */
async function generateDetailedGameData() {
  console.log('\n🎯 Generating detailed game data...');
  
  // 既存の試合から最新の20試合を取得
  const recentGames = db.prepare(`
    SELECT game_id, away_team, home_team, away_score, home_score, date, venue, start_time_jst, league, status
    FROM games 
    WHERE status = 'final' 
    ORDER BY date DESC, start_time_jst DESC 
    LIMIT 20
  `).all() as any[];

  console.log(`Found ${recentGames.length} recent games to process`);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO detailed_games (
      game_id, date, league, away_team, home_team, away_score, home_score,
      status, venue, start_time_jst, away_hits, home_hits, away_errors, home_errors,
      away_starter, home_starter, attendance, weather, game_time, 
      inning_scores, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const pitcherNames = ['田中太郎', '佐藤次郎', '鈴木三郎', '高橋四郎', '伊藤五郎', '渡辺六郎', '山本七郎', '中村八郎'];
  const weatherOptions = ['晴れ', '曇り', '小雨', '雨', 'ドーム'];

  for (const game of recentGames) {
    // イニング別スコアの生成
    const awayInnings: number[] = [];
    const homeInnings: number[] = [];
    let awayTotal = 0;
    let homeTotal = 0;
    
    // 9イニングのスコアを生成
    for (let i = 0; i < 9; i++) {
      const awayInningScore = Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0;
      const homeInningScore = Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0;
      
      awayInnings.push(awayInningScore);
      homeInnings.push(homeInningScore);
      awayTotal += awayInningScore;
      homeTotal += homeInningScore;
    }
    
    // 実際のスコアに合わせて調整
    const awayDiff = game.away_score - awayTotal;
    const homeDiff = game.home_score - homeTotal;
    
    if (awayDiff !== 0) {
      const randomInning = Math.floor(Math.random() * 9);
      awayInnings[randomInning] = Math.max(0, awayInnings[randomInning] + awayDiff);
    }
    
    if (homeDiff !== 0) {
      const randomInning = Math.floor(Math.random() * 9);
      homeInnings[randomInning] = Math.max(0, homeInnings[randomInning] + homeDiff);
    }

    const inningScores = {
      away: awayInnings,
      home: homeInnings
    };

    stmt.run(
      game.game_id,
      game.date,
      game.league,
      game.away_team,
      game.home_team,
      game.away_score,
      game.home_score,
      game.status,
      game.venue,
      game.start_time_jst,
      Math.floor(Math.random() * 5) + Math.max(game.away_score, 6), // 安打数（最低スコア+6）
      Math.floor(Math.random() * 5) + Math.max(game.home_score, 6),
      Math.floor(Math.random() * 3), // エラー数
      Math.floor(Math.random() * 3),
      pitcherNames[Math.floor(Math.random() * pitcherNames.length)], // 先発投手
      pitcherNames[Math.floor(Math.random() * pitcherNames.length)],
      Math.floor(Math.random() * 20000) + 25000, // 観客数
      weatherOptions[Math.floor(Math.random() * weatherOptions.length)],
      `${Math.floor(Math.random() * 60) + 150}分`, // 試合時間
      JSON.stringify(inningScores),
      new Date().toISOString()
    );

    console.log(`   ✅ ${game.game_id}: ${game.away_team} ${game.away_score}-${game.home_score} ${game.home_team}`);
  }

  console.log(`✅ Generated ${recentGames.length} detailed game records`);
}

// スクリプト実行
if (require.main === module) {
  main().catch(console.error);
}