import { NextRequest, NextResponse } from "next/server";

// Add runtime config to prevent static generation
export const dynamic = 'force-dynamic';

// Export interface for components that import it
export interface TeamPageData {
  meta: {
    year: number;
    team: string;
    teamDisplayName: string;
    league: "central" | "pacific";
    season_type: string;
  };
  standings: any;
  batting_leaders: any[];
  pitching_leaders: any[];
  leaders: {
    hitters: any[];
    pitchers: any[];
  };
  vs_opponents: any[];
  vs_opponent: any[]; // Backward compatibility
  summary: any;
  constants: any;
  distributions: any;
  promotions: any;
  splits: any;
  links: {
    season: string;
    players: string;
    records: string;
  };
  message?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { year: string; team: string } }
): Promise<NextResponse> {
  const year = parseInt(params.year);
  const team = params.team;
  
  if (!year || year < 1950 || year > new Date().getFullYear()) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  
  if (!team) {
    return NextResponse.json({ error: "Team required" }, { status: 400 });
  }
  
  // Determine league based on team
  const centralTeams = ['G', 'T', 'C', 'YS', 'D', 'S'];
  const league: "central" | "pacific" = centralTeams.includes(team) ? 'central' : 'pacific';
  
  // Return mock data to avoid better-sqlite3 dependency
  return NextResponse.json({
    meta: {
      year,
      team,
      teamDisplayName: team,
      league,
      season_type: 'regular'
    },
    standings: null,
    batting_leaders: [],
    pitching_leaders: [],
    leaders: {
      hitters: [],
      pitchers: []
    },
    vs_opponents: [],
    vs_opponent: [], // Backward compatibility
    summary: null,
    constants: null,
    distributions: null,
    promotions: null,
    splits: null,
    links: {
      season: `/seasons/${year}`,
      players: `/players?team=${team}&year=${year}`,
      records: `/teams/${year}`
    },
    message: 'Mock data - Database functionality disabled for Vercel compatibility'
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}