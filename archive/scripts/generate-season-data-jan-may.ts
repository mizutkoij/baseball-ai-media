// Script to generate comprehensive 2025 season data (January-May)
import { run, query } from '../lib/db';

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
  inning?: number;
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

// 地方球場も含める
const REGIONAL_VENUES = [
  '札幌ドーム', '青森', '秋田こまちスタジアム', '岩手県営野球場',
  '仙台市民球場', '郡山', '高崎', '茨城県立カシマサッカースタジアム',
  '静岡草薙球場', '松本', '新潟', 'ハードオフエコスタジアム新潟',
  '金沢', '福井', '山梨', '長野オリンピックスタジアム',
  '岐阜長良川球場', '浜松球場', '富山', '石川県立野球場',
  '京都西京極球場', '奈良', '和歌山市民球場', '姫路球場',
  '倉敷マスカットスタジアム', '鳥取', '島根', '山口',
  '徳島', '高松', '愛媛県坊っちゃんスタジアム', '高知',
  '北九州市民球場', '大分', '宮崎', '鹿児島', '沖縄'
];

// 月別試合数配分（NPBシーズン構成に合わせて）
const MONTHLY_GAME_COUNTS = {
  '01': 0,   // 1月: オフシーズン
  '02': 0,   // 2月: オフシーズン・キャンプ
  '03': 15,  // 3月: オープン戦
  '04': 45,  // 4月: シーズン開幕
  '05': 60,  // 5月: シーズン本格化
};

// リアルなスコア生成（月別調整）
function generateRealisticScore(month: string): number {
  const rand = Math.random();
  
  // 3月（オープン戦）: より高得点傾向
  if (month === '03') {
    if (rand < 0.2) return Math.floor(Math.random() * 3); // 0-2点 (20%)
    if (rand < 0.4) return Math.floor(Math.random() * 3) + 3; // 3-5点 (20%)
    if (rand < 0.7) return Math.floor(Math.random() * 4) + 6; // 6-9点 (30%)
    return Math.floor(Math.random() * 6) + 10; // 10-15点 (30%)
  }
  
  // 4-5月（公式戦）: 通常傾向
  if (rand < 0.35) return Math.floor(Math.random() * 3); // 0-2点 (35%)
  if (rand < 0.65) return Math.floor(Math.random() * 3) + 3; // 3-5点 (30%)
  if (rand < 0.85) return Math.floor(Math.random() * 4) + 6; // 6-9点 (20%)
  return Math.floor(Math.random() * 6) + 10; // 10-15点 (15%)
}

// 対戦カード生成（リーグ戦・交流戦）
function generateMatchupsForDate(date: string): GameData[] {
  const games: GameData[] = [];
  const month = date.substring(5, 7);
  const dayOfWeek = new Date(date).getDay();
  
  // 3月はオープン戦（少なめ、変則的）
  if (month === '03') {
    const numGames = Math.random() < 0.3 ? 2 : (Math.random() < 0.7 ? 4 : 6);
    
    for (let i = 0; i < numGames; i++) {
      // セ・パ混合対戦もあり
      const allTeams = [...CENTRAL_TEAMS, ...PACIFIC_TEAMS];
      const awayIdx = Math.floor(Math.random() * allTeams.length);
      let homeIdx = Math.floor(Math.random() * allTeams.length);
      while (homeIdx === awayIdx) {
        homeIdx = Math.floor(Math.random() * allTeams.length);
      }
      
      const awayTeam = allTeams[awayIdx];
      const homeTeam = allTeams[homeIdx];
      
      // オープン戦は地方開催も多い
      const venue = Math.random() < 0.4 
        ? REGIONAL_VENUES[Math.floor(Math.random() * REGIONAL_VENUES.length)]
        : VENUES[homeTeam as keyof typeof VENUES];
      
      games.push({
        game_id: `${date}_OP${(i + 1).toString().padStart(2, '0')}`,
        date,
        league: CENTRAL_TEAMS.includes(homeTeam) ? 'central' : 'pacific',
        away_team: awayTeam,
        home_team: homeTeam,
        away_score: generateRealisticScore(month),
        home_score: generateRealisticScore(month),
        venue,
        status: 'finished',
        start_time_jst: dayOfWeek === 0 || dayOfWeek === 6 ? '13:00' : '18:00'
      });
    }
  } 
  // 4-5月は公式戦
  else {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const numGames = isWeekend ? 6 : (Math.random() < 0.8 ? 6 : 3); // 平日も試合多め
    
    // セ・リーグ3試合
    const centralPairs = generateLeaguePairs(CENTRAL_TEAMS);
    centralPairs.slice(0, 3).forEach((pair, idx) => {
      const [away, home] = pair;
      games.push({
        game_id: `${date}_C${(idx + 1).toString().padStart(2, '0')}`,
        date,
        league: 'central',
        away_team: away,
        home_team: home,
        away_score: generateRealisticScore(month),
        home_score: generateRealisticScore(month),
        venue: VENUES[home as keyof typeof VENUES],
        status: 'finished',
        start_time_jst: isWeekend ? (Math.random() < 0.5 ? '14:00' : '18:00') : '18:00'
      });
    });
    
    // パ・リーグ3試合
    const pacificPairs = generateLeaguePairs(PACIFIC_TEAMS);
    pacificPairs.slice(0, 3).forEach((pair, idx) => {
      const [away, home] = pair;
      games.push({
        game_id: `${date}_P${(idx + 1).toString().padStart(2, '0')}`,
        date,
        league: 'pacific',
        away_team: away,
        home_team: home,
        away_score: generateRealisticScore(month),
        home_score: generateRealisticScore(month),
        venue: VENUES[home as keyof typeof VENUES],
        status: 'finished',
        start_time_jst: isWeekend ? (Math.random() < 0.5 ? '14:00' : '18:00') : '18:00'
      });
    });
  }
  
  return games;
}

