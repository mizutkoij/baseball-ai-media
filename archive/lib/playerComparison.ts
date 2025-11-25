/**
 * Player Comparison Utility
 * Implements cosine similarity for player statistical comparison
 */

export interface PlayerStats {
  player_id: string;
  name: string;
  primary_pos: "P" | "B";
  
  // Batting stats (for position players and pitchers who bat)
  batting?: {
    games?: number;
    pa?: number;
    ab?: number;
    h?: number;
    hr?: number;
    rbi?: number;
    avg?: number;
    obp?: number;
    slg?: number;
    ops?: number;
    ops_plus?: number;
    wrc_plus?: number;
    bb_pct?: number;
    k_pct?: number;
    iso?: number;
    babip?: number;
  };
  
  // Pitching stats (for pitchers)
  pitching?: {
    games?: number;
    gs?: number;
    ip?: number;
    w?: number;
    l?: number;
    era?: number;
    whip?: number;
    fip?: number;
    era_minus?: number;
    k9?: number;
    bb9?: number;
    hr9?: number;
    k_pct?: number;
    bb_pct?: number;
    k_minus_bb_pct?: number;
    lob_pct?: number;
    gb_pct?: number;
  };
}

export interface ComparisonResult {
  player1: PlayerStats;
  player2: PlayerStats;
  similarity: number;
  commonStats: string[];
  differences: {
    stat: string;
    player1Value: number;
    player2Value: number;
    difference: number;
    percentDiff: number;
  }[];
  radarData: {
    categories: string[];
    player1Values: number[];
    player2Values: number[];
  };
}

/**
 * Normalize a stat value to 0-1 scale for comparison
 * Uses historical NPB ranges for normalization
 */
function normalizeStatValue(stat: string, value: number): number {
  const ranges: Record<string, { min: number; max: number; inverted?: boolean }> = {
    // Batting stats (higher is better)
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
    
    // Batting percentage stats (lower K%, higher BB% is better)
    'k_pct': { min: 5, max: 35, inverted: true },
    'bb_pct': { min: 2, max: 20 },
    
    // Pitching stats 
    'era': { min: 1.50, max: 6.00, inverted: true }, // lower is better
    'whip': { min: 0.80, max: 1.80, inverted: true },
    'fip': { min: 2.00, max: 6.00, inverted: true },
    'era_minus': { min: 40, max: 150, inverted: true }, // lower is better
    'k9': { min: 3, max: 15 },
    'bb9': { min: 1, max: 6, inverted: true },
    'hr9': { min: 0.3, max: 2.0, inverted: true },
    'k_minus_bb_pct': { min: -5, max: 30 },
    'lob_pct': { min: 65, max: 85 },
    'gb_pct': { min: 30, max: 65 },
    
    // Counting stats (normalized by percentile)
    'games': { min: 10, max: 160 },
    'pa': { min: 50, max: 700 },
    'ip': { min: 10, max: 250 },
    'w': { min: 0, max: 25 },
  };

  const range = ranges[stat];
  if (!range) return 0; // unknown stat
  
  // Clamp value to range
  const clampedValue = Math.max(range.min, Math.min(range.max, value));
  
  // Normalize to 0-1
  let normalized = (clampedValue - range.min) / (range.max - range.min);
  
  // Invert if needed (for stats where lower is better)
  if (range.inverted) {
    normalized = 1 - normalized;
  }
  
  return normalized;
}

/**
 * Calculate cosine similarity between two stat vectors
 */
