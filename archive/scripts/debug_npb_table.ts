#!/usr/bin/env npx tsx

/**
 * NPBテーブル構造のデバッグスクリプト
 */

import { JSDOM } from 'jsdom';

async function debugNPBTable(url: string) {
  try {
    console.log(`🔍 Debugging NPB table: ${url}`);
    
    const response = await fetch(url, {
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
    
    // 最初の10行を詳しく分析
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td, th');
      
      console.log(`\n--- Row ${i + 1} ---`);
      console.log(`  Cells: ${cells.length}`);
      
      cells.forEach((cell, cellIndex) => {
        const text = cell.textContent?.trim() || '';
        const classes = Array.from(cell.classList);
        console.log(`    Cell ${cellIndex + 1}: "${text}" (classes: [${classes.join(', ')}])`);
        
        // team1, team2, score1, score2のクラスがある場合は詳しく調査
        if (classes.some(c => ['team1', 'team2', 'score1', 'score2'].includes(c))) {
          console.log(`      🎯 Found relevant class: ${classes.join(', ')}`);
          
          // 子要素も調査
          const children = cell.querySelectorAll('*');
          children.forEach((child, childIndex) => {
            const childText = child.textContent?.trim() || '';
            const childClasses = Array.from(child.classList);
            console.log(`        Child ${childIndex + 1}: "${childText}" (${child.tagName.toLowerCase()}) [${childClasses.join(', ')}]`);
          });
        }
      });
      
      // 試合データらしい行があれば停止
      if (cells.length >= 3) {
        const firstCell = cells[0].textContent?.trim() || '';
        const secondCell = cells[1];
        
        if (firstCell.match(/^\d{1,2}\/\d{1,2}/)) { // 日付形式
          console.log(`\n🎯 Found potential game row (${i + 1})`);
          console.log(`  Date cell: "${firstCell}"`);
          
          // 第2列でteam要素を探す
          const team1 = secondCell.querySelector('.team1');
          const team2 = secondCell.querySelector('.team2');
          const score1 = secondCell.querySelector('.score1');
          const score2 = secondCell.querySelector('.score2');
          
          console.log(`  Team1 element: ${team1 ? `"${team1.textContent?.trim()}"` : 'not found'}`);
          console.log(`  Team2 element: ${team2 ? `"${team2.textContent?.trim()}"` : 'not found'}`);
          console.log(`  Score1 element: ${score1 ? `"${score1.textContent?.trim()}"` : 'not found'}`);
          console.log(`  Score2 element: ${score2 ? `"${score2.textContent?.trim()}"` : 'not found'}`);
          
          if (i > 3) break; // 十分な情報を得たら停止
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  await debugNPBTable('https://npb.jp/games/2017/schedule_04_detail.html');
}

if (require.main === module) {
  main().catch(console.error);
}