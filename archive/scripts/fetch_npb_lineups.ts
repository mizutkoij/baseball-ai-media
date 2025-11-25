import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const TEAM_CODE_MAPPING: Record<string, string> = {
  'c': '広島', 'd': '中日', 'g': '巨人', 's': 'ヤクルト', 't': '阪神', 'db': 'DeNA',
  'h': 'ソフトバンク', 'f': '日本ハム', 'e': '楽天', 'm': 'ロッテ', 'l': '西武', 'b': 'オリックス'
};

const POSITION_MAPPING: Record<string, string> = {
  '投': 'P', '捕': 'C', '一': '1B', '二': '2B', '三': '3B', '遊': 'SS', '左': 'LF', '中': 'CF', '右': 'RF',
  'P': 'P', 'C': 'C', '1B': '1B', '2B': '2B', '3B': '3B', 'SS': 'SS', 'LF': 'LF', 'CF': 'CF', 'RF': 'RF',
  'DH': 'DH', '指': 'DH', '代打': 'PH', '代走': 'PR'
};

interface PlayerInfo {
  position: string;
  name: string;
  positionName: string;
  playerId?: string;
  battingOrder?: number;
}

interface LineupData {
  date: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  homeLineup: PlayerInfo[];
  awayLineup: PlayerInfo[];
  homeBattery: string[];
  awayBattery: string[];
  officials?: {
    chief?: string;
    first?: string;
    second?: string;
    third?: string;
  };
}

// スタメン情報を抽出
async function fetchLineupData(gameUrl: string): Promise<LineupData | null> {
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
    // roster.htmlからスタメン情報を取得
    const rosterUrl = baseUrl + gameUrl + 'roster.html';
    console.log(`📋 スタメン取得: ${rosterUrl}`);
    
    const rosterResponse = await fetch(rosterUrl);
    if (!rosterResponse.ok) return null;
    
    const rosterHtml = await rosterResponse.text();
    const $roster = cheerio.load(rosterHtml);
    
    // 日付フォーマット
    const year = '2025';
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const formattedDate = `${year}-${month}-${day}`;
    
    const awayTeamCode = Object.keys(TEAM_CODE_MAPPING).find(code => TEAM_CODE_MAPPING[code] === awayTeam)?.toUpperCase() || awayCode.toUpperCase();
    const homeTeamCode = Object.keys(TEAM_CODE_MAPPING).find(code => TEAM_CODE_MAPPING[code] === homeTeam)?.toUpperCase() || homeCode.toUpperCase();
    
    const homeLineup: PlayerInfo[] = [];
    const awayLineup: PlayerInfo[] = [];
    const homeBattery: string[] = [];
    const awayBattery: string[] = [];
    
    // スタメンテーブルを解析
    let currentTeam = '';
    
    $roster('table').each((tableIndex, table) => {
      const $table = $roster(table);
      const tableText = $table.text();
      
      // テーブルのヘッダーでチームを判定
      if (tableText.includes(awayTeam) || tableText.includes('ビジター') || tableText.includes('先攻')) {
        currentTeam = 'away';
      } else if (tableText.includes(homeTeam) || tableText.includes('ホーム') || tableText.includes('後攻')) {
        currentTeam = 'home';
      }
      
      // スタメン行を抽出
      $table.find('tr').each((rowIndex, row) => {
        const $row = $roster(row);
        const cells = $row.find('td, th');
        
        if (cells.length >= 3) {
          const rowData: string[] = [];
          cells.each((_, cell) => {
            rowData.push($roster(cell).text().trim());
          });
          
          // 打順、ポジション、選手名のパターンを探す
          for (let i = 0; i < rowData.length - 2; i++) {
            const battingOrder = parseInt(rowData[i]);
            const position = rowData[i + 1];
            const playerName = rowData[i + 2];
            
            if (battingOrder >= 1 && battingOrder <= 9 && position && playerName) {
              const mappedPosition = POSITION_MAPPING[position] || position;
              
              const playerInfo: PlayerInfo = {
                position: mappedPosition,
                name: playerName.replace(/\s+/g, ' ').trim(),
                positionName: getPositionName(mappedPosition),
                battingOrder
              };
              
              if (currentTeam === 'home') {
                homeLineup.push(playerInfo);
              } else if (currentTeam === 'away') {
                awayLineup.push(playerInfo);
              }
              
              console.log(`  ${currentTeam === 'home' ? homeTeam : awayTeam}: ${battingOrder}番 ${position}(${mappedPosition}) ${playerName}`);
              break;
            }
          }
        }
      });
    });
    
    // バッテリー情報の抽出
    extractBatteryInfo($roster, homeTeam, awayTeam, homeBattery, awayBattery);
    
    // 審判情報
    const officials = extractOfficials($roster);
    
    // ソート（打順順）
    homeLineup.sort((a, b) => (a.battingOrder || 10) - (b.battingOrder || 10));
    awayLineup.sort((a, b) => (a.battingOrder || 10) - (b.battingOrder || 10));
    
    const lineupData: LineupData = {
      date: formattedDate,
      matchup: `${awayTeamCode}-${homeTeamCode}`,
      homeTeam,
      awayTeam,
      homeLineup,
      awayLineup,
      homeBattery,
      awayBattery,
      officials
    };
    
    console.log(`✅ スタメン取得成功: ${awayTeam} vs ${homeTeam}`);
    console.log(`   ホーム: ${homeLineup.length}人, アウェー: ${awayLineup.length}人`);
    
    return lineupData;
    
  } catch (error) {
    console.error(`❌ スタメン取得エラー [${gameUrl}]: ${error}`);
    return null;
  }
}

