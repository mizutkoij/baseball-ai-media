import Database from 'better-sqlite3';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface UpsertOptions {
  dryRun?: boolean;
  chunkSize?: number;
  logDir?: string;
}

export interface UpsertResult {
  table: string;
  inserted: number;
  updated: number;
  deleted: number;
  errors: any[];
  duration: number;
}

export interface UpsertSummary {
  results: UpsertResult[];
  totalRecords: number;
  totalDuration: number;
  timestamp: string;
  success: boolean;
}

/**
 * DuckDB用の安全なUPSERT実装
 * トランザクション + 一時テーブルでデータ整合性を保証
 */
export class SafeUpsert {
  private db: Database.Database;
  private options: Required<UpsertOptions>;

  constructor(db: Database.Database, options: UpsertOptions = {}) {
    this.db = db;
    this.options = {
      dryRun: options.dryRun ?? false,
      chunkSize: options.chunkSize ?? 1000,
      logDir: options.logDir ?? './logs/upsert'
    };

    // ログディレクトリ作成
    if (!existsSync(this.options.logDir)) {
      mkdirSync(this.options.logDir, { recursive: true });
    }
  }

  /**
   * ゲームデータの安全なUPSERT
   */
  async upsertGames(gameData: any[], validGameIds: string[]): Promise<UpsertResult> {
    const startTime = Date.now();
    const result: UpsertResult = {
      table: 'games',
      inserted: 0,
      updated: 0,
      deleted: 0,
      errors: [],
      duration: 0
    };

    try {
      // 検証通過ゲームのみフィルタ
      const validData = gameData.filter(game => validGameIds.includes(game.game_id));
      
      if (this.options.dryRun) {
        console.log(`[DRY RUN] Would upsert ${validData.length} games`);
        result.inserted = validData.length;
        return result;
      }

      // トランザクション開始
      const transaction = this.db.transaction(() => {
        // 1. 一時テーブル作成
        this.db.exec(`
          CREATE TEMP TABLE IF NOT EXISTS temp_games AS 
          SELECT * FROM games WHERE 1=0
        `);

        // 2. 新データを一時テーブルに挿入
        const insertTemp = this.db.prepare(`
          INSERT INTO temp_games (
            game_id, date, league, away_team, home_team, away_score, home_score,
            status, inning, venue, start_time_jst, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let insertCount = 0;
        for (const game of validData) {
          try {
            insertTemp.run(
              game.game_id,
              game.date,
              game.league,
              game.away_team,
              game.home_team,
              game.away_score,
              game.home_score,
              game.status,
              game.inning,
              game.venue,
              game.start_time_jst,
              new Date().toISOString()
            );
            insertCount++;
          } catch (error) {
            result.errors.push({ game_id: game.game_id, error: String(error) });
          }
        }

        // 3. 既存データの重複削除
        const deleteExisting = this.db.prepare(`
          DELETE FROM games 
          WHERE game_id IN (SELECT game_id FROM temp_games)
        `);
        const deleteInfo = deleteExisting.run();
        result.deleted = deleteInfo.changes;

        // 4. 新データを本テーブルに移動
        const insertNew = this.db.prepare(`
          INSERT INTO games 
          SELECT * FROM temp_games
        `);
        const insertInfo = insertNew.run();
        result.inserted = insertInfo.changes;

        // 5. 一時テーブル削除
        this.db.exec('DROP TABLE temp_games');

        console.log(`✅ Games upsert: ${result.inserted} inserted, ${result.deleted} replaced`);
      });

      transaction();

    } catch (error) {
      result.errors.push({ error: String(error) });
      console.error('❌ Games upsert failed:', error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * 打撃データの安全なUPSERT
   */
  async upsertBatting(battingData: any[], validGameIds: string[]): Promise<UpsertResult> {
    const startTime = Date.now();
    const result: UpsertResult = {
      table: 'box_batting',
      inserted: 0,
      updated: 0,
      deleted: 0,
      errors: [],
      duration: 0
    };

    try {
      const validData = battingData.filter(row => validGameIds.includes(row.game_id));
      
      if (this.options.dryRun) {
        console.log(`[DRY RUN] Would upsert ${validData.length} batting records`);
        result.inserted = validData.length;
        return result;
      }

      const transaction = this.db.transaction(() => {
        // 一時テーブル作成
        this.db.exec(`
          CREATE TEMP TABLE IF NOT EXISTS temp_batting AS 
          SELECT * FROM box_batting WHERE 1=0
        `);

        // データ挿入（チャンク処理）
        const insertTemp = this.db.prepare(`
          INSERT INTO temp_batting (
            game_id, team, league, player_id, name, batting_order, position,
            AB, R, H, singles_2B, singles_3B, HR, RBI, BB, SO, SB, CS, AVG, OPS
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let processed = 0;
        for (let i = 0; i < validData.length; i += this.options.chunkSize) {
          const chunk = validData.slice(i, i + this.options.chunkSize);
          
          for (const row of chunk) {
            try {
              insertTemp.run(
                row.game_id, row.team, row.league, row.player_id, row.name,
                row.batting_order, row.position, row.AB, row.R, row.H,
                row.singles_2B, row.singles_3B, row.HR, row.RBI,
                row.BB, row.SO, row.SB, row.CS, row.AVG, row.OPS
              );
              processed++;
            } catch (error) {
              result.errors.push({ 
                game_id: row.game_id, 
                player_id: row.player_id, 
                error: String(error) 
              });
            }
          }
        }

        // 重複削除 & 挿入
        const deleteInfo = this.db.prepare(`
          DELETE FROM box_batting 
          WHERE game_id IN (SELECT DISTINCT game_id FROM temp_batting)
        `).run();
        result.deleted = deleteInfo.changes;

        const insertInfo = this.db.prepare(`
          INSERT INTO box_batting 
          SELECT * FROM temp_batting
        `).run();
        result.inserted = insertInfo.changes;

        this.db.exec('DROP TABLE temp_batting');
        
        console.log(`✅ Batting upsert: ${result.inserted} inserted, ${result.deleted} replaced`);
      });

      transaction();

    } catch (error) {
      result.errors.push({ error: String(error) });
      console.error('❌ Batting upsert failed:', error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * 投球データの安全なUPSERT
   */
  async upsertPitching(pitchingData: any[], validGameIds: string[]): Promise<UpsertResult> {
    const startTime = Date.now();
    const result: UpsertResult = {
      table: 'box_pitching',
      inserted: 0,
      updated: 0,
      deleted: 0,
      errors: [],
      duration: 0
    };

    try {
      const validData = pitchingData.filter(row => validGameIds.includes(row.game_id));
      
      if (this.options.dryRun) {
        console.log(`[DRY RUN] Would upsert ${validData.length} pitching records`);
        result.inserted = validData.length;
        return result;
      }

      const transaction = this.db.transaction(() => {
        this.db.exec(`
          CREATE TEMP TABLE IF NOT EXISTS temp_pitching AS 
          SELECT * FROM box_pitching WHERE 1=0
        `);

        const insertTemp = this.db.prepare(`
          INSERT INTO temp_pitching (
            game_id, team, league, opponent, player_id, name,
            IP, H, R, ER, BB, SO, HR_allowed, ERA, WHIP
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of validData) {
          try {
            insertTemp.run(
              row.game_id, row.team, row.league, row.opponent, row.player_id, row.name,
              row.IP, row.H, row.R, row.ER, row.BB, row.SO, row.HR_allowed, row.ERA, row.WHIP
            );
          } catch (error) {
            result.errors.push({ 
              game_id: row.game_id, 
              player_id: row.player_id, 
              error: String(error) 
            });
          }
        }

        const deleteInfo = this.db.prepare(`
          DELETE FROM box_pitching 
          WHERE game_id IN (SELECT DISTINCT game_id FROM temp_pitching)
        `).run();
        result.deleted = deleteInfo.changes;

        const insertInfo = this.db.prepare(`
          INSERT INTO box_pitching 
          SELECT * FROM temp_pitching
        `).run();
        result.inserted = insertInfo.changes;

        this.db.exec('DROP TABLE temp_pitching');
        
        console.log(`✅ Pitching upsert: ${result.inserted} inserted, ${result.deleted} replaced`);
      });

      transaction();

    } catch (error) {
      result.errors.push({ error: String(error) });
      console.error('❌ Pitching upsert failed:', error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * 全テーブルの一括UPSERT
   */
  async upsertAll(data: {
    games?: any[];
    batting?: any[];
    pitching?: any[];
  }, validGameIds: string[]): Promise<UpsertSummary> {
    const startTime = Date.now();
    const results: UpsertResult[] = [];

    try {
      if (data.games) {
        results.push(await this.upsertGames(data.games, validGameIds));
      }
      if (data.batting) {
        results.push(await this.upsertBatting(data.batting, validGameIds));
      }
      if (data.pitching) {
        results.push(await this.upsertPitching(data.pitching, validGameIds));
      }

      const summary: UpsertSummary = {
        results,
        totalRecords: results.reduce((sum, r) => sum + r.inserted, 0),
        totalDuration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        success: results.every(r => r.errors.length === 0)
      };

      // ログ保存
      const logFile = join(this.options.logDir, `upsert_${Date.now()}.json`);
      writeFileSync(logFile, JSON.stringify(summary, null, 2));

      return summary;

    } catch (error) {
      throw new Error(`Upsert failed: ${error}`);
    }
  }
}

/**
 * CLI実行用
 */
export async function main() {
  // 実装例は ingest_month.ts で使用
  console.log('SafeUpsert utility loaded');
}

if (require.main === module) {
  main();
}