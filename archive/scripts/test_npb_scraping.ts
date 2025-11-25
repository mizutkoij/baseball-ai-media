#!/usr/bin/env npx tsx

/**
 * NPB公式サイトのHTML構造を分析するテストスクリプト
 */

import { JSDOM } from 'jsdom';

async function fetchAndAnalyzeNPBPage(url: string) {
  try {
    console.log(`🔍 Analyzing NPB page: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NPB-Analytics/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    console.log(`📄 Page title: ${document.title}`);
    
    // 主要なセレクターを試してみる
    const selectors = [
      'table',
      '.schedule',
      '.game',
      '.match',
      'tr',
      'td',
      '.team',
      '.score',
      '[class*="schedule"]',
      '[class*="game"]',
      '[class*="match"]',
      '[class*="team"]',
      '[id*="schedule"]',
      '[id*="game"]'
    ];
    
    console.log('\n🔍 Element analysis:');
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`  ${selector}: ${elements.length} elements found`);
      }
    });
    
    // テーブルの構造を詳しく分析
    const tables = document.querySelectorAll('table');
    console.log(`\n📊 Found ${tables.length} tables`);
    
    tables.forEach((table, index) => {
      const rows = table.querySelectorAll('tr');
      console.log(`  Table ${index + 1}: ${rows.length} rows`);
      
      if (rows.length > 0) {
        const firstRow = rows[0];
        const cells = firstRow.querySelectorAll('td, th');
        console.log(`    First row: ${cells.length} cells`);
        
        if (cells.length > 0) {
          const cellTexts = Array.from(cells)
            .slice(0, 5) // 最初の5個だけ
            .map(cell => cell.textContent?.trim() || '')
            .filter(text => text.length > 0);
          console.log(`    Cell texts: [${cellTexts.join(', ')}]`);
        }
      }
    });
    
    // スケジュール関連のクラス名を探す
    const allElements = document.querySelectorAll('*[class]');
    const classNames = new Set<string>();
    
    allElements.forEach(el => {
      const classes = el.className.split(' ');
      classes.forEach(cls => {
        if (cls && (
          cls.includes('schedule') || 
          cls.includes('game') || 
          cls.includes('match') ||
          cls.includes('team') ||
          cls.includes('score')
        )) {
          classNames.add(cls);
        }
      });
    });
    
    console.log('\n🏷️  Relevant class names:');
    Array.from(classNames).sort().forEach(className => {
      const count = document.querySelectorAll(`.${className}`).length;
      console.log(`  .${className}: ${count} elements`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  // 2017年4月のページを分析
  await fetchAndAnalyzeNPBPage('https://npb.jp/games/2017/schedule_04_detail.html');
  
  console.log('\n' + '='.repeat(50));
  
  // 2025年の現在のページも参照として分析
  await fetchAndAnalyzeNPBPage('https://npb.jp/games/2025/schedule_08_detail.html');
}

if (require.main === module) {
  main().catch(console.error);
}