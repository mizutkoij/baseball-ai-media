/**
 * Team Data Queries
 * Database queries for team standings, leaders, and statistics
 */

interface DatabaseConnection {
  prepare: (query: string) => {
    all: (...params: any[]) => any[];
    get: (...params: any[]) => any;
  };
  close: () => void;
}

export interface TeamStandings {
  team: string;
  W: number;
  L: number;
  D: number;
  RD: number; // Run differential
  rank: number;
  last10: { W: number; L: number; D: number };
}

export interface LeaderRow {
  player_id: string;
  player_name: string;
  team: string;
  PA?: number;
  IP?: number;
  wRC_plus?: number;
  FIP_minus?: number;
  // Core stats for display
  avg?: number;
  obp?: number;
  slg?: number;
  HR?: number;
  era?: number;
  whip?: number;
  SO?: number;
}

export interface TeamSummary {
  batting: {
    wRC_plus: number;
    wOBA: number;
    OPS: number;
    R: number;
    HR: number;
    SB: number;
  };
  pitching: {
    FIP: number;
    ERA_minus: number;
    WHIP: number;
    K_pct: number;
    BB_pct: number;
    HR_per9: number;
  };
}

export interface OpponentRecord {
  opponent: string;
  W: number;
  L: number;
  D: number;
}

export interface TeamConstants {
  woba_scale: number;
  woba_fip: number;
  lg_woba: number;
  lg_r_pa: number;
  lg_fip: number;
  PF: number; // Park factor
}

export interface DistributionBin {
  range: string;
  count: number;
  percentage: number;
  players: string[];
}

export interface TeamDistributionData {
  type: 'wRC_plus' | 'FIP_minus';
  title: string;
  description: string;
  teamAverage: number;
  leagueAverage: number;
  bins: DistributionBin[];
  total: number;
}

export interface PromotionData {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  promotion_type: 'rookie' | 'callup' | 'breakthrough';
  farm_stats?: {
    year: number;
    games: number;
    key_stat: number;
    key_stat_name: string;
  };
  major_stats?: {
    year: number;
    games: number;
    key_stat: number;
    key_stat_name: string;
  };
  impact_rating: 'high' | 'medium' | 'low';
  description: string;
}

export interface TeamSplitStats {
  split_type: 'home' | 'away';
  games: number;
  reliability: 'high' | 'medium' | 'low';
  
  // Batting stats
  batting: {
    PA: number;
    wRC_plus: number;
    wRC_plus_neutral: number; // PF corrected
    OPS_plus: number;
    OPS_plus_neutral: number; // PF corrected
    wOBA: number;
    avg_pf: number; // Weighted average park factor
  };
  
  // Pitching stats
  pitching: {
    IP: number;
    ERA_minus: number;
    ERA_minus_neutral: number; // PF corrected
    FIP_minus: number;
    FIP_minus_neutral: number; // PF corrected
    WHIP: number;
    WHIP_neutral?: number;
    HR_per9: number;
    avg_pf: number; // Weighted average park factor
    runs_allowed?: number;
    runs_allowed_per_game?: number;
  };
}

/**
 * Get team standings for a year and league
 */
export function getTeamStandings(
  db: DatabaseConnection,
  year: number,
  league: string,
  team?: string
): TeamStandings[] {
  const query = `
    WITH scored AS (
      SELECT 
        g.game_id, 
        g.date, 
        g.league,
        g.home_team AS team, 
        (g.home_runs - g.away_runs) AS diff,
        CASE WHEN g.home_runs > g.away_runs THEN 1 ELSE 0 END AS w,
        CASE WHEN g.home_runs < g.away_runs THEN 1 ELSE 0 END AS l,
        CASE WHEN g.home_runs = g.away_runs THEN 1 ELSE 0 END AS d
      FROM games g
      WHERE substr(g.game_id, 1, 4) = ? AND g.league = ?
      
      UNION ALL
      
      SELECT 
        g.game_id, 
        g.date, 
        g.league,
        g.away_team AS team,
        (g.away_runs - g.home_runs) AS diff, 
        CASE WHEN g.away_runs > g.home_runs THEN 1 ELSE 0 END AS w,
        CASE WHEN g.away_runs < g.home_runs THEN 1 ELSE 0 END AS l,
        CASE WHEN g.away_runs = g.home_runs THEN 1 ELSE 0 END AS d
      FROM games g
      WHERE substr(g.game_id, 1, 4) = ? AND g.league = ?
    ),
    standings AS (
      SELECT 
        team,
        SUM(w) AS W, 
        SUM(l) AS L, 
        SUM(d) AS D,
        SUM(diff) AS RD
      FROM scored
      GROUP BY team
    )
    SELECT 
      team, W, L, D, RD,
      RANK() OVER (ORDER BY W DESC, RD DESC) AS rank
    FROM standings
    ${team ? 'WHERE team = ?' : ''}
    ORDER BY rank ASC
  `;
  
  const params = [year.toString(), league, year.toString(), league];
  if (team) params.push(team);
  
  const results = db.prepare(query).all(...params);
  
  // Calculate last 10 games (simplified - would need more complex query for actual last 10)
  return results.map((row: any) => ({
    ...row,
    last10: { W: 0, L: 0, D: 0 } // Placeholder - implement if needed
  }));
}

