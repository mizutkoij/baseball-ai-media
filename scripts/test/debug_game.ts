#!/usr/bin/env node
/**
 * Debug Game Command - Game-level data quality diagnostics
 * 
 * Usage:
 *   npm run debug:game -- --game 20240401001
 *   npm run debug:game -- --team 巨人 --date 2024-04-01
 *   npm run debug:game -- --latest 5
 * 
 * Features:
 * - Box score consistency validation
 * - Individual vs team aggregation checks  
 * - Park factor impact analysis
 * - Data completeness assessment
 */

import { query, get } from '../lib/db'
import { 
  getAdjustedTolerance, 
  buildExclusionClause,
  getConfigSummary 
} from '../lib/invariants-config'
import { generateStratifiedSample } from '../lib/stratified-sampling'

interface GameDebugResult {
  game_id: string
  status: 'healthy' | 'warning' | 'error'
  score: number
  issues: DebugIssue[]
  metadata: {
    home_team: string
    away_team: string
    home_score: number
    away_score: number
    date: string
    venue: string
  }
  diagnostics: {
    box_score_health: BoxScoreHealth
    aggregation_health: AggregationHealth
    data_completeness: DataCompleteness
  }
}

interface DebugIssue {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'box_score' | 'aggregation' | 'completeness' | 'park_factor'
  message: string
  expected?: number
  actual?: number
  tolerance?: number
}

interface BoxScoreHealth {
  runs_consistency: boolean
  hits_consistency: boolean
  strikeouts_consistency: boolean
  issues: DebugIssue[]
}

interface AggregationHealth {
  team_vs_players: boolean
  batting_vs_pitching: boolean
  issues: DebugIssue[]
}

interface DataCompleteness {
  batting_coverage: number
  pitching_coverage: number
  required_fields: boolean
  issues: DebugIssue[]
}

/**
 * Parse command line arguments
 */
function parseArgs(): { game?: string, team?: string, date?: string, latest?: number } {
  const args = process.argv.slice(2)
  const result: any = {}
  
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]
    const value = args[i + 1]
    
    switch (flag) {
      case '--game':
        result.game = value
        break
      case '--team':
        result.team = value
        break
      case '--date':
        result.date = value
        break
      case '--latest':
        result.latest = parseInt(value) || 5
        break
    }
  }
  
  return result
}

/**
 * Find games based on criteria
 */
async function findGames(criteria: { game?: string, team?: string, date?: string, latest?: number }): Promise<string[]> {
  if (criteria.game) {
    return [criteria.game]
  }
  
  let whereClause = "status = 'final'"
  const params: any[] = []
  
  if (criteria.team) {
    whereClause += " AND (home_team LIKE ? OR away_team LIKE ?)"
    params.push(`%${criteria.team}%`, `%${criteria.team}%`)
  }
  
  if (criteria.date) {
    const dateStr = criteria.date.replace(/-/g, '')
    whereClause += " AND game_id LIKE ?"
    params.push(`${dateStr}%`)
  } else {
    whereClause += " AND game_id LIKE '2024%'"
  }
  
  const exclusionClause = buildExclusionClause()
  whereClause += ` AND ${exclusionClause}`
  
  const games = await query<{ game_id: string }>(`
    SELECT game_id
    FROM games 
    WHERE ${whereClause}
    ORDER BY game_id DESC
    LIMIT ${criteria.latest || 10}
  `, params, { preferHistory: true })
  
  return games.map(g => g.game_id)
}

/**
 * Debug single game
 */
