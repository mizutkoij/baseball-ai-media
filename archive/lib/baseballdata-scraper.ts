/**
 * BaseballData.jp プレイヤー詳細データスクレイピングシステム
 * 
 * URL パターン:
 * - 基本: /playerB/{id}.html (投手は playerP)
 * - Sabr & 選球眼: .../{id}_2.html
 * - 状況別: .../{id}_3.html, .../{id}_4.html, .../{id}_5.html
 * - 全打席ログ: .../{id}S.html
 * - コース別: .../{id}_course.html
 * - 過去年度: /{year}/playerB/{id}.html
 * 
 * プレイヤーID形式: 2000056 (2000 = 入団年, 056 = その年の連番)
 * 既存データとの互換性を保ちつつ、新規データを補完する設計
 */

import * as cheerio from 'cheerio';

// 既存DBスキーマとの互換性を保つ基本プレイヤー情報
export interface BaseballDataPlayer {
  player_id: string;
  name: string;
  team: string;
  position: string;
  player_type: 'batter' | 'pitcher';
  entry_year: number;
  year_number: number;
  updated_at: string;
}

// メインシーズン成績 (season_stats テーブルと互換)
export interface SeasonStats {
  player_id: string;
  season: number;
  games: number;
  at_bats: number;
  hits: number;
  doubles: number;
  triples: number;
  home_runs: number;
  rbis: number;
  runs: number;
  walks: number;
  strikeouts: number;
  stolen_bases: number;
  batting_average: number;
  on_base_percentage: number;
  slugging_percentage: number;
  ops: number;
  updated_at: string;
}

// Sabr & 選球眼 (_2.html ページ)
export interface SabrEyeStats {
  player_id: string;
  season: number;
  noi: number;
  gpa: number;
  isop: number;
  babip: number;
  bb_k: number;
  contact_rate: number;
  swing_rate: number;
  chase_rate: number;
  updated_at: string;
}

// 投手シーズン成績
export interface PitcherSeasonStats {
  player_id: string;
  season: number;
  games: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  era: number;
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  walks: number;
  strikeouts: number;
  home_runs_allowed: number;
  whip: number;
  updated_at: string;
}

// 月別成績 (_3.html ページ)
export interface SplitMonthStats {
  player_id: string;
  season: number;
  month: number;
  games: number;
  batting_average: number;
  slugging_percentage: number;
  on_base_percentage: number;
  ops: number;
  home_runs: number;
  rbis: number;
  updated_at: string;
}

// 対戦相手別成績
export interface SplitVsTeamStats {
  player_id: string;
  season: number;
  opp_team: string;
  games: number;
  batting_average: number;
  slugging_percentage: number;
  on_base_percentage: number;
  ops: number;
  home_runs: number;
  rbis: number;
  updated_at: string;
}

// コース別成績 (_course.html)
export interface CourseStats {
  player_id: string;
  season: number;
  zone: string;
  at_bats: number;
  hits: number;
  strikeouts: number;
  home_runs: number;
  batting_average: number;
  updated_at: string;
}

// 全打席ログ (S suffix page)
export interface PlateAppearanceLog {
  player_id: string;
  season: number;
  game_date: string;
  pa_no: number;
  opponent: string;
  location: 'home' | 'away';
  batting_order: number;
  inning: number;
  count: string;
  result: string;
  risp: boolean;
  bases: string;
  score_diff: number;
  outcome_type: 'hit' | 'out' | 'walk' | 'strikeout' | 'homerun' | 'error' | 'other';
  updated_at: string;
}

/**
 * BaseballData.jp スクレイパー
 */
export class BaseballDataScraper {
  private baseUrl = 'https://baseballdata.jp';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private delayMs = 1000; // 1秒間隔でリスペクトあるアクセス

