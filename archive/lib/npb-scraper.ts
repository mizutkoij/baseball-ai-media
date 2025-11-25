/**
 * NPB公式サイトからの試合日程・結果スクレイピングシステム
 * 
 * 機能:
 * - 試合日程の取得
 * - 試合結果の取得
 * - リアルタイムスコア更新
 * - データ検証・正規化
 */

import { JSDOM } from 'jsdom';

export interface GameData {
  game_id: string;
  date: string;
  league: 'central' | 'pacific' | 'interleague';
  away_team: string;
  home_team: string;
  away_score?: number;
  home_score?: number;
  status: 'scheduled' | 'live' | 'final' | 'postponed' | 'cancelled';
  inning?: number;
  venue?: string;
  start_time_jst?: string;
  links?: {
    box_score?: string;
    play_by_play?: string;
  };
  updated_at: string;
}

export interface ScrapingOptions {
  year: number;
  month?: number;
  league?: 'first' | 'farm' | 'both';
  includeDetails?: boolean;
  retryAttempts?: number;
  delayMs?: number;
}

// チーム名正規化辞書
const TEAM_NAME_MAP: Record<string, string> = {
  '巨人': 'YG',
  '阪神': 'T',
  '中日': 'D', 
  '広島': 'C',
  'ヤクルト': 'S',
  'ＤｅＮＡ': 'DB',
  'DeNA': 'DB',
  'ソフトバンク': 'H',
  '日本ハム': 'F',
  '西武': 'L',
  'ロッテ': 'M',
  'オリックス': 'B',
  '楽天': 'E'
};

export class NPBScraper {
  private baseUrl = 'https://npb.jp';
  private userAgent = 'Mozilla/5.0 (compatible; NPB-Analytics/1.0)';
  private delayMs: number;
  private retryAttempts: number;

  constructor(options: { delayMs?: number; retryAttempts?: number } = {}) {
    this.delayMs = options.delayMs || 2000; // 2秒間隔（礼儀正しいアクセス）
    this.retryAttempts = options.retryAttempts || 3;
  }

  /**
   * 指定月の試合日程を取得
   */
  async fetchMonthSchedule(options: ScrapingOptions): Promise<GameData[]> {
    const { year, month, league = 'first' } = options;
    
    if (!month) {
      throw new Error('Month is required for schedule fetching');
    }

    const urls = this.buildScheduleUrls(year, month, league);
    const allGames: GameData[] = [];

    for (const url of urls) {
      try {
        console.log(`Fetching schedule from: ${url}`);
        const games = await this.scrapeSchedulePage(url, year, month);
        allGames.push(...games);
        
        // 礼儀正しいアクセス - 間隔を開ける
        await this.delay(this.delayMs);
      } catch (error) {
        console.error(`Failed to fetch from ${url}:`, error);
      }
    }

    return this.deduplicateGames(allGames);
  }

  /**
   * 今日の試合を取得（リアルタイム更新用）
   */
  async fetchTodayGames(): Promise<GameData[]> {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    const allGames = await this.fetchMonthSchedule({ year, month });
    const todayStr = today.toISOString().split('T')[0];
    
    return allGames.filter(game => game.date === todayStr);
  }

  /**
   * 進行中の試合のスコア更新
   */
  async updateLiveGames(games: GameData[]): Promise<GameData[]> {
    const liveGames = games.filter(game => game.status === 'live');
    const updatedGames: GameData[] = [];

    for (const game of liveGames) {
      try {
        const updatedGame = await this.fetchGameDetails(game);
        updatedGames.push(updatedGame);
        await this.delay(this.delayMs);
      } catch (error) {
        console.error(`Failed to update game ${game.game_id}:`, error);
        updatedGames.push(game); // 元のデータを保持
      }
    }

    return updatedGames;
  }

  /**
   * スケジュールページのURL構築
   */
  private buildScheduleUrls(year: number, month: number, league: string): string[] {
    const monthStr = month.toString().padStart(2, '0');
    const urls: string[] = [];

    if (league === 'first' || league === 'both') {
      urls.push(`${this.baseUrl}/games/${year}/schedule_${monthStr}_detail.html`);
    }
    
    if (league === 'farm' || league === 'both') {
      urls.push(`${this.baseUrl}/farm/${year}/schedule_${monthStr}_detail.html`);
    }

    return urls;
  }