async function debugGame(gameId: string): Promise<GameDebugResult> {
  console.log(`\n🔍 デバッグ中: ${gameId}`)
  
  // Get game metadata
  const gameInfo = await get<{
    home_team: string
    away_team: string
    home_score: number
    away_score: number
    venue: string
  }>(`
    SELECT home_team, away_team, home_score, away_score, venue
    FROM games
    WHERE game_id = ?
  `, [gameId], { preferHistory: true })
  
  if (!gameInfo) {
    return {
      game_id: gameId,
      status: 'error',
      score: 0,
      issues: [{
        severity: 'critical',
        category: 'completeness',
        message: 'Game not found in database'
      }],
      metadata: {
        home_team: 'unknown',
        away_team: 'unknown', 
        home_score: 0,
        away_score: 0,
        date: gameId.substring(0, 8),
        venue: 'unknown'
      },
      diagnostics: {
        box_score_health: { runs_consistency: false, hits_consistency: false, strikeouts_consistency: false, issues: [] },
        aggregation_health: { team_vs_players: false, batting_vs_pitching: false, issues: [] },
        data_completeness: { batting_coverage: 0, pitching_coverage: 0, required_fields: false, issues: [] }
      }
    }
  }
  
  const issues: DebugIssue[] = []
  let totalScore = 100
  
  // 1. Box Score Consistency Check
  const boxScoreHealth = await checkBoxScoreConsistency(gameId, gameInfo, issues)
  
  // 2. Aggregation Health Check  
  const aggregationHealth = await checkAggregationHealth(gameId, gameInfo, issues)
  
  // 3. Data Completeness Check
  const dataCompleteness = await checkDataCompleteness(gameId, gameInfo, issues)
  
  // Calculate overall health score
  const criticalIssues = issues.filter(i => i.severity === 'critical').length
  const highIssues = issues.filter(i => i.severity === 'high').length
  const mediumIssues = issues.filter(i => i.severity === 'medium').length
  
  totalScore -= (criticalIssues * 40 + highIssues * 20 + mediumIssues * 10)
  totalScore = Math.max(0, totalScore)
  
  const status = totalScore >= 80 ? 'healthy' : totalScore >= 60 ? 'warning' : 'error'
  
  return {
    game_id: gameId,
    status,
    score: totalScore,
    issues,
    metadata: {
      ...gameInfo,
      date: gameId.substring(0, 8)
    },
    diagnostics: {
      box_score_health: boxScoreHealth,
      aggregation_health: aggregationHealth,
      data_completeness: dataCompleteness
    }
  }
}

/**
 * Check box score consistency (R/H/HR validation)
 */
async function checkBoxScoreConsistency(gameId: string, gameInfo: any, issues: DebugIssue[]): Promise<BoxScoreHealth> {
  const health: BoxScoreHealth = {
    runs_consistency: true,
    hits_consistency: true,
    strikeouts_consistency: true,
    issues: []
  }
  
  // Check runs consistency (team score vs batting totals)
  for (const [team, expectedRuns] of [[gameInfo.home_team, gameInfo.home_score], [gameInfo.away_team, gameInfo.away_score]]) {
    const actualRuns = await get<{ total_runs: number }>(`
      SELECT SUM(R) as total_runs
      FROM box_batting
      WHERE game_id = ? AND team = ?
    `, [gameId, team], { preferHistory: true })
    
    if (actualRuns?.total_runs !== null && actualRuns?.total_runs !== undefined) {
      const tolerance = getAdjustedTolerance('R', 10, parseInt(gameId.substring(0, 4)))
      const diff = Math.abs(expectedRuns - actualRuns.total_runs)
      
      if (diff > tolerance) {
        health.runs_consistency = false
        const issue: DebugIssue = {
          severity: diff > tolerance * 2 ? 'critical' : 'high',
          category: 'box_score',
          message: `${team} runs mismatch: scoreboard=${expectedRuns}, batting_total=${actualRuns.total_runs}`,
          expected: expectedRuns,
          actual: actualRuns.total_runs,
          tolerance
        }
        issues.push(issue)
        health.issues.push(issue)
      }
    }
  }
  
  // Check hits consistency
  for (const team of [gameInfo.home_team, gameInfo.away_team]) {
    const teamHits = await get<{ total_hits: number }>(`
      SELECT SUM(H) as total_hits
      FROM box_batting
      WHERE game_id = ? AND team = ?
    `, [gameId, team], { preferHistory: true })
    
    if (teamHits?.total_hits !== null && teamHits?.total_hits !== undefined) {
      // Validate reasonable hit totals (0-20 range typically)
      if (teamHits.total_hits < 0 || teamHits.total_hits > 25) {
        health.hits_consistency = false
        const issue: DebugIssue = {
          severity: 'medium',
          category: 'box_score',
          message: `${team} unusual hit total: ${teamHits.total_hits} (expected 0-20 range)`
        }
        issues.push(issue)
        health.issues.push(issue)
      }
    }
  }
  
  // Check strikeouts cross-validation (batting SO vs pitching SO)
  const homeBatterSOs = await get<{ total_so: number }>(`
    SELECT SUM(SO) as total_so FROM box_batting WHERE game_id = ? AND team = ?
  `, [gameId, gameInfo.home_team], { preferHistory: true })
  
  const awayPitcherSOs = await get<{ total_so: number }>(`
    SELECT SUM(SO) as total_so FROM box_pitching WHERE game_id = ? AND team = ?
  `, [gameId, gameInfo.away_team], { preferHistory: true })
  
  if (homeBatterSOs?.total_so && awayPitcherSOs?.total_so) {
    const tolerance = getAdjustedTolerance('strikeouts_cross', 5, parseInt(gameId.substring(0, 4)))
    const diff = Math.abs(homeBatterSOs.total_so - awayPitcherSOs.total_so)
    
    if (diff > tolerance) {
      health.strikeouts_consistency = false
      const issue: DebugIssue = {
        severity: 'medium',
        category: 'box_score',
        message: `Strikeouts cross-validation: home_batters=${homeBatterSOs.total_so}, away_pitchers=${awayPitcherSOs.total_so}`,
        expected: homeBatterSOs.total_so,
        actual: awayPitcherSOs.total_so,
        tolerance
      }
      issues.push(issue)
      health.issues.push(issue)
    }
  }
  
  return health
}