/**
 * Get team batting leaders (by wRC+)
 */
export function getTeamBattingLeaders(
  db: DatabaseConnection,
  year: number,
  team: string,
  constants: TeamConstants,
  limit: number = 5
): LeaderRow[] {
  const query = `
    SELECT 
      b.player_id,
      b.player_name,
      b.team,
      SUM(b.PA) AS PA,
      SUM(b.AB) AS AB,
      SUM(b.H) AS H,
      SUM(b.BB) AS BB,
      SUM(b.IBB) AS IBB,
      SUM(b.HBP) AS HBP,
      SUM(b.singles_2B) AS _2B,
      SUM(b.singles_3B) AS _3B,
      SUM(b.HR) AS HR,
      SUM(b.SF) AS SF,
      SUM(b.SB) AS SB,
      SUM(b.R) AS R
    FROM box_batting b
    JOIN games g ON b.game_id = g.game_id
    WHERE substr(b.game_id, 1, 4) = ? 
      AND b.team = ?
      AND b.PA > 0
    GROUP BY b.player_id, b.player_name, b.team
    HAVING PA >= 120
    ORDER BY PA DESC
    LIMIT ?
  `;
  
  const results = db.prepare(query).all(year.toString(), team, limit * 2); // Get more for filtering
  
  // Calculate advanced stats in TypeScript
  return results.map((row: any) => {
    const { AB, H, BB, IBB, HBP, _2B, _3B, HR, SF, PA } = row;
    
    // Basic stats
    const avg = AB > 0 ? H / AB : 0;
    const obp = (PA - SF) > 0 ? (H + BB + HBP) / (PA - SF) : 0;
    const slg = AB > 0 ? (H - _2B - _3B - HR + 2 * _2B + 3 * _3B + 4 * HR) / AB : 0;
    
    // wOBA calculation (simplified)
    const woba_numerator = 0.69 * (BB - IBB) + 0.719 * HBP + 0.87 * (H - _2B - _3B - HR) + 
                          1.217 * _2B + 1.529 * _3B + 1.94 * HR;
    const woba_denominator = PA - SF;
    const wOBA = woba_denominator > 0 ? woba_numerator / woba_denominator : 0;
    
    // wRC+ calculation (simplified)
    const wRC_plus = constants.lg_woba > 0 ? ((wOBA - constants.lg_woba) / constants.woba_scale + constants.lg_r_pa) * 100 : 100;
    
    return {
      player_id: row.player_id,
      player_name: row.player_name,
      team: row.team,
      PA: row.PA,
      avg,
      obp,
      slg: slg,
      HR: row.HR,
      wRC_plus: Math.round(wRC_plus)
    };
  })
  .filter(player => player.wRC_plus > 0) // Filter valid calculations
  .sort((a, b) => (b.wRC_plus || 0) - (a.wRC_plus || 0))
  .slice(0, limit);
}

/**
 * Get team pitching leaders (by FIP-)
 */
export function getTeamPitchingLeaders(
  db: DatabaseConnection,
  year: number,
  team: string,
  constants: TeamConstants,
  limit: number = 5
): LeaderRow[] {
  const query = `
    SELECT 
      p.player_id,
      p.player_name,
      p.team,
      SUM(p.IP_outs) / 3.0 AS IP,
      SUM(p.SO) AS SO,
      SUM(p.BB) AS BB,
      SUM(p.IBB) AS IBB,
      SUM(p.HBP) AS HBP,
      SUM(p.HR) AS HR,
      SUM(p.ER) AS ER,
      SUM(p.H) AS H,
      SUM(p.BF) AS BF
    FROM box_pitching p
    JOIN games g ON p.game_id = g.game_id
    WHERE substr(p.game_id, 1, 4) = ?
      AND p.team = ?
      AND p.IP_outs > 0
    GROUP BY p.player_id, p.player_name, p.team
    HAVING IP >= 30
    ORDER BY IP DESC
    LIMIT ?
  `;
  
  const results = db.prepare(query).all(year.toString(), team, limit * 2);
  
  return results.map((row: any) => {
    const { IP, SO, BB, IBB, HBP, HR, ER, H, BF } = row;
    
    // Basic stats
    const era = IP > 0 ? (ER * 9) / IP : 0;
    const whip = IP > 0 ? (BB + H) / IP : 0;
    
    // FIP calculation (simplified)
    const fip = IP > 0 ? ((13 * HR + 3 * (BB + HBP - IBB) - 2 * SO) / IP) + constants.woba_fip : 0;
    const FIP_minus = constants.lg_fip > 0 ? Math.round((fip / constants.lg_fip) * 100) : 100;
    
    return {
      player_id: row.player_id,
      player_name: row.player_name,
      team: row.team,
      IP: row.IP,
      era: Math.round(era * 100) / 100,
      whip: Math.round(whip * 1000) / 1000,
      SO: row.SO,
      FIP_minus
    };
  })
  .filter(pitcher => pitcher.FIP_minus > 0)
  .sort((a, b) => (a.FIP_minus || 999) - (b.FIP_minus || 999))
  .slice(0, limit);
}

