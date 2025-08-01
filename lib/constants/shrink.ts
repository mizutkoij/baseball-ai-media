/**
 * 係数推定の安定化（シュリンク推定）
 * 小サンプル期の跳ねを抑制し、前版との断絶を回避
 */

export interface ShrinkResult {
  value: number;         // 公開値（ガード適用後）
  shrunk: number;        // シュリンク適用後の値
  empirical: number;     // 経験値（生データから算出）
  prior: number;         // 事前値（前回の値）
  delta: number;         // 変化率 |shrunk - prior| / |prior|
  weight: number;        // 経験的重み n/(n+k)
  sampleSize: number;    // サンプルサイズ
  isGuarded: boolean;    // ガード条件で前版を採用したか
  metadata: ShrinkMetadata;
}

export interface ShrinkMetadata {
  rule: string;
  kValue: number;
  threshold: number;
  timestamp: string;
  league: string;
  year: number;
}

/**
 * ベイジアンシュリンク推定
 * @param empirical 経験値（生データから算出）
 * @param prior 事前値（前回の値）
 * @param sampleSize サンプルサイズ
 * @param k 平滑化パラメータ（デフォルト: 7500打席相当）
 */
export function shrink(empirical: number, prior: number, sampleSize: number, k = 7500): number {
  if (sampleSize <= 0) return prior;
  const weight = sampleSize / (sampleSize + k);
  return weight * empirical + (1 - weight) * prior;
}

/**
 * ガード条件付きシュリンク（跳ね抑制）
 * @param empirical 経験値
 * @param prior 事前値
 * @param sampleSize サンプルサイズ
 * @param k 平滑化パラメータ
 * @param threshold 変化率閾値（デフォルト: 7%）
 * @param minSamples 最小サンプル数（これ以下なら強制的に前版採用）
 */
export function shrinkWithGuard(
  empirical: number,
  prior: number,
  sampleSize: number,
  k = 7500,
  threshold = 0.07,
  minSamples = 1000
): ShrinkResult {
  const weight = sampleSize > 0 ? sampleSize / (sampleSize + k) : 0;
  const shrunkValue = sampleSize > 0 ? shrink(empirical, prior, sampleSize, k) : prior;
  const delta = Math.abs((shrunkValue - prior) / (prior || 1));
  
  // ガード条件
  const isUnderSampled = sampleSize < minSamples;
  const isVolatile = delta > threshold;
  const isGuarded = isUnderSampled || isVolatile;
  
  const finalValue = isGuarded ? prior : shrunkValue;

  return {
    value: finalValue,
    shrunk: shrunkValue,
    empirical,
    prior,
    delta,
    weight,
    sampleSize,
    isGuarded,
    metadata: {
      rule: isUnderSampled ? 'min_samples' : isVolatile ? 'volatility_guard' : 'normal',
      kValue: k,
      threshold,
      timestamp: new Date().toISOString(),
      league: 'NPB',
      year: new Date().getFullYear()
    }
  };
}

/**
 * wOBA係数の安定化計算
 */
export function shrinkWobaWeights(
  empiricalWeights: Record<string, number>,
  priorWeights: Record<string, number>,
  totalPA: number,
  k = 7500,
  threshold = 0.07
): Record<string, ShrinkResult> {
  const results: Record<string, ShrinkResult> = {};
  
  const weights = ['wBB', 'wHBP', 'w1B', 'w2B', 'w3B', 'wHR'];
  
  for (const weight of weights) {
    const empirical = empiricalWeights[weight] || 0;
    const prior = priorWeights[weight] || 0;
    
    results[weight] = shrinkWithGuard(empirical, prior, totalPA, k, threshold);
  }
  
  return results;
}

/**
 * FIP係数の安定化計算
 */
export function shrinkFipConstants(
  empirical: { fipConstant: number; }, 
  prior: { fipConstant: number; },
  totalBF: number,
  k = 10000,
  threshold = 0.05
): { fipConstant: ShrinkResult } {
  return {
    fipConstant: shrinkWithGuard(
      empirical.fipConstant,
      prior.fipConstant,
      totalBF,
      k,
      threshold
    )
  };
}

/**
 * パークファクター係数の安定化
 */
