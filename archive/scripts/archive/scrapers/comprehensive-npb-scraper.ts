// 包括的NPB公式サイトスクレイパー
import * as cheerio from 'cheerio';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

interface PlayerStats {
  order?: number;
  position: string;
  name: string;
  atBats?: number;
  runs?: number;
  hits?: number;
  rbis?: number;
  innings?: { [key: string]: string };
}

interface PitcherStats {
  name: string;
  result?: string;
  innings?: string;
  hits?: number;
  runs?: number;
  strikeouts?: number;
  walks?: number;
  earnedRuns?: number;
}

interface GameResult {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  venue: string;
  status: string;
  homeLineup?: PlayerStats[];
  awayLineup?: PlayerStats[];
  homePitchers?: PitcherStats[];
  awayPitchers?: PitcherStats[];
  inningsScore?: { [key: string]: number };
}

class ComprehensiveNPBScraper {
  private baseUrl = 'https://npb.jp';

  private async fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`🌐 Fetching: ${url} (attempt ${i + 1}/${maxRetries})`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });

        if (response.ok) {
          return await response.text();
        } else {
          console.warn(`⚠️ HTTP ${response.status} for ${url}`);
          if (i === maxRetries - 1) throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching ${url} (attempt ${i + 1}):`, error);
        if (i === maxRetries - 1) throw error;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('Max retries reached');
  }

  /**
   * 試合一覧ページから試合情報を取得
   */
  async scrapeGamesList(date: string): Promise<GameResult[]> {
    const url = `${this.baseUrl}/scores/${date.substring(0, 4)}/${date.substring(4, 8)}/`;
    
    try {
      const html = await this.fetchWithRetry(url);
      const $ = cheerio.load(html);
      const games: GameResult[] = [];

      // 試合リンクを探す
      $('a[href*="/scores/"]').each((i, element) => {
        const href = $(element).attr('href');
        if (href && href.match(/\/scores\/\d{4}\/\d{4}\/[^\/]+\/$/)) {
          const gameId = href.split('/').filter(Boolean).pop() || '';
          
          // チーム名を取得（推測）
          const linkText = $(element).text().trim();
          const teams = this.extractTeamNames(linkText);
          
          games.push({
            gameId,
            date,
            homeTeam: teams.home || '不明',
            awayTeam: teams.away || '不明',
            venue: '不明',
            status: 'scheduled'
          });
        }
      });

      console.log(`📅 ${date}: ${games.length}試合を発見`);
      return games;
    } catch (error) {
      console.error(`Error scraping games list for ${date}:`, error);
      return [];
    }
  }

  /**
   * 実際のボックススコア情報を試合詳細ページから取得
   */
  async scrapeGameDetails(gameId: string, dateStr: string): Promise<GameResult | null> {
    // 複数のURLパターンを試行
    const urlPatterns = [
      `${this.baseUrl}/scores/${dateStr.substring(0, 4)}/${dateStr.substring(4, 8)}/${gameId}/box.html`,
      `${this.baseUrl}/scores/${dateStr.substring(0, 4)}/${dateStr.substring(4, 8)}/${gameId}/`,
      `${this.baseUrl}/scores/${dateStr.substring(0, 4)}/${dateStr.substring(4, 8)}/${gameId}/index.html`
    ];

    for (const url of urlPatterns) {
      try {
        const html = await this.fetchWithRetry(url);
        const $ = cheerio.load(html);
        
        const result = this.parseGamePage($, gameId, dateStr, url);
        if (result) {
          console.log(`✅ 詳細取得成功: ${gameId}`);
          return result;
        }
      } catch (error) {
        console.log(`⚠️ Failed to fetch ${url}, trying next pattern...`);
      }
    }

    console.error(`❌ All URL patterns failed for ${gameId}`);
    return null;
  }

  private parseGamePage($: cheerio.CheerioAPI, gameId: string, date: string, url: string): GameResult | null {
    try {
      // ページタイトルからチーム情報を取得
      const title = $('title').text() || $('h1').text() || $('h2').text() || $('h3').first().text();
      console.log(`📄 ページタイトル: ${title.substring(0, 100)}...`);
      
      const teams = this.extractTeamNames(title);
      
      // スコアを取得
      const scores = this.extractScores($);
      
      // 球場情報を取得
      const venue = this.extractVenue($, title);
      
      // 試合状況を判定
      const status = this.determineGameStatus($, scores);

      // 選手成績を取得（テーブル形式）
      const lineups = this.extractLineups($);

      const result: GameResult = {
        gameId,
        date,
        homeTeam: teams.home || '不明',
        awayTeam: teams.away || '不明',
        homeScore: scores.home,
        awayScore: scores.away,
        venue,
        status,
        ...lineups
      };

      console.log(`📊 解析結果: ${result.awayTeam} ${result.awayScore || '?'} - ${result.homeScore || '?'} ${result.homeTeam} @${result.venue}`);
      return result;
      
    } catch (error) {
      console.error('Error parsing game page:', error);
      return null;
    }
  }

  private extractTeamNames(text: string): { home?: string; away?: string } {
    // NPBチーム名のマッピング
    const teamMappings: { [key: string]: string } = {
      '巨人': '巨人',
      'ヤクルト': 'ヤクルト',
      '阪神': '阪神',
      '広島': '広島',
      'DeNA': 'DeNA',
      '中日': '中日',
      'ソフトバンク': 'ソフトバンク',
      '日本ハム': '日本ハム',
      '西武': '西武',
      'ロッテ': 'ロッテ',
      'オリックス': 'オリックス',
      '楽天': '楽天',
      'カープ': '広島',
      'ベイスターズ': 'DeNA',
      'タイガース': '阪神',
      'ドラゴンズ': '中日',
      'ジャイアンツ': '巨人',
      'スワローズ': 'ヤクルト',
      'ホークス': 'ソフトバンク',
      'ファイターズ': '日本ハム',
      'ライオンズ': '西武',
      'マリーンズ': 'ロッテ',
      'バファローズ': 'オリックス',
      'イーグルス': '楽天'
    };

    let home, away;

    // 「vs」パターンを検索
    const vsMatch = text.match(/(.+?)\s*vs\s*(.+?)(?:\s|$)/i);
    if (vsMatch) {
      away = vsMatch[1].trim();
      home = vsMatch[2].trim();
    }

    // チーム名をマッピングして正規化
    if (away) {
      for (const [pattern, normalizedName] of Object.entries(teamMappings)) {
        if (away.includes(pattern)) {
          away = normalizedName;
          break;
        }
      }
    }

    if (home) {
      for (const [pattern, normalizedName] of Object.entries(teamMappings)) {
        if (home.includes(pattern)) {
          home = normalizedName;
          break;
        }
      }
    }

    return { home, away };
  }

  private extractScores($: cheerio.CheerioAPI): { home?: number; away?: number } {
    let homeScore, awayScore;

    // スコア要素を複数のパターンで検索
    const scoreSelectors = [
      '.score',
      '[class*="score"]',
      'td[class*="score"]',
      '.line-score td:last-child',
      'table td:contains("計")'
    ];

    for (const selector of scoreSelectors) {
      const scoreElements = $(selector);
      if (scoreElements.length >= 2) {
        const scores = scoreElements.map((i, el) => {
          const text = $(el).text().trim();
          const num = parseInt(text);
          return isNaN(num) ? null : num;
        }).get().filter(s => s !== null);

        if (scores.length >= 2) {
          [awayScore, homeScore] = scores;
          break;
        }
      }
    }

    // 数値のパターンで直接検索
    if (!homeScore && !awayScore) {
      $('td, span, div').each((i, el) => {
        const text = $(el).text().trim();
        if (text.match(/^\d{1,2}$/)) {
          const score = parseInt(text);
          if (score >= 0 && score <= 30) {
            if (!awayScore) awayScore = score;
            else if (!homeScore) homeScore = score;
          }
        }
      });
    }

    return { home: homeScore, away: awayScore };
  }

  private extractVenue($: cheerio.CheerioAPI, title: string): string {
    // 球場名のパターン
    const venuePatterns = [
      '東京ドーム', '神宮球場', '阪神甲子園球場', 'マツダスタジアム',
      '横浜スタジアム', 'バンテリンドーム', 'PayPayドーム',
      'エスコンフィールド', 'ベルーナドーム', 'ZOZOマリンスタジアム',
      '京セラドーム大阪', '楽天モバイルパーク'
    ];

    // タイトルから球場名を検索
    for (const venue of venuePatterns) {
      if (title.includes(venue)) {
        return venue;
      }
    }

    // 球場情報を表すテキストから抽出
    $('.venue, [class*="venue"], [class*="stadium"]').each((i, el) => {
      const text = $(el).text().trim();
      for (const venue of venuePatterns) {
        if (text.includes(venue)) {
          return venue;
        }
      }
    });

    // 括弧内の球場略称から推定
    const venueMatch = title.match(/[（(](.+?)[）)]/);
    if (venueMatch) {
      const venueAbbr = venueMatch[1];
      const abbreviations: { [key: string]: string } = {
        '東京ド': '東京ドーム',
        '神宮': '神宮球場',
        '甲子園': '阪神甲子園球場',
        'マツダ': 'マツダスタジアム',
        '横浜': '横浜スタジアム',
        'バンテリン': 'バンテリンドーム',
        'PayPay': 'PayPayドーム',
        'エスコン': 'エスコンフィールド',
        'ベルーナ': 'ベルーナドーム',
        'ZOZOマリン': 'ZOZOマリンスタジアム',
        '京セラ': '京セラドーム大阪',
        '楽天モバイル': '楽天モバイルパーク'
      };

      for (const [abbr, fullName] of Object.entries(abbreviations)) {
        if (venueAbbr.includes(abbr)) {
          return fullName;
        }
      }
    }

    return '不明';
  }

  private determineGameStatus($: cheerio.CheerioAPI, scores: { home?: number; away?: number }): string {
    const pageText = $('body').text().toLowerCase();
    
    if (pageText.includes('試合終了') || pageText.includes('game end')) {
      return 'finished';
    } else if (pageText.includes('試合中') || pageText.includes('live')) {
      return 'live';
    } else if (scores.home !== undefined && scores.away !== undefined) {
      return 'finished';
    } else {
      return 'scheduled';
    }
  }

  private extractLineups($: cheerio.CheerioAPI): { homeLineup?: PlayerStats[]; awayLineup?: PlayerStats[] } {
    const lineups: PlayerStats[][] = [[], []];
    
    // テーブルから選手情報を抽出
    $('table').each((tableIndex, table) => {
      const rows = $(table).find('tr');
      
      rows.each((rowIndex, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 3) {
          const playerName = $(cells[1]).text().trim();
          const position = $(cells[0]).text().trim();
          
          // 選手名らしいかチェック（日本語文字を含む2-6文字）
          if (playerName.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,6}/) && playerName.length <= 10) {
            const player: PlayerStats = {
              name: playerName,
              position: position,
              atBats: parseInt($(cells[2]).text()) || undefined,
              runs: parseInt($(cells[3]).text()) || undefined,
              hits: parseInt($(cells[4]).text()) || undefined,
              rbis: parseInt($(cells[5]).text()) || undefined
            };

            // どちらのチームかを判定（簡易版）
            const teamIndex = tableIndex < 2 ? 0 : 1;
            if (lineups[teamIndex]) {
              lineups[teamIndex].push(player);
            }
          }
        }
      });
    });

    return {
      awayLineup: lineups[0].length > 0 ? lineups[0] : undefined,
      homeLineup: lineups[1].length > 0 ? lineups[1] : undefined
    };
  }

  /**
   * 指定された日付範囲の試合データを収集
   */
  async scrapeGamesByDateRange(startDate: string, endDate: string): Promise<GameResult[]> {
    const results: GameResult[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log(`🗓️ 期間: ${startDate} 〜 ${endDate}`);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      
      try {
        // まず試合リストを取得
        const gamesList = await this.scrapeGamesList(dateStr);
        
        // 各試合の詳細を取得
        for (const game of gamesList) {
          const details = await this.scrapeGameDetails(game.gameId, dateStr);
          if (details) {
            results.push(details);
          } else {
            // 詳細取得に失敗した場合は基本情報のみ保存
            results.push(game);
          }
          
          // レート制限対応
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Error scraping date ${dateStr}:`, error);
      }
      
      // 日付間の待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * 結果を保存
   */
  saveResults(results: GameResult[], outputPath: string): void {
    if (!existsSync('./data')) {
      mkdirSync('./data');
    }

    const outputData = {
      scrapedAt: new Date().toISOString(),
      totalGames: results.length,
      games: results
    };

    writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`💾 ${results.length}試合のデータを ${outputPath} に保存しました`);
  }
}

// 実行例
async function main() {
  const scraper = new ComprehensiveNPBScraper();
  
  try {
    console.log('🎯 NPB包括的スクレイピング開始');
    
    // 最近の試合データを取得
    const results = await scraper.scrapeGamesByDateRange('2025-08-20', '2025-08-21');
    
    // 結果を保存
    scraper.saveResults(results, './data/npb-games-recent.json');
    
    // 結果サマリーを表示
    console.log('\n📊 取得結果サマリー:');
    console.log(`総試合数: ${results.length}`);
    
    const finishedGames = results.filter(g => g.status === 'finished');
    console.log(`完了試合: ${finishedGames.length}`);
    
    if (finishedGames.length > 0) {
      console.log('\n🏆 完了試合:');
      finishedGames.forEach(game => {
        console.log(`  ${game.date}: ${game.awayTeam} ${game.awayScore || '?'} - ${game.homeScore || '?'} ${game.homeTeam} @${game.venue}`);
      });
    }
    
  } catch (error) {
    console.error('❌ スクレイピングエラー:', error);
  }
}

if (require.main === module) {
  main();
}

export { ComprehensiveNPBScraper };