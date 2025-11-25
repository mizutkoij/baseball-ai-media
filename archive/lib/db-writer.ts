/**
 * Database Writer for NPB Baseball Data
 * PostgreSQL integration with type safety and upsert operations
 */

import { Pool, PoolClient } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';

// Type definitions
export interface GameRecord {
  gameId: string;
  level: 'NPB1' | 'NPB2';
  farmLeague?: 'EAST' | 'WEST';
  date: string;                     // 'YYYY-MM-DD'
  homeTeam?: string;
  awayTeam?: string;
  venue?: string;
  venueNormalized?: string;
  finalScoreHome?: number;
  finalScoreAway?: number;
  status?: 'scheduled' | 'live' | 'finished';
  source?: string;
}

export interface PitchEvent {
  gameId: string;
  idx: number;
  pitchNo: number;
  inning?: number;
  half?: 'top' | 'bottom';
  outs?: number;
  balls?: number;
  strikes?: number;
  
  // Batter info
  batterName?: string;
  batterHand?: 'L' | 'R';
  
  // Pitcher info
  pitcherName?: string;
  pitcherHand?: 'L' | 'R';
  
  // Pitch details
  pitchType?: string;
  speedKmh?: number | null;
  resultCode?: string;
  
  // Coordinates (normalized)
  plateX?: number | null;         // -0.83 to +0.83
  plateZ?: number | null;         // 0.5 to 3.5
  zone?: string;
  
  // Runner situation
  runner1b?: boolean;
  runner2b?: boolean;
  runner3b?: boolean;
  
  // Metadata
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
  raw?: any;
}

export interface PlayerAggregation {
  gameId: string;
  playerName: string;
  playerRole: 'batter' | 'pitcher';
  aggType: 'pitch_mix' | 'zone_matrix' | 'by_inning' | 'avg_velo';
  aggData: any;
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
  alignmentScore?: number;          // 0.0-1.0
  flags?: string[];
}

export interface PlateAppearance {
  gameId: string;
  idx: number;
  inning?: number;
  half?: 'top' | 'bottom';
  outsStart?: number;
  batterName?: string;
  pitcherName?: string;
  paResult?: string;
  pitchCount?: number;
  finalCount?: string;
  totalPitches?: number;
  strikesThrown?: number;
  ballsThrown?: number;
  foulsHit?: number;
  source?: string;
}

/**
 * Database connection pool
 */
class DatabasePool {
  private static instance: DatabasePool;
  private pool: Pool;
  
  private constructor() {
    const connectionString = process.env.DATABASE_URL || process.env.PGURL;
    if (!connectionString) {
      throw new Error('DATABASE_URL or PGURL environment variable is required');
    }
    
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Connection error handling
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  
  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }
  
  getPool(): Pool {
    return this.pool;
  }
  
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Database Writer
 */
export class NPBDatabaseWriter {
  private pool: Pool;
  
  constructor() {
    this.pool = DatabasePool.getInstance().getPool();
  }
  
  /**
   * Upsert game record
   */
  async upsertGame(game: GameRecord): Promise<void> {
    const query = `
      INSERT INTO games (
        game_id, level, farm_league, date, home_team, away_team, 
        venue, venue_normalized, final_score_home, final_score_away, status, source
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      ON CONFLICT (game_id) DO UPDATE SET
        level = EXCLUDED.level,
        farm_league = EXCLUDED.farm_league,
        home_team = COALESCE(EXCLUDED.home_team, games.home_team),
        away_team = COALESCE(EXCLUDED.away_team, games.away_team),
        venue = COALESCE(EXCLUDED.venue, games.venue),
        venue_normalized = COALESCE(EXCLUDED.venue_normalized, games.venue_normalized),
        final_score_home = COALESCE(EXCLUDED.final_score_home, games.final_score_home),
        final_score_away = COALESCE(EXCLUDED.final_score_away, games.final_score_away),
        status = COALESCE(EXCLUDED.status, games.status),
        updated_at = now()
    `;
    
    const values = [
      game.gameId,
      game.level,
      game.farmLeague || null,
      game.date,
      game.homeTeam || null,
      game.awayTeam || null,
      game.venue || null,
      game.venueNormalized || null,
      game.finalScoreHome || null,
      game.finalScoreAway || null,
      game.status || 'scheduled',
      game.source || 'yahoo'
    ];
    
    await this.pool.query(query, values);
  }
  
