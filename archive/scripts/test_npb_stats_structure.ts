import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

// NPB成績ページ構造の調査
async function analyzeStatsPages() {
  const urls = [
    'https://npb.jp/bis/2025/stats/cle_b.html',
    'https://npb.jp/bis/2025/stats/cle_p.html',
    'https://npb.jp/bis/2025/stats/ple_b.html',
    'https://npb.jp/bis/2025/stats/ple_p.html'
  ];
  
  for (const url of urls) {
    console.log(`\n🔍 ページ構造解析: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      console.log('📄 ページタイトル:', $('title').text());
      
      // テーブル構造の解析
      console.log(`📊 テーブル数: ${$('table').length}`);
      
      $('table').each((tableIndex, table) => {
        const $table = $(table);
        const rowCount = $table.find('tr').length;
        
        if (rowCount > 0) {
          console.log(`\n  テーブル${tableIndex + 1} (${rowCount}行):`);
          
          // ヘッダー行を表示
          const headerRow = $table.find('tr').first();
          const headerCells = headerRow.find('th, td');
          if (headerCells.length > 0) {
            const headers = headerCells.map((_, cell) => $(cell).text().trim()).get();
            console.log(`    ヘッダー: ${headers.join(' | ')}`);
          }
          
          // 最初の数行のデータを表示
          $table.find('tr').slice(1, 6).each((rowIndex, row) => {
            const $row = $(row);
            const cells = $row.find('td, th');
            if (cells.length > 0) {
              const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
              console.log(`    行${rowIndex + 2}: ${cellTexts.slice(0, 5).join(' | ')}${cellTexts.length > 5 ? '...' : ''}`);
            }
          });
        }
      });
      
      // 特定のキーワードを含むセクションを探す
      const keywords = ['打率', '防御率', '本塁打', '勝利', '巨人', 'DeNA', '阪神'];
      keywords.forEach(keyword => {
        const matches = $(`*:contains("${keyword}")`);
        if (matches.length > 0 && matches.length < 20) {
          console.log(`\n🔎 "${keyword}": ${matches.length}箇所で発見`);
        }
      });
      
      // HTMLサンプルを保存（デバッグ用）
      const filename = `debug_${url.split('/').pop()}.html`;
      fs.writeFileSync(filename, html, 'utf-8');
      console.log(`💾 HTMLサンプル保存: ${filename}`);
      
    } catch (error) {
      console.error(`❌ エラー: ${error}`);
    }
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

if (require.main === module) {
  analyzeStatsPages().catch(console.error);
}

export { analyzeStatsPages };