/**
 * Get team vs opponent records
 */
export function getTeamVsOpponents(
  db: DatabaseConnection,
  year: number,
  team: string
): OpponentRecord[] {
  const query = `
    WITH team_results AS (
      SELECT 
        CASE WHEN g.home_team = ? THEN g.away_team ELSE g.home_team END AS opponent,
        CASE 
          WHEN (g.home_team = ? AND g.home_runs > g.away_runs) OR 
               (g.away_team = ? AND g.away_runs > g.home_runs) 
          THEN 1 ELSE 0 
        END AS W,
        CASE 
          WHEN (g.home_team = ? AND g.home_runs < g.away_runs) OR 
               (g.away_team = ? AND g.away_runs < g.home_runs) 
          THEN 1 ELSE 0 
        END AS L,
        CASE WHEN g.home_runs = g.away_runs THEN 1 ELSE 0 END AS D
      FROM games g
      WHERE substr(g.game_id, 1, 4) = ?
        AND (g.home_team = ? OR g.away_team = ?)
    )
    SELECT 
      opponent,
      SUM(W) AS W,
      SUM(L) AS L,
      SUM(D) AS D
    FROM team_results
    GROUP BY opponent
    ORDER BY opponent
  `;
  
  return db.prepare(query).all(
    team, team, team, team, team, year.toString(), team, team
  );
}

/**
 * Get team summary statistics
 */