// リーグ内対戦ペア生成
function generateLeaguePairs(teams: string[]): string[][] {
  const pairs: string[][] = [];
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  
  return pairs;
}

// 試合日程生成（月別調整）
function generateGameDatesForMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const monthStr = month.toString().padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  
  const targetGames = MONTHLY_GAME_COUNTS[monthStr as keyof typeof MONTHLY_GAME_COUNTS];
  if (targetGames === 0) return dates;
  
  // 3月: 限定的な日程
  if (month === 3) {
    const startDate = 15; // 3月15日頃から
    for (let day = startDate; day <= daysInMonth; day++) {
      const date = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
      if (Math.random() < 0.4) { // 40%の確率で試合開催
        dates.push(date);
      }
    }
  }
  // 4-5月: 高頻度
  else if (month >= 4) {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
      const dayOfWeek = new Date(date).getDay();
      
      // 平日70%, 土日90%の確率で試合
      const gameProb = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.9 : 0.7;
      if (Math.random() < gameProb) {
        dates.push(date);
      }
    }
  }
  
  return dates.sort();
}

async function generateSeasonData() {
  console.log('=== 2025年1月-5月試合データ生成開始 ===\n');
  
  try {
    // 既存データチェック
    const existingGames = await query("SELECT COUNT(*) as count FROM games WHERE date >= '2025-01-01' AND date < '2025-06-01'");
    const currentCount = existingGames[0]?.count || 0;
    
    console.log(`既存の1-5月データ: ${currentCount}試合`);
    
    if (currentCount > 100) {
      console.log('⚠️ 既に十分なデータが存在します。追加生成しますか？');
    }
    
    let totalGames = 0;
    const allGames: GameData[] = [];
    
    // 各月のデータ生成
    for (let month = 1; month <= 5; month++) {
      console.log(`\n📅 ${month}月のデータ生成中...`);
      const gameDates = generateGameDatesForMonth(2025, month);
      
      console.log(`  試合日数: ${gameDates.length}日`);
      
      for (const date of gameDates) {
        const dayGames = generateMatchupsForDate(date);
        allGames.push(...dayGames);
        totalGames += dayGames.length;
      }
      
      const monthGames = allGames.filter(g => g.date.substring(5, 7) === month.toString().padStart(2, '0'));
      console.log(`  ${month}月総試合数: ${monthGames.length}試合`);
    }
    
    console.log(`\n📊 全期間サマリー:`);
    console.log(`総試合数: ${totalGames}試合`);
    
    // 月別統計
    for (let month = 1; month <= 5; month++) {
      const monthStr = month.toString().padStart(2, '0');
      const monthGames = allGames.filter(g => g.date.substring(5, 7) === monthStr);
      console.log(`  ${month}月: ${monthGames.length}試合`);
    }
    
    // リーグ別統計
    const centralGames = allGames.filter(g => g.league === 'central');
    const pacificGames = allGames.filter(g => g.league === 'pacific');
    console.log(`  セ・リーグ: ${centralGames.length}試合`);
    console.log(`  パ・リーグ: ${pacificGames.length}試合`);
    
    // データベースに挿入
    console.log('\n💾 データベースに挿入中...');
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const game of allGames) {
      try {
        // 既存チェック
        const existing = await query('SELECT game_id FROM games WHERE game_id = ?', [game.game_id]);
        
        if (existing.length > 0) {
          skippedCount++;
          continue;
        }
        
        await run(`
          INSERT INTO games (
            game_id, date, league, away_team, home_team, 
            away_score, home_score, venue, status, start_time_jst, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          game.game_id, game.date, game.league, game.away_team, game.home_team,
          game.away_score, game.home_score, game.venue, game.status, game.start_time_jst
        ]);
        
        insertedCount++;
        
        if (insertedCount % 50 === 0) {
          console.log(`  ${insertedCount}/${totalGames} 試合挿入完了...`);
        }
      } catch (error) {
        console.error(`Error inserting game ${game.game_id}:`, error);
      }
    }
    
    console.log(`\n✅ データベース挿入完了:`);
    console.log(`  新規挿入: ${insertedCount}試合`);
    console.log(`  スキップ: ${skippedCount}試合`);
    
    // サンプル表示
    console.log('\n📋 サンプル試合データ（3月オープン戦）:');
    const marchGames = allGames.filter(g => g.date.startsWith('2025-03')).slice(0, 5);
    console.table(marchGames.map(game => ({
      date: game.date,
      matchup: `${game.away_team} @ ${game.home_team}`,
      score: `${game.away_score}-${game.home_score}`,
      venue: game.venue.length > 15 ? game.venue.substring(0, 12) + '...' : game.venue
    })));
    
    console.log('\n📋 サンプル試合データ（4-5月公式戦）:');
    const officialGames = allGames.filter(g => g.date.startsWith('2025-04') || g.date.startsWith('2025-05')).slice(0, 5);
    console.table(officialGames.map(game => ({
      date: game.date,
      matchup: `${game.away_team} @ ${game.home_team}`,
      score: `${game.away_score}-${game.home_score}`,
      venue: game.venue,
      league: game.league
    })));
    
    console.log('\n✅ 2025年1月-5月試合データ生成完了!');
    
  } catch (error) {
    console.error('❌ Error generating season data:', error);
  }
}

generateSeasonData().catch(console.error);