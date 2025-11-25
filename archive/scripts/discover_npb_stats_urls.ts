import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// NPBサイトから実際の成績ページURLを発見
async function discoverStatsUrls() {
  console.log('🔍 NPBサイトから成績ページURLを探索中...');
  
  // 各種パターンを試す
  const baseUrls = [
    'https://npb.jp/stats/',
    'https://npb.jp/bis/stats/',
    'https://npb.jp/bis/2024/stats/',
    'https://npb.jp/record/',
    'https://npb.jp/statistics/',
    'https://npb.jp'
  ];
  
  const urlPatterns = [
    'cle_b.html', 'cle_p.html', 'ple_b.html', 'ple_p.html',
    'central_batting.html', 'central_pitching.html',
    'pacific_batting.html', 'pacific_pitching.html',
    'batting.html', 'pitching.html'
  ];
  
  for (const baseUrl of baseUrls) {
    console.log(`\n📍 ベースURL探索: ${baseUrl}`);
    
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        console.log(`✅ アクセス成功: ${response.status}`);
        console.log(`📄 タイトル: ${$('title').text()}`);
        
        // 成績関連のリンクを探す
        const statsLinks = $('a').filter((_, link) => {
          const href = $(link).attr('href');
          const text = $(link).text().trim();
          return href && (
            text.includes('成績') || text.includes('記録') || text.includes('統計') ||
            text.includes('打撃') || text.includes('投手') || text.includes('batting') ||
            text.includes('pitching') || text.includes('stats') ||
            href.includes('stats') || href.includes('record') || href.includes('bis')
          );
        });
        
        if (statsLinks.length > 0) {
          console.log(`🔗 成績関連リンク発見 (${statsLinks.length}件):`);
          statsLinks.each((_, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.text().trim();
            
            let fullUrl = href;
            if (href?.startsWith('/')) {
              fullUrl = 'https://npb.jp' + href;
            } else if (href && !href.startsWith('http')) {
              fullUrl = baseUrl + (baseUrl.endsWith('/') ? '' : '/') + href;
            }
            
            console.log(`   • ${text}: ${fullUrl}`);
          });
        }
        
        // 特定のパターンも試す
        for (const pattern of urlPatterns) {
          const testUrl = baseUrl + (baseUrl.endsWith('/') ? '' : '/') + pattern;
          try {
            const testResponse = await fetch(testUrl);
            if (testResponse.ok) {
              console.log(`✅ 発見: ${testUrl}`);
            }
          } catch (e) {
            // 無視
          }
        }
        
      } else {
        console.log(`❌ アクセス失敗: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ エラー: ${error.message}`);
    }
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // 2024年のデータがあるかチェック
  console.log('\n🔍 2024年成績データの確認...');
  const test2024Urls = [
    'https://npb.jp/bis/2024/stats/cle_b.html',
    'https://npb.jp/bis/2024/stats/cle_p.html',
    'https://npb.jp/bis/2024/stats/ple_b.html',
    'https://npb.jp/bis/2024/stats/ple_p.html'
  ];
  
  for (const url of test2024Urls) {
    try {
      const response = await fetch(url);
      console.log(`${response.ok ? '✅' : '❌'} ${url} (${response.status})`);
    } catch (error) {
      console.log(`❌ ${url} (エラー: ${error.message})`);
    }
  }
}

if (require.main === module) {
  discoverStatsUrls().catch(console.error);
}

export { discoverStatsUrls };