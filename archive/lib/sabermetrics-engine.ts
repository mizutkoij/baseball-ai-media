/**
 * lib/sabermetrics-engine.ts - セイバーメトリクス計算エンジン
 * 
 * NPB/MLBデータからの高度な野球統計指標計算システム
 */

// セイバーメトリクス計算用の型定義
export interface PlayerBattingData {
  playerId: string
  name: string
  team: string
  league: 'NPB' | 'MLB'
  // 基本打撃データ
  plateAppearances: number  // PA
  atBats: number           // AB
  hits: number             // H
  doubles: number          // 2B
  triples: number          // 3B
  homeRuns: number         // HR
  walks: number            // BB
  hitByPitch: number       // HBP
  strikeouts: number       // SO
  sacrificeFly: number     // SF
  intentionalWalks: number // IBB
  rbis: number             // RBI
  runs: number             // R
  stolenBases: number      // SB
  caughtStealing: number   // CS
  // 追加データ（利用可能な場合）
  groundBalls?: number     // GB
  flyBalls?: number        // FB
  lineDrives?: number      // LD
  popUps?: number          // PU
}

export interface PlayerPitchingData {
  playerId: string
  name: string
  team: string
  league: 'NPB' | 'MLB'
  // 基本投手データ
  inningsPitched: number   // IP
  hits: number             // H
  runs: number             // R
  earnedRuns: number       // ER
  walks: number            // BB
  strikeouts: number       // SO
  homeRuns: number         // HR
  hitByPitch: number       // HBP
  wildPitches: number      // WP
  balks: number            // BK
  wins: number             // W
  losses: number           // L
  saves: number            // SV
  holds: number            // HLD
  gamesPitched: number     // G
  gamesStarted: number     // GS
  completeGames: number    // CG
  shutouts: number         // SHO
}

export interface SabermetricsResult {
  playerId: string
  name: string
  team: string
  league: 'NPB' | 'MLB'
  season: number
  // 打撃指標
  battingAverage?: number      // AVG
  onBasePercentage?: number    // OBP
  sluggingPercentage?: number  // SLG
  onBasePlusSlugging?: number  // OPS
  weightedOnBaseAverage?: number // wOBA
  weightedRunsCreatedPlus?: number // wRC+
  battingAverageOnBallsInPlay?: number // BABIP
  isolatedPower?: number       // ISO
  walkRate?: number           // BB%
  strikeoutRate?: number      // SO%
  // 投手指標
  earnedRunAverage?: number    // ERA
  walkAndHitsPerInning?: number // WHIP
  fieldingIndependentPitching?: number // FIP
  expectedFieldingIndependentPitching?: number // xFIP
  strikeoutToWalkRatio?: number // SO/BB
  strikeoutsPer9?: number      // SO9
  walksPer9?: number          // BB9
  homeRunsPer9?: number       // HR9
  // 統合指標（将来実装）
  winsAboveReplacement?: number // WAR
}

export interface LeagueConstants {
  // wOBA重み（年度・リーグ別）
  wOBA: {
    [year: number]: {
      NPB?: {
        wBB: number
        wHBP: number
        w1B: number
        w2B: number
        w3B: number
        wHR: number
        wOBAScale: number
        wOBA: number
      }
      MLB?: {
        wBB: number
        wHBP: number
        w1B: number
        w2B: number
        w3B: number
        wHR: number
        wOBAScale: number
        wOBA: number
      }
    }
  }
  // FIP定数（年度・リーグ別）
  FIP: {
    [year: number]: {
      NPB?: number
      MLB?: number
    }
  }
  // wRC+用のパークファクター等
  parkFactors?: {
    [year: number]: {
      [team: string]: number
    }
  }
}

/**
 * 2023年のリーグ定数（実際のデータに基づく）
 */
export const LEAGUE_CONSTANTS_2023: LeagueConstants = {
  wOBA: {
    2023: {
      MLB: {
        wBB: 0.690,
        wHBP: 0.724,
        w1B: 0.884,
        w2B: 1.257,
        w3B: 1.593,
        wHR: 2.058,
        wOBAScale: 1.216,
        wOBA: 0.315
      },
      NPB: {
        // NPB推定値（MLBベースで調整）
        wBB: 0.695,
        wHBP: 0.729,
        w1B: 0.889,
        w2B: 1.262,
        w3B: 1.598,
        wHR: 2.063,
        wOBAScale: 1.220,
        wOBA: 0.318
      }
    }
  },
  FIP: {
    2023: {
      MLB: 3.132,
      NPB: 3.240  // NPB推定値
    }
  }
}

export class SabermetricsEngine {
  private constants: LeagueConstants

  constructor(constants: LeagueConstants = LEAGUE_CONSTANTS_2023) {
    this.constants = constants
  }

