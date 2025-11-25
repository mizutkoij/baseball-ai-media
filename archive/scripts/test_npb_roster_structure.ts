import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

// 実際のNPBページ構造を調査
async function analyzeRosterPage() {
  // 1つの試合のroster.htmlを詳細調査
  const testUrl = 'https://npb.jp/scores/2025/0801/g-db-14/roster.html';
  console.log(`🔍 ページ構造解析: ${testUrl}`);
  
  try {
    const response = await fetch(testUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('\n📄 ページタイトル:', $('title').text());
    
    // HTML構造の概要
    console.log('\n🏗️  基本構造:');
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const heading = $(el);
      console.log(`  ${heading.prop('tagName')}: ${heading.text().trim()}`);
    });
    
    // テーブル構造の解析
    console.log(`\n📊 テーブル数: ${$('table').length}`);
    $('table').each((tableIndex, table) => {
      const $table = $(table);
      const rowCount = $table.find('tr').length;
      const tableText = $table.text().replace(/\s+/g, ' ').trim().substring(0, 200);
      
      console.log(`\n  テーブル${tableIndex + 1}:`);
      console.log(`    行数: ${rowCount}`);
      console.log(`    内容(先頭200文字): ${tableText}...`);
      
      if (rowCount <= 20) { // 小さなテーブルは詳細表示
        $table.find('tr').each((rowIndex, row) => {
          const $row = $(row);
          const cells = $row.find('td, th');
          if (cells.length > 0) {
            const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
            console.log(`      行${rowIndex + 1}(${cells.length}セル): ${cellTexts.join(' | ')}`);
          }
        });
      }
    });
    
    // 特定のキーワードを含むセクションを探す
    console.log('\n🔎 キーワード検索:');
    const keywords = ['スタメン', '先発', '打順', '選手', 'lineup', '巨人', 'DeNA', '1番', '投手'];
    keywords.forEach(keyword => {
      const matches = $(`*:contains("${keyword}")`);
      console.log(`  "${keyword}": ${matches.length}箇所で発見`);
      
      if (matches.length > 0 && matches.length < 10) {
        matches.each((_, el) => {
          const element = $(el);
          if (element.children().length === 0) { // テキストノードのみ
            console.log(`    - ${element.text().trim().substring(0, 100)}`);
          }
        });
      }
    });
    
    // HTMLをファイルに保存（デバッグ用）
    fs.writeFileSync('debug_roster_page.html', html, 'utf-8');
    console.log('\n💾 HTMLファイル保存: debug_roster_page.html');
    
    // 全テキスト内容も保存
    fs.writeFileSync('debug_roster_text.txt', $.text(), 'utf-8');
    console.log('💾 テキスト内容保存: debug_roster_text.txt');
    
  } catch (error) {
    console.error(`❌ エラー: ${error}`);
  }
}

if (require.main === module) {
  analyzeRosterPage().catch(console.error);
}

export { analyzeRosterPage };