/**
 * Check aggregation health (team vs players)
 */
async function checkAggregationHealth(gameId: string, gameInfo: any, issues: DebugIssue[]): Promise<AggregationHealth> {
  const health: AggregationHealth = {
    team_vs_players: true,
    batting_vs_pitching: true,
    issues: []
  }
  
  // Check team vs players aggregation
  for (const team of [gameInfo.home_team, gameInfo.away_team]) {
    const playerStats = await get<{ 
      player_count: number
      total_ab: number
      total_h: number
      total_bb: number
    }>(`
      SELECT 
        COUNT(DISTINCT player_id) as player_count,
        SUM(AB) as total_ab,
        SUM(H) as total_h,
        SUM(BB) as total_bb
      FROM box_batting
      WHERE game_id = ? AND team = ? AND player_id IS NOT NULL
    `, [gameId, team], { preferHistory: true })
    
    if (playerStats) {
      // Validate reasonable player count (8-15 typically)
      if (playerStats.player_count < 8 || playerStats.player_count > 15) {
        health.team_vs_players = false
        const issue: DebugIssue = {
          severity: 'medium',
          category: 'aggregation',
          message: `${team} unusual player count: ${playerStats.player_count} (expected 8-15)`
        }
        issues.push(issue)
        health.issues.push(issue)
      }
      
      // Validate AB >= H (basic baseball logic)
      if (playerStats.total_ab < playerStats.total_h) {
        health.team_vs_players = false
        const issue: DebugIssue = {
          severity: 'high',
          category: 'aggregation',
          message: `${team} impossible stats: AB(${playerStats.total_ab}) < H(${playerStats.total_h})`
        }
        issues.push(issue)
        health.issues.push(issue)
      }
    }
  }
  
  return health
}

/**
 * Check data completeness
 */
async function checkDataCompleteness(gameId: string, gameInfo: any, issues: DebugIssue[]): Promise<DataCompleteness> {
  // Check batting data coverage
  const battingCoverage = await get<{ 
    teams_with_data: number 
    total_players: number
  }>(`
    SELECT 
      COUNT(DISTINCT team) as teams_with_data,
      COUNT(DISTINCT player_id) as total_players
    FROM box_batting
    WHERE game_id = ?
  `, [gameId], { preferHistory: true })
  
  // Check pitching data coverage
  const pitchingCoverage = await get<{ 
    teams_with_data: number
    total_pitchers: number
  }>(`
    SELECT 
      COUNT(DISTINCT team) as teams_with_data,
      COUNT(DISTINCT player_id) as total_pitchers
    FROM box_pitching
    WHERE game_id = ?
  `, [gameId], { preferHistory: true })
  
  const battingPct = (battingCoverage?.teams_with_data || 0) / 2 * 100
  const pitchingPct = (pitchingCoverage?.teams_with_data || 0) / 2 * 100
  
  const completeness: DataCompleteness = {
    batting_coverage: battingPct,
    pitching_coverage: pitchingPct,
    required_fields: battingPct >= 100 && pitchingPct >= 100,
    issues: []
  }
  
  if (battingPct < 100) {
    const issue: DebugIssue = {
      severity: 'high',
      category: 'completeness',
      message: `Incomplete batting data: ${battingPct}% coverage (${battingCoverage?.teams_with_data}/2 teams)`
    }
    issues.push(issue)
    completeness.issues.push(issue)
  }
  
  if (pitchingPct < 100) {
    const issue: DebugIssue = {
      severity: 'high', 
      category: 'completeness',
      message: `Incomplete pitching data: ${pitchingPct}% coverage (${pitchingCoverage?.teams_with_data}/2 teams)`
    }
    issues.push(issue)
    completeness.issues.push(issue)
  }
  
  return completeness
}

/**
 * Generate debug report
 */
