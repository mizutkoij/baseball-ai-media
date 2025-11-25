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

// 日付範囲で試合URLを生成
function generateDateUrls(startDate: string, endDate: string): string[] {
  const urls: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '').slice(4); // "0328"
    
    // 各チームの組み合わせを試す（シーズン中なら必ず6試合/日）
    const teamCombos = [
      ['g', 's'], ['db', 'd'], ['c', 't'], ['l', 'f'], ['b', 'e'], ['h', 'm']
    ];
    
    teamCombos.forEach(([away, home], index) => {
      urls.push(`/scores/2025/${dateStr}/${away}-${home}-${index + 1}/`);
      urls.push(`/scores/2025/${dateStr}/${home}-${away}-${index + 1}/`);
    });
  }
  
  return urls;
}

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
    
    // スコアテーブルを探す
    $box('table').each((tableIndex, table) => {
      const $table = $box(table);
      const tableText = $table.text();
      
      if (tableText.includes('1') && tableText.includes('9') && (tableText.includes('計') || tableText.includes('R'))) {
        $table.find('tr').each((rowIndex, row) => {
          const cells = $box(row).find('td');
          
          if (cells.length >= 12) {
            const values: number[] = [];
            
            cells.each((cellIndex, cell) => {
              const text = $box(cell).text().trim();
              
              if (cellIndex >= 1 && cellIndex <= 9) {
                values.push(text === 'x' || text === 'X' ? 0 : (parseInt(text) || 0));
              } else if (cellIndex === 10) {
                const score = parseInt(text) || 0;
                if (rowIndex === 1) awayScore = score;
                else if (rowIndex === 2) homeScore = score;
              } else if (cellIndex === 11) {
                const hits = parseInt(text) || 0;
                if (rowIndex === 1) awayHits = hits;
                else if (rowIndex === 2) homeHits = hits;
              } else if (cellIndex === 12) {
                const errors = parseInt(text) || 0;
                if (rowIndex === 1) awayErrors = errors;
                else if (rowIndex === 2) homeErrors = errors;
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
        
        if (homeScore > 0 || awayScore > 0) return false;
      }
    });
    
    // 試合詳細情報
    const pageText = $box.text();
    const timeMatch = pageText.match(/開始\s*(\d{1,2}:\d{2})/);
    const endTimeMatch = pageText.match(/終了\s*(\d{1,2}:\d{2})/);
    const gameTimeMatch = pageText.match(/試合時間\s*([^◇◆\n]+)/);
    const attendanceMatch = pageText.match(/入場者\s*([0-9,]+人)/);
    
    // 投手情報
    const winningPitcherMatch = pageText.match(/【勝投手】\s*([^【\n]+)/);
    const losingPitcherMatch = pageText.match(/【敗投手】\s*([^【\n]+)/);
    const savePitcherMatch = pageText.match(/【セーブ】\s*([^【\n]+)/);
    
    // 球場判定
    const venuePatterns = [
      { name: 'マツダスタジアム', pattern: /マツダ|MAZDA/ },
      { name: '東京ドーム', pattern: /東京ドーム/ },
      { name: '横浜スタジアム', pattern: /横浜|ハマスタ/ },
      { name: '神宮球場', pattern: /神宮|ヤクルト/ },
      { name: '甲子園', pattern: /甲子園|阪神/ },
      { name: 'バンテリンドーム', pattern: /バンテリン|ナゴヤ/ },
      { name: 'ZOZOマリンスタジアム', pattern: /ZOZO|マリン/ },
      { name: '京セラドーム大阪', pattern: /京セラ|大阪ドーム/ },
      { name: 'エスコンフィールドHOKKAIDO', pattern: /エスコン|札幌/ },
      { name: '楽天モバイルパーク宮城', pattern: /楽天|仙台/ },
      { name: 'ベルーナドーム', pattern: /ベルーナ|西武/ },
      { name: 'みずほPayPayドーム', pattern: /みずほ|PayPay/ }
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
      homeScore, awayScore, status: 'finished', league,
      inningScores: inningScores.away.length > 0 ? inningScores : undefined,
      homeHits, awayHits, homeErrors, awayErrors,
      winningPitcher: winningPitcherMatch ? winningPitcherMatch[1].trim() : undefined,
      losingPitcher: losingPitcherMatch ? losingPitcherMatch[1].trim() : undefined,
      savePitcher: savePitcherMatch ? savePitcherMatch[1].trim() : undefined
    };
    
    return gameData;
    
  } catch (error) {
    return null;
  }
}

// メイン関数
async function main() {
  console.log('🚀 2025年NPB全シーズンデータ取得開始');
  
  // シーズン期間（3月28日開幕〜8月31日まで）
  const allGameData: Record<string, Record<string, GameData>> = {};
  
  // 開幕戦から順番に取得（テスト用に最初の3日間）
  const testDates = ['2025-03-28', '2025-03-29', '2025-03-30'];
  
  let totalProcessed = 0;
  let totalSuccessful = 0;
  
  for (const testDate of testDates) {
    console.log(`\n📅 ${testDate}の試合取得開始`);
    
    const dateStr = testDate.replace(/-/g, '').slice(4); // "0328"
    
    // 既知の開幕戦組み合わせ
    const openingGames = [
      `g-s`, `db-d`, `c-t`, `l-f`, `b-e`, `h-m`
    ];
    
    for (let i = 0; i < openingGames.length; i++) {
      const matchCode = openingGames[i];
      const gameUrl = `/scores/2025/${dateStr}/${matchCode}-${i + 1}/`;
      
      totalProcessed++;
      console.log(`[${totalProcessed}] ${gameUrl}`);
      
      const gameData = await fetchGameData(gameUrl);
      
      if (gameData) {
        if (!allGameData[gameData.date]) {
          allGameData[gameData.date] = {};
        }
        allGameData[gameData.date][gameData.matchup] = gameData;
        totalSuccessful++;
        
        console.log(`✅ ${gameData.awayTeam} ${gameData.awayScore} - ${gameData.homeScore} ${gameData.homeTeam} @${gameData.venue}`);
      } else {
        console.log(`❌ 取得失敗`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 結果保存
  const outputPath = path.join(__dirname, '../data/npb_season_start_2025.json');
  fs.writeFileSync(outputPath, JSON.stringify(allGameData, null, 2), 'utf-8');
  
  console.log(`\n🎉 開幕戦データ取得完了!`);
  console.log(`📊 結果: ${totalSuccessful}/${totalProcessed}試合取得成功`);
  console.log(`📁 保存先: ${outputPath}`);
  
  // サマリー表示
  Object.entries(allGameData).forEach(([date, games]) => {
    console.log(`\n📅 ${date}:`);
    Object.values(games).forEach(game => {
      console.log(`  ⚾ ${game.awayTeam} ${game.awayScore} - ${game.homeScore} ${game.homeTeam}`);
      if (game.inningScores) {
        console.log(`     イニング: ${game.inningScores.away.join('-')} vs ${game.inningScores.home.join('-')}`);
      }
    });
  });
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchGameData };