#!/usr/bin/env node
import * as cheerio from 'cheerio';
import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import { promises as fs } from 'fs';

// NPB公式サイトの詳細データURL
const NPB_BASE_URL = 'https://npb.jp/bis';

// 詳細データ収集のためのエンドポイント定義
const DATA_ENDPOINTS = {
  // 打者成績（詳細）
  batting: {
    central: 'bat_c.html',
    pacific: 'bat_p.html'
  },
  // 投手成績（詳細）
  pitching: {
    central: 'pit_c.html', 
    pacific: 'pit_p.html'
  },
  // 守備成績
  fielding: {
    central: 'fie_c.html',
    pacific: 'fie_p.html'
  },
  // チーム成績
  team: {
    central: 'std_c.html',
    pacific: 'std_p.html'
  },
  // 個人記録
  records: {
    batting_leaders: 'lb_avg_c.html', // バッティングリーダー
    pitching_leaders: 'lp_era_c.html', // ピッチングリーダー
    rookie_records: 'rook.html' // 新人記録
  }
};

// NPBチーム詳細マッピング
const ENHANCED_TEAM_DATA = {
  // セントラルリーグ
  'G': { code: 'G', shortName: '巨人', fullName: '読売ジャイアンツ', league: 'central', city: '東京', stadium: '東京ドーム', founded: 1934, primaryColor: '#FF6600', secondaryColor: '#000000' },
  'T': { code: 'T', shortName: '阪神', fullName: '阪神タイガース', league: 'central', city: '大阪', stadium: '阪神甲子園球場', founded: 1935, primaryColor: '#FFE500', secondaryColor: '#000000' },
  'C': { code: 'C', shortName: '広島', fullName: '広島東洋カープ', league: 'central', city: '広島', stadium: 'MAZDA Zoom-Zoom スタジアム広島', founded: 1950, primaryColor: '#DC143C', secondaryColor: '#FFFFFF' },
  'DB': { code: 'DB', shortName: 'DeNA', fullName: '横浜DeNAベイスターズ', league: 'central', city: '横浜', stadium: '横浜スタジアム', founded: 1950, primaryColor: '#006BB0', secondaryColor: '#FFFFFF' },
  'S': { code: 'S', shortName: 'ヤクルト', fullName: '東京ヤクルトスワローズ', league: 'central', city: '東京', stadium: '明治神宮野球場', founded: 1950, primaryColor: '#3A5FCD', secondaryColor: '#DC143C' },
  'D': { code: 'D', shortName: '中日', fullName: '中日ドラゴンズ', league: 'central', city: '名古屋', stadium: 'バンテリンドーム ナゴヤ', founded: 1936, primaryColor: '#003DA5', secondaryColor: '#FFFFFF' },
  
  // パシフィックリーグ
  'H': { code: 'H', shortName: 'ソフトバンク', fullName: '福岡ソフトバンクホークス', league: 'pacific', city: '福岡', stadium: 'みずほPayPayドーム福岡', founded: 1938, primaryColor: '#FFD700', secondaryColor: '#000000' },
  'L': { code: 'L', shortName: '西武', fullName: '埼玉西武ライオンズ', league: 'pacific', city: '埼玉', stadium: 'ベルーナドーム', founded: 1950, primaryColor: '#00008B', secondaryColor: '#FF0000' },
  'E': { code: 'E', shortName: '楽天', fullName: '東北楽天ゴールデンイーグルス', league: 'pacific', city: '仙台', stadium: '楽天モバイルパーク宮城', founded: 2005, primaryColor: '#8B0000', secondaryColor: '#FFD700' },
  'M': { code: 'M', shortName: 'ロッテ', fullName: '千葉ロッテマリーンズ', league: 'pacific', city: '千葉', stadium: 'ZOZOマリンスタジアム', founded: 1950, primaryColor: '#000080', secondaryColor: '#FF0000' },
  'B': { code: 'B', shortName: 'オリックス', fullName: 'オリックス・バファローズ', league: 'pacific', city: '大阪', stadium: '京セラドーム大阪', founded: 1936, primaryColor: '#003DA5', secondaryColor: '#FFD700' },
  'F': { code: 'F', shortName: '日本ハム', fullName: '北海道日本ハムファイターズ', league: 'pacific', city: '札幌', stadium: 'エスコンフィールド HOKKAIDO', founded: 1946, primaryColor: '#87CEEB', secondaryColor: '#FFD700' }
};

