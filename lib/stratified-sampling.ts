/**
 * Stratified Sampling for Game Invariant Testing
 * 
 * Implements intelligent sampling across different game categories:
 * - Recent games (recent 7 days) - Full coverage for fresh data
 * - Historic games (random 12) - Representative coverage of past data  
 * - Edge cases (high scoring, extra innings) - Stress test scenarios
 */

import { query } from '@/lib/db'
import { getStratifiedSamplingConfig, buildExclusionClause } from '@/lib/invariants-config'

export interface GameSample {
  game_id: string
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  total_innings?: number
  category: 'recent' | 'historic' | 'high_scoring' | 'extra_innings'
  weight: number
}

export interface StratifiedSampleResult {
  samples: GameSample[]
  summary: {
    recent: number
    historic: number
    highScoring: number
    extraInnings: number
    totalSelected: number
    coverage: {
      recent_pct: number
      edge_case_pct: number
    }
  }
}

/**
 * Generate stratified sample of games for testing
 */
export async function generateStratifiedSample(): Promise<StratifiedSampleResult> {
  const config = getStratifiedSamplingConfig()
  const exclusionClause = buildExclusionClause()
  
  if (!config.enabled) {
    // Fallback to simple recent sampling
    const games = await query<GameSample>(`
      SELECT game_id, home_team, away_team, home_score, away_score,
             'recent' as category, 1.0 as weight
      FROM games 
      WHERE status = 'final' 
      AND game_id LIKE '2024%'
      AND ${exclusionClause}
      ORDER BY game_id DESC 
      LIMIT 20
    `, [], { preferHistory: true })

    return {
      samples: games,
      summary: {
        recent: games.length,
        historic: 0,
        highScoring: 0,
        extraInnings: 0,
        totalSelected: games.length,
        coverage: { recent_pct: 100, edge_case_pct: 0 }
      }
    }
  }

  const samples: GameSample[] = []
  
  // 1. Recent games (last 7 days with full coverage)
  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - config.categories.recent.days)
  const recentDateStr = recentCutoff.toISOString().slice(0, 10).replace(/-/g, '')
  
  const recentGames = await query<GameSample>(`
    SELECT game_id, home_team, away_team, home_score, away_score,
           'recent' as category, ${config.categories.recent.weight} as weight
    FROM games 
    WHERE status = 'final' 
    AND game_id LIKE '2024%'
    AND game_id >= '${recentDateStr}%'
    AND ${exclusionClause}
    ORDER BY game_id DESC
  `, [], { preferHistory: true })

  samples.push(...recentGames)

  // 2. Historic games (random sampling)
  const historicGames = await query<GameSample>(`
    SELECT game_id, home_team, away_team, home_score, away_score,
           'historic' as category, ${config.categories.historic.weight} as weight
    FROM games 
    WHERE status = 'final' 
    AND game_id LIKE '2024%'
    AND game_id < '${recentDateStr}%'
    AND ${exclusionClause}
    ORDER BY RANDOM()
    LIMIT ${config.categories.historic.randomCount}
  `, [], { preferHistory: true })

  samples.push(...historicGames)

  // 3. Edge cases - High scoring games
  const highScoringGames = await query<GameSample>(`
    SELECT game_id, home_team, away_team, home_score, away_score,
           'high_scoring' as category, ${config.categories.edgeCases.weight} as weight
    FROM games 
    WHERE status = 'final' 
    AND game_id LIKE '2024%'
    AND (home_score + away_score) >= ${config.categories.edgeCases.highScoring.minTotalRuns}
    AND ${exclusionClause}
    ORDER BY (home_score + away_score) DESC
    LIMIT ${config.categories.edgeCases.highScoring.count}
  `, [], { preferHistory: true })

  samples.push(...highScoringGames)

  // 4. Edge cases - Extra innings games (approximate detection using high scores as proxy)
  // Note: Without explicit inning column, use very high combined scores as extra innings indicator
  const extraInningsGames = await query<GameSample>(`
    SELECT g.game_id, g.home_team, g.away_team, g.home_score, g.away_score,
           'extra_innings' as category, ${config.categories.edgeCases.weight} as weight
    FROM games g
    WHERE g.status = 'final' 
    AND g.game_id LIKE '2024%'
    AND ${exclusionClause}
    AND (g.home_score + g.away_score) >= 18
    AND (g.home_score + g.away_score) < ${config.categories.edgeCases.highScoring.minTotalRuns}
    ORDER BY (g.home_score + g.away_score) DESC
    LIMIT ${config.categories.edgeCases.extraInnings.count}
  `, [], { preferHistory: true })

  samples.push(...extraInningsGames)

  // Remove duplicates (game might appear in multiple categories)
  const uniqueSamples = samples.reduce((acc, current) => {
    const existing = acc.find(item => item.game_id === current.game_id)
    if (!existing) {
      acc.push(current)
    } else {
      // Prefer higher weight category for duplicates
      if (current.weight > existing.weight) {
        const index = acc.indexOf(existing)
        acc[index] = current
      }
    }
    return acc
  }, [] as GameSample[])

  // Calculate summary statistics
  const summary = {
    recent: uniqueSamples.filter(s => s.category === 'recent').length,
    historic: uniqueSamples.filter(s => s.category === 'historic').length,
    highScoring: uniqueSamples.filter(s => s.category === 'high_scoring').length,
    extraInnings: uniqueSamples.filter(s => s.category === 'extra_innings').length,
    totalSelected: uniqueSamples.length,
    coverage: {
      recent_pct: (uniqueSamples.filter(s => s.category === 'recent').length / Math.max(uniqueSamples.length, 1)) * 100,
      edge_case_pct: (uniqueSamples.filter(s => s.category === 'high_scoring' || s.category === 'extra_innings').length / Math.max(uniqueSamples.length, 1)) * 100
    }
  }

  return {
    samples: uniqueSamples.sort((a, b) => b.game_id.localeCompare(a.game_id)), // Sort by game_id desc
    summary
  }
}

