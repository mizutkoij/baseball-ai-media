/**
 * baseballdata.jp 補完システム
 * 日次/試合終了後の低頻度取得、整合性チェック、欠損穴埋め用
 */

import { PoliteHTTPClient, DifferentialIngester, normalizeText } from './polite-http-client';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface BaseballDataGame {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  finalScore?: {
    home: number;
    away: number;
  };
  boxScoreUrl?: string;
  gameLogUrl?: string;
  source: 'baseballdata';
}

export interface BaseballDataStats {
  gameId: string;
  playerStats: {
    batting: Array<{
      playerName: string;
      team: string;
      position: string;
      ab: number;
      h: number;
      rbi: number;
      r: number;
      bb: number;
      so: number;
      avg?: number;
    }>;
    pitching: Array<{
      playerName: string;
      team: string;
      ip: number;
      h: number;
      r: number;
      er: number;
      bb: number;
      so: number;
      era?: number;
      result?: 'W' | 'L' | 'S' | 'H' | 'BS';
    }>;
  };
  teamTotals: {
    home: { runs: number; hits: number; errors: number };
    away: { runs: number; hits: number; errors: number };
  };
  confidence: 'high' | 'medium' | 'low';
  scrapedAt: string;
}

export interface ValidationResult {
  gameId: string;
  inconsistencies: Array<{
    field: string;
    yahoo: any;
    baseballdata: any;
    severity: 'minor' | 'major' | 'critical';
  }>;
  missingData: Array<{
    source: 'yahoo' | 'baseballdata';
    missingFields: string[];
  }>;
  recommendation: 'use_yahoo' | 'use_baseballdata' | 'manual_review' | 'combine';
}

/**
 * baseballdata.jp のポライトスクレイパー
 */
export class BaseballDataConnector {
  private httpClient: PoliteHTTPClient;
  private cacheDir: string;
  private validationDir: string;
  
  constructor(contactEmail: string = 'contact@example.com') {
    this.httpClient = new PoliteHTTPClient(contactEmail);
    
    // 保守的な設定に変更
    this.httpClient.enableConservativeMode(); // 30s間隔
    
    this.cacheDir = path.join('data', 'cache', 'baseballdata');
    this.validationDir = path.join('data', 'validation');
    
    fs.mkdir(this.cacheDir, { recursive: true }).catch(() => {});
    fs.mkdir(this.validationDir, { recursive: true }).catch(() => {});
  }
  
  /**
   * 日次補完処理（試合終了後）
   */
  async performDailyComplement(date: string): Promise<ValidationResult[]> {
    console.log(`🔍 Starting daily complement for ${date} (baseballdata.jp)`);
    
    const games = await this.getGamesForDate(date);
    const validationResults: ValidationResult[] = [];
    
    for (const game of games) {
      try {
        console.log(`📊 Complementing game ${game.gameId}...`);
        
        // 統計データ取得
        const stats = await this.getGameStats(game.gameId, game.boxScoreUrl);
        
        // Yahoo データとの比較検証
        const validation = await this.validateAgainstYahoo(game.gameId, stats);
        validationResults.push(validation);
        
        // 欠損補完の実行
        await this.performDataComplement(validation);
        
        // 間隔（60秒 - より保守的）
        await this.sleep(60000);
        
      } catch (error) {
        console.error(`Failed to complement game ${game.gameId}:`, error);
      }
    }
    
    // 日次レポート生成
    await this.generateDailyReport(date, validationResults);
    
    return validationResults;
  }
  
  /**
   * 指定日の試合一覧取得
   */
  private async getGamesForDate(date: string): Promise<BaseballDataGame[]> {
    const url = `https://baseballdata.jp/game/schedule?date=${date}`;
    
    try {
      const response = await this.httpClient.politeGet(url);
      const $ = cheerio.load(response.data);
      const games: BaseballDataGame[] = [];
      
      // スケジュールテーブル解析
      $('.schedule-table tr, .game-list .game-item').each((_, element) => {
        const $element = $(element);
        
        // 試合リンクの抽出
        const gameLink = $element.find('a[href*="/game/"]').attr('href');
        if (gameLink) {
          const gameIdMatch = gameLink.match(/\/game\/(\d+)/);
          if (gameIdMatch) {
            const gameId = gameIdMatch[1];
            
            // チーム名・会場の抽出
            const homeTeam = normalizeText($element.find('.home-team, .team-home').text());
            const awayTeam = normalizeText($element.find('.away-team, .team-away').text());
            const venue = normalizeText($element.find('.venue, .stadium').text());
            
            // スコアの抽出
            let finalScore: { home: number; away: number } | undefined;
            const scoreElement = $element.find('.score, .final-score');
            if (scoreElement.length > 0) {
              const scoreText = scoreElement.text();
              const scoreMatch = scoreText.match(/(\d+)\s*[-:]\s*(\d+)/);
              if (scoreMatch) {
                finalScore = {
                  home: parseInt(scoreMatch[2]),
                  away: parseInt(scoreMatch[1])
                };
              }
            }
            
            if (homeTeam && awayTeam) {
              games.push({
                gameId,
                date,
                homeTeam,
                awayTeam,
                venue,
                finalScore,
                boxScoreUrl: gameLink.includes('boxscore') ? gameLink : `${gameLink}/boxscore`,
                gameLogUrl: `${gameLink}/log`,
                source: 'baseballdata'
              });
            }
          }
        }
      });
      
      console.log(`📋 Found ${games.length} games on baseballdata.jp for ${date}`);
      return games;
      
    } catch (error) {
      console.error(`Failed to get games from baseballdata.jp for ${date}:`, error);
      return [];
    }
  }
  