function cosineSimilarity(vector1: number[], vector2: number[]): number {
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
 * Extract comparable stats from player data
 */
function extractComparableStats(player: PlayerStats): { stats: Record<string, number>, vector: number[] } {
  const stats: Record<string, number> = {};
  
  if (player.primary_pos === "B" && player.batting) {
    // Position player batting stats
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
    // Pitcher stats
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
  const vector = statNames.map(stat => normalizeStatValue(stat, stats[stat]));
  
  return { stats, vector };
}

/**
 * Get radar chart categories based on player type
 */
function getRadarCategories(playerType: "B" | "P"): string[] {
  if (playerType === "B") {
    return ["打率", "出塁率", "長打率", "OPS+", "wRC+", "BB%"];
  } else {
    return ["防御率", "WHIP", "FIP", "ERA-", "K%", "K-BB%"];
  }
}

/**
 * Get radar values for a player
 */
function getRadarValues(player: PlayerStats, categories: string[]): number[] {
  const statMapping: Record<string, string> = {
    "打率": "avg", "出塁率": "obp", "長打率": "slg", "OPS+": "ops_plus", "wRC+": "wrc_plus", "BB%": "bb_pct",
    "防御率": "era", "WHIP": "whip", "FIP": "fip", "ERA-": "era_minus", "K%": "k_pct", "K-BB%": "k_minus_bb_pct"
  };
  
  const { stats } = extractComparableStats(player);
  
  return categories.map(category => {
    const statKey = statMapping[category];
    if (!statKey || stats[statKey] === undefined) return 0;
    
    return normalizeStatValue(statKey, stats[statKey]) * 100; // Convert to 0-100 scale for display
  });
}

/**
 * Compare two players and return similarity score with detailed analysis
 */
export function comparePlayersSimilarity(player1: PlayerStats, player2: PlayerStats): ComparisonResult {
  // Only compare players of the same type
  if (player1.primary_pos !== player2.primary_pos) {
    return {
      player1,
      player2,
      similarity: 0,
      commonStats: [],
      differences: [],
      radarData: {
        categories: [],
        player1Values: [],
        player2Values: []
      }
    };
  }
  
  const player1Data = extractComparableStats(player1);
  const player2Data = extractComparableStats(player2);
  
  // Find common stats
  const commonStats = Object.keys(player1Data.stats).filter(
    stat => stat in player2Data.stats
  );
  
  if (commonStats.length === 0) {
    return {
      player1,
      player2,
      similarity: 0,
      commonStats: [],
      differences: [],
      radarData: {
        categories: [],
        player1Values: [],
        player2Values: []
      }
    };
  }
  
  // Create vectors with only common stats
  const vector1 = commonStats.map(stat => normalizeStatValue(stat, player1Data.stats[stat]));
  const vector2 = commonStats.map(stat => normalizeStatValue(stat, player2Data.stats[stat]));
  
  // Calculate similarity
  const similarity = cosineSimilarity(vector1, vector2);
  
  // Calculate differences
  const differences = commonStats.map(stat => {
    const val1 = player1Data.stats[stat];
    const val2 = player2Data.stats[stat];
    const diff = val1 - val2;
    const percentDiff = val2 !== 0 ? (diff / val2) * 100 : 0;
    
    return {
      stat,
      player1Value: val1,
      player2Value: val2,
      difference: diff,
      percentDiff
    };
  }).sort((a, b) => Math.abs(b.percentDiff) - Math.abs(a.percentDiff)); // Sort by largest percentage difference
  
  // Radar chart data
  const categories = getRadarCategories(player1.primary_pos);
  const player1Values = getRadarValues(player1, categories);
  const player2Values = getRadarValues(player2, categories);
  
  return {
    player1,
    player2,
    similarity: Math.round(similarity * 100) / 100, // Round to 2 decimal places
    commonStats,
    differences,
    radarData: {
      categories,
      player1Values,
      player2Values
    }
  };
}

/**
 * Find similar players to a given player from a database
 */
export function findSimilarPlayers(
  targetPlayer: PlayerStats, 
  allPlayers: PlayerStats[], 
  limit: number = 10
): Array<{ player: PlayerStats; similarity: number }> {
  const results = allPlayers
    .filter(p => p.player_id !== targetPlayer.player_id && p.primary_pos === targetPlayer.primary_pos)
    .map(player => ({
      player,
      similarity: comparePlayersSimilarity(targetPlayer, player).similarity
    }))
    .filter(result => result.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  return results;
}

/**
 * Convert raw player data to PlayerStats format
 */
export function convertToPlayerStats(rawPlayer: any): PlayerStats {
  const playerStats: PlayerStats = {
    player_id: rawPlayer.player_id,
    name: rawPlayer.name,
    primary_pos: rawPlayer.primary_pos
  };
  
  // Convert batting stats
  if (rawPlayer.career?.batting) {
    const batting = rawPlayer.career.batting;
    playerStats.batting = {
      games: batting.試合,
      pa: batting.打席,
      ab: batting.打数,
      h: batting.安打,
      hr: batting.本塁打,
      rbi: batting.打点,
      avg: batting.打率,
      obp: batting.出塁率,
      slg: batting.長打率,
      ops: batting.OPS,
      ops_plus: batting.OPS_plus_simple,
      wrc_plus: batting.wRC_plus_simple,
      bb_pct: batting.四球率,
      k_pct: batting.三振率,
      iso: batting.ISO,
      babip: batting.BABIP,
    };
  }
  
  // Convert pitching stats
  if (rawPlayer.career?.pitching) {
    const pitching = rawPlayer.career.pitching;
    playerStats.pitching = {
      games: pitching.登板,
      gs: pitching.先発,
      ip: pitching.IP_float,
      w: pitching.勝利,
      l: pitching.敗北,
      era: pitching.防御率,
      whip: pitching.WHIP,
      fip: pitching.FIP,
      era_minus: pitching.ERA_minus,
      k9: pitching.K_9,
      bb9: pitching.BB_9,
      hr9: pitching.HR_9,
      k_pct: pitching.K_pct,
      bb_pct: pitching.BB_pct,
      k_minus_bb_pct: pitching.K_pct && pitching.BB_pct ? pitching.K_pct - pitching.BB_pct : undefined,
      lob_pct: pitching.LOB_pct,
      gb_pct: pitching.GB_pct,
    };
  }
  
  return playerStats;
}