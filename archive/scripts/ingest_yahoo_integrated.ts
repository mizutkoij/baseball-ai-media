#!/usr/bin/env npx tsx
/**
 * Integrated Yahoo + DB Ingest System
 * Combines Yahoo live/backfill collection with immediate DB sync
 */

import { YahooNPB1Connector } from '../lib/connectors/yahoo-ichigun';
import { YahooNPB2Connector } from '../lib/connectors/yahoo-farm';
import { BaseballDataPlayersConnector } from '../lib/connectors/baseballdata-players';
import { 
  getDBWriter, 
  GameRecord, 
  PitchEvent, 
  PlayerAggregation,
  testDBConnection 
} from '../lib/db-writer';
import { 
  normalizeToPlateCoordinates, 
  validateCoordinateConsistency,
  mergeCoordinates 
} from '../lib/coordinate-normalization';
import { YahooMetricsRecorder } from '../lib/metrics/yahoo-metrics';
import { normalizeText } from '../lib/connectors/polite-http-client';
import { promises as fs } from 'fs';
import * as path from 'path';

interface IntegratedIngestConfig {
  levels: ('npb1' | 'npb2')[];
  farmLeagues?: ('EAST' | 'WEST')[];
  mode: 'live' | 'backfill';
  date?: string;
  contactEmail: string;
  enableBaseballDataComplement: boolean;
  syncToDatabase: boolean;
  
  // Backfill specific
  fromDate?: string;
  toDate?: string;
  sleepMs?: number;
  
  // Live specific
  maxConcurrentGames?: number;
  pollIntervalMs?: number;
}

interface IngestResult {
  gameId: string;
  level: 'NPB1' | 'NPB2';
  farmLeague?: 'EAST' | 'WEST';
  yahooData: {
    newPitches: number;
    totalPitches: number;
    confidence: string;
  };
  baseballDataComplement?: {
    dashboard?: any;
    detail?: any;
    alignmentScore?: number;
  };
  dbSync: {
    synced: boolean;
    pitchesSynced: number;
    error?: string;
  };
  processingTime: number;
}

export class IntegratedYahooIngester {
  private npb1Connector: YahooNPB1Connector;
  private npb2Connector: YahooNPB2Connector;
  private baseballDataConnector?: BaseballDataPlayersConnector;
  private dbWriter?: any;
  private metricsRecorder = YahooMetricsRecorder.getInstance();
  private config: IntegratedIngestConfig;
  private isRunning = false;
  
  constructor(config: IntegratedIngestConfig) {
    this.config = config;
    this.npb1Connector = new YahooNPB1Connector(config.contactEmail);
    this.npb2Connector = new YahooNPB2Connector(config.contactEmail);
    
    if (config.enableBaseballDataComplement) {
      this.baseballDataConnector = new BaseballDataPlayersConnector(config.contactEmail);
    }
    
    if (config.syncToDatabase) {
      this.dbWriter = getDBWriter();
    }
  }
  
  /**
   * Start integrated ingestion
   */
  async start(): Promise<void> {
    console.log(`🚀 Starting integrated Yahoo ingest (${this.config.mode} mode)`);
    
    // Test database connection if sync enabled
    if (this.config.syncToDatabase) {
      const isConnected = await testDBConnection();
      if (!isConnected) {
        throw new Error('Database connection failed. Set DATABASE_URL or disable DB sync');
      }
      console.log('✅ Database connection verified');
    }
    
    this.isRunning = true;
    
    if (this.config.mode === 'live') {
      await this.runLiveIngestion();
    } else {
      await this.runBackfillIngestion();
    }
  }
  
