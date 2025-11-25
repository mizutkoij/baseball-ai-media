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

// 逆引きマッピング
const TEAM_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_CODE_MAPPING).map(([code, team]) => [team, code])
);

// 3月のデータを取得
async function fetchMarchData() {
  console.log('🚀 2025年3月NPB試合データ取得開始');
  
  const scheduleUrl = 'https://npb.jp/games/2025/schedule_03_detail.html';
  console.log(`📅 3月スケジュール取得: ${scheduleUrl}`);
  
  try {
    const response = await fetch(scheduleUrl);
    const html = await response.text();
    
    // 試合URLパターンを抽出
    const urlPattern = /href="(\/scores\/2025\/\d{4}\/[a-z]{1,3}-[a-z]{1,3}-\d{1,2}\/?)"/g;
    const matches = html.matchAll(urlPattern);
    
    const gameUrls = [...new Set(Array.from(matches, match => match[1]))]; // 重複除去
    console.log(`🎯 発見された試合数: ${gameUrls.length}`);
    
    if (gameUrls.length === 0) {
      console.log('⚠️  3月の試合URLが見つかりませんでした');
      console.log('HTMLサンプル (最初の500文字):');
      console.log(html.substring(0, 500));
      return;
    }
    
    console.log('📋 発見されたURL (最初の5個):');
    gameUrls.slice(0, 5).forEach((url, i) => {
      console.log(`  ${i + 1}: ${url}`);
    });
    
    console.log('\n🔄 実際のデータ取得は準備完了です');
    console.log('全て取得する場合は fetch_all_npb_data.ts を実行してください');
    
    // サンプル取得（最初の2試合のみ）
    console.log('\n🧪 サンプルデータ取得 (最初の2試合):');
    
    const sampleData: Record<string, any> = {};
    
    for (let i = 0; i < Math.min(2, gameUrls.length); i++) {
      const gameUrl = gameUrls[i];
      console.log(`\n[${i + 1}/${Math.min(2, gameUrls.length)}] ${gameUrl}`);
      
      try {
        const gameData = await fetchSingleGame(gameUrl);
        if (gameData) {
          if (!sampleData[gameData.date]) {
            sampleData[gameData.date] = {};
          }
          sampleData[gameData.date][gameData.matchup] = gameData;
        }
      } catch (error) {
        console.error(`❌ エラー: ${error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // サンプル結果を保存
    const samplePath = path.join(__dirname, '../data/npb_march_sample.json');
    fs.writeFileSync(samplePath, JSON.stringify(sampleData, null, 2), 'utf-8');
    console.log(`\n💾 サンプルデータ保存: ${samplePath}`);
    
  } catch (error) {
    console.error(`❌ スケジュール取得エラー: ${error}`);
  }
}

async function fetchSingleGame(gameUrl: string): Promise<any | null> {
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
  
  console.log(`⚾ 取得中: ${awayTeam} vs ${homeTeam}`);
  
  try {
    const boxUrl = baseUrl + gameUrl + 'box.html';
    const boxResponse = await fetch(boxUrl);
    
    if (!boxResponse.ok) {
      console.warn(`⚠️  ボックススコア取得失敗: ${boxResponse.status}`);
      return null;
    }
    
    const boxHtml = await boxResponse.text();
    const $box = cheerio.load(boxHtml);
    
    // 基本情報
    const year = '2025';
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const formattedDate = `${year}-${month}-${day}`;
    
    // ページテキストから情報抽出
    const pageText = $box.text();
    const timeMatch = pageText.match(/開始\s*(\d{1,2}:\d{2})/);
    const endTimeMatch = pageText.match(/終了\s*(\d{1,2}:\d{2})/);
    const attendanceMatch = pageText.match(/入場者\s*([0-9,]+人)/);
    
    // 簡単なスコア抽出
    let homeScore = 0, awayScore = 0;
    const scoreMatches = pageText.match(/(\d+)\s*[-‐−]\s*(\d+)/);
    if (scoreMatches) {
      awayScore = parseInt(scoreMatches[1]) || 0;
      homeScore = parseInt(scoreMatches[2]) || 0;
    }
    
    const gameData = {
      date: formattedDate,
      matchup: `${TEAM_TO_CODE[awayTeam]?.toUpperCase()}-${TEAM_TO_CODE[homeTeam]?.toUpperCase()}`,
      homeTeam,
      awayTeam,
      venue: '球場情報取得中',
      time: timeMatch ? timeMatch[1] : '不明',
      endTime: endTimeMatch ? endTimeMatch[1] : undefined,
      attendance: attendanceMatch ? attendanceMatch[1] : undefined,
      homeScore,
      awayScore,
      status: 'finished',
      league: (['広島', '中日', '巨人', 'ヤクルト', '阪神', 'DeNA'].includes(homeTeam) && 
                ['広島', '中日', '巨人', 'ヤクルト', '阪神', 'DeNA'].includes(awayTeam)) ? 'central' : 'pacific'
    };
    
    console.log(`✅ 完了: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`);
    return gameData;
    
  } catch (error) {
    console.error(`❌ 試合データ取得エラー: ${error}`);
    return null;
  }
}

fetchMarchData();