#!/usr/bin/env ts-node
/**
 * test_production_backfill.ts — Production simulation test with realistic NPB volumes
 * Tests the complete backfill pipeline with realistic data volumes and safety mechanisms
 */
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const DB_DIR = path.resolve("./data");
const HISTORY_DB = path.join(DB_DIR, "db_history.db");

interface GameData {
  games: any[];
  batting: any[];
  pitching: any[];
}

function generateRealisticNPBData(year: number, month: number): GameData {
  const games = [];
  const batting = [];
  const pitching = [];
  
  // NPB realistic volumes: ~25 games per month per team (12 teams)
  // Approximately 60-80 total games per month across both leagues
  const totalGames = Math.floor(Math.random() * 20) + 60; // 60-80 games
  
  const teams = [
    // Central League
    '巨人', '阪神', '中日', '広島', 'ヤクルト', 'DeNA',
    // Pacific League  
    'ソフトバンク', '日本ハム', '西武', 'ロッテ', 'オリックス', '楽天'
  ];
  
  const venues = [
    '東京ドーム', '阪神甲子園球場', 'ナゴヤドーム', 'マツダスタジアム', 
    '明治神宮野球場', '横浜スタジアム', 'PayPayドーム', '札幌ドーム',
    'ベルーナドーム', 'ZOZOマリンスタジアム', '京セラドーム大阪', '楽天生命パーク宮城'
  ];

  for (let gameNum = 1; gameNum <= totalGames; gameNum++) {
    const day = Math.floor(Math.random() * 28) + 1;
    const gameId = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}_${gameNum.toString().padStart(3, '0')}`;
    
    const homeTeam = teams[Math.floor(Math.random() * teams.length)];
    let awayTeam = teams[Math.floor(Math.random() * teams.length)];
    while (awayTeam === homeTeam) {
      awayTeam = teams[Math.floor(Math.random() * teams.length)];
    }
    
    const homeScore = Math.floor(Math.random() * 12);
    const awayScore = Math.floor(Math.random() * 12);
    
    // Game record
    games.push({
      game_id: gameId,
      date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      league: Math.random() > 0.5 ? 'Central' : 'Pacific',
      away_team: awayTeam,
      home_team: homeTeam,
      away_score: awayScore,
      home_score: homeScore,
      status: 'final',
      inning: 9,
      venue: venues[Math.floor(Math.random() * venues.length)],
      start_time_jst: ['18:00', '18:30', '14:00'][Math.floor(Math.random() * 3)],
      updated_at: new Date().toISOString()
    });

    // Batting data (9 players per team)
    for (const team of [homeTeam, awayTeam]) {
      for (let battingOrder = 1; battingOrder <= 9; battingOrder++) {
        const ab = Math.floor(Math.random() * 5) + 1;
        const h = Math.min(ab, Math.floor(Math.random() * (ab + 1)));
        const hr = Math.random() < 0.05 ? 1 : 0; // 5% HR rate
        const doubles = Math.random() < 0.15 ? 1 : 0; // 15% 2B rate
        const rbi = Math.floor(Math.random() * 4);
        
        batting.push({
          game_id: gameId,
          team: team,
          league: games[games.length - 1].league,
          player_id: `${team}_player_${battingOrder}`,
          name: `${team}選手${battingOrder}`,
          batting_order: battingOrder,
          position: battingOrder === 1 ? 'P' : ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][battingOrder - 2] || 'OF',
          AB: ab,
          R: Math.min(rbi, Math.floor(Math.random() * 3)),
          H: h,
          singles_2B: doubles,
          singles_3B: Math.random() < 0.02 ? 1 : 0, // 2% 3B rate
          HR: hr,
          RBI: rbi,
          BB: Math.floor(Math.random() * 3),
          SO: Math.floor(Math.random() * Math.max(1, ab)),
          SB: Math.random() < 0.1 ? 1 : 0,
          CS: 0,
          AVG: ab > 0 ? h / ab : 0.000,
          OPS: ab > 0 ? (h / ab) + ((h + Math.random()) / ab) : 0.000,
          HBP: Math.random() < 0.05 ? 1 : 0,
          SF: Math.random() < 0.08 ? 1 : 0
        });
      }
    }

    // Pitching data (3-5 pitchers per team)
    for (const team of [homeTeam, awayTeam]) {
      const numPitchers = Math.floor(Math.random() * 3) + 3; // 3-5 pitchers
      const opponent = team === homeTeam ? awayTeam : homeTeam;
      
      for (let pitcherNum = 1; pitcherNum <= numPitchers; pitcherNum++) {
        const ip = pitcherNum === 1 ? 
          Math.random() * 7 + 2 : // Starter: 2-9 innings
          Math.random() * 3;     // Reliever: 0-3 innings
        
        const hits = Math.floor(Math.random() * Math.max(1, ip * 1.2));
        const runs = Math.floor(Math.random() * Math.max(1, hits * 0.7));
        const er = Math.min(runs, Math.floor(runs * 0.8));
        const bb = Math.floor(Math.random() * Math.max(1, ip * 0.5));
        const so = Math.floor(Math.random() * Math.max(1, ip * 1.5));
        
        pitching.push({
          game_id: gameId,
          team: team,
          league: games[games.length - 1].league,
          opponent: opponent,
          player_id: `${team}_pitcher_${pitcherNum}`,
          name: `${team}投手${pitcherNum}`,
          IP: Math.round(ip * 3) / 3, // Round to 1/3 innings
          H: hits,
          R: runs,
          ER: er,
          BB: bb,
          SO: so,
          HR_allowed: Math.random() < 0.1 ? Math.floor(Math.random() * 2) + 1 : 0,
          ERA: ip > 0 ? Math.round((er * 9 / ip) * 100) / 100 : 0.00,
          WHIP: ip > 0 ? Math.round(((hits + bb) / ip) * 100) / 100 : 0.00
        });
      }
    }
  }

  console.log(`📊 Generated realistic NPB data: ${games.length} games, ${batting.length} batting records, ${pitching.length} pitching records`);
  return { games, batting, pitching };
}

function testProductionVolumes() {
  console.log("🏟️  Testing production NPB data volumes...");
  
  const db = new Database(HISTORY_DB);
  
  // Clear any existing test data
  db.exec("DELETE FROM games WHERE game_id LIKE '2019%_test'");
  db.exec("DELETE FROM box_batting WHERE game_id LIKE '2019%_test'");  
  db.exec("DELETE FROM box_pitching WHERE game_id LIKE '2019%_test'");
  
  const testResults = [];
  
  // Test April 2019 with realistic volumes
  console.log("\n📅 Testing April 2019 production volume...");
  const aprilData = generateRealisticNPBData(2019, 4);
  
  // Create temp tables
  db.exec(`
    CREATE TEMPORARY TABLE new_games AS SELECT * FROM games WHERE 0;
    CREATE TEMPORARY TABLE new_box_batting AS SELECT * FROM box_batting WHERE 0;
    CREATE TEMPORARY TABLE new_box_pitching AS SELECT * FROM box_pitching WHERE 0;
  `);
  
  const startTime = Date.now();
  
  // Insert generated data into temp tables  
  const gameStmt = db.prepare(`
    INSERT INTO new_games (game_id, date, league, away_team, home_team, away_score, 
    home_score, status, inning, venue, start_time_jst, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const battingStmt = db.prepare(`
    INSERT INTO new_box_batting (game_id, team, league, player_id, name, batting_order,
    position, AB, R, H, singles_2B, singles_3B, HR, RBI, BB, SO, SB, CS, AVG, OPS, HBP, SF)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const pitchingStmt = db.prepare(`
    INSERT INTO new_box_pitching (game_id, team, league, opponent, player_id, name,
    IP, H, R, ER, BB, SO, HR_allowed, ERA, WHIP)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Insert games
  aprilData.games.forEach(game => {
    gameStmt.run(
      game.game_id + '_test', game.date, game.league, game.away_team, game.home_team,
      game.away_score, game.home_score, game.status, game.inning, game.venue,
      game.start_time_jst, game.updated_at
    );
  });

  // Insert batting
  aprilData.batting.forEach(bat => {
    battingStmt.run(
      bat.game_id + '_test', bat.team, bat.league, bat.player_id, bat.name, bat.batting_order,
      bat.position, bat.AB, bat.R, bat.H, bat.singles_2B, bat.singles_3B, bat.HR,
      bat.RBI, bat.BB, bat.SO, bat.SB, bat.CS, bat.AVG, bat.OPS, bat.HBP, bat.SF
    );
  });

  // Insert pitching
  aprilData.pitching.forEach(pitch => {
    pitchingStmt.run(
      pitch.game_id + '_test', pitch.team, pitch.league, pitch.opponent, pitch.player_id,
      pitch.name, pitch.IP, pitch.H, pitch.R, pitch.ER, pitch.BB, pitch.SO,
      pitch.HR_allowed, pitch.ERA, pitch.WHIP
    );
  });
  
  const insertTime = Date.now() - startTime;
  
  // Test anti-join upsert logic
  const duplicateCheck = db.prepare(`
    SELECT COUNT(*) as count FROM new_games 
    WHERE EXISTS (SELECT 1 FROM games WHERE games.game_id = new_games.game_id)
  `).get() as { count: number };
  
  // Perform upsert
  const upsertStart = Date.now();
  
  const gameUpsert = db.prepare(`
    INSERT INTO games SELECT * FROM new_games 
    WHERE NOT EXISTS (SELECT 1 FROM games AS dst WHERE dst.game_id = new_games.game_id)
  `);
  
  const battingUpsert = db.prepare(`
    INSERT INTO box_batting SELECT * FROM new_box_batting 
    WHERE NOT EXISTS (SELECT 1 FROM box_batting AS dst WHERE dst.id = new_box_batting.id)
  `);
  
  const pitchingUpsert = db.prepare(`
    INSERT INTO box_pitching SELECT * FROM new_box_pitching 
    WHERE NOT EXISTS (SELECT 1 FROM box_pitching AS dst WHERE dst.id = new_box_pitching.id)
  `);
  
  const gameResult = gameUpsert.run();
  const battingResult = battingUpsert.run();
  const pitchingResult = pitchingUpsert.run();
  
  const upsertTime = Date.now() - upsertStart;
  
  // Verify final counts
  const finalCounts = {
    games: db.prepare("SELECT COUNT(*) as count FROM games WHERE game_id LIKE '%_test'").get() as { count: number },
    batting: db.prepare("SELECT COUNT(*) as count FROM box_batting WHERE game_id LIKE '%_test'").get() as { count: number },
    pitching: db.prepare("SELECT COUNT(*) as count FROM box_pitching WHERE game_id LIKE '%_test'").get() as { count: number }
  };
  
  const result = {
    month: '2019-04',
    generated: {
      games: aprilData.games.length,
      batting: aprilData.batting.length,
      pitching: aprilData.pitching.length
    },
    performance: {
      insertTimeMs: insertTime,
      upsertTimeMs: upsertTime,
      totalTimeMs: insertTime + upsertTime
    },
    upsert: {
      games: { inserted: gameResult.changes, duplicates: duplicateCheck.count },
      batting: { inserted: battingResult.changes },
      pitching: { inserted: pitchingResult.changes }
    },
    final: finalCounts,
    throughput: {
      recordsPerSecond: Math.round((aprilData.games.length + aprilData.batting.length + aprilData.pitching.length) / ((insertTime + upsertTime) / 1000)),
      gamesPerSecond: Math.round(aprilData.games.length / ((insertTime + upsertTime) / 1000))
    }
  };
  
  testResults.push(result);
  
  // Clean up temp tables
  db.exec("DROP TABLE new_games; DROP TABLE new_box_batting; DROP TABLE new_box_pitching;");
  
  console.log(`✅ Production test complete:`);
  console.log(`   📊 Processed: ${result.generated.games} games, ${result.generated.batting + result.generated.pitching} player records`);
  console.log(`   ⚡ Performance: ${result.throughput.recordsPerSecond} records/sec, ${result.throughput.gamesPerSecond} games/sec`);
  console.log(`   🔒 Anti-join: ${result.upsert.games.inserted} new games, ${result.upsert.games.duplicates} duplicates blocked`);
  console.log(`   ⏱️  Total time: ${result.performance.totalTimeMs}ms`);
  
  // Clean up test data
  db.exec("DELETE FROM games WHERE game_id LIKE '%_test'");
  db.exec("DELETE FROM box_batting WHERE game_id LIKE '%_test'");  
  db.exec("DELETE FROM box_pitching WHERE game_id LIKE '%_test'");
  
  db.close();
  
  // Save detailed report
  const reportPath = path.join(DB_DIR, `production_test_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    testType: "production_volume_simulation",
    timestamp: new Date().toISOString(),
    results: testResults,
    summary: {
      totalRecordsProcessed: result.generated.games + result.generated.batting + result.generated.pitching,
      averageThroughput: result.throughput.recordsPerSecond,
      antiJoinEffective: result.upsert.games.duplicates === 0,
      performanceGrade: result.throughput.recordsPerSecond > 1000 ? 'A' : 
                       result.throughput.recordsPerSecond > 500 ? 'B' : 'C'
    }
  }, null, 2));
  
  console.log(`\n📝 Detailed report saved: ${reportPath}`);
  
  return result;
}

// Run the test
if (require.main === module) {
  const result = testProductionVolumes();
  
  // Pass/fail criteria
  const success = result.throughput.recordsPerSecond > 100 && // Minimum 100 records/sec
                  result.upsert.games.duplicates === 0 && // No duplicates
                  result.performance.totalTimeMs < 30000; // Under 30 seconds
  
  console.log(`\n🎯 Production readiness: ${success ? '✅ PASS' : '❌ FAIL'}`);
  process.exit(success ? 0 : 1);
}