/**
 * sabermetrics.ts
 * NPB向けセイバーメトリクス計算ライブラリ
 * 自前推定の係数・定数を使用
 */

export interface LeagueConstants {
  year: number;
  league: string;
  woba_bb: number;
  woba_hbp: number; 
  woba_1b: number;
  woba_2b: number;
  woba_3b: number;
  woba_hr: number;
  woba_scale: number;
  fip_constant: number;
  lg_r_pa: number;
  lg_r_g: number;
  park_factors: Record<string, number>;
}

export interface BattingStats {
  PA: number;
  AB: number;
  H: number;
  '2B': number;
  '3B': number;
  HR: number;
  BB: number;
  IBB?: number;
  HBP?: number;
  SF?: number;
  SH?: number;
  SO?: number;
  R?: number;
  RBI?: number;
  SB?: number;
  CS?: number;
}

export interface PitchingStats {
  IP_outs: number;
  BF?: number;
  H: number;
  R: number;
  ER: number;
  HR: number;
  BB: number;
  IBB?: number;
  HBP?: number;
  SO: number;
  WP?: number;
  BK?: number;
}

export class SabermetricsCalculator {
  private constants: LeagueConstants;
  
  constructor(constants: LeagueConstants) {
    this.constants = constants;
  }
  
  /**
   * 基本打撃指標の計算
   */
  calculateBasicBatting(stats: BattingStats) {
    const avg = stats.AB > 0 ? stats.H / stats.AB : 0;
    const obp = stats.PA > 0 ? 
      (stats.H + (stats.BB || 0) + (stats.HBP || 0)) / 
      (stats.PA - (stats.SH || 0)) : 0;
    
    const tb = stats.H + (stats['2B'] || 0) + 2 * (stats['3B'] || 0) + 3 * (stats.HR || 0);
    const slg = stats.AB > 0 ? tb / stats.AB : 0;
    const ops = obp + slg;
    
    const iso = slg - avg;
    
    // BABIP = (H - HR) / (AB - SO - HR + SF)
    const babip_denom = stats.AB - (stats.SO || 0) - (stats.HR || 0) + (stats.SF || 0);
    const babip = babip_denom > 0 ? (stats.H - (stats.HR || 0)) / babip_denom : 0;
    
    return {
      AVG: parseFloat(avg.toFixed(3)),
      OBP: parseFloat(obp.toFixed(3)),
      SLG: parseFloat(slg.toFixed(3)),
      OPS: parseFloat(ops.toFixed(3)),
      ISO: parseFloat(iso.toFixed(3)),
      BABIP: parseFloat(babip.toFixed(3))
    };
  }
  
  /**
   * wOBA計算 (自前係数使用)
   */
  calculateWOBA(stats: BattingStats): number {
    const uBB = (stats.BB || 0) - (stats.IBB || 0);
    const singles = stats.H - (stats['2B'] || 0) - (stats['3B'] || 0) - (stats.HR || 0);
    
    const woba_numerator = 
      this.constants.woba_bb * uBB +
      this.constants.woba_hbp * (stats.HBP || 0) +
      this.constants.woba_1b * singles +
      this.constants.woba_2b * (stats['2B'] || 0) +
      this.constants.woba_3b * (stats['3B'] || 0) +
      this.constants.woba_hr * (stats.HR || 0);
    
    const woba_denominator = stats.PA - (stats.IBB || 0) - (stats.SH || 0);
    
    return woba_denominator > 0 ? woba_numerator / woba_denominator : 0;
  }
  
  /**
   * wRC+ 計算 (パークファクター未適用版)
   */
  calculateWRCPlus(stats: BattingStats, venue?: string): number {
    const woba = this.calculateWOBA(stats);
    const league_woba = this.constants.lg_r_pa / this.constants.woba_scale + 0.320; // 概算
    
    if (league_woba <= 0) return 100;
    
    // パークファクター (指定されていれば適用)
    let park_factor = 1.0;
    if (venue && this.constants.park_factors[venue]) {
      park_factor = this.constants.park_factors[venue];
    }
    
    // wRC+ = ((wOBA - lgwOBA) / wOBA_scale + R/PA) / lgR/PA * 100 / park_factor
    const wrc_plus = ((woba - league_woba) / this.constants.woba_scale + this.constants.lg_r_pa) / 
                     this.constants.lg_r_pa * 100 / park_factor;
    
    return Math.max(0, parseFloat(wrc_plus.toFixed(0)));
  }
  
  /**
   * OPS+ 計算 (簡易版)
   */
  calculateOPSPlus(stats: BattingStats, venue?: string): number {
    const basic = this.calculateBasicBatting(stats);
    const league_ops = 0.720; // 概算、実際は年次で変動
    
    let park_factor = 1.0;
    if (venue && this.constants.park_factors[venue]) {
      park_factor = this.constants.park_factors[venue];
    }
    
    const ops_plus = (basic.OPS / league_ops) * 100 / park_factor;
    return Math.max(0, parseFloat(ops_plus.toFixed(0)));
  }
  