export function getTeamSummary(
  db: DatabaseConnection,
  year: number,
  team: string,
  constants: TeamConstants
): TeamSummary {
  // Batting summary
  const battingQuery = `
    SELECT 
      SUM(b.PA) AS PA,
      SUM(b.AB) AS AB,
      SUM(b.H) AS H,
      SUM(b.BB) AS BB,
      SUM(b.IBB) AS IBB,
      SUM(b.HBP) AS HBP,
      SUM(b.singles_2B) AS _2B,
      SUM(b.singles_3B) AS _3B,
      SUM(b.HR) AS HR,
      SUM(b.SF) AS SF,
      SUM(b.SB) AS SB,
      SUM(b.R) AS R
    FROM box_batting b
    WHERE substr(b.game_id, 1, 4) = ? AND b.team = ?
  `;
  
  const battingResult = db.prepare(battingQuery).get(year.toString(), team);
  
  // Pitching summary
  const pitchingQuery = `
    SELECT 
      SUM(p.IP_outs) / 3.0 AS IP,
      SUM(p.SO) AS SO,
      SUM(p.BB) AS BB,
      SUM(p.IBB) AS IBB,
      SUM(p.HBP) AS HBP,
      SUM(p.HR) AS HR,
      SUM(p.ER) AS ER,
      SUM(p.H) AS H,
      SUM(p.BF) AS BF
    FROM box_pitching p
    WHERE substr(p.game_id, 1, 4) = ? AND p.team = ?
  `;
  
  const pitchingResult = db.prepare(pitchingQuery).get(year.toString(), team);
  
  // Calculate batting summary
  const { AB, H, BB, IBB, HBP, _2B, _3B, HR, SF, PA, SB, R } = battingResult || {};
  const avg = AB > 0 ? H / AB : 0;
  const obp = (PA - SF) > 0 ? (H + BB + HBP) / (PA - SF) : 0;
  const slg = AB > 0 ? (H - _2B - _3B - HR + 2 * _2B + 3 * _3B + 4 * HR) / AB : 0;
  const ops = obp + slg;
  
  const woba_numerator = 0.69 * (BB - IBB) + 0.719 * HBP + 0.87 * (H - _2B - _3B - HR) + 
                        1.217 * _2B + 1.529 * _3B + 1.94 * HR;
  const wOBA = (PA - SF) > 0 ? woba_numerator / (PA - SF) : 0;
  const wRC_plus = constants.lg_woba > 0 ? ((wOBA - constants.lg_woba) / constants.woba_scale + constants.lg_r_pa) * 100 : 100;
  
  // Calculate pitching summary
  const { IP, SO, ER } = pitchingResult || {};
  const pitchingBB = pitchingResult?.BB || 0;
  const pitchingH = pitchingResult?.H || 0;
  const pitchingHR = pitchingResult?.HR || 0;
  const pitchingHBP = pitchingResult?.HBP || 0;
  const pitchingIBB = pitchingResult?.IBB || 0;
  const pitchingBF = pitchingResult?.BF || 0;
  
  const era = IP > 0 ? (ER * 9) / IP : 0;
  const whip = IP > 0 ? (pitchingBB + pitchingH) / IP : 0;
  const fip = IP > 0 ? ((13 * pitchingHR + 3 * (pitchingBB + pitchingHBP - pitchingIBB) - 2 * SO) / IP) + constants.woba_fip : 0;
  const ERA_minus = constants.lg_fip > 0 ? (era / constants.lg_fip) * 100 : 100;
  const K_pct = pitchingBF > 0 ? (SO / pitchingBF) * 100 : 0;
  const BB_pct = pitchingBF > 0 ? (pitchingBB / pitchingBF) * 100 : 0;
  const HR_per9 = IP > 0 ? (pitchingHR * 9) / IP : 0;
  
  return {
    batting: {
      wRC_plus: Math.round(wRC_plus),
      wOBA: Math.round(wOBA * 1000) / 1000,
      OPS: Math.round(ops * 1000) / 1000,
      R: R || 0,
      HR: HR || 0,
      SB: SB || 0
    },
    pitching: {
      FIP: Math.round(fip * 100) / 100,
      ERA_minus: Math.round(ERA_minus),
      WHIP: Math.round(whip * 1000) / 1000,
      K_pct: Math.round(K_pct * 10) / 10,
      BB_pct: Math.round(BB_pct * 10) / 10,
      HR_per9: Math.round(HR_per9 * 100) / 100
    }
  };
}

/**
 * Get team ability distributions for wRC+ and FIP-
 */
