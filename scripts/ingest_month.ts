import Database from 'better-sqlite3';
import { validateGames, getValidGames, saveValidationResults } from './validate';
import { SafeUpsert } from './upsert';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface IngestOptions {
  year: number;
  month: number;
  dryRun?: boolean;
  apply?: boolean;
  source?: 'npb' | 'mock';
  batchSize?: number;
  logDir?: string;
}

interface IngestResult {
  summary: {
    month: string;
    totalGames: number;
    validGames: number;
    invalidGames: number;
    insertedRecords: number;
    duration: number;
    timestamp: string;
  };
  validation: {
    errorCount: number;
    warningCount: number;
    errorGames: string[];
  };
  ingestion: {
    games: number;
    batting: number;
    pitching: number;
  };
  success: boolean;
}

/**
 * NPBデータの月単位取り込み処理
 * fetch → parse → validate → upsert の統合パイプライン
 */
export class MonthlyIngest {
  private options: Required<IngestOptions>;
  private db: Database.Database;
  private upsert: SafeUpsert;

  constructor(options: IngestOptions) {
    this.options = {
      year: options.year,
      month: options.month,
      dryRun: options.dryRun ?? false,
      apply: options.apply ?? false,
      source: options.source ?? 'npb',
      batchSize: options.batchSize ?? 50,
      logDir: options.logDir ?? './logs/ingest'
    };

    // ログディレクトリ作成
    if (!existsSync(this.options.logDir)) {
      mkdirSync(this.options.logDir, { recursive: true });
    }

    // データベース接続（物理分割対応: 常にdb_currentに書き込み）
    const dbPath = process.env.DB_CURRENT || './data/db_current.db';
    this.db = new Database(dbPath);
    
    // UPSERT管理
    this.upsert = new SafeUpsert(this.db, {
      dryRun: this.options.dryRun,
      chunkSize: this.options.batchSize,
      logDir: join(this.options.logDir, 'upsert')
    });

    console.log(`🚀 Monthly Ingest initialized: ${this.options.year}-${this.options.month.toString().padStart(2, '0')}`);
    console.log(`Mode: ${this.options.dryRun ? 'DRY RUN' : this.options.apply ? 'APPLY' : 'VALIDATE ONLY'}`);
  }

  /**
   * NPB公式サイトからの月間データ取得（モック版）
   */
  private async fetchMonthData(): Promise<{
    games: any[];
    batting: any[];
    pitching: any[];
  }> {
    if (this.options.source === 'mock') {
      return this.generateMockData();
    }

    // 実際のNPB APIアクセス（今回はモック）
    console.log(`📡 Fetching data from NPB for ${this.options.year}-${this.options.month}...`);
    
    // TODO: 実際のNPB API統合
    // const api = new NPBApiClient();
    // const data = await api.fetchMonth(this.options.year, this.options.month);
    
    return this.generateMockData(); // 暫定
  }

  /**
   * テスト用モックデータ生成
   */
  private generateMockData(): { games: any[]; batting: any[]; pitching: any[] } {
    const monthStr = this.options.month.toString().padStart(2, '0');
    const games = [];
    const batting = [];
    const pitching = [];

    // 月間約60試合をシミュレート
    for (let day = 1; day <= 30; day++) {
      if (Math.random() < 0.7) { // 70%の確率で試合あり
        const gameId = `${this.options.year}${monthStr}${day.toString().padStart(2, '0')}_001`;
        const awayScore = Math.floor(Math.random() * 10);
        const homeScore = Math.floor(Math.random() * 10);
        
        // ゲーム情報
        games.push({
          game_id: gameId,
          date: `${this.options.year}-${monthStr}-${day.toString().padStart(2, '0')}`,
          league: Math.random() > 0.5 ? 'Central' : 'Pacific',
          away_team: '巨人',
          home_team: '阪神',
          away_score: awayScore,
          home_score: homeScore,
          status: 'final',
          venue: '阪神甲子園球場',
          start_time_jst: '18:00'
        });

        // 打撃データ（各チーム9人）
        for (const team of ['巨人', '阪神']) {
          for (let i = 1; i <= 9; i++) {
            const ab = Math.floor(Math.random() * 5) + 1;
            const h = Math.floor(Math.random() * ab);
            const hr = Math.random() < 0.1 ? 1 : 0;
            const singles_2b = Math.random() < 0.2 ? 1 : 0;
            
            batting.push({
              game_id: gameId,
              team: team,
              league: games[games.length - 1].league,
              player_id: `player_${team}_${i}`,
              name: `選手${i}`,
              batting_order: i,
              position: i === 1 ? 'P' : 'B',
              AB: ab,
              R: Math.floor(Math.random() * 2),
              H: h,
              singles_2B: singles_2b,
              singles_3B: 0,
              HR: hr,
              RBI: Math.floor(Math.random() * 3),
              BB: Math.floor(Math.random() * 2),
              SO: Math.floor(Math.random() * 2),
              SB: 0,
              CS: 0,
              AVG: h / ab,
              OPS: (h / ab) + ((h + Math.random()) / ab)
            });
          }
        }

        // 投球データ（各チーム3-4人）
        for (const team of ['巨人', '阪神']) {
          for (let i = 1; i <= 3; i++) {
            const ip = Math.random() * 9;
            const hits = Math.floor(Math.random() * 8);
            const runs = Math.floor(Math.random() * 5);
            const er = Math.min(runs, Math.floor(Math.random() * 4));
            
            pitching.push({
              game_id: gameId,
              team: team,
              league: games[games.length - 1].league,
              opponent: team === '巨人' ? '阪神' : '巨人',
              player_id: `pitcher_${team}_${i}`,
              name: `投手${i}`,
              IP: ip,
              H: hits,
              R: runs,
              ER: er,
              BB: Math.floor(Math.random() * 3),
              SO: Math.floor(Math.random() * 8),
              HR_allowed: Math.random() < 0.15 ? 1 : 0,
              ERA: ip > 0 ? (er * 9) / ip : 0,
              WHIP: ip > 0 ? (hits + Math.random() * 3) / ip : 0
            });
          }
        }
      }
    }

    console.log(`📊 Generated mock data: ${games.length} games, ${batting.length} batting, ${pitching.length} pitching`);
    return { games, batting, pitching };
  }

