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
  homeLineup?: Array<{
    position: string;
    name: string;
    positionName: string;
    playerId?: string;
  }>;
  awayLineup?: Array<{
    position: string;
    name: string;
    positionName: string;
    playerId?: string;
  }>;
  homeBattery?: string[];
  awayBattery?: string[];
  officials?: {
    chief?: string;
    first?: string;
    second?: string;
    third?: string;
  };
}

// 日付範囲を生成する関数
function generateDateRange(year: number, month: number): string[] {
  const dates = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    dates.push(dateStr);
  }
  
  return dates;
}

// 試合URLを取得する関数
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
  const fullUrl = baseUrl + gameUrl;
  
  // URL から基本情報を抽出
  const urlParts = gameUrl.split('/').filter(part => part.length > 0);
  console.log(`🔍 URLパーツ: ${JSON.stringify(urlParts)}`);
  
  // 正しいインデックスを探す
  let dateStr = '';
  let matchStr = '';
  
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
  
  console.log(`⚾ 試合データ取得中: ${fullUrl}`);
  console.log(`🔍 URL解析: dateStr=${dateStr}, matchStr=${matchStr}, awayCode=${awayCode}, homeCode=${homeCode}`);
  
  try {
    // 基本情報ページ
    const indexResponse = await fetch(fullUrl + 'index.html');
    const indexHtml = await indexResponse.text();
    const $index = cheerio.load(indexHtml);
    
    // ボックススコアページ
    const boxResponse = await fetch(fullUrl + 'box.html');
    const boxHtml = await boxResponse.text();
    const $box = cheerio.load(boxHtml);
    
    // ロスターページ  
    const rosterResponse = await fetch(fullUrl + 'roster.html');
    const rosterHtml = await rosterResponse.text();
    const $roster = cheerio.load(rosterHtml);
    
    const homeTeam = TEAM_CODE_MAPPING[homeCode] || homeCode?.toUpperCase() || 'UNKNOWN';
    const awayTeam = TEAM_CODE_MAPPING[awayCode] || awayCode?.toUpperCase() || 'UNKNOWN';
    
    // 日付フォーマット
    const year = '2025';
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const formattedDate = `${year}-${month}-${day}`;
    
    // 試合詳細情報を抽出（より広範囲な検索）
    const pageText = $index.text();
    const timeMatch = pageText.match(/開始\s*(\d{1,2}:\d{2})/);
    const endTimeMatch = pageText.match(/終了\s*(\d{1,2}:\d{2})/);
    const gameTimeMatch = pageText.match(/試合時間\s*([^◇◆\n]+)/);
    const attendanceMatch = pageText.match(/入場者\s*([0-9,]+人)/);
    const venueMatch = pageText.match(/(マツダスタジアム|東京ドーム|横浜スタジアム|神宮球場|甲子園|バンテリンドーム|ZOZOマリン|京セラドーム|エスコンフィールド|楽天モバイルパーク|ベルーナドーム|みずほPayPayドーム)/);
    
    // スコア抽出（より柔軟な検索）
    let homeScore = 0, awayScore = 0;
    
    // ページからスコアパターンを探す
    const scorePattern = /(\d+)\s*[-‐−]\s*(\d+)/;
    const scoreMatch = pageText.match(scorePattern);
    if (scoreMatch) {
      awayScore = parseInt(scoreMatch[1]) || 0;
      homeScore = parseInt(scoreMatch[2]) || 0;
    }
    
    // イニング別スコア抽出
    const inningScores = {
      away: [] as number[],
      home: [] as number[]
    };
    
    $box('.line-score tbody tr').each((i, row) => {
      const cells = $box(row).find('td');
      const scores = cells.slice(1, -3).map((_, cell) => {
        const text = $box(cell).text().trim();
        return text === 'x' ? 0 : parseInt(text) || 0;
      }).get();
      
      if (i === 0) inningScores.away = scores;
      else if (i === 1) inningScores.home = scores;
    });
    
    // 投手情報抽出
    const winningPitcher = $box('.winning-pitcher').text().replace('【勝投手】', '').trim();
    const losingPitcher = $box('.losing-pitcher').text().replace('【敗投手】', '').trim();
    const savePitcher = $box('.save-pitcher').text().replace('【セーブ】', '').trim();
    
    // スタメン情報抽出
    const homeLineup: any[] = [];
    const awayLineup: any[] = [];
    
    $roster('.lineup .away-team .player').each((i, el) => {
      const position = $roster(el).find('.position').text();
      const name = $roster(el).find('.name').text();
      const positionName = $roster(el).find('.pos-name').text();
      
      awayLineup.push({
        position: String(i + 1),
        name: name,
        positionName: positionName,
        playerId: name.toLowerCase().replace(/\s+/g, '-')
      });
    });
    
    $roster('.lineup .home-team .player').each((i, el) => {
      const position = $roster(el).find('.position').text();
      const name = $roster(el).find('.name').text();
      const positionName = $roster(el).find('.pos-name').text();
      
      homeLineup.push({
        position: String(i + 1),
        name: name,
        positionName: positionName,
        playerId: name.toLowerCase().replace(/\s+/g, '-')
      });
    });
    
    // リーグ判定
    const centralTeams = ['広島', '中日', '巨人', 'ヤクルト', '阪神', 'DeNA'];
    const league = centralTeams.includes(homeTeam) && centralTeams.includes(awayTeam) ? 'central' : 'pacific';
    
    const gameData: GameData = {
      date: formattedDate,
      matchup: `${TEAM_CODE_MAPPING[awayCode] || awayCode.toUpperCase()}-${TEAM_CODE_MAPPING[homeCode] || homeCode.toUpperCase()}`,
      homeTeam,
      awayTeam,
      venue: $index('.venue').text() || 'マツダスタジアム',
      time: timeMatch ? timeMatch[1] : '18:00',
      endTime: endTimeMatch ? endTimeMatch[1] : undefined,
      gameTime: gameTimeMatch ? gameTimeMatch[1].trim() : undefined,
      attendance: attendanceMatch ? attendanceMatch[1] : undefined,
      homeScore,
      awayScore,
      status: 'finished',
      league,
      inningScores: inningScores.away.length > 0 ? inningScores : undefined,
      winningPitcher: winningPitcher || undefined,
      losingPitcher: losingPitcher || undefined,
      savePitcher: savePitcher || undefined,
      homeLineup: homeLineup.length > 0 ? homeLineup : undefined,
      awayLineup: awayLineup.length > 0 ? awayLineup : undefined
    };
    
    console.log(`✅ 試合データ取得完了: ${awayTeam} vs ${homeTeam} (${homeScore}-${awayScore})`);
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
  
  // 試合URLリストを取得
  const gameUrls = await getGameUrls(year, month);
  
  if (gameUrls.length === 0) {
    console.log('❌ 試合URLが見つかりませんでした');
    return;
  }
  
  const allGameData: Record<string, Record<string, GameData>> = {};
  
  // 各試合のデータを取得
  for (const gameUrl of gameUrls.slice(0, 5)) { // テスト用に最初の5試合のみ
    const gameData = await fetchGameData(gameUrl);
    
    if (gameData) {
      if (!allGameData[gameData.date]) {
        allGameData[gameData.date] = {};
      }
      allGameData[gameData.date][gameData.matchup] = gameData;
    }
    
    // APIへの負荷を軽減するため少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 結果をファイルに保存
  const outputPath = path.join(__dirname, '../data/npb_games_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(allGameData, null, 2), 'utf-8');
  
  console.log(`✅ 取得完了! データ保存先: ${outputPath}`);
  console.log(`📊 取得試合数: ${Object.values(allGameData).reduce((total, games) => total + Object.keys(games).length, 0)}`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchGameData, getGameUrls };