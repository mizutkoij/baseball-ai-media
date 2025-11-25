import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// インターfaces
interface PlayerBattingStats {
  battingOrder: number;
  position: string;
  name: string;
  atBats: number;
  runs: number;
  hits: number;
  rbis: number;
  stolenBases: number;
  inningResults: string[]; // 各イニングでの打席結果
}

interface PitcherStats {
  name: string;
  result: 'win' | 'loss' | 'save' | 'hold' | 'none';
  pitchCount: number;
  battersFaced: number;
  inningsPitched: string;
  hits: number;
  homeRuns: number;
  walks: number;
  hitByPitch: number;
  strikeouts: number;
  wildPitches: number;
  balks: number;
  runsAllowed: number;
  earnedRuns: number;
}

interface TeamRoster {
  teamName: string;
  pitchers: Array<{
    number: string;
    name: string;
    throwBat: string; // 右投右打など
  }>;
  fielders: Array<{
    number: string;
    name: string;
    throwBat: string;
  }>;
}

interface PlayByPlayData {
  inning: number;
  topBottom: 'top' | 'bottom';
  battingTeam: string;
  plays: Array<{
    batter: string;
    result: string;
    description: string;
  }>;
}

interface DetailedGameData {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  venue: string;
  
  // 基本スコア
  inningScores: {
    away: number[];
    home: number[];
  };
  
  // 詳細選手成績
  homeBatting: PlayerBattingStats[];
  awayBatting: PlayerBattingStats[];
  homePitching: PitcherStats[];
  awayPitching: PitcherStats[];
  
  // チームロースター
  homeRoster: TeamRoster;
  awayRoster: TeamRoster;
  
  // 実況データ
  playByPlay: PlayByPlayData[];
  
  // メタデータ
  gameTime?: string;
  attendance?: string;
  weather?: string;
}

const TEAM_CODE_MAPPING: Record<string, string> = {
  'c': '広島', 'd': '中日', 'g': '巨人', 's': 'ヤクルト', 't': '阪神', 'db': 'DeNA',
  'h': 'ソフトバンク', 'f': '日本ハム', 'e': '楽天', 'm': 'ロッテ', 'l': '西武', 'b': 'オリックス'
};

// BOXスコアから選手打撃成績を抽出
async function extractBattingStats($: cheerio.CheerioAPI, isHomeTeam: boolean): Promise<PlayerBattingStats[]> {
  const battingStats: PlayerBattingStats[] = [];
  
  // ホームチームは9番目のテーブル、アウェーチームは3番目のテーブル
  const targetTableIndex = isHomeTeam ? 8 : 2; // 0-indexed
  const tables = $('table');
  
  if (tables.length <= targetTableIndex) return battingStats;
  
  const $table = $(tables[targetTableIndex]);
  const rows = $table.find('tr');
  
  console.log(`📊 ${isHomeTeam ? 'ホーム' : 'アウェー'}チーム打撃成績抽出中...`);
  
  rows.each((rowIndex, row) => {
    if (rowIndex === 0) return; // ヘッダーをスキップ
    
    const $row = $(row);
    const cells = $row.find('td');
    
    if (cells.length >= 15) { // 十分なデータがある行
      const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
      
      // 選手名とポジション情報
      const battingOrderText = cellTexts[0];
      const positionText = cellTexts[1];
      const playerName = cellTexts[2];
      
      // チーム計の行はスキップ
      if (!playerName || playerName.includes('チーム計') || !battingOrderText) {
        return;
      }
      
      const battingOrder = parseInt(battingOrderText) || 0;
      const position = positionText.replace(/[()]/g, '') || 'Unknown';
      
      // 基本成績
      const atBats = parseInt(cellTexts[3]) || 0;
      const runs = parseInt(cellTexts[4]) || 0;
      const hits = parseInt(cellTexts[5]) || 0;
      const rbis = parseInt(cellTexts[6]) || 0;
      const stolenBases = parseInt(cellTexts[7]) || 0;
      
      // イニング別結果（8列目以降）
      const inningResults: string[] = [];
      for (let i = 8; i < Math.min(cellTexts.length, 17); i++) { // 最大9イニング
        const result = cellTexts[i];
        if (result && result !== '-') {
          inningResults.push(result);
        }
      }
      
      const playerStats: PlayerBattingStats = {
        battingOrder,
        position,
        name: playerName,
        atBats,
        runs,
        hits,
        rbis,
        stolenBases,
        inningResults
      };
      
      battingStats.push(playerStats);
      console.log(`   🏏 ${battingOrder}番 ${position} ${playerName}: ${hits}/${atBats} ${rbis}打点`);
    }
  });
  
  return battingStats;
}

