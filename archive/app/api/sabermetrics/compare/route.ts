/**
 * app/api/sabermetrics/compare/route.ts - リーグ間比較API
 */

import { NextRequest } from 'next/server'
import { createApiResponse, createErrorResponse } from '@/lib/visualization-api'
import mysql from 'mysql2/promise'

const createConnection = async () => {
  return await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'baseball_user',
    password: process.env.MYSQL_PASSWORD || 'secure_password',
    database: process.env.MYSQL_DATABASE || 'baseball_data',
    charset: 'utf8mb4'
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric') || 'ops'
    const playerType = searchParams.get('type') as 'batter' | 'pitcher' || 'batter'
    const npbSeason = parseInt(searchParams.get('npb_season') || '2025')
    const mlbSeason = parseInt(searchParams.get('mlb_season') || '2023')
    const limit = parseInt(searchParams.get('limit') || '10')

    const connection = await createConnection()

    try {
      let npbData = null
      let mlbData = null

      if (playerType === 'batter') {
        // NPB打者データ
        const npbMetricColumn = {
          'ops': 'ops',
          'woba': 'woba',
          'wrc_plus': 'wrc_plus',
          'batting_average': 'batting_average',
          'isolated_power': 'isolated_power'
        }[metric] || 'ops'

        const [npbRows] = await connection.execute(`
          SELECT 
            name,
            team,
            'NPB' as league,
            season,
            ${npbMetricColumn} as metric_value,
            batting_average,
            on_base_percentage,
            slugging_percentage,
            ops,
            woba,
            wrc_plus
          FROM npb_sabermetrics 
          WHERE player_type = 'batter' 
            AND season = ? 
            AND ${npbMetricColumn} IS NOT NULL
          ORDER BY ${npbMetricColumn} DESC
          LIMIT ?
        `, [npbSeason, limit])

        // MLB打者データ
        const mlbMetricColumn = {
          'ops': 'ops',
          'wrc_plus': 'ops_plus',
          'batting_average': 'batting_average',
          'isolated_power': '(slugging_percentage - batting_average)'
        }[metric] || 'ops'

        const [mlbRows] = await connection.execute(`
          SELECT 
            p.full_name as name,
            b.team,
            'MLB' as league,
            b.season,
            ${mlbMetricColumn} as metric_value,
            b.batting_average,
            b.on_base_percentage,
            b.slugging_percentage,
            b.ops,
            b.ops_plus as wrc_plus
          FROM mlb_batting_stats b
          LEFT JOIN mlb_players p ON b.mlbam_id = p.mlbam_id
          WHERE b.season = ?
            AND ${mlbMetricColumn} IS NOT NULL
          ORDER BY ${mlbMetricColumn} DESC
          LIMIT ?
        `, [mlbSeason, limit])

        npbData = npbRows
        mlbData = mlbRows

      } else if (playerType === 'pitcher') {
        // NPB投手データ
        const npbMetricColumn = {
          'era': 'earned_run_average',
          'fip': 'fip',
          'whip': 'whip',
          'so_per_9': 'so_per_9'
        }[metric] || 'fip'

        const sortOrder = ['era', 'fip', 'whip'].includes(metric) ? 'ASC' : 'DESC'

        const [npbRows] = await connection.execute(`
          SELECT 
            name,
            team,
            'NPB' as league,
            season,
            ${npbMetricColumn} as metric_value,
            earned_run_average,
            whip,
            fip,
            so_per_9,
            bb_per_9
          FROM npb_sabermetrics 
          WHERE player_type = 'pitcher' 
            AND season = ? 
            AND ${npbMetricColumn} IS NOT NULL
          ORDER BY ${npbMetricColumn} ${sortOrder}
          LIMIT ?
        `, [npbSeason, limit])

        // MLB投手データ
        const mlbMetricColumn = {
          'era': 'era',
          'fip': 'fip',
          'whip': 'whip',
          'so_per_9': '(strikeouts * 9 / innings_pitched)'
        }[metric] || 'fip'

        const [mlbRows] = await connection.execute(`
          SELECT 
            p.full_name as name,
            pt.team,
            'MLB' as league,
            pt.season,
            ${mlbMetricColumn} as metric_value,
            pt.era as earned_run_average,
            pt.whip,
            pt.fip,
            CASE 
              WHEN pt.innings_pitched > 0 
              THEN ROUND((pt.strikeouts * 9) / pt.innings_pitched, 2)
              ELSE NULL 
            END as so_per_9,
            CASE 
              WHEN pt.innings_pitched > 0 
              THEN ROUND((pt.walks * 9) / pt.innings_pitched, 2)
              ELSE NULL 
            END as bb_per_9
          FROM mlb_pitching_stats pt
          LEFT JOIN mlb_players p ON pt.mlbam_id = p.mlbam_id
          WHERE pt.season = ?
            AND ${mlbMetricColumn} IS NOT NULL
          ORDER BY ${mlbMetricColumn} ${sortOrder}
          LIMIT ?
        `, [mlbSeason, limit])

        npbData = npbRows
        mlbData = mlbRows
      }

      // リーグ平均の計算
      const [npbAvg] = await connection.execute(`
        SELECT 
          'NPB' as league,
          COUNT(*) as player_count,
          AVG(CASE WHEN player_type = 'batter' THEN ops END) as avg_ops,
          AVG(CASE WHEN player_type = 'batter' THEN woba END) as avg_woba,
          AVG(CASE WHEN player_type = 'pitcher' THEN earned_run_average END) as avg_era,
          AVG(CASE WHEN player_type = 'pitcher' THEN fip END) as avg_fip
        FROM npb_sabermetrics 
        WHERE season = ? AND player_type = ?
      `, [npbSeason, playerType])

      const [mlbAvg] = await connection.execute(`
        SELECT 
          'MLB' as league,
          COUNT(*) as player_count,
          AVG(${playerType === 'batter' ? 'ops' : 'era'}) as avg_metric
        FROM ${playerType === 'batter' ? 'mlb_batting_stats' : 'mlb_pitching_stats'}
        WHERE season = ?
      `, [mlbSeason])

      return createApiResponse({
        comparison: {
          npb: npbData,
          mlb: mlbData
        },
        averages: {
          npb: npbAvg[0],
          mlb: mlbAvg[0]
        },
        metadata: {
          metric,
          playerType,
          npbSeason,
          mlbSeason,
          limit
        }
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    console.error('Sabermetrics comparison API error:', error)
    return createErrorResponse('Failed to fetch comparison data')
  }
}