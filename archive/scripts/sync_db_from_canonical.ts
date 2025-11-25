#!/usr/bin/env npx tsx
/**
 * Canonical JSON to Database Sync
 * Monitors data/timeline/ and syncs to PostgreSQL automatically
 */

import { 
  getDBWriter, 
  GameRecord, 
  PitchEvent, 
  PlateAppearance,
  testDBConnection 
} from '../lib/db-writer';
import { normalizeText } from '../lib/connectors/polite-http-client';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';

interface CanonicalTimelineEntry {
  game_id: string;
  index: string;
  timestamp: string;
  confidence: 'high' | 'medium' | 'low';
  row_hash: string;
  
  // Core pitch data
  pitch_no?: string;
  batter_name?: string;
  batter_hand?: string;
  pitcher_name?: string;
  pitcher_hand?: string;
  pitch_type?: string;
  velocity?: number;
  result?: string;
  
  // Position data
  plate_x?: number;
  plate_z?: number;
  zone?: string;
  
  // Game state
  inning?: number;
  half?: 'top' | 'bottom';
  outs?: number;
  balls?: number;
  strikes?: number;
  runner_1b?: boolean;
  runner_2b?: boolean;
  runner_3b?: boolean;
  
  // Source metadata
  level?: 'NPB1' | 'NPB2';
  farm_league?: 'EAST' | 'WEST';
  source?: string;
}

interface CanonicalLatestFile {
  gameId: string;
  index: string;
  timestamp: string;
  confidence: 'high' | 'medium' | 'low';
  rows: CanonicalTimelineEntry[];
}

interface SyncStats {
  processedFiles: number;
  syncedGames: number;
  syncedPitches: number;
  syncedPlateAppearances: number;
  errors: number;
  lastSync: string;
}

export class CanonicalDBSyncer {
  private dbWriter = getDBWriter();
  private isRunning = false;
  private syncStats: SyncStats = {
    processedFiles: 0,
    syncedGames: 0,
    syncedPitches: 0,
    syncedPlateAppearances: 0,
    errors: 0,
    lastSync: new Date().toISOString()
  };
  
  private canonicalDirs = [
    'data/timeline/yahoo_npb1',
    'data/timeline/yahoo_npb2'
  ];
  
  /**
   * Start real-time sync monitoring
   */
  async startRealtimeSync(): Promise<void> {
    console.log('🔄 Starting real-time canonical→DB sync...');
    
    // Test DB connection first
    const isConnected = await testDBConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    
    this.isRunning = true;
    
    // Initial sync of existing files
    await this.syncExistingFiles();
    
    // Setup file watchers for real-time sync
    this.setupFileWatchers();
    
    console.log('✅ Real-time sync started');
  }
  
  /**
   * One-time sync of all existing files
   */
  async syncExistingFiles(): Promise<void> {
    console.log('📁 Syncing existing canonical files...');
    
    for (const dir of this.canonicalDirs) {
      try {
        if (await this.dirExists(dir)) {
          await this.syncDirectory(dir);
        }
      } catch (error) {
        console.error(`Failed to sync directory ${dir}:`, error);
        this.syncStats.errors++;
      }
    }
    
    console.log(`✅ Existing files sync complete: ${this.syncStats.syncedGames} games, ${this.syncStats.syncedPitches} pitches`);
  }
  
  /**
   * Sync a directory of canonical files
   */
  private async syncDirectory(dir: string): Promise<void> {
    const files = await fs.readdir(dir);
    
    // Process timeline files
    const timelineFiles = files.filter(f => f.endsWith('_timeline.jsonl'));
    for (const file of timelineFiles) {
      const filePath = path.join(dir, file);
      await this.syncTimelineFile(filePath);
    }
    
    // Process latest files
    const latestFiles = files.filter(f => f.endsWith('_latest.json'));
    for (const file of latestFiles) {
      const filePath = path.join(dir, file);
      await this.syncLatestFile(filePath);
    }
  }
  
  /**
   * Setup file system watchers
   */
  private setupFileWatchers(): void {
    const watcher = chokidar.watch(this.canonicalDirs, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });
    
    watcher.on('change', async (filePath) => {
      if (!this.isRunning) return;
      
      try {
        console.log(`📝 File changed: ${filePath}`);
        
        if (filePath.endsWith('_timeline.jsonl')) {
          await this.syncTimelineFile(filePath);
        } else if (filePath.endsWith('_latest.json')) {
          await this.syncLatestFile(filePath);
        }
        
      } catch (error) {
        console.error(`Failed to sync changed file ${filePath}:`, error);
        this.syncStats.errors++;
      }
    });
    