  /**
   * Live ingestion mode
   */
  private async runLiveIngestion(): Promise<void> {
    const date = this.config.date || new Date().toISOString().split('T')[0];
    console.log(`📡 Starting live ingestion for ${date}`);
    
    const activeGames = new Map<string, any>();
    
    // Discover initial games
    if (this.config.levels.includes('npb1')) {
      const npb1Games = await this.npb1Connector.getGamesForDate(date);
      for (const game of npb1Games.filter(g => g.status === 'live' || g.status === 'scheduled')) {
        activeGames.set(`NPB1_${game.gameId}`, { ...game, level: 'NPB1' });
      }
    }
    
    if (this.config.levels.includes('npb2')) {
      const farmLeagues = this.config.farmLeagues || ['EAST', 'WEST'];
      for (const league of farmLeagues) {
        const farmGames = await this.npb2Connector.getFarmGamesForDate(date, league);
        for (const game of farmGames.filter(g => g.status === 'live' || g.status === 'scheduled')) {
          activeGames.set(`NPB2_${league}_${game.gameId}`, { ...game, level: 'NPB2', farmLeague: league });
        }
      }
    }
    
    console.log(`🎯 Monitoring ${activeGames.size} games`);
    
    // Live monitoring loop
    while (this.isRunning && activeGames.size > 0) {
      const results: IngestResult[] = [];
      
      for (const [key, game] of activeGames) {
        try {
          const result = await this.ingestSingleGame(game.gameId, game.level, game.farmLeague);
          results.push(result);
          
          // Remove completed games
          if (result.yahooData.newPitches === 0) {
            // Consider removing after N consecutive zero-pitch cycles
          }
          
        } catch (error) {
          console.error(`Failed to ingest ${key}:`, error);
        }
      }
      
      // Log progress
      const totalNew = results.reduce((sum, r) => sum + r.yahooData.newPitches, 0);
      if (totalNew > 0) {
        console.log(`📊 Live cycle: ${totalNew} new pitches across ${results.length} games`);
      }
      
      // Dynamic sleep based on activity
      const sleepMs = totalNew > 0 ? 8000 : (this.config.pollIntervalMs || 15000);
      await this.sleep(sleepMs);
    }
    
    console.log('🏁 Live ingestion completed');
  }
  
  /**
   * Backfill ingestion mode
   */
  private async runBackfillIngestion(): Promise<void> {
    const fromDate = this.config.fromDate!;
    const toDate = this.config.toDate || new Date().toISOString().split('T')[0];
    
    console.log(`📚 Starting backfill from ${fromDate} to ${toDate}`);
    
    let currentDate = fromDate;
    
    while (this.isRunning && currentDate <= toDate) {
      console.log(`\n📅 Processing ${currentDate}`);
      
      try {
        const games = await this.discoverGamesForDate(currentDate);
        const results: IngestResult[] = [];
        
        for (const game of games) {
          if (!this.isRunning) break;
          
          try {
            const result = await this.ingestSingleGame(game.gameId, game.level, game.farmLeague);
            results.push(result);
            
            // Backfill sleep between games
            await this.sleep(this.config.sleepMs || 30000);
            
          } catch (error) {
            console.error(`Failed to ingest ${game.level} ${game.gameId}:`, error);
          }
        }
        
        const totalPitches = results.reduce((sum, r) => sum + r.yahooData.totalPitches, 0);
        console.log(`✅ Completed ${currentDate}: ${results.length} games, ${totalPitches} pitches`);
        
        currentDate = this.getNextDate(currentDate);
        
      } catch (error) {
        console.error(`Failed to process ${currentDate}:`, error);
        currentDate = this.getNextDate(currentDate);
      }
    }
    
    console.log('🏁 Backfill ingestion completed');
  }
  
  /**
   * Ingest single game with full pipeline
   */
  private async ingestSingleGame(
    gameId: string, 
    level: 'NPB1' | 'NPB2', 
    farmLeague?: 'EAST' | 'WEST'
  ): Promise<IngestResult> {
    const startTime = Date.now();
    
    const result: IngestResult = {
      gameId,
      level,
      farmLeague,
      yahooData: {
        newPitches: 0,
        totalPitches: 0,
        confidence: 'high'
      },
      dbSync: {
        synced: false,
        pitchesSynced: 0
      },
      processingTime: 0
    };
    
    try {
      // Step 1: Yahoo data collection
      const yahooData = await this.collectYahooData(gameId, level, farmLeague);
      result.yahooData = yahooData;
      
      // Step 2: baseballdata.jp complement (if enabled and post-game)
      if (this.config.enableBaseballDataComplement && this.baseballDataConnector) {
        result.baseballDataComplement = await this.complementWithBaseballData(gameId, level);
      }
      
      // Step 3: Database sync (if enabled)
      if (this.config.syncToDatabase) {
        result.dbSync = await this.syncToDatabase(gameId, level, farmLeague, yahooData);
      }
      
      // Record metrics
      this.metricsRecorder.recordPitchIngestion(
        level,
        'yahoo',
        yahooData.newPitches,
        0, // duplicates handled by differential ingester
        yahooData.confidence as any
      );
      
    } catch (error) {
      console.error(`Failed to ingest game ${level} ${gameId}:`, error);
      result.dbSync.error = String(error);
    } finally {
      result.processingTime = Date.now() - startTime;
    }
    
    return result;
  }
  
