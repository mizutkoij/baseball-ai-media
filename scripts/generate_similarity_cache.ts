/**
 * Similarity Cache Generation Script
 * Generates pre-computed similarity vectors for fast player comparison
 */

import { DatabaseManager } from '../lib/database';
import { convertToPlayerStats, extractComparableStats, normalizeStatValue } from '../lib/playerComparison';
import * as fs from 'fs';
import * as path from 'path';

interface CachedPlayerVector {
  player_id: string;
  name: string;
  primary_pos: "P" | "B";
  is_active: boolean;
  last_year?: number;
  vector: number[];
  stats: Record<string, number>;
  vector_updated: string;
}

interface SimilarityCache {
  metadata: {
    generated_at: string;
    total_players: number;
    batters: number;
    pitchers: number;
  };
  vectors: CachedPlayerVector[];
}

class SimilarityCacheGenerator {
  private db: DatabaseManager;
  private cacheDir: string;

  constructor() {
    this.db = new DatabaseManager();
    this.cacheDir = path.join(process.cwd(), 'data', 'cache');
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async generateCache(): Promise<void> {
    console.log('Starting similarity cache generation...');
    
    try {
      // Get all players with sufficient data
      const playersQuery = `
        SELECT 
          p.player_id,
          p.name,
          p.primary_pos,
          p.first_year,
          p.last_year,
          p.is_active,
          cs.安打, cs.本塁打, cs.打点, cs.打率, cs.出塁率, cs.長打率, cs.OPS,
          cs.OPS_plus_simple, cs.wRC_plus_simple, cs.四球率, cs.三振率, cs.ISO, cs.BABIP,
          cs.試合 as batting_games, cs.打席, cs.打数,
          ps.登板, ps.先発, ps.IP_float, ps.勝利, ps.敗北, ps.防御率,
          ps.WHIP, ps.FIP, ps.ERA_minus, ps.K_9, ps.BB_9, ps.HR_9,
          ps.K_pct, ps.BB_pct, ps.LOB_pct, ps.GB_pct, ps.奪三振 as pitching_games
        FROM players p
        LEFT JOIN career_stats cs ON p.player_id = cs.player_id
        LEFT JOIN pitching_stats ps ON p.player_id = ps.player_id
        WHERE (
          (p.primary_pos = 'B' AND cs.打席 >= 200) OR
          (p.primary_pos = 'P' AND ps.IP_float >= 50)
        )
        ORDER BY p.last_year DESC, p.name
      `;

      const players = await this.db.query(playersQuery);
      console.log(`Found ${players.length} players with sufficient data`);

      // Convert to PlayerStats and generate vectors
      const cachedVectors: CachedPlayerVector[] = [];
      let batters = 0;
      let pitchers = 0;

      for (const rawPlayer of players) {
        try {
          const playerStats = this.convertRawToPlayerStats(rawPlayer);
          const { stats, vector } = this.extractComparableStats(playerStats);
          
          if (vector.length > 0) {
            cachedVectors.push({
              player_id: playerStats.player_id,
              name: playerStats.name,
              primary_pos: playerStats.primary_pos,
              is_active: rawPlayer.is_active,
              last_year: rawPlayer.last_year,
              vector,
              stats,
              vector_updated: new Date().toISOString()
            });

            if (playerStats.primary_pos === 'B') batters++;
            else pitchers++;
          }
        } catch (error) {
          console.warn(`Failed to process player ${rawPlayer.player_id}:`, error);
        }
      }

      // Create cache object
      const cache: SimilarityCache = {
        metadata: {
          generated_at: new Date().toISOString(),
          total_players: cachedVectors.length,
          batters,
          pitchers
        },
        vectors: cachedVectors
      };

      // Write cache files
      await this.writeCacheFiles(cache);
      
      console.log(`✅ Cache generation completed:`);
      console.log(`   Total players: ${cache.metadata.total_players}`);
      console.log(`   Batters: ${cache.metadata.batters}`);
      console.log(`   Pitchers: ${cache.metadata.pitchers}`);
      console.log(`   Cache files written to: ${this.cacheDir}`);

    } catch (error) {
      console.error('Cache generation failed:', error);
      throw error;
    }
  }

  private convertRawToPlayerStats(raw: any): any {
    const player = {
      player_id: raw.player_id,
      name: raw.name,
      primary_pos: raw.primary_pos
    };

    if (raw.primary_pos === "B" && raw.打席) {
      (player as any).batting = {
        games: raw.batting_games,
        pa: raw.打席,
        ab: raw.打数,
        h: raw.安打,
        hr: raw.本塁打,
        rbi: raw.打点,
        avg: raw.打率,
        obp: raw.出塁率,
        slg: raw.長打率,
        ops: raw.OPS,
        ops_plus: raw.OPS_plus_simple,
        wrc_plus: raw.wRC_plus_simple,
        bb_pct: raw.四球率,
        k_pct: raw.三振率,
        iso: raw.ISO,
        babip: raw.BABIP,
      };
    }

    if (raw.primary_pos === "P" && raw.IP_float) {
      (player as any).pitching = {
        games: raw.pitching_games,
        gs: raw.先発,
        ip: raw.IP_float,
        w: raw.勝利,
        l: raw.敗北,
        era: raw.防御率,
        whip: raw.WHIP,
        fip: raw.FIP,
        era_minus: raw.ERA_minus,
        k9: raw.K_9,
        bb9: raw.BB_9,
        hr9: raw.HR_9,
        k_pct: raw.K_pct,
        bb_pct: raw.BB_pct,
        k_minus_bb_pct: raw.K_pct && raw.BB_pct ? raw.K_pct - raw.BB_pct : undefined,
        lob_pct: raw.LOB_pct,
        gb_pct: raw.GB_pct,
      };
    }

    return player;
  }

  private extractComparableStats(player: any): { stats: Record<string, number>, vector: number[] } {
    const stats: Record<string, number> = {};
    
    if (player.primary_pos === "B" && player.batting) {
      const batting = player.batting;
      if (batting.avg !== undefined) stats.avg = batting.avg;
      if (batting.obp !== undefined) stats.obp = batting.obp;
      if (batting.slg !== undefined) stats.slg = batting.slg;
      if (batting.ops !== undefined) stats.ops = batting.ops;
      if (batting.ops_plus !== undefined) stats.ops_plus = batting.ops_plus;
      if (batting.wrc_plus !== undefined) stats.wrc_plus = batting.wrc_plus;
      if (batting.iso !== undefined) stats.iso = batting.iso;
      if (batting.bb_pct !== undefined) stats.bb_pct = batting.bb_pct;
      if (batting.k_pct !== undefined) stats.k_pct = batting.k_pct;
      if (batting.hr !== undefined) stats.hr = batting.hr;
      if (batting.rbi !== undefined) stats.rbi = batting.rbi;
    } else if (player.primary_pos === "P" && player.pitching) {
      const pitching = player.pitching;
      if (pitching.era !== undefined) stats.era = pitching.era;
      if (pitching.whip !== undefined) stats.whip = pitching.whip;
      if (pitching.fip !== undefined) stats.fip = pitching.fip;
      if (pitching.era_minus !== undefined) stats.era_minus = pitching.era_minus;
      if (pitching.k9 !== undefined) stats.k9 = pitching.k9;
      if (pitching.bb9 !== undefined) stats.bb9 = pitching.bb9;
      if (pitching.k_pct !== undefined) stats.k_pct = pitching.k_pct;
      if (pitching.bb_pct !== undefined) stats.bb_pct = pitching.bb_pct;
      if (pitching.k_minus_bb_pct !== undefined) stats.k_minus_bb_pct = pitching.k_minus_bb_pct;
      if (pitching.w !== undefined) stats.w = pitching.w;
      if (pitching.ip !== undefined) stats.ip = pitching.ip;
    }
    
    // Convert to normalized vector
    const statNames = Object.keys(stats).sort(); // consistent ordering
    const vector = statNames.map(stat => this.normalizeStatValue(stat, stats[stat]));
    
    return { stats, vector };
  }

  private normalizeStatValue(stat: string, value: number): number {
    const ranges: Record<string, { min: number; max: number; inverted?: boolean }> = {
      'avg': { min: 0.200, max: 0.400 },
      'obp': { min: 0.250, max: 0.450 },
      'slg': { min: 0.300, max: 0.700 },
      'ops': { min: 0.600, max: 1.100 },
      'ops_plus': { min: 50, max: 200 },
      'wrc_plus': { min: 50, max: 200 },
      'iso': { min: 0.050, max: 0.350 },
      'babip': { min: 0.250, max: 0.400 },
      'hr': { min: 0, max: 60 },
      'rbi': { min: 0, max: 150 },
      'k_pct': { min: 5, max: 35, inverted: true },
      'bb_pct': { min: 2, max: 20 },
      'era': { min: 1.50, max: 6.00, inverted: true },
      'whip': { min: 0.80, max: 1.80, inverted: true },
      'fip': { min: 2.00, max: 6.00, inverted: true },
      'era_minus': { min: 40, max: 150, inverted: true },
      'k9': { min: 3, max: 15 },
      'bb9': { min: 1, max: 6, inverted: true },
      'hr9': { min: 0.3, max: 2.0, inverted: true },
      'k_minus_bb_pct': { min: -5, max: 30 },
      'lob_pct': { min: 65, max: 85 },
      'gb_pct': { min: 30, max: 65 },
      'games': { min: 10, max: 160 },
      'pa': { min: 50, max: 700 },
      'ip': { min: 10, max: 250 },
      'w': { min: 0, max: 25 },
    };

    const range = ranges[stat];
    if (!range) return 0;
    
    const clampedValue = Math.max(range.min, Math.min(range.max, value));
    let normalized = (clampedValue - range.min) / (range.max - range.min);
    
    if (range.inverted) {
      normalized = 1 - normalized;
    }
    
    return normalized;
  }

  private async writeCacheFiles(cache: SimilarityCache): Promise<void> {
    // Write full cache
    const fullCachePath = path.join(this.cacheDir, 'similarity_vectors.json');
    await fs.promises.writeFile(fullCachePath, JSON.stringify(cache, null, 2));
    
    // Write separate files for batters and pitchers for faster loading
    const batters = cache.vectors.filter(v => v.primary_pos === 'B');
    const pitchers = cache.vectors.filter(v => v.primary_pos === 'P');
    
    const batterCachePath = path.join(this.cacheDir, 'similarity_vectors_batters.json');
    const pitcherCachePath = path.join(this.cacheDir, 'similarity_vectors_pitchers.json');
    
    await fs.promises.writeFile(batterCachePath, JSON.stringify({
      metadata: { ...cache.metadata, total_players: batters.length },
      vectors: batters
    }, null, 2));
    
    await fs.promises.writeFile(pitcherCachePath, JSON.stringify({
      metadata: { ...cache.metadata, total_players: pitchers.length },
      vectors: pitchers
    }, null, 2));
    
    // Write metadata only file for quick info
    const metadataPath = path.join(this.cacheDir, 'similarity_cache_metadata.json');
    await fs.promises.writeFile(metadataPath, JSON.stringify(cache.metadata, null, 2));
  }
}

// Main execution
async function main() {
  const generator = new SimilarityCacheGenerator();
  
  try {
    await generator.generateCache();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}