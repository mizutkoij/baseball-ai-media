import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testNPBFetch() {
  const url = 'https://npb.jp/scores/2025/0801/c-d-15/index.html';
  
  try {
    console.log(`🔍 テスト用データ取得: ${url}`);
    
    const response = await fetch(url);
    const html = await response.text();
    
    console.log('📄 HTMLサンプル (最初の500文字):');
    console.log(html.substring(0, 500));
    console.log('...\n');
    
    const $ = cheerio.load(html);
    
    // 基本的なメタ情報をテスト
    console.log('🏷️ ページタイトル:', $('title').text());
    console.log('📑 h1要素:', $('h1').text());
    console.log('📑 h2要素:', $('h2').text());
    
    // 試合情報パターンを探す
    const pageText = $.text();
    console.log('\n📝 ページテキストサンプル (最初の1000文字):');
    console.log(pageText.substring(0, 1000));
    
    // スコアパターンを探す
    const scorePatterns = [
      /(\d+)\s*[-‐−]\s*(\d+)/g,
      /(\d+)点.*?(\d+)点/g,
      /(\d+)-(\d+)/g,
      /スコア.*?(\d+).*?(\d+)/g
    ];
    
    console.log('\n🔍 スコアパターン検索結果:');
    scorePatterns.forEach((pattern, i) => {
      const matches = pageText.matchAll(pattern);
      const results = Array.from(matches).slice(0, 5); // 最初の5個まで
      console.log(`パターン${i + 1} (${pattern}): ${JSON.stringify(results.map(m => m[0]))}`);
    });
    
    // チーム名パターンを探す
    const teamPatterns = [
      /広島.*?カープ|広島東洋カープ/gi,
      /中日.*?ドラゴンズ/gi,
      /Giants|巨人/gi,
      /Swallows|ヤクルト/gi
    ];
    
    console.log('\n🔍 チーム名検索結果:');
    teamPatterns.forEach((pattern, i) => {
      const matches = pageText.match(pattern) || [];
      console.log(`チームパターン${i + 1}: ${JSON.stringify(matches.slice(0, 3))}`);
    });
    
    // 特定のCSSセレクターをテスト
    const selectors = [
      '.score',
      '.team-score',
      '.game-score',
      '.box-score',
      'table',
      '.result'
    ];
    
    console.log('\n🔍 CSS セレクター検索結果:');
    selectors.forEach(selector => {
      const elements = $(selector);
      console.log(`${selector}: ${elements.length}個の要素`, elements.length > 0 ? `"${elements.first().text().substring(0, 50)}"` : '');
    });
    
  } catch (error) {
    console.error('❌ テスト失敗:', error);
  }
}

testNPBFetch();