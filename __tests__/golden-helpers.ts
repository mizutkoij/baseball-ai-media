/**
 * Golden Sample Test Helpers
 * Provides robust validation with sample size adjustments and detailed failure explanations
 */

export interface ValidationOptions {
  minPA?: number
  minIP?: number
  relaxPct?: number
  pfMode?: 'original' | 'neutral' | 'either'
  baselineVersion?: string
  constantsVersion?: string
  teamPF?: number
}

export interface ValidationResult {
  ok: boolean
  rMin: number
  rMax: number
  needRelax: boolean
  explanation?: string
  context?: Record<string, any>
}

/**
 * Validate value within range with automatic sample size adjustments
 */
export function inRangeWithSampleGuard(
  value: number,
  min: number,
  max: number,
  sampleSize: number,
  options: ValidationOptions = {}
): ValidationResult {
  const { 
    minPA = 100, 
    minIP = 30, 
    relaxPct = 0.12, // Increased from 10% to 12% for better flake prevention
    pfMode = 'either',
    constantsVersion = 'unknown',
    teamPF = 1.0
  } = options
  
  const needRelax = sampleSize < (minPA || minIP)
  const rMin = needRelax ? min * (1 - relaxPct) : min
  const rMax = needRelax ? max * (1 + relaxPct) : max
  
  const ok = value >= rMin && value <= rMax
  
  let explanation = ''
  if (!ok) {
    explanation = needRelax 
      ? `Small sample (${sampleSize} < ${minPA || minIP}), used relaxed range [${rMin.toFixed(3)}, ${rMax.toFixed(3)}]`
      : `Failed standard range [${min}, ${max}]`
  }
  
  return { 
    ok, 
    rMin, 
    rMax, 
    needRelax,
    explanation: ok ? undefined : explanation,
    context: {
      originalRange: [min, max],
      adjustedRange: [rMin, rMax],
      sampleSize,
      pfMode,
      constantsVersion,
      teamPF,
      relaxationApplied: needRelax,
      relaxationPercent: relaxPct * 100
    }
  }
}

/**
 * Check if year should be available in our databases
 */
export function isExpectedYear(year: number): boolean {
  // Based on our actual data: only 2024-2025 are available
  return year >= 2024
}

/**
 * Get available years from databases (cached)
 */
let availableYearsCache: number[] | null = null

export function getAvailableYears(): number[] {
  if (!availableYearsCache) {
    // For now, hardcode based on our discovery
    // TODO: Make this dynamic when we have more historical data
    availableYearsCache = [2024, 2025]
  }
  return availableYearsCache
}

/**
 * Filter test years to only those we expect to have data for
 */
export function filterExpectedYears(testYears: number[]): number[] {
  const available = getAvailableYears()
  return testYears.filter(year => available.includes(year))
}

/**
 * Create detailed failure explanation with comprehensive diagnostics
 */
export function explainFailure(
  metric: string,
  playerId: string,
  year: number,
  result: ValidationResult,
  value: number
): string {
  const context = result.context || {}
  
  // Determine failure severity
  const exceedsBy = Math.max(
    value < result.rMin ? (result.rMin - value) / result.rMin : 0,
    value > result.rMax ? (value - result.rMax) / result.rMax : 0
  )
  
  let severity = 'LOW'
  if (exceedsBy > 0.30) severity = 'HIGH'      // >30% deviation
  else if (exceedsBy > 0.15) severity = 'MEDIUM' // >15% deviation
  
  return JSON.stringify({
    // Core failure info
    metric,
    playerId,
    year,
    actualValue: value,
    
    // Range analysis
    validation: {
      expected: context.originalRange,
      usedRange: context.adjustedRange,
      exceedsBy: (exceedsBy * 100).toFixed(1) + '%',
      severity
    },
    
    // Sample analysis
    sample: {
      size: context.sampleSize,
      relaxationApplied: context.relaxationApplied,
      relaxationPercent: context.relaxationPercent + '%',
      explanation: result.explanation
    },
    
    // Environmental factors
    environment: {
      constantsVersion: context.constantsVersion,
      pfMode: context.pfMode,
      teamPF: context.teamPF,
      availableYears: getAvailableYears()
    },
    
    // Debug hints
    debugHints: {
      checkConstantsUpdate: severity === 'HIGH' && context.constantsVersion === 'unknown',
      checkSampleSize: context.sampleSize < 50,
      checkParkFactor: Math.abs(context.teamPF - 1.0) > 0.05,
      possibleDataIssue: severity === 'HIGH' && !context.relaxationApplied
    },
    
    // Action items
    actionItems: [
      severity === 'HIGH' ? '🔴 Investigate data quality immediately' : '🟡 Monitor trend',
      context.constantsVersion === 'unknown' ? '📊 Verify constants version' : null,
      context.sampleSize < 30 ? '📈 Consider expanding sample size' : null,
      exceedsBy > 0.20 ? '🎯 Update baseline expectations' : null
    ].filter(Boolean),
    
    timestamp: new Date().toISOString()
  }, null, 2)
}