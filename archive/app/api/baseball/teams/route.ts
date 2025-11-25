/**
 * app/api/baseball/teams/route.ts - チーム一覧API
 */

import { NextRequest } from 'next/server'
import { getTeams, createApiResponse, createErrorResponse } from '@/lib/visualization-api'

export async function GET(request: NextRequest) {
  try {
    const teams = await getTeams()
    
    return createApiResponse({
      teams,
      count: teams.length
    })
  } catch (error) {
    console.error('Teams API error:', error)
    return createErrorResponse('Failed to fetch teams list')
  }
}