// 投手成績を抽出
async function extractPitchingStats($: cheerio.CheerioAPI, isHomeTeam: boolean): Promise<PitcherStats[]> {
  const pitchingStats: PitcherStats[] = [];
  
  // ホームチームは10番目のテーブル、アウェーチームは4番目のテーブル
  const targetTableIndex = isHomeTeam ? 9 : 3; // 0-indexed
  const tables = $('table');
  
  if (tables.length <= targetTableIndex) return pitchingStats;
  
  const $table = $(tables[targetTableIndex]);
  const rows = $table.find('tr');
  
  console.log(`⚾ ${isHomeTeam ? 'ホーム' : 'アウェー'}チーム投手成績抽出中...`);
  
  rows.each((rowIndex, row) => {
    if (rowIndex === 0) return; // ヘッダーをスキップ
    
    const $row = $(row);
    const cells = $row.find('td');
    
    if (cells.length >= 13) { // 十分なデータがある行
      const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
      
      const resultText = cellTexts[0]; // ○、●、S、Hなど
      const pitcherName = cellTexts[1];
      
      // チーム計の行やデータが不完全な行はスキップ
      if (!pitcherName || pitcherName.includes('チーム計') || pitcherName.length < 2) {
        return;
      }
      
      // 勝敗結果
      let result: 'win' | 'loss' | 'save' | 'hold' | 'none' = 'none';
      if (resultText === '○') result = 'win';
      else if (resultText === '●') result = 'loss';
      else if (resultText === 'S') result = 'save';
      else if (resultText === 'H') result = 'hold';
      
      // 成績データ
      const pitchCount = parseInt(cellTexts[2]) || 0;
      const battersFaced = parseInt(cellTexts[3]) || 0;
      const inningsPitched = cellTexts[4] || '0';
      const hits = parseInt(cellTexts[5]) || 0;
      const homeRuns = parseInt(cellTexts[6]) || 0;
      const walks = parseInt(cellTexts[7]) || 0;
      const hitByPitch = parseInt(cellTexts[8]) || 0;
      const strikeouts = parseInt(cellTexts[9]) || 0;
      const wildPitches = parseInt(cellTexts[10]) || 0;
      const balks = parseInt(cellTexts[11]) || 0;
      const runsAllowed = parseInt(cellTexts[12]) || 0;
      const earnedRuns = parseInt(cellTexts[13]) || 0;
      
      const pitcherStat: PitcherStats = {
        name: pitcherName,
        result,
        pitchCount,
        battersFaced,
        inningsPitched,
        hits,
        homeRuns,
        walks,
        hitByPitch,
        strikeouts,
        wildPitches,
        balks,
        runsAllowed,
        earnedRuns
      };
      
      pitchingStats.push(pitcherStat);
      console.log(`   ⚾ ${result !== 'none' ? `[${result.toUpperCase()}] ` : ''}${pitcherName}: ${inningsPitched}回 ${strikeouts}K ${runsAllowed}失点`);
    }
  });
  
  return pitchingStats;
}

// ロースター情報を抽出
async function extractRosterData($: cheerio.CheerioAPI): Promise<{ homeRoster: TeamRoster; awayRoster: TeamRoster }> {
  console.log('👥 ロースター情報抽出中...');
  
  const tables = $('table');
  const homeRoster: TeamRoster = { teamName: '', pitchers: [], fielders: [] };
  const awayRoster: TeamRoster = { teamName: '', pitchers: [], fielders: [] };
  
  // ロースターテーブルは通常3番目と4番目
  for (let tableIndex = 2; tableIndex < Math.min(tables.length, 6); tableIndex++) {
    const $table = $(tables[tableIndex]);
    const rows = $table.find('tr');
    
    if (rows.length > 10) { // ロースターテーブルらしいサイズ
      const isHomeTeam = tableIndex > 3; // 4番目以降はホームチーム
      const roster = isHomeTeam ? homeRoster : awayRoster;
      
      rows.each((rowIndex, row) => {
        if (rowIndex === 0) return; // ヘッダーをスキップ
        
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 3) {
          const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
          const number = cellTexts[0];
          const name = cellTexts[1];
          const throwBat = cellTexts[2];
          
          if (number && name && name.length > 1) {
            const playerInfo = { number, name, throwBat: throwBat || '' };
            
            // ヘッダーで投手・野手を判別（簡易）
            const headerText = $table.find('tr').first().text();
            if (headerText.includes('投手')) {
              roster.pitchers.push(playerInfo);
            } else {
              roster.fielders.push(playerInfo);
            }
          }
        }
      });
    }
  }
  
  console.log(`   👥 アウェーチーム: 投手${awayRoster.pitchers.length}人, 野手${awayRoster.fielders.length}人`);
  console.log(`   👥 ホームチーム: 投手${homeRoster.pitchers.length}人, 野手${homeRoster.fielders.length}人`);
  
  return { homeRoster, awayRoster };
}

