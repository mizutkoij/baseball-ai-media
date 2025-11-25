import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// 2025年のNPB成績ページURLを確認
async function test2025StatsUrls() {
  console.log('🔍 2025年NPB成績ページURLの確認...');
  
  // 探索で発見されたパターンを基にテスト
  const testUrls = [
    // セントラルリーグ
    'https://npb.jp/bis/2025/stats/bat_c.html', // 個人打撃 セントラル
    'https://npb.jp/bis/2025/stats/pit_c.html', // 個人投手 セントラル
    
    // パシフィックリーグ  
    'https://npb.jp/bis/2025/stats/bat_p.html', // 個人打撃 パシフィック
    'https://npb.jp/bis/2025/stats/pit_p.html', // 個人投手 パシフィック
    
    // その他可能性のあるURL
    'https://npb.jp/bis/2025/stats/',
    'https://npb.jp/bis/2025/stats/std_c.html',
    'https://npb.jp/bis/2025/stats/std_p.html',
    
    // リーダーボード系
    'https://npb.jp/bis/2025/stats/lb_avg_c.html',
    'https://npb.jp/bis/2025/stats/lb_avg_p.html'
  ];
  
  for (const url of testUrls) {
    try {
      console.log(`\n🔗 テスト中: ${url}`);
      const response = await fetch(url);
      
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        console.log(`✅ アクセス成功 (${response.status})`);
        console.log(`📄 タイトル: ${$('title').text()}`);
        
        // テーブル数をチェック
        const tableCount = $('table').length;
        console.log(`📊 テーブル数: ${tableCount}`);
        
        if (tableCount > 0) {
          // 最初のテーブルの構造を簡単にチェック
          const firstTable = $('table').first();
          const rows = firstTable.find('tr');
          console.log(`   最初のテーブル: ${rows.length}行`);
          
          if (rows.length > 0) {
            const headerCells = rows.first().find('th, td');
            if (headerCells.length > 0) {
              const headers = headerCells.map((_, cell) => $(cell).text().trim()).get();
              console.log(`   ヘッダー: ${headers.slice(0, 5).join(' | ')}${headers.length > 5 ? '...' : ''}`);
            }
          }
          
          // チーム名や選手名のサンプルをチェック
          const teamKeywords = ['巨人', 'DeNA', '阪神', 'ソフトバンク', '楽天'];
          teamKeywords.forEach(team => {
            const matches = $(`*:contains("${team}")`);
            if (matches.length > 0) {
              console.log(`   "${team}": ${matches.length}箇所で発見`);
            }
          });
        }
        
      } else {
        console.log(`❌ アクセス失敗 (${response.status}): ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ エラー: ${error.message}`);
    }
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 実際に使えそうなURLがあったら詳細調査
  console.log('\n🔍 有望なURLの詳細調査...');
  const detailUrl = 'https://npb.jp/bis/2025/stats/bat_c.html';
  
  try {
    const response = await fetch(detailUrl);
    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);
      
      console.log(`\n📊 詳細: ${detailUrl}`);
      
      $('table').each((tableIndex, table) => {
        const $table = $(table);
        const rows = $table.find('tr');
        
        if (rows.length > 5) { // 実データがありそうなテーブル
          console.log(`\nテーブル${tableIndex + 1} (${rows.length}行):`);
          
          // ヘッダー
          const headerRow = rows.first();
          const headerCells = headerRow.find('th, td');
          if (headerCells.length > 0) {
            const headers = headerCells.map((_, cell) => $(cell).text().trim()).get();
            console.log(`  ヘッダー: ${headers.join(' | ')}`);
          }
          
          // 最初の数行のデータ
          rows.slice(1, 6).each((rowIndex, row) => {
            const $row = $(row);
            const cells = $row.find('td, th');
            if (cells.length > 0) {
              const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
              console.log(`  行${rowIndex + 2}: ${cellTexts.join(' | ')}`);
            }
          });
          
          if (rows.length > 10) {
            console.log(`  ... (残り${rows.length - 6}行)`);
          }
        }
      });
    }
  } catch (error) {
    console.log(`❌ 詳細調査エラー: ${error.message}`);
  }
}

if (require.main === module) {
  test2025StatsUrls().catch(console.error);
}

export { test2025StatsUrls };