// 詳細打者成績インターフェース
interface EnhancedBattingStats {
  // 基本情報
  player_id: string;
  name: string;
  team_code: string;
  team_name: string;
  league: string;
  position: string;
  uniform_number?: string;
  year: number;
  
  // 基本打撃成績
  games: number;
  plate_appearances: number;
  at_bats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  home_runs: number;
  total_bases: number;
  rbis: number;
  stolen_bases: number;
  caught_stealing: number;
  sacrifice_hits: number;
  sacrifice_flies: number;
  walks: number;
  intentional_walks: number;
  hit_by_pitch: number;
  strikeouts: number;
  double_plays: number;
  
  // 計算指標
  batting_average: number;
  on_base_percentage: number;
  slugging_percentage: number;
  ops: number;
  
  // セイバーメトリクス（推定）
  woba?: number;
  wrc_plus?: number;
  babip?: number;
  iso?: number;
  
  // 品質メタデータ
  data_quality_score: number;
  last_updated: string;
  data_source: string;
}

// 詳細投手成績インターフェース  
interface EnhancedPitchingStats {
  // 基本情報
  player_id: string;
  name: string;
  team_code: string;
  team_name: string;
  league: string;
  position: string;
  uniform_number?: string;
  year: number;
  
  // 基本投手成績
  games: number;
  games_started: number;
  complete_games: number;
  shutouts: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  innings_pitched: number;
  hits_allowed: number;
  home_runs_allowed: number;
  walks_allowed: number;
  intentional_walks_allowed: number;
  hit_batsmen: number;
  strikeouts: number;
  wild_pitches: number;
  balks: number;
  runs_allowed: number;
  earned_runs: number;
  
  // 計算指標
  era: number;
  whip: number;
  k_per_9: number;
  bb_per_9: number;
  
  // セイバーメトリクス（推定）
  fip?: number;
  xfip?: number;
  babip_against?: number;
  
  // 品質メタデータ
  data_quality_score: number;
  last_updated: string;
  data_source: string;
}

class EnhancedNPBScraper {
  private delay = 2500; // より慎重な間隔
  private maxRetries = 3;
  
  constructor() {
    console.log('🚀 Enhanced NPB Data Scraper initialized');
  }

