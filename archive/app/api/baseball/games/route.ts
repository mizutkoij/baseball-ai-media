/**
 * app/api/baseball/games/route.ts - 試合データAPI
 */

import { NextRequest } from 'next/server'
import { getGames, createApiResponse, createErrorResponse } from '@/lib/visualization-api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    const games = await getGames(startDate || undefined, endDate || undefined)
    
    return createApiResponse({
      games,
      count: games.length,
      filters: {
        startDate: startDate || 'auto',
        endDate: endDate || 'today'
      }
    })
  } catch (error) {
    console.error('Games API error:', error)
    return createErrorResponse('Failed to fetch game data')
  }
}