export function getTeamDistributions(
  db: DatabaseConnection,
  year: number,
  team: string,
  constants: TeamConstants
): TeamDistributionData[] {
  const distributions: TeamDistributionData[] = [];
  
  // Get batting distribution (wRC+)
  const battingQuery = `
    SELECT 
      b.player_id,
      b.player_name,
      b.team,
      SUM(b.PA) AS PA,
      SUM(b.AB) AS AB,
      SUM(b.H) AS H,
      SUM(b.BB) AS BB,
      SUM(b.IBB) AS IBB,
      SUM(b.HBP) AS HBP,
      SUM(b.singles_2B) AS _2B,
      SUM(b.singles_3B) AS _3B,
      SUM(b.HR) AS HR,
      SUM(b.SF) AS SF
    FROM box_batting b
    JOIN games g ON b.game_id = g.game_id
    WHERE substr(b.game_id, 1, 4) = ? 
      AND b.team = ?
      AND b.PA > 0
    GROUP BY b.player_id, b.player_name, b.team
    HAVING PA >= 50
    ORDER BY PA DESC
  `;
  
  const battingResults = db.prepare(battingQuery).all(year.toString(), team);
  
  // Calculate wRC+ for each batter
  const battersWithStats = battingResults.map((row: any) => {
    const { AB, H, BB, IBB, HBP, _2B, _3B, HR, SF, PA } = row;
    
    const woba_numerator = 0.69 * (BB - IBB) + 0.719 * HBP + 0.87 * (H - _2B - _3B - HR) + 
                          1.217 * _2B + 1.529 * _3B + 1.94 * HR;
    const woba_denominator = PA - SF;
    const wOBA = woba_denominator > 0 ? woba_numerator / woba_denominator : 0;
    const wRC_plus = constants.lg_woba > 0 ? ((wOBA - constants.lg_woba) / constants.woba_scale + constants.lg_r_pa) * 100 : 100;
    
    return {
      player_id: row.player_id,
      player_name: row.player_name,
      wRC_plus: Math.round(wRC_plus),
      PA: row.PA
    };
  }).filter(p => p.wRC_plus > 0 && p.wRC_plus < 300); // Filter reasonable values
  
  // Create wRC+ distribution bins
  const wrcBins = createDistributionBins(battersWithStats, 'wRC_plus', [
    { min: 0, max: 69, label: '~69' },
    { min: 70, max: 79, label: '70-79' },
    { min: 80, max: 89, label: '80-89' },
    { min: 90, max: 99, label: '90-99' },
    { min: 100, max: 109, label: '100-109' },
    { min: 110, max: 119, label: '110-119' },
    { min: 120, max: 129, label: '120-129' },
    { min: 130, max: 139, label: '130-139' },
    { min: 140, max: 999, label: '140+' }
  ]);
  
  const teamAvgWRC = battersWithStats.length > 0 
    ? Math.round(battersWithStats.reduce((sum, p) => sum + p.wRC_plus, 0) / battersWithStats.length)
    : 100;
  
  distributions.push({
    type: 'wRC_plus',
    title: 'wRC+ 分布',
    description: '打撃指標の分布（リーグ平均100）',
    teamAverage: teamAvgWRC,
    leagueAverage: 100,
    bins: wrcBins,
    total: battersWithStats.length
  });
  
  // Get pitching distribution (FIP-)
  const pitchingQuery = `
    SELECT 
      p.player_id,
      p.player_name,
      p.team,
      SUM(p.IP_outs) / 3.0 AS IP,
      SUM(p.SO) AS SO,
      SUM(p.BB) AS BB,
      SUM(p.IBB) AS IBB,
      SUM(p.HBP) AS HBP,
      SUM(p.HR) AS HR,
      SUM(p.ER) AS ER
    FROM box_pitching p
    JOIN games g ON p.game_id = g.game_id
    WHERE substr(p.game_id, 1, 4) = ?
      AND p.team = ?
      AND p.IP_outs > 0
    GROUP BY p.player_id, p.player_name, p.team
    HAVING IP >= 10
    ORDER BY IP DESC
  `;
  
  const pitchingResults = db.prepare(pitchingQuery).all(year.toString(), team);
  
  // Calculate FIP- for each pitcher
  const pitchersWithStats = pitchingResults.map((row: any) => {
    const { IP, SO, BB, IBB, HBP, HR } = row;
    
    const fip = IP > 0 ? ((13 * HR + 3 * (BB + HBP - IBB) - 2 * SO) / IP) + constants.woba_fip : 0;
    const FIP_minus = constants.lg_fip > 0 ? Math.round((fip / constants.lg_fip) * 100) : 100;
    
    return {
      player_id: row.player_id,
      player_name: row.player_name,
      FIP_minus,
      IP: row.IP
    };
  }).filter(p => p.FIP_minus > 20 && p.FIP_minus < 200); // Filter reasonable values
  
  // Create FIP- distribution bins
  const fipBins = createDistributionBins(pitchersWithStats, 'FIP_minus', [
    { min: 0, max: 69, label: '~69' },
    { min: 70, max: 79, label: '70-79' },
    { min: 80, max: 89, label: '80-89' },
    { min: 90, max: 99, label: '90-99' },
    { min: 100, max: 109, label: '100-109' },
    { min: 110, max: 119, label: '110-119' },
    { min: 120, max: 129, label: '120-129' },
    { min: 130, max: 139, label: '130-139' },
    { min: 140, max: 999, label: '140+' }
  ]);
  
  const teamAvgFIP = pitchersWithStats.length > 0 
    ? Math.round(pitchersWithStats.reduce((sum, p) => sum + p.FIP_minus, 0) / pitchersWithStats.length)
    : 100;
  
  distributions.push({
    type: 'FIP_minus',
    title: 'FIP- 分布',
    description: '投手指標の分布（リーグ平均100、低いほど良い）',
    teamAverage: teamAvgFIP,
    leagueAverage: 100,
    bins: fipBins,
    total: pitchersWithStats.length
  });
  
  return distributions;
}

/**
 * Get team promotion candidates (farm to major league)
 */
