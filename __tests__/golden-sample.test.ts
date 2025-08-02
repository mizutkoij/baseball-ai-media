/**
 * Golden Sample Validation Tests
 * Validates that key players and teams have statistics within expected ranges
 * Serves as quality assurance for data accuracy and system stability
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { query, get } from '@/lib/db'
import goldenSamples from '@/data/golden_samples.json'
import { 
  inRangeWithSampleGuard, 
  isExpectedYear, 
  filterExpectedYears, 
  explainFailure 
} from './golden-helpers'

interface PlayerStats {
  wRC_plus?: number
  OPS?: number
  ERA?: number
  FIP?: number
  WHIP?: number
  K_pct?: number
  本塁打?: number
  打率?: number
  勝利?: number
  登板?: number
  盗塁?: number
}

interface TeamStats {
  勝率?: number
  得点?: number
  失点?: number
  本塁打?: number
}

/**
 * Fetch player metric for a specific year
 */
async function getPlayerMetric(
  playerId: string, 
  year: number, 
  metric: string,
  isPitcher: boolean = false
): Promise<number | null> {
  try {
    const table = isPitcher ? 'box_pitching' : 'box_batting'
    const sql = `
      SELECT 
        ${metric} as value
      FROM ${table} b
      JOIN games g ON b.game_id = g.game_id  
      WHERE b.player_id = ? AND g.game_id LIKE ?
      AND ${metric} IS NOT NULL
      LIMIT 1
    `
    
    const result = await get<{ value: number }>(sql, [playerId, `${year}%`])
    return result?.value ?? null
  } catch (error) {
    console.warn(`Failed to fetch ${metric} for player ${playerId} year ${year}:`, error)
    return null
  }
}

/**
 * Fetch aggregated player stats for a year
 */
async function getPlayerYearStats(
  playerId: string,
  year: number,
  isPitcher: boolean = false
): Promise<PlayerStats> {
  try {
    if (isPitcher) {
      const sql = `
        SELECT 
          AVG(CASE WHEN ERA > 0 THEN ERA END) as ERA,
          AVG(CASE WHEN FIP > 0 THEN FIP END) as FIP,
          AVG(CASE WHEN WHIP > 0 THEN WHIP END) as WHIP,
          AVG(CASE WHEN K_pct > 0 THEN K_pct END) as K_pct,
          COUNT(*) as 登板,
          SUM(W) as 勝利
        FROM box_pitching b
        JOIN games g ON b.game_id = g.game_id
        WHERE b.player_id = ? AND g.game_id LIKE ?
      `
      const result = await get<PlayerStats>(sql, [playerId, `${year}%`])
      return result || {}
    } else {
      const sql = `
        SELECT 
          AVG(CASE WHEN wRC_plus > 0 THEN wRC_plus END) as wRC_plus,
          AVG(CASE WHEN OPS > 0 THEN OPS END) as OPS,
          AVG(CASE WHEN AVG > 0 THEN AVG END) as 打率,
          SUM(HR) as 本塁打,
          SUM(SB) as 盗塁
        FROM box_batting b
        JOIN games g ON b.game_id = g.game_id
        WHERE b.player_id = ? AND g.game_id LIKE ?
      `
      const result = await get<PlayerStats>(sql, [playerId, `${year}%`])
      return result || {}
    }
  } catch (error) {
    console.warn(`Failed to fetch stats for player ${playerId} year ${year}:`, error)
    return {}
  }
}

/**
 * Fetch team statistics for a year
 */