  /**
   * データ検証実行
   */
  private async validateData(games: any[]): Promise<{ validGameIds: string[]; validationResults: any[] }> {
    console.log(`🔍 Validating ${games.length} games...`);
    
    const gameIds = games.map(g => g.game_id);
    const validationResults = await validateGames(this.db, gameIds);
    
    // 検証結果をログ保存
    const dateStr = `${this.options.year}${this.options.month.toString().padStart(2, '0')}`;
    const validationDir = join(this.options.logDir, 'validate', dateStr);
    saveValidationResults(validationResults, validationDir);
    
    const validGameIds = getValidGames(validationResults);
    
    console.log(`✅ Validation complete: ${validGameIds.length}/${games.length} games passed`);
    
    return { validGameIds, validationResults };
  }

  /**
   * データ取り込み実行
   */
  private async ingestData(data: { games: any[]; batting: any[]; pitching: any[] }, validGameIds: string[]): Promise<any> {
    if (!this.options.apply && !this.options.dryRun) {
      console.log('💤 Skipping ingestion (use --apply or --dry-run)');
      return null;
    }

    console.log(`📥 Ingesting data for ${validGameIds.length} valid games...`);
    
    const upsertResult = await this.upsert.upsertAll(data, validGameIds);
    
    console.log(`✅ Ingestion complete: ${upsertResult.totalRecords} records in ${upsertResult.totalDuration}ms`);
    
    return upsertResult;
  }

  /**
   * メイン処理実行
   */
  async run(): Promise<IngestResult> {
    const startTime = Date.now();
    
    try {
      // 1. データ取得
      const rawData = await this.fetchMonthData();
      
      // 2. データ検証
      const { validGameIds, validationResults } = await this.validateData(rawData.games);
      
      // 3. データ取り込み
      const upsertResult = await this.ingestData(rawData, validGameIds);
      
      // 4. 結果サマリ作成
      const result: IngestResult = {
        summary: {
          month: `${this.options.year}-${this.options.month.toString().padStart(2, '0')}`,
          totalGames: rawData.games.length,
          validGames: validGameIds.length,
          invalidGames: rawData.games.length - validGameIds.length,
          insertedRecords: upsertResult?.totalRecords || 0,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        },
        validation: {
          errorCount: validationResults.reduce((sum, r) => sum + r.findings.filter((f: any) => f.severity === 'error').length, 0),
          warningCount: validationResults.reduce((sum, r) => sum + r.findings.filter((f: any) => f.severity === 'warning').length, 0),
          errorGames: validationResults.filter(r => r.hasErrors).map(r => r.gameId)
        },
        ingestion: {
          games: upsertResult?.results.find(r => r.table === 'games')?.inserted || 0,
          batting: upsertResult?.results.find(r => r.table === 'box_batting')?.inserted || 0,
          pitching: upsertResult?.results.find(r => r.table === 'box_pitching')?.inserted || 0
        },
        success: (upsertResult?.success ?? true) && validGameIds.length > 0
      };

      // 5. 結果ログ保存
      const resultLogPath = join(
        this.options.logDir, 
        `ingest_${this.options.year}_${this.options.month.toString().padStart(2, '0')}.json`
      );
      writeFileSync(resultLogPath, JSON.stringify(result, null, 2));

      console.log(`🎉 Monthly ingest completed successfully!`);
      console.log(`📈 Summary: ${result.summary.validGames}/${result.summary.totalGames} games, ${result.summary.insertedRecords} records`);
      
      return result;

    } catch (error) {
      console.error(`❌ Monthly ingest failed:`, error);
      
      const errorResult: IngestResult = {
        summary: {
          month: `${this.options.year}-${this.options.month.toString().padStart(2, '0')}`,
          totalGames: 0,
          validGames: 0,
          invalidGames: 0,
          insertedRecords: 0,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        },
        validation: { errorCount: 0, warningCount: 0, errorGames: [] },
        ingestion: { games: 0, batting: 0, pitching: 0 },
        success: false
      };

      return errorResult;
    } finally {
      this.db.close();
    }
  }
}

/**
 * CLI実行
 */
export async function main() {
  const args = process.argv.slice(2);
  
  let year: number | undefined;
  let month: number | undefined;
  let dryRun = false;
  let apply = false;
  
  // 引数解析
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--year':
        year = parseInt(args[++i]);
        break;
      case '--month':
        month = parseInt(args[++i]);
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--apply':
        apply = true;
        break;
    }
  }

  if (!year || !month) {
    console.error('Usage: tsx ingest_month.ts --year YYYY --month MM [--dry-run|--apply]');
    console.error('Example: tsx ingest_month.ts --year 2025 --month 7 --apply');
    process.exit(1);
  }

  if (month < 1 || month > 12) {
    console.error('❌ Month must be between 1 and 12');
    process.exit(1);
  }

  const ingest = new MonthlyIngest({ year, month, dryRun, apply });
  const result = await ingest.run();
  
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}