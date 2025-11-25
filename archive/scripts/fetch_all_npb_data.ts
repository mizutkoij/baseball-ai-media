import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// チーム略称マッピング
const TEAM_CODE_MAPPING: Record<string, string> = {
  'c': '広島',
  'd': '中日', 
  'g': '巨人',
  's': 'ヤクルト',
  't': '阪神',
  'db': 'DeNA',
  'h': 'ソフトバンク',
  'f': '日本ハム',
  'e': '楽天',
  'm': 'ロッテ',
  'l': '西武',
  'b': 'オリックス'
};

// 逆引きマッピング（チーム略称生成用）
const TEAM_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_CODE_MAPPING).map(([code, team]) => [team, code])
);

interface GameData {
  date: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  time: string;
  endTime?: string;
  gameTime?: string;
  attendance?: string;
  weather?: string;
  homeScore: number;
  awayScore: number;
  status: string;
  league: 'central' | 'pacific';
  inningScores?: {
    away: number[];
    home: number[];
  };
  homeHits?: number;
  awayHits?: number;
  homeErrors?: number;
  awayErrors?: number;
  winningPitcher?: string;
  losingPitcher?: string;
  savePitcher?: string;
  holdPitchers?: string[];
}

// 指定した月の試合URLを取得
async function getGameUrls(year: number, month: number): Promise<string[]> {
  const scheduleUrl = `https://npb.jp/games/${year}/schedule_${String(month).padStart(2, '0')}_detail.html`;
  console.log(`📅 月間スケジュール取得: ${scheduleUrl}`);
  
  try {
    const response = await fetch(scheduleUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // 試合URLパターンを抽出（より厳密に）
    const urlPattern = /href="(\/scores\/2025\/\d{4}\/[a-z]{1,3}-[a-z]{1,3}-\d{1,2}\/?)"/g;
    const matches = html.matchAll(urlPattern);
    
    const gameUrls = Array.from(matches, match => match[1]);
    const uniqueUrls = [...new Set(gameUrls)]; // 重複排除
    
    console.log(`🎯 発見された試合数: ${uniqueUrls.length}`);
    
    return uniqueUrls;
  } catch (error) {
    console.error(`❌ スケジュール取得エラー (${month}月): ${error}`);
    return [];
  }
}

// 試合詳細データを取得
async function fetchGameData(gameUrl: string): Promise<GameData | null> {
  const baseUrl = 'https://npb.jp';
  
  // URL から基本情報を抽出
  const urlParts = gameUrl.split('/').filter(part => part.length > 0);
  let dateStr = '', matchStr = '';
  
  for (let i = 0; i < urlParts.length; i++) {
    if (urlParts[i] === 'scores' && i + 2 < urlParts.length) {
      dateStr = urlParts[i + 2]; // "0801"
      matchStr = urlParts[i + 3]; // "c-d-15"
      break;
    }
  }
  
  if (!dateStr || !matchStr) {
    console.error(`❌ URL解析失敗: ${gameUrl}`);
    return null;
  }
  
  const matchParts = matchStr.split('-');
  const awayCode = matchParts[0];
  const homeCode = matchParts[1];
  const homeTeam = TEAM_CODE_MAPPING[homeCode];
  const awayTeam = TEAM_CODE_MAPPING[awayCode];
  
  if (!homeTeam || !awayTeam) {
    console.error(`❌ チーム名解析失敗: ${awayCode}/${homeCode}`);
    return null;
  }
  
  try {
    // ボックススコアページから詳細データを取得
    const boxUrl = baseUrl + gameUrl + 'box.html';
    const boxResponse = await fetch(boxUrl);
    
    if (!boxResponse.ok) {
      console.warn(`⚠️  ボックススコア取得失敗 (${boxResponse.status}): ${gameUrl}`);
      return null;
    }
    
    const boxHtml = await boxResponse.text();
    const $box = cheerio.load(boxHtml);
    
    // 日付フォーマット
    const year = '2025';
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const formattedDate = `${year}-${month}-${day}`;
    
    // イニング別スコアを抽出
    const inningScores = {
      away: [] as number[],
      home: [] as number[]
    };
    
    let homeScore = 0, awayScore = 0, homeHits = 0, awayHits = 0, homeErrors = 0, awayErrors = 0;
    
    // イニング別スコアテーブルを探す
    $box('table').each((tableIndex, table) => {
      const $table = $box(table);
      const tableText = $table.text();
      
      // イニング別スコアテーブルの特徴を識別
      if (tableText.includes('1') && tableText.includes('9') && (tableText.includes('計') || tableText.includes('R'))) {
        
        $table.find('tr').each((rowIndex, row) => {
          const cells = $box(row).find('td');
          
          if (cells.length >= 12) { // イニング1-9 + 計 + H + E
            const values: number[] = [];
            
            // セルのデータを処理
            cells.each((cellIndex, cell) => {
              const text = $box(cell).text().trim();
              
              if (cellIndex >= 1 && cellIndex <= 9) { // 1-9回
                values.push(text === 'x' || text === 'X' ? 0 : (parseInt(text) || 0));
              } else if (cellIndex === 10 || (cellIndex === cells.length - 3)) { // 計
                const score = parseInt(text) || 0;
                if (rowIndex === 1) awayScore = score;
                else if (rowIndex === 2) homeScore = score;
              } else if (cellIndex === 11 || (cellIndex === cells.length - 2)) { // H
                const hits = parseInt(text) || 0;
                if (rowIndex === 1) awayHits = hits;
                else if (rowIndex === 2) homeHits = hits;
              } else if (cellIndex === 12 || (cellIndex === cells.length - 1)) { // E
                const errors = parseInt(text) || 0;
                if (rowIndex === 1) awayErrors = errors;
                else if (rowIndex === 2) homeErrors = errors;
              }
            });
            
            // イニング別スコア配列に追加
            if (values.length >= 9) {
              if (rowIndex === 1 && inningScores.away.length === 0) {
                inningScores.away = values.slice(0, 9);
              } else if (rowIndex === 2 && inningScores.home.length === 0) {
                inningScores.home = values.slice(0, 9);
              }
            }
          }
        });
        
        // 最初に見つかったスコアテーブルで終了
        if (homeScore > 0 || awayScore > 0 || inningScores.away.length > 0) {
          return false; // each()を抜ける
        }
      }
    });
    
    // 延長戦の場合、イニング数を拡張
    if (inningScores.away.length > 9 || inningScores.home.length > 9) {
      const maxInnings = Math.max(inningScores.away.length, inningScores.home.length);
      while (inningScores.away.length < maxInnings) inningScores.away.push(0);
      while (inningScores.home.length < maxInnings) inningScores.home.push(0);
    }
    
    // 勝敗投手情報を抽出
    const pageText = $box.text();
    const winningPitcherMatch = pageText.match(/【勝投手】\s*([^【\n]+)/);
    const losingPitcherMatch = pageText.match(/【敗投手】\s*([^【\n]+)/);
    const savePitcherMatch = pageText.match(/【セーブ】\s*([^【\n]+)/);
    const holdPitcherMatch = pageText.match(/【ホールド】\s*([^【\n]+)/);
    
    // 試合詳細情報を抽出
    const timeMatch = pageText.match(/開始\s*(\d{1,2}:\d{2})/);
    const endTimeMatch = pageText.match(/終了\s*(\d{1,2}:\d{2})/);
    const gameTimeMatch = pageText.match(/試合時間\s*([^◇◆\n]+)/);
    const attendanceMatch = pageText.match(/入場者\s*([0-9,]+人)/);
    const weatherMatch = pageText.match(/天候[：:]\s*([^◇◆\n]+)/);
    
    // 球場を判定（より詳細に）
    const venuePatterns = [
      { name: 'マツダスタジアム', pattern: /マツダ|MAZDA/ },
      { name: '東京ドーム', pattern: /東京ドーム/ },
      { name: '横浜スタジアム', pattern: /横浜|ハマスタ/ },
      { name: '神宮球場', pattern: /神宮|ヤクルト/ },
      { name: '甲子園', pattern: /甲子園|阪神/ },
      { name: 'バンテリンドーム', pattern: /バンテリン|ナゴヤドーム|中日/ },
      { name: 'ZOZOマリンスタジアム', pattern: /ZOZO|マリン|千葉/ },
      { name: '京セラドーム大阪', pattern: /京セラ|大阪ドーム/ },
      { name: 'エスコンフィールドHOKKAIDO', pattern: /エスコン|札幌|日本ハム/ },
      { name: '楽天モバイルパーク宮城', pattern: /楽天|仙台|宮城/ },
      { name: 'ベルーナドーム', pattern: /ベルーナ|西武/ },
      { name: 'みずほPayPayドーム', pattern: /みずほ|PayPay|ヤフオク|ソフトバンク/ }
    ];
    
    let venue = '球場未確認';
    for (const venuePattern of venuePatterns) {
      if (venuePattern.pattern.test(pageText)) {
        venue = venuePattern.name;
        break;
      }
    }
    
    // リーグ判定
    const centralTeams = ['広島', '中日', '巨人', 'ヤクルト', '阪神', 'DeNA'];
    const league = centralTeams.includes(homeTeam) && centralTeams.includes(awayTeam) ? 'central' : 'pacific';
    
    // マッチアップコードを生成
    const awayTeamCode = TEAM_TO_CODE[awayTeam]?.toUpperCase() || awayCode.toUpperCase();
    const homeTeamCode = TEAM_TO_CODE[homeTeam]?.toUpperCase() || homeCode.toUpperCase();
    
    const gameData: GameData = {
      date: formattedDate,
      matchup: `${awayTeamCode}-${homeTeamCode}`,
      homeTeam,
      awayTeam,
      venue,
      time: timeMatch ? timeMatch[1] : '18:00',
      endTime: endTimeMatch ? endTimeMatch[1] : undefined,
      gameTime: gameTimeMatch ? gameTimeMatch[1].trim() : undefined,
      attendance: attendanceMatch ? attendanceMatch[1] : undefined,
      weather: weatherMatch ? weatherMatch[1].trim() : undefined,
      homeScore,
      awayScore,
      status: 'finished',
      league,
      inningScores: inningScores.away.length > 0 ? inningScores : undefined,
      homeHits,
      awayHits,
      homeErrors,
      awayErrors,
      winningPitcher: winningPitcherMatch ? winningPitcherMatch[1].trim() : undefined,
      losingPitcher: losingPitcherMatch ? losingPitcherMatch[1].trim() : undefined,
      savePitcher: savePitcherMatch ? savePitcherMatch[1].trim() : undefined,
      holdPitchers: holdPitcherMatch ? holdPitcherMatch[1].trim().split('、').map(h => h.trim()) : undefined
    };
    
    console.log(`✅ ${formattedDate}: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`);
    return gameData;
    
  } catch (error) {
    console.error(`❌ 試合データ取得エラー [${gameUrl}]: ${error}`);
    return null;
  }
}

// 進行状況を保存/読み込み
function saveProgress(data: Record<string, Record<string, GameData>>, filename: string) {
  const progressPath = path.join(__dirname, '../data', filename);
  fs.writeFileSync(progressPath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadProgress(filename: string): Record<string, Record<string, GameData>> {
  const progressPath = path.join(__dirname, '../data', filename);
  if (fs.existsSync(progressPath)) {
    try {
      const data = fs.readFileSync(progressPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`⚠️  進行状況ファイル読み込みエラー: ${error}`);
    }
  }
  return {};
}

// メイン実行関数
async function main() {
  console.log('🚀 NPB全試合データ取得開始 (2025年3月-8月)');
  
  const year = 2025;
  const months = [3, 4, 5, 6, 7, 8]; // 3月から8月まで
  
  // 進行状況を読み込み
  const allGameData = loadProgress('npb_all_games_2025.json');
  
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  
  for (const month of months) {
    console.log(`\n📅 === ${month}月の試合データ取得開始 ===`);
    
    // 月間試合URLを取得
    const gameUrls = await getGameUrls(year, month);
    
    if (gameUrls.length === 0) {
      console.log(`⚠️  ${month}月: 試合URLが見つかりませんでした`);
      continue;
    }
    
    let monthProcessed = 0;
    let monthSuccessful = 0;
    
    for (const gameUrl of gameUrls) {
      totalProcessed++;
      monthProcessed++;
      
      console.log(`\n[${totalProcessed}] 処理中...`);
      
      const gameData = await fetchGameData(gameUrl);
      
      if (gameData) {
        // データを保存
        if (!allGameData[gameData.date]) {
          allGameData[gameData.date] = {};
        }
        allGameData[gameData.date][gameData.matchup] = gameData;
        
        totalSuccessful++;
        monthSuccessful++;
        
        // 10試合ごとに中間保存
        if (totalProcessed % 10 === 0) {
          saveProgress(allGameData, 'npb_all_games_2025.json');
          console.log(`💾 中間保存完了 (${totalProcessed}試合処理済み)`);
        }
      } else {
        totalFailed++;
      }
      
      // APIへの負荷軽減（1.5秒間隔）
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`📊 ${month}月完了: ${monthSuccessful}/${monthProcessed}試合取得成功`);
    
    // 月末に保存
    saveProgress(allGameData, 'npb_all_games_2025.json');
  }
  
  // 最終保存
  const finalPath = path.join(__dirname, '../data/npb_complete_2025.json');
  fs.writeFileSync(finalPath, JSON.stringify(allGameData, null, 2), 'utf-8');
  
  console.log(`\n🎉 全試合データ取得完了!`);
  console.log(`📊 最終結果:`);
  console.log(`   ✅ 成功: ${totalSuccessful}試合`);
  console.log(`   ❌ 失敗: ${totalFailed}試合`);
  console.log(`   📁 保存先: ${finalPath}`);
  
  // 月別サマリー
  const summary: Record<string, number> = {};
  Object.values(allGameData).forEach(dayGames => {
    Object.values(dayGames).forEach(game => {
      const month = game.date.substring(5, 7);
      summary[month] = (summary[month] || 0) + 1;
    });
  });
  
  console.log(`\n📈 月別取得数:`);
  Object.entries(summary).forEach(([month, count]) => {
    console.log(`   ${month}月: ${count}試合`);
  });
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchGameData, getGameUrls };