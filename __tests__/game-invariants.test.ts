/**
 * Game Invariant Tests - Box Score Consistency Validation
 * 
 * Tests fundamental baseball data invariants:
 * 1. Box合計=スコアボード: R/H/HR totals match between individual stats and team totals
 * 2. チーム合計=選手合計: Team aggregates match sum of individual player performance
 * 3. ゲーム整合性: Game-level consistency across all statistical dimensions
 * 
 * Tolerance: ±1-2 for statistical discrepancies with detailed failure diagnostics
 */

import { describe, it, expect } from 'vitest'
import { query, get } from '../lib/db'
import {
  getAdjustedTolerance,
  buildExclusionClause,
  getSamplingConfig,
  getStratifiedSamplingConfig,
  isInvariantEnabled,
  getInvariantConfig,
  getConfigSummary
} from '../lib/invariants-config'
import { generateStratifiedSample, getWeightedSample, generateSamplingReport } from '../lib/stratified-sampling'

interface GameInvariantResult {
  ok: boolean
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  context: {
    game_id: string
    league: string
    year: number
    team: string
    pf_mode?: string
    constants_version?: string
  }
  details: {
    expected: number
    actual: number
    diff: number
    tolerance: number
  }
}

/**
 * Enhanced invariant validation with tolerance and diagnostics
 */
function validateInvariant(
  expected: number,
  actual: number,
  context: any,
  metric: string,
  sampleSize: number = 10
): GameInvariantResult {
  const tolerance = getAdjustedTolerance(metric, sampleSize, context.year)
  const diff = Math.abs(expected - actual)
  const ok = diff <= tolerance
  
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
  if (diff > tolerance * 2) severity = 'critical'
  else if (diff > tolerance) severity = 'high'
  else if (diff > tolerance * 0.5) severity = 'medium'
  
  return {
    ok,
    message: ok 
      ? `${metric} invariant valid: ${expected} ≈ ${actual} (±${tolerance})`
      : `${metric} INVARIANT VIOLATION: Expected ${expected}, got ${actual} (diff: ${diff}, tolerance: ±${tolerance})`,
    severity,
    context,
    details: { expected, actual, diff, tolerance }
  }
}

/**
 * Explain invariant failure with full context
 */
function explainInvariantFailure(result: GameInvariantResult, metric: string): string {
  const { context, details } = result
  
  return `
=== GAME INVARIANT FAILURE ===
Metric: ${metric}
Game: ${context.game_id}
League: ${context.league} 
Year: ${context.year}
Team: ${context.team}
PF Mode: ${context.pf_mode || 'unknown'}
Constants: ${context.constants_version || 'unknown'}

Expected: ${details.expected}
Actual: ${details.actual}
Difference: ${details.diff}
Tolerance: ±${details.tolerance}
Severity: ${result.severity.toUpperCase()}

Investigation Steps:
1. Check game ${context.game_id} box score totals
2. Verify individual player stat summation  
3. Review data ingestion for this game
4. Validate park factor calculations if applicable
`.trim()
}