  /**
   * 打撃セイバーメトリクス計算
   */
  calculateBattingMetrics(
    data: PlayerBattingData, 
    season: number = 2023
  ): Partial<SabermetricsResult> {
    const result: Partial<SabermetricsResult> = {
      playerId: data.playerId,
      name: data.name,
      team: data.team,
      league: data.league,
      season
    }

    // 基本指標計算
    result.battingAverage = this.calculateBattingAverage(data)
    result.onBasePercentage = this.calculateOnBasePercentage(data)
    result.sluggingPercentage = this.calculateSluggingPercentage(data)
    result.onBasePlusSlugging = this.calculateOPS(data)
    result.isolatedPower = this.calculateIsolatedPower(data)
    result.battingAverageOnBallsInPlay = this.calculateBABIP(data)
    
    // レート指標
    result.walkRate = this.calculateWalkRate(data)
    result.strikeoutRate = this.calculateStrikeoutRate(data)
    
    // 高度指標
    result.weightedOnBaseAverage = this.calculateWOBA(data, season)
    result.weightedRunsCreatedPlus = this.calculateWRCPlus(data, season)

    return result
  }

  /**
   * 投手セイバーメトリクス計算
   */
  calculatePitchingMetrics(
    data: PlayerPitchingData, 
    season: number = 2023
  ): Partial<SabermetricsResult> {
    const result: Partial<SabermetricsResult> = {
      playerId: data.playerId,
      name: data.name,
      team: data.team,
      league: data.league,
      season
    }

    // 基本指標計算
    result.earnedRunAverage = this.calculateERA(data)
    result.walkAndHitsPerInning = this.calculateWHIP(data)
    result.strikeoutToWalkRatio = this.calculateStrikeoutToWalkRatio(data)
    
    // Per 9イニング指標
    result.strikeoutsPer9 = this.calculateStrikeoutsPer9(data)
    result.walksPer9 = this.calculateWalksPer9(data)
    result.homeRunsPer9 = this.calculateHomeRunsPer9(data)
    
    // 高度指標
    result.fieldingIndependentPitching = this.calculateFIP(data, season)
    result.expectedFieldingIndependentPitching = this.calculateXFIP(data, season)

    return result
  }

  // =============================================================================
  // 打撃指標計算メソッド
  // =============================================================================

  private calculateBattingAverage(data: PlayerBattingData): number {
    if (data.atBats === 0) return 0
    return data.hits / data.atBats
  }

  private calculateOnBasePercentage(data: PlayerBattingData): number {
    const denominator = data.atBats + data.walks + data.hitByPitch + data.sacrificeFly
    if (denominator === 0) return 0
    return (data.hits + data.walks + data.hitByPitch) / denominator
  }

  private calculateSluggingPercentage(data: PlayerBattingData): number {
    if (data.atBats === 0) return 0
    const singles = data.hits - data.doubles - data.triples - data.homeRuns
    const totalBases = singles + (data.doubles * 2) + (data.triples * 3) + (data.homeRuns * 4)
    return totalBases / data.atBats
  }

  private calculateOPS(data: PlayerBattingData): number {
    return this.calculateOnBasePercentage(data) + this.calculateSluggingPercentage(data)
  }

  private calculateIsolatedPower(data: PlayerBattingData): number {
    return this.calculateSluggingPercentage(data) - this.calculateBattingAverage(data)
  }

  private calculateBABIP(data: PlayerBattingData): number {
    const denominator = data.atBats - data.strikeouts - data.homeRuns + data.sacrificeFly
    if (denominator === 0) return 0
    return (data.hits - data.homeRuns) / denominator
  }

  private calculateWalkRate(data: PlayerBattingData): number {
    if (data.plateAppearances === 0) return 0
    return data.walks / data.plateAppearances
  }

  private calculateStrikeoutRate(data: PlayerBattingData): number {
    if (data.plateAppearances === 0) return 0
    return data.strikeouts / data.plateAppearances
  }

  private calculateWOBA(data: PlayerBattingData, season: number): number {
    const constants = this.constants.wOBA[season]?.[data.league]
    if (!constants) return 0

    const singles = data.hits - data.doubles - data.triples - data.homeRuns
    const numerator = (
      constants.wBB * data.walks +
      constants.wHBP * data.hitByPitch +
      constants.w1B * singles +
      constants.w2B * data.doubles +
      constants.w3B * data.triples +
      constants.wHR * data.homeRuns
    )
    
    const denominator = data.atBats + data.walks - data.intentionalWalks + data.hitByPitch + data.sacrificeFly
    
    if (denominator === 0) return 0
    return numerator / denominator
  }

  private calculateWRCPlus(data: PlayerBattingData, season: number): number {
    const wOBA = this.calculateWOBA(data, season)
    const constants = this.constants.wOBA[season]?.[data.league]
    if (!constants) return 100

    // 簡略版wRC+計算（パークファクター等は考慮せず）
    const wRCPerPA = (wOBA - constants.wOBA) / constants.wOBAScale
    const leagueWRCPerPA = 0 // リーグ平均との差分として計算
    
    if (data.plateAppearances === 0) return 100
    return 100 + (wRCPerPA - leagueWRCPerPA) * 100
  }

