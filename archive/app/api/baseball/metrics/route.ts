/**
 * app/api/baseball/metrics/route.ts - 収集メトリクスAPI
 */

import { NextRequest } from 'next/server'
import { getCollectionMetrics, getDailySummary, createApiResponse, createErrorResponse } from '@/lib/visualization-api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    
    const [metrics, dailySummary] = await Promise.all([
      getCollectionMetrics(),
      getDailySummary(days)
    ])
    
    return createApiResponse({
      metrics,
      dailySummary,
      summary: {
        daysRequested: days,
        totalDaysWithData: dailySummary.length
      }
    })
  } catch (error) {
    console.error('Metrics API error:', error)
    return createErrorResponse('Failed to fetch collection metrics')
  }
}