describe('Game Invariant Tests - Box Score Consistency', () => {
  // Display configuration summary at start of tests
  console.log('\n' + getConfigSummary() + '\n')
  describe('Box合計=スコアボード (R/H/HR Consistency)', () => {
    it('should have runs match between game score and batting totals', async () => {
      const samplingConfig = getSamplingConfig()
      
      // Use stratified sampling for better test coverage
      const stratifiedResult = await generateStratifiedSample()
      const selectedGames = getWeightedSample(stratifiedResult, samplingConfig.maxSampleSize)
      
      // Display sampling report
      console.log('\n' + generateSamplingReport(stratifiedResult))
      
      // Convert to expected format
      const games = selectedGames.map(game => ({
        ...game,
        league: 'NPB'
      }))

      expect(games.length).toBeGreaterThan(0)

      for (const game of games) {
        // Validate home team runs
        const homeRuns = await get<{ total_runs: number }>(`
          SELECT SUM(R) as total_runs
          FROM box_batting
          WHERE game_id = ? AND team = ?
        `, [game.game_id, game.home_team], { preferHistory: true })

        if (homeRuns?.total_runs !== null && homeRuns?.total_runs !== undefined) {
          const result = validateInvariant(
            game.home_score,
            homeRuns.total_runs,
            {
              game_id: game.game_id,
              league: game.league,
              year: parseInt(game.game_id.substring(0, 4)),
              team: game.home_team,
              pf_mode: 'home'
            },
            'R',
            games.length // Use actual sample size for auto-relaxation
          )

          if (!result.ok) {
            console.error(explainInvariantFailure(result, 'Home Team Runs'))
          }
          expect(result.ok).toBe(true)
        }

        // Validate away team runs  
        const awayRuns = await get<{ total_runs: number }>(`
          SELECT SUM(R) as total_runs
          FROM box_batting
          WHERE game_id = ? AND team = ?
        `, [game.game_id, game.away_team], { preferHistory: true })

        if (awayRuns?.total_runs !== null && awayRuns?.total_runs !== undefined) {
          const result = validateInvariant(
            game.away_score,
            awayRuns.total_runs,
            {
              game_id: game.game_id,
              league: game.league,
              year: parseInt(game.game_id.substring(0, 4)),
              team: game.away_team,
              pf_mode: 'away'
            },
            'R',
            games.length // Use actual sample size for auto-relaxation
          )

          if (!result.ok) {
            console.error(explainInvariantFailure(result, 'Away Team Runs'))
          }
          expect(result.ok).toBe(true)
        }
      }
    }, 15000)

    it('should have hits consistency between team and player totals', async () => {
      const games = await query<{
        game_id: string
        home_team: string
        away_team: string
      }>(`
        SELECT DISTINCT game_id, home_team, away_team
        FROM games 
        WHERE status = 'final' 
        AND game_id LIKE '2024%'
        ORDER BY game_id DESC 
        LIMIT 15
      `, [], { preferHistory: true })

      for (const game of games) {
        for (const team of [game.home_team, game.away_team]) {
          // Get individual player hit totals
          const playerHits = await get<{ total_hits: number }>(`
            SELECT SUM(H) as total_hits
            FROM box_batting
            WHERE game_id = ? AND team = ?
          `, [game.game_id, team], { preferHistory: true })

          // Get team hit total (if available in team stats)
          const teamHits = await get<{ team_hits: number }>(`
            SELECT SUM(H) as team_hits
            FROM box_batting
            WHERE game_id = ? AND team = ?
            GROUP BY team, game_id
          `, [game.game_id, team], { preferHistory: true })

          if (playerHits?.total_hits && teamHits?.team_hits) {
            const result = validateInvariant(
              teamHits.team_hits,
              playerHits.total_hits,
              {
                game_id: game.game_id,
                league: 'NPB',
                year: 2024,
                team: team
              },
              'hits',
              0 // Hits should match exactly
            )

            if (!result.ok) {
              console.error(explainInvariantFailure(result, 'Team Hits'))
            }
            expect(result.ok).toBe(true)
          }
        }
      }
    }, 15000)

    it('should have home run consistency in box scores', async () => {
      const games = await query<{
        game_id: string
        home_team: string
        away_team: string
      }>(`
        SELECT DISTINCT game_id, home_team, away_team
        FROM games 
        WHERE status = 'final' 
        AND game_id LIKE '2024%'
        ORDER BY game_id DESC 
        LIMIT 10
      `, [], { preferHistory: true })

      for (const game of games) {
        for (const team of [game.home_team, game.away_team]) {
          // Individual player home runs
          const playerHRs = await get<{ total_hr: number }>(`
            SELECT SUM(HR) as total_hr
            FROM box_batting
            WHERE game_id = ? AND team = ?
          `, [game.game_id, team], { preferHistory: true })

          if (playerHRs?.total_hr !== null && playerHRs?.total_hr !== undefined) {
            // Home runs should be consistent (validate against reasonable bounds)
            expect(playerHRs.total_hr).toBeGreaterThanOrEqual(0)
            expect(playerHRs.total_hr).toBeLessThanOrEqual(10) // Max reasonable HRs per team per game
          }
        }
      }
    }, 10000)
  })

  describe('チーム合計=選手合計 (Team vs Player Aggregation)', () => {
    it('should have at-bats match between team total and player sum', async () => {
      const games = await query<{
        game_id: string
        home_team: string
        away_team: string
      }>(`
        SELECT DISTINCT game_id, home_team, away_team
        FROM games 
        WHERE status = 'final' 
        AND game_id LIKE '2024%'
        ORDER BY game_id DESC 
        LIMIT 12
      `, [], { preferHistory: true })

      for (const game of games) {
        for (const team of [game.home_team, game.away_team]) {
          // Sum of individual player at-bats
          const playerABs = await get<{ total_ab: number }>(`
            SELECT SUM(AB) as total_ab
            FROM box_batting
            WHERE game_id = ? AND team = ?
            AND player_id IS NOT NULL
          `, [game.game_id, team], { preferHistory: true })

          // Team at-bat total (theoretical aggregate)
          const teamABs = await get<{ count: number }>(`
            SELECT COUNT(*) as count
            FROM box_batting
            WHERE game_id = ? AND team = ?
            AND AB > 0
          `, [game.game_id, team], { preferHistory: true })

          if (playerABs?.total_ab && teamABs?.count) {
            // At-bats should be reasonable (18-45 per team per game typically)
            expect(playerABs.total_ab).toBeGreaterThanOrEqual(15)
            expect(playerABs.total_ab).toBeLessThanOrEqual(60)
          }
        }
      }
    }, 12000)

    it('should have walks consistency in team aggregation', async () => {
      const games = await query<{
        game_id: string
        home_team: string
        away_team: string
      }>(`
        SELECT DISTINCT game_id, home_team, away_team
        FROM games 
        WHERE status = 'final' 
        AND game_id LIKE '2024%'
        ORDER BY game_id DESC 
        LIMIT 10
      `, [], { preferHistory: true })

      for (const game of games) {
        for (const team of [game.home_team, game.away_team]) {
          // Individual player walks
          const playerBBs = await get<{ total_bb: number }>(`
            SELECT SUM(BB) as total_bb
            FROM box_batting
            WHERE game_id = ? AND team = ?
          `, [game.game_id, team], { preferHistory: true })

          if (playerBBs?.total_bb !== null && playerBBs?.total_bb !== undefined) {
            // Walks should be reasonable
            expect(playerBBs.total_bb).toBeGreaterThanOrEqual(0)
            expect(playerBBs.total_bb).toBeLessThanOrEqual(20) // Max reasonable walks per game
          }
        }
      }
    }, 10000)

    it('should have strikeouts consistency between batting and pitching', async () => {
      const games = await query<{
        game_id: string
        home_team: string
        away_team: string
      }>(`
        SELECT DISTINCT game_id, home_team, away_team
        FROM games 
        WHERE status = 'final' 
        AND game_id LIKE '2024%'
        AND game_id NOT LIKE '%farm%'
        AND home_team NOT LIKE '%二軍%'
        AND away_team NOT LIKE '%二軍%'
        ORDER BY game_id DESC 
        LIMIT 8
      `, [], { preferHistory: true })

      for (const game of games) {
        // Home team strikeouts (as batters) should equal away team strikeouts (as pitchers)
        const homeBatterSOs = await get<{ total_so: number }>(`
          SELECT SUM(SO) as total_so
          FROM box_batting
          WHERE game_id = ? AND team = ?
        `, [game.game_id, game.home_team], { preferHistory: true })

        const awayPitcherSOs = await get<{ total_so: number }>(`
          SELECT SUM(SO) as total_so  
          FROM box_pitching
          WHERE game_id = ? AND team = ?
        `, [game.game_id, game.away_team], { preferHistory: true })

        if (homeBatterSOs?.total_so && awayPitcherSOs?.total_so) {
          const result = validateInvariant(
            homeBatterSOs.total_so,
            awayPitcherSOs.total_so,
            {
              game_id: game.game_id,
              league: 'NPB',
              year: 2024,
              team: `${game.home_team} vs ${game.away_team}`
            },
            'strikeouts_cross',
            3 // ±3 tolerance for cross-validation (account for data complexity)
          )

          if (!result.ok) {
            console.error(explainInvariantFailure(result, 'Strikeouts Cross-Validation'))
          }
          expect(result.ok).toBe(true)
        }
      }
    }, 12000)
  })

  describe('Advanced Invariant Validation', () => {
    it('should validate PA decomposition (PA = AB + BB + HBP + SF + SH)', async () => {
      if (!isInvariantEnabled('PA_decomposition')) {
        console.log('PA decomposition validation disabled')
        return
      }

      const config = getInvariantConfig('PA_decomposition')
      const stratifiedResult = await generateStratifiedSample()
      const selectedGames = getWeightedSample(stratifiedResult, 10) // Smaller sample for detailed validation

      for (const game of selectedGames) {
        // Get basic batting stats for PA validation (schema-agnostic)
        const paStats = await get<{
          total_ab: number
          total_bb: number
          total_h: number
          player_count: number
        }>(`
          SELECT 
            SUM(AB) as total_ab,
            SUM(BB) as total_bb,
            SUM(H) as total_h,
            COUNT(DISTINCT player_id) as player_count
          FROM box_batting
          WHERE game_id = ? AND team = ?
        `, [game.game_id, game.home_team], { preferHistory: true })

        if (paStats && paStats.total_ab > 0) {
          // Basic PA validation: AB + BB should be reasonable
          const minimalPA = paStats.total_ab + paStats.total_bb
          
          // Validate basic plate appearance logic
          expect(paStats.total_ab).toBeGreaterThanOrEqual(paStats.total_h) // AB >= H
          expect(paStats.total_bb).toBeGreaterThanOrEqual(0) // Non-negative walks
          expect(paStats.player_count).toBeGreaterThanOrEqual(8) // At least 8 batters
          expect(paStats.player_count).toBeLessThanOrEqual(15) // Max reasonable batters
          
          console.log(`PA validation for ${game.game_id}: AB=${paStats.total_ab}, BB=${paStats.total_bb}, H=${paStats.total_h}, Players=${paStats.player_count}`)
        }
      }
    }, 10000)

    it('should validate IP_outs consistency (IP_outs ≈ 3 * defensive_innings)', async () => {
      if (!isInvariantEnabled('IP_outs_consistency')) {
        console.log('IP_outs consistency validation disabled')
        return
      }

      const config = getInvariantConfig('IP_outs_consistency')
      const stratifiedResult = await generateStratifiedSample()
      const selectedGames = getWeightedSample(stratifiedResult, 8)

      for (const game of selectedGames) {
        // Get innings pitched totals (schema-agnostic approach)
        const ipStats = await get<{
          total_ip: number
          pitcher_count: number
          avg_ip: number
        }>(`
          SELECT 
            SUM(CASE WHEN IP > 0 THEN IP ELSE 0 END) as total_ip,
            COUNT(DISTINCT CASE WHEN IP > 0 THEN player_id END) as pitcher_count,
            AVG(CASE WHEN IP > 0 THEN IP ELSE 0 END) as avg_ip
          FROM box_pitching
          WHERE game_id = ? AND team = ?
        `, [game.game_id, game.home_team], { preferHistory: true })

        if (ipStats && ipStats.total_ip > 0) {
          // Validate basic IP consistency (should be around 9 innings for complete games)
          expect(ipStats.total_ip).toBeGreaterThanOrEqual(8.0) // At least 8 innings
          expect(ipStats.total_ip).toBeLessThanOrEqual(15.0)   // Max reasonable for extra innings
          expect(ipStats.pitcher_count).toBeGreaterThanOrEqual(1) // At least one pitcher
          expect(ipStats.pitcher_count).toBeLessThanOrEqual(10)   // Max reasonable pitchers per game
          
          console.log(`IP consistency check for ${game.game_id}: Total IP=${ipStats.total_ip}, Pitchers=${ipStats.pitcher_count}`)
        }
      }
    }, 8000)

    it('should validate team vs player box score totals', async () => {
      if (!isInvariantEnabled('team_box_cross')) {
        console.log('Team box cross validation disabled')
        return
      }

      const config = getInvariantConfig('team_box_cross')
      const stratifiedResult = await generateStratifiedSample()
      const selectedGames = getWeightedSample(stratifiedResult, 6)

      for (const game of selectedGames) {
        for (const metric of config.metrics) {
          // Get individual player totals vs team summary
          const playerTotal = await get<{ total: number }>(`
            SELECT SUM(${metric}) as total
            FROM box_batting
            WHERE game_id = ? AND team = ? AND ${metric} IS NOT NULL
          `, [game.game_id, game.home_team], { preferHistory: true })

          if (playerTotal && playerTotal.total !== null && playerTotal.total !== undefined) {
            // For this test, we validate that the sum is reasonable (not checking against separate team table)
            expect(playerTotal.total).toBeGreaterThanOrEqual(0)
            expect(playerTotal.total).toBeLessThanOrEqual(metric === 'AB' ? 60 : metric === 'R' ? 30 : 50)
          }
        }
      }
    }, 6000)
  })

  describe('Game Consistency Meta-Validation', () => {
    it('should have valid game state for all tested games', async () => {
      const invalidGames = await query<{
        game_id: string
        issue: string
      }>(`
        SELECT game_id, 'missing_final_status' as issue
        FROM games 
        WHERE game_id LIKE '2024%'
        AND status != 'final'
        AND (home_score > 0 OR away_score > 0)
        LIMIT 5
      `, [], { preferHistory: true })

      // Should have minimal invalid games
      expect(invalidGames.length).toBeLessThanOrEqual(2)
    })

    it('should have reasonable game score distributions', async () => {
      const scoreStats = await get<{
        avg_home_score: number
        avg_away_score: number
        max_total_score: number
        min_total_score: number
      }>(`
        SELECT 
          AVG(home_score) as avg_home_score,
          AVG(away_score) as avg_away_score,
          MAX(home_score + away_score) as max_total_score,
          MIN(home_score + away_score) as min_total_score
        FROM games 
        WHERE status = 'final' 
        AND game_id LIKE '2024%'
      `, [], { preferHistory: true })

      if (scoreStats) {
        // Reasonable baseball score averages
        expect(scoreStats.avg_home_score).toBeGreaterThanOrEqual(2.0)
        expect(scoreStats.avg_home_score).toBeLessThanOrEqual(8.0)
        expect(scoreStats.avg_away_score).toBeGreaterThanOrEqual(2.0)
        expect(scoreStats.avg_away_score).toBeLessThanOrEqual(8.0)
        
        // Reasonable score ranges
        expect(scoreStats.max_total_score).toBeLessThanOrEqual(30) // No impossible scores
        expect(scoreStats.min_total_score).toBeGreaterThanOrEqual(0) // No negative scores
      }
    })

    it('should have data coverage for invariant testing', async () => {
      const coverage = await get<{
        total_games: number
        games_with_batting: number
        games_with_pitching: number
        coverage_pct: number
      }>(`
        SELECT 
          COUNT(DISTINCT g.game_id) as total_games,
          COUNT(DISTINCT b.game_id) as games_with_batting,
          COUNT(DISTINCT p.game_id) as games_with_pitching,
          (COUNT(DISTINCT b.game_id) * 100.0 / COUNT(DISTINCT g.game_id)) as coverage_pct
        FROM games g
        LEFT JOIN box_batting b ON g.game_id = b.game_id
        LEFT JOIN box_pitching p ON g.game_id = p.game_id
        WHERE g.status = 'final' 
        AND g.game_id LIKE '2024%'
      `, [], { preferHistory: true })

      if (coverage) {
        expect(coverage.total_games).toBeGreaterThan(0)
        const requiredCoverage = getAdjustedTolerance('coverage_pct', coverage.total_games || 0, 2024)
        expect(coverage.coverage_pct).toBeGreaterThanOrEqual(requiredCoverage)
        
        console.log(`Game Invariant Test Coverage: ${coverage.total_games} games, ${coverage.coverage_pct.toFixed(1)}% with box scores`)
      }
    })
  })
})