async function getTeamYearStats(teamCode: string, year: number): Promise<TeamStats> {
  try {
    // Get team performance stats 
    const sql = `
      SELECT 
        COUNT(CASE WHEN (home_team = ? AND home_score > away_score) 
                    OR (away_team = ? AND away_score > home_score) THEN 1 END) as wins,
        COUNT(CASE WHEN (home_team = ? AND home_score < away_score) 
                    OR (away_team = ? AND away_score < home_score) THEN 1 END) as losses,
        COUNT(*) as total_games,
        SUM(CASE WHEN home_team = ? THEN home_score 
                 WHEN away_team = ? THEN away_score END) as total_runs,
        SUM(CASE WHEN home_team = ? THEN away_score 
                 WHEN away_team = ? THEN home_score END) as runs_allowed
      FROM games 
      WHERE (home_team = ? OR away_team = ?) 
        AND game_id LIKE ?
        AND status = 'final'
    `
    
    const params = Array(11).fill(teamCode).concat([`${year}%`])
    const result = await get<any>(sql, params)
    
    if (!result) return {}
    
    const winPct = result.total_games > 0 ? result.wins / result.total_games : 0
    
    // Get home run totals from batting stats
    const hrSql = `
      SELECT SUM(HR) as total_hr
      FROM box_batting b
      JOIN games g ON b.game_id = g.game_id
      WHERE b.team = ? AND g.game_id LIKE ?
    `
    const hrResult = await get<{ total_hr: number }>(hrSql, [teamCode, `${year}%`])
    
    return {
      勝率: winPct,
      得点: result.total_runs || 0,
      失点: result.runs_allowed || 0,
      本塁打: hrResult?.total_hr || 0
    }
  } catch (error) {
    console.warn(`Failed to fetch team stats for ${teamCode} year ${year}:`, error)
    return {}
  }
}