  /**
   * Batch upsert pitch events
   */
  async upsertPitchEvents(events: PitchEvent[]): Promise<number> {
    if (!events.length) return 0;
    
    const client = await this.pool.connect();
    let upsertedCount = 0;
    
    try {
      await client.query('BEGIN');
      
      for (const event of events) {
        const eventId = `${event.gameId}:${event.idx}:${event.pitchNo}`;
        
        const query = `
          INSERT INTO pitch_events (
            event_id, game_id, idx, pitch_no, inning, half, outs, balls, strikes,
            batter_name, batter_hand, pitcher_name, pitcher_hand,
            pitch_type, speed_kmh, result_code, plate_x, plate_z, zone,
            runner_1b, runner_2b, runner_3b, confidence, source, raw
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
          )
          ON CONFLICT (event_id) DO UPDATE SET
            inning = COALESCE(EXCLUDED.inning, pitch_events.inning),
            half = COALESCE(EXCLUDED.half, pitch_events.half),
            outs = COALESCE(EXCLUDED.outs, pitch_events.outs),
            balls = COALESCE(EXCLUDED.balls, pitch_events.balls),
            strikes = COALESCE(EXCLUDED.strikes, pitch_events.strikes),
            batter_name = COALESCE(EXCLUDED.batter_name, pitch_events.batter_name),
            batter_hand = COALESCE(EXCLUDED.batter_hand, pitch_events.batter_hand),
            pitcher_name = COALESCE(EXCLUDED.pitcher_name, pitch_events.pitcher_name),
            pitcher_hand = COALESCE(EXCLUDED.pitcher_hand, pitch_events.pitcher_hand),
            pitch_type = COALESCE(EXCLUDED.pitch_type, pitch_events.pitch_type),
            speed_kmh = COALESCE(EXCLUDED.speed_kmh, pitch_events.speed_kmh),
            result_code = COALESCE(EXCLUDED.result_code, pitch_events.result_code),
            plate_x = COALESCE(EXCLUDED.plate_x, pitch_events.plate_x),
            plate_z = COALESCE(EXCLUDED.plate_z, pitch_events.plate_z),
            zone = COALESCE(EXCLUDED.zone, pitch_events.zone),
            runner_1b = COALESCE(EXCLUDED.runner_1b, pitch_events.runner_1b),
            runner_2b = COALESCE(EXCLUDED.runner_2b, pitch_events.runner_2b),
            runner_3b = COALESCE(EXCLUDED.runner_3b, pitch_events.runner_3b),
            confidence = EXCLUDED.confidence,
            raw = COALESCE(EXCLUDED.raw, pitch_events.raw)
        `;
        
        const values = [
          eventId,
          event.gameId,
          event.idx,
          event.pitchNo,
          event.inning || null,
          event.half || null,
          event.outs || null,
          event.balls || null,
          event.strikes || null,
          event.batterName || null,
          event.batterHand || null,
          event.pitcherName || null,
          event.pitcherHand || null,
          event.pitchType || null,
          event.speedKmh || null,
          event.resultCode || null,
          event.plateX || null,
          event.plateZ || null,
          event.zone || null,
          event.runner1b || false,
          event.runner2b || false,
          event.runner3b || false,
          event.confidence || 'high',
          event.source || 'yahoo',
          event.raw ? JSON.stringify(event.raw) : null
        ];
        
        await client.query(query, values);
        upsertedCount++;
      }
      
      await client.query('COMMIT');
      return upsertedCount;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to upsert pitch events:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Upsert player aggregation
   */
  async upsertPlayerAggregation(agg: PlayerAggregation): Promise<void> {
    const aggId = `${agg.playerName}:${agg.gameId}:${agg.aggType}`;
    
    const query = `
      INSERT INTO player_aggregations (
        agg_id, game_id, player_name, player_role, agg_type, agg_data,
        confidence, source, alignment_score, flags
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      ON CONFLICT (agg_id) DO UPDATE SET
        agg_data = EXCLUDED.agg_data,
        confidence = EXCLUDED.confidence,
        alignment_score = EXCLUDED.alignment_score,
        flags = EXCLUDED.flags,
        ts_ingested = now()
    `;
    
    const values = [
      aggId,
      agg.gameId,
      agg.playerName,
      agg.playerRole,
      agg.aggType,
      JSON.stringify(agg.aggData),
      agg.confidence || 'medium',
      agg.source || 'baseballdata',
      agg.alignmentScore || null,
      agg.flags || null
    ];
    
    await this.pool.query(query, values);
  }
  
  /**
   * Upsert plate appearance
   */
  async upsertPlateAppearance(pa: PlateAppearance): Promise<void> {
    const paId = `${pa.gameId}:${pa.idx}`;
    
    const query = `
      INSERT INTO plate_appearances (
        pa_id, game_id, idx, inning, half, outs_start, batter_name, pitcher_name,
        pa_result, pitch_count, final_count, total_pitches, strikes_thrown, 
        balls_thrown, fouls_hit, source
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT (pa_id) DO UPDATE SET
        inning = COALESCE(EXCLUDED.inning, plate_appearances.inning),
        half = COALESCE(EXCLUDED.half, plate_appearances.half),
        outs_start = COALESCE(EXCLUDED.outs_start, plate_appearances.outs_start),
        batter_name = COALESCE(EXCLUDED.batter_name, plate_appearances.batter_name),
        pitcher_name = COALESCE(EXCLUDED.pitcher_name, plate_appearances.pitcher_name),
        pa_result = COALESCE(EXCLUDED.pa_result, plate_appearances.pa_result),
        pitch_count = COALESCE(EXCLUDED.pitch_count, plate_appearances.pitch_count),
        final_count = COALESCE(EXCLUDED.final_count, plate_appearances.final_count),
        total_pitches = EXCLUDED.total_pitches,
        strikes_thrown = EXCLUDED.strikes_thrown,
        balls_thrown = EXCLUDED.balls_thrown,
        fouls_hit = EXCLUDED.fouls_hit,
        ts_ingested = now()
    `;
    
    const values = [
      paId,
      pa.gameId,
      pa.idx,
      pa.inning || null,
      pa.half || null,
      pa.outsStart || null,
      pa.batterName || null,
      pa.pitcherName || null,
      pa.paResult || null,
      pa.pitchCount || null,
      pa.finalCount || null,
      pa.totalPitches || 0,
      pa.strikesThrown || 0,
      pa.ballsThrown || 0,
      pa.foulsHit || 0,
      pa.source || 'yahoo'
    ];
    
    await this.pool.query(query, values);
  }
  
  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    const queries = {
      games: 'SELECT level, COUNT(*) as count FROM games GROUP BY level',
      pitches: 'SELECT DATE(ts_ingested), COUNT(*) as count FROM pitch_events WHERE ts_ingested > NOW() - INTERVAL \'7 days\' GROUP BY DATE(ts_ingested) ORDER BY DATE(ts_ingested)',
      sources: 'SELECT source, COUNT(*) as count FROM pitch_events GROUP BY source',
      quality: 'SELECT confidence, COUNT(*) as count FROM pitch_events GROUP BY confidence'
    };
    
    const results: any = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await this.pool.query(query);
        results[key] = result.rows;
      } catch (error) {
        console.error(`Failed to get ${key} stats:`, error);
        results[key] = [];
      }
    }
    