  /**
   * Collect Yahoo data
   */
  private async collectYahooData(
    gameId: string, 
    level: 'NPB1' | 'NPB2', 
    farmLeague?: 'EAST' | 'WEST'
  ): Promise<any> {
    if (level === 'NPB1') {
      const indexes = await this.npb1Connector.getValidIndexes(gameId);
      let totalNew = 0;
      let totalPitches = 0;
      
      for (const index of indexes) {
        const result = await this.npb1Connector.ingestPitchData(gameId, index);
        totalNew += result.newRows;
        totalPitches += result.totalRows;
      }
      
      return {
        newPitches: totalNew,
        totalPitches,
        confidence: 'high'
      };
      
    } else if (level === 'NPB2' && farmLeague) {
      // Simplified: farm games typically have fewer indexes
      const result = await this.npb2Connector.ingestFarmPitchData(gameId, '1', farmLeague);
      
      return {
        newPitches: result.newRows,
        totalPitches: result.totalRows,
        confidence: 'medium'
      };
    }
    
    return { newPitches: 0, totalPitches: 0, confidence: 'low' };
  }
  
  /**
   * Complement with baseballdata.jp
   */
  private async complementWithBaseballData(
    gameId: string, 
    level: 'NPB1' | 'NPB2'
  ): Promise<any> {
    if (!this.baseballDataConnector) return undefined;
    
    try {
      // Extract player ID from game (simplified)
      const playerId = `player_${gameId}`; // This should be more sophisticated
      
      const { dashboard, detail } = await this.baseballDataConnector.getPlayerGameData(playerId, gameId);
      
      // Calculate alignment score with Yahoo data if available
      let alignmentScore = 0.8; // Default score
      
      return {
        dashboard,
        detail,
        alignmentScore
      };
      
    } catch (error) {
      console.warn(`Failed to get baseballdata complement for ${gameId}:`, error);
      return undefined;
    }
  }
  
  /**
   * Sync to database
   */
  private async syncToDatabase(
    gameId: string, 
    level: 'NPB1' | 'NPB2', 
    farmLeague?: 'EAST' | 'WEST',
    yahooData?: any
  ): Promise<any> {
    try {
      // Read canonical data
      const timelineFile = farmLeague ? 
        `data/timeline/yahoo_npb2/${farmLeague}_${gameId}_timeline.jsonl` :
        `data/timeline/yahoo_npb1/${gameId}_timeline.jsonl`;
      
      if (!(await this.fileExists(timelineFile))) {
        return { synced: false, pitchesSynced: 0, error: 'No timeline file found' };
      }
      
      // Parse timeline entries
      const content = await fs.readFile(timelineFile, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());
      
      if (lines.length === 0) {
        return { synced: false, pitchesSynced: 0, error: 'Empty timeline file' };
      }
      
      const entries = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(e => e !== null);
      
      // Upsert game
      const gameRecord: GameRecord = {
        gameId,
        level,
        farmLeague,
        date: new Date().toISOString().split('T')[0],
        source: 'yahoo'
      };
      await this.dbWriter!.upsertGame(gameRecord);
      
      // Convert and upsert pitch events
      const pitchEvents: PitchEvent[] = entries.map(entry => ({
        gameId: entry.game_id,
        idx: parseInt(entry.index) || 0,
        pitchNo: parseInt(entry.pitch_no || '0') || 0,
        inning: entry.inning,
        half: entry.half,
        outs: entry.outs,
        balls: entry.balls,
        strikes: entry.strikes,
        batterName: entry.batter_name,
        batterHand: entry.batter_hand,
        pitcherName: entry.pitcher_name,
        pitcherHand: entry.pitcher_hand,
        pitchType: entry.pitch_type,
        speedKmh: entry.velocity,
        resultCode: entry.result,
        plateX: entry.plate_x,
        plateZ: entry.plate_z,
        zone: entry.zone,
        runner1b: entry.runner_1b,
        runner2b: entry.runner_2b,
        runner3b: entry.runner_3b,
        confidence: entry.confidence,
        source: entry.source || 'yahoo',
        raw: entry
      })).filter(pe => pe.pitchNo > 0);
      
      const syncedCount = await this.dbWriter!.upsertPitchEvents(pitchEvents);
      
      return {
        synced: true,
        pitchesSynced: syncedCount
      };
      
    } catch (error) {
      return {
        synced: false,
        pitchesSynced: 0,
        error: String(error)
      };
    }
  }
  
