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

// 改善されたスタメン情報抽出
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
    // roster.htmlとindex.htmlの両方から情報を取得
    const rosterUrl = baseUrl + gameUrl + 'roster.html';
    const indexUrl = baseUrl + gameUrl + 'index.html';
    
    console.log(`📋 スタメン取得: ${rosterUrl}`);
    
    const [rosterResponse, indexResponse] = await Promise.all([
      fetch(rosterUrl),
      fetch(indexUrl)
    ]);
    
    if (!rosterResponse.ok) return null;
    
    const rosterHtml = await rosterResponse.text();
    const indexHtml = indexResponse.ok ? await indexResponse.text() : '';
    
    const $roster = cheerio.load(rosterHtml);
    const $index = cheerio.load(indexHtml);
    
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
    
    // より詳細なスタメン解析
    extractStartingLineups($roster, homeTeam, awayTeam, homeLineup, awayLineup);
    
    // バッテリー情報の抽出
    extractBatteryInfo($roster, $index, homeTeam, awayTeam, homeBattery, awayBattery);
    
    // 審判情報
    const officials = extractOfficials($roster);
    
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
    console.log(`   ホームバッテリー: ${homeBattery.length}人, アウェーバッテリー: ${awayBattery.length}人`);
    
    return lineupData;
    
  } catch (error) {
    console.error(`❌ スタメン取得エラー [${gameUrl}]: ${error}`);
    return null;
  }
}

// 改善されたスタメン抽出関数
function extractStartingLineups($: cheerio.CheerioAPI, homeTeam: string, awayTeam: string, homeLineup: PlayerInfo[], awayLineup: PlayerInfo[]) {
  const text = $.text();
  
  // スタメンテーブルをより正確に特定
  $('table').each((tableIndex, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    // スタメンテーブルの判定条件を改善
    if (tableText.includes('スタメン') || tableText.includes('先発') || 
        (tableText.includes('打順') && (tableText.includes('位置') || tableText.includes('選手名')))) {
      
      console.log(`🔍 スタメンテーブル発見: テーブル${tableIndex + 1}`);
      
      let currentSection = '';
      
      $table.find('tr').each((rowIndex, row) => {
        const $row = $(row);
        const rowText = $row.text().trim();
        
        // チーム判定
        if (rowText.includes(awayTeam) || rowText.includes('先攻') || rowText.includes('ビジター')) {
          currentSection = 'away';
          console.log(`  📍 アウェーセクション開始: ${awayTeam}`);
          return;
        } else if (rowText.includes(homeTeam) || rowText.includes('後攻') || rowText.includes('ホーム')) {
          currentSection = 'home';
          console.log(`  📍 ホームセクション開始: ${homeTeam}`);
          return;
        }
        
        // スタメン行の解析
        const cells = $row.find('td, th');
        if (cells.length >= 3 && currentSection) {
          const cellTexts: string[] = [];
          cells.each((_, cell) => {
            cellTexts.push($(cell).text().trim());
          });
          
          // 打順・ポジション・選手名のパターンを探す
          let battingOrder: number | undefined;
          let position: string | undefined;
          let playerName: string | undefined;
          
          // パターン1: 打順, ポジション, 選手名
          for (let i = 0; i < cellTexts.length - 2; i++) {
            const orderCandidate = parseInt(cellTexts[i]);
            if (orderCandidate >= 1 && orderCandidate <= 9) {
              const posCandidate = cellTexts[i + 1];
              const nameCandidate = cellTexts[i + 2];
              
              if (posCandidate && nameCandidate && 
                  posCandidate.length <= 3 && nameCandidate.length >= 2 &&
                  !nameCandidate.match(/^[0-9]+$/) && // 数字だけの名前は除外
                  nameCandidate !== posCandidate) {
                
                battingOrder = orderCandidate;
                position = posCandidate;
                playerName = nameCandidate;
                break;
              }
            }
          }
          
          if (battingOrder && position && playerName) {
            const mappedPosition = POSITION_MAPPING[position] || position;
            
            const playerInfo: PlayerInfo = {
              position: mappedPosition,
              name: playerName.replace(/\s+/g, ' ').trim(),
              positionName: getPositionName(mappedPosition),
              battingOrder
            };
            
            if (currentSection === 'home') {
              homeLineup.push(playerInfo);
              console.log(`    ホーム ${battingOrder}番 ${position}(${mappedPosition}) ${playerName}`);
            } else if (currentSection === 'away') {
              awayLineup.push(playerInfo);
              console.log(`    アウェー ${battingOrder}番 ${position}(${mappedPosition}) ${playerName}`);
            }
          }
        }
      });
    }
  });
  
  // ソート（打順順）
  homeLineup.sort((a, b) => (a.battingOrder || 10) - (b.battingOrder || 10));
  awayLineup.sort((a, b) => (a.battingOrder || 10) - (b.battingOrder || 10));
}

