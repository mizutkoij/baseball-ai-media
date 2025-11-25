/**
 * Fast Similarity Cache Utilities
 * Uses pre-computed vectors for rapid player similarity calculations
 */

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
    batters?: number;
    pitchers?: number;
  };
  vectors: CachedPlayerVector[];
}

interface SimilarPlayerResult {
  player_id: string;
  name: string;
  primary_pos: "P" | "B";
  is_active: boolean;
  last_year?: number;
  similarity: number;
}

class SimilarityCacheManager {
  private cacheDir: string;
  private batterCache: SimilarityCache | null = null;
  private pitcherCache: SimilarityCache | null = null;
  private lastCacheLoad: number = 0;
  private cacheExpiryMs: number = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.cacheDir = path.join(process.cwd(), 'data', 'cache');
  }

  /**
   * Load cache files if needed
   */
  private async ensureCacheLoaded(): Promise<void> {
    const now = Date.now();
    
    // Check if cache needs refresh
    if (this.batterCache && this.pitcherCache && 
        (now - this.lastCacheLoad) < this.cacheExpiryMs) {
      return;
    }

    try {
      const batterCachePath = path.join(this.cacheDir, 'similarity_vectors_batters.json');
      const pitcherCachePath = path.join(this.cacheDir, 'similarity_vectors_pitchers.json');

      // Load both caches in parallel
      const [batterData, pitcherData] = await Promise.all([
        fs.promises.readFile(batterCachePath, 'utf-8').then(data => JSON.parse(data)),
        fs.promises.readFile(pitcherCachePath, 'utf-8').then(data => JSON.parse(data))
      ]);

      this.batterCache = batterData;
      this.pitcherCache = pitcherData;
      this.lastCacheLoad = now;

      console.log(`Cache loaded: ${this.batterCache?.metadata?.total_players || 0} batters, ${this.pitcherCache?.metadata?.total_players || 0} pitchers`);
    } catch (error) {
      console.error('Failed to load similarity cache:', error);
      throw new Error('Similarity cache not available. Run generate_similarity_cache.ts first.');
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Find similar players using cached vectors
   */
  async findSimilarPlayers(
    targetPlayerId: string, 
    limit: number = 10,
    options: {
      minSimilarity?: number;
      activeOnly?: boolean;
      sameEra?: boolean; // Within 10 years
    } = {}
  ): Promise<SimilarPlayerResult[]> {
    await this.ensureCacheLoaded();
    
    // Find target player in cache
    const allVectors = [
      ...(this.batterCache?.vectors || []),
      ...(this.pitcherCache?.vectors || [])
    ];
    
    const targetPlayer = allVectors.find(p => p.player_id === targetPlayerId);
    if (!targetPlayer) {
      throw new Error(`Player ${targetPlayerId} not found in similarity cache`);
    }

    // Get candidates from same position type
    const candidates = targetPlayer.primary_pos === 'B' 
      ? (this.batterCache?.vectors || [])
      : (this.pitcherCache?.vectors || []);

    // Filter and calculate similarities
    const results: SimilarPlayerResult[] = [];
    
    for (const candidate of candidates) {
      // Skip self
      if (candidate.player_id === targetPlayerId) continue;
      
      // Apply filters
      if (options.activeOnly && !candidate.is_active) continue;
      
      if (options.sameEra && candidate.last_year && targetPlayer.last_year) {
        const yearDiff = Math.abs(candidate.last_year - targetPlayer.last_year);
        if (yearDiff > 10) continue;
      }
      
      // Calculate similarity
      const similarity = this.cosineSimilarity(targetPlayer.vector, candidate.vector);
      
      // Apply minimum similarity filter
      if (options.minSimilarity && similarity < options.minSimilarity) continue;
      
      results.push({
        player_id: candidate.player_id,
        name: candidate.name,
        primary_pos: candidate.primary_pos,
        is_active: candidate.is_active,
        last_year: candidate.last_year,
        similarity
      });
    }

    // Sort by similarity and limit
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Get cache metadata
   */
  async getCacheMetadata(): Promise<{
    batters: any;
    pitchers: any;
    isStale: boolean;
  }> {
    await this.ensureCacheLoaded();
    
    const cacheAge = Date.now() - this.lastCacheLoad;
    const isStale = cacheAge > (24 * 60 * 60 * 1000); // 24 hours
    
    return {
      batters: this.batterCache?.metadata,
      pitchers: this.pitcherCache?.metadata,
      isStale
    };
  }

  /**
   * Batch find similar players for multiple targets
   */
  async batchFindSimilarPlayers(
    targetPlayerIds: string[],
    limit: number = 5
  ): Promise<Record<string, SimilarPlayerResult[]>> {
    await this.ensureCacheLoaded();
    
    const results: Record<string, SimilarPlayerResult[]> = {};
    
    // Process in parallel for better performance
    await Promise.all(
      targetPlayerIds.map(async (playerId) => {
        try {
          results[playerId] = await this.findSimilarPlayers(playerId, limit);
        } catch (error) {
          console.error(`Failed to find similar players for ${playerId}:`, error);
          results[playerId] = [];
        }
      })
    );
    
    return results;
  }

  /**
   * Find players similar to a custom stat profile
   */
  async findSimilarByStats(
    targetStats: Record<string, number>,
    primaryPos: "P" | "B",
    limit: number = 10
  ): Promise<SimilarPlayerResult[]> {
    await this.ensureCacheLoaded();
    
    // Create normalized vector from target stats
    const statNames = Object.keys(targetStats).sort();
    const targetVector = statNames.map(stat => this.normalizeStatValue(stat, targetStats[stat]));
    
    // Get candidates from appropriate cache
    const candidates = primaryPos === 'B' 
      ? (this.batterCache?.vectors || [])
      : (this.pitcherCache?.vectors || []);

    const results: SimilarPlayerResult[] = [];
    
    for (const candidate of candidates) {
      // Create comparable vector with same stats
      const candidateVector = statNames.map(stat => {
        const value = candidate.stats[stat];
        return value !== undefined ? this.normalizeStatValue(stat, value) : 0;
      });
      
      const similarity = this.cosineSimilarity(targetVector, candidateVector);
      
      results.push({
        player_id: candidate.player_id,
        name: candidate.name,
        primary_pos: candidate.primary_pos,
        is_active: candidate.is_active,
        last_year: candidate.last_year,
        similarity
      });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
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
}

// Export singleton instance
export const similarityCacheManager = new SimilarityCacheManager();
export type { SimilarPlayerResult, CachedPlayerVector };