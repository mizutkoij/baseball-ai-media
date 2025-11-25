#!/usr/bin/env npx tsx

/**
 * 単一のゲーム行をテストするスクリプト
 */

import { JSDOM } from 'jsdom';

async function testSingleGameParse() {
  try {
    console.log('🔍 Testing single game row parsing...');
    
    const response = await fetch('https://npb.jp/games/2017/schedule_04_detail.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NPB-Analytics/1.0)'
      }
    });
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const table = document.querySelector('table');
    if (!table) {
      console.log('❌ No table found');
      return;
    }
    
    const rows = table.querySelectorAll('tr');
    console.log(`📊 Found ${rows.length} rows`);
    
    // 最初のゲームらしい行（2行目）をテスト
    const testRow = rows[1]; // 0はヘッダー、1は最初の実データ行
    const cells = testRow.querySelectorAll('td');
    
    console.log(`\n🎯 Testing row 2 (${cells.length} cells):`);
    
    cells.forEach((cell, index) => {
      const text = cell.textContent?.trim() || '';
      const classes = Array.from(cell.classList);
      console.log(`  Cell ${index}: "${text.substring(0, 50)}..." [${classes.join(', ')}]`);
      
      // team1, team2を探す
      const team1 = cell.querySelector('.team1');
      const team2 = cell.querySelector('.team2');
      const score1 = cell.querySelector('.score1');
      const score2 = cell.querySelector('.score2');
      
      if (team1 || team2 || score1 || score2) {
        console.log(`    🎯 Found elements:`);
        if (team1) console.log(`      team1: "${team1.textContent?.trim()}"`);
        if (team2) console.log(`      team2: "${team2.textContent?.trim()}"`);
        if (score1) console.log(`      score1: "${score1.textContent?.trim()}"`);
        if (score2) console.log(`      score2: "${score2.textContent?.trim()}"`);
      }
    });
    
    // チーム名マッピングもテスト
    const TEAM_NAME_MAP: Record<string, string> = {
      '巨人': 'YG',
      '阪神': 'T',
      '中日': 'D', 
      '広島': 'C',
      'ヤクルト': 'S',
      'ＤｅＮＡ': 'DB',
      'DeNA': 'DB',
      'ソフトバンク': 'H',
      '日本ハム': 'F',
      '西武': 'L',
      'ロッテ': 'M',
      'オリックス': 'B',
      '楽天': 'E'
    };
    
    function normalizeTeamName(teamName: string): string {
      const cleaned = teamName.replace(/\s+/g, '').trim();
      return TEAM_NAME_MAP[cleaned] || cleaned;
    }
    
    // セル1でチーム情報を検索
    const matchCell = cells[1];
    if (matchCell) {
      const team1 = matchCell.querySelector('.team1');
      const team2 = matchCell.querySelector('.team2');
      
      if (team1 && team2) {
        const team1Name = team1.textContent?.trim() || '';
        const team2Name = team2.textContent?.trim() || '';
        
        console.log(`\n✅ Successfully found teams:`);
        console.log(`  Raw: "${team1Name}" vs "${team2Name}"`);
        console.log(`  Normalized: "${normalizeTeamName(team1Name)}" vs "${normalizeTeamName(team2Name)}"`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  testSingleGameParse().catch(console.error);
}