function getPositionName(position: string): string {
  const positionNames: Record<string, string> = {
    'P': '投手', 'C': '捕手', '1B': '一塁手', '2B': '二塁手', '3B': '三塁手',
    'SS': '遊撃手', 'LF': '左翼手', 'CF': '中堅手', 'RF': '右翼手', 'DH': '指名打者'
  };
  return positionNames[position] || position;
}

// 改善されたバッテリー情報抽出
function extractBatteryInfo($roster: cheerio.CheerioAPI, $index: cheerio.CheerioAPI, homeTeam: string, awayTeam: string, homeBattery: string[], awayBattery: string[]) {
  const rosterText = $roster.text();
  const indexText = $index.text();
  const combinedText = rosterText + ' ' + indexText;
  
  // 先発投手の抽出（複数のパターンで）
  const pitcherPatterns = [
    new RegExp(`(${homeTeam}|${awayTeam}).*?先発.*?投手.*?([\\u3040-\\u30ff\\u4e00-\\u9faf]+)`, 'g'),
    new RegExp(`先発.*?([\\u3040-\\u30ff\\u4e00-\\u9faf]+).*?(${homeTeam}|${awayTeam})`, 'g'),
    new RegExp(`投手.*?([\\u3040-\\u30ff\\u4e00-\\u9faf]+).*?先発`, 'g')
  ];
  
  pitcherPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(combinedText)) !== null) {
      const pitcher = match[1];
      const team = match[2];
      
      if (pitcher && pitcher.length >= 2) {
        if (team === homeTeam && !homeBattery.some(p => p.includes(pitcher))) {
          homeBattery.push(`${pitcher} (先発投手)`);
        } else if (team === awayTeam && !awayBattery.some(p => p.includes(pitcher))) {
          awayBattery.push(`${pitcher} (先発投手)`);
        }
      }
    }
  });
  
  // 捕手の抽出
  $roster('table').each((_, table) => {
    const $table = $roster(table);
    let currentTeam = '';
    
    $table.find('tr').each((_, row) => {
      const $row = $roster(row);
      const rowText = $row.text();
      
      if (rowText.includes(homeTeam)) currentTeam = 'home';
      else if (rowText.includes(awayTeam)) currentTeam = 'away';
      
      if (currentTeam && (rowText.includes('捕') || rowText.includes('C'))) {
        const cells = $row.find('td, th');
        cells.each((_, cell) => {
          const cellText = $roster(cell).text().trim();
          if (cellText.match(/^[\\u3040-\\u30ff\\u4e00-\\u9faf]{2,}$/)) {
            if (currentTeam === 'home' && !homeBattery.some(p => p.includes(cellText))) {
              homeBattery.push(`${cellText} (捕手)`);
            } else if (currentTeam === 'away' && !awayBattery.some(p => p.includes(cellText))) {
              awayBattery.push(`${cellText} (捕手)`);
            }
          }
        });
      }
    });
  });
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
        
        console.log(`🔄 統合完了: ${lineup.matchup} (${lineup.date}) - H:${lineup.homeLineup.length}人, A:${lineup.awayLineup.length}人`);
      }
    });
    
    // 更新されたデータを保存
    fs.writeFileSync(existingDataPath, JSON.stringify(existingData, null, 2), 'utf-8');
    console.log(`💾 統合データ保存: ${existingDataPath}`);
    
  } catch (error) {
    console.error(`❌ データ統合エラー: ${error}`);
  }
}