function getPositionName(position: string): string {
  const positionNames: Record<string, string> = {
    'P': '投手', 'C': '捕手', '1B': '一塁手', '2B': '二塁手', '3B': '三塁手',
    'SS': '遊撃手', 'LF': '左翼手', 'CF': '中堅手', 'RF': '右翼手', 'DH': '指名打者'
  };
  return positionNames[position] || position;
}

// バッテリー情報抽出
function extractBatteryInfo($: cheerio.CheerioAPI, homeTeam: string, awayTeam: string, homeBattery: string[], awayBattery: string[]) {
  const pageText = $.text();
  
  // 先発投手の抽出
  const startingPitcherPattern = new RegExp(`(${homeTeam}|${awayTeam}).*?先発.*?([\u3040-\u30ff\u4e00-\u9faf]+)`, 'g');
  let match;
  
  while ((match = startingPitcherPattern.exec(pageText)) !== null) {
    const team = match[1];
    const pitcher = match[2];
    
    if (team === homeTeam) {
      homeBattery.push(pitcher + '(先発)');
    } else if (team === awayTeam) {
      awayBattery.push(pitcher + '(先発)');
    }
  }
  
  // 捕手の抽出（スタメンから）
  const catcherPattern = /捕.*?([\u3040-\u30ff\u4e00-\u9faf]+)/g;
  while ((match = catcherPattern.exec(pageText)) !== null) {
    const catcher = match[1];
    // より詳細な判定が必要だが、簡易版として両チームに追加
    if (!homeBattery.some(p => p.includes(catcher))) {
      homeBattery.push(catcher + '(捕手)');
    }
  }
}

// 審判情報抽出
function extractOfficials($: cheerio.CheerioAPI) {
  const pageText = $.text();
  const officials: { chief?: string; first?: string; second?: string; third?: string; } = {};
  
  const chiefMatch = pageText.match(/球審[：:]\s*([^\s\n]+)/);
  const firstMatch = pageText.match(/一塁[：:]\s*([^\s\n]+)/);
  const secondMatch = pageText.match(/二塁[：:]\s*([^\s\n]+)/);
  const thirdMatch = pageText.match(/三塁[：:]\s*([^\s\n]+)/);
  
  if (chiefMatch) officials.chief = chiefMatch[1].trim();
  if (firstMatch) officials.first = firstMatch[1].trim();
  if (secondMatch) officials.second = secondMatch[1].trim();
  if (thirdMatch) officials.third = thirdMatch[1].trim();
  
  return officials;
}

