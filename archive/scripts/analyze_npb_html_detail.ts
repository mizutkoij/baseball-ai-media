import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeNPBHTMLDetail() {
  console.log('🔍 NPB HTMLから取得可能な詳細データの調査');
  
  // テスト用ゲーム（8月1日 巨人 vs DeNA）
  const gameUrl = '/scores/2025/0801/g-db-14/';
  const baseUrl = 'https://npb.jp';
  
  console.log(`📊 調査対象: ${baseUrl + gameUrl}`);
  
  // 各種ページを調査
  const pages = [
    { name: 'メイン', url: gameUrl + 'index.html' },
    { name: 'BOX', url: gameUrl + 'box.html' },
    { name: '実況', url: gameUrl + 'playbyplay.html' },
    { name: 'ロースター', url: gameUrl + 'roster.html' }
  ];
  
  for (const page of pages) {
    console.log(`\n🔍 ${page.name}ページ解析: ${baseUrl + page.url}`);
    
    try {
      const response = await fetch(baseUrl + page.url);
      
      if (!response.ok) {
        console.log(`❌ ${page.name}: ${response.status} - ページが存在しない可能性`);
        continue;
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      console.log(`📄 ${page.name}ページ構造:`);
      console.log(`   タイトル: ${$('title').text()}`);
      console.log(`   テーブル数: ${$('table').length}`);
      
      // テーブル詳細分析
      $('table').each((tableIndex, table) => {
        const $table = $(table);
        const rows = $table.find('tr');
        
        if (rows.length > 2) { // 実データがありそうなテーブル
          console.log(`\n   📊 テーブル ${tableIndex + 1} (${rows.length}行):`);
          
          // ヘッダー分析
          const headerRow = rows.first();
          const headerCells = headerRow.find('th, td');
          if (headerCells.length > 0) {
            const headers = headerCells.map((_, cell) => $(cell).text().trim()).get();
            console.log(`      ヘッダー: ${headers.slice(0, 10).join(' | ')}${headers.length > 10 ? '...' : ''}`);
          }
          
          // サンプルデータ行
          const dataRows = rows.slice(1, 4); // 最初の3行のデータ
          dataRows.each((rowIndex, row) => {
            const $row = $(row);
            const cells = $row.find('td, th');
            if (cells.length > 0) {
              const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
              console.log(`      行${rowIndex + 2}: ${cellTexts.slice(0, 8).join(' | ')}${cellTexts.length > 8 ? '...' : ''}`);
            }
          });
          
          if (rows.length > 6) {
            console.log(`      ... (残り${rows.length - 4}行)`);
          }
        }
      });
      
      // 特定キーワードの検索
      const keywords = [
        '打数', '安打', '打点', '本塁打', '盗塁', '四球', '三振', '失策',
        '投球回', '失点', '自責点', '防御率', '奪三振',
        '勝利投手', '敗戦投手', 'セーブ', 'ホールド',
        'スターティングメンバー', 'バッテリー'
      ];
      
      console.log(`\n   🔍 キーワード検索結果:`);
      keywords.forEach(keyword => {
        const matches = $(`*:contains("${keyword}")`);
        if (matches.length > 0) {
          console.log(`      "${keyword}": ${matches.length}箇所で発見`);
        }
      });
      
      // 選手名らしき要素の検索
      const playerNamePattern = /[一-龯]{2,4}/; // 漢字2-4文字の日本人名パターン
      const possiblePlayerNames: string[] = [];
      
      $('td, th').each((_, element) => {
        const text = $(element).text().trim();
        if (playerNamePattern.test(text) && text.length >= 2 && text.length <= 6) {
          possiblePlayerNames.push(text);
        }
      });
      
      const uniqueNames = [...new Set(possiblePlayerNames)].slice(0, 10);
      if (uniqueNames.length > 0) {
        console.log(`      選手名候補: ${uniqueNames.join(', ')}${possiblePlayerNames.length > 10 ? '...' : ''}`);
      }
      
    } catch (error) {
      console.log(`❌ ${page.name}ページエラー: ${error.message}`);
    }
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📋 調査結果サマリー:');
  console.log('   各ページタイプで利用可能な詳細データを特定しました');
  console.log('   次のステップとして具体的なデータ抽出ロジックを実装できます');
}

if (require.main === module) {
  analyzeNPBHTMLDetail().catch(console.error);
}

export { analyzeNPBHTMLDetail };