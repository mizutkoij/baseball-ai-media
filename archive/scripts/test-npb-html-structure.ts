// NPB公式サイトのHTML構造を調査するスクリプト
import * as cheerio from 'cheerio';

async function analyzeNPBHtmlStructure() {
  const boxScoreUrl = 'https://npb.jp/scores/2025/0821/db-c-20/box.html';
  
  try {
    console.log('🔍 NPB HTML構造解析中...');
    console.log(`URL: ${boxScoreUrl}\n`);
    
    const response = await fetch(boxScoreUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('📄 ページタイトル:');
    console.log($('title').text());
    console.log('');
    
    // チーム名を探す
    console.log('🏈 チーム名候補:');
    $('h1, h2, h3, .team, .team-name, [class*="team"]').each((i, element) => {
      const text = $(element).text().trim();
      if (text && text.length < 50) {
        console.log(`  ${$(element).prop('tagName')} (${$(element).attr('class') || 'no class'}): "${text}"`);
      }
    });
    console.log('');
    
    // テーブル構造を調査
    console.log('📊 テーブル構造:');
    $('table').each((i, table) => {
      const rows = $(table).find('tr').length;
      const firstRowCells = $(table).find('tr').first().find('th, td').length;
      const tableClass = $(table).attr('class') || 'no class';
      const tableId = $(table).attr('id') || 'no id';
      
      console.log(`  Table ${i + 1}: class="${tableClass}", id="${tableId}"`);
      console.log(`    行数: ${rows}, 最初行のセル数: ${firstRowCells}`);
      
      // 最初の3行を表示
      $(table).find('tr').slice(0, 3).each((rowIndex, row) => {
        const cells = $(row).find('th, td');
        const cellTexts = cells.map((cellIndex, cell) => $(cell).text().trim()).get().slice(0, 5);
        console.log(`    Row ${rowIndex + 1}: [${cellTexts.join(', ')}...]`);
      });
      console.log('');
    });
    
    // その他の重要な要素
    console.log('🏷️ その他の重要な要素:');
    
    // スコア関連
    $('[class*="score"], [id*="score"]').each((i, element) => {
      console.log(`  Score element: ${$(element).prop('tagName')} (${$(element).attr('class')}) = "${$(element).text().trim()}"`);
    });
    
    // 選手名候補
    const potentialPlayerNames: string[] = [];
    $('td, th').each((i, cell) => {
      const text = $(cell).text().trim();
      // 日本人名らしいパターン（ひらがな、カタカナ、漢字を含む短い文字列）
      if (text.match(/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]{2,6}$/) && text.length <= 6) {
        potentialPlayerNames.push(text);
      }
    });
    
    console.log('\n👤 選手名候補 (最初の10個):');
    potentialPlayerNames.slice(0, 10).forEach(name => {
      console.log(`  "${name}"`);
    });
    
    // 数字のパターン（打数、得点など）
    console.log('\n🔢 数値データのパターン:');
    const numericCells: string[] = [];
    $('td').each((i, cell) => {
      const text = $(cell).text().trim();
      if (text.match(/^\d{1,2}$/) || text.match(/^\d+\/\d+$/) || text.match(/^\d+\.\d+$/)) {
        numericCells.push(text);
      }
    });
    
    console.log(`  数値セル例: [${numericCells.slice(0, 15).join(', ')}...]`);
    
    // HTML構造の深度分析
    console.log('\n🌳 HTML構造の詳細:');
    console.log(`  全テーブル数: ${$('table').length}`);
    console.log(`  全tr要素数: ${$('tr').length}`);
    console.log(`  全td要素数: ${$('td').length}`);
    console.log(`  全th要素数: ${$('th').length}`);
    
    // 一部のHTMLを保存して詳細分析用に
    const sampleHtml = $('body').html()?.substring(0, 5000) || '';
    console.log('\n📝 HTMLサンプル（最初の500文字）:');
    console.log(sampleHtml.substring(0, 500));
    
  } catch (error) {
    console.error('❌ 分析エラー:', error);
  }
}

analyzeNPBHtmlStructure();