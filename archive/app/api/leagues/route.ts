import { NextRequest, NextResponse } from 'next/server';
import { queryLeague, League } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = (searchParams.get('league') || 'npb') as League;
  
  try {
    // Validate league parameter
    const validLeagues: League[] = ['npb', 'mlb', 'kbo', 'international'];
    if (!validLeagues.includes(league)) {
      return NextResponse.json(
        { error: 'Invalid league parameter. Must be one of: npb, mlb, kbo, international' },
        { status: 400 }
      );
    }

    // Get basic league information
    const leagueInfo = {
      league,
      name: getLeagueName(league),
      description: getLeagueDescription(league),
      available: true
    };

    return NextResponse.json(leagueInfo);
  } catch (error) {
    console.error('League API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getLeagueName(league: League): string {
  switch (league) {
    case 'npb':
      return 'Nippon Professional Baseball';
    case 'mlb':
      return 'Major League Baseball';
    case 'kbo':
      return 'Korea Baseball Organization';
    case 'international':
      return 'International Baseball Comparison';
    default:
      return 'Unknown League';
  }
}

function getLeagueDescription(league: League): string {
  switch (league) {
    case 'npb':
      return '日本プロ野球 - セ・リーグとパ・リーグ';
    case 'mlb':
      return 'アメリカメジャーリーグ - ナショナルリーグとアメリカンリーグ';
    case 'kbo':
      return '韓国プロ野球';
    case 'international':
      return '国際野球比較データ';
    default:
      return '不明なリーグ';
  }
}