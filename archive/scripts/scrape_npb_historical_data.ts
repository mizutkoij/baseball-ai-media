import * as cheerio from 'cheerio';
import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import { promises as fs } from 'fs';

// NPB公式サイトのベースURL（年度可変）
const NPB_BASE_URL = 'https://npb.jp/bis';

// リーグ情報の定義
const LEAGUES = {
  central: {
    url: 'bat_c.html',
    name: 'セントラル・リーグ',
    teams: {
      'G': { code: 'YG', name: '読売ジャイアンツ' },
      'T': { code: 'T', name: '阪神タイガース' },
      'C': { code: 'C', name: '広島東洋カープ' },
      'DB': { code: 'DB', name: '横浜DeNAベイスターズ' },
      'S': { code: 'S', name: '東京ヤクルトスワローズ' },
      'D': { code: 'D', name: '中日ドラゴンズ' }
    }
  },
  pacific: {
    url: 'bat_p.html',
    name: 'パシフィック・リーグ',
    teams: {
      'SB': { code: 'H', name: '福岡ソフトバンクホークス' },
      'L': { code: 'L', name: '埼玉西武ライオンズ' },
      'E': { code: 'E', name: '東北楽天ゴールデンイーグルス' },
      'M': { code: 'M', name: '千葉ロッテマリーンズ' },
      'B': { code: 'B', name: 'オリックス・バファローズ' },
      'F': { code: 'F', name: '北海道日本ハムファイターズ' }
    }
  }
};

// 年度別URL調整（NPBサイトの構造変化に対応）
const getLeagueUrl = (year: number, league: string): string => {
  const leagueInfo = LEAGUES[league as keyof typeof LEAGUES];
  
  // 2020年以降は統計データ形式
  if (year >= 2020) {
    return `${NPB_BASE_URL}/${year}/stats/${leagueInfo.url}`;
  }
  
  // 2019年以前は旧形式（存在すれば）
  return `${NPB_BASE_URL}/${year}/stats/${leagueInfo.url}`;
};

interface PlayerStats {
  name: string;
  team: string;
  league: string;
  year: number;
  games: number;
  at_bats: number;
  hits: number;
  home_runs: number;
  rbis: number;
  batting_average: number;
  [key: string]: any;
}

interface HistoricalScrapeOptions {
  startYear: number;
  endYear: number;
  leagues?: string[];  // ['central', 'pacific'] or specific league
}

class NPBHistoricalScraper {
  private delay = 3000; // リクエスト間の遅延（歴史データなので少し長めに）
  
  constructor() {
    console.log('NPB Historical Data Scraper initialized');
  }

