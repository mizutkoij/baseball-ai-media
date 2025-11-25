/**
 * Game Invariants Configuration Management
 * Centralized configuration loading and validation with auto-relaxation
 */

import invariantsConfig from '@/config/invariants.config.json'

export interface InvariantsConfig {
  version: string
  updated: string
  sampling: {
    recentDays: number
    randomHistoric: number
    seed: string
    maxSampleSize: number
  }
  tolerance: {
    R: number
    H: number
    HR: number
    AB: number
    BB: number
    SO: number
    PA: number
    IP_outs: number
    coverage_pct: number
  }
  autoRelaxation: {
    enabled: boolean
    smallSampleThreshold: number
    relaxationFactor: number
    maxRelaxation: number
  }
  exclude: {
    leagues: string[]
    gamePatterns: string[]
    teams: string[]
    specificGames: string[]
  }
  stratifiedSampling: {
    enabled: boolean
    categories: {
      recent: { days: number; fullCoverage: boolean; weight: number }
      historic: { randomCount: number; weight: number }
      edgeCases: {
        highScoring: { minTotalRuns: number; count: number }
        extraInnings: { minInnings: number; count: number }
        weight: number
      }
    }
  }
  additionalInvariants: {
    PA_decomposition: { enabled: boolean; tolerance: number }
    IP_outs_consistency: { enabled: boolean; tolerance: number; extraInningsAllowed: boolean }
    team_box_cross: { enabled: boolean; metrics: string[]; tolerance: number }
    pbp_scoring: { enabled: boolean; tolerance: number }
  }
  temporaryRelaxation: Record<string, { reason: string; multiplier: number; expires: string }>
  reporting: {
    verboseFailures: boolean
    includeContext: boolean
    exportFormat: string
    prComments: boolean
  }
  performance: {
    parallelExecution: boolean
    timeoutMs: number
    maxConcurrency: number
  }
}

/**
 * Get base tolerance for a metric
 */
export function getBaseTolerance(metric: string): number {
  const config = invariantsConfig as InvariantsConfig
  return config.tolerance[metric as keyof typeof config.tolerance] || 2
}

/**
 * Apply auto-relaxation based on sample size
 */
export function getAdjustedTolerance(
  metric: string,
  sampleSize: number,
  year?: number
): number {
  const config = invariantsConfig as InvariantsConfig
  let baseTolerance = getBaseTolerance(metric)
  
  // Apply temporary year-specific relaxation
  if (year && config.temporaryRelaxation[year.toString()]) {
    const yearConfig = config.temporaryRelaxation[year.toString()]
    const expiryDate = new Date(yearConfig.expires)
    if (new Date() < expiryDate) {
      baseTolerance *= yearConfig.multiplier
      console.warn(`Applied temporary relaxation for ${year}: ${yearConfig.reason} (${yearConfig.multiplier}x)`)
    }
  }
  
  // Apply auto-relaxation for small samples
  if (config.autoRelaxation.enabled && sampleSize < config.autoRelaxation.smallSampleThreshold) {
    const relaxationFactor = Math.min(
      config.autoRelaxation.relaxationFactor,
      config.autoRelaxation.maxRelaxation
    )
    const adjustedTolerance = baseTolerance * relaxationFactor
    console.warn(`Auto-relaxed tolerance for ${metric}: ${baseTolerance} → ${adjustedTolerance} (sample size: ${sampleSize})`)
    return Math.round(adjustedTolerance)
  }
  
  return Math.round(baseTolerance)
}

/**
 * Get game exclusion patterns
 */
export function getExclusionPatterns(): {
  leagues: string[]
  gamePatterns: string[]
  teams: string[]
  specificGames: string[]
} {
  const config = invariantsConfig as InvariantsConfig
  return config.exclude
}

/**
 * Build SQL WHERE clause for game exclusions
 */
export function buildExclusionClause(): string {
  const patterns = getExclusionPatterns()
  const clauses: string[] = []
  
  // Exclude game patterns
  patterns.gamePatterns.forEach(pattern => {
    clauses.push(`game_id NOT LIKE '${pattern}'`)
  })
  
  // Exclude specific teams
  patterns.teams.forEach(team => {
    clauses.push(`home_team != '${team}' AND away_team != '${team}'`)
  })
  
  // Exclude specific games
  patterns.specificGames.forEach(gameId => {
    clauses.push(`game_id != '${gameId}'`)
  })
  
  return clauses.length > 0 ? clauses.join(' AND ') : '1=1'
}

/**
 * Get sampling configuration
 */
export function getSamplingConfig() {
  const config = invariantsConfig as InvariantsConfig
  return config.sampling
}

/**
 * Get stratified sampling configuration
 */
export function getStratifiedSamplingConfig() {
  const config = invariantsConfig as InvariantsConfig
  return config.stratifiedSampling
}

/**
 * Check if additional invariant is enabled
 */
export function isInvariantEnabled(invariantName: keyof InvariantsConfig['additionalInvariants']): boolean {
  const config = invariantsConfig as InvariantsConfig
  return config.additionalInvariants[invariantName]?.enabled || false
}

/**
 * Get additional invariant configuration
 */
export function getInvariantConfig<T extends keyof InvariantsConfig['additionalInvariants']>(
  invariantName: T
): InvariantsConfig['additionalInvariants'][T] {
  const config = invariantsConfig as InvariantsConfig
  return config.additionalInvariants[invariantName]
}

/**
 * Get reporting configuration
 */
export function getReportingConfig() {
  const config = invariantsConfig as InvariantsConfig
  return config.reporting
}

/**
 * Generate configuration summary for PR comments
 */
export function getConfigSummary(): string {
  const config = invariantsConfig as InvariantsConfig
  
  return `
## Game Invariant Test Configuration

**Version**: ${config.version} (${config.updated})

**Sampling**: ${config.sampling.recentDays}d recent + ${config.sampling.randomHistoric} historic (max ${config.sampling.maxSampleSize})

**Tolerances**: R±${config.tolerance.R}, H±${config.tolerance.H}, HR±${config.tolerance.HR}, AB±${config.tolerance.AB}, BB±${config.tolerance.BB}, SO±${config.tolerance.SO}

**Auto-Relaxation**: ${config.autoRelaxation.enabled ? 'Enabled' : 'Disabled'} (${config.autoRelaxation.relaxationFactor}x for samples <${config.autoRelaxation.smallSampleThreshold})

**Active Invariants**:
${Object.entries(config.additionalInvariants)
  .filter(([_, cfg]) => cfg.enabled)
  .map(([name, _]) => `- ${name}`)
  .join('\n')}

**Exclusions**: ${config.exclude.gamePatterns.length} patterns, ${config.exclude.teams.length} teams, ${config.exclude.specificGames.length} specific games
`.trim()
}

export default invariantsConfig as InvariantsConfig