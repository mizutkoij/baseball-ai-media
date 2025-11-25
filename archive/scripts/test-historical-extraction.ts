// Test historical data extraction via monthly schedule pages
import * as cheerio from 'cheerio';

const BASE = 'https://npb.jp';

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

function ua() { return UAS[Math.floor(Math.random()*UAS.length)]; }
function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

async function fetchHtml(url:string, max=3): Promise<string> {
  for (let i=0;i<max;i++){
    try{
      if(i>0){ await sleep(2000+Math.random()*3000); }
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      } as any);
      if(res.ok){
        return await res.text();
      }else{
        console.log(`⚠️ HTTP ${res.status} for ${url} (attempt ${i+1})`);
        if(i===max-1) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
    }catch(e){
      console.log(`⚠️ Fetch failed for ${url} (attempt ${i+1}):`, e);
      if(i===max-1) throw e;
      await sleep(3000+Math.random()*2000);
    }
  }
  throw new Error('All retries failed');
}

function unique<T>(arr:T[]):T[]{ return Array.from(new Set(arr)); }

// Extract gameIds from monthly schedule for specific date
function extractGameIdsFromMonthlyDetail(html:string, y:string, m:string, d:string): string[] {
  const $ = cheerio.load(html);
  const md = `${m}${d}`;
  const re = new RegExp(`/scores/${y}/${md}/([^/]+)/`);
  const ids:string[] = [];

  console.log(`🔍 Parsing monthly detail for ${y}/${m}/${d}...`);
  
  // Strategy 1: Look for all scores links for the specific date
  $('a[href*="/scores/"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (href.includes(`/scores/${y}/${md}/`)) {
      const match = href.match(re);
      if (match && match[1]) {
        console.log(`  Found gameId: ${match[1]} from ${href}`);
        ids.push(match[1]);
      }
    }
  });
  
  return unique(ids);
}

// Test specific historical dates
async function testHistoricalExtraction() {
  const testCases = [
    { date: '2020-08-01', expectedGameId: 'g-c-08' },
    { date: '2017-08-01', expectedGameId: 's-g-14' },
    { date: '2019-07-15', expectedGameId: null }, // random test
    { date: '2018-05-20', expectedGameId: null }  // random test
  ];

  console.log('🧪 Testing Historical Data Extraction via Monthly Schedule Pages\n');

  for (const testCase of testCases) {
    const [Y, M, D] = testCase.date.split('-');
    const url = `${BASE}/games/${Y}/schedule_${M}_detail.html`;
    
    console.log(`📅 Testing ${testCase.date}...`);
    console.log(`   URL: ${url}`);
    
    try {
      const html = await fetchHtml(url);
      const gameIds = extractGameIdsFromMonthlyDetail(html, Y, M, D);
      
      console.log(`   ✅ Found ${gameIds.length} games: ${gameIds.join(', ')}`);
      
      if (testCase.expectedGameId) {
        const found = gameIds.includes(testCase.expectedGameId);
        console.log(`   Expected "${testCase.expectedGameId}": ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      }
      
      // Test if individual game pages exist
      if (gameIds.length > 0) {
        const sampleGameId = gameIds[0];
        const gameUrl = `${BASE}/scores/${Y}/${M}${D}/${sampleGameId}/`;
        
        try {
          await fetchHtml(gameUrl);
          console.log(`   ✅ Sample game page accessible: ${gameUrl}`);
        } catch (e) {
          console.log(`   ❌ Sample game page failed: ${gameUrl} - ${e}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error}`);
    }
    
    console.log('');
    await sleep(3000); // Rate limiting
  }
}

// CLI execution
if (require.main === module) {
  testHistoricalExtraction().catch(console.error);
}