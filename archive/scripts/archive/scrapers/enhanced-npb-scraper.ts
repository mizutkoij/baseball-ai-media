// Enhanced NPB scraper with improved anti-bot detection
import * as cheerio from 'cheerio';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

class EnhancedNPBScraper {
  private baseUrl = 'https://npb.jp';
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithAdvancedRetry(url: string, maxRetries = 5): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 各試行で異なる待機時間
        if (attempt > 0) {
          const waitTime = Math.random() * 3000 + 2000; // 2-5秒
          console.log(`⏳ Waiting ${Math.round(waitTime)}ms before attempt ${attempt + 1}...`);
          await this.sleep(waitTime);
        }

        console.log(`🌐 Fetching: ${url} (attempt ${attempt + 1}/${maxRetries})`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'Referer': attempt > 0 ? 'https://npb.jp/' : undefined
          }
        });

        if (response.ok) {
          const html = await response.text();
          console.log(`✅ Success! Content length: ${html.length}`);
          return html;
        } else {
          console.warn(`⚠️ HTTP ${response.status} ${response.statusText} for ${url}`);
          
          // 403の場合は長めに待機
          if (response.status === 403) {
            const longWait = Math.random() * 5000 + 5000; // 5-10秒
            console.log(`🚫 403 Forbidden - waiting ${Math.round(longWait)}ms before retry...`);
            await this.sleep(longWait);
          }
          
          if (attempt === maxRetries - 1) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error on attempt ${attempt + 1}:`, error);
        
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // エラーの場合も待機
        const errorWait = Math.random() * 2000 + 3000; // 3-5秒
        await this.sleep(errorWait);
      }
    }
    
    throw new Error('All retry attempts failed');
  }

  async testDirectBoxScoreAccess(): Promise<void> {
    // ユーザーが提供したURLを直接テスト
    const testUrls = [
      'https://npb.jp/scores/2025/0821/db-c-20/box.html',
      'https://npb.jp/scores/2025/0820/db-c-19/roster.html',
      'https://npb.jp/scores/2025/0821/',
      'https://npb.jp/scores/',
      'https://npb.jp/'
    ];

    console.log('🎯 Direct URL Access Test');
    console.log('=========================\n');

    for (const url of testUrls) {
      try {
        console.log(`\n📊 Testing: ${url}`);
        const html = await this.fetchWithAdvancedRetry(url, 3);
        
        if (html) {
          const $ = cheerio.load(html);
          
          // 基本情報を抽出
          const title = $('title').text().trim();
          console.log(`  📄 Title: ${title.substring(0, 80)}${title.length > 80 ? '...' : ''}`);
          
          // テーブル数をカウント
          const tableCount = $('table').length;
          console.log(`  📊 Tables found: ${tableCount}`);
          
          // チーム名らしきテキストを検索
          const teamPattern = /(巨人|ヤクルト|阪神|広島|DeNA|中日|ソフトバンク|日本ハム|西武|ロッテ|オリックス|楽天|カープ|ベイスターズ)/;
          const teamMatches = html.match(new RegExp(teamPattern.source, 'g'));
          if (teamMatches) {
            console.log(`  ⚾ Teams found: ${[...new Set(teamMatches)].join(', ')}`);
          }
          
          // スコア数字を検索
          const scorePattern = /(\d{1,2})/g;
          const possibleScores = html.match(scorePattern)?.slice(0, 10);
          if (possibleScores) {
            console.log(`  🔢 Possible scores: ${possibleScores.join(', ')}...`);
          }
          
          // 成功した場合、詳細データ抽出を試行
          if (url.includes('box.html')) {
            await this.extractBoxScoreData($, url);
          }
          
          console.log(`  ✅ SUCCESS: ${url}`);
        }
        
      } catch (error) {
        console.log(`  ❌ FAILED: ${url}`);
        console.log(`    Error: ${error}`);
      }
      
      // URL間の待機
      await this.sleep(2000 + Math.random() * 2000);
    }
  }

  private async extractBoxScoreData($: cheerio.CheerioAPI, url: string): Promise<void> {
    console.log(`\n🔍 Detailed Box Score Analysis for: ${url}`);
    
    // ゲーム情報
    const gameInfo = this.extractGameInfo($);
    console.log(`  📅 Game: ${gameInfo.awayTeam} vs ${gameInfo.homeTeam}`);
    console.log(`  🏟️ Venue: ${gameInfo.venue}`);
    console.log(`  📊 Score: ${gameInfo.awayScore} - ${gameInfo.homeScore}`);
    
    // 選手データ
    const players = this.extractPlayerData($);
    console.log(`  👥 Players found: ${players.length}`);
    
    if (players.length > 0) {
      console.log(`  📋 Sample players:`);
      players.slice(0, 5).forEach(player => {
        console.log(`    ${player.name} (${player.position}) - ${player.stats || 'no stats'}`);
      });
    }
    
    // 投手データ
    const pitchers = this.extractPitcherData($);
    console.log(`  🥎 Pitchers found: ${pitchers.length}`);
    
    if (pitchers.length > 0) {
      console.log(`  📋 Sample pitchers:`);
      pitchers.slice(0, 3).forEach(pitcher => {
        console.log(`    ${pitcher.name} - ${pitcher.result || 'no result'} (${pitcher.stats || 'no stats'})`);
      });
    }
  }

  private extractGameInfo($: cheerio.CheerioAPI): any {
    const title = $('title').text() || $('h1, h2, h3').first().text();
    
    // チーム名抽出
    const teamPattern = /(広島東洋カープ|横浜DeNAベイスターズ|巨人|ヤクルト|阪神|広島|DeNA|中日|ソフトバンク|日本ハム|西武|ロッテ|オリックス|楽天)/g;
    const teams = title.match(teamPattern) || [];
    
    // スコア抽出
    let scores: number[] = [];
    $('td, div, span').each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/^\d{1,2}$/) && parseInt(text) <= 20) {
        scores.push(parseInt(text));
      }
    });
    
    return {
      awayTeam: teams[0] || 'Unknown Away',
      homeTeam: teams[1] || 'Unknown Home', 
      awayScore: scores[0] || 0,
      homeScore: scores[1] || 0,
      venue: this.extractVenueFromTitle(title)
    };
  }

  private extractVenueFromTitle(title: string): string {
    const venues = {
      '横浜': '横浜スタジアム',
      '東京ド': '東京ドーム',
      '神宮': '神宮球場',
      '甲子園': '阪神甲子園球場',
      'マツダ': 'マツダスタジアム',
      'バンテリン': 'バンテリンドーム'
    };
    
    for (const [key, venue] of Object.entries(venues)) {
      if (title.includes(key)) return venue;
    }
    
    return 'Unknown Venue';
  }

  private extractPlayerData($: cheerio.CheerioAPI): any[] {
    const players: any[] = [];
    
    $('table').each((i, table) => {
      $(table).find('tr').each((j, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 3) {
          const name = $(cells[1]).text().trim();
          const position = $(cells[0]).text().trim();
          
          // 日本人名パターンチェック
          if (name.match(/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,8}$/)) {
            const stats = cells.length > 3 ? 
              Array.from(cells).slice(2, 7).map(cell => $(cell).text().trim()).join('-') : 
              'no stats';
              
            players.push({
              name,
              position,
              stats
            });
          }
        }
      });
    });
    
    return players;
  }

  private extractPitcherData($: cheerio.CheerioAPI): any[] {
    const pitchers: any[] = [];
    
    // 投手テーブル特有のパターンを探す
    $('table').each((i, table) => {
      const tableText = $(table).text();
      if (tableText.includes('投手') || tableText.includes('投球数') || tableText.includes('奪三振')) {
        $(table).find('tr').each((j, row) => {
          const cells = $(row).find('td');
          if (cells.length >= 2) {
            const name = $(cells[1]).text().trim();
            const result = $(cells[0]).text().trim();
            
            if (name.match(/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,8}$/)) {
              const stats = cells.length > 3 ? 
                Array.from(cells).slice(2, 6).map(cell => $(cell).text().trim()).join('-') :
                'no stats';
                
              pitchers.push({
                name,
                result: result.match(/[○●SH]/) ? result : undefined,
                stats
              });
            }
          }
        });
      }
    });
    
    return pitchers;
  }

  async saveDataToDatabase(data: any): Promise<void> {
    if (!existsSync('./data')) {
      mkdirSync('./data');
    }

    const outputData = {
      scrapedAt: new Date().toISOString(),
      source: 'NPB Official',
      data
    };

    writeFileSync('./data/npb-detailed-scraping-result.json', JSON.stringify(outputData, null, 2));
    console.log('\n💾 Detailed scraping results saved to ./data/npb-detailed-scraping-result.json');
  }
}

// 実行
async function main() {
  console.log('🚀 Enhanced NPB Scraper Starting...\n');
  
  const scraper = new EnhancedNPBScraper();
  
  try {
    await scraper.testDirectBoxScoreAccess();
    console.log('\n✅ Enhanced scraping test completed!');
  } catch (error) {
    console.error('\n❌ Enhanced scraping failed:', error);
  }
}

if (require.main === module) {
  main();
}

export { EnhancedNPBScraper };