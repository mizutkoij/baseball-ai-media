/**
 * app/api/sabermetrics/calculate/route.ts - セイバーメトリクス計算実行API
 */

import { NextRequest } from 'next/server'
import { createApiResponse, createErrorResponse } from '@/lib/visualization-api'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { league, season } = await request.json()

    if (!league || !season) {
      return createErrorResponse('League and season parameters are required', 400)
    }

    if (league === 'NPB') {
      // NPBセイバーメトリクス計算の実行
      const { spawn } = require('child_process')
      
      return await new Promise<Response>((resolve) => {
        const process = spawn('node', ['-e', `
          const { NPBSabermetricsProcessor } = require('/var/www/baseball-ai/lib/npb-sabermetrics-processor.ts');
          const config = {
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'baseball_user',
            password: process.env.MYSQL_PASSWORD || 'secure_password',
            database: process.env.MYSQL_DATABASE || 'baseball_data'
          };
          
          async function calculate() {
            try {
              const processor = new NPBSabermetricsProcessor(config);
              const battingResults = await processor.calculateAndSaveBattingMetrics(${season});
              const pitchingResults = await processor.calculateAndSavePitchingMetrics(${season});
              
              console.log(JSON.stringify({
                success: true,
                battingCount: battingResults.length,
                pitchingCount: pitchingResults.length,
                season: ${season}
              }));
            } catch (error) {
              console.error(JSON.stringify({
                success: false,
                error: error.message
              }));
            }
          }
          
          calculate();
        `])

        let output = ''
        process.stdout.on('data', (data: Buffer) => {
          output += data.toString()
        })

        process.stderr.on('data', (data: Buffer) => {
          console.error('NPB calculation error:', data.toString())
        })

        process.on('close', (code: number) => {
          try {
            const result = JSON.parse(output.trim())
            if (result.success) {
              resolve(createApiResponse({
                message: 'NPB sabermetrics calculation completed',
                league: 'NPB',
                season,
                battingPlayersProcessed: result.battingCount,
                pitchingPlayersProcessed: result.pitchingCount
              }))
            } else {
              resolve(createErrorResponse(`NPB calculation failed: ${result.error}`))
            }
          } catch (error) {
            resolve(createErrorResponse('Failed to parse calculation results'))
          }
        })
      })

    } else if (league === 'MLB') {
      // MLB計算実行（将来実装）
      return createApiResponse({
        message: 'MLB sabermetrics calculation will be implemented when pybaseball is installed',
        league: 'MLB',
        season,
        status: 'not_implemented'
      })

    } else {
      return createErrorResponse('Invalid league. Use NPB or MLB', 400)
    }

  } catch (error) {
    console.error('Sabermetrics calculation API error:', error)
    return createErrorResponse('Failed to execute sabermetrics calculation')
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const league = searchParams.get('league')?.toUpperCase()

    if (!league) {
      return createApiResponse({
        availableCalculations: {
          NPB: {
            status: 'available',
            description: 'Calculate NPB sabermetrics from collected roster data',
            endpoint: 'POST /api/sabermetrics/calculate',
            requiredParams: { league: 'NPB', season: 'number' }
          },
          MLB: {
            status: 'planned',
            description: 'MLB sabermetrics calculation (requires pybaseball installation)',
            endpoint: 'POST /api/sabermetrics/calculate',
            requiredParams: { league: 'MLB', season: 'number' }
          }
        }
      })
    }

    // 特定リーグの計算状態確認
    const connection = await require('mysql2/promise').createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'baseball_user',
      password: process.env.MYSQL_PASSWORD || 'secure_password',
      database: process.env.MYSQL_DATABASE || 'baseball_data',
      charset: 'utf8mb4'
    })

    try {
      if (league === 'NPB') {
        const [rows] = await connection.execute(`
          SELECT 
            season,
            player_type,
            COUNT(*) as calculated_players,
            MAX(updated_at) as last_calculation
          FROM npb_sabermetrics 
          GROUP BY season, player_type
          ORDER BY season DESC, player_type
        `)

        return createApiResponse({
          league: 'NPB',
          calculationHistory: rows
        })

      } else if (league === 'MLB') {
        const [battingRows] = await connection.execute(`
          SELECT 
            season,
            COUNT(*) as player_count,
            MAX(updated_at) as last_update
          FROM mlb_batting_stats 
          GROUP BY season
          ORDER BY season DESC
        `)

        const [pitchingRows] = await connection.execute(`
          SELECT 
            season,
            COUNT(*) as player_count,
            MAX(updated_at) as last_update
          FROM mlb_pitching_stats 
          GROUP BY season
          ORDER BY season DESC
        `)

        return createApiResponse({
          league: 'MLB',
          battingData: battingRows,
          pitchingData: pitchingRows,
          note: 'MLB data is imported, but advanced sabermetrics calculation requires pybaseball'
        })

      } else {
        return createErrorResponse('Invalid league parameter', 400)
      }

    } finally {
      await connection.end()
    }

  } catch (error) {
    console.error('Sabermetrics status API error:', error)
    return createErrorResponse('Failed to fetch calculation status')
  }
}