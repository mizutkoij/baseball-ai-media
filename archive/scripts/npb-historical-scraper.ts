// NPB過去試合データ一括取得システム
import { getCanonicalGameIds } from './npb-canonical-schedule';
import { run } from '../lib/db';

interface HistoricalGame {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  startTime: string;
  status: 'scheduled' | 'live' | 'finished';
  league: 'central' | 'pacific';
  homeScore?: number;
  awayScore?: number;
}

export class NPBHistoricalScraper {
  /**
   * 指定期間の全試合データを取得
   */
  async scrapeHistoricalPeriod(startDate: string, endDate: string): Promise<void> {
    console.log(`📅 Scraping historical NPB games from ${startDate} to ${endDate}...`);
    
    const dates = this.generateDateRange(startDate, endDate);
    console.log(`🗓️ Processing ${dates.length} dates...`);
    
    let totalGames = 0;
    const results: { [date: string]: number } = {};
    
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      console.log(`\n📅 [${i+1}/${dates.length}] Processing ${date}...`);
      
      try {
        const gameIds = await getCanonicalGameIds(date);
        const gameCount = gameIds.length;
        
        if (gameCount > 0) {
          console.log(`  ✅ Found ${gameCount} games`);
          const games = this.convertGameIdsToGames(gameIds, date);
          await this.saveGamesToDatabase(games);
          totalGames += gameCount;
        } else {
          console.log(`  ℹ️ No games (rest day)`);
        }
        
        results[date] = gameCount;
        
        // レート制限（2秒待機）
        if (i < dates.length - 1) {
          await this.sleep(2000);
        }
        
      } catch (error) {
        console.log(`  ❌ Failed: ${error}`);
        results[date] = -1; // エラーマーク
      }
    }
    
    // 結果サマリー
    console.log(`\n📊 HISTORICAL SCRAPING SUMMARY:`);
    console.log(`   Period: ${startDate} to ${endDate}`);
    console.log(`   Total games found: ${totalGames}`);
    console.log(`   Success rate: ${Object.values(results).filter(v => v >= 0).length}/${dates.length} days`);
    