// 8月の試合URLを取得（対象を絞って高品質データのみ取得）
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
    
    // 8月1-6日のみにフィルタ（高品質データが期待される期間）
    const filteredUrls = gameUrls.filter(url => {
      const dateMatch = url.match(/\/08(\d{2})\//);
      if (dateMatch) {
        const dateNum = parseInt(dateMatch[1]);
        console.log(`  📅 URL: ${url}, 日付: ${dateNum}`);
        return dateNum >= 1 && dateNum <= 6;
      }
      return false;
    });
    
    console.log(`🎯 フィルタ後対象: ${filteredUrls.length}試合（8月1-6日）`);
    
    return filteredUrls.sort((a, b) => {
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
  console.log('🚀 NPBスタメン・バッテリー情報取得開始（改善版）');
  
  // 8月の対象試合URLを取得
  const gameUrls = await getAugustGameUrls();
  
  if (gameUrls.length === 0) {
    console.log('❌ 試合URLが見つかりませんでした');
    return;
  }
  
  const allLineupData: LineupData[] = [];
  let processedCount = 0;
  let successCount = 0;
  
  console.log(`\n🎯 処理対象: ${gameUrls.length}試合`);
  
  // 各試合のスタメン情報を取得
  for (const gameUrl of gameUrls) {
    processedCount++;
    console.log(`\n[${processedCount}/${gameUrls.length}] ${gameUrl}`);
    
    const lineupData = await fetchLineupData(gameUrl);
    
    if (lineupData && (lineupData.homeLineup.length > 0 || lineupData.awayLineup.length > 0)) {
      allLineupData.push(lineupData);
      successCount++;
      console.log(`✅ 成功: ${lineupData.awayTeam} vs ${lineupData.homeTeam}`);
    } else {
      console.log(`⚠️  データ不足: スタメン情報が取得できませんでした`);
    }
    
    // レート制限（2.5秒間隔）
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  
  // スタメンデータを保存
  const lineupOutputPath = path.join(__dirname, '../data/npb_august_2025_lineups_improved.json');
  fs.writeFileSync(lineupOutputPath, JSON.stringify(allLineupData, null, 2), 'utf-8');
  console.log(`💾 改善版スタメンデータ保存: ${lineupOutputPath}`);
  
  // 既存の試合データと統合
  const existingDataPath = path.join(__dirname, '../data/converted_game_data.json');
  if (fs.existsSync(existingDataPath)) {
    integrateWithExistingData(allLineupData, existingDataPath);
  }
  
  console.log(`\n🎉 改善版スタメン・バッテリー情報取得完了!`);
  console.log(`📊 結果: ${successCount}/${processedCount}試合で有効なスタメン情報を取得`);
  
  // 詳細サマリー表示
  allLineupData.forEach(lineup => {
    console.log(`\n📅 ${lineup.date}: ${lineup.awayTeam} vs ${lineup.homeTeam}`);
    console.log(`   ホーム: ${lineup.homeLineup.length}人, アウェー: ${lineup.awayLineup.length}人`);
    console.log(`   バッテリー - H:${lineup.homeBattery.length}人, A:${lineup.awayBattery.length}人`);
    
    if (lineup.homeLineup.length > 0) {
      lineup.homeLineup.forEach(player => {
        console.log(`     H${player.battingOrder}: ${player.position} ${player.name}`);
      });
    }
    if (lineup.awayLineup.length > 0) {
      lineup.awayLineup.forEach(player => {
        console.log(`     A${player.battingOrder}: ${player.position} ${player.name}`);
      });
    }
  });
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchLineupData, integrateWithExistingData, extractStartingLineups };