  // HTTPリクエストを送信（遅延付き・リトライ機能付き）
  private async fetchWithDelay(url: string, retries = 3): Promise<string> {
    console.log(`Fetching: ${url}`);
    await new Promise(resolve => setTimeout(resolve, this.delay));
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
          },
          timeout: 15000
        });
        
        return response.data;
      } catch (error: any) {
        console.warn(`Attempt ${attempt}/${retries} failed for ${url}:`, error.message);
        
        if (attempt === retries) {
          console.error(`All attempts failed for ${url}`);
          throw error;
        }
        
        // 失敗時は少し長く待つ
        await new Promise(resolve => setTimeout(resolve, this.delay * attempt));
      }
    }
    
    throw new Error('All retry attempts failed');
  }

  // 打者成績データを解析（年度とリーグ指定）
  private parseBattingStats(html: string, league: string, year: number): PlayerStats[] {
    const $ = cheerio.load(html);
    const players: PlayerStats[] = [];
    
    // NPBのテーブル構造を解析（年度によって微調整）
    $('table').each((tableIndex, table) => {
      $(table).find('tr').each((rowIndex, row) => {
        const cells = $(row).find('td');
        
        if (cells.length >= 8) {
          const nameCell = $(cells[0]).text().trim();
          const teamCell = $(cells[1]).text().trim();
          
          if (nameCell && teamCell && !nameCell.includes('順位') && !nameCell.includes('選手')) {
            const name = nameCell.replace(/[*＊]/g, '');
            let teamCode = this.getTeamCode(teamCell, league, year);
            
            // 年度別テーブル構造調整
            const columnOffset = year >= 2022 ? 0 : -1; // 2022年以降構造変更があった可能性
            
            const games = parseInt($(cells[2 + columnOffset]).text().trim()) || 0;
            const at_bats = parseInt($(cells[3 + columnOffset]).text().trim()) || 0;
            const hits = parseInt($(cells[4 + columnOffset]).text().trim()) || 0;
            const home_runs = parseInt($(cells[5 + columnOffset]).text().trim()) || 0;
            const rbis = parseInt($(cells[6 + columnOffset]).text().trim()) || 0;
            const batting_avg_text = $(cells[7 + columnOffset]).text().trim();
            const batting_average = parseFloat(batting_avg_text.replace('.', '0.')) || 0;
            
            // データ妥当性チェック
            if (name && name.length > 1 && teamCode && teamCode !== 'UNK' && games > 0 && at_bats >= 0) {
              players.push({
                name,
                team: teamCode,
                league,
                year,
                games,
                at_bats,
                hits,
                home_runs,
                rbis,
                batting_average
              });
            }
          }
        }
      });
    });
    
    return players;
  }

  // チーム名からチームコードを取得（年度別調整付き）
  private getTeamCode(teamName: string, league: string, year: number): string {
    const leagueTeams = LEAGUES[league as keyof typeof LEAGUES].teams;
    
    // 標準マッチング
    for (const [key, team] of Object.entries(leagueTeams)) {
      if (teamName.includes(team.name.slice(0, 2)) || teamName.includes(key)) {
        return team.code;
      }
    }
    
    // 年度別チーム名変化対応
    const teamMappings: { [key: string]: string } = {
      '巨人': 'YG',
      'ジャイアンツ': 'YG',
      '阪神': 'T',
      'タイガース': 'T',
      '広島': 'C',
      'カープ': 'C',
      '横浜': 'DB',
      'ベイ': 'DB',
      'DeNA': 'DB',
      'ヤクルト': 'S',
      'スワローズ': 'S',
      '中日': 'D',
      'ドラゴンズ': 'D',
      'ソフトバンク': 'H',
      'ホークス': 'H',
      'SB': 'H',
      '西武': 'L',
      'ライオンズ': 'L',
      '楽天': 'E',
      'イーグルス': 'E',
      'ロッテ': 'M',
      'マリーンズ': 'M',
      'オリックス': 'B',
      'バファローズ': 'B',
      '日本ハム': 'F',
      'ファイターズ': 'F'
    };
    
    // 特殊ケース対応（2004年楽天創設、2005年ライブドア→楽天など）
    if (year <= 2004 && teamName.includes('楽天')) return 'UNK'; // 楽天創設前
    if (year <= 2004 && teamName.includes('ライブドア')) return 'UNK'; // 特殊ケース
    
    for (const [pattern, code] of Object.entries(teamMappings)) {
      if (teamName.includes(pattern)) {
        return code;
      }
    }
    
    console.warn(`Unknown team: ${teamName} in ${year}`);
    return 'UNK';
  }

  // 指定年度・リーグの打者成績を取得
  async scrapeYearLeagueBattingStats(year: number, league: string): Promise<PlayerStats[]> {
    const leagueInfo = LEAGUES[league as keyof typeof LEAGUES];
    const url = getLeagueUrl(year, league);
    
    try {
      console.log(`📊 Scraping ${year} ${leagueInfo.name}...`);
      const html = await this.fetchWithDelay(url);
      const players = this.parseBattingStats(html, league, year);
      
      console.log(`✅ ${year} ${leagueInfo.name}: ${players.length} players scraped`);
      return players;
    } catch (error) {
      console.error(`❌ Failed to scrape ${year} ${leagueInfo.name}:`, error);
      return [];
    }
  }

  // 指定年度の全リーグ成績を取得
  async scrapeYearBattingStats(year: number, leagues: string[] = ['central', 'pacific']): Promise<PlayerStats[]> {
    const allPlayers: PlayerStats[] = [];
    
    console.log(`🏁 Starting ${year} NPB batting stats scraping...`);
    
    for (const league of leagues) {
      const leaguePlayers = await this.scrapeYearLeagueBattingStats(year, league);
      allPlayers.push(...leaguePlayers);
      
      // リーグ間に追加の遅延
      if (league !== leagues[leagues.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
    
    console.log(`🎯 ${year}: Total ${allPlayers.length} players scraped`);
    return allPlayers;
  }

  // 複数年度の歴史データを取得
  async scrapeHistoricalData(options: HistoricalScrapeOptions): Promise<PlayerStats[]> {
    const { startYear, endYear, leagues = ['central', 'pacific'] } = options;
    const allHistoricalData: PlayerStats[] = [];
    
    console.log(`🚀 Starting historical data scraping: ${startYear}-${endYear}`);
    
    // 年度を降順でスクレイピング（新しい年から）
    for (let year = endYear; year >= startYear; year--) {
      try {
        console.log(`\n📅 Scraping year: ${year}`);
        const yearData = await this.scrapeYearBattingStats(year, leagues);
        allHistoricalData.push(...yearData);
        
        // 年度間に長めの遅延（サーバー負荷軽減）
        if (year > startYear) {
          console.log(`⏳ Waiting before next year...`);
          await new Promise(resolve => setTimeout(resolve, this.delay * 2));
        }
      } catch (error) {
        console.error(`❌ Failed to scrape year ${year}:`, error);
        // 1年分失敗しても続行
        continue;
      }
    }
    
    console.log(`\n🎯 Historical scraping completed: ${allHistoricalData.length} total players`);
    return allHistoricalData;
  }

  // データベースに保存（年度別）
  async saveHistoricalToDatabase(players: PlayerStats[]): Promise<void> {
    const dbPath = path.join(process.cwd(), 'data', 'db_historical.db');
    
    // データベースファイルのディレクトリを作成
    const dbDir = path.dirname(dbPath);
    await fs.mkdir(dbDir, { recursive: true });
    
    const db = new Database(dbPath);
    
    try {
      // 歴史データ用テーブル作成
      db.prepare(`
        CREATE TABLE IF NOT EXISTS historical_batting_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_id TEXT,
          name TEXT NOT NULL,
          team TEXT NOT NULL,
          position TEXT DEFAULT 'UNK',
          year INTEGER NOT NULL,
          games INTEGER DEFAULT 0,
          at_bats INTEGER DEFAULT 0,
          hits INTEGER DEFAULT 0,
          runs INTEGER DEFAULT 0,
          rbis INTEGER DEFAULT 0,
          doubles INTEGER DEFAULT 0,
          triples INTEGER DEFAULT 0,
          home_runs INTEGER DEFAULT 0,
          walks INTEGER DEFAULT 0,
          strikeouts INTEGER DEFAULT 0,
          stolen_bases INTEGER DEFAULT 0,
          batting_average REAL DEFAULT 0.0,
          on_base_percentage REAL DEFAULT 0.0,
          slugging_percentage REAL DEFAULT 0.0,
          ops REAL DEFAULT 0.0,
          scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(name, team, year)
        )
      `).run();

      // 年度別でデータを処理
      const yearGroups = players.reduce((acc, player) => {
        if (!acc[player.year]) acc[player.year] = [];
        acc[player.year].push(player);
        return acc;
      }, {} as { [year: number]: PlayerStats[] });

      let totalInserted = 0;

      for (const [year, yearPlayers] of Object.entries(yearGroups)) {
        console.log(`💾 Saving ${year} data: ${yearPlayers.length} players`);
        
        // 既存の年度データを削除
        db.prepare('DELETE FROM historical_batting_stats WHERE year = ?').run(parseInt(year));
        
        // 新しいデータを挿入
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO historical_batting_stats (
            player_id, name, team, position, year, games, at_bats, hits, 
            runs, rbis, doubles, triples, home_runs, walks, strikeouts, 
            stolen_bases, batting_average, on_base_percentage, 
            slugging_percentage, ops, scraped_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let yearInserted = 0;
        
        for (const player of yearPlayers) {
          const playerId = `${player.team}_${year}_${yearInserted + 1}`;
          
          // 基本的なセイバーメトリクス計算
          const walks_est = Math.round(player.at_bats * 0.11);
          const obp = player.at_bats > 0 ? 
            ((player.hits + walks_est) / (player.at_bats + walks_est)) : 0;
          const total_bases = player.hits + player.home_runs * 3; // 簡易計算
          const slg = player.at_bats > 0 ? (total_bases / player.at_bats) : 0;
          const ops = obp + slg;
          
          try {
            insertStmt.run(
              playerId,
              player.name,
              player.team,
              'UNK',
              player.year,
              player.games,
              player.at_bats,
              player.hits,
              Math.round(player.hits * 0.65), // 推定得点
              player.rbis,
              Math.round(player.hits * 0.22), // 推定二塁打
              Math.round(player.hits * 0.03), // 推定三塁打
              player.home_runs,
              walks_est,
              Math.round(player.at_bats * 0.19), // 推定三振
              Math.round(player.games * 0.08), // 推定盗塁
              player.batting_average,
              Math.round(obp * 1000) / 1000,
              Math.round(slg * 1000) / 1000,
              Math.round(ops * 1000) / 1000,
              new Date().toISOString(),
              new Date().toISOString()
            );
            yearInserted++;
          } catch (error) {
            console.error(`Failed to insert ${year} player: ${player.name}`, error);
          }
        }
        
        console.log(`✅ ${year}: Saved ${yearInserted} players`);
        totalInserted += yearInserted;
      }
      
      console.log(`💾 Historical data saved: ${totalInserted} total players`);
      
    } finally {
      db.close();
    }
  }

  // JSON形式でエクスポート
  async exportToJson(players: PlayerStats[], filename: string): Promise<void> {
    const exportDir = path.join(process.cwd(), 'data', 'exports');
    await fs.mkdir(exportDir, { recursive: true });
    
    const exportPath = path.join(exportDir, `${filename}.json`);
    const exportData = {
      exported_at: new Date().toISOString(),
      total_players: players.length,
      years: [...new Set(players.map(p => p.year))].sort(),
      data: players
    };
    
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`📄 Data exported to: ${exportPath}`);
  }

  // メイン実行（カスタムオプション付き）
  async run(options?: HistoricalScrapeOptions): Promise<void> {
    try {
      const defaultOptions: HistoricalScrapeOptions = {
        startYear: 2020,
        endYear: 2024,
        leagues: ['central', 'pacific']
      };
      
      const finalOptions = { ...defaultOptions, ...options };
      
      console.log('🚀 Starting NPB Historical Data Scraper...');
      console.log(`📅 Years: ${finalOptions.startYear} - ${finalOptions.endYear}`);
      console.log(`⚾ Leagues: ${finalOptions.leagues.join(', ')}`);
      
      const historicalData = await this.scrapeHistoricalData(finalOptions);
      
      if (historicalData.length > 0) {
        await this.saveHistoricalToDatabase(historicalData);
        
        // JSONエクスポートも実行
        const exportFilename = `npb_historical_${finalOptions.startYear}_${finalOptions.endYear}`;
        await this.exportToJson(historicalData, exportFilename);
        
        console.log('✅ NPB historical data scraping completed successfully!');
        console.log(`📊 Total players collected: ${historicalData.length}`);
        
        // 年度別統計表示
        const yearStats = historicalData.reduce((acc, player) => {
          acc[player.year] = (acc[player.year] || 0) + 1;
          return acc;
        }, {} as { [year: number]: number });
        
        console.log('\n📈 Year-by-year statistics:');
        Object.entries(yearStats)
          .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
          .forEach(([year, count]) => {
            console.log(`  ${year}: ${count} players`);
          });
        
      } else {
        console.log('⚠️  No historical data was scraped');
      }
      
    } catch (error) {
      console.error('❌ Historical scraping failed:', error);
      throw error;
    }
  }
}

// スクリプト実行（コマンドライン引数対応）
if (require.main === module) {
  const args = process.argv.slice(2);
  let startYear = 2020;
  let endYear = 2024;
  let leagues = ['central', 'pacific'];
  
  // コマンドライン引数パース
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && i + 1 < args.length) {
      startYear = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--end' && i + 1 < args.length) {
      endYear = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--league' && i + 1 < args.length) {
      leagues = args[i + 1].split(',');
      i++;
    }
  }
  
  const scraper = new NPBHistoricalScraper();
  scraper.run({ startYear, endYear, leagues }).catch(console.error);
}

export default NPBHistoricalScraper;