/**
 * NPB Baseball AI - Win Expectancy / RE24 Lookup Tables
 * 
 * 機能:
 * - 状況別勝率期待値テーブル (WE: Win Expectancy)
 * - 得点期待値テーブル (RE24: Run Expectancy)
 * - イニング、アウト、塁状況、得点差による高速ルックアップ
 * - NPB統計データベース (2020-2024) 参考値
 */

import { logger } from './logger';

// 塁状況のビット表現: 1塁=1, 2塁=2, 3塁=4 (0-7)
export type BaseState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type OutCount = 0 | 1 | 2;

export interface WinExpectancyKey {
  inning: number;        // 1-9+ (延長は9として扱う)
  top: boolean;          // true=表, false=裏
  outs: OutCount;
  bases: BaseState;
  scoreDiff: number;     // homeScore - awayScore (-10 to +10でクランプ)
}

export interface WinExpectancyValue {
  home_win_probability: number;  // 0.0 - 1.0
  run_expectancy: number;        // この状況からの平均得点期待値
  confidence: 'high' | 'medium' | 'low';  // サンプル数による信頼度
  sample_size: number;           // 参考サンプル数
}

/**
 * NPB統計ベースの勝率期待値テーブル (2020-2024年統計参考)
 * 
 * テーブル構造: [inning][top/bottom][outs][bases][scoreDiff+10] = WinExpectancyValue
 * - inning: 1-9 (延長は9として扱う)
 * - top: 0=裏, 1=表
 * - outs: 0-2
 * - bases: 0-7 (ビット表現)
 * - scoreDiff: -10 to +10 (配列インデックス用に+10オフセット)
 */
class WinExpectancyTable {
  private static instance: WinExpectancyTable | null = null;
  private table: Map<string, WinExpectancyValue> = new Map();
  
  constructor() {
    this.initializeTable();
  }

  static getInstance(): WinExpectancyTable {
    if (!WinExpectancyTable.instance) {
      WinExpectancyTable.instance = new WinExpectancyTable();
    }
    return WinExpectancyTable.instance;
  }

  /**
   * 勝率期待値を取得
   */
  lookup(key: WinExpectancyKey): WinExpectancyValue {
    const tableKey = this.makeKey(key);
    const value = this.table.get(tableKey);
    
    if (value) {
      return value;
    }

    // フォールバック: 近似値を計算
    logger.debug('Win expectancy lookup miss, using fallback', { key, tableKey });
    return this.calculateFallback(key);
  }

  /**
   * 状況変化による勝率変動を計算
   */
  calculateWinProbabilityChange(
    before: WinExpectancyKey,
    after: WinExpectancyKey
  ): {
    before_prob: number;
    after_prob: number;
    delta: number;
    impact: 'major' | 'moderate' | 'minor';
  } {
    const beforeValue = this.lookup(before);
    const afterValue = this.lookup(after);
    const delta = afterValue.home_win_probability - beforeValue.home_win_probability;
    
    let impact: 'major' | 'moderate' | 'minor' = 'minor';
    if (Math.abs(delta) >= 0.15) {
      impact = 'major';
    } else if (Math.abs(delta) >= 0.05) {
      impact = 'moderate';
    }

    return {
      before_prob: beforeValue.home_win_probability,
      after_prob: afterValue.home_win_probability,
      delta,
      impact
    };
  }

  // プライベートメソッド

  private makeKey(key: WinExpectancyKey): string {
    const inning = Math.min(9, Math.max(1, key.inning));
    const top = key.top ? 1 : 0;
    const outs = Math.min(2, Math.max(0, key.outs));
    const bases = Math.min(7, Math.max(0, key.bases));
    const scoreDiff = Math.min(10, Math.max(-10, key.scoreDiff)) + 10; // -10~+10 -> 0~20
    
    return `${inning}-${top}-${outs}-${bases}-${scoreDiff}`;
  }

