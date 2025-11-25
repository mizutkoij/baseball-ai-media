// Script to generate comprehensive 2024 NPB season data
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

const REGIONAL_VENUES = [
  '札幌ドーム', '青森', '秋田こまちスタジアム', '仙台市民球場',
  '郡山', '高崎', '静岡草薙球場', '松本', '新潟', '金沢',
  '山梨', '岐阜長良川球場', '浜松球場', '京都西京極球場',
  '奈良', '和歌山市民球場', '姫路球場', '倉敷マスカットスタジアム',
  '徳島', '高松', '愛媛県坊っちゃんスタジアム', '高知',
  '北九州市民球場', '大分', '宮崎', '鹿児島', '沖縄'
];

// 2024年月別試合配分
const MONTHLY_GAME_COUNTS_2024 = {
  '01': 0,   // 1月: オフシーズン
  '02': 0,   // 2月: キャンプ
  '03': 20,  // 3月: オープン戦
  '04': 50,  // 4月: 開幕
  '05': 65,  // 5月: 本格化
  '06': 75,  // 6月: 交流戦
  '07': 70,  // 7月: 夏場
  '08': 75,  // 8月: 夏の甲子園時期
  '09': 65,  // 9月: シーズン終盤
  '10': 35,  // 10月: ポストシーズン・クライマックス
  '11': 15,  // 11月: 日本シリーズ
  '12': 0    // 12月: オフシーズン
};

function generateRealisticScore(month: string): number {
  const rand = Math.random();
  
  // 3月（オープン戦）: 高得点傾向
  if (month === '03') {
    if (rand < 0.15) return Math.floor(Math.random() * 3); // 0-2点 (15%)
    if (rand < 0.35) return Math.floor(Math.random() * 3) + 3; // 3-5点 (20%)
    if (rand < 0.65) return Math.floor(Math.random() * 4) + 6; // 6-9点 (30%)
    return Math.floor(Math.random() * 6) + 10; // 10-15点 (35%)
  }
  
  // 夏場（6-8月）: やや高得点
  if (['06', '07', '08'].includes(month)) {
    if (rand < 0.25) return Math.floor(Math.random() * 3); // 0-2点 (25%)
    if (rand < 0.55) return Math.floor(Math.random() * 3) + 3; // 3-5点 (30%)
    if (rand < 0.80) return Math.floor(Math.random() * 4) + 6; // 6-9点 (25%)
    return Math.floor(Math.random() * 6) + 10; // 10-15点 (20%)
  }
  
  // その他: 通常傾向
  if (rand < 0.35) return Math.floor(Math.random() * 3); // 0-2点 (35%)
  if (rand < 0.65) return Math.floor(Math.random() * 3) + 3; // 3-5点 (30%)
  if (rand < 0.85) return Math.floor(Math.random() * 4) + 6; // 6-9点 (20%)
  return Math.floor(Math.random() * 6) + 10; // 10-15点 (15%)
}

