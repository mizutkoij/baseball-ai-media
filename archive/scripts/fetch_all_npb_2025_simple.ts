import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const TEAM_CODE_MAPPING: Record<string, string> = {
  'c': '広島', 'd': '中日', 'g': '巨人', 's': 'ヤクルト', 't': '阪神', 'db': 'DeNA',
  'h': 'ソフトバンク', 'f': '日本ハム', 'e': '楽天', 'm': 'ロッテ', 'l': '西武', 'b': 'オリックス'
};

interface GameData {
  date: string; matchup: string; homeTeam: string; awayTeam: string; venue: string;
  time: string; endTime?: string; gameTime?: string; attendance?: string;
  homeScore: number; awayScore: number; status: string; league: 'central' | 'pacific';
  inningScores?: { away: number[]; home: number[]; };
}

// 全月のゲームURLを取得
async function getAllGameUrls(): Promise<string[]> {
  console.log('📅 NPB 2025年全試合URL収集開始');
  
  const allUrls: string[] = [];
  const months = [3, 4, 5, 6, 7, 8]; // 3月〜8月
  
  for (const month of months) {
    const monthStr = month.toString().padStart(2, '0');
    const scheduleUrl = `https://npb.jp/games/2025/schedule_${monthStr}_detail.html`;
    
    console.log(`🔍 ${month}月スケジュール: ${scheduleUrl}`);
    
    try {
      const response = await fetch(scheduleUrl);
      if (!response.ok) {
        console.log(`❌ ${month}月: ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      const urlPattern = /href="(\/scores\/2025\/\d{4}\/[a-z]{1,3}-[a-z]{1,3}-\d{1,2}\/?)/g;
      const matches = html.matchAll(urlPattern);
      const monthUrls = [...new Set(Array.from(matches, match => match[1]))];
      
      console.log(`✅ ${month}月: ${monthUrls.length}試合`);
      allUrls.push(...monthUrls);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`❌ ${month}月エラー:`, error.message);
    }
  }
  
  const uniqueUrls = [...new Set(allUrls)].sort();
  console.log(`📊 総試合数: ${uniqueUrls.length}試合`);
  return uniqueUrls;
}

// シンプルなゲームデータ取得
async function fetchSimpleGameData(gameUrl: string): Promise<GameData | null> {
  const baseUrl = 'https://npb.jp';
  
  try {
    // URL解析
    const parts = gameUrl.split('/');
    const dateStr = parts[3]; // 例: "0801"
    const matchStr = parts[4]; // 例: "g-db-14"
    
    if (!dateStr || !matchStr) return null;
    
    const matchParts = matchStr.split('-');
    const awayCode = matchParts[0];
    const homeCode = matchParts[1];
    
    const homeTeam = TEAM_CODE_MAPPING[homeCode];
    const awayTeam = TEAM_CODE_MAPPING[awayCode];
    
    if (!homeTeam || !awayTeam) return null;
    
    // box.htmlからデータ取得
    const boxUrl = baseUrl + gameUrl + 'box.html';
    const response = await fetch(boxUrl);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 日付フォーマット
    const year = '2025';
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const formattedDate = `${year}-${month}-${day}`;
    
    // スコア抽出（修正版 - デバッグ結果に基づく正確な抽出）
    let homeScore = 0, awayScore = 0;
    const inningScores = { away: [] as number[], home: [] as number[] };
    
    let scoreTableFound = false;
    $('table').each((_, table) => {
      if (scoreTableFound) return false;
      
      const $table = $(table);
      const text = $table.text();
      
      // スコアテーブルを識別（ヘッダーに1-9と計・H・Eがある）
      const rows = $table.find('tr');
      if (rows.length >= 3) {
        const headerRow = rows.first();
        const headerCells = headerRow.find('td, th');
        const headerTexts = headerCells.map((_, cell) => $(cell).text().trim()).get();
        
        // ヘッダーが1-9回とH, Eを含むかチェック
        const hasInnings = headerTexts.includes('1') && headerTexts.includes('9');
        const hasStats = headerTexts.includes('計') && headerTexts.includes('H') && headerTexts.includes('E');
        
        if (hasInnings && hasStats && headerCells.length >= 12) {
          // データ行を処理（row 2 = away team, row 3 = home team）
          for (let rowIndex = 1; rowIndex <= 2; rowIndex++) {
            const dataRow = $(rows[rowIndex]);
            const dataCells = dataRow.find('td');
            
            if (dataCells.length >= 12) {
              const rowData = dataCells.map((_, cell) => $(cell).text().trim()).get();
              
              // イニング別スコア（列0-8 = 1-9回）
              const inningValues = [];
              for (let i = 0; i <= 8; i++) {
                const val = rowData[i];
                const score = (val === 'x' || val === 'X') ? 0 : (parseInt(val) || 0);
                inningValues.push(score);
              }
              
              // 列9=計(得点), 列10=H(安打), 列11=E(エラー)
              const totalRuns = parseInt(rowData[9]) || 0;
              const totalHits = parseInt(rowData[10]) || 0;
              const totalErrors = parseInt(rowData[11]) || 0;
              
              // rowIndex === 1 = 1番目のデータ行（HTMLテーブルの2行目）
              // rowIndex === 2 = 2番目のデータ行（HTMLテーブルの3行目）
              // デバッグ結果によると: DeNA(7点) が1行目、巨人(2点) が2行目
              // URL g-db-14 では g=巨人(away), db=DeNA(home)
              // つまり1行目がhome(DeNA), 2行目がaway(巨人)
              if (rowIndex === 1) { // 1番目データ行 = ホームチーム
                inningScores.home = inningValues;
                homeScore = totalRuns;
              } else if (rowIndex === 2) { // 2番目データ行 = アウェーチーム
                inningScores.away = inningValues;
                awayScore = totalRuns;
              }
            }
          }
          
          // 有効なスコアが取得できた場合
          if ((homeScore > 0 || awayScore > 0) || (inningScores.away.length > 0 || inningScores.home.length > 0)) {
            scoreTableFound = true;
            return false;
          }
        }
      }
    });
    
    // 基本情報抽出
    const pageText = $.text();
    const timeMatch = pageText.match(/開始\s*(\d{1,2}:\d{2})/);
    const endTimeMatch = pageText.match(/終了\s*(\d{1,2}:\d{2})/);
    const gameTimeMatch = pageText.match(/試合時間\s*([^◇◆\n]+)/);
    const attendanceMatch = pageText.match(/入場者\s*([0-9,]+人)/);
    
    // 球場判定（簡易版）
    let venue = 'unknown';
    if (pageText.includes('東京ドーム')) venue = '東京ドーム';
    else if (pageText.includes('甲子園')) venue = '甲子園';
    else if (pageText.includes('ハマスタ') || pageText.includes('横浜')) venue = '横浜スタジアム';
    else if (pageText.includes('神宮')) venue = '神宮球場';
    else if (pageText.includes('マツダ')) venue = 'マツダスタジアム';
    else if (pageText.includes('バンテリン') || pageText.includes('ナゴヤ')) venue = 'バンテリンドーム';
    
    const centralTeams = ['広島', '中日', '巨人', 'ヤクルト', '阪神', 'DeNA'];
    const league = centralTeams.includes(homeTeam) && centralTeams.includes(awayTeam) ? 'central' : 'pacific';
    
    const awayTeamCode = Object.keys(TEAM_CODE_MAPPING).find(k => TEAM_CODE_MAPPING[k] === awayTeam)?.toUpperCase() || awayCode.toUpperCase();
    const homeTeamCode = Object.keys(TEAM_CODE_MAPPING).find(k => TEAM_CODE_MAPPING[k] === homeTeam)?.toUpperCase() || homeCode.toUpperCase();
    
    return {
      date: formattedDate,
      matchup: `${awayTeamCode}-${homeTeamCode}`,
      homeTeam,
      awayTeam,
      venue,
      time: timeMatch ? timeMatch[1] : '18:00',
      endTime: endTimeMatch ? endTimeMatch[1] : undefined,
      gameTime: gameTimeMatch ? gameTimeMatch[1].trim() : undefined,
      attendance: attendanceMatch ? attendanceMatch[1] : undefined,
      homeScore,
      awayScore,
      status: 'finished',
      league,
      inningScores: (inningScores.away.length > 0 || inningScores.home.length > 0) ? inningScores : undefined
    };
    
  } catch (error) {
    console.error(`エラー [${gameUrl}]:`, error.message);
    return null;
  }
}

// 進行状況保存
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
      return {};
    }
  }
  return {};
}

// メイン処理
async function main() {
  console.log('🚀 NPB 2025年全試合データ取得開始！');
  
  // 進行状況読み込み
  const allGameData = loadProgress('npb_2025_all_games_simple.json');
  let processedCount = Object.values(allGameData).reduce((total, games) => total + Object.keys(games).length, 0);
  
  console.log(`📋 既存データ: ${processedCount}試合`);
  
  // 全試合URL取得
  const gameUrls = await getAllGameUrls();
  
  if (gameUrls.length === 0) {
    console.log('❌ 試合URLが見つかりません');
    return;
  }
  
  let newGames = 0;
  let skipped = 0;
  
  for (let i = 0; i < gameUrls.length; i++) {
    const gameUrl = gameUrls[i];
    
    console.log(`\n[${i + 1}/${gameUrls.length}] ${gameUrl}`);
    
    const gameData = await fetchSimpleGameData(gameUrl);
    
    if (gameData) {
      // 重複チェック
      if (allGameData[gameData.date]?.[gameData.matchup]) {
        console.log(`⏭️ スキップ: ${gameData.awayTeam} vs ${gameData.homeTeam}`);
        skipped++;
        continue;
      }
      
      // データ保存
      if (!allGameData[gameData.date]) {
        allGameData[gameData.date] = {};
      }
      allGameData[gameData.date][gameData.matchup] = gameData;
      newGames++;
      
      console.log(`✅ 成功: ${gameData.awayTeam} ${gameData.awayScore}-${gameData.homeScore} ${gameData.homeTeam}`);
      
      // 20試合ごとに保存
      if (newGames % 20 === 0) {
        saveProgress(allGameData, 'npb_2025_all_games_simple.json');
        console.log(`💾 中間保存: ${newGames}試合`);
      }
    } else {
      console.log(`❌ 失敗`);
    }
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // 最終保存
  saveProgress(allGameData, 'npb_2025_all_games_simple.json');
  
  const totalGames = Object.values(allGameData).reduce((total, games) => total + Object.keys(games).length, 0);
  
  console.log(`\n🎉 NPB 2025年全試合データ取得完了！`);
  console.log(`📊 結果:`);
  console.log(`   新規取得: ${newGames}試合`);
  console.log(`   スキップ: ${skipped}試合`);
  console.log(`   総試合数: ${totalGames}試合`);
  
  // 月別統計
  console.log(`\n📅 月別試合数:`);
  const monthStats: Record<string, number> = {};
  Object.keys(allGameData).forEach(date => {
    const month = date.substring(5, 7);
    monthStats[month] = (monthStats[month] || 0) + Object.keys(allGameData[date]).length;
  });
  
  Object.entries(monthStats).sort().forEach(([month, count]) => {
    const monthNames: Record<string, string> = {
      '03': '3月', '04': '4月', '05': '5月', '06': '6月', '07': '7月', '08': '8月'
    };
    console.log(`   ${monthNames[month] || month}: ${count}試合`);
  });
  
  // 高得点試合
  const allGames = Object.values(allGameData).flatMap(games => Object.values(games));
  const highScoring = allGames.filter(game => (game.homeScore + game.awayScore) >= 15);
  
  console.log(`\n⚾ 統計:`);
  console.log(`   高得点試合(15点以上): ${highScoring.length}試合`);
  
  if (highScoring.length > 0) {
    const topGame = highScoring.sort((a, b) => (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore))[0];
    console.log(`   最高得点: ${topGame.awayTeam} ${topGame.awayScore}-${topGame.homeScore} ${topGame.homeTeam} (${topGame.date})`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchSimpleGameData, getAllGameUrls };