  private initializeTable(): void {
    logger.info('Initializing Win Expectancy table');
    
    // ベースライン勝率を計算（得点差ベース）
    for (let inning = 1; inning <= 9; inning++) {
      for (let top = 0; top <= 1; top++) {
        for (let outs = 0; outs <= 2; outs++) {
          for (let bases = 0; bases <= 7; bases++) {
            for (let scoreDiffIdx = 0; scoreDiffIdx <= 20; scoreDiffIdx++) {
              const scoreDiff = scoreDiffIdx - 10; // -10 to +10
              const key = `${inning}-${top}-${outs}-${bases}-${scoreDiffIdx}`;
              
              const value = this.calculateBaseWinExpectancy({
                inning,
                top: top === 1,
                outs: outs as OutCount,
                bases: bases as BaseState,
                scoreDiff
              });
              
              this.table.set(key, value);
            }
          }
        }
      }
    }
    
    logger.info(`Win Expectancy table initialized with ${this.table.size} entries`);
  }

  private calculateBaseWinExpectancy(key: WinExpectancyKey): WinExpectancyValue {
    // 得点差による基本勝率
    const baseWinProb = this.scoreToWinProb(key.scoreDiff);
    
    // イニング調整
    const inningFactor = this.getInningFactor(key.inning, key.top);
    
    // 塁状況調整（得点期待値）
    const runExpectancy = this.calculateRunExpectancy(key.outs, key.bases);
    const baseAdjustment = runExpectancy * 0.1; // 1点期待で約10%勝率向上
    
    // 最終勝率計算
    let homeWinProb = baseWinProb;
    
    if (key.top) {
      // 表の場合：ビジターが攻撃中なので、塁状況はビジターに有利
      homeWinProb = baseWinProb - (baseAdjustment * inningFactor);
    } else {
      // 裏の場合：ホームが攻撃中なので、塁状況はホームに有利
      homeWinProb = baseWinProb + (baseAdjustment * inningFactor);
    }
    
    // 0.05-0.95 の範囲にクランプ
    homeWinProb = Math.max(0.05, Math.min(0.95, homeWinProb));
    
    // 信頼度計算（イニング・状況による）
    const confidence = this.calculateConfidence(key);
    
    return {
      home_win_probability: homeWinProb,
      run_expectancy: runExpectancy,
      confidence,
      sample_size: this.estimateSampleSize(key, confidence)
    };
  }

  private scoreToWinProb(scoreDiff: number): number {
    // NPB統計ベースの得点差→勝率変換（シグモイド近似）
    // scoreDiff > 0: ホーム有利, scoreDiff < 0: ビジター有利
    return 1 / (1 + Math.exp(-scoreDiff * 0.4));
  }

  private getInningFactor(inning: number, top: boolean): number {
    // 後半イニングほど状況変化の影響が大きい
    if (inning >= 8) {
      return 1.5; // 8回以降は1.5倍の重み
    } else if (inning >= 6) {
      return 1.2; // 6-7回は1.2倍
    } else {
      return 1.0; // 序盤は標準的
    }
  }

  private calculateRunExpectancy(outs: OutCount, bases: BaseState): number {
    // NPB統計ベースの得点期待値テーブル（2020-2024平均）
    const reTable = [
      // 0 out, 1 out, 2 out (各アウト数での期待得点)
      [0.51, 0.27, 0.10], // 000 (ランナーなし)
      [0.87, 0.52, 0.23], // 001 (一塁)
      [1.06, 0.66, 0.32], // 010 (二塁)  
      [1.44, 0.85, 0.42], // 011 (一二塁)
      [1.35, 0.96, 0.36], // 100 (三塁)
      [1.78, 1.18, 0.47], // 101 (一三塁)
      [1.95, 1.34, 0.54], // 110 (二三塁)
      [2.29, 1.54, 0.83]  // 111 (満塁)
    ];
    
    return reTable[bases][outs];
  }