  /**
   * 試合統計の取得
   */
  private async getGameStats(gameId: string, boxScoreUrl?: string): Promise<BaseballDataStats | null> {
    if (!boxScoreUrl) {
      console.warn(`No box score URL for game ${gameId}`);
      return null;
    }
    
    try {
      const response = await this.httpClient.politeGet(boxScoreUrl);
      const $ = cheerio.load(response.data);
      
      const batting: BaseballDataStats['playerStats']['batting'] = [];
      const pitching: BaseballDataStats['playerStats']['pitching'] = [];
      
      // 打撃成績テーブル解析
      $('.batting-stats table, .batter-stats table').each((_, table) => {
        $(table).find('tbody tr').each((_, row) => {
          const $row = $(row);
          const cells = $row.find('td').map((_, td) => $(td).text().trim()).get();
          
          if (cells.length >= 8) {
            batting.push({
              playerName: normalizeText(cells[0] || cells[1]),
              team: '', // チーム情報は文脈から推定
              position: cells[1] || '',
              ab: parseInt(cells[2]) || 0,
              h: parseInt(cells[3]) || 0,
              rbi: parseInt(cells[4]) || 0,
              r: parseInt(cells[5]) || 0,
              bb: parseInt(cells[6]) || 0,
              so: parseInt(cells[7]) || 0
            });
          }
        });
      });
      
      // 投手成績テーブル解析
      $('.pitching-stats table, .pitcher-stats table').each((_, table) => {
        $(table).find('tbody tr').each((_, row) => {
          const $row = $(row);
          const cells = $row.find('td').map((_, td) => $(td).text().trim()).get();
          
          if (cells.length >= 7) {
            const ipText = cells[1] || '';
            const ip = this.parseInningsPitched(ipText);
            
            pitching.push({
              playerName: normalizeText(cells[0]),
              team: '',
              ip,
              h: parseInt(cells[2]) || 0,
              r: parseInt(cells[3]) || 0,
              er: parseInt(cells[4]) || 0,
              bb: parseInt(cells[5]) || 0,
              so: parseInt(cells[6]) || 0,
              result: this.parseResult(cells[7] || '')
            });
          }
        });
      });
      
      // チーム合計の抽出
      const teamTotals = {
        home: { runs: 0, hits: 0, errors: 0 },
        away: { runs: 0, hits: 0, errors: 0 }
      };
      
      $('.team-totals, .line-score').each((_, element) => {
        // 簡略化：スコアボードから抽出
        const $element = $(element);
        const scoreItems = $element.find('.score-item, td').map((_, td) => $(td).text().trim()).get();
        
        if (scoreItems.length >= 6) {
          teamTotals.away = {
            runs: parseInt(scoreItems[scoreItems.length - 3]) || 0,
            hits: parseInt(scoreItems[scoreItems.length - 2]) || 0,
            errors: parseInt(scoreItems[scoreItems.length - 1]) || 0
          };
        }
      });
      
      return {
        gameId,
        playerStats: { batting, pitching },
        teamTotals,
        confidence: batting.length > 0 && pitching.length > 0 ? 'high' : 'medium',
        scrapedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`Failed to get stats for game ${gameId}:`, error);
      return null;
    }
  }
  