// 実況データを抽出
async function extractPlayByPlayData($: cheerio.CheerioAPI): Promise<PlayByPlayData[]> {
  console.log('📝 実況データ抽出中...');
  
  const playByPlayData: PlayByPlayData[] = [];
  const tables = $('table');
  
  // 実況ページには通常80+のテーブルがある
  if (tables.length < 10) {
    console.log('   実況データが見つかりません');
    return playByPlayData;
  }
  
  // 実況テーブルを順次処理（スコアテーブル以降）
  for (let tableIndex = 2; tableIndex < Math.min(tables.length, 50); tableIndex++) {
    const $table = $(tables[tableIndex]);
    const rows = $table.find('tr');
    
    // 実況テーブルの特徴：3-5行程度で打席結果を含む
    if (rows.length >= 3 && rows.length <= 8) {
      const tableText = $table.text();
      
      // イニング情報をテーブル周辺から推測
      let inning = 1;
      let topBottom: 'top' | 'bottom' = 'top';
      
      // 簡易的な実況データ抽出
      const plays: Array<{ batter: string; result: string; description: string }> = [];
      
      rows.each((rowIndex, row) => {
        if (rowIndex === 0) return; // ヘッダーをスキップ
        
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 3) {
          const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
          const batter = cellTexts[1] || '';
          const result = cellTexts[2] || '';
          
          if (batter && result && batter.length > 1) {
            plays.push({
              batter,
              result,
              description: cellTexts.slice(3).join(' ')
            });
          }
        }
      });
      
      if (plays.length > 0) {
        playByPlayData.push({
          inning,
          topBottom,
          battingTeam: '', // 実装時に詳細化
          plays
        });
      }
    }
  }
  
  console.log(`   📝 実況データ: ${playByPlayData.length}セグメント抽出`);
  return playByPlayData;
}