    // 詳細結果
    console.log(`\n📋 Daily breakdown:`);
    Object.entries(results).forEach(([date, count]) => {
      const status = count === -1 ? '❌ ERROR' : count === 0 ? '🚫 REST' : `✅ ${count} games`;
      console.log(`   ${date}: ${status}`);
    });
  }
  
  /**
   * 単日の試合データ取得・保存
   */
  async scrapeSingleDate(date: string): Promise<HistoricalGame[]> {
    console.log(`📅 Scraping NPB games for ${date}...`);
    
    try {
      const gameIds = await getCanonicalGameIds(date);
      console.log(`🎯 Found ${gameIds.length} canonical game IDs`);
      
      if (gameIds.length === 0) {
        console.log(`ℹ️ No games for ${date}`);
        return [];
      }
      
      const games = this.convertGameIdsToGames(gameIds, date);
      console.log(`✅ Generated ${games.length} game records`);
      
      return games;
      
    } catch (error) {
      console.error(`❌ Failed to scrape ${date}:`, error);
      return [];
    }
  }
  
  /**
   * gameIDsから試合データを生成
   */
  private convertGameIdsToGames(gameIds: string[], date: string): HistoricalGame[] {
    return gameIds.map((gameId, index) => {
      const gameInfo = this.parseGameId(gameId);
      
      return {
        gameId: `${date.replace(/-/g, '')}_${gameId}`,
        date,
        homeTeam: gameInfo.homeTeam,
        awayTeam: gameInfo.awayTeam,
        venue: gameInfo.venue,
        startTime: gameInfo.startTime,
        status: this.determineStatus(date),
        league: gameInfo.league
      };
    });
  }
  
  /**
   * gameIdから試合情報を解析
   */
  private parseGameId(gameId: string): {
    homeTeam: string;
    awayTeam: string;
    venue: string;
    startTime: string;
    league: 'central' | 'pacific';
  } {
    // gameId例: g-d-17, s-db-16, c-t-19, l-e-17, m-b-18, h-f-19
    
    const teamMapping: { [key: string]: { name: string, venue: string, league: 'central' | 'pacific' } } = {
      'g': { name: '巨人', venue: '東京ドーム', league: 'central' },
      's': { name: 'ヤクルト', venue: '神宮球場', league: 'central' },
      'c': { name: '広島', venue: 'マツダスタジアム', league: 'central' },
      't': { name: '阪神', venue: '阪神甲子園球場', league: 'central' },
      'db': { name: 'DeNA', venue: '横浜スタジアム', league: 'central' },
      'd': { name: '中日', venue: 'バンテリンドーム', league: 'central' },
      'h': { name: 'ソフトバンク', venue: 'PayPayドーム', league: 'pacific' },
      'f': { name: '日本ハム', venue: 'エスコンフィールド', league: 'pacific' },
      'l': { name: '西武', venue: 'ベルーナドーム', league: 'pacific' },
      'm': { name: 'ロッテ', venue: 'ZOZOマリンスタジアム', league: 'pacific' },
      'b': { name: 'オリックス', venue: '京セラドーム大阪', league: 'pacific' },
      'e': { name: '楽天', venue: '楽天モバイルパーク', league: 'pacific' }
    };
    
    const parts = gameId.split('-');
    if (parts.length >= 2) {
      const homeCode = parts[0];
      const awayCode = parts[1];
      
      const homeTeam = teamMapping[homeCode];
      const awayTeam = teamMapping[awayCode];
      
      if (homeTeam && awayTeam) {
        return {
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          venue: homeTeam.venue,
          startTime: '18:00', // デフォルト
          league: homeTeam.league
        };
      }
    }
    
    // フォールバック
    return {
      homeTeam: '未定',
      awayTeam: '未定',
      venue: '未定',
      startTime: '18:00',
      league: 'central'
    };
  }
  
  /**
   * 試合ステータス決定
   */
  private determineStatus(date: string): 'scheduled' | 'live' | 'finished' {
    const gameDate = new Date(date + 'T18:00:00+09:00');
    const now = new Date();
    
    const diffMs = now.getTime() - gameDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < -1) return 'scheduled';
    if (diffHours >= -1 && diffHours <= 4) return 'live';
    return 'finished';
  }
  
  /**
   * 日付範囲生成
   */
  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push(date.toISOString().slice(0, 10));
    }
    
    return dates;
  }
  
  /**
   * データベースに保存
   */
  private async saveGamesToDatabase(games: HistoricalGame[]): Promise<void> {
    for (const game of games) {
      try {
        await run(`
          INSERT OR REPLACE INTO games (
            game_id, date, league, home_team, away_team,
            home_score, away_score, venue, status,
            start_time_jst, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          game.gameId,
          game.date,
          game.league,
          game.homeTeam,
          game.awayTeam,
          game.homeScore || null,
          game.awayScore || null,
          game.venue,
          game.status,
          game.startTime
        ]);
        
      } catch (error) {
        console.error(`    ❌ Failed to save game ${game.gameId}:`, error);
      }
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const scraper = new NPBHistoricalScraper();
  
  if (args.length === 2) {
    // 期間指定: npx tsx npb-historical-scraper.ts 2025-08-01 2025-08-15
    const startDate = args[0];
    const endDate = args[1];
    
    console.log(`📅 Historical scraping: ${startDate} to ${endDate}`);
    await scraper.scrapeHistoricalPeriod(startDate, endDate);
    
  } else if (args.length === 1) {
    // 単日: npx tsx npb-historical-scraper.ts 2025-08-11
    const date = args[0];
    
    const games = await scraper.scrapeSingleDate(date);
    
    console.log(`\n📊 Results for ${date}:`);
    if (games.length === 0) {
      console.log('  No games found');
    } else {
      games.forEach((game, i) => {
        console.log(`  ${i+1}. ${game.awayTeam} vs ${game.homeTeam} @${game.venue} [${game.status}]`);
      });
      
      if (args.includes('--save')) {
        await scraper['saveGamesToDatabase'](games);
        console.log(`✅ Saved ${games.length} games to database`);
      }
    }
    
  } else {
    console.log('Usage:');
    console.log('  Single date: npx tsx npb-historical-scraper.ts 2025-08-11 [--save]');
    console.log('  Date range: npx tsx npb-historical-scraper.ts 2025-08-01 2025-08-15');
  }
}

if (require.main === module) {
  main().catch(console.error);
}