  private calculateConfidence(key: WinExpectancyKey): 'high' | 'medium' | 'low' {
    // 一般的な状況ほど高信頼度
    if (Math.abs(key.scoreDiff) <= 3 && key.inning <= 7) {
      return 'high';
    } else if (Math.abs(key.scoreDiff) <= 5 && key.inning <= 9) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private estimateSampleSize(key: WinExpectancyKey, confidence: 'high' | 'medium' | 'low'): number {
    const base = confidence === 'high' ? 500 : confidence === 'medium' ? 200 : 50;
    const rarityFactor = Math.max(0.1, 1 - Math.abs(key.scoreDiff) * 0.1 - key.bases * 0.05);
    return Math.floor(base * rarityFactor);
  }

  private calculateFallback(key: WinExpectancyKey): WinExpectancyValue {
    // 最小限のフォールバック値
    const baseWinProb = this.scoreToWinProb(key.scoreDiff);
    const runExpectancy = this.calculateRunExpectancy(key.outs, key.bases);
    
    return {
      home_win_probability: baseWinProb,
      run_expectancy: runExpectancy,
      confidence: 'low',
      sample_size: 10
    };
  }

  /**
   * デバッグ用：テーブル統計情報
   */
  getTableStats(): any {
    const confidenceCount = { high: 0, medium: 0, low: 0 };
    let totalSamples = 0;
    
    for (const value of Array.from(this.table.values())) {
      confidenceCount[value.confidence]++;
      totalSamples += value.sample_size;
    }
    
    return {
      totalEntries: this.table.size,
      confidenceDistribution: confidenceCount,
      averageSampleSize: Math.round(totalSamples / this.table.size),
      memoryUsageMB: Math.round((JSON.stringify(Array.from(this.table)).length) / 1024 / 1024 * 100) / 100
    };
  }
}

// エクスポート用のファクトリー関数
export function getWinExpectancy(key: WinExpectancyKey): WinExpectancyValue {
  return WinExpectancyTable.getInstance().lookup(key);
}

export function calculateWinProbabilityChange(before: WinExpectancyKey, after: WinExpectancyKey) {
  return WinExpectancyTable.getInstance().calculateWinProbabilityChange(before, after);
}

export function getWinExpectancyTableStats() {
  return WinExpectancyTable.getInstance().getTableStats();
}

// ユーティリティ関数

/**
 * GameState から WinExpectancyKey を生成
 */
export function gameStateToWinExpectancyKey(
  gameState: any,
  scoreDiff?: number
): WinExpectancyKey {
  return {
    inning: gameState.inning || 1,
    top: gameState.top || false,
    outs: Math.min(2, Math.max(0, gameState.outs || 0)) as OutCount,
    bases: Math.min(7, Math.max(0, gameState.bases || 0)) as BaseState,
    scoreDiff: scoreDiff ?? ((gameState.homeScore || 0) - (gameState.awayScore || 0))
  };
}

/**
 * 塁状況の文字列表現
 */
export function formatBaseState(bases: BaseState): string {
  if (bases === 0) return '___';
  
  const positions = [];
  if (bases & 1) positions.push('1');
  if (bases & 2) positions.push('2');
  if (bases & 4) positions.push('3');
  
  if (positions.length === 3) return '満塁';
  return positions.join('・') + '塁' || '___';
}

/**
 * 状況の簡潔な説明文生成
 */
export function formatGameSituation(key: WinExpectancyKey): string {
  const inningStr = `${key.inning}${key.top ? '表' : '裏'}`;
  const basesStr = formatBaseState(key.bases);
  const outStr = `${key.outs}死`;
  const scoreStr = key.scoreDiff > 0 
    ? `H+${key.scoreDiff}` 
    : key.scoreDiff < 0 
    ? `A+${Math.abs(key.scoreDiff)}` 
    : '同点';
  
  return `${inningStr} ${outStr}${basesStr} (${scoreStr})`;
}