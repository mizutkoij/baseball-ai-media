#!/usr/bin/env tsx
/**
 * fetch_npb_schedule.ts - NPB公式サイトから試合日程・結果を取得してデータベースに保存
 * 
 * 使用例:
 *   npx tsx scripts/fetch_npb_schedule.ts --year 2024 --month 8
 *   npx tsx scripts/fetch_npb_schedule.ts --today
 *   npx tsx scripts/fetch_npb_schedule.ts --year 2024 --month 8 --dry-run
 */

import { Command } from 'commander';
import Database from 'better-sqlite3';
import { NPBScraper, NPBDataValidator, GameData } from '../lib/npb-scraper';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface FetchOptions {
  year?: number;
  month?: number;
  today?: boolean;
  dryRun?: boolean;
  output?: string;
  verbose?: boolean;
  league?: 'first' | 'farm' | 'both';
}

interface FetchResult {
  success: boolean;
  totalGames: number;
  validGames: number;
  invalidGames: number;
  insertedGames: number;
  updatedGames: number;
  errors: string[];
  duration: number;
  timestamp: string;
}

class NPBScheduleFetcher {
  private db: Database.Database;
  private scraper: NPBScraper;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.scraper = new NPBScraper();
    this.initializeDatabase();
  }

  /**
   * データベースの初期化
   */
  private initializeDatabase(): void {
    // gamesテーブルが存在しない場合は作成
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        game_id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        league TEXT,
        away_team TEXT NOT NULL,
        home_team TEXT NOT NULL,
        away_score INTEGER,
        home_score INTEGER,
        status TEXT DEFAULT 'scheduled',
        inning INTEGER,
        venue TEXT,
        start_time_jst TEXT,
        box_score_url TEXT,
        play_by_play_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // インデックスの作成
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_games_date ON games(date);
      CREATE INDEX IF NOT EXISTS idx_games_teams ON games(away_team, home_team);
      CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
    `);
  }

  /**
   * 指定月の試合データを取得・保存
   */
  async fetchMonth(options: FetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const result: FetchResult = {
      success: false,
      totalGames: 0,
      validGames: 0,
      invalidGames: 0,
      insertedGames: 0,
      updatedGames: 0,
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString()
    };

    try {
      const { year, month, league = 'first' } = options;
      
      if (!year || !month) {
        throw new Error('Year and month are required');
      }

      console.log(`\n📅 Fetching NPB schedule for ${year}/${month} (${league})...`);

      // データ取得
      const games = await this.scraper.fetchMonthSchedule({
        year,
        month,
        league,
        includeDetails: true
      });

      result.totalGames = games.length;
      console.log(`📊 Fetched ${games.length} games`);

      if (games.length === 0) {
        console.log('⚠️  No games found for the specified period');
        result.success = true;
        return result;
      }

      // データ検証
      const validation = NPBDataValidator.validateGames(games);
      result.validGames = validation.validGames.length;
      result.invalidGames = validation.invalidGames.length;

      if (validation.invalidGames.length > 0) {
        console.log(`⚠️  ${validation.invalidGames.length} invalid games found:`);
        validation.invalidGames.forEach(({ game, errors }) => {
          console.log(`   - ${game.game_id}: ${errors.join(', ')}`);
          result.errors.push(`${game.game_id}: ${errors.join(', ')}`);
        });
      }

      // ドライランの場合はここで終了
      if (options.dryRun) {
        console.log('\n🔍 Dry run completed - no data was saved');
        this.printGamesSummary(validation.validGames);
        result.success = true;
        return result;
      }

      // データベースに保存
      const { inserted, updated } = await this.saveGames(validation.validGames);
      result.insertedGames = inserted;
      result.updatedGames = updated;

      console.log(`\n✅ Successfully processed ${validation.validGames.length} games`);
      console.log(`   📥 Inserted: ${inserted} games`);
      console.log(`   🔄 Updated: ${updated} games`);

      result.success = true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error fetching schedule: ${errorMessage}`);
      result.errors.push(errorMessage);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * 今日の試合データを取得・更新
   */
  async fetchToday(options: FetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const result: FetchResult = {
      success: false,
      totalGames: 0,
      validGames: 0,
      invalidGames: 0,
      insertedGames: 0,
      updatedGames: 0,
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString()
    };

    try {
      console.log('\n📅 Fetching today\'s NPB games...');

      const games = await this.scraper.fetchTodayGames();
      result.totalGames = games.length;

      console.log(`📊 Found ${games.length} games for today`);

      if (games.length === 0) {
        console.log('⚠️  No games scheduled for today');
        result.success = true;
        return result;
      }

      // 進行中の試合のスコア更新
      const updatedGames = await this.scraper.updateLiveGames(games);

      // データ検証
      const validation = NPBDataValidator.validateGames(updatedGames);
      result.validGames = validation.validGames.length;
      result.invalidGames = validation.invalidGames.length;

      if (validation.invalidGames.length > 0) {
        console.log(`⚠️  ${validation.invalidGames.length} invalid games found`);
        validation.invalidGames.forEach(({ errors }) => {
          result.errors.push(...errors);
        });
      }

      // ドライランチェック
      if (options.dryRun) {
        console.log('\n🔍 Dry run completed - no data was saved');
        this.printTodayGamesSummary(validation.validGames);
        result.success = true;
        return result;
      }

      // データベースに保存
      const { inserted, updated } = await this.saveGames(validation.validGames);
      result.insertedGames = inserted;
      result.updatedGames = updated;

      console.log(`\n✅ Successfully updated today's games`);
      console.log(`   📥 Inserted: ${inserted} games`);
      console.log(`   🔄 Updated: ${updated} games`);

      result.success = true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error fetching today's games: ${errorMessage}`);
      result.errors.push(errorMessage);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * ゲームデータをデータベースに保存
   */
  private async saveGames(games: GameData[]): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;

    const upsertStmt = this.db.prepare(`
      INSERT INTO games (
        game_id, date, league, away_team, home_team,
        away_score, home_score, status, inning, venue,
        start_time_jst, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(game_id) DO UPDATE SET
        away_score = excluded.away_score,
        home_score = excluded.home_score,
        status = excluded.status,
        inning = excluded.inning,
        venue = excluded.venue,
        start_time_jst = excluded.start_time_jst,
        updated_at = excluded.updated_at
      WHERE 
        games.status != excluded.status OR
        games.away_score != excluded.away_score OR
        games.home_score != excluded.home_score
    `);

    const existsStmt = this.db.prepare(`
      SELECT game_id FROM games WHERE game_id = ?
    `);

    for (const game of games) {
      try {
        const exists = existsStmt.get(game.game_id);
        
        upsertStmt.run(
          game.game_id,
          game.date,
          game.league,
          game.away_team,
          game.home_team,
          game.away_score || null,
          game.home_score || null,
          game.status,
          game.inning || null,
          game.venue || null,
          game.start_time_jst || null,
          game.updated_at
        );

        if (exists) {
          updated++;
        } else {
          inserted++;
        }
      } catch (error) {
        console.error(`Error saving game ${game.game_id}:`, error);
      }
    }

    return { inserted, updated };
  }

  /**
   * 試合データのサマリー表示
   */
  private printGamesSummary(games: GameData[]): void {
    console.log('\n📋 Games Summary:');
    
    const statusCounts = games.reduce((acc, game) => {
      acc[game.status] = (acc[game.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${this.getStatusEmoji(status)} ${status}: ${count} games`);
    });

    if (games.length > 0) {
      console.log(`\n📅 Date range: ${games[0].date} - ${games[games.length - 1].date}`);
    }
  }

  /**
   * 今日の試合のサマリー表示
   */
  private printTodayGamesSummary(games: GameData[]): void {
    console.log('\n🏟️  Today\'s Games:');
    
    games.forEach(game => {
      const score = game.away_score !== undefined && game.home_score !== undefined
        ? `${game.away_score}-${game.home_score}`
        : 'vs';
      
      console.log(`   ${this.getStatusEmoji(game.status)} ${game.away_team} ${score} ${game.home_team} (${game.venue || 'TBD'})`);
    });
  }

  /**
   * ステータス用絵文字取得
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      'scheduled': '📅',
      'live': '🔴',
      'final': '✅',
      'postponed': '⏸️',
      'cancelled': '❌'
    };
    return emojis[status] || '❓';
  }

  /**
   * 結果をJSONファイルに出力
   */
  saveResultToFile(result: FetchResult, outputPath: string): void {
    const dir = join(process.cwd(), 'logs');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const fullPath = join(dir, outputPath);
    writeFileSync(fullPath, JSON.stringify(result, null, 2));
    console.log(`📄 Result saved to: ${fullPath}`);
  }

  close(): void {
    this.db.close();
  }
}

// CLI実行部分
async function main() {
  const program = new Command();

  program
    .name('fetch-npb-schedule')
    .description('Fetch NPB schedule and results from official website')
    .version('1.0.0');

  program
    .option('-y, --year <year>', 'Year to fetch (required unless --today)', parseInt)
    .option('-m, --month <month>', 'Month to fetch (required unless --today)', parseInt)
    .option('-t, --today', 'Fetch today\'s games only')
    .option('-d, --dry-run', 'Show what would be fetched without saving to database')
    .option('-l, --league <league>', 'League to fetch (first, farm, both)', 'first')
    .option('-o, --output <file>', 'Output result to JSON file')
    .option('-v, --verbose', 'Verbose output')
    .option('--db <path>', 'Database path', './data/db_current.db');

  program.parse();

  const options = program.opts() as FetchOptions & { db: string };

  // 入力検証
  if (!options.today && (!options.year || !options.month)) {
    console.error('❌ Error: --year and --month are required unless --today is specified');
    process.exit(1);
  }

  // データベースパスの確認
  const dbPath = options.db;
  const dbDir = join(process.cwd(), 'data');
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  console.log(`🗄️  Using database: ${dbPath}`);

  const fetcher = new NPBScheduleFetcher(dbPath);

  try {
    let result: FetchResult;

    if (options.today) {
      result = await fetcher.fetchToday(options);
    } else {
      result = await fetcher.fetchMonth(options);
    }

    // 結果の表示
    console.log(`\n📊 Fetch completed in ${result.duration}ms`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    
    if (result.errors.length > 0) {
      console.log('   Errors:');
      result.errors.forEach(error => console.log(`     - ${error}`));
    }

    // 結果をファイルに保存
    if (options.output) {
      fetcher.saveResultToFile(result, options.output);
    }

    // 終了コードの設定
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    fetcher.close();
  }
}

// 直接実行された場合のみmainを実行
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { NPBScheduleFetcher };