  // 高度なHTTP取得（キャッシュ・リトライ付き）
  private async fetchWithEnhancements(url: string, retries = this.maxRetries): Promise<string> {
    console.log(`📡 Fetching enhanced data: ${url}`);
    await new Promise(resolve => setTimeout(resolve, this.delay));
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 15000,
          maxRedirects: 3
        });
        
        console.log(`✅ Successfully fetched: ${url} (${response.data.length} chars)`);
        return response.data;
      } catch (error: any) {
        console.warn(`⚠️  Attempt ${attempt}/${retries} failed for ${url}: ${error.message}`);
        
        if (attempt === retries) {
          console.error(`❌ All attempts failed for ${url}`);
          throw error;
        }
        
        // 段階的にバックオフ
        await new Promise(resolve => setTimeout(resolve, this.delay * attempt * 2));
      }
    }
    
    throw new Error('All retry attempts failed');
  }

  // 高度なテーブル解析（複数パターン対応）
  private parseEnhancedBattingTable(html: string, league: string, year: number): EnhancedBattingStats[] {
    const $ = cheerio.load(html);
    const players: EnhancedBattingStats[] = [];
    
    console.log(`🔍 Analyzing batting table structure for ${league} ${year}...`);
    
    // メインデータテーブルを探索
    $('table').each((tableIndex, table) => {
      const tableText = $(table).text();
      // 打者成績テーブルを識別（表のヘッダーテキストから判断）
      const has打率 = tableText.includes('打率') || tableText.includes('打　率');
      const has安打 = tableText.includes('安打') || tableText.includes('安　打');
      const has順位 = tableText.includes('順位') || tableText.includes('順　位');
      const has選手 = tableText.includes('選手') || tableText.includes('選　手');
      const has本塁打 = tableText.includes('本塁打') || tableText.includes('本塁打');
      const hasRows = $(table).find('tr').length > 20; // 充分な行数があるか
      
      // 主要な打撃統計と選手順位データが含まれているかチェック  
      if (has打率 && (has順位 || has選手) && hasRows) {
        console.log(`📊 Found batting stats table (table ${tableIndex}) with ${$(table).find('tr').length} rows`);
        
        $(table).find('tr').each((rowIndex, row) => {
          const cells = $(row).find('td');
          
          if (cells.length >= 20) { // 充分な列数をチェック
            try {
              // 基本データ抽出 (NPB実際の構造に合わせて修正)
              const rank = parseInt($(cells[0]).text().trim()) || 0;
              const nameText = $(cells[1]).text().trim();
              const teamText = $(cells[2]).text().trim(); // "(デ)" 形式
              const battingAvg = parseFloat($(cells[3]).text().trim()) || 0;
              
              // 有効な選手データかチェック
              if (nameText && nameText.length > 1 && teamText && battingAvg > 0 && rank > 0) {
                const name = nameText.replace(/[*＊]/g, '').trim();
                const teamCode = this.getEnhancedTeamCode(teamText);
                const teamInfo = ENHANCED_TEAM_DATA[teamCode];
                
                if (teamInfo && name.length > 1) {
                  // 詳細統計データの抽出 (NPB実際の構造: 順位,選手,チーム,打率,試合,打席,打数,得点,安打,二塁打,三塁打,本塁打,塁打,打点,盗塁,盗塁刺,犠打,犠飛,四球,故意四,死球,三振,併殺打,長打率,出塁率)
                  const games = parseInt($(cells[4]).text().trim()) || 0;          // 試合
                  const plateAppearances = parseInt($(cells[5]).text().trim()) || 0; // 打席
                  const atBats = parseInt($(cells[6]).text().trim()) || 0;         // 打数
                  const runs = parseInt($(cells[7]).text().trim()) || 0;           // 得点
                  const hits = parseInt($(cells[8]).text().trim()) || 0;           // 安打
                  const doubles = parseInt($(cells[9]).text().trim()) || 0;        // 二塁打
                  const triples = parseInt($(cells[10]).text().trim()) || 0;       // 三塁打
                  const homeRuns = parseInt($(cells[11]).text().trim()) || 0;      // 本塁打
                  const totalBases = parseInt($(cells[12]).text().trim()) || 0;    // 塁打
                  const rbis = parseInt($(cells[13]).text().trim()) || 0;          // 打点
                  const stolenBases = parseInt($(cells[14]).text().trim()) || 0;   // 盗塁
                  const caughtStealing = parseInt($(cells[15]).text().trim()) || 0; // 盗塁刺
                  const sacrificeHits = parseInt($(cells[16]).text().trim()) || 0;  // 犠打
                  const sacrificeFlies = parseInt($(cells[17]).text().trim()) || 0; // 犠飛
                  const walks = parseInt($(cells[18]).text().trim()) || 0;         // 四球
                  const intentionalWalks = parseInt($(cells[19]).text().trim()) || 0; // 故意四
                  const hitByPitch = parseInt($(cells[20]).text().trim()) || 0;    // 死球
                  const strikeouts = parseInt($(cells[21]).text().trim()) || 0;    // 三振
                  const doublePlays = parseInt($(cells[22]).text().trim()) || 0;   // 併殺打
                  const sluggingPct = parseFloat($(cells[23]).text().trim()) || 0; // 長打率
                  const onBasePct = parseFloat($(cells[24]).text().trim()) || 0;   // 出塁率
                  
                  // セイバーメトリクス計算
                  const ops = onBasePct + sluggingPct;
                  const iso = sluggingPct - battingAvg;
                  const babip = atBats > strikeouts ? 
                    ((hits - homeRuns) / (atBats - strikeouts - sacrificeFlies + sacrificeHits)) : 0;
                  
                  // wOBA推定計算（簡易版）
                  const woba = plateAppearances > 0 ? 
                    ((0.69 * walks) + (0.72 * hitByPitch) + (0.89 * (hits - doubles - triples - homeRuns)) + 
                     (1.27 * doubles) + (1.62 * triples) + (2.10 * homeRuns)) / plateAppearances : 0;
                  
                  // データ品質スコア計算
                  let qualityScore = 0;
                  if (plateAppearances >= 50) qualityScore += 25;
                  if (games >= 20) qualityScore += 25;
                  if (battingAvg > 0 && battingAvg < 1) qualityScore += 25;
                  if (hits <= atBats) qualityScore += 25;
                  
                  const playerStats: EnhancedBattingStats = {
                    player_id: `${teamCode}_${year}_${name.replace(/\s+/g, '_')}`,
                    name,
                    team_code: teamCode,
                    team_name: teamInfo.fullName,
                    league: teamInfo.league,
                    position: 'UNK', // ポジション情報は別途必要
                    year,
                    
                    games,
                    plate_appearances: plateAppearances,
                    at_bats: atBats,
                    runs,
                    hits,
                    doubles,
                    triples,
                    home_runs: homeRuns,
                    total_bases: totalBases,
                    rbis,
                    stolen_bases: stolenBases,
                    caught_stealing: caughtStealing,
                    sacrifice_hits: sacrificeHits,
                    sacrifice_flies: sacrificeFlies,
                    walks,
                    intentional_walks: intentionalWalks,
                    hit_by_pitch: hitByPitch,
                    strikeouts,
                    double_plays: doublePlays,
                    
                    batting_average: battingAvg,
                    on_base_percentage: onBasePct,
                    slugging_percentage: sluggingPct,
                    ops,
                    
                    woba,
                    babip,
                    iso,
                    wrc_plus: 100, // 後で正確に計算
                    
                    data_quality_score: qualityScore,
                    last_updated: new Date().toISOString(),
                    data_source: 'npb.jp_enhanced_scraper'
                  };
                  
                  players.push(playerStats);
                  console.log(`✅ Enhanced player data: ${name} (${teamInfo.shortName}) - Quality: ${qualityScore}%`);
                }
              }
            } catch (error) {
              console.warn(`⚠️  Failed to parse row ${rowIndex}:`, error);
            }
          }
        });
      }
    });
    
    console.log(`📈 Parsed ${players.length} enhanced batting records for ${league} ${year}`);
    return players;
  }

  // 強化されたチームコード取得 (NPBの括弧付き形式に対応)
  private getEnhancedTeamCode(teamName: string): string {
    // 括弧を除去して正規化
    const cleanTeamName = teamName.replace(/[()（）]/g, '').trim();
    
    // NPBの略称マッピング (実際のHTMLで使用される形式)
    const npbMappings: { [key: string]: string } = {
      'デ': 'DB',    // DeNA
      '巨': 'G',     // 巨人
      '阪': 'T',     // 阪神
      '神': 'T',     // 阪神 (神戸の略称)
      '広': 'C',     // 広島
      'ヤ': 'S',     // ヤクルト
      '中': 'D',     // 中日
      'ソ': 'H',     // ソフトバンク
      '西': 'L',     // 西武
      '楽': 'E',     // 楽天
      'ロ': 'M',     // ロッテ
      'オ': 'B',     // オリックス
      '日': 'F'      // 日本ハム
    };
    
    // NPB略称による直接マッチング
    if (npbMappings[cleanTeamName]) {
      return npbMappings[cleanTeamName];
    }
    
    // 直接コードマッチング
    for (const [code, info] of Object.entries(ENHANCED_TEAM_DATA)) {
      if (cleanTeamName === code || 
          cleanTeamName.includes(info.shortName) || 
          cleanTeamName.includes(info.fullName.slice(0, 3))) {
        return code;
      }
    }
    
    // フォールバックパターン
    const fallbackMappings: { [key: string]: string } = {
      '巨人': 'G', 'ジャイアンツ': 'G', 'YG': 'G',
      '阪神': 'T', 'タイガース': 'T',
      '広島': 'C', 'カープ': 'C', 'Ｃ': 'C',
      'DeNA': 'DB', 'ベイ': 'DB', '横浜': 'DB',
      'ヤクルト': 'S', 'スワローズ': 'S',
      '中日': 'D', 'ドラゴンズ': 'D',
      'ソフトバンク': 'H', 'ホークス': 'H', 'SB': 'H',
      '西武': 'L', 'ライオンズ': 'L',
      '楽天': 'E', 'イーグルス': 'E',
      'ロッテ': 'M', 'マリーンズ': 'M',
      'オリックス': 'B', 'バファローズ': 'B',
      '日本ハム': 'F', 'ファイターズ': 'F'
    };
    
    for (const [pattern, code] of Object.entries(fallbackMappings)) {
      if (cleanTeamName.includes(pattern)) {
        return code;
      }
    }
    
    console.warn(`⚠️  Unknown team name: ${teamName} (cleaned: ${cleanTeamName})`);
    return 'UNK';
  }

  // 年度・リーグ別の詳細データ取得
  async scrapeEnhancedBattingData(year: number, league: 'central' | 'pacific'): Promise<EnhancedBattingStats[]> {
    const endpoint = DATA_ENDPOINTS.batting[league];
    const url = `${NPB_BASE_URL}/${year}/stats/${endpoint}`;
    
    try {
      console.log(`🎯 Scraping enhanced ${year} ${league} batting data...`);
      const html = await this.fetchWithEnhancements(url);
      const players = this.parseEnhancedBattingTable(html, league, year);
      
      console.log(`✅ Enhanced scraping complete: ${players.length} players from ${league} ${year}`);
      return players;
    } catch (error) {
      console.error(`❌ Failed to scrape enhanced ${year} ${league} data:`, error);
      return [];
    }
  }

  // 全リーグの詳細データ取得
  async scrapeAllEnhancedBattingData(year: number): Promise<EnhancedBattingStats[]> {
    console.log(`🚀 Starting enhanced batting data collection for ${year}...`);
    
    const allPlayers: EnhancedBattingStats[] = [];
    
    // セントラルリーグ
    console.log(`📊 Processing Central League ${year}...`);
    const centralPlayers = await this.scrapeEnhancedBattingData(year, 'central');
    allPlayers.push(...centralPlayers);
    
    await new Promise(resolve => setTimeout(resolve, this.delay));
    
    // パシフィックリーグ
    console.log(`📊 Processing Pacific League ${year}...`);
    const pacificPlayers = await this.scrapeEnhancedBattingData(year, 'pacific');
    allPlayers.push(...pacificPlayers);
    
    console.log(`🎯 Enhanced collection complete: ${allPlayers.length} total players for ${year}`);
    return allPlayers;
  }

  // 品質向上されたデータベース保存
  async saveEnhancedDataToDatabase(players: EnhancedBattingStats[]): Promise<void> {
    const dbPath = path.join(process.cwd(), 'data', 'db_enhanced.db');
    
    // データベースディレクトリ作成
    const dbDir = path.dirname(dbPath);
    await fs.mkdir(dbDir, { recursive: true });
    
    const db = new Database(dbPath);
    
    try {
      // 拡張テーブル作成
      db.prepare(`
        CREATE TABLE IF NOT EXISTS enhanced_batting_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_id TEXT UNIQUE,
          name TEXT NOT NULL,
          team_code TEXT NOT NULL,
          team_name TEXT NOT NULL,
          league TEXT NOT NULL,
          position TEXT DEFAULT 'UNK',
          uniform_number TEXT,
          year INTEGER NOT NULL,
          
          -- 基本打撃成績
          games INTEGER DEFAULT 0,
          plate_appearances INTEGER DEFAULT 0,
          at_bats INTEGER DEFAULT 0,
          runs INTEGER DEFAULT 0,
          hits INTEGER DEFAULT 0,
          doubles INTEGER DEFAULT 0,
          triples INTEGER DEFAULT 0,
          home_runs INTEGER DEFAULT 0,
          total_bases INTEGER DEFAULT 0,
          rbis INTEGER DEFAULT 0,
          stolen_bases INTEGER DEFAULT 0,
          caught_stealing INTEGER DEFAULT 0,
          sacrifice_hits INTEGER DEFAULT 0,
          sacrifice_flies INTEGER DEFAULT 0,
          walks INTEGER DEFAULT 0,
          intentional_walks INTEGER DEFAULT 0,
          hit_by_pitch INTEGER DEFAULT 0,
          strikeouts INTEGER DEFAULT 0,
          double_plays INTEGER DEFAULT 0,
          
          -- 計算指標
          batting_average REAL DEFAULT 0.0,
          on_base_percentage REAL DEFAULT 0.0,
          slugging_percentage REAL DEFAULT 0.0,
          ops REAL DEFAULT 0.0,
          
          -- セイバーメトリクス
          woba REAL,
          wrc_plus REAL,
          babip REAL,
          iso REAL,
          
          -- 品質メタデータ
          data_quality_score INTEGER DEFAULT 0,
          last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
          data_source TEXT DEFAULT 'enhanced_scraper',
          
          UNIQUE(name, team_code, year)
        )
      `).run();
      
      // インデックス作成
      db.prepare('CREATE INDEX IF NOT EXISTS idx_enhanced_player_year ON enhanced_batting_stats(player_id, year)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_enhanced_team_year ON enhanced_batting_stats(team_code, year)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_enhanced_quality ON enhanced_batting_stats(data_quality_score DESC)').run();
      
      // データ挿入
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO enhanced_batting_stats (
          player_id, name, team_code, team_name, league, position, year,
          games, plate_appearances, at_bats, runs, hits, doubles, triples, home_runs, total_bases, rbis,
          stolen_bases, caught_stealing, sacrifice_hits, sacrifice_flies, walks, intentional_walks,
          hit_by_pitch, strikeouts, double_plays,
          batting_average, on_base_percentage, slugging_percentage, ops,
          woba, wrc_plus, babip, iso,
          data_quality_score, last_updated, data_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let savedCount = 0;
      let highQualityCount = 0;
      
      for (const player of players) {
        try {
          insertStmt.run(
            player.player_id, player.name, player.team_code, player.team_name, player.league, player.position, player.year,
            player.games, player.plate_appearances, player.at_bats, player.runs, player.hits, player.doubles, player.triples,
            player.home_runs, player.total_bases, player.rbis, player.stolen_bases, player.caught_stealing,
            player.sacrifice_hits, player.sacrifice_flies, player.walks, player.intentional_walks,
            player.hit_by_pitch, player.strikeouts, player.double_plays,
            player.batting_average, player.on_base_percentage, player.slugging_percentage, player.ops,
            player.woba, player.wrc_plus, player.babip, player.iso,
            player.data_quality_score, player.last_updated, player.data_source
          );
          
          savedCount++;
          if (player.data_quality_score >= 75) highQualityCount++;
        } catch (error) {
          console.error(`Failed to save enhanced player: ${player.name}`, error);
        }
      }
      
      console.log(`💾 Enhanced database save complete:`);
      console.log(`   📊 Total saved: ${savedCount} players`);
      console.log(`   🏆 High quality (75%+): ${highQualityCount} players`);
      console.log(`   📈 Quality rate: ${((highQualityCount/savedCount)*100).toFixed(1)}%`);
      
    } finally {
      db.close();
    }
  }

  // 品質分析レポート生成
  async generateQualityReport(players: EnhancedBattingStats[]): Promise<void> {
    const reportDir = path.join(process.cwd(), 'data', 'reports');
    await fs.mkdir(reportDir, { recursive: true });
    
    const qualityReport = {
      generated_at: new Date().toISOString(),
      total_players: players.length,
      quality_distribution: {
        excellent: players.filter(p => p.data_quality_score >= 90).length,
        good: players.filter(p => p.data_quality_score >= 75 && p.data_quality_score < 90).length,
        fair: players.filter(p => p.data_quality_score >= 50 && p.data_quality_score < 75).length,
        poor: players.filter(p => p.data_quality_score < 50).length
      },
      league_breakdown: {
        central: players.filter(p => p.league === 'central').length,
        pacific: players.filter(p => p.league === 'pacific').length
      },
      team_breakdown: {},
      statistical_summary: {
        avg_batting_avg: players.reduce((sum, p) => sum + p.batting_average, 0) / players.length,
        avg_ops: players.reduce((sum, p) => sum + p.ops, 0) / players.length,
        total_home_runs: players.reduce((sum, p) => sum + p.home_runs, 0),
        total_rbis: players.reduce((sum, p) => sum + p.rbis, 0)
      }
    };
    
    // チーム別集計
    for (const player of players) {
      const teamInfo = ENHANCED_TEAM_DATA[player.team_code];
      if (teamInfo) {
        if (!qualityReport.team_breakdown[player.team_code]) {
          qualityReport.team_breakdown[player.team_code] = {
            team_name: teamInfo.shortName,
            count: 0,
            avg_quality: 0
          };
        }
        qualityReport.team_breakdown[player.team_code].count++;
      }
    }
    
    // チーム別品質平均計算
    for (const teamCode of Object.keys(qualityReport.team_breakdown)) {
      const teamPlayers = players.filter(p => p.team_code === teamCode);
      qualityReport.team_breakdown[teamCode].avg_quality = 
        teamPlayers.reduce((sum, p) => sum + p.data_quality_score, 0) / teamPlayers.length;
    }
    
    const reportPath = path.join(reportDir, `enhanced_quality_report_${new Date().toISOString().slice(0, 10)}.json`);
    await fs.writeFile(reportPath, JSON.stringify(qualityReport, null, 2), 'utf-8');
    
    console.log(`📋 Quality report generated: ${reportPath}`);
    console.log(`🎯 Quality Summary:`);
    console.log(`   🌟 Excellent (90%+): ${qualityReport.quality_distribution.excellent} players`);
    console.log(`   ✅ Good (75-89%): ${qualityReport.quality_distribution.good} players`);
    console.log(`   ⚠️  Fair (50-74%): ${qualityReport.quality_distribution.fair} players`);
    console.log(`   ❌ Poor (<50%): ${qualityReport.quality_distribution.poor} players`);
  }

  // メイン実行メソッド
  async run(year: number = 2024): Promise<void> {
    try {
      console.log(`🚀 Starting Enhanced NPB Data Scraper for ${year}...`);
      
      const enhancedPlayers = await this.scrapeAllEnhancedBattingData(year);
      
      if (enhancedPlayers.length > 0) {
        await this.saveEnhancedDataToDatabase(enhancedPlayers);
        await this.generateQualityReport(enhancedPlayers);
        
        console.log(`✅ Enhanced NPB data scraping completed successfully!`);
        console.log(`📊 Final Statistics:`);
        console.log(`   🎯 Total Players: ${enhancedPlayers.length}`);
        console.log(`   🏆 Average Quality: ${(enhancedPlayers.reduce((sum, p) => sum + p.data_quality_score, 0) / enhancedPlayers.length).toFixed(1)}%`);
        console.log(`   ⚾ Top Performer: ${enhancedPlayers.sort((a, b) => b.batting_average - a.batting_average)[0]?.name || 'N/A'}`);
        
      } else {
        console.log('⚠️  No enhanced data was collected');
      }
      
    } catch (error) {
      console.error('❌ Enhanced scraping failed:', error);
      throw error;
    }
  }
}

// スクリプト実行
if (require.main === module) {
  const args = process.argv.slice(2);
  let year = 2024;
  
  // 年度指定対応
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year' && i + 1 < args.length) {
      year = parseInt(args[i + 1]);
      i++;
    }
  }
  
  const scraper = new EnhancedNPBScraper();
  scraper.run(year).catch(console.error);
}

export default EnhancedNPBScraper;