// 既存の試合データと統合
function integrateWithExistingData(lineupData: LineupData[], existingDataPath: string) {
  try {
    const existingData = JSON.parse(fs.readFileSync(existingDataPath, 'utf-8'));
    
    lineupData.forEach(lineup => {
      const dateGames = existingData[lineup.date];
      if (dateGames && dateGames[lineup.matchup]) {
        // 既存データにスタメン情報を追加
        dateGames[lineup.matchup].homeLineup = lineup.homeLineup;
        dateGames[lineup.matchup].awayLineup = lineup.awayLineup;
        dateGames[lineup.matchup].homeBattery = lineup.homeBattery;
        dateGames[lineup.matchup].awayBattery = lineup.awayBattery;
        dateGames[lineup.matchup].officials = lineup.officials;
        
        console.log(`🔄 統合完了: ${lineup.matchup} (${lineup.date})`);
      }
    });
    
    // 更新されたデータを保存
    fs.writeFileSync(existingDataPath, JSON.stringify(existingData, null, 2), 'utf-8');
    console.log(`💾 統合データ保存: ${existingDataPath}`);
    
  } catch (error) {
    console.error(`❌ データ統合エラー: ${error}`);
  }
}

// 8月の試合URLを取得（既存スクリプトから流用）
async function getAugustGameUrls(): Promise<string[]> {
  const scheduleUrl = 'https://npb.jp/games/2025/schedule_08_detail.html';
  console.log(`📅 8月スケジュール取得: ${scheduleUrl}`);
  
  try {
    const response = await fetch(scheduleUrl);
    const html = await response.text();
    
    const urlPattern = /href="(\/scores\/2025\/\d{4}\/[a-z]{1,3}-[a-z]{1,3}-\d{1,2}\/?)/g;
    const matches = html.matchAll(urlPattern);
    
    const gameUrls = [...new Set(Array.from(matches, match => match[1]))];
    console.log(`🎯 発見された試合数: ${gameUrls.length}`);
    
    return gameUrls.sort((a, b) => {
      const dateA = a.match(/\/(\d{4})\//)?.[1] || '';
      const dateB = b.match(/\/(\d{4})\//)?.[1] || '';
      return dateA.localeCompare(dateB);
    });
    
  } catch (error) {
    console.error(`❌ スケジュール取得エラー: ${error}`);
    return [];
  }
}

// メイン処理
async function main() {
  console.log('🚀 NPBスタメン・バッテリー情報取得開始');
  
  // 8月の全試合URLを取得
  const gameUrls = await getAugustGameUrls();
  
  if (gameUrls.length === 0) {
    console.log('❌ 試合URLが見つかりませんでした');
    return;
  }
  
  const allLineupData: LineupData[] = [];
  let processedCount = 0;
  
  console.log(`\n🎯 処理対象: ${gameUrls.length}試合`);
  
  // 各試合のスタメン情報を取得
  for (const gameUrl of gameUrls) {
    processedCount++;
    console.log(`\n[${processedCount}/${gameUrls.length}] ${gameUrl}`);
    
    const lineupData = await fetchLineupData(gameUrl);
    
    if (lineupData) {
      allLineupData.push(lineupData);
      console.log(`✅ 成功: ${lineupData.awayTeam} vs ${lineupData.homeTeam}`);
    } else {
      console.log(`❌ 取得失敗`);
    }
    
    // レート制限（2秒間隔）
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // スタメンデータを保存
  const lineupOutputPath = path.join(__dirname, '../data/npb_august_2025_lineups.json');
  fs.writeFileSync(lineupOutputPath, JSON.stringify(allLineupData, null, 2), 'utf-8');
  console.log(`💾 スタメンデータ保存: ${lineupOutputPath}`);
  
  // 既存の試合データと統合
  const existingDataPath = path.join(__dirname, '../data/converted_game_data.json');
  if (fs.existsSync(existingDataPath)) {
    integrateWithExistingData(allLineupData, existingDataPath);
  }
  
  console.log(`\n🎉 スタメン・バッテリー情報取得完了!`);
  console.log(`📊 結果: ${allLineupData.length}試合のスタメン情報を取得`);
  
  // サマリー表示
  allLineupData.forEach(lineup => {
    console.log(`\n📅 ${lineup.date}: ${lineup.awayTeam} vs ${lineup.homeTeam}`);
    console.log(`   ホームスタメン: ${lineup.homeLineup.length}人`);
    console.log(`   アウェースタメン: ${lineup.awayLineup.length}人`);
    console.log(`   ホームバッテリー: ${lineup.homeBattery.length}人`);
    console.log(`   アウェーバッテリー: ${lineup.awayBattery.length}人`);
  });
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchLineupData, integrateWithExistingData };