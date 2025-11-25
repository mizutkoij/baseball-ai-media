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
    const html = await response.text();
    
    // 試合URLパターンを抽出
    const urlPattern = /href="(\/scores\/2025\/\d{4}\/[a-z]{1,3}-[a-z]{1,3}-\d{1,2}\/?)"/g;
    const matches = html.matchAll(urlPattern);
    
    const gameUrls = Array.from(matches, match => match[1]);
    console.log(`🎯 発見された試合数: ${gameUrls.length}`);
    
    return gameUrls;
  } catch (error) {
    console.error(`❌ スケジュール取得エラー: ${error}`);
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
  
  console.log(`⚾ 試合データ取得中: ${awayTeam} vs ${homeTeam} (${dateStr})`);
  
  try {
    // ボックススコアページから詳細データを取得
    const boxUrl = baseUrl + gameUrl + 'box.html';
    const boxResponse = await fetch(boxUrl);
    const boxHtml = await boxResponse.text();
    const $box = cheerio.load(boxHtml);
    
    // 日付フォーマット
    const year = '2025';
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const formattedDate = `${year}-${month}-${day}`;
    
    // イニング別スコアを抽出（テーブル2から）
    const inningScores = {
      away: [] as number[],
      home: [] as number[]
    };
    
    let homeScore = 0, awayScore = 0, homeHits = 0, awayHits = 0, homeErrors = 0, awayErrors = 0;
    
    // イニング別スコアテーブルを探す
    $box('table').each((tableIndex, table) => {
      const tableText = $box(table).text();
      
      // イニング別スコアテーブルの特徴: 1,2,3,4,5,6,7,8,9を含む
      if (tableText.includes('1') && tableText.includes('2') && tableText.includes('9') && tableText.includes('計')) {
        
        $box(table).find('tr').each((rowIndex, row) => {
          const cells = $box(row).find('td');
          
          if (cells.length >= 12) { // イニング1-9 + 計 + H + E
            const values: number[] = [];
            
            // 1-9回のスコアを取得
            cells.each((cellIndex, cell) => {
              const text = $box(cell).text().trim();
              if (cellIndex >= 1 && cellIndex <= 9) { // 1-9回
                values.push(text === 'x' ? 0 : (parseInt(text) || 0));
              } else if (cellIndex === 10) { // 計
                if (rowIndex === 1) awayScore = parseInt(text) || 0;
                else if (rowIndex === 2) homeScore = parseInt(text) || 0;
              } else if (cellIndex === 11) { // H
                if (rowIndex === 1) awayHits = parseInt(text) || 0;
                else if (rowIndex === 2) homeHits = parseInt(text) || 0;
              } else if (cellIndex === 12) { // E
                if (rowIndex === 1) awayErrors = parseInt(text) || 0;
                else if (rowIndex === 2) homeErrors = parseInt(text) || 0;
              }
            });
            
            if (values.length >= 9) {
              if (rowIndex === 1 && inningScores.away.length === 0) {
                inningScores.away = values.slice(0, 9);
              } else if (rowIndex === 2 && inningScores.home.length === 0) {
                inningScores.home = values.slice(0, 9);
              }
            }
          }
        });
      }
    });
    
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
    const venueMatch = pageText.match(/(マツダスタジアム|東京ドーム|横浜スタジアム|神宮球場|甲子園|バンテリンドーム|ZOZOマリン|京セラドーム|エスコンフィールド|楽天モバイルパーク|ベルーナドーム|みずほPayPayドーム)/);
    
    // リーグ判定
    const centralTeams = ['広島', '中日', '巨人', 'ヤクルト', '阪神', 'DeNA'];
    const league = centralTeams.includes(homeTeam) && centralTeams.includes(awayTeam) ? 'central' : 'pacific';
    
    const gameData: GameData = {
      date: formattedDate,
      matchup: `${awayCode.toUpperCase()}-${homeCode.toUpperCase()}`,
      homeTeam,
      awayTeam,
      venue: venueMatch ? venueMatch[1] : '球場未確認',
      time: timeMatch ? timeMatch[1] : '18:00',
      endTime: endTimeMatch ? endTimeMatch[1] : undefined,
      gameTime: gameTimeMatch ? gameTimeMatch[1].trim() : undefined,
      attendance: attendanceMatch ? attendanceMatch[1] : undefined,
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
    
    console.log(`✅ 試合データ取得完了: ${awayTeam} vs ${homeTeam} (${awayScore}-${homeScore})`);
    return gameData;
    
  } catch (error) {
    console.error(`❌ 試合データ取得エラー [${gameUrl}]: ${error}`);
    return null;
  }
}

// メイン実行関数
async function main() {
  console.log('🚀 NPB試合データ取得開始');
  
  const year = 2025;
  const month = 8; // 8月
  
  // 8月1日のみをテスト
  const testUrls = [
    '/scores/2025/0801/c-d-15/',
    '/scores/2025/0801/db-g-14/',
    '/scores/2025/0801/s-t-14/'
  ];
  
  const allGameData: Record<string, Record<string, GameData>> = {};
  
  // テスト用に特定の試合のみ取得
  for (const gameUrl of testUrls) {
    const gameData = await fetchGameData(gameUrl);
    
    if (gameData) {
      if (!allGameData[gameData.date]) {
        allGameData[gameData.date] = {};
      }
      allGameData[gameData.date][gameData.matchup] = gameData;
    }
    
    // APIへの負荷を軽減するため待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 結果をファイルに保存
  const outputPath = path.join(__dirname, '../data/npb_games_2025_08_01.json');
  fs.writeFileSync(outputPath, JSON.stringify(allGameData, null, 2), 'utf-8');
  
  console.log(`✅ 取得完了! データ保存先: ${outputPath}`);
  console.log(`📊 取得試合数: ${Object.values(allGameData).reduce((total, games) => total + Object.keys(games).length, 0)}`);
  
  // 結果の概要を表示
  Object.entries(allGameData).forEach(([date, games]) => {
    console.log(`\n📅 ${date}:`);
    Object.values(games).forEach(game => {
      console.log(`  ⚾ ${game.awayTeam} ${game.awayScore} - ${game.homeScore} ${game.homeTeam} @${game.venue}`);
      if (game.inningScores) {
        console.log(`     ${game.inningScores.away.join('-')} vs ${game.inningScores.home.join('-')}`);
      }
    });
  });
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchGameData, getGameUrls };