  /**
   * スケジュールページのスクレイピング
   */
  private async scrapeSchedulePage(url: string, year: number, month: number): Promise<GameData[]> {
    const html = await this.fetchWithRetry(url);
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const games: GameData[] = [];
    
    // NPB公式サイトのテーブル構造に合わせて解析
    const table = document.querySelector('table');
    if (!table) {
      console.warn('No table found in the schedule page');
      return games;
    }
    
    const rows = table.querySelectorAll('tr');
    console.log(`Found ${rows.length} rows in schedule table`);
    
    let currentDate: string | null = null;
    
    for (let i = 1; i < rows.length; i++) { // ヘッダー行をスキップ
      try {
        const row = rows[i];
        const game = this.parseGameRow(row, year, month, currentDate);
        if (game) {
          games.push(game);
          // 日付が更新された場合は記録
          if (game.date !== currentDate) {
            currentDate = game.date;
          }
        }
      } catch (error) {
        console.warn(`Failed to parse row ${i}:`, error);
      }
    }

    console.log(`Parsed ${games.length} games from schedule page`);
    return games;
  }

  /**
   * テーブル行からゲームデータをパース
   */
  private parseGameRow(row: Element, year: number, month: number, currentDate?: string | null): GameData | null {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return null; // 最低限の列が必要
      
      // 日付の判定と取得
      let matchupCell: Element;
      let venueTimeCell: Element;
      let date: string | null = null;
      
      const firstCell = cells[0];
      const firstCellText = firstCell.textContent?.trim() || '';
      
      if (firstCellText === '月日' || firstCellText === '対戦カード') {
        return null; // ヘッダー行をスキップ
      }
      
      // 最初のセルが日付の場合（5列構成）
      if (firstCellText.match(/^\d{1,2}\/\d{1,2}/)) {
        matchupCell = cells[1];
        venueTimeCell = cells[2];
        date = this.parseNPBDate(firstCellText, year, month);
      } 
      // 最初のセルがチーム情報の場合（4列構成）
      else {
        matchupCell = cells[0];
        venueTimeCell = cells[1];
        date = currentDate; // 前の行から受け継いだ日付を使用
      }
      
      if (!date || !matchupCell) return null;
      
      // team1とteam2のクラスを持つ要素を探す
      const team1Element = matchupCell.querySelector('.team1');
      const team2Element = matchupCell.querySelector('.team2');
      
      if (!team1Element || !team2Element) return null;
      
      const team1Raw = team1Element.textContent?.trim() || '';
      const team2Raw = team2Element.textContent?.trim() || '';
      
      const awayTeam = this.normalizeTeamName(team1Raw);
      const homeTeam = this.normalizeTeamName(team2Raw);
      
      if (!awayTeam || !homeTeam) return null;

      // スコアの取得 (.score1, .score2)
      const score1Element = matchupCell.querySelector('.score1');
      const score2Element = matchupCell.querySelector('.score2');
      
      let awayScore: number | undefined;
      let homeScore: number | undefined;
      let status: GameData['status'] = 'scheduled';
      
      if (score1Element && score2Element) {
        const score1Text = score1Element.textContent?.trim();
        const score2Text = score2Element.textContent?.trim();
        
        // スコアが数字の場合は試合完了
        if (score1Text && score2Text && !isNaN(parseInt(score1Text)) && !isNaN(parseInt(score2Text))) {
          awayScore = parseInt(score1Text);
          homeScore = parseInt(score2Text);
          status = 'final';
        }
      }

      // ゲームIDの生成
      const game_id = this.generateGameId(date, awayTeam, homeTeam);

      // 球場・開始時間の取得
      const venueTimeText = venueTimeCell?.textContent?.trim() || '';
      
      // 球場名と開始時間を分離 (通常 "球場名 開始時間" の形式)
      const venueTimeLines = venueTimeText.split('\n').map(line => line.trim()).filter(line => line);
      const venue = venueTimeLines[0] || undefined;
      const start_time_jst = venueTimeLines[1] || undefined;

      return {
        game_id,
        date,
        league: this.determineLeague(awayTeam, homeTeam),
        away_team: awayTeam,
        home_team: homeTeam,
        away_score: awayScore,
        home_score: homeScore,
        status,
        venue,
        start_time_jst,
        updated_at: new Date().toISOString()
      };

    } catch (error) {
      console.warn('Failed to parse game row:', error);
      return null;
    }
  }

  /**
   * NPB形式の日付をパース (例: "4/1", "4/1(月)")
   */
  private parseNPBDate(dateText: string, year: number, month: number): string | null {
    try {
      // "4/1" または "4/1(月)" の形式から日付を抽出
      const dateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})/);
      if (!dateMatch) return null;
      
      const parsedMonth = parseInt(dateMatch[1]);
      const parsedDay = parseInt(dateMatch[2]);
      
      // 月の検証
      if (parsedMonth !== month) {
        // 月を跨いだ場合の処理
        if (parsedMonth === month + 1 || (month === 12 && parsedMonth === 1)) {
          // 次月の場合は年の調整も考慮
          const adjustedYear = (month === 12 && parsedMonth === 1) ? year + 1 : year;
          return `${adjustedYear}-${parsedMonth.toString().padStart(2, '0')}-${parsedDay.toString().padStart(2, '0')}`;
        }
      }
      
      return `${year}-${parsedMonth.toString().padStart(2, '0')}-${parsedDay.toString().padStart(2, '0')}`;
    } catch (error) {
      console.warn(`Failed to parse date: ${dateText}`, error);
      return null;
    }
  }

  /**
   * 日付文字列のパース
   */
  private parseDate(dateText: string, year: number, month: number): string {
    // "3/15" のような形式を想定
    const match = dateText.match(/(\d{1,2})\/(\d{1,2})/);
    if (match) {
      const parsedMonth = parseInt(match[1]);
      const day = parseInt(match[2]);
      return `${year}-${parsedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    
    // その他のフォーマットに対応
    return `${year}-${month.toString().padStart(2, '0')}-01`; // フォールバック
  }

  /**
   * チーム名の正規化
   */
  private normalizeTeamName(teamName: string): string {
    const cleaned = teamName.replace(/\s+/g, '').trim();
    return TEAM_NAME_MAP[cleaned] || cleaned;
  }

  /**
   * リーグの判定
   */
  private determineLeague(awayTeam: string, homeTeam: string): 'central' | 'pacific' | 'interleague' {
    const centralTeams = ['YG', 'T', 'D', 'C', 'S', 'DB'];
    const pacificTeams = ['H', 'F', 'L', 'M', 'B', 'E'];
    
    const awayIsCentral = centralTeams.includes(awayTeam);
    const homeIsCentral = centralTeams.includes(homeTeam);
    const awayIsPacific = pacificTeams.includes(awayTeam);
    const homeIsPacific = pacificTeams.includes(homeTeam);

    if (awayIsCentral && homeIsCentral) return 'central';
    if (awayIsPacific && homeIsPacific) return 'pacific';
    return 'interleague';
  }

  /**
   * ゲームIDの生成
   */
  private generateGameId(date: string, awayTeam: string, homeTeam: string): string {
    const dateStr = date.replace(/-/g, '');
    return `${dateStr}_${awayTeam}_${homeTeam}`;
  }

  /**
   * 試合詳細の取得
   */
  private async fetchGameDetails(game: GameData): Promise<GameData> {
    // 詳細ページからスコア更新などを実装
    // 今回は簡略化してそのまま返す
    return {
      ...game,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * 重複削除
   */
  private deduplicateGames(games: GameData[]): GameData[] {
    const seen = new Set<string>();
    return games.filter(game => {
      if (seen.has(game.game_id)) {
        return false;
      }
      seen.add(game.game_id);
      return true;
    });
  }

  /**
   * HTTP取得（リトライ付き）
   */
  private async fetchWithRetry(url: string): Promise<string> {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (error) {
        console.warn(`Attempt ${attempt}/${this.retryAttempts} failed for ${url}:`, error);
        
        if (attempt === this.retryAttempts) {
          throw error;
        }
        
        // 指数バックオフで再試行
        await this.delay(this.delayMs * Math.pow(2, attempt - 1));
      }
    }

    throw new Error('All retry attempts failed');
  }

  /**
   * 遅延実行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * データ検証ルール
 */
export class NPBDataValidator {
  static validateGame(game: GameData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 必須フィールドのチェック
    if (!game.game_id) errors.push('game_id is required');
    if (!game.date) errors.push('date is required');
    if (!game.away_team) errors.push('away_team is required');
    if (!game.home_team) errors.push('home_team is required');

    // 日付フォーマットのチェック
    if (game.date && !/^\d{4}-\d{2}-\d{2}$/.test(game.date)) {
      errors.push('date must be in YYYY-MM-DD format');
    }

    // スコアの整合性チェック
    if (game.status === 'final') {
      if (game.away_score === undefined || game.home_score === undefined) {
        errors.push('Final games must have scores');
      }
      if (game.away_score !== undefined && game.away_score < 0) {
        errors.push('away_score cannot be negative');
      }
      if (game.home_score !== undefined && game.home_score < 0) {
        errors.push('home_score cannot be negative');
      }
    }

    // チーム名の重複チェック
    if (game.away_team === game.home_team) {
      errors.push('away_team and home_team cannot be the same');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateGames(games: GameData[]): { validGames: GameData[]; invalidGames: { game: GameData; errors: string[] }[] } {
    const validGames: GameData[] = [];
    const invalidGames: { game: GameData; errors: string[] }[] = [];

    for (const game of games) {
      const validation = this.validateGame(game);
      if (validation.isValid) {
        validGames.push(game);
      } else {
        invalidGames.push({ game, errors: validation.errors });
      }
    }

    return { validGames, invalidGames };
  }
}

// 使用例とヘルパー関数
export async function scrapeNPBSchedule(options: ScrapingOptions): Promise<GameData[]> {
  const scraper = new NPBScraper();
  return await scraper.fetchMonthSchedule(options);
}

export async function getTodayGames(): Promise<GameData[]> {
  const scraper = new NPBScraper();
  return await scraper.fetchTodayGames();
}