// メイン：詳細ゲームデータ取得
async function fetchComprehensiveGameData(gameUrl: string): Promise<DetailedGameData | null> {
  const baseUrl = 'https://npb.jp';
  
  try {
    console.log(`\n🎯 詳細データ取得開始: ${gameUrl}`);
    
    // URL解析
    const parts = gameUrl.split('/').filter(part => part.length > 0);
    let dateStr = '', matchStr = '';
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'scores' && i + 2 < parts.length) {
        dateStr = parts[i + 2];
        matchStr = parts[i + 3];
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
    
    // 日付フォーマット
    const year = '2025';
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const formattedDate = `${year}-${month}-${day}`;
    
    // BOXスコアページから詳細データ取得
    const boxUrl = baseUrl + gameUrl + 'box.html';
    console.log(`📊 BOXスコア取得: ${boxUrl}`);
    
    const boxResponse = await fetch(boxUrl);
    if (!boxResponse.ok) return null;
    
    const boxHtml = await boxResponse.text();
    const $box = cheerio.load(boxHtml);
    
    // 基本スコア抽出（既存ロジック使用）
    let homeScore = 0, awayScore = 0;
    const inningScores = { away: [] as number[], home: [] as number[] };
    
    // スコアテーブル解析
    let scoreTableFound = false;
    $box('table').each((_, table) => {
      if (scoreTableFound) return false;
      
      const $table = $box(table);
      const rows = $table.find('tr');
      if (rows.length >= 3) {
        const headerRow = rows.first();
        const headerCells = headerRow.find('td, th');
        const headerTexts = headerCells.map((_, cell) => $box(cell).text().trim()).get();
        
        const hasInnings = headerTexts.includes('1') && headerTexts.includes('9');
        const hasStats = headerTexts.includes('計') && headerTexts.includes('H') && headerTexts.includes('E');
        
        if (hasInnings && hasStats && headerCells.length >= 12) {
          for (let rowIndex = 1; rowIndex <= 2; rowIndex++) {
            const dataRow = $box(rows[rowIndex]);
            const dataCells = dataRow.find('td');
            
            if (dataCells.length >= 12) {
              const rowData = dataCells.map((_, cell) => $box(cell).text().trim()).get();
              
              const inningValues = [];
              for (let i = 0; i <= 8; i++) {
                const val = rowData[i];
                const score = (val === 'x' || val === 'X') ? 0 : (parseInt(val) || 0);
                inningValues.push(score);
              }
              
              const totalRuns = parseInt(rowData[9]) || 0;
              
              if (rowIndex === 1) { // ホームチーム
                inningScores.home = inningValues;
                homeScore = totalRuns;
              } else if (rowIndex === 2) { // アウェーチーム
                inningScores.away = inningValues;
                awayScore = totalRuns;
              }
            }
          }
          
          if ((homeScore > 0 || awayScore > 0) || (inningScores.away.length > 0 || inningScores.home.length > 0)) {
            scoreTableFound = true;
            return false;
          }
        }
      }
    });
    
    // 詳細データ抽出
    console.log(`🔍 詳細成績データ抽出中...`);
    const awayBatting = await extractBattingStats($box, false);
    const homeBatting = await extractBattingStats($box, true);
    const awayPitching = await extractPitchingStats($box, false);
    const homePitching = await extractPitchingStats($box, true);
    
    // ロースターデータ取得
    const rosterUrl = baseUrl + gameUrl + 'roster.html';
    console.log(`👥 ロースター取得: ${rosterUrl}`);
    
    let homeRoster: TeamRoster = { teamName: homeTeam, pitchers: [], fielders: [] };
    let awayRoster: TeamRoster = { teamName: awayTeam, pitchers: [], fielders: [] };
    
    try {
      const rosterResponse = await fetch(rosterUrl);
      if (rosterResponse.ok) {
        const rosterHtml = await rosterResponse.text();
        const $roster = cheerio.load(rosterHtml);
        const rosterData = await extractRosterData($roster);
        homeRoster = rosterData.homeRoster;
        awayRoster = rosterData.awayRoster;
        homeRoster.teamName = homeTeam;
        awayRoster.teamName = awayTeam;
      }
    } catch (error) {
      console.log(`   ⚠️ ロースターデータ取得をスキップ: ${error.message}`);
    }
    
    // 実況データ取得
    const playByPlayUrl = baseUrl + gameUrl + 'playbyplay.html';
    console.log(`📝 実況取得: ${playByPlayUrl}`);
    
    let playByPlay: PlayByPlayData[] = [];
    try {
      const playByPlayResponse = await fetch(playByPlayUrl);
      if (playByPlayResponse.ok) {
        const playByPlayHtml = await playByPlayResponse.text();
        const $playByPlay = cheerio.load(playByPlayHtml);
        playByPlay = await extractPlayByPlayData($playByPlay);
      }
    } catch (error) {
      console.log(`   ⚠️ 実況データ取得をスキップ: ${error.message}`);
    }
    
    // 基本情報抽出
    const pageText = $box.text();
    const timeMatch = pageText.match(/開始\s*(\d{1,2}:\d{2})/);
    const gameTimeMatch = pageText.match(/試合時間\s*([^\n◇◆]+)/);
    const attendanceMatch = pageText.match(/入場者\s*([0-9,]+人)/);
    const weatherMatch = pageText.match(/天候[：:]\s*([^\n◇◆]+)/);
    
    // 球場判定
    let venue = 'unknown';
    if (pageText.includes('東京ドーム')) venue = '東京ドーム';
    else if (pageText.includes('甲子園')) venue = '甲子園';
    else if (pageText.includes('ハマスタ') || pageText.includes('横浜')) venue = '横浜スタジアム';
    else if (pageText.includes('神宮')) venue = '神宮球場';
    else if (pageText.includes('マツダ')) venue = 'マツダスタジアム';
    else if (pageText.includes('バンテリン') || pageText.includes('ナゴヤ')) venue = 'バンテリンドーム';
    
    const detailedGameData: DetailedGameData = {
      gameId: `${formattedDate}_${awayCode}-${homeCode}`,
      date: formattedDate,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      venue,
      inningScores,
      homeBatting,
      awayBatting,
      homePitching,
      awayPitching,
      homeRoster,
      awayRoster,
      playByPlay,
      gameTime: gameTimeMatch ? gameTimeMatch[1].trim() : undefined,
      attendance: attendanceMatch ? attendanceMatch[1] : undefined,
      weather: weatherMatch ? weatherMatch[1].trim() : undefined
    };
    
    console.log(`✅ 詳細データ取得完了: ${awayTeam} ${awayScore}-${homeScore} ${homeTeam}`);
    console.log(`   📊 打撃成績: away=${awayBatting.length}人, home=${homeBatting.length}人`);
    console.log(`   ⚾ 投手成績: away=${awayPitching.length}人, home=${homePitching.length}人`);
    console.log(`   👥 ロースター: away=${awayRoster.pitchers.length + awayRoster.fielders.length}人, home=${homeRoster.pitchers.length + homeRoster.fielders.length}人`);
    console.log(`   📝 実況: ${playByPlay.length}セグメント`);
    
    return detailedGameData;
    
  } catch (error) {
    console.error(`❌ 詳細データ取得エラー [${gameUrl}]: ${error.message}`);
    return null;
  }
}