  /**
   * Yahoo データとの検証
   */
  private async validateAgainstYahoo(gameId: string, baseballDataStats: BaseballDataStats | null): Promise<ValidationResult> {
    const validation: ValidationResult = {
      gameId,
      inconsistencies: [],
      missingData: [],
      recommendation: 'use_yahoo' // デフォルト
    };
    
    try {
      // Yahoo データの読み込み
      const yahooFile = path.join('data', 'timeline', 'yahoo_npb1', `${gameId}_latest.json`);
      
      if (await this.fileExists(yahooFile)) {
        const yahooData = JSON.parse(await fs.readFile(yahooFile, 'utf-8'));
        
        if (baseballDataStats) {
          // 投手成績の比較
          const yahooPitchers = this.extractPitchersFromYahoo(yahooData);
          const baseballDataPitchers = baseballDataStats.playerStats.pitching;
          
          // 投手数の比較
          if (Math.abs(yahooPitchers.length - baseballDataPitchers.length) > 1) {
            validation.inconsistencies.push({
              field: 'pitcher_count',
              yahoo: yahooPitchers.length,
              baseballdata: baseballDataPitchers.length,
              severity: 'major'
            });
          }
          
          // 打席数の比較（概算）
          const yahooAtBats = yahooData.rows?.length || 0;
          const baseballDataAtBats = baseballDataStats.playerStats.batting.reduce((sum, b) => sum + b.ab, 0);
          
          if (Math.abs(yahooAtBats - baseballDataAtBats) > 5) {
            validation.inconsistencies.push({
              field: 'total_at_bats',
              yahoo: yahooAtBats,
              baseballdata: baseballDataAtBats,
              severity: 'minor'
            });
          }
          
          // 推奨決定
          if (validation.inconsistencies.length === 0) {
            validation.recommendation = 'use_yahoo'; // Yahoo優先
          } else if (validation.inconsistencies.some(i => i.severity === 'critical')) {
            validation.recommendation = 'manual_review';
          } else {
            validation.recommendation = 'combine'; // 両方使用
          }
          
        } else {
          validation.missingData.push({
            source: 'baseballdata',
            missingFields: ['all_stats']
          });
        }
        
      } else {
        validation.missingData.push({
          source: 'yahoo',
          missingFields: ['game_data']
        });
        validation.recommendation = 'use_baseballdata'; // Yahooがない場合
      }
      
    } catch (error) {
      console.error(`Validation failed for game ${gameId}:`, error);
      validation.recommendation = 'manual_review';
    }
    
    return validation;
  }
  
  /**
   * データ補完の実行
   */
  private async performDataComplement(validation: ValidationResult): Promise<void> {
    if (validation.recommendation === 'manual_review') {
      console.warn(`🔍 Game ${validation.gameId} requires manual review`);
      
      // 手動レビュー用ファイル生成
      const reviewFile = path.join(this.validationDir, `manual_review_${validation.gameId}.json`);
      await fs.writeFile(reviewFile, JSON.stringify(validation, null, 2));
      return;
    }
    
    if (validation.missingData.length > 0) {
      console.log(`🔧 Performing data complement for game ${validation.gameId}`);
      
      // 欠損データの補完ロジック
      for (const missing of validation.missingData) {
        if (missing.source === 'yahoo' && missing.missingFields.includes('game_data')) {
          // baseballdata.jp から Yahoo 形式のデータを生成
          await this.generateYahooFormatFromBaseballData(validation.gameId);
        }
      }
    }
  }
  
  /**
   * 日次レポート生成
   */
  private async generateDailyReport(date: string, validations: ValidationResult[]): Promise<void> {
    const report = {
      date,
      summary: {
        totalGames: validations.length,
        consistentGames: validations.filter(v => v.inconsistencies.length === 0).length,
        inconsistentGames: validations.filter(v => v.inconsistencies.length > 0).length,
        manualReviewRequired: validations.filter(v => v.recommendation === 'manual_review').length
      },
      details: validations,
      generatedAt: new Date().toISOString()
    };
    
    const reportFile = path.join(this.validationDir, `daily_report_${date}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📋 Daily report saved: ${reportFile}`);
    console.log(`   Consistent: ${report.summary.consistentGames}/${report.summary.totalGames}`);
    console.log(`   Manual review: ${report.summary.manualReviewRequired}`);
  }
  
  /**
   * ユーティリティメソッド
   */
  private parseInningsPitched(ipText: string): number {
    const match = ipText.match(/(\d+)\.?(\d)?/);
    if (match) {
      const innings = parseInt(match[1]) || 0;
      const thirds = parseInt(match[2]) || 0;
      return innings + (thirds / 3);
    }
    return 0;
  }
  
  private parseResult(resultText: string): 'W' | 'L' | 'S' | 'H' | 'BS' | undefined {
    const text = resultText.trim().toUpperCase();
    if (['W', 'L', 'S', 'H', 'BS'].includes(text)) {
      return text as 'W' | 'L' | 'S' | 'H' | 'BS';
    }
    return undefined;
  }
  
  private extractPitchersFromYahoo(yahooData: any): string[] {
    const pitchers = new Set<string>();
    
    if (yahooData.rows) {
      for (const row of yahooData.rows) {
        if (row.投手名) {
          pitchers.add(normalizeText(row.投手名));
        }
      }
    }
    
    return Array.from(pitchers);
  }
  
  private async generateYahooFormatFromBaseballData(gameId: string): Promise<void> {
    // baseballdata.jp のデータを Yahoo 形式に変換して保存
    // 実装は後回し
    console.log(`TODO: Generate Yahoo format data for game ${gameId} from baseballdata.jp`);
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI実行対応
export async function runDailyComplement(date: string, contactEmail?: string): Promise<void> {
  console.log(`Starting baseballdata.jp daily complement for ${date}`);
  
  const connector = new BaseballDataConnector(contactEmail);
  const results = await connector.performDailyComplement(date);
  
  console.log(`Daily complement completed: ${results.length} games processed`);
}