function generateMatchupsForDate(date: string): GameData[] {
  const games: GameData[] = [];
  const month = date.substring(5, 7);
  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // 3月: オープン戦
  if (month === '03') {
    const numGames = Math.random() < 0.3 ? 2 : (Math.random() < 0.6 ? 4 : 6);
    
    for (let i = 0; i < numGames; i++) {
      const allTeams = [...CENTRAL_TEAMS, ...PACIFIC_TEAMS];
      const awayIdx = Math.floor(Math.random() * allTeams.length);
      let homeIdx = Math.floor(Math.random() * allTeams.length);
      while (homeIdx === awayIdx) {
        homeIdx = Math.floor(Math.random() * allTeams.length);
      }
      
      const awayTeam = allTeams[awayIdx];
      const homeTeam = allTeams[homeIdx];
      
      const venue = Math.random() < 0.3 
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
        start_time_jst: isWeekend ? '13:00' : '18:00'
      });
    }
  }
  // 6月: 交流戦期間（セ・パ対戦）
  else if (month === '06') {
    const numGames = isWeekend ? 6 : (Math.random() < 0.85 ? 6 : 3);
    
    for (let i = 0; i < numGames; i++) {
      // 交流戦: セ・パ混合
      const centralTeam = CENTRAL_TEAMS[Math.floor(Math.random() * CENTRAL_TEAMS.length)];
      const pacificTeam = PACIFIC_TEAMS[Math.floor(Math.random() * PACIFIC_TEAMS.length)];
      
      const isHomeSeLeague = Math.random() < 0.5;
      const awayTeam = isHomeSeLeague ? pacificTeam : centralTeam;
      const homeTeam = isHomeSeLeague ? centralTeam : pacificTeam;
      
      games.push({
        game_id: `${date}_IL${(i + 1).toString().padStart(2, '0')}`, // InterLeague
        date,
        league: CENTRAL_TEAMS.includes(homeTeam) ? 'central' : 'pacific',
        away_team: awayTeam,
        home_team: homeTeam,
        away_score: generateRealisticScore(month),
        home_score: generateRealisticScore(month),
        venue: VENUES[homeTeam as keyof typeof VENUES],
        status: 'finished',
        start_time_jst: isWeekend ? (Math.random() < 0.5 ? '14:00' : '18:00') : '18:00'
      });
    }
  }
  // 10-11月: ポストシーズン・日本シリーズ
  else if (['10', '11'].includes(month)) {
    const numGames = Math.random() < 0.4 ? 1 : (Math.random() < 0.7 ? 2 : 3);
    
    for (let i = 0; i < numGames; i++) {
      // 強豪チーム中心の組み合わせ
      const strongTeams = ['巨人', '阪神', 'ヤクルト', 'ソフトバンク', 'オリックス', '楽天'];
      const team1 = strongTeams[Math.floor(Math.random() * strongTeams.length)];
      let team2 = strongTeams[Math.floor(Math.random() * strongTeams.length)];
      while (team2 === team1) {
        team2 = strongTeams[Math.floor(Math.random() * strongTeams.length)];
      }
      
      const awayTeam = team1;
      const homeTeam = team2;
      
      games.push({
        game_id: `${date}_PS${(i + 1).toString().padStart(2, '0')}`, // PostSeason
        date,
        league: CENTRAL_TEAMS.includes(homeTeam) ? 'central' : 'pacific',
        away_team: awayTeam,
        home_team: homeTeam,
        away_score: generateRealisticScore(month),
        home_score: generateRealisticScore(month),
        venue: VENUES[homeTeam as keyof typeof VENUES],
        status: 'finished',
        start_time_jst: isWeekend ? '18:00' : '18:30'
      });
    }
  }
  // 通常のリーグ戦
  else {
    const numGames = isWeekend ? 6 : (Math.random() < 0.8 ? 6 : 3);
    
    // セ・リーグ3試合
    const centralPairs = generateLeaguePairs(CENTRAL_TEAMS);
    centralPairs.slice(0, 3).forEach((pair, idx) => {
      if (games.length < numGames) {
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
      }
    });
    
    // パ・リーグ3試合
    const pacificPairs = generateLeaguePairs(PACIFIC_TEAMS);
    pacificPairs.slice(0, 3).forEach((pair, idx) => {
      if (games.length < numGames) {
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
      }
    });
  }
  
  return games;
}

function generateLeaguePairs(teams: string[]): string[][] {
  const pairs: string[][] = [];
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  
  return pairs;
}

function generateGameDatesForMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const monthStr = month.toString().padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  
  const targetGames = MONTHLY_GAME_COUNTS_2024[monthStr as keyof typeof MONTHLY_GAME_COUNTS_2024];
  if (targetGames === 0) return dates;
  
  // 3月: オープン戦期間限定
  if (month === 3) {
    for (let day = 10; day <= daysInMonth; day++) {
      const date = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
      if (Math.random() < 0.3) dates.push(date);
    }
  }
  // 10-11月: ポストシーズン期間
  else if ([10, 11].includes(month)) {
    for (let day = 1; day <= Math.min(daysInMonth, month === 11 ? 15 : 31); day++) {
      const date = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
      if (Math.random() < 0.4) dates.push(date);
    }
  }
  // 通常期間
  else {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
      const dayOfWeek = new Date(date).getDay();
      
      // 月によって試合頻度調整
      let gameProb = 0.7;
      if ([6, 7, 8].includes(month)) gameProb = 0.8; // 夏場は多め
      if ([4, 5, 9].includes(month)) gameProb = 0.75; // 春・秋は中程度
      
      if (dayOfWeek === 0 || dayOfWeek === 6) gameProb += 0.1; // 土日は+10%
      
      if (Math.random() < gameProb) {
        dates.push(date);
      }
    }
  }
  
  return dates.sort();
}

