import { NextRequest, NextResponse } from 'next/server';

/**
 * リーグ定数API
 * GET /api/constants?year=2024&league=first
 */
export async function GET(request: NextRequest) {
  const searchParams = new URLSearchParams(request.url.split('?')[1] || '');
  const year = searchParams.get('year') || new Date().getFullYear().toString();
  const league = searchParams.get('league') || 'first';
  
  try {
    // Return mock constants for Vercel compatibility
    console.warn('Constants file loading disabled for Vercel compatibility');
    
    const mockConstants = {
      year: parseInt(year),
      league: league,
      constants: {
        batting: {
          lg_avg_ops: 0.720,
          lg_avg_avg: 0.265,
          lg_avg_obp: 0.335,
          lg_avg_slg: 0.385,
          park_factor_adjustment: 1.000
        },
        pitching: {
          lg_avg_era: 3.50,
          lg_avg_whip: 1.25,
          lg_avg_k9: 8.5,
          lg_avg_bb9: 3.2,
          park_factor_adjustment: 1.000
        },
        park_factors: {
          default: 1.000
        },
        wrc_plus_constants: {
          lg_avg_woba: 0.320,
          woba_scale: 1.200,
          lg_runs_per_pa: 0.115
        }
      },
      computed_at: new Date().toISOString(),
      source: 'mock_data'
    };
    
    return NextResponse.json(mockConstants);
    
  } catch (error) {
    console.error('Error in constants API:', error);
    return NextResponse.json({
      error: 'Failed to load constants',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}