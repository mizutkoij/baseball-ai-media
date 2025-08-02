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
    relaxPct = 0.10,
    pfMode = 'either'
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
      pfMode
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
 * Create detailed failure explanation
 */
export function explainFailure(
  metric: string,
  playerId: string,
  year: number,
  result: ValidationResult,
  value: number
): string {
  const context = result.context || {}
  
  return JSON.stringify({
    metric,
    playerId,
    year,
    value,
    expected: context.originalRange,
    usedRange: context.adjustedRange,
    sampleSize: context.sampleSize,
    needRelax: result.needRelax,
    explanation: result.explanation,
    pfMode: context.pfMode,
    availableYears: getAvailableYears()
  }, null, 2)
}