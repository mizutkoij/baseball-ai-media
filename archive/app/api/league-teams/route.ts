import { NextRequest, NextResponse } from 'next/server';
import { queryLeague, League } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = (searchParams.get('league') || 'npb') as League;
  const season = searchParams.get('season') || '2025';

  try {
    // Validate league parameter
    const validLeagues: League[] = ['npb', 'mlb', 'kbo', 'international'];
    if (!validLeagues.includes(league)) {
      return NextResponse.json(
        { error: 'Invalid league parameter' },
        { status: 400 }
      );
    }

    // Query teams for the specified league
    const sql = `
      SELECT 
        team_id,
        team_name,
        league_division,
        city,
        founded_year,
        stadium,
        manager,
        wins,
        losses,
        ties,
        win_percentage,
        games_behind,
        last_updated
      FROM teams 
      WHERE season = ? 
      ORDER BY win_percentage DESC, wins DESC
    `;

    const teams = await queryLeague(league, sql, [season]);

    // Get league standings structure
    const standings = getLeagueStandings(teams, league);

    return NextResponse.json({
      teams,
      standings,
      league: {
        code: league,
        name: getLeagueName(league),
        season: season
      },
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error(`${league} teams API error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getLeagueName(league: League): string {
  switch (league) {
    case 'npb':
      return 'NPB (日本プロ野球)';
    case 'mlb':
      return 'MLB (メジャーリーグ)';
    case 'kbo':
      return 'KBO (韓国プロ野球)';
    case 'international':
      return 'International Baseball';
    default:
      return 'Unknown League';
  }
}

function getLeagueStandings(teams: any[], league: League): any {
  if (league === 'npb') {
    // NPB has Central and Pacific leagues
    const central = teams.filter(team => team.league_division?.includes('Central') || team.league_division?.includes('セ'));
    const pacific = teams.filter(team => team.league_division?.includes('Pacific') || team.league_division?.includes('パ'));
    
    return {
      central: central.slice(0, 6),
      pacific: pacific.slice(0, 6)
    };
  } else if (league === 'mlb') {
    // MLB has American and National leagues
    const american = teams.filter(team => team.league_division?.includes('American') || team.league_division?.includes('AL'));
    const national = teams.filter(team => team.league_division?.includes('National') || team.league_division?.includes('NL'));
    
    return {
      american: american.slice(0, 15),
      national: national.slice(0, 15)
    };
  } else if (league === 'kbo') {
    // KBO has single league
    return {
      kbo: teams.slice(0, 10)
    };
  } else {
    return {
      all: teams
    };
  }
}