import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const TEAM_CODE_MAPPING: Record<string, string> = {
  'c': '広島', 'd': '中日', 'g': '巨人', 's': 'ヤクルト', 't': '阪神', 'db': 'DeNA',
  'h': 'ソフトバンク', 'f': '日本ハム', 'e': '楽天', 'm': 'ロッテ', 'l': '西武', 'b': 'オリックス'
};

const TEAM_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_CODE_MAPPING).map(([code, team]) => [team, code])
);

interface GameData {
  date: string; matchup: string; homeTeam: string; awayTeam: string; venue: string;
  time: string; endTime?: string; gameTime?: string; attendance?: string; weather?: string;
  homeScore: number; awayScore: number; status: string; league: 'central' | 'pacific';
  inningScores?: { away: number[]; home: number[]; };
  homeHits?: number; awayHits?: number; homeErrors?: number; awayErrors?: number;
  winningPitcher?: string; losingPitcher?: string; savePitcher?: string; holdPitchers?: string[];
}

// 全月のスケジュールURLを取得
async function getAllMonthUrls(): Promise<string[]> {
  console.log('📅 2025年シーズン全スケジュールURL取得中...');
  
  const monthUrls: string[] = [];
  
  // 3月から8月まで（NPBシーズン期間）
  const months = [
    { month: 3, name: '3月' },
    { month: 4, name: '4月' }, 
    { month: 5, name: '5月' },
    { month: 6, name: '6月' },
    { month: 7, name: '7月' },
    { month: 8, name: '8月' }
  ];
  
  for (const { month, name } of months) {
    const monthStr = month.toString().padStart(2, '0');
    const scheduleUrl = `https://npb.jp/games/2025/schedule_${monthStr}_detail.html`;
    
    console.log(`🔍 ${name}スケジュール確認: ${scheduleUrl}`);
    
    try {
      const response = await fetch(scheduleUrl);
      if (response.ok) {
        monthUrls.push(scheduleUrl);
        console.log(`✅ ${name}スケジュール発見`);
      } else {
        console.log(`❌ ${name}スケジュール未発見 (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${name}スケジュール取得エラー: ${error.message}`);
    }
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`📋 有効なスケジュールURL: ${monthUrls.length}件`);
  return monthUrls;
}

// 月別スケジュールから全試合URLを抽出
async function getGameUrlsFromMonth(scheduleUrl: string): Promise<string[]> {
  console.log(`📅 月別試合URL取得: ${scheduleUrl}`);
  
  try {
    const response = await fetch(scheduleUrl);
    const html = await response.text();
    
    // 試合URLパターンを抽出
    const urlPattern = /href="(\/scores\/2025\/\d{4}\/[a-z]{1,3}-[a-z]{1,3}-\d{1,2}\/?)/g;
    const matches = html.matchAll(urlPattern);
    
    const gameUrls = [...new Set(Array.from(matches, match => match[1]))];
    console.log(`🎯 ${scheduleUrl.match(/schedule_(\d{2})_detail/)?.[1]}月: ${gameUrls.length}試合発見`);
    
    return gameUrls;
    
  } catch (error) {
    console.error(`❌ 月別試合URL取得エラー [${scheduleUrl}]: ${error}`);
    return [];
  }
}

// 試合データ取得（既存関数の改良版）
async function fetchGameData(gameUrl: string): Promise<GameData | null> {
  const baseUrl = 'https://npb.jp';
  
  // URL解析
  const urlParts = gameUrl.split('/').filter(part => part.length > 0);
  let dateStr = '', matchStr = '';
  
  for (let i = 0; i < urlParts.length; i++) {
    if (urlParts[i] === 'scores' && i + 2 < urlParts.length) {
      dateStr = urlParts[i + 2];
      matchStr = urlParts[i + 3];
      break;
    }
  }
  
  if (!dateStr || !matchStr) return null;
  
  const matchParts = matchStr.split('-');
  const awayCode = matchParts[0];
  const homeCode = matchParts[1];
  const homeTeam = TEAM_CODE_MAPPING[homeCode];
  const awayTeam = TEAM_CODE_MAPPING[awayCode];
  
  if (!homeTeam || !awayTeam) return null;
  
  try {
    const boxUrl = baseUrl + gameUrl + 'box.html';
    const boxResponse = await fetch(boxUrl);
    
    if (!boxResponse.ok) return null;
    
    const boxHtml = await boxResponse.text();
    const $box = cheerio.load(boxHtml);
    
    // 日付フォーマット
    const year = '2025';
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const formattedDate = `${year}-${month}-${day}`;
    
    // スコアとイニング別スコア抽出
    const inningScores = { away: [] as number[], home: [] as number[] };
    let homeScore = 0, awayScore = 0, homeHits = 0, awayHits = 0, homeErrors = 0, awayErrors = 0;
    
    // スコアテーブル解析
    let scoreTableFound = false;
    $box('table').each((tableIndex, table) => {
      if (scoreTableFound) return false;
      
      const $table = $box(table);
      const tableText = $table.text();
      
      // イニング別スコアテーブルの特徴を識別
      if (tableText.includes('1') && tableText.includes('9') && (tableText.includes('計') || tableText.includes('R'))) {
        $table.find('tr').each((rowIndex, row) => {
          const cells = $box(row).find('td');
          
          if (cells.length >= 10) { // 最低限のカラム数
            const rowData: string[] = [];
            cells.each((_, cell) => rowData.push($box(cell).text().trim()));
            
            if (rowIndex === 1 || rowIndex === 2) { // データ行
              const values: number[] = [];
              let totalScore = 0, hits = 0, errors = 0;
              
              // セルを順番に処理
              for (let i = 1; i < rowData.length; i++) {
                const text = rowData[i];
                
                if (i >= 1 && i <= 9) { // 1-9回
                  const score = (text === 'x' || text === 'X') ? 0 : (parseInt(text) || 0);
                  values.push(score);
                } else if (text.match(/^\d+$/) && values.length >= 9) {
                  // 計・H・Eの順番で処理
                  if (totalScore === 0) totalScore = parseInt(text) || 0;
                  else if (hits === 0) hits = parseInt(text) || 0;
                  else if (errors === 0) errors = parseInt(text) || 0;
                }
              }
              
              // データを割り当て
              if (rowIndex === 1) { // アウェーチーム
                if (values.length >= 9) inningScores.away = values.slice(0, 9);
                awayScore = totalScore;
                awayHits = hits;
                awayErrors = errors;
              } else if (rowIndex === 2) { // ホームチーム
                if (values.length >= 9) inningScores.home = values.slice(0, 9);
                homeScore = totalScore;
                homeHits = hits;
                homeErrors = errors;
              }
            }
          }
        });
        
        if (homeScore > 0 || awayScore > 0) {
          scoreTableFound = true;
          return false; // テーブルループを抜ける
        }
      }
    });
    
    // 試合詳細情報
    const pageText = $box.text();
    const timeMatch = pageText.match(/開始\s*(\d{1,2}:\d{2})/);
    const endTimeMatch = pageText.match(/終了\s*(\d{1,2}:\d{2})/);
    const gameTimeMatch = pageText.match(/試合時間\s*([^◇◆\n]+)/);
    const attendanceMatch = pageText.match(/入場者\s*([0-9,]+人)/);
    const weatherMatch = pageText.match(/天候[：:]\s*([^◇◆\n]+)/);
    
    // 投手情報
    const winningPitcherMatch = pageText.match(/【勝投手】\s*([^【\n]+)/);
    const losingPitcherMatch = pageText.match(/【敗投手】\s*([^【\n]+)/);
    const savePitcherMatch = pageText.match(/【セーブ】\s*([^【\n]+)/);
    const holdPitcherMatch = pageText.match(/【ホールド】\s*([^【\n]+)/);
    
    // 球場判定
    const venuePatterns = [
      { name: 'マツダスタジアム', pattern: /マツダ|MAZDA|広島/ },
      { name: '東京ドーム', pattern: /東京ドーム|巨人/ },
      { name: '横浜スタジアム', pattern: /横浜|ハマスタ|DeNA/ },
      { name: '神宮球場', pattern: /神宮|ヤクルト|スワローズ/ },
      { name: '甲子園', pattern: /甲子園|阪神|タイガース/ },
      { name: 'バンテリンドーム', pattern: /バンテリン|ナゴヤ|中日/ },
      { name: 'ZOZOマリンスタジアム', pattern: /ZOZO|マリン|千葉|ロッテ/ },
      { name: '京セラドーム大阪', pattern: /京セラ|大阪ドーム|オリックス/ },
      { name: 'エスコンフィールドHOKKAIDO', pattern: /エスコン|札幌|日本ハム/ },
      { name: '楽天モバイルパーク宮城', pattern: /楽天|仙台|宮城|イーグルス/ },
      { name: 'ベルーナドーム', pattern: /ベルーナ|西武|ライオンズ/ },
      { name: 'みずほPayPayドーム', pattern: /みずほ|PayPay|ソフトバンク|ホークス/ }
    ];
    
    let venue = '球場未確認';
    for (const venuePattern of venuePatterns) {
      if (venuePattern.pattern.test(pageText)) {
        venue = venuePattern.name;
        break;
      }
    }
    
    const centralTeams = ['広島', '中日', '巨人', 'ヤクルト', '阪神', 'DeNA'];
    const league = centralTeams.includes(homeTeam) && centralTeams.includes(awayTeam) ? 'central' : 'pacific';
    
    const awayTeamCode = TEAM_TO_CODE[awayTeam]?.toUpperCase() || awayCode.toUpperCase();
    const homeTeamCode = TEAM_TO_CODE[homeTeam]?.toUpperCase() || homeCode.toUpperCase();
    
    const gameData: GameData = {
      date: formattedDate,
      matchup: `${awayTeamCode}-${homeTeamCode}`,
      homeTeam, awayTeam, venue,
      time: timeMatch ? timeMatch[1] : '18:00',
      endTime: endTimeMatch ? endTimeMatch[1] : undefined,
      gameTime: gameTimeMatch ? gameTimeMatch[1].trim() : undefined,
      attendance: attendanceMatch ? attendanceMatch[1] : undefined,
      weather: weatherMatch ? weatherMatch[1].trim() : undefined,
      homeScore, awayScore, status: 'finished', league,
      inningScores: inningScores.away.length > 0 || inningScores.home.length > 0 ? inningScores : undefined,
      homeHits, awayHits, homeErrors, awayErrors,
      winningPitcher: winningPitcherMatch ? winningPitcherMatch[1].trim() : undefined,
      losingPitcher: losingPitcherMatch ? losingPitcherMatch[1].trim() : undefined,
      savePitcher: savePitcherMatch ? savePitcherMatch[1].trim() : undefined,
      holdPitchers: holdPitcherMatch ? holdPitcherMatch[1].trim().split('、').map(h => h.trim()) : undefined
    };
    
    return gameData;
    
  } catch (error) {
    console.error(`❌ 試合データ取得エラー [${gameUrl}]: ${error}`);
    return null;
  }
}

// 進行状況の保存/復元
function saveProgress(data: Record<string, Record<string, GameData>>, filename: string) {
  const outputPath = path.join(__dirname, '../data', filename);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadProgress(filename: string): Record<string, Record<string, GameData>> {
  const progressPath = path.join(__dirname, '../data', filename);
  if (fs.existsSync(progressPath)) {
    try {
      const data = fs.readFileSync(progressPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`⚠️  進行状況読み込みエラー: ${error}`);
    }
  }
  return {};
}

// メイン関数
async function main() {
  console.log('🚀 NPB 2025年シーズン全試合データ取得開始！');
  
  // 進行状況を読み込み
  const allGameData = loadProgress('npb_2025_all_games_complete.json');
  const processedUrls = new Set<string>();
  
  // 既に処理済みのURLを記録
  Object.values(allGameData).forEach(dayGames => {
    Object.keys(dayGames).forEach(matchup => {
      processedUrls.add(matchup);
    });
  });
  
  console.log(`📋 既に処理済み: ${processedUrls.size}試合`);
  
  // 全月のスケジュールURLを取得
  const monthUrls = await getAllMonthUrls();
  
  if (monthUrls.length === 0) {
    console.log('❌ 有効な月別スケジュールが見つかりませんでした');
    return;
  }
  
  // 全試合URLを収集
  const allGameUrls: string[] = [];
  for (const monthUrl of monthUrls) {
    const monthGameUrls = await getGameUrlsFromMonth(monthUrl);
    allGameUrls.push(...monthGameUrls);
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 重複除去とソート
  const uniqueGameUrls = [...new Set(allGameUrls)].sort((a, b) => {
    const dateA = a.match(/\/\d{4}\//)?.[0] || '';
    const dateB = b.match(/\/\d{4}\//)?.[0] || '';
    return dateA.localeCompare(dateB);
  });
  
  if (uniqueGameUrls.length === 0) {
    console.log('❌ 試合URLが見つかりませんでした');
    return;
  }
  
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalSkipped = 0;
  
  console.log(`\n🎯 2025年シーズン処理対象: ${uniqueGameUrls.length}試合`);
  
  for (const gameUrl of uniqueGameUrls) {
    totalProcessed++;
    
    console.log(`\n[${totalProcessed}/${uniqueGameUrls.length}] ${gameUrl}`);
    
    const gameData = await fetchGameData(gameUrl);
    
    if (gameData) {
      // 重複チェック
      const existingGame = allGameData[gameData.date]?.[gameData.matchup];
      if (existingGame) {
        totalSkipped++;
        console.log(`⏭️  スキップ (既存): ${gameData.awayTeam} vs ${gameData.homeTeam}`);
        continue;
      }
      
      // 新しいデータを保存
      if (!allGameData[gameData.date]) {
        allGameData[gameData.date] = {};
      }
      allGameData[gameData.date][gameData.matchup] = gameData;
      totalSuccessful++;
      
      console.log(`✅ 成功: ${gameData.awayTeam} ${gameData.awayScore} - ${gameData.homeScore} ${gameData.homeTeam} @${gameData.venue}`);
      
      // 10試合ごとに中間保存
      if (totalSuccessful % 10 === 0) {
        saveProgress(allGameData, 'npb_2025_all_games_complete.json');
        console.log(`💾 中間保存完了 (${totalSuccessful}試合)`);
      }
    } else {
      console.log(`❌ 取得失敗`);
    }
    
    // レート制限（NPBサーバー負荷軽減）
    await new Promise(resolve => setTimeout(resolve, 1800));
  }
  
  // 最終保存
  saveProgress(allGameData, 'npb_2025_all_games_complete.json');
  
  console.log(`\n🎉 NPB 2025年シーズン全試合データ取得完了!`);
  console.log(`📊 最終結果:`);
  console.log(`   ✅ 新規取得: ${totalSuccessful}試合`);
  console.log(`   ⏭️  スキップ: ${totalSkipped}試合`);
  console.log(`   📁 総試合数: ${Object.values(allGameData).reduce((total, games) => total + Object.keys(games).length, 0)}試合`);
  
  // 月別・リーグ別サマリー
  console.log(`\n📈 月別試合数:`)
  const monthStats: Record<string, number> = {};
  const leagueStats = { central: 0, pacific: 0, interleague: 0 };
  
  Object.entries(allGameData)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, games]) => {
      const month = date.substring(5, 7);
      const gameCount = Object.keys(games).length;
      
      monthStats[month] = (monthStats[month] || 0) + gameCount;
      
      // リーグ別カウント
      Object.values(games).forEach((game: any) => {
        if (game.league === 'central') leagueStats.central++;
        else if (game.league === 'pacific') leagueStats.pacific++;
        else leagueStats.interleague++;
      });
    });
  
  Object.entries(monthStats).forEach(([month, count]) => {
    const monthName = ['', '', '', '3月', '4月', '5月', '6月', '7月', '8月'][parseInt(month)] || `${month}月`;
    console.log(`   ${monthName}: ${count}試合`);
  });
  
  console.log(`\\n📊 リーグ別試合数:`);
  console.log(`   セントラルリーグ: ${leagueStats.central}試合`);
  console.log(`   パシフィックリーグ: ${leagueStats.pacific}試合`);
  console.log(`   交流戦: ${leagueStats.interleague}試合`);
  
  // 高得点試合など統計
  const allGames = Object.values(allGameData).flatMap(games => Object.values(games)) as GameData[];
  const highScoringGames = allGames.filter(game => (game.homeScore + game.awayScore) >= 15);
  const shutoutGames = allGames.filter(game => game.homeScore === 0 || game.awayScore === 0);
  
  console.log(`\\n⚾ 興味深い統計:`);
  console.log(`   高得点試合(15点以上): ${highScoringGames.length}試合`);
  console.log(`   完封試合: ${shutoutGames.length}試合`);
  
  if (highScoringGames.length > 0) {
    const topGame = highScoringGames.sort((a, b) => (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore))[0];
    console.log(`   最高得点試合: ${topGame.awayTeam} ${topGame.awayScore} - ${topGame.homeScore} ${topGame.homeTeam} (${topGame.date})`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchGameData, getAllMonthUrls, getGameUrlsFromMonth };