async function generate2024SeasonData() {
  console.log('=== 2024年NPBシーズンデータ生成開始 ===\n');
  
  try {
    // 既存データチェック
    const existing2024 = await query("SELECT COUNT(*) as count FROM games WHERE date >= '2024-01-01' AND date < '2025-01-01'");
    const currentCount = existing2024[0]?.count || 0;
    
    console.log(`既存の2024年データ: ${currentCount}試合`);
    
    let totalGames = 0;
    const allGames: GameData[] = [];
    
    // 各月のデータ生成
    for (let month = 3; month <= 11; month++) { // 3月〜11月のみ
      console.log(`\n📅 2024年${month}月のデータ生成中...`);
      const gameDates = generateGameDatesForMonth(2024, month);
      
      console.log(`  試合日数: ${gameDates.length}日`);
      
      for (const date of gameDates) {
        const dayGames = generateMatchupsForDate(date);
        allGames.push(...dayGames);
        totalGames += dayGames.length;
      }
      
      const monthGames = allGames.filter(g => g.date.substring(5, 7) === month.toString().padStart(2, '0'));
      console.log(`  ${month}月総試合数: ${monthGames.length}試合`);
    }
    
    console.log(`\n📊 2024年全シーズンサマリー:`);
    console.log(`総試合数: ${totalGames}試合`);
    
    // 月別統計
    [3,4,5,6,7,8,9,10,11].forEach(month => {
      const monthStr = month.toString().padStart(2, '0');
      const monthGames = allGames.filter(g => g.date.substring(5, 7) === monthStr);
      console.log(`  ${month}月: ${monthGames.length}試合`);
    });
    
    // データベース挿入
    console.log('\n💾 データベースに挿入中...');
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const game of allGames) {
      try {
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
        
        if (insertedCount % 100 === 0) {
          console.log(`  ${insertedCount}/${totalGames} 試合挿入完了...`);
        }
      } catch (error) {
        console.error(`Error inserting game ${game.game_id}:`, error);
      }
    }
    
    console.log(`\n✅ 2024年データベース挿入完了:`);
    console.log(`  新規挿入: ${insertedCount}試合`);
    console.log(`  スキップ: ${skippedCount}試合`);
    
    // 特別なデータサンプル表示
    console.log('\n📋 交流戦サンプル（2024年6月）:');
    const interleagueGames = allGames.filter(g => g.date.startsWith('2024-06')).slice(0, 5);
    console.table(interleagueGames.map(game => ({
      date: game.date,
      matchup: `${game.away_team} @ ${game.home_team}`,
      score: `${game.away_score}-${game.home_score}`,
      venue: game.venue,
      type: game.game_id.includes('IL') ? '交流戦' : 'リーグ戦'
    })));
    
    console.log('\n📋 ポストシーズンサンプル（2024年10-11月）:');
    const postseasonGames = allGames.filter(g => 
      g.date.startsWith('2024-10') || g.date.startsWith('2024-11')
    ).slice(0, 5);
    console.table(postseasonGames.map(game => ({
      date: game.date,
      matchup: `${game.away_team} @ ${game.home_team}`,
      score: `${game.away_score}-${game.home_score}`,
      venue: game.venue,
      type: game.game_id.includes('PS') ? 'ポストシーズン' : 'リーグ戦'
    })));
    
    console.log('\n✅ 2024年NPBシーズンデータ生成完了!');
    
  } catch (error) {
    console.error('❌ Error generating 2024 season data:', error);
  }
}

generate2024SeasonData().catch(console.error);