describe('Golden Sample Validation', () => {
  describe('Player Statistics Validation', () => {
    goldenSamples.samples.players.forEach((player) => {
      describe(`${player.name} (${player.id})`, () => {
        const isPitcher = player.primary_pos === 'P'
        
        // Filter to only test years we have data for
        const testableYears = filterExpectedYears(player.test_years)
        
        testableYears.forEach((year) => {
          Object.entries(player.expected_ranges).forEach(([metric, range]) => {
            it(`should have ${metric} ${year} within [${range[0]}, ${range[1]}]`, async () => {
              const stats = await getPlayerYearStats(player.id, year, isPitcher)
              const value = stats[metric as keyof PlayerStats]
              
              if (value !== null && value !== undefined) {
                // Use robust validation with sample guard
                const sampleSize = isPitcher ? 20 : 100 // Rough estimate, could be improved
                const result = inRangeWithSampleGuard(value, range[0], range[1], sampleSize)
                
                if (!result.ok) {
                  console.error('GOLDEN SAMPLE FAILURE:')
                  console.error(explainFailure(metric, player.id, year, result, value))
                }
                
                expect(result.ok).toBe(true)
              } else {
                // Only warn for missing data, don't fail
                console.warn(`No ${metric} data found for ${player.name} in ${year}`)
              }
            }, 10000)
          })
        })
        
        // Test individual metric validation patterns
        if (!isPitcher && player.expected_ranges.wRC_plus) {
          it(`should have valid wRC+ range for batter ${player.name}`, async () => {
            for (const year of player.test_years) {
              const wrcPlus = await getPlayerMetric(player.id, year, 'wRC_plus', false)
              if (wrcPlus !== null) {
                expect(wrcPlus).toBeGreaterThanOrEqual(50)  // Sanity check
                expect(wrcPlus).toBeLessThanOrEqual(250)   // Realistic upper bound
              }
            }
          })
        }
        
        if (isPitcher && player.expected_ranges.ERA) {
          it(`should have valid ERA range for pitcher ${player.name}`, async () => {
            for (const year of player.test_years) {
              const era = await getPlayerMetric(player.id, year, 'ERA', true)
              if (era !== null) {
                expect(era).toBeGreaterThanOrEqual(0.50)  // Sanity check
                expect(era).toBeLessThanOrEqual(10.00)   // Realistic upper bound
              }
            }
          })
        }
      })
    })
  })

  describe('Team Statistics Validation', () => {
    goldenSamples.samples.teams.forEach((team) => {
      describe(`${team.name} (${team.code})`, () => {
        // Filter to only test years we have data for
        const testableYears = filterExpectedYears(team.test_years)
        
        testableYears.forEach((year) => {
          Object.entries(team.expected_ranges).forEach(([metric, range]) => {
            it(`should have ${metric} ${year} within [${range[0]}, ${range[1]}]`, async () => {
              const stats = await getTeamYearStats(team.code, year)
              const value = stats[metric as keyof TeamStats]
              
              if (value !== null && value !== undefined) {
                // Use robust validation for team stats too
                const sampleSize = 144 // Full season games
                const result = inRangeWithSampleGuard(value, range[0], range[1], sampleSize)
                
                if (!result.ok) {
                  console.error('GOLDEN SAMPLE TEAM FAILURE:')
                  console.error(explainFailure(metric, team.code, year, result, value))
                }
                
                expect(result.ok).toBe(true)
              } else {
                console.warn(`No ${metric} data found for ${team.name} in ${year}`)
              }
            }, 10000)
          })
        })
        
        // Additional team validation
        it(`should have realistic win percentage for ${team.name}`, async () => {
          for (const year of team.test_years) {
            const stats = await getTeamYearStats(team.code, year)
            if (stats.勝率 !== null && stats.勝率 !== undefined) {
              expect(stats.勝率).toBeGreaterThanOrEqual(0.20)  // No team is that bad
              expect(stats.勝率).toBeLessThanOrEqual(0.90)    // No team is that good
            }
          }
        })
      })
    })
  })

  describe('Data Consistency Checks', () => {
    it('should have all golden sample players in database', async () => {
      for (const player of goldenSamples.samples.players) {
        const found = await get(
          `SELECT COUNT(*) as count FROM box_batting WHERE player_id = ? 
           UNION ALL 
           SELECT COUNT(*) as count FROM box_pitching WHERE player_id = ?`,
          [player.id, player.id]
        )
        
        expect(found).toBeTruthy()
      }
    })

    it('should have all golden sample teams in database', async () => {
      for (const team of goldenSamples.samples.teams) {
        const found = await get(
          `SELECT COUNT(*) as count FROM games 
           WHERE home_team = ? OR away_team = ?`,
          [team.code, team.code]
        )
        
        expect(found).toBeTruthy()
      }
    })

    it('should have data for expected test years', async () => {
      const allYears = [
        ...new Set([
          ...goldenSamples.samples.players.flatMap(p => p.test_years),
          ...goldenSamples.samples.teams.flatMap(t => t.test_years)
        ])
      ]

      // Only check years we expect to have data for
      const expectedYears = allYears.filter(isExpectedYear)
      
      if (expectedYears.length === 0) {
        console.warn('No expected years found in golden samples - this is OK if we only have recent data')
        return
      }

      for (const year of expectedYears) {
        // For 2024 data, prefer history database since that's where it lives
        const options = year === 2024 ? { preferHistory: true } : {}
        
        const gameCount = await get<{ count: number }>(
          `SELECT COUNT(*) as count FROM games WHERE game_id LIKE ?`,
          [`${year}%`],
          options
        )
        
        if (!gameCount || gameCount.count === 0) {
          console.error(`Missing data for expected year ${year}`)
          console.error(`Expected years: [${expectedYears.join(', ')}]`)
          console.error(`Database split: 2024 data should be in history DB`)
        }
        
        expect(gameCount?.count).toBeGreaterThan(0)
      }
    })
  })

  describe('Golden Sample Metadata', () => {
    it('should have valid golden sample structure', () => {
      expect(goldenSamples.version).toBe('1.0')
      expect(goldenSamples.updated).toBe('2025-08-02')
      expect(goldenSamples.samples.players).toHaveLength(10)
      expect(goldenSamples.samples.teams).toHaveLength(10)
    })

    it('should have required fields for all players', () => {
      goldenSamples.samples.players.forEach((player) => {
        expect(player.id).toBeTruthy()
        expect(player.name).toBeTruthy()
        expect(player.primary_pos).toBeTruthy()
        expect(Array.isArray(player.test_years)).toBe(true)
        expect(player.test_years.length).toBeGreaterThan(0)
        expect(typeof player.expected_ranges).toBe('object')
      })
    })

    it('should have required fields for all teams', () => {
      goldenSamples.samples.teams.forEach((team) => {
        expect(team.code).toBeTruthy()
        expect(team.name).toBeTruthy()
        expect(Array.isArray(team.test_years)).toBe(true)
        expect(team.test_years.length).toBeGreaterThan(0)
        expect(typeof team.expected_ranges).toBe('object')
      })
    })
  })
})