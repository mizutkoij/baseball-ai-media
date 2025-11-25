/**
 * app/api/baseball/stats/route.ts - 選手統計API
 */

import { NextRequest } from 'next/server'
import { getPlayerStats, createApiResponse, createErrorResponse } from '@/lib/visualization-api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const team = searchParams.get('team')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    const stats = await getPlayerStats(team || undefined, limit)
    
    return createApiResponse({
      players: stats,
      count: stats.length,
      filters: {
        team: team || 'all',
        limit
      }
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return createErrorResponse('Failed to fetch player stats')
  }
}