/**
 * Get weighted sample for specific testing needs
 */
export function getWeightedSample(result: StratifiedSampleResult, maxSize: number = 25): GameSample[] {
  const { samples } = result
  
  if (samples.length <= maxSize) {
    return samples
  }
  
  // Apply weighted sampling to reduce to maxSize
  const sorted = samples.sort((a, b) => b.weight - a.weight) // Higher weight first
  
  // Ensure minimum representation from each category
  const selected: GameSample[] = []
  const categories = ['recent', 'historic', 'high_scoring', 'extra_innings'] as const
  
  // Take at least 1 from each category if available
  categories.forEach(category => {
    const categoryGames = sorted.filter(g => g.category === category && !selected.includes(g))
    if (categoryGames.length > 0 && selected.length < maxSize) {
      selected.push(categoryGames[0])
    }
  })
  
  // Fill remaining slots with highest weighted games
  const remaining = sorted.filter(g => !selected.includes(g))
  const slotsLeft = maxSize - selected.length
  selected.push(...remaining.slice(0, slotsLeft))
  
  return selected.sort((a, b) => b.game_id.localeCompare(a.game_id))
}

/**
 * Generate sampling report for debugging/monitoring
 */
export function generateSamplingReport(result: StratifiedSampleResult): string {
  const { summary } = result
  
  return `
## Stratified Sampling Report

**Total Games Selected**: ${summary.totalSelected}

**Category Distribution**:
- Recent (${summary.recent}): Last 7 days coverage
- Historic (${summary.historic}): Random sampling from past data
- High Scoring (${summary.highScoring}): Edge case validation
- Extra Innings (${summary.extraInnings}): Extended game scenarios

**Coverage Analysis**:
- Recent Coverage: ${summary.coverage.recent_pct.toFixed(1)}%
- Edge Case Coverage: ${summary.coverage.edge_case_pct.toFixed(1)}%

**Sample Quality**: ${summary.totalSelected >= 15 ? '✅ Adequate' : '⚠️ Limited'} 
(${summary.totalSelected >= 20 ? 'Excellent' : summary.totalSelected >= 15 ? 'Good' : 'Needs improvement'} sample size)
  `.trim()
}

export default generateStratifiedSample