  // =============================================================================
  // 投手指標計算メソッド
  // =============================================================================

  private calculateERA(data: PlayerPitchingData): number {
    if (data.inningsPitched === 0) return 0
    return (data.earnedRuns * 9) / data.inningsPitched
  }

  private calculateWHIP(data: PlayerPitchingData): number {
    if (data.inningsPitched === 0) return 0
    return (data.walks + data.hits) / data.inningsPitched
  }

  private calculateStrikeoutToWalkRatio(data: PlayerPitchingData): number {
    if (data.walks === 0) return data.strikeouts > 0 ? Infinity : 0
    return data.strikeouts / data.walks
  }

  private calculateStrikeoutsPer9(data: PlayerPitchingData): number {
    if (data.inningsPitched === 0) return 0
    return (data.strikeouts * 9) / data.inningsPitched
  }

  private calculateWalksPer9(data: PlayerPitchingData): number {
    if (data.inningsPitched === 0) return 0
    return (data.walks * 9) / data.inningsPitched
  }

  private calculateHomeRunsPer9(data: PlayerPitchingData): number {
    if (data.inningsPitched === 0) return 0
    return (data.homeRuns * 9) / data.inningsPitched
  }

  private calculateFIP(data: PlayerPitchingData, season: number): number {
    const fipConstant = this.constants.FIP[season]?.[data.league]
    if (!fipConstant || data.inningsPitched === 0) return 0

    const numerator = (13 * data.homeRuns) + (3 * (data.walks + data.hitByPitch)) - (2 * data.strikeouts)
    return (numerator / data.inningsPitched) + fipConstant
  }

  private calculateXFIP(data: PlayerPitchingData, season: number): number {
    const fipConstant = this.constants.FIP[season]?.[data.league]
    if (!fipConstant || data.inningsPitched === 0) return 0

    // xFIPは本塁打を正常化（リーグ平均HR/FB率を使用）
    // 簡略版として、NPB: 13%, MLB: 15%の固定値を使用
    const leagueAverageHRPerFB = data.league === 'NPB' ? 0.13 : 0.15
    
    // フライボール数の推定（データがない場合の簡略計算）
    const estimatedFlyBalls = data.flyBalls || (data.inningsPitched * 3 * 0.4) // IP*BF/IP*FB率の推定
    const expectedHomeRuns = estimatedFlyBalls * leagueAverageHRPerFB

    const numerator = (13 * expectedHomeRuns) + (3 * (data.walks + data.hitByPitch)) - (2 * data.strikeouts)
    return (numerator / data.inningsPitched) + fipConstant
  }

  // =============================================================================
  // ユーティリティメソッド
  // =============================================================================

  /**
   * リーグ定数の更新
   */
  updateConstants(constants: LeagueConstants): void {
    this.constants = constants
  }

  /**
   * 複数選手の一括計算
   */
  calculateBatchBattingMetrics(
    players: PlayerBattingData[], 
    season: number = 2023
  ): SabermetricsResult[] {
    return players.map(player => 
      this.calculateBattingMetrics(player, season)
    ) as SabermetricsResult[]
  }

  calculateBatchPitchingMetrics(
    pitchers: PlayerPitchingData[], 
    season: number = 2023
  ): SabermetricsResult[] {
    return pitchers.map(pitcher => 
      this.calculatePitchingMetrics(pitcher, season)
    ) as SabermetricsResult[]
  }

  /**
   * 指標の説明テキスト取得
   */
  getMetricDescription(metric: string): string {
    const descriptions: { [key: string]: string } = {
      'battingAverage': '打率 - 安打数を打数で割った値',
      'onBasePercentage': '出塁率 - 出塁した確率',
      'sluggingPercentage': '長打率 - 1打席あたりの塁打数',
      'onBasePlusSlugging': 'OPS - 出塁率+長打率',
      'weightedOnBaseAverage': 'wOBA - 各結果の価値を重み付けした出塁指標',
      'weightedRunsCreatedPlus': 'wRC+ - リーグ平均を100とした攻撃貢献度',
      'battingAverageOnBallsInPlay': 'BABIP - インプレーボールでの打率',
      'isolatedPower': 'ISO - 長打力を示す指標（長打率-打率）',
      'earnedRunAverage': '防御率 - 9イニングあたりの自責点',
      'walkAndHitsPerInning': 'WHIP - 1イニングあたりの被安打+四球',
      'fieldingIndependentPitching': 'FIP - 守備に依存しない投手成績',
      'expectedFieldingIndependentPitching': 'xFIP - FIPの本塁打を正常化した版'
    }
    return descriptions[metric] || '説明なし'
  }
}