  /**
   * プレイヤーIDから入団年と連番を抽出
   * ID形式: 入団年-1 + 連番
   * 例: 2000001 = 2021年入団1番目, 1900001 = 2020年入団1番目
   */
  parsePlayerId(playerId: string): { entryYear: number; yearNumber: number; dataYear: number } {
    if (!/^\d{6,7}$/.test(playerId)) {
      throw new Error(`Invalid player ID format: ${playerId}. Expected 6-7 digits.`);
    }
    
    let entryYearMinus1: number;
    let yearNumber: number;
    
    if (playerId.length === 7) {
      // 2000年以降: 2000001 (2021年入団)
      entryYearMinus1 = parseInt(playerId.substring(0, 2));
      yearNumber = parseInt(playerId.substring(2));
    } else {
      // 2009年以前: 700001 (2007年入団)
      entryYearMinus1 = parseInt(playerId.substring(0, 1));
      yearNumber = parseInt(playerId.substring(1));
    }
    
    const entryYear = entryYearMinus1 + 2001; // 20 -> 2021, 19 -> 2020, 7 -> 2008
    const dataYear = entryYear + 1; // データが保存されている年度
    
    return { entryYear, yearNumber, dataYear };
  }

  /**
   * プレイヤーIDからプレイヤーの存在を確認し、基本情報を取得
   */
  async discoverPlayer(playerId: string): Promise<BaseballDataPlayer | null> {
    try {
      const { entryYear, yearNumber, dataYear } = this.parsePlayerId(playerId);
      
      // 正しいURL構造: /{dataYear}/playerB/{playerId}.html
      const batterUrl = `${this.baseUrl}/${dataYear}/playerB/${playerId}.html`;
      const batterData = await this.tryFetchPlayerData(batterUrl, playerId, 'batter', entryYear, yearNumber);
      if (batterData) return batterData;
      
      // 野手で見つからない場合は投手として試行
      const pitcherUrl = `${this.baseUrl}/${dataYear}/playerP/${playerId}.html`;
      const pitcherData = await this.tryFetchPlayerData(pitcherUrl, playerId, 'pitcher', entryYear, yearNumber);
      if (pitcherData) return pitcherData;
      
      return null; // 両方で見つからない場合
      
    } catch (error) {
      console.warn(`Error discovering player ${playerId}:`, error);
      return null;
    }
  }

  /**
   * 指定URLでプレイヤーデータの取得を試行
   */
  private async tryFetchPlayerData(
    url: string, 
    playerId: string, 
    playerType: 'batter' | 'pitcher',
    entryYear: number,
    yearNumber: number
  ): Promise<BaseballDataPlayer | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null; // プレイヤーが存在しない
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // ページにプレイヤー情報が存在するか確認
      const playerName = $('h1, .player-name, .name').first().text().trim();
      if (!playerName) return null;
      
      // チーム情報を抽出
      const teamInfo = $('th:contains("チーム"), th:contains("所属")').next('td').text().trim();
      const team = teamInfo || '';
      
      // ポジション情報を抽出
      const positionInfo = $('th:contains("ポジション"), th:contains("守備")').next('td').text().trim();
      const position = positionInfo || (playerType === 'pitcher' ? '投手' : '野手');

