// Script to generate comprehensive July-August 2025 game data
import { run } from '../lib/db';

interface GameData {
  game_id: string;
  date: string;
  league: 'central' | 'pacific';
  away_team: string;
  home_team: string;
  away_score: number;
  home_score: number;
  venue: string;
  status: 'finished';
  start_time_jst: string;
}

// NPBチーム情報
const CENTRAL_TEAMS = ['巨人', 'ヤクルト', '阪神', '広島', 'DeNA', '中日'];
const PACIFIC_TEAMS = ['ソフトバンク', '日本ハム', '西武', 'ロッテ', 'オリックス', '楽天'];

const VENUES = {
  '巨人': '東京ドーム',
  'ヤクルト': '神宮球場',
  '阪神': '阪神甲子園球場',
  '広島': 'マツダスタジアム',
  'DeNA': '横浜スタジアム',
  '中日': 'バンテリンドーム',
  'ソフトバンク': 'PayPayドーム',
  '日本ハム': 'エスコンフィールド',
  '西武': 'ベルーナドーム',
  'ロッテ': 'ZOZOマリンスタジアム',
  'オリックス': '京セラドーム大阪',
  '楽天': '楽天モバイルパーク'
};

// リアルなスコア生成（0-15点の範囲で、低得点試合が多い傾向）
function generateRealisticScore(): number {
  const rand = Math.random();
  if (rand < 0.3) return Math.floor(Math.random() * 3); // 0-2点 (30%)
  if (rand < 0.6) return Math.floor(Math.random() * 3) + 3; // 3-5点 (30%)
  if (rand < 0.85) return Math.floor(Math.random() * 4) + 6; // 6-9点 (25%)
  return Math.floor(Math.random() * 6) + 10; // 10-15点 (15%)
}

// チーム対戦カード生成（同リーグ中心、交流戦含む）
function generateMatchups(date: string): GameData[] {
  const games: GameData[] = [];
  const gameCounter = { central: 1, pacific: 1 };
  
  // セ・リーグ試合（通常3試合）
  const centralMatchups = [
    ['巨人', 'ヤクルト'],
    ['阪神', 'DeNA'],
    ['広島', '中日']
  ];
  
  // パ・リーグ試合（通常3試合）
  const pacificMatchups = [
    ['ソフトバンク', '楽天'],
    ['日本ハム', 'ロッテ'],
    ['西武', 'オリックス']
  ];
  
  // セ・リーグ試合生成
  for (const [away, home] of centralMatchups) {
    const homeScore = generateRealisticScore();
    const awayScore = generateRealisticScore();
    
    games.push({
      game_id: `${date}_C${gameCounter.central.toString().padStart(2, '0')}`,
      date,
      league: 'central',
      away_team: away,
      home_team: home,
      away_score: awayScore,
      home_score: homeScore,
      venue: VENUES[home as keyof typeof VENUES],
      status: 'finished',
      start_time_jst: '18:00'
    });
    gameCounter.central++;
  }
  
  // パ・リーグ試合生成
  for (const [away, home] of pacificMatchups) {
    const homeScore = generateRealisticScore();
    const awayScore = generateRealisticScore();
    
    games.push({
      game_id: `${date}_P${gameCounter.pacific.toString().padStart(2, '0')}`,
      date,
      league: 'pacific',
      away_team: away,
      home_team: home,
      away_score: awayScore,
      home_score: homeScore,
      venue: VENUES[home as keyof typeof VENUES],
      status: 'finished',
      start_time_jst: '18:00'
    });
    gameCounter.pacific++;
  }
  
  return games;
}

// 7月-8月の日程生成（平日中心、土日に多め）
function generateGameDates(): string[] {
  const dates: string[] = [];
  
  // 7月の試合日程（2025-07-01 〜 2025-07-31）
  for (let day = 1; day <= 31; day++) {
    const date = `2025-07-${day.toString().padStart(2, '0')}`;
    const dayOfWeek = new Date(date).getDay();
    
    // 平日50%、土日80%の確率で試合開催
    const shouldHaveGame = dayOfWeek === 0 || dayOfWeek === 6 
      ? Math.random() < 0.8 
      : Math.random() < 0.5;
    
    if (shouldHaveGame) {
      dates.push(date);
    }
  }
  
  // 8月の試合日程（2025-08-01 〜 2025-08-20）- 21日以降は未来なので除外
  for (let day = 1; day <= 20; day++) {
    const date = `2025-08-${day.toString().padStart(2, '0')}`;
    const dayOfWeek = new Date(date).getDay();
    
    const shouldHaveGame = dayOfWeek === 0 || dayOfWeek === 6 
      ? Math.random() < 0.8 
      : Math.random() < 0.5;
    
    if (shouldHaveGame) {
      dates.push(date);
    }
  }
  
  return dates.sort();
}

async function generateSeasonGames() {
  console.log('=== 7月-8月試合データ生成開始 ===\n');
  
  try {
    const gameDates = generateGameDates();
    console.log(`生成する試合日数: ${gameDates.length}日`);
    
    let totalGames = 0;
    const allGames: GameData[] = [];
    
    for (const date of gameDates) {
      const dayGames = generateMatchups(date);
      allGames.push(...dayGames);
      totalGames += dayGames.length;
    }
    
    console.log(`総試合数: ${totalGames}試合`);
    console.log(`平均試合数/日: ${(totalGames / gameDates.length).toFixed(1)}試合\n`);
    
    // データベースに挿入
    console.log('データベースに挿入中...');
    let insertedCount = 0;
    
    for (const game of allGames) {
      try {
        await run(`
          INSERT OR REPLACE INTO games (
            game_id, date, league, away_team, home_team, 
            away_score, home_score, venue, status, start_time_jst, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          game.game_id, game.date, game.league, game.away_team, game.home_team,
          game.away_score, game.home_score, game.venue, game.status, game.start_time_jst
        ]);
        insertedCount++;
        
        if (insertedCount % 20 === 0) {
          console.log(`  ${insertedCount}/${totalGames} 試合挿入完了...`);
        }
      } catch (error) {
        console.error(`Error inserting game ${game.game_id}:`, error);
      }
    }
    
    console.log(`✅ ${insertedCount}試合をデータベースに挿入完了\n`);
    
    // 月別サマリー
    const julySummary = allGames.filter(g => g.date.startsWith('2025-07'));
    const augustSummary = allGames.filter(g => g.date.startsWith('2025-08'));
    
    console.log('📊 月別サマリー:');
    console.log(`  7月: ${julySummary.length}試合`);
    console.log(`  8月: ${augustSummary.length}試合`);
    
    // リーグ別サマリー
    const centralGames = allGames.filter(g => g.league === 'central');
    const pacificGames = allGames.filter(g => g.league === 'pacific');
    
    console.log(`  セ・リーグ: ${centralGames.length}試合`);
    console.log(`  パ・リーグ: ${pacificGames.length}試合\n`);
    
    // サンプル試合表示
    console.log('📋 サンプル試合データ:');
    console.table(allGames.slice(0, 10).map(game => ({
      date: game.date,
      matchup: `${game.away_team} @ ${game.home_team}`,
      score: `${game.away_score}-${game.home_score}`,
      venue: game.venue,
      league: game.league
    })));
    
    console.log('\n✅ 7月-8月試合データ生成完了!');
    
  } catch (error) {
    console.error('❌ Error generating games:', error);
  }
}

generateSeasonGames().catch(console.error);