export function getTeamPromotions(
  db: DatabaseConnection,
  year: number,
  team: string,
  constants: TeamConstants
): PromotionData[] {
  const promotions: PromotionData[] = [];
  
  // Look for players who had limited major league time but significant farm performance
  // This is a simplified approach - in reality would need farm league data
  
  // Get players with limited major league games but promising stats
  const callupQuery = `
    SELECT 
      b.player_id,
      b.player_name,
      b.team,
      COUNT(DISTINCT b.game_id) as games,
      SUM(b.PA) AS PA,
      SUM(b.AB) AS AB,
      SUM(b.H) AS H,
      SUM(b.HR) AS HR,
      SUM(b.BB) AS BB,
      SUM(b.IBB) AS IBB,
      SUM(b.HBP) AS HBP,
      SUM(b.singles_2B) AS _2B,
      SUM(b.singles_3B) AS _3B,
      SUM(b.SF) AS SF,
      MIN(substr(b.game_id, 5, 4)) as first_game_date
    FROM box_batting b
    WHERE substr(b.game_id, 1, 4) = ? 
      AND b.team = ?
      AND b.PA > 0
    GROUP BY b.player_id, b.player_name, b.team
    HAVING games <= 50 AND PA >= 20 AND PA <= 150
    ORDER BY PA DESC
  `;
  
  const callupBatters = db.prepare(callupQuery).all(year.toString(), team);
  
  // Process batting callups
  callupBatters.forEach((player: any) => {
    const { AB, H, BB, IBB, HBP, _2B, _3B, HR, SF, PA } = player;
    
    // Calculate basic stats
    const avg = AB > 0 ? H / AB : 0;
    const obp = (PA - SF) > 0 ? (H + BB + HBP) / (PA - SF) : 0;
    
    // Calculate wRC+ (simplified)
    const woba_numerator = 0.69 * (BB - IBB) + 0.719 * HBP + 0.87 * (H - _2B - _3B - HR) + 
                          1.217 * _2B + 1.529 * _3B + 1.94 * HR;
    const woba_denominator = PA - SF;
    const wOBA = woba_denominator > 0 ? woba_numerator / woba_denominator : 0;
    const wRC_plus = constants.lg_woba > 0 ? ((wOBA - constants.lg_woba) / constants.woba_scale + constants.lg_r_pa) * 100 : 100;
    
    // Determine promotion type and impact
    let promotion_type: 'rookie' | 'callup' | 'breakthrough' = 'callup';
    let impact_rating: 'high' | 'medium' | 'low' = 'low';
    let description = '';
    
    // Early season debut (potential rookie)
    if (player.first_game_date <= '0430' && player.games >= 20) {
      promotion_type = 'rookie';
      description = `${year}年新人王候補。シーズン序盤から一軍定着`;
      
      if (wRC_plus >= 110) {
        impact_rating = 'high';
        description += '、優秀な成績を残している';
      } else if (wRC_plus >= 95) {
        impact_rating = 'medium';
        description += '、まずまずの成績';
      }
    }
    // Mid-season callup with good performance
    else if (wRC_plus >= 120 || (avg >= 0.300 && obp >= 0.350)) {
      promotion_type = 'breakthrough';
      impact_rating = wRC_plus >= 130 ? 'high' : 'medium';
      description = `シーズン途中昇格でブレイク。打率${(avg * 1000).toFixed(0)}/1000、wRC+${Math.round(wRC_plus)}の好成績`;
    }
    // Regular callup
    else {
      description = `シーズン途中昇格。${player.games}試合に出場、経験を積んでいる段階`;
      impact_rating = player.games >= 30 ? 'medium' : 'low';
    }
    
    promotions.push({
      player_id: player.player_id,
      player_name: player.player_name,
      team: player.team,
      position: 'B', // Batter
      promotion_type,
      major_stats: {
        year,
        games: player.games,
        key_stat: Math.round(wRC_plus),
        key_stat_name: 'wRC+'
      },
      impact_rating,
      description: description + '。'
    });
  });
  
  // Get pitching callups
  const pitchingCallupQuery = `
    SELECT 
      p.player_id,
      p.player_name,
      p.team,
      COUNT(DISTINCT p.game_id) as games,
      SUM(p.IP_outs) / 3.0 AS IP,
      SUM(p.SO) AS SO,
      SUM(p.BB) AS BB,
      SUM(p.IBB) AS IBB,
      SUM(p.HBP) AS HBP,
      SUM(p.HR) AS HR,
      SUM(p.ER) AS ER,
      MIN(substr(p.game_id, 5, 4)) as first_game_date
    FROM box_pitching p
    WHERE substr(p.game_id, 1, 4) = ?
      AND p.team = ?
      AND p.IP_outs > 0
    GROUP BY p.player_id, p.player_name, p.team
    HAVING games <= 30 AND IP >= 5 AND IP <= 80
    ORDER BY IP DESC
  `;
  
  const callupPitchers = db.prepare(pitchingCallupQuery).all(year.toString(), team);
  
  // Process pitching callups
  callupPitchers.forEach((player: any) => {
    const { IP, SO, BB, IBB, HBP, HR, ER } = player;
    
    // Calculate basic stats
    const era = IP > 0 ? (ER * 9) / IP : 0;
    const fip = IP > 0 ? ((13 * HR + 3 * (BB + HBP - IBB) - 2 * SO) / IP) + constants.woba_fip : 0;
    const FIP_minus = constants.lg_fip > 0 ? (fip / constants.lg_fip) * 100 : 100;
    
    // Determine promotion type and impact
    let promotion_type: 'rookie' | 'callup' | 'breakthrough' = 'callup';
    let impact_rating: 'high' | 'medium' | 'low' = 'low';
    let description = '';
    
    // Early season debut (potential rookie)
    if (player.first_game_date <= '0430' && player.games >= 10) {
      promotion_type = 'rookie';
      description = `${year}年新人王候補投手。シーズン序盤から一軍定着`;
      
      if (FIP_minus <= 85) {
        impact_rating = 'high';
        description += '、優秀な投球内容';
      } else if (FIP_minus <= 105) {
        impact_rating = 'medium';
        description += '、まずまずの投球';
      }
    }
    // Breakthrough performance
    else if (FIP_minus <= 80 || (era <= 2.50 && IP >= 20)) {
      promotion_type = 'breakthrough';
      impact_rating = FIP_minus <= 70 ? 'high' : 'medium';
      description = `シーズン途中昇格でブレイク。防御率${era.toFixed(2)}、FIP-${Math.round(FIP_minus)}の好投`;
    }
    // Regular callup
    else {
      description = `シーズン途中昇格。${player.games}試合登板、経験を積んでいる段階`;
      impact_rating = player.games >= 15 ? 'medium' : 'low';
    }
    
    promotions.push({
      player_id: player.player_id,
      player_name: player.player_name,
      team: player.team,
      position: 'P', // Pitcher
      promotion_type,
      major_stats: {
        year,
        games: player.games,
        key_stat: Math.round(FIP_minus),
        key_stat_name: 'FIP-'
      },
      impact_rating,
      description: description + '。'
    });
  });
  
  // Sort by impact rating and performance
  return promotions.sort((a, b) => {
    const impactOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    const typeOrder = { 'breakthrough': 3, 'rookie': 2, 'callup': 1 };
    
    const aScore = impactOrder[a.impact_rating] * 10 + typeOrder[a.promotion_type];
    const bScore = impactOrder[b.impact_rating] * 10 + typeOrder[b.promotion_type];
    
    return bScore - aScore;
  });
}

