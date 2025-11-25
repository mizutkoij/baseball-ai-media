#!/usr/bin/env node
import * as cheerio from 'cheerio';
import axios from 'axios';

class NPBHTMLDebugger {
  async debugNPBPage(url: string): Promise<void> {
    try {
      console.log(`🔍 Debugging NPB page: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      
      console.log(`📄 Page loaded: ${response.data.length} characters`);
      
      // テーブル要素の探索
      console.log('\n📊 Table Analysis:');
      $('table').each((index, table) => {
        const tableText = $(table).text();
        const rows = $(table).find('tr');
        
        console.log(`\nTable ${index + 1}:`);
        console.log(`  - Rows: ${rows.length}`);
        console.log(`  - Text sample: ${tableText.substring(0, 100)}...`);
        
        // 各行を分析
        if (rows.length > 0) {
          console.log(`  - First row cells: ${$(rows[0]).find('th, td').length}`);
          if (rows.length > 1) {
            console.log(`  - Second row cells: ${$(rows[1]).find('th, td').length}`);
          }
          
          // ヘッダー行を確認
          const headerRow = $(rows[0]);
          const headers = headerRow.find('th, td');
          console.log(`  - Headers (${headers.length}):`);
          headers.each((i, header) => {
            const headerText = $(header).text().trim();
            if (headerText) console.log(`    ${i + 1}. ${headerText}`);
          });
          
          // データ行サンプル
          if (rows.length > 1) {
            console.log(`  - Sample data row:`);
            const dataRow = $(rows[1]);
            const cells = dataRow.find('td');
            cells.each((i, cell) => {
              const cellText = $(cell).text().trim();
              if (cellText && i < 10) console.log(`    ${i + 1}. ${cellText}`);
            });
          }
        }
      });
      
      // 特定のキーワードを含むテーブルの検索
      console.log('\n🎯 Baseball Stats Tables:');
      $('table').each((index, table) => {
        const tableText = $(table).text();
        if (tableText.includes('打率') || tableText.includes('安打') || tableText.includes('本塁打')) {
          console.log(`\n⚾ Baseball table found (Table ${index + 1}):`);
          console.log(`  - Contains batting stats keywords`);
          
          const rows = $(table).find('tr');
          console.log(`  - Total rows: ${rows.length}`);
          
          // 各行の詳細を確認
          rows.each((rowIndex, row) => {
            if (rowIndex < 3) { // 最初の3行のみ
              const cells = $(row).find('th, td');
              console.log(`  - Row ${rowIndex + 1} (${cells.length} cells):`);
              cells.each((cellIndex, cell) => {
                const cellText = $(cell).text().trim();
                if (cellText && cellIndex < 8) {
                  console.log(`    [${cellIndex + 1}] ${cellText}`);
                }
              });
            }
          });
        }
      });
      
      // div要素で表現されたテーブルの確認
      console.log('\n📋 Checking for div-based tables:');
      $('div').each((index, div) => {
        const divText = $(div).text();
        if (divText.includes('打率') && divText.includes('安打') && divText.length < 1000) {
          console.log(`\nPossible div-based table found:`);
          console.log(`  - Content: ${divText.substring(0, 200)}...`);
          console.log(`  - Classes: ${$(div).attr('class') || 'none'}`);
          console.log(`  - ID: ${$(div).attr('id') || 'none'}`);
        }
      });
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
    }
  }
}

// デバッグ実行
if (require.main === module) {
  const htmlDebugger = new NPBHTMLDebugger();
  htmlDebugger.debugNPBPage('https://npb.jp/bis/2024/stats/bat_c.html').catch(console.error);
}

export default NPBHTMLDebugger;