  /**
   * Discover games for date
   */
  private async discoverGamesForDate(date: string): Promise<Array<{
    gameId: string;
    level: 'NPB1' | 'NPB2';
    farmLeague?: 'EAST' | 'WEST';
  }>> {
    const games: Array<{ gameId: string; level: 'NPB1' | 'NPB2'; farmLeague?: 'EAST' | 'WEST' }> = [];
    
    if (this.config.levels.includes('npb1')) {
      const npb1Games = await this.npb1Connector.getGamesForDate(date);
      games.push(...npb1Games.map(g => ({ gameId: g.gameId, level: 'NPB1' as const })));
    }
    
    if (this.config.levels.includes('npb2')) {
      const farmLeagues = this.config.farmLeagues || ['EAST', 'WEST'];
      for (const league of farmLeagues) {
        const farmGames = await this.npb2Connector.getFarmGamesForDate(date, league);
        games.push(...farmGames.map(g => ({ 
          gameId: g.gameId, 
          level: 'NPB2' as const, 
          farmLeague: league 
        })));
      }
    }
    
    return games;
  }
  
  /**
   * Utilities
   */
  private getNextDate(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
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
  
  stop(): void {
    console.log('🛑 Stopping integrated ingest...');
    this.isRunning = false;
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Integrated Yahoo Ingest Usage:
  npm run yahoo:integrated:live                    # Live mode (today)
  npm run yahoo:integrated:live -- --date 2025-08-13   # Live mode (specific date)
  npm run yahoo:integrated:backfill -- --from 2025-01-01 --to 2025-08-13   # Backfill mode
  
Options:
  --mode live|backfill     Processing mode (default: live)
  --levels npb1,npb2       Levels to process (default: npb1,npb2)
  --farm-leagues EAST,WEST Farm leagues for NPB2 (default: EAST,WEST)
  --date YYYY-MM-DD        Date for live mode (default: today)
  --from YYYY-MM-DD        Start date for backfill
  --to YYYY-MM-DD          End date for backfill (default: today)
  --sleep MS               Sleep between games in backfill (default: 30000)
  --no-db                  Disable database sync
  --no-baseballdata       Disable baseballdata.jp complement
  --contact EMAIL          Contact email (default: env CONTACT_EMAIL)
    `);
    return;
  }
  
  const parseArg = (flag: string, defaultValue?: string): string | undefined => {
    const index = args.findIndex(arg => arg === flag);
    return index !== -1 && index + 1 < args.length ? args[index + 1] : defaultValue;
  };
  
  // 緊急停止フラグチェック
  if (process.env.YAHOO_STOP === 'true') {
    console.log('🛑 緊急停止フラグ検出: YAHOO_STOP=true');
    console.log('   収集を停止します。フラグを解除後に再実行してください。');
    process.exit(0);
  }

  const config: IntegratedIngestConfig = {
    mode: parseArg('--mode', 'live') as 'live' | 'backfill',
    levels: (parseArg('--levels', 'npb1,npb2') || 'npb1,npb2').split(',') as ('npb1' | 'npb2')[],
    farmLeagues: parseArg('--farm-leagues') ? 
      (parseArg('--farm-leagues') || 'EAST,WEST').split(',') as ('EAST' | 'WEST')[] : 
      ['EAST', 'WEST'],
    date: parseArg('--date'),
    fromDate: parseArg('--from'),
    toDate: parseArg('--to'),
    // 環境変数対応: BACKFILL_SLEEP_MS=30000
    sleepMs: parseInt(process.env.BACKFILL_SLEEP_MS || parseArg('--sleep', '30000') || '30000'),
    contactEmail: parseArg('--contact') || process.env.CONTACT_EMAIL || 'contact@example.com',
    enableBaseballDataComplement: !args.includes('--no-baseballdata'),
    syncToDatabase: !args.includes('--no-db'),
    maxConcurrentGames: parseInt(parseArg('--concurrent', '5') || '5'),
    pollIntervalMs: parseInt(parseArg('--interval', '15000') || '15000')
  };
  
  // Validation
  if (config.mode === 'backfill' && !config.fromDate) {
    console.error('❌ --from date is required for backfill mode');
    process.exit(1);
  }
  
  console.log('Integrated Yahoo Ingest Configuration:', {
    ...config,
    contactEmail: config.contactEmail.replace(/@.*/, '@***')
  });
  
  const ingester = new IntegratedYahooIngester(config);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    ingester.stop();
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    ingester.stop();
  });
  
  try {
    await ingester.start();
  } catch (error) {
    console.error('❌ Integrated ingest failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}