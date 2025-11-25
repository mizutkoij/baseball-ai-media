import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testBoxPage() {
  const url = 'https://npb.jp/scores/2025/0801/c-d-15/box.html';
  
  try {
    console.log(`🔍 ボックススコアページ取得: ${url}`);
    
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('🏷️ ページタイトル:', $('title').text());
    
    // テーブルを探す
    $('table').each((i, table) => {
      console.log(`\n📊 テーブル ${i + 1}:`);
      console.log('テーブル内容 (最初の200文字):', $(table).text().substring(0, 200));
      
      // テーブル内の数字パターンを探す
      const tableText = $(table).text();
      const scorePattern = /\b\d{1,2}\b/g;
      const numbers = tableText.match(scorePattern) || [];
      console.log('見つかった数字:', numbers.slice(0, 15));
    });
    
    // スコア関連のクラスを探す
    const scoreClasses = ['.score', '.runs', '.hit', '.error', '.total'];
    scoreClasses.forEach(cls => {
      const elements = $(cls);
      if (elements.length > 0) {
        console.log(`\n${cls}: ${elements.length}個`);
        elements.each((i, el) => {
          if (i < 5) console.log(`  ${i + 1}: "${$(el).text()}"`);
        });
      }
    });
    
    // 全てのtd要素の内容をチェック
    console.log('\n📋 全てのTD要素:');
    $('td').each((i, td) => {
      const text = $(td).text().trim();
      if (text && /^\d+$/.test(text) && i < 20) {
        console.log(`TD ${i + 1}: "${text}"`);
      }
    });
    
  } catch (error) {
    console.error('❌ テスト失敗:', error);
  }
}

testBoxPage();