export function shrinkParkFactors(
  empiricalPF: Record<string, number>,
  priorPF: Record<string, number>,
  parkGames: Record<string, number>,
  k = 500, // パークファクターは試合数ベース
  threshold = 0.10 // より大きな変動を許容
): Record<string, ShrinkResult> {
  const results: Record<string, ShrinkResult> = {};
  
  for (const [park, empirical] of Object.entries(empiricalPF)) {
    const prior = priorPF[park] || 1.0; // 中立 = 1.0
    const games = parkGames[park] || 0;
    
    results[park] = shrinkWithGuard(empirical, prior, games, k, threshold, 50); // 最低50試合
  }
  
  return results;
}

/**
 * 係数更新のアラート条件チェック
 */
export function checkAlertConditions(results: Record<string, ShrinkResult>): {
  alerts: Array<{
    coefficient: string;
    severity: 'warning' | 'error';
    reason: string;
    delta: number;
    sampleSize: number;
  }>;
  shouldAlert: boolean;
} {
  const alerts: any[] = [];
  
  for (const [coeff, result] of Object.entries(results)) {
    // 大幅変動の警告
    if (result.delta > 0.15) {
      alerts.push({
        coefficient: coeff,
        severity: 'error' as const,
        reason: 'Large change detected',
        delta: result.delta,
        sampleSize: result.sampleSize
      });
    } else if (result.delta > 0.07 && result.isGuarded) {
      alerts.push({
        coefficient: coeff,
        severity: 'warning' as const,
        reason: 'Guarded due to volatility',
        delta: result.delta,
        sampleSize: result.sampleSize
      });
    }
    
    // サンプル不足の警告
    if (result.sampleSize < 1000) {
      alerts.push({
        coefficient: coeff,
        severity: 'warning' as const,
        reason: 'Low sample size',
        delta: result.delta,
        sampleSize: result.sampleSize
      });
    }
  }
  
  const shouldAlert = alerts.some(a => a.severity === 'error') || alerts.length > 3;
  
  return { alerts, shouldAlert };
}

/**
 * 係数更新ログの生成
 */
export function generateUpdateLog(
  results: Record<string, ShrinkResult>,
  metadata: { league: string; year: number; month?: number }
): {
  summary: {
    totalCoefficients: number;
    changedCoefficients: number;
    guardedCoefficients: number;
    maxDelta: number;
    avgSampleSize: number;
  };
  coefficients: Record<string, ShrinkResult>;
  metadata: typeof metadata & { timestamp: string };
} {
  const changed = Object.values(results).filter(r => Math.abs(r.value - r.prior) > 0.001);
  const guarded = Object.values(results).filter(r => r.isGuarded);
  const maxDelta = Math.max(...Object.values(results).map(r => r.delta));
  const avgSampleSize = Object.values(results).reduce((sum, r) => sum + r.sampleSize, 0) / Object.keys(results).length;
  
  return {
    summary: {
      totalCoefficients: Object.keys(results).length,
      changedCoefficients: changed.length,
      guardedCoefficients: guarded.length,
      maxDelta,
      avgSampleSize: Math.round(avgSampleSize)
    },
    coefficients: results,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * CLI用のテスト関数
 */
export function testShrinkFunctions() {
  console.log('Testing shrink functions...');
  
  // wOBA係数のテスト
  const empiricalWeights = {
    wBB: 0.692,
    wHBP: 0.722,
    w1B: 0.888,
    w2B: 1.271,
    w3B: 1.616,
    wHR: 2.101
  };
  
  const priorWeights = {
    wBB: 0.690,
    wHBP: 0.720,
    w1B: 0.890,
    w2B: 1.270,
    w3B: 1.620,
    wHR: 2.100
  };
  
  const results = shrinkWobaWeights(empiricalWeights, priorWeights, 50000);
  
  console.log('wOBA weight shrink results:');
  for (const [weight, result] of Object.entries(results)) {
    console.log(`${weight}: ${result.prior.toFixed(3)} → ${result.value.toFixed(3)} (δ=${(result.delta*100).toFixed(1)}%, ${result.isGuarded ? 'GUARDED' : 'UPDATED'})`);
  }
  
  const alertCheck = checkAlertConditions(results);
  console.log(`Alerts: ${alertCheck.alerts.length}, Should alert: ${alertCheck.shouldAlert}`);
}

if (require.main === module) {
  testShrinkFunctions();
}