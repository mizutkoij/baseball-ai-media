import { NextRequest, NextResponse } from 'next/server';

/**
 * リーグ定数API
 * GET /api/constants?year=2024&league=first
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || new Date().getFullYear().toString();
  const league = searchParams.get('league') || 'first';
  
  try {
    // Dynamic imports to prevent build-time issues
    const fs = await import('fs');
    const path = await import('path');
    
    // constants ファイル読み込み
    const constantsPath = path.join(process.cwd(), 'public', 'data', 'constants', 'league_constants.json');
    
    if (!fs.existsSync(constantsPath)) {
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