    return results;
  }
  
  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT NOW() as current_time');
      console.log('Database connection successful:', result.rows[0].current_time);
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }
}

// Singleton instance
let dbWriterInstance: NPBDatabaseWriter | null = null;

export function getDBWriter(): NPBDatabaseWriter {
  if (!dbWriterInstance) {
    dbWriterInstance = new NPBDatabaseWriter();
  }
  return dbWriterInstance;
}

// Utility functions for easy access
export async function upsertGame(game: GameRecord): Promise<void> {
  const writer = getDBWriter();
  await writer.upsertGame(game);
}

export async function upsertPitchEvents(events: PitchEvent[]): Promise<number> {
  const writer = getDBWriter();
  return await writer.upsertPitchEvents(events);
}

export async function upsertPlayerAggregation(agg: PlayerAggregation): Promise<void> {
  const writer = getDBWriter();
  await writer.upsertPlayerAggregation(agg);
}

export async function upsertPlateAppearance(pa: PlateAppearance): Promise<void> {
  const writer = getDBWriter();
  await writer.upsertPlateAppearance(pa);
}

export async function getDBStats(): Promise<any> {
  const writer = getDBWriter();
  return await writer.getStats();
}

export async function testDBConnection(): Promise<boolean> {
  const writer = getDBWriter();
  return await writer.testConnection();
}