function generateReport(results: GameDebugResult[]): string {
  const healthyGames = results.filter(r => r.status === 'healthy').length
  const warningGames = results.filter(r => r.status === 'warning').length
  const errorGames = results.filter(r => r.status === 'error').length
  
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
  
  let report = `
## 🎯 Game Debug Report

**Generated**: ${new Date().toISOString()}
**Games Analyzed**: ${results.length}
**Average Health Score**: ${avgScore.toFixed(1)}/100

### Summary
- ✅ **Healthy**: ${healthyGames} games (${(healthyGames/results.length*100).toFixed(1)}%)
- ⚠️ **Warning**: ${warningGames} games (${(warningGames/results.length*100).toFixed(1)}%)
- ❌ **Error**: ${errorGames} games (${(errorGames/results.length*100).toFixed(1)}%)

### Game Details
`
  
  for (const result of results) {
    const statusIcon = result.status === 'healthy' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
    
    report += `
#### ${statusIcon} ${result.game_id} (${result.score}/100)
**${result.metadata.away_team} @ ${result.metadata.home_team}** - ${result.metadata.away_score}-${result.metadata.home_score}

`
    
    if (result.issues.length > 0) {
      report += `**Issues Found**:\n`
      for (const issue of result.issues) {
        const severityIcon = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟡' : issue.severity === 'medium' ? '🟠' : '🔵'
        report += `- ${severityIcon} ${issue.message}\n`
      }
    } else {
      report += `**No issues detected** - All quality checks passed\n`
    }
    
    report += `\n**Diagnostics**:
- Box Score: ${result.diagnostics.box_score_health.runs_consistency && result.diagnostics.box_score_health.hits_consistency ? '✅' : '❌'} R/H consistency
- Aggregation: ${result.diagnostics.aggregation_health.team_vs_players ? '✅' : '❌'} Team vs players
- Completeness: ${result.diagnostics.data_completeness.batting_coverage.toFixed(0)}% batting, ${result.diagnostics.data_completeness.pitching_coverage.toFixed(0)}% pitching

`
  }
  
  // Issue summary
  const allIssues = results.flatMap(r => r.issues)
  const issuesByCategory = {
    box_score: allIssues.filter(i => i.category === 'box_score').length,
    aggregation: allIssues.filter(i => i.category === 'aggregation').length,
    completeness: allIssues.filter(i => i.category === 'completeness').length,
    park_factor: allIssues.filter(i => i.category === 'park_factor').length
  }
  
  report += `
### Issue Categories
- **Box Score**: ${issuesByCategory.box_score} issues
- **Aggregation**: ${issuesByCategory.aggregation} issues  
- **Completeness**: ${issuesByCategory.completeness} issues
- **Park Factor**: ${issuesByCategory.park_factor} issues

### Recommendations
`
  
  if (errorGames > 0) {
    report += `- 🚨 **${errorGames} games** require immediate attention (score < 60)\n`
  }
  if (warningGames > 0) {
    report += `- ⚠️ **${warningGames} games** need review (score 60-79)\n`  
  }
  if (issuesByCategory.completeness > 0) {
    report += `- 📊 Check data ingestion pipeline for completeness issues\n`
  }
  if (issuesByCategory.box_score > 0) {
    report += `- 🔍 Validate box score aggregation logic\n`
  }
  
  return report.trim()
}

/**
 * Main execution
 */
async function main() {
  console.log('🎯 Baseball AI Media - Game Debug Tool\n')
  console.log(getConfigSummary() + '\n')
  
  const args = parseArgs()
  
  if (!args.game && !args.team && !args.date && !args.latest) {
    console.log(`Usage:
  npm run debug:game -- --game 20240401001           # Debug specific game
  npm run debug:game -- --team 巨人 --date 2024-04-01  # Debug team games on date
  npm run debug:game -- --latest 5                    # Debug latest 5 games
  npm run debug:game -- --team ヤクルト --latest 3      # Debug latest 3 team games
`)
    process.exit(1)
  }
  
  try {
    const gameIds = await findGames(args)
    
    if (gameIds.length === 0) {
      console.log('❌ No games found matching criteria')
      process.exit(1)
    }
    
    console.log(`📋 Found ${gameIds.length} games to debug`)
    
    const results: GameDebugResult[] = []
    
    for (const gameId of gameIds) {
      const result = await debugGame(gameId)
      results.push(result)
    }
    
    // Generate and display report
    const report = generateReport(results)
    console.log(report)
    
    // Save report to file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    const filename = `.reports/game_debug_${timestamp}.md`
    require('fs').mkdirSync('.reports', { recursive: true })
    require('fs').writeFileSync(filename, report)
    
    console.log(`\n📄 Detailed report saved: ${filename}`)
    
    // Exit with appropriate code
    const hasErrors = results.some(r => r.status === 'error')
    process.exit(hasErrors ? 1 : 0)
    
  } catch (error) {
    console.error('❌ Debug command failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}