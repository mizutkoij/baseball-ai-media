// NPB公式HTMLから確実にgameId数を取得するSSOT（Single Source of Truth）モジュール
import * as cheerio from 'cheerio';

const BASE = 'https://npb.jp';

// ランダムUA + リトライ（enhanced-npb-scraper準拠の軽量版）
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
];

function ua() { return UAS[Math.floor(Math.random()*UAS.length)]; }
function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

async function fetchHtml(url:string, max=5): Promise<string> {
  for (let i=0;i<max;i++){
    try{
      if(i>0){ await sleep(2000+Math.random()*3000); }
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...(i>0 ? { 'Referer': 'https://npb.jp/' } : {})
        }
      } as any);
      if(res.ok){
        return await res.text();
      }else{
        console.log(`⚠️ HTTP ${res.status} for ${url} (attempt ${i+1})`);
        // 403時は長め待機
        if(res.status===403){ await sleep(5000+Math.random()*5000); }
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

// /scores/YYYY/MMDD/ をパースして gameId を抽出
function extractGameIdsFromScoresList(html:string, y:string, md:string): string[] {
  const $ = cheerio.load(html);
  const re = new RegExp(`/scores/${y}/${md}/([^/]+)/`);
  const ids:string[] = [];
  
  console.log(`🔍 Parsing scores list for ${y}/${md}...`);
  
  $('a[href*="/scores/"]').each((_,a)=>{
    const href = $(a).attr('href')||'';
    const m = href.match(re);
    if(m && m[1]) {
      console.log(`  Found gameId: ${m[1]} from ${href}`);
      ids.push(m[1]);
    }
  });
  
  return unique(ids);
}

// /games/YYYY/schedule_MM_detail.html をパースして該当日の /scores リンク gameId を抽出
function extractGameIdsFromMonthlyDetail(html:string, y:string, m:string, d:string): string[] {
  const $ = cheerio.load(html);
  const md = `${m}${d}`;
  const targetDateId = `date${md}`; // 例: date0810
  const re = new RegExp(`/scores/${y}/${md}/([^/]+)/`);
  const ids:string[] = [];

  console.log(`🔍 Parsing monthly detail for ${y}/${m}/${d} (looking for id="${targetDateId}")...`);

  // 戦略1: 特定日付のtr要素を探す
  $(`tr[id="${targetDateId}"]`).each((_, tr) => {
    $(tr).find('a[href*="/scores/"]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const match = href.match(re);
      if (match && match[1]) {
        console.log(`  Found gameId: ${match[1]} from ${href} (via date-specific tr)`);
        ids.push(match[1]);
      }
    });
  });

  // 戦略2: 日付ヘッダー近傍を探す（rowspan対応）
  if (ids.length === 0) {
    console.log(`  No games found via date-specific tr, trying header approach...`);
    
    // 8/10（日）のような日付ヘッダーを探す
    const dayNum = parseInt(d);
    $('th').each((_, th) => {
      const headerText = $(th).text();
      if (headerText.includes(`${m}/${dayNum}`) || headerText.includes(`${parseInt(m)}/${dayNum}`)) {
        console.log(`  Found date header: "${headerText}"`);
        
        // このthの後続のtr要素でscoresリンクを探す
        let nextTr = $(th).closest('tr').next();
        const rowspan = parseInt($(th).attr('rowspan') || '1');
        
        for (let i = 0; i < rowspan && nextTr.length > 0; i++) {
          nextTr.find('a[href*="/scores/"]').each((_, a) => {
            const href = $(a).attr('href') || '';
            if (href.includes(`/scores/${y}/${md}/`)) {
              const match = href.match(re);
              if (match && match[1]) {
                console.log(`  Found gameId: ${match[1]} from ${href} (via header rowspan)`);
                ids.push(match[1]);
              }
            }
          });
          nextTr = nextTr.next();
        }
      }
    });
  }

  // 戦略3: 全般的検索（最後の手段）
  if (ids.length === 0) {
    console.log(`  No games found via structured approaches, trying general search...`);
    $('a[href*="/scores/"]').each((_, a) => {
      const href = $(a).attr('href') || '';
      if (href.includes(`/scores/${y}/${md}/`)) {
        const match = href.match(re);
        if (match && match[1]) {
          console.log(`  Found gameId: ${match[1]} from ${href} (via general search)`);
          ids.push(match[1]);
        }
      }
    });
  }
  
  return unique(ids);
}

/**
 * NPB公式サイトから確実にgameIdリストを取得するSSOT関数
 * 固定データに依存せず、実際のHTML構造から抽出
 */
export async function getCanonicalGameIds(dateISO: string): Promise<string[]> {
  const [Y, M, D] = dateISO.split('-');               // '2025','08','22'
  const MD = `${M}${D}`;

  console.log(`📅 Getting canonical game IDs for ${dateISO}...`);

  // 1st: /scores/YYYY/MMDD/ - 当日のスコアページから直接取得
  try{
    const url1 = `${BASE}/scores/${Y}/${MD}/`;
    console.log(`🌐 Trying primary source: ${url1}`);
    const html1 = await fetchHtml(url1);
    const ids1 = extractGameIdsFromScoresList(html1, Y, MD);
    if(ids1.length>0) {
      console.log(`✅ Primary source success: ${ids1.length} games`);
      return ids1;
    } else {
      console.log(`⚠️ Primary source yielded 0 games`);
    }
  }catch(e){ 
    console.log(`❌ Primary source failed (trying secondary):`, e);
  }

  // 2nd: /games/YYYY/schedule_MM_detail.html - 月間スケジュールから取得
  try{
    const url2 = `${BASE}/games/${Y}/schedule_${M}_detail.html`;
    console.log(`🌐 Trying secondary source: ${url2}`);
    const html2 = await fetchHtml(url2);
    const ids2 = extractGameIdsFromMonthlyDetail(html2, Y, M, D);
    if(ids2.length>0) {
      console.log(`✅ Secondary source success: ${ids2.length} games`);
      return ids2;
    } else {
      console.log(`⚠️ Secondary source yielded 0 games`);
    }
  }catch(e){ 
    console.log(`❌ Secondary source failed:`, e);
  }

  // どちらも取れない場合は"0件"を返す（固定データへは落とさない）
  console.log(`⚠️ Both sources failed. Returning 0 games (no fallback to fixed data)`);
  return [];
}

// CLIテスト: npx tsx npb-canonical-schedule.ts 2025-08-22
if (require.main === module){
  const date = process.argv[2] || new Date().toISOString().slice(0,10);
  
  getCanonicalGameIds(date).then(ids=>{
    console.log(`\n📊 FINAL RESULT for ${date}:`);
    console.log(`   Games found: ${ids.length}`);
    if(ids.length > 0) {
      console.log(`   Game IDs:`);
      ids.forEach((id, i) => console.log(`     ${i+1}. ${id}`));
    }
    
    if(ids.length === 0) {
      console.log(`\n⚠️ No games found - this could indicate:`);
      console.log(`   • Rest day (no games scheduled)`);
      console.log(`   • Website structure change`);
      console.log(`   • Network/access issues`);
    }
    
  }).catch(e=>{
    console.error('\n❌ SSOT module failed:', e);
    process.exit(1);
  });
}