  /**
   * 基本投球指標の計算
   */
  calculateBasicPitching(stats: PitchingStats) {
    const ip = stats.IP_outs / 3.0;
    const era = ip > 0 ? (stats.ER * 9.0) / ip : 0;
    const whip = ip > 0 ? (stats.H + (stats.BB || 0)) / ip : 0;
    
    const k9 = ip > 0 ? (stats.SO * 9.0) / ip : 0;
    const bb9 = ip > 0 ? ((stats.BB || 0) * 9.0) / ip : 0;
    const hr9 = ip > 0 ? ((stats.HR || 0) * 9.0) / ip : 0;
    
    const k_pct = (stats.BF || 0) > 0 ? (stats.SO / (stats.BF || 1)) * 100 : 0;
    const bb_pct = (stats.BF || 0) > 0 ? ((stats.BB || 0) / (stats.BF || 1)) * 100 : 0;
    
    return {
      IP: parseFloat(ip.toFixed(1)),
      ERA: parseFloat(era.toFixed(2)),
      WHIP: parseFloat(whip.toFixed(2)),
      K9: parseFloat(k9.toFixed(1)),
      BB9: parseFloat(bb9.toFixed(1)),
      HR9: parseFloat(hr9.toFixed(1)),
      'K%': parseFloat(k_pct.toFixed(1)),
      'BB%': parseFloat(bb_pct.toFixed(1))
    };
  }
  
  /**
   * FIP計算 (自前定数使用)
   */
  calculateFIP(stats: PitchingStats): number {
    const ip = stats.IP_outs / 3.0;
    if (ip === 0) return 0;
    
    const uBB = (stats.BB || 0) - (stats.IBB || 0);
    const fip = ((13 * (stats.HR || 0)) + (3 * (uBB + (stats.HBP || 0))) - (2 * (stats.SO || 0))) / ip + 
                this.constants.fip_constant;
    
    return Math.max(0, parseFloat(fip.toFixed(2)));
  }
  
  /**
   * ERA- 計算 (パークファクター調整版)
   */
  calculateERAMinus(stats: PitchingStats, venue?: string): number {
    const basic = this.calculateBasicPitching(stats);
    const league_era = this.constants.lg_r_g / 2 * 0.9; // 概算 (R/G → ERA変換)
    
    if (league_era <= 0 || basic.ERA <= 0) return 100;
    
    let park_factor = 1.0;
    if (venue && this.constants.park_factors[venue]) {
      park_factor = this.constants.park_factors[venue];
    }
    
    const era_minus = (basic.ERA / league_era) * 100 * park_factor;
    return Math.max(0, parseFloat(era_minus.toFixed(0)));
  }
  
  /**
   * FIP- 計算
   */
  calculateFIPMinus(stats: PitchingStats, venue?: string): number {
    const fip = this.calculateFIP(stats);
    const league_fip = this.constants.fip_constant + 1.0; // 概算
    
    if (league_fip <= 0 || fip <= 0) return 100;
    
    let park_factor = 1.0;
    if (venue && this.constants.park_factors[venue]) {
      park_factor = this.constants.park_factors[venue];
    }
    
    const fip_minus = (fip / league_fip) * 100 * park_factor;
    return Math.max(0, parseFloat(fip_minus.toFixed(0)));
  }
  
  /**
   * 総合指標計算 (打撃)
   */
  calculateAdvancedBatting(stats: BattingStats, venue?: string) {
    const basic = this.calculateBasicBatting(stats);
    const woba = this.calculateWOBA(stats);
    const wrc_plus = this.calculateWRCPlus(stats, venue);
    const ops_plus = this.calculateOPSPlus(stats, venue);
    
    return {
      ...basic,
      wOBA: parseFloat(woba.toFixed(3)),
      'wRC+': wrc_plus,
      'OPS+': ops_plus
    };
  }
  
  /**
   * 総合指標計算 (投球)
   */
  calculateAdvancedPitching(stats: PitchingStats, venue?: string) {
    const basic = this.calculateBasicPitching(stats);
    const fip = this.calculateFIP(stats);
    const era_minus = this.calculateERAMinus(stats, venue);
    const fip_minus = this.calculateFIPMinus(stats, venue);
    
    return {
      ...basic,
      FIP: fip,
      'ERA-': era_minus,
      'FIP-': fip_minus
    };
  }
}

/**
 * デフォルト定数 (フォールバック用)
 */
export const DEFAULT_CONSTANTS: LeagueConstants = {
  year: 2024,
  league: 'first', 
  woba_bb: 0.69,
  woba_hbp: 0.72,
  woba_1b: 0.89,
  woba_2b: 1.27,
  woba_3b: 1.62,
  woba_hr: 2.10,
  woba_scale: 1.15,
  fip_constant: 3.10,
  lg_r_pa: 0.10,
  lg_r_g: 4.5,
  park_factors: { 'default': 1.0 }
};

/**
 * 定数付きで計算を実行
 */
export function calculateWithConstants(
  constants: LeagueConstants,
  battingStats?: BattingStats,
  pitchingStats?: PitchingStats,
  venue?: string
) {
  const calc = new SabermetricsCalculator(constants);
  
  const result: any = {};
  
  if (battingStats) {
    result.batting = calc.calculateAdvancedBatting(battingStats, venue);
  }
  
  if (pitchingStats) {
    result.pitching = calc.calculateAdvancedPitching(pitchingStats, venue);
  }
  
  return result;
}