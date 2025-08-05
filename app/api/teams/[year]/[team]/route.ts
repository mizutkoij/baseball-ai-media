import { NextRequest, NextResponse } from "next/server";

// Add runtime config to prevent static generation
export const dynamic = 'force-dynamic';

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
  
  // Return mock data to avoid better-sqlite3 dependency
  return NextResponse.json({
    meta: {
      year,
      team,
      teamDisplayName: team,
      league: 'central',
      season_type: 'regular'
    },
    standings: null,
    batting_leaders: [],
    pitching_leaders: [],
    vs_opponents: [],
    summary: null,
    constants: null,
    distributions: null,
    promotions: null,
    splits: null,
    message: 'Mock data - Database functionality disabled for Vercel compatibility'
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}