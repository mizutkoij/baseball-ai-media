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
    // Dynamic imports to prevent build-time issues
    const fs = await import('fs');
    const path = await import('path');
    
    // Return mock constants for Vercel compatibility
    console.warn('Constants file loading disabled for Vercel compatibility');
    
    if (false) { // Disabled filesystem access
      return NextResponse.json({
        error: 'Constants file not found',
        message: 'League constants have not been computed yet'
      }, { status: 404 });
    }
    
    const constantsData = JSON.parse(fs.readFileSync(constantsPath, 'utf8'));
    const key = `${year}_${league}`;
    
    if (!constantsData.constants[key]) {
      return NextResponse.json({
        error: 'Constants not found',
        message: `No constants available for ${year} ${league}`,
        available_keys: Object.keys(constantsData.constants)
      }, { status: 404 });
    }
    
    const constants = constantsData.constants[key];
    
    return NextResponse.json({
      year: parseInt(year),
      league,
      constants,
      meta: constantsData.meta,
      cache_info: {
        last_updated: constants.updated_at,
        sample_games: constants.sample_games
      }
    });
    
  } catch (error) {
    console.error('Error loading constants:', error);
    return NextResponse.json({
      error: 'Failed to load constants',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';