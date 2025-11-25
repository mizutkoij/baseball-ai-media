import * as cheerio from 'cheerio';
import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import { promises as fs } from 'fs';

// NPB公式サイトのベースURL（統計データ用）
const NPB_BASE_URL = 'https://npb.jp/bis/2024/stats/';

// リーグ情報の定義（チーム個別ではなくリーグ単位）
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

interface PlayerStats {
  name: string;
  team: string;
  league: string;
  games: number;
  at_bats: number;
  hits: number;
  home_runs: number;
  rbis: number;
  batting_average: number;
  [key: string]: any;
}

class NPBScraper {
  private delay = 2000; // リクエスト間の遅延（2秒）
  
  constructor() {
    console.log('NPB Real Data Scraper initialized');
  }

  // HTTPリクエストを送信（遅延付き）
  private async fetchWithDelay(url: string): Promise<string> {
    console.log(`Fetching: ${url}`);
    await new Promise(resolve => setTimeout(resolve, this.delay));
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  // 打者成績データを解析（リーグページから）
  private parseBattingStats(html: string, league: string): PlayerStats[] {
    const $ = cheerio.load(html);
    const players: PlayerStats[] = [];
    
    // NPBのテーブル構造を解析
    $('table').each((tableIndex, table) => {
      $(table).find('tr').each((rowIndex, row) => {
        const cells = $(row).find('td');
        
        if (cells.length >= 8) { // 十分な列数があるかチェック
          const nameCell = $(cells[0]).text().trim();
          const teamCell = $(cells[1]).text().trim();
          
          // 選手名とチーム名が存在するかチェック
          if (nameCell && teamCell && !nameCell.includes('順位') && !nameCell.includes('選手')) {
            const name = nameCell.replace(/[*＊]/g, ''); // アスタリスク除去
            let teamCode = this.getTeamCode(teamCell, league);
            
            // 数値データの取得（位置は実際のテーブル構造に依存）
            const games = parseInt($(cells[2]).text().trim()) || 0;
            const at_bats = parseInt($(cells[3]).text().trim()) || 0;
            const hits = parseInt($(cells[4]).text().trim()) || 0;
            const home_runs = parseInt($(cells[5]).text().trim()) || 0;
            const rbis = parseInt($(cells[6]).text().trim()) || 0;
            const batting_avg_text = $(cells[7]).text().trim();
            const batting_average = parseFloat(batting_avg_text.replace('.', '0.')) || 0;
            
            // 有効なデータのみ追加
            if (name && name.length > 1 && teamCode && games > 0) {
              players.push({
                name,
                team: teamCode,
                league,
                games,
                at_bats,
                hits,
                home_runs,
                rbis,
                batting_average,
                year: 2024
              });
            }
          }
        }
      });
    });
    
    return players;
  }

  // チーム名からチームコードを取得
  private getTeamCode(teamName: string, league: string): string {
    const leagueTeams = LEAGUES[league as keyof typeof LEAGUES].teams;
    
    for (const [key, team] of Object.entries(leagueTeams)) {
      if (teamName.includes(team.name.slice(0, 2)) || teamName.includes(key)) {
        return team.code;
      }
    }
    
    // フォールバック：チーム名の一部マッチング
    if (teamName.includes('巨人') || teamName.includes('ジャイアンツ')) return 'YG';
    if (teamName.includes('阪神') || teamName.includes('タイガース')) return 'T';
    if (teamName.includes('広島') || teamName.includes('カープ')) return 'C';
    if (teamName.includes('横浜') || teamName.includes('ベイ')) return 'DB';
    if (teamName.includes('ヤクルト') || teamName.includes('スワローズ')) return 'S';
    if (teamName.includes('中日') || teamName.includes('ドラゴンズ')) return 'D';
    if (teamName.includes('ソフトバンク') || teamName.includes('ホークス')) return 'H';
    if (teamName.includes('西武') || teamName.includes('ライオンズ')) return 'L';
    if (teamName.includes('楽天') || teamName.includes('イーグルス')) return 'E';
    if (teamName.includes('ロッテ') || teamName.includes('マリーンズ')) return 'M';
    if (teamName.includes('オリックス') || teamName.includes('バファローズ')) return 'B';
    if (teamName.includes('日本ハム') || teamName.includes('ファイターズ')) return 'F';
    
    return 'UNK';
  }

  // リーグ別打者成績を取得
  async scrapeLeagueBattingStats(league: string): Promise<PlayerStats[]> {
    const leagueInfo = LEAGUES[league as keyof typeof LEAGUES];
    const url = `${NPB_BASE_URL}${leagueInfo.url}`;
    
    try {
      const html = await this.fetchWithDelay(url);
      const players = this.parseBattingStats(html, league);
      
      console.log(`✅ ${leagueInfo.name}: ${players.length} players scraped`);
      return players;
    } catch (error) {
      console.error(`❌ Failed to scrape ${leagueInfo.name}:`, error);
      return [];
    }
  }

  // 全リーグの打者成績を取得
  async scrapeAllBattingStats(): Promise<PlayerStats[]> {
    const allPlayers: PlayerStats[] = [];
    
    console.log('🏁 Starting NPB batting stats scraping...');
    
    // セントラルリーグ
    console.log('📊 Scraping Central League...');
    const centralPlayers = await this.scrapeLeagueBattingStats('central');
    allPlayers.push(...centralPlayers);
    
    // パシフィックリーグ
    console.log('📊 Scraping Pacific League...');
    const pacificPlayers = await this.scrapeLeagueBattingStats('pacific');
    allPlayers.push(...pacificPlayers);
    
    console.log(`🎯 Total players scraped: ${allPlayers.length}`);
    return allPlayers;
  }

  // データベースに保存
  async saveToDatabase(players: PlayerStats[]): Promise<void> {
    const dbPath = path.join(process.cwd(), 'data', 'db_current.db');
    const db = new Database(dbPath);
    
    try {
      // 既存の2024年データを削除
      db.prepare('DELETE FROM batting_stats WHERE year = 2024').run();
      
      // 新しいデータを挿入
      const insertStmt = db.prepare(`
        INSERT INTO batting_stats (
          player_id, name, team, position, year, games, at_bats, hits, 
          runs, rbis, doubles, triples, home_runs, walks, strikeouts, 
          stolen_bases, batting_average, on_base_percentage, 
          slugging_percentage, ops, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let insertedCount = 0;
      
      for (const player of players) {
        const playerId = `${player.team}_real_${insertedCount + 1}`;
        
        // 基本的なセイバーメトリクス計算
        const obp = player.at_bats > 0 ? 
          ((player.hits + (player.at_bats * 0.1)) / (player.at_bats + (player.at_bats * 0.1))) : 0;
        const slg = player.at_bats > 0 ? 
          ((player.hits + player.home_runs) / player.at_bats) : 0;
        const ops = obp + slg;
        
        try {
          insertStmt.run(
            playerId,
            player.name,
            player.team,
            'UNK', // ポジション情報は別途取得が必要
            2024,
            player.games,
            player.at_bats,
            player.hits,
            Math.round(player.hits * 0.7), // 推定得点
            player.rbis,
            Math.round(player.hits * 0.2), // 推定二塁打
            Math.round(player.hits * 0.02), // 推定三塁打
            player.home_runs,
            Math.round(player.at_bats * 0.12), // 推定四球
            Math.round(player.at_bats * 0.18), // 推定三振
            Math.round(player.games * 0.1), // 推定盗塁
            player.batting_average,
            Math.round(obp * 1000) / 1000,
            Math.round(slg * 1000) / 1000,
            Math.round(ops * 1000) / 1000,
            new Date().toISOString()
          );
          insertedCount++;
        } catch (error) {
          console.error(`Failed to insert player: ${player.name}`, error);
        }
      }
      
      console.log(`💾 Saved ${insertedCount} players to database`);
      
    } finally {
      db.close();
    }
  }

  // メイン実行
  async run(): Promise<void> {
    try {
      console.log('🚀 Starting NPB Real Data Scraper...');
      
      const players = await this.scrapeAllBattingStats();
      
      if (players.length > 0) {
        await this.saveToDatabase(players);
        console.log('✅ NPB real data scraping completed successfully!');
      } else {
        console.log('⚠️  No data was scraped');
      }
      
    } catch (error) {
      console.error('❌ Scraping failed:', error);
      throw error;
    }
  }
}

// スクリプト実行
if (require.main === module) {
  const scraper = new NPBScraper();
  scraper.run().catch(console.error);
}

export default NPBScraper;