/**
 * app/api/sabermetrics/npb/route.ts - NPBセイバーメトリクスAPI
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
    const team = searchParams.get('team')
    const playerType = searchParams.get('type') as 'batter' | 'pitcher' | null
    const season = parseInt(searchParams.get('season') || '2025')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sort') || 'default'

    const connection = await createConnection()

    try {
      let query = `
        SELECT 
          player_id,
          name,
          team,
          league,
          season,
          player_type,
          -- 打撃指標
          batting_average,
          on_base_percentage,
          slugging_percentage,
          ops,
          woba,
          wrc_plus,
          babip,
          isolated_power,
          walk_rate,
          strikeout_rate,
          -- 投手指標
          earned_run_average,
          whip,
          fip,
          xfip,
          so_bb_ratio,
          so_per_9,
          bb_per_9,
          hr_per_9,
          calculated_at,
          updated_at
        FROM npb_sabermetrics 
        WHERE season = ?
      `
      const params: any[] = [season]

      if (team) {
        query += ' AND team = ?'
        params.push(team)
      }

      if (playerType) {
        query += ' AND player_type = ?'
        params.push(playerType)
      }

      // ソート条件
      query += ' ORDER BY '
      switch (sortBy) {
        case 'woba':
          query += 'woba DESC NULLS LAST'
          break
        case 'ops':
          query += 'ops DESC NULLS LAST'
          break
        case 'fip':
          query += 'fip ASC NULLS LAST'
          break
        case 'era':
          query += 'earned_run_average ASC NULLS LAST'
          break
        case 'wrc_plus':
          query += 'wrc_plus DESC NULLS LAST'
          break
        default:
          if (playerType === 'batter') {
            query += 'woba DESC NULLS LAST, ops DESC NULLS LAST'
          } else if (playerType === 'pitcher') {
            query += 'fip ASC NULLS LAST, earned_run_average ASC NULLS LAST'
          } else {
            query += 'name ASC'
          }
      }

      query += ' LIMIT ?'
      params.push(limit)

      const [rows] = await connection.execute(query, params)
      const sabermetrics = rows as any[]

      // 統計サマリーも計算
      const [summaryRows] = await connection.execute(`
        SELECT 
          player_type,
          COUNT(*) as player_count,
          AVG(CASE WHEN player_type = 'batter' THEN woba END) as avg_woba,
          AVG(CASE WHEN player_type = 'batter' THEN ops END) as avg_ops,
          AVG(CASE WHEN player_type = 'pitcher' THEN fip END) as avg_fip,
          AVG(CASE WHEN player_type = 'pitcher' THEN earned_run_average END) as avg_era
        FROM npb_sabermetrics 
        WHERE season = ? ${team ? 'AND team = ?' : ''}
        GROUP BY player_type
      `, team ? [season, team] : [season])

      return createApiResponse({
        sabermetrics,
        summary: summaryRows,
        count: sabermetrics.length,
        filters: {
          team: team || 'all',
          playerType: playerType || 'all',
          season,
          sortBy,
          limit
        }
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    console.error('NPB Sabermetrics API error:', error)
    return createErrorResponse('Failed to fetch NPB sabermetrics data')
  }
}