/**
 * Get team home/away splits with PF corrections
 */
export function getTeamSplits(
  db: DatabaseConnection,
  year: number,
  team: string,
  constants: TeamConstants
): TeamSplitStats[] {
  const splits: TeamSplitStats[] = [];
  
  // Get home split
  const homeBattingQuery = `
    SELECT 
      b.game_id,
      SUM(b.PA) AS PA,
      SUM(b.AB) AS AB,
      SUM(b.H) AS H,
      SUM(b.BB) AS BB,
      SUM(b.IBB) AS IBB,
      SUM(b.HBP) AS HBP,
      SUM(b.singles_2B) AS _2B,
      SUM(b.singles_3B) AS _3B,
      SUM(b.HR) AS HR,
      SUM(b.SF) AS SF,
      g.venue_pf
    FROM box_batting b
    JOIN games g ON b.game_id = g.game_id
    WHERE substr(b.game_id, 1, 4) = ? 
      AND b.team = ?
      AND g.home_team = b.team
      AND b.PA > 0
    GROUP BY b.game_id, g.venue_pf
  `;
  
  const awayBattingQuery = `
    SELECT 
      b.game_id,
      SUM(b.PA) AS PA,
      SUM(b.AB) AS AB,
      SUM(b.H) AS H,
      SUM(b.BB) AS BB,
      SUM(b.IBB) AS IBB,
      SUM(b.HBP) AS HBP,
      SUM(b.singles_2B) AS _2B,
      SUM(b.singles_3B) AS _3B,
      SUM(b.HR) AS HR,
      SUM(b.SF) AS SF,
      g.venue_pf
    FROM box_batting b
    JOIN games g ON b.game_id = g.game_id
    WHERE substr(b.game_id, 1, 4) = ? 
      AND b.team = ?
      AND g.away_team = b.team
      AND b.PA > 0
    GROUP BY b.game_id, g.venue_pf
  `;
  
  // Process home splits
  const homeGames = db.prepare(homeBattingQuery).all(year.toString(), team);
  const homeSplit = calculateSplitStats(homeGames, 'home', constants);
  splits.push(homeSplit);
  
  // Process away splits
  const awayGames = db.prepare(awayBattingQuery).all(year.toString(), team);
  const awaySplit = calculateSplitStats(awayGames, 'away', constants);
  splits.push(awaySplit);
  
  return splits;
}

/**
 * Calculate split statistics with PF corrections
 */
