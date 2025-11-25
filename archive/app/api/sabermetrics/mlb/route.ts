/**
 * app/api/sabermetrics/mlb/route.ts - MLBセイバーメトリクスAPI
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
    const playerType = searchParams.get('type') as 'batting' | 'pitching' | null
    const season = parseInt(searchParams.get('season') || '2023')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sort') || 'default'

    const connection = await createConnection()

    try {
      let data = null
      
      if (playerType === 'batting' || !playerType) {
        // 打撃データ取得
        let battingQuery = `
          SELECT 
            p.full_name as name,
            b.team,
            'MLB' as league,
            b.season,
            'batter' as player_type,
            b.games,
            b.plate_appearances,
            b.at_bats,
            b.hits,
            b.home_runs,
            b.rbis,
            b.stolen_bases,
            b.walks,
            b.strikeouts,
            b.batting_average,
            b.on_base_percentage,
            b.slugging_percentage,
            b.ops,
            b.ops_plus as wrc_plus,
            -- 計算指標（簡略化）
            CASE 
              WHEN b.at_bats > 0 
              THEN ROUND((b.hits - b.home_runs) / (b.at_bats - b.strikeouts - b.home_runs), 3)
              ELSE NULL 
            END as babip,
            CASE 
              WHEN b.at_bats > 0 
              THEN ROUND(b.slugging_percentage - b.batting_average, 3)
              ELSE NULL 
            END as isolated_power,
            CASE 
              WHEN b.plate_appearances > 0 
              THEN ROUND(b.walks / b.plate_appearances, 3)
              ELSE NULL 
            END as walk_rate,
            CASE 
              WHEN b.plate_appearances > 0 
              THEN ROUND(b.strikeouts / b.plate_appearances, 3)
              ELSE NULL 
            END as strikeout_rate
          FROM mlb_batting_stats b
          LEFT JOIN mlb_players p ON b.mlbam_id = p.mlbam_id
          WHERE b.season = ?
        `
        const battingParams: any[] = [season]

        if (team) {
          battingQuery += ' AND b.team = ?'
          battingParams.push(team)
        }

        // ソート条件
        battingQuery += ' ORDER BY '
        switch (sortBy) {
          case 'ops':
            battingQuery += 'b.ops DESC'
            break
          case 'wrc_plus':
            battingQuery += 'b.ops_plus DESC'
            break
          case 'batting_average':
            battingQuery += 'b.batting_average DESC'
            break
          case 'home_runs':
            battingQuery += 'b.home_runs DESC'
            break
          default:
            battingQuery += 'b.ops DESC'
        }

        battingQuery += ' LIMIT ?'
        battingParams.push(limit)

        const [battingRows] = await connection.execute(battingQuery, battingParams)
        data = { batting: battingRows }
      }

      if (playerType === 'pitching' || !playerType) {
        // 投手データ取得
        let pitchingQuery = `
          SELECT 
            p.full_name as name,
            pt.team,
            'MLB' as league,
            pt.season,
            'pitcher' as player_type,
            pt.wins,
            pt.losses,
            pt.games,
            pt.games_started,
            pt.saves,
            pt.innings_pitched,
            pt.strikeouts,
            pt.walks,
            pt.home_runs,
            pt.era as earned_run_average,
            pt.whip,
            pt.fip,
            -- 計算指標
            CASE 
              WHEN pt.walks > 0 
              THEN ROUND(pt.strikeouts / pt.walks, 2)
              ELSE NULL 
            END as so_bb_ratio,
            CASE 
              WHEN pt.innings_pitched > 0 
              THEN ROUND((pt.strikeouts * 9) / pt.innings_pitched, 2)
              ELSE NULL 
            END as so_per_9,
            CASE 
              WHEN pt.innings_pitched > 0 
              THEN ROUND((pt.walks * 9) / pt.innings_pitched, 2)
              ELSE NULL 
            END as bb_per_9,
            CASE 
              WHEN pt.innings_pitched > 0 
              THEN ROUND((pt.home_runs * 9) / pt.innings_pitched, 2)
              ELSE NULL 
            END as hr_per_9
          FROM mlb_pitching_stats pt
          LEFT JOIN mlb_players p ON pt.mlbam_id = p.mlbam_id
          WHERE pt.season = ?
        `
        const pitchingParams: any[] = [season]

        if (team) {
          pitchingQuery += ' AND pt.team = ?'
          pitchingParams.push(team)
        }

        // ソート条件
        pitchingQuery += ' ORDER BY '
        switch (sortBy) {
          case 'era':
            pitchingQuery += 'pt.era ASC'
            break
          case 'fip':
            pitchingQuery += 'pt.fip ASC'
            break
          case 'whip':
            pitchingQuery += 'pt.whip ASC'
            break
          case 'strikeouts':
            pitchingQuery += 'pt.strikeouts DESC'
            break
          default:
            pitchingQuery += 'pt.fip ASC'
        }

        pitchingQuery += ' LIMIT ?'
        pitchingParams.push(limit)

        const [pitchingRows] = await connection.execute(pitchingQuery, pitchingParams)
        data = { ...data, pitching: pitchingRows }
      }

      // リーグ統計も取得
      const [leagueStats] = await connection.execute(`
        SELECT 
          'batting' as type,
          COUNT(*) as player_count,
          AVG(ops) as avg_ops,
          AVG(batting_average) as avg_batting_average,
          AVG(ops_plus) as avg_wrc_plus
        FROM mlb_batting_stats 
        WHERE season = ? ${team ? 'AND team = ?' : ''}
        UNION ALL
        SELECT 
          'pitching' as type,
          COUNT(*) as player_count,
          AVG(era) as avg_era,
          AVG(whip) as avg_whip,
          AVG(fip) as avg_fip
        FROM mlb_pitching_stats 
        WHERE season = ? ${team ? 'AND team = ?' : ''}
      `, team ? [season, team, season, team] : [season, season])

      return createApiResponse({
        sabermetrics: data,
        leagueStats,
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
    console.error('MLB Sabermetrics API error:', error)
    return createErrorResponse('Failed to fetch MLB sabermetrics data')
  }
}