      return {
        player_id: playerId,
        name: playerName,
        team,
        position,
        player_type: playerType,
        entry_year: entryYear,
        year_number: yearNumber,
        updated_at: new Date().toISOString()
      };

    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null; // 404エラーは正常（プレイヤーが存在しない）
      }
      throw error; // その他のエラーは再スロー
    }
  }

  /**
   * URL生成ユーティリティ
   */
  private buildUrl(playerId: string, suffix: string = '', year?: number, playerType: 'B' | 'P' = 'B'): string {
    const currentYear = new Date().getFullYear();
    const yearPath = (year && year !== currentYear) ? `/${year}` : '';
    return `${this.baseUrl}${yearPath}/player${playerType}/${playerId}${suffix}.html`;
  }

  /**
   * メインシーズン成績を取得 (打者)
   */
  async fetchSeasonStats(playerId: string, year?: number): Promise<SeasonStats> {
    const url = this.buildUrl(playerId, '', year, 'B');
    
    try {
      console.log(`Fetching season stats: ${url}`);
      const html = await this.fetchWithDelay(url);
      const $ = cheerio.load(html);
      
      return this.parseSeasonStats($, playerId, year || new Date().getFullYear());
      
    } catch (error) {
      console.error(`Failed to fetch season stats for ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Sabr & 選球眼データを取得 (_2.html)
   */
  async fetchSabrEyeStats(playerId: string, year?: number): Promise<SabrEyeStats> {
    const url = this.buildUrl(playerId, '_2', year, 'B');
    
    try {
      console.log(`Fetching sabr/eye stats: ${url}`);
      const html = await this.fetchWithDelay(url);
      const $ = cheerio.load(html);
      
      return this.parseSabrEyeStats($, playerId, year || new Date().getFullYear());
      
    } catch (error) {
      console.error(`Failed to fetch sabr/eye stats for ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * 月別成績を取得 (_3.html)
   */
  async fetchSplitMonthStats(playerId: string, year?: number): Promise<SplitMonthStats[]> {
    const url = this.buildUrl(playerId, '_3', year, 'B');
    
    try {
      console.log(`Fetching monthly splits: ${url}`);
      const html = await this.fetchWithDelay(url);
      const $ = cheerio.load(html);
      
      return this.parseSplitMonthStats($, playerId, year || new Date().getFullYear());
      
    } catch (error) {
      console.error(`Failed to fetch monthly splits for ${playerId}:`, error);
      return [];
    }
  }

  /**
   * コース別成績を取得 (_course.html)
   */
  async fetchCourseStats(playerId: string, year?: number): Promise<CourseStats[]> {
    const url = this.buildUrl(playerId, '_course', year, 'B');
    
    try {
      console.log(`Fetching course stats: ${url}`);
      const html = await this.fetchWithDelay(url);
      const $ = cheerio.load(html);
      
      return this.parseCourseStats($, playerId, year || new Date().getFullYear());
      
    } catch (error) {
      console.error(`Failed to fetch course stats for ${playerId}:`, error);
      return [];
    }
  }

  /**
   * 拡張ページデータを取得 (_4: カウント別, _5: 対戦成績)
   */
  async fetchExtendedStats(playerId: string, pageNumber: 4 | 5, year?: number): Promise<SplitVsTeamStats[]> {
    const url = this.buildUrl(playerId, `_${pageNumber}`, year, 'B');
    
    try {
      console.log(`Fetching extended stats (page ${pageNumber}): ${url}`);
      const html = await this.fetchWithDelay(url);
      const $ = cheerio.load(html);
      
      if (pageNumber === 5) {
        return this.parseSplitVsTeamStats($, playerId, year || new Date().getFullYear());
      }
      
      return [];
      
    } catch (error) {
      console.warn(`Failed to fetch extended stats for ${playerId}_${pageNumber}:`, error);
      return [];
    }
  }

  /**
   * 投手シーズン成績を取得
   */
  async fetchPitcherSeasonStats(playerId: string, year?: number): Promise<PitcherSeasonStats> {
    const url = this.buildUrl(playerId, '', year, 'P');
    
    try {
      console.log(`Fetching pitcher season stats: ${url}`);
      const html = await this.fetchWithDelay(url);
      const $ = cheerio.load(html);
      
      return this.parsePitcherSeasonStats($, playerId, year || new Date().getFullYear());
      
    } catch (error) {
      console.error(`Failed to fetch pitcher season stats for ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * プレイヤータイプを自動判定してデータ取得
   */
  async fetchPlayerData(playerId: string, year?: number): Promise<{
    playerType: 'batter' | 'pitcher';
    seasonStats: SeasonStats | PitcherSeasonStats;
    sabrEye?: SabrEyeStats;
    monthlyStats?: SplitMonthStats[];
    courseStats?: CourseStats[];
  }> {
    // 打者としてチェック
    try {
      const seasonStats = await this.fetchSeasonStats(playerId, year);
      const [sabrEye, monthlyStats, courseStats] = await Promise.all([
        this.fetchSabrEyeStats(playerId, year).catch(() => null),
        this.fetchSplitMonthStats(playerId, year).catch(() => []),
        this.fetchCourseStats(playerId, year).catch(() => [])
      ]);
      
      return {
        playerType: 'batter',
        seasonStats,
        sabrEye: sabrEye || undefined,
        monthlyStats,
        courseStats
      };
      
    } catch (batterError) {
      // 投手としてチェック
      try {
        const seasonStats = await this.fetchPitcherSeasonStats(playerId, year);
        
        return {
          playerType: 'pitcher',
          seasonStats
        };
        
      } catch (pitcherError) {
        throw new Error(`Player ${playerId} not found as either batter or pitcher`);
      }
    }
  }

  /**
   * 全打席ログを取得 (S suffix) - 重いので必要時のみ
   */
  async fetchPlateAppearanceLog(playerId: string, year?: number): Promise<PlateAppearanceLog[]> {
    const url = this.buildUrl(playerId, 'S', year, 'B');
    
    try {
      console.log(`Fetching plate appearance log: ${url}`);
      const html = await this.fetchWithDelay(url);
      const $ = cheerio.load(html);
      
      return this.parsePlateAppearanceLog($, playerId, year || new Date().getFullYear());
      
    } catch (error) {
      console.warn(`Failed to fetch plate appearance log for ${playerId}:`, error);
      return [];
    }
  }

  /**
   * 選手のキャリア通算成績を取得
   */
  async fetchPlayerCareerStats(playerId: string, startYear?: number, endYear?: number): Promise<{
    playerType: 'batter' | 'pitcher';
    careerData: (SeasonStats | PitcherSeasonStats)[];
  }> {
    const currentYear = new Date().getFullYear();
    const start = startYear || 2011;
    const end = endYear || currentYear;
    
    const results: (SeasonStats | PitcherSeasonStats)[] = [];
    let playerType: 'batter' | 'pitcher' | null = null;
    
    for (let year = start; year <= end; year++) {
      try {
        const data = await this.fetchPlayerData(playerId, year);
        results.push(data.seasonStats);
        
        if (!playerType) {
          playerType = data.playerType;
        }
        
        await this.delay(this.delayMs);
        
      } catch (error) {
        console.warn(`No data found for ${playerId} in ${year}`);
      }
    }
    
    if (!playerType) {
      throw new Error(`Could not determine player type for ${playerId}`);
    }
    
    return {
      playerType,
      careerData: results
    };
  }

  /**
   * 特定年の全選手スキャン (404になるまで続行)
   */
  async scanPlayersFromYear(entryYear: number, maxAttempts: number = 300): Promise<BaseballDataPlayer[]> {
    const players: BaseballDataPlayer[] = [];
    const notFoundCount = { consecutive: 0, total: 0 };
    
    for (let i = 1; i <= maxAttempts; i++) {
      const playerId = `${entryYear}${i.toString().padStart(3, '0')}`;
      let found = false;
      
      // 打者チェック
      try {
        const batterUrl = this.buildUrl(playerId, '', undefined, 'B');
        const response = await fetch(batterUrl, { method: 'HEAD' });
        
        if (response.ok) {
          const playerData = await this.parsePlayerBasicInfoFromUrl(playerId, 'batter');
          if (playerData) {
            players.push(playerData);
            found = true;
          }
        }
      } catch (error) {
        // 無視
      }
      
      // 投手チェック
      if (!found) {
        try {
          const pitcherUrl = this.buildUrl(playerId, '', undefined, 'P');
          const response = await fetch(pitcherUrl, { method: 'HEAD' });
          
          if (response.ok) {
            const playerData = await this.parsePlayerBasicInfoFromUrl(playerId, 'pitcher');
            if (playerData) {
              players.push(playerData);
              found = true;
            }
          }
        } catch (error) {
          // 無視
        }
      }
      
      // 連続未発見カウント
      if (found) {
        notFoundCount.consecutive = 0;
      } else {
        notFoundCount.consecutive++;
        notFoundCount.total++;
        
        // 50人連続で見つからない場合は終了
        if (notFoundCount.consecutive >= 50) {
          console.log(`Stopping scan after ${notFoundCount.consecutive} consecutive misses`);
          break;
        }
      }
      
      // レート制限
      if (i % 10 === 0) {
        console.log(`Scanned ${i} IDs, found ${players.length} players`);
        await this.delay(this.delayMs * 2); // バッチ処理時は長めの間隔
      } else {
        await this.delay(this.delayMs);
      }
    }
    
    console.log(`Completed scan for ${entryYear}: found ${players.length} players (${notFoundCount.total} total misses)`);
    return players;
  }

  /**
   * URLからプレイヤー基本情報を取得
   */
  private async parsePlayerBasicInfoFromUrl(playerId: string, playerType: 'batter' | 'pitcher'): Promise<BaseballDataPlayer | null> {
    try {
      const url = this.buildUrl(playerId, '', undefined, playerType === 'batter' ? 'B' : 'P');
      const html = await this.fetchWithDelay(url);
      const $ = cheerio.load(html);
      
      return this.parsePlayerBasicInfo($, playerId, playerType);
      
    } catch (error) {
      return null;
    }
  }

  // === Private Parser Methods ===
  
  private parseSeasonStats($: cheerio.CheerioAPI, playerId: string, season: number): SeasonStats {
    // メインテーブルから基本成績を抽出
    const mainTable = $('table.data_table, table[border="1"]').first();
    const rows = mainTable.find('tr');
    
    // NPB通算等のメイン行を探す
    let statsRow = rows.filter((i, row) => {
      const text = $(row).text();
      return text.includes('NPB通算') || text.includes('リーグ戦');
    }).first();
    
    if (statsRow.length === 0) {
      statsRow = rows.eq(1); // フォールバックとしてデータ行を使用
    }
    
    const cells = statsRow.find('td');
    
    return {
      player_id: playerId,
      season,
      games: this.parseIntFromCell(cells.eq(1)),
      at_bats: this.parseIntFromCell(cells.eq(2)),
      hits: this.parseIntFromCell(cells.eq(3)),
      doubles: this.parseIntFromCell(cells.eq(4)),
      triples: this.parseIntFromCell(cells.eq(5)),
      home_runs: this.parseIntFromCell(cells.eq(6)),
      rbis: this.parseIntFromCell(cells.eq(7)),
      runs: this.parseIntFromCell(cells.eq(8)),
      walks: this.parseIntFromCell(cells.eq(9)),
      strikeouts: this.parseIntFromCell(cells.eq(10)),
      stolen_bases: this.parseIntFromCell(cells.eq(11)),
      batting_average: this.parseFloatFromCell(cells.eq(12)),
      on_base_percentage: this.parseFloatFromCell(cells.eq(13)),
      slugging_percentage: this.parseFloatFromCell(cells.eq(14)),
      ops: this.parseFloatFromCell(cells.eq(15)),
      updated_at: new Date().toISOString()
    };
  }

  private parsePitcherSeasonStats($: cheerio.CheerioAPI, playerId: string, season: number): PitcherSeasonStats {
    const mainTable = $('table.data_table, table[border="1"]').first();
    const rows = mainTable.find('tr');
    
    let statsRow = rows.filter((i, row) => {
      const text = $(row).text();
      return text.includes('NPB通算') || text.includes('リーグ戦');
    }).first();
    
    if (statsRow.length === 0) {
      statsRow = rows.eq(1);
    }
    
    const cells = statsRow.find('td');
    
    return {
      player_id: playerId,
      season,
      games: this.parseIntFromCell(cells.eq(1)),
      wins: this.parseIntFromCell(cells.eq(2)),
      losses: this.parseIntFromCell(cells.eq(3)),
      saves: this.parseIntFromCell(cells.eq(4)),
      holds: this.parseIntFromCell(cells.eq(5)),
      era: this.parseFloatFromCell(cells.eq(6)),
      innings_pitched: this.parseFloatFromCell(cells.eq(7)),
      hits_allowed: this.parseIntFromCell(cells.eq(8)),
      runs_allowed: this.parseIntFromCell(cells.eq(9)),
      earned_runs: this.parseIntFromCell(cells.eq(10)),
      walks: this.parseIntFromCell(cells.eq(11)),
      strikeouts: this.parseIntFromCell(cells.eq(12)),
      home_runs_allowed: this.parseIntFromCell(cells.eq(13)),
      whip: this.parseFloatFromCell(cells.eq(14)),
      updated_at: new Date().toISOString()
    };
  }

  private parseSabrEyeStats($: cheerio.CheerioAPI, playerId: string, season: number): SabrEyeStats {
    return {
      player_id: playerId,
      season,
      noi: this.findStatInPage($, 'NOI'),
      gpa: this.findStatInPage($, 'GPA'),
      isop: this.findStatInPage($, 'IsoP'),
      babip: this.findStatInPage($, 'BABIP'),
      bb_k: this.findStatInPage($, 'BB/K'),
      contact_rate: this.findStatInPage($, 'コンタクト率'),
      swing_rate: this.findStatInPage($, 'スイング率'),
      chase_rate: this.findStatInPage($, 'チェイス率'),
      updated_at: new Date().toISOString()
    };
  }

  private parseSplitMonthStats($: cheerio.CheerioAPI, playerId: string, season: number): SplitMonthStats[] {
    const monthStats: SplitMonthStats[] = [];
    
    $('table tr').each((index, row) => {
      if (index === 0) return;
      
      const cells = $(row).find('td');
      if (cells.length < 8) return;
      
      const monthText = $(cells[0]).text().trim();
      const month = this.parseMonthFromText(monthText);
      
      if (month > 0) {
        monthStats.push({
          player_id: playerId,
          season,
          month,
          games: this.parseIntFromCell(cells.eq(1)),
          batting_average: this.parseFloatFromCell(cells.eq(2)),
          slugging_percentage: this.parseFloatFromCell(cells.eq(3)),
          on_base_percentage: this.parseFloatFromCell(cells.eq(4)),
          ops: this.parseFloatFromCell(cells.eq(5)),
          home_runs: this.parseIntFromCell(cells.eq(6)),
          rbis: this.parseIntFromCell(cells.eq(7)),
          updated_at: new Date().toISOString()
        });
      }
    });
    
    return monthStats;
  }

  private parseCourseStats($: cheerio.CheerioAPI, playerId: string, season: number): CourseStats[] {
    const courseStats: CourseStats[] = [];
    
    $('table tr').each((index, row) => {
      if (index === 0) return;
      
      const cells = $(row).find('td');
      if (cells.length < 6) return;
      
      const zone = $(cells[0]).text().trim();
      
      if (zone) {
        courseStats.push({
          player_id: playerId,
          season,
          zone,
          at_bats: this.parseIntFromCell(cells.eq(1)),
          hits: this.parseIntFromCell(cells.eq(2)),
          strikeouts: this.parseIntFromCell(cells.eq(3)),
          home_runs: this.parseIntFromCell(cells.eq(4)),
          batting_average: this.parseFloatFromCell(cells.eq(5)),
          updated_at: new Date().toISOString()
        });
      }
    });
    
    return courseStats;
  }

  private parseSplitVsTeamStats($: cheerio.CheerioAPI, playerId: string, season: number): SplitVsTeamStats[] {
    const teamStats: SplitVsTeamStats[] = [];
    
    $('table tr').each((index, row) => {
      if (index === 0) return;
      
      const cells = $(row).find('td');
      if (cells.length < 8) return;
      
      const oppTeam = $(cells[0]).text().trim();
      
      if (oppTeam) {
        teamStats.push({
          player_id: playerId,
          season,
          opp_team: oppTeam,
          games: this.parseIntFromCell(cells.eq(1)),
          batting_average: this.parseFloatFromCell(cells.eq(2)),
          slugging_percentage: this.parseFloatFromCell(cells.eq(3)),
          on_base_percentage: this.parseFloatFromCell(cells.eq(4)),
          ops: this.parseFloatFromCell(cells.eq(5)),
          home_runs: this.parseIntFromCell(cells.eq(6)),
          rbis: this.parseIntFromCell(cells.eq(7)),
          updated_at: new Date().toISOString()
        });
      }
    });
    
    return teamStats;
  }

  private parsePlateAppearanceLog($: cheerio.CheerioAPI, playerId: string, season: number): PlateAppearanceLog[] {
    const logs: PlateAppearanceLog[] = [];
    
    $('table tr').each((index, row) => {
      if (index === 0) return; // ヘッダースキップ
      
      const cells = $(row).find('td');
      if (cells.length < 10) return;
      
      const result = $(cells[9]).text().trim();
      const baseRunners = $(cells[7]).text().trim();
      
      logs.push({
        player_id: playerId,
        season,
        game_date: $(cells[0]).text().trim(),
        pa_no: index,
        opponent: $(cells[2]).text().trim(),
        location: $(cells[3]).text().trim().includes('○') ? 'home' : 'away',
        batting_order: this.parseIntFromText($(cells[5]).text()),
        inning: this.parseIntFromText($(cells[4]).text()),
        count: $(cells[8]).text().trim(),
        result,
        risp: this.hasRunnersInScoringPosition(baseRunners),
        bases: baseRunners,
        score_diff: this.parseScoreDifference($(cells[6]).text().trim()),
        outcome_type: this.categorizeResult(result),
        updated_at: new Date().toISOString()
      });
    });
    
    return logs;
  }

  private parsePlayerBasicInfo($: cheerio.CheerioAPI, playerId: string, playerType: 'batter' | 'pitcher'): BaseballDataPlayer | null {
    const nameElement = $('h2, h1').first();
    const profileText = $('body').text();
    
    const name = nameElement.text().trim().replace(/\s+/g, ' ');
    if (!name || name.includes('エラー') || name.includes('見つかりません')) {
      return null;
    }
    
    // チーム名をページから抽出
    const teamMatch = profileText.match(/(ヤクルト|巨人|阪神|中日|広島|ベイスターズ|ソフトバンク|ロッテ|日ハム|楽天|オリックス|西武)/);
    const team = teamMatch ? teamMatch[1] : '';
    
    // ポジション抽出 (投手の場合は'P')
    let position = playerType === 'pitcher' ? 'P' : '';
    if (playerType === 'batter') {
      const positionMatch = profileText.match(/(外野手|内野手|捕手|[CFP123]|一塁|二塁|三塁|遊撃|外野|中野|左野|右野)/);
      if (positionMatch) position = positionMatch[1];
    }
    
    const { entryYear, yearNumber } = this.parsePlayerId(playerId);
    
    return {
      player_id: playerId,
      name,
      team,
      position,
      player_type: playerType,
      entry_year: entryYear,
      year_number: yearNumber,
      updated_at: new Date().toISOString()
    };
  }

  // === ヘルパーメソッド ===
  
  private parseIntFromCell(cell: cheerio.Cheerio<cheerio.Element>): number {
    const text = cell.text().trim().replace(/---/g, '0');
    return parseInt(text) || 0;
  }
  
  private parseFloatFromCell(cell: cheerio.Cheerio<cheerio.Element>): number {
    const text = cell.text().trim().replace(/---/g, '0.000');
    return parseFloat(text) || 0.0;
  }
  
  private parseIntFromText(text: string): number {
    const cleaned = text.trim().replace(/---/g, '0');
    return parseInt(cleaned) || 0;
  }
  
  private findStatInPage($: cheerio.CheerioAPI, statName: string): number {
    let value = 0.0;
    
    $('td, th').each((i, cell) => {
      const cellText = $(cell).text().trim();
      if (cellText === statName) {
        const nextCell = $(cell).next('td');
        if (nextCell.length > 0) {
          value = parseFloat(nextCell.text().trim()) || 0.0;
          return false; // break
        }
      }
    });
    
    return value;
  }
  
  private parseMonthFromText(monthText: string): number {
    const monthMap: { [key: string]: number } = {
      '3月': 3, '4月': 4, '5月': 5, '6月': 6,
      '7月': 7, '8月': 8, '9月': 9, '10月': 10, '11月': 11
    };
    
    for (const [text, month] of Object.entries(monthMap)) {
      if (monthText.includes(text)) return month;
    }
    
    return 0;
  }
  
  private hasRunnersInScoringPosition(baseRunners: string): boolean {
    return baseRunners.includes('二') || baseRunners.includes('三') || baseRunners.includes('満');
  }
  
  private parseScoreDifference(scoreText: string): number {
    const match = scoreText.match(/(\\d+)-(\\d+)/);
    if (match) {
      const home = parseInt(match[1]);
      const away = parseInt(match[2]);
      return home - away;
    }
    return 0;
  }

  private categorizeResult(result: string): PlateAppearanceLog['outcome_type'] {
    if (result.includes('安打') || result.includes('安')) return 'hit';
    if (result.includes('本塁') || result.includes('ホームラン')) return 'homerun';
    if (result.includes('三振')) return 'strikeout';
    if (result.includes('四球') || result.includes('死球')) return 'walk';
    if (result.includes('失策') || result.includes('エラー')) return 'error';
    if (result.includes('飛') || result.includes('ゴロ') || result.includes('併殺')) return 'out';
    return 'other';
  }

  private async fetchWithDelay(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 既存データベースとの統合用ユーティリティ
export const DATA_TABLES = {
  SEASON_STATS: 'season_stats',
  SABR_EYE: 'sabr_eye_stats',
  SPLIT_MONTH: 'split_month_stats',
  SPLIT_VS_TEAM: 'split_vs_team_stats',
  COURSE_STATS: 'course_stats',
  PA_LOGS: 'plate_appearance_logs'
} as const;

export const PLAYER_ID_RANGE = {
  MIN_YEAR: 1995,
  MAX_YEAR: 2025,
  MAX_PLAYERS_PER_YEAR: 300
} as const;

// === エクスポート用ヘルパー関数 ===

/**
 * 個別選手のシーズンデータを取得 (既存DBと互換性あり)
 */
export async function fetchPlayerSeasonData(playerId: string, year?: number): Promise<{
  player: BaseballDataPlayer | null;
  seasonStats: SeasonStats | PitcherSeasonStats | null;
  sabrEye?: SabrEyeStats | null;
  monthlyStats?: SplitMonthStats[];
  vsTeamStats?: SplitVsTeamStats[];
  courseStats?: CourseStats[];
}> {
  const scraper = new BaseballDataScraper();
  
  try {
    const playerData = await scraper.fetchPlayerData(playerId, year);
    const player = await scraper['parsePlayerBasicInfoFromUrl'](playerId, playerData.playerType);
    
    return {
      player,
      seasonStats: playerData.seasonStats,
      sabrEye: playerData.sabrEye || null,
      monthlyStats: playerData.monthlyStats || [],
      vsTeamStats: await scraper.fetchExtendedStats(playerId, 5, year),
      courseStats: playerData.courseStats || []
    };
    
  } catch (error) {
    console.error(`Failed to fetch complete player data for ${playerId}:`, error);
    return {
      player: null,
      seasonStats: null
    };
  }
}

/**
 * 選手のキャリアデータを一括取得
 */
export async function fetchPlayerCareerData(playerId: string, startYear?: number, endYear?: number) {
  const scraper = new BaseballDataScraper();
  return await scraper.fetchPlayerCareerStats(playerId, startYear, endYear);
}

/**
 * 特定年の全選手スキャン (量産タスク用)
 */
export async function scanYearPlayers(entryYear: number): Promise<BaseballDataPlayer[]> {
  const scraper = new BaseballDataScraper();
  return await scraper.scanPlayersFromYear(entryYear);
}

/**
 * 打席ログ取得 (重い処理のため個別関数)
 */
export async function fetchPlateAppearanceLogs(playerId: string, year?: number): Promise<PlateAppearanceLog[]> {
  const scraper = new BaseballDataScraper();
  return await scraper.fetchPlateAppearanceLog(playerId, year);
}