function calculateSplitStats(
  games: any[],
  splitType: 'home' | 'away',
  constants: TeamConstants
): TeamSplitStats {
  // Aggregate all games for this split
  const totals = games.reduce((acc, game) => {
    const pf = game.venue_pf || 1.0;
    const weight = game.PA || 0;
    
    return {
      PA: acc.PA + game.PA,
      AB: acc.AB + game.AB,
      H: acc.H + game.H,
      BB: acc.BB + game.BB,
      IBB: acc.IBB + game.IBB,
      HBP: acc.HBP + game.HBP,
      _2B: acc._2B + game._2B,
      _3B: acc._3B + game._3B,
      HR: acc.HR + game.HR,
      SF: acc.SF + game.SF,
      weighted_pf_sum: acc.weighted_pf_sum + (pf * weight),
      total_weight: acc.total_weight + weight
    };
  }, {
    PA: 0, AB: 0, H: 0, BB: 0, IBB: 0, HBP: 0, _2B: 0, _3B: 0, HR: 0, SF: 0,
    weighted_pf_sum: 0, total_weight: 0
  });
  
  const { PA, AB, H, BB, IBB, HBP, _2B, _3B, HR, SF } = totals;
  const avgPF = totals.total_weight > 0 ? totals.weighted_pf_sum / totals.total_weight : 1.0;
  
  // Calculate basic stats
  const avg = AB > 0 ? H / AB : 0;
  const obp = (PA - SF) > 0 ? (H + BB + HBP) / (PA - SF) : 0;
  const slg = AB > 0 ? (H - _2B - _3B - HR + 2 * _2B + 3 * _3B + 4 * HR) / AB : 0;
  const ops = obp + slg;
  
  // wOBA calculation
  const woba_numerator = 0.69 * (BB - IBB) + 0.719 * HBP + 0.87 * (H - _2B - _3B - HR) + 
                        1.217 * _2B + 1.529 * _3B + 1.94 * HR;
  const wOBA = (PA - SF) > 0 ? woba_numerator / (PA - SF) : 0;
  
  // wRC+ calculation
  const wRC_plus = constants.lg_woba > 0 ? ((wOBA - constants.lg_woba) / constants.woba_scale + constants.lg_r_pa) * 100 : 100;
  const wRC_plus_neutral = wRC_plus / Math.pow(avgPF, 1.0); // Full PF adjustment for hitting
  
  // OPS+ calculation  
  const OPS_plus = 100; // Simplified - would need league averages
  const OPS_plus_neutral = OPS_plus / Math.pow(avgPF, 1.0);
  
  // Determine reliability based on sample size
  const reliability: 'high' | 'medium' | 'low' = 
    PA >= 200 ? 'high' : PA >= 50 ? 'medium' : 'low';
  
  // Mock pitching data (in production, would query pitching stats similarly)
  const pitching = {
    IP: Math.max(PA / 4, 1), // Rough estimate
    ERA_minus: 100,
    ERA_minus_neutral: 100 / Math.pow(avgPF, 1.0), // Full PF adjustment for ERA-
    FIP_minus: 100,
    FIP_minus_neutral: 100 / Math.pow(avgPF, 0.5), // Half PF adjustment for FIP-
    WHIP: 1.25, // Mock WHIP value
    WHIP_neutral: 1.25 / Math.pow(avgPF, 0.3), // Slight PF adjustment for WHIP
    HR_per9: (HR * 9) / Math.max(PA / 4, 1),
    avg_pf: avgPF,
    runs_allowed: Math.round(PA / 10), // Mock runs allowed
    runs_allowed_per_game: Math.round(PA / 10 / Math.max(games.length, 1))
  };
  
  return {
    split_type: splitType,
    games: games.length,
    reliability,
    batting: {
      PA,
      wRC_plus: Math.round(wRC_plus),
      wRC_plus_neutral: Math.round(wRC_plus_neutral),
      OPS_plus: Math.round(OPS_plus),
      OPS_plus_neutral: Math.round(OPS_plus_neutral),
      wOBA: Math.round(wOBA * 1000) / 1000,
      avg_pf: Math.round(avgPF * 1000) / 1000
    },
    pitching
  };
}

/**
 * Helper function to create distribution bins
 */
function createDistributionBins(
  players: any[],
  statKey: string,
  binRanges: { min: number; max: number; label: string }[]
): DistributionBin[] {
  const total = players.length;
  
  return binRanges.map(range => {
    const playersInBin = players.filter(p => {
      const value = p[statKey];
      return value >= range.min && value <= range.max;
    });
    
    return {
      range: range.label,
      count: playersInBin.length,
      percentage: total > 0 ? (playersInBin.length / total) * 100 : 0,
      players: playersInBin.map(p => p.player_name).slice(0, 5) // Limit to 5 names for tooltip
    };
  });
}