// プログレス管理
function saveDetailedProgress(data: DetailedGameData[], filename: string) {
  const outputPath = path.join(__dirname, '../data', filename);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadDetailedProgress(filename: string): DetailedGameData[] {
  const progressPath = path.join(__dirname, '../data', filename);
  if (fs.existsSync(progressPath)) {
    try {
      const data = fs.readFileSync(progressPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`⚠️ 進行状況読み込みエラー: ${error}`);
    }
  }
  return [];
}

// メイン処理：複数試合の詳細データを取得
async function fetchMultipleDetailedGames(gameUrls: string[]) {
  console.log(`🚀 NPB詳細データ一括取得開始: ${gameUrls.length}試合`);
  
  const existingData = loadDetailedProgress('npb_2025_detailed_complete.json');
  const processedGameIds = new Set(existingData.map(game => game.gameId));
  
  console.log(`📋 既存データ: ${existingData.length}試合`);
  
  let newGames = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < gameUrls.length; i++) {
    const gameUrl = gameUrls[i];
    console.log(`\n[${i + 1}/${gameUrls.length}] ${gameUrl}`);
    
    const detailedData = await fetchComprehensiveGameData(gameUrl);
    
    if (detailedData) {
      // 重複チェック
      if (processedGameIds.has(detailedData.gameId)) {
        console.log(`⏭️ スキップ: ${detailedData.awayTeam} vs ${detailedData.homeTeam}`);
        skipped++;
        continue;
      }
      
      existingData.push(detailedData);
      processedGameIds.add(detailedData.gameId);
      newGames++;
      
      console.log(`✅ 詳細データ保存: ${detailedData.awayTeam} ${detailedData.awayScore}-${detailedData.homeScore} ${detailedData.homeTeam}`);
      
      // 5試合ごとに保存
      if (newGames % 5 === 0) {
        saveDetailedProgress(existingData, 'npb_2025_detailed_complete.json');
        console.log(`💾 中間保存: ${newGames}試合`);
      }
    } else {
      failed++;
      console.log(`❌ 詳細データ取得失敗`);
    }
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // 最終保存
  saveDetailedProgress(existingData, 'npb_2025_detailed_complete.json');
  
  console.log(`\n🎉 NPB詳細データ一括取得完了！`);
  console.log(`📊 結果:`);
  console.log(`   新規取得: ${newGames}試合`);
  console.log(`   スキップ: ${skipped}試合`);
  console.log(`   失敗: ${failed}試合`);
  console.log(`   総詳細データ: ${existingData.length}試合`);
}

// テスト実行
async function testDetailedExtraction() {
  console.log('🧪 詳細データ抽出テスト');
  
  const testGameUrls = [
    '/scores/2025/0801/g-db-14/', // 巨人 vs DeNA
    '/scores/2025/0606/db-f-01/', // DeNA vs 日本ハム
    '/scores/2025/0622/t-h-03/'   // 阪神 vs ソフトバンク
  ];
  
  await fetchMultipleDetailedGames(testGameUrls);
}

if (require.main === module) {
  testDetailedExtraction().catch(console.error);
}

export { 
  fetchComprehensiveGameData, 
  fetchMultipleDetailedGames,
  DetailedGameData,
  PlayerBattingStats,
  PitcherStats,
  TeamRoster,
  PlayByPlayData
};