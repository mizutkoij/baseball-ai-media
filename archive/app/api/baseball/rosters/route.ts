/**
 * app/api/baseball/rosters/route.ts - チームロスターAPI
 */

import { NextRequest } from 'next/server'
import { getTeamRosters, createApiResponse, createErrorResponse } from '@/lib/visualization-api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const team = searchParams.get('team')
    const date = searchParams.get('date')
    
    const rosters = await getTeamRosters(team || undefined, date || undefined)
    
    return createApiResponse({
      rosters,
      count: rosters.length,
      filters: {
        team: team || 'all',
        date: date || 'latest'
      }
    })
  } catch (error) {
    console.error('Rosters API error:', error)
    return createErrorResponse('Failed to fetch roster data')
  }
}