    watcher.on('add', async (filePath) => {
      if (!this.isRunning) return;
      
      try {
        console.log(`📄 New file: ${filePath}`);
        
        if (filePath.endsWith('_timeline.jsonl')) {
          await this.syncTimelineFile(filePath);
        } else if (filePath.endsWith('_latest.json')) {
          await this.syncLatestFile(filePath);
        }
        
      } catch (error) {
        console.error(`Failed to sync new file ${filePath}:`, error);
        this.syncStats.errors++;
      }
    });
    
    console.log(`👀 Watching ${this.canonicalDirs.length} directories for changes`);
  }
  
  /**
   * Sync a timeline JSONL file
   */
  private async syncTimelineFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return;
      
      const entries: CanonicalTimelineEntry[] = [];
      const gameIds = new Set<string>();
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as CanonicalTimelineEntry;
          entries.push(entry);
          gameIds.add(entry.game_id);
        } catch (error) {
          console.warn(`Invalid JSON line in ${filePath}:`, line.substring(0, 100));
        }
      }
      
      if (entries.length === 0) return;
      
      // Sync games first
      for (const gameId of gameIds) {
        await this.upsertGameFromEntries(gameId, entries.filter(e => e.game_id === gameId), filePath);
      }
      
      // Sync pitch events
      const pitchEvents = this.convertToPitchEvents(entries);
      if (pitchEvents.length > 0) {
        const syncedCount = await this.dbWriter.upsertPitchEvents(pitchEvents);
        this.syncStats.syncedPitches += syncedCount;
      }
      
      // Sync plate appearances
      const plateAppearances = this.aggregatePlateAppearances(entries);
      for (const pa of plateAppearances) {
        await this.dbWriter.upsertPlateAppearance(pa);
        this.syncStats.syncedPlateAppearances++;
      }
      
      this.syncStats.processedFiles++;
      this.syncStats.lastSync = new Date().toISOString();
      
      console.log(`✅ Synced timeline: ${path.basename(filePath)} (${pitchEvents.length} pitches, ${plateAppearances.length} PAs)`);
      
    } catch (error) {
      console.error(`Failed to sync timeline file ${filePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Sync a latest JSON file
   */
  private async syncLatestFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const latest = JSON.parse(content) as CanonicalLatestFile;
      
      if (!latest.rows || latest.rows.length === 0) return;
      
      // Update game info from latest data
      await this.upsertGameFromEntries(latest.gameId, latest.rows, filePath);
      
      console.log(`✅ Synced latest: ${path.basename(filePath)} (${latest.rows.length} rows)`);
      
    } catch (error) {
      console.error(`Failed to sync latest file ${filePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Create/update game record from entries
   */
  private async upsertGameFromEntries(
    gameId: string, 
    entries: CanonicalTimelineEntry[], 
    filePath: string
  ): Promise<void> {
    if (entries.length === 0) return;
    
    const firstEntry = entries[0];
    const level = this.extractLevelFromPath(filePath) || firstEntry.level || 'NPB1';
    
    const game: GameRecord = {
      gameId,
      level,
      farmLeague: firstEntry.farm_league,
      date: firstEntry.timestamp ? firstEntry.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
      source: firstEntry.source || 'yahoo'
    };
    
    await this.dbWriter.upsertGame(game);
    this.syncStats.syncedGames++;
  }
  
  /**
   * Convert canonical entries to pitch events
   */
  private convertToPitchEvents(entries: CanonicalTimelineEntry[]): PitchEvent[] {
    return entries.map(entry => {
      const pitchEvent: PitchEvent = {
        gameId: entry.game_id,
        idx: parseInt(entry.index) || 0,
        pitchNo: parseInt(entry.pitch_no || '0') || 0,
        
        // Game state
        inning: entry.inning,
        half: entry.half,
        outs: entry.outs,
        balls: entry.balls,
        strikes: entry.strikes,
        
        // Players
        batterName: entry.batter_name ? normalizeText(entry.batter_name) : undefined,
        batterHand: entry.batter_hand,
        pitcherName: entry.pitcher_name ? normalizeText(entry.pitcher_name) : undefined,
        pitcherHand: entry.pitcher_hand,
        
        // Pitch details
        pitchType: entry.pitch_type,
        speedKmh: entry.velocity,
        resultCode: entry.result,
        
        // Coordinates
        plateX: entry.plate_x,
        plateZ: entry.plate_z,
        zone: entry.zone,
        
        // Runners
        runner1b: entry.runner_1b,
        runner2b: entry.runner_2b,
        runner3b: entry.runner_3b,
        
        // Metadata
        confidence: entry.confidence,
        source: entry.source || 'yahoo',
        raw: entry
      };
      
      return pitchEvent;
    }).filter(pe => pe.pitchNo > 0); // Only valid pitch events
  }
  
  /**
   * Aggregate plate appearances from pitch events
   */
  private aggregatePlateAppearances(entries: CanonicalTimelineEntry[]): PlateAppearance[] {
    const paMap = new Map<string, CanonicalTimelineEntry[]>();
    
    // Group by game_id:index
    for (const entry of entries) {
      const key = `${entry.game_id}:${entry.index}`;
      if (!paMap.has(key)) {
        paMap.set(key, []);
      }
      paMap.get(key)!.push(entry);
    }
    
    const plateAppearances: PlateAppearance[] = [];
    
    for (const [key, pitches] of paMap) {
      if (pitches.length === 0) continue;
      
      const firstPitch = pitches[0];
      const lastPitch = pitches[pitches.length - 1];
      
      const pa: PlateAppearance = {
        gameId: firstPitch.game_id,
        idx: parseInt(firstPitch.index) || 0,
        inning: firstPitch.inning,
        half: firstPitch.half,
        outsStart: firstPitch.outs,
        batterName: firstPitch.batter_name ? normalizeText(firstPitch.batter_name) : undefined,
        pitcherName: firstPitch.pitcher_name ? normalizeText(firstPitch.pitcher_name) : undefined,
        paResult: lastPitch.result,
        pitchCount: pitches.length,
        finalCount: lastPitch.balls !== undefined && lastPitch.strikes !== undefined ? 
          `${lastPitch.balls}-${lastPitch.strikes}` : undefined,
        totalPitches: pitches.length,
        strikesThrown: pitches.filter(p => p.result?.includes('ストライク') || p.result?.includes('空振り')).length,
        ballsThrown: pitches.filter(p => p.result?.includes('ボール')).length,
        foulsHit: pitches.filter(p => p.result?.includes('ファウル')).length,
        source: firstPitch.source || 'yahoo'
      };
      
      plateAppearances.push(pa);
    }
    
    return plateAppearances;
  }
  
  /**
   * Extract level from file path
   */
  private extractLevelFromPath(filePath: string): 'NPB1' | 'NPB2' | undefined {
    if (filePath.includes('yahoo_npb1')) return 'NPB1';
    if (filePath.includes('yahoo_npb2')) return 'NPB2';
    return undefined;
  }
  
  /**
   * Check if directory exists
   */
  private async dirExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
  
  /**
   * Stop sync monitoring
   */
  stop(): void {
    console.log('🛑 Stopping canonical→DB sync...');
    this.isRunning = false;
  }
  
  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    return { ...this.syncStats };
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Canonical DB Sync Usage:
  npm run db:sync                    # Real-time monitoring
  npm run db:sync -- --once          # One-time sync
  npm run db:sync -- --stats         # Show statistics
  
Environment Variables:
  DATABASE_URL=postgres://...         # Required
  PGURL=postgres://...              # Alternative to DATABASE_URL
    `);
    return;
  }
  
  const syncer = new CanonicalDBSyncer();
  
  if (args.includes('--stats')) {
    const stats = syncer.getStats();
    console.log('📊 Sync Statistics:', JSON.stringify(stats, null, 2));
    return;
  }
  
  if (args.includes('--once')) {
    console.log('🔄 One-time sync starting...');
    try {
      await syncer.syncExistingFiles();
      console.log('✅ One-time sync completed');
    } catch (error) {
      console.error('❌ One-time sync failed:', error);
      process.exit(1);
    }
    return;
  }
  
  // Real-time monitoring mode
  console.log('🚀 Starting real-time canonical→DB sync');
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    syncer.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    syncer.stop();
    process.exit(0);
  });
  
  try {
    await syncer.startRealtimeSync();
    
    // Keep process alive
    setInterval(() => {
      const stats = syncer.getStats();
      if (stats.processedFiles > 0) {
        console.log(`📊 Stats: ${stats.syncedGames} games, ${stats.syncedPitches} pitches, ${stats.errors} errors`);
      }
    }, 60000); // Log stats every minute
    
  } catch (error) {
    console.error('❌ Real-time sync failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}