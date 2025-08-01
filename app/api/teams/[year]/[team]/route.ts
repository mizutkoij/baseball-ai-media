import { NextRequest, NextResponse } from "next/server";
import {
  getTeamStandings,
  getTeamBattingLeaders,
  getTeamPitchingLeaders,
  getTeamVsOpponents,
  getTeamSummary,
  getTeamDistributions,
  getTeamPromotions,
  getTeamSplits,
  type TeamStandings,
  type LeaderRow,
  type TeamSummary,
  type OpponentRecord,
  type TeamConstants,
  type TeamDistributionData,
  type PromotionData,
  type TeamSplitStats
} from "@/lib/db/teamQueries";

const DatabaseLib = require('better-sqlite3');

function getDb() {
  const dbPath = process.env.DB_HISTORY || './data/db_history.db';
  return new DatabaseLib(dbPath);
}

export interface TeamPageData {
  meta: {
    year: number;
    league: 'central' | 'pacific';
    team: string;
    pf: number;
    updated_at: string;
  };
  standings: TeamStandings;
  summary: TeamSummary;
  leaders: {
    hitters: LeaderRow[];
    pitchers: LeaderRow[];
  };
  vs_opponent: OpponentRecord[];
  distributions?: TeamDistributionData[];
  promotions?: PromotionData[];
  splits?: TeamSplitStats[];
  links: {
    season: string;
    players: string;
    records: string;
  };
  provenance: {
    source: string;
    generated_at: string;
    cache_status: string;
  };
}

// Response cache - 10 minutes for current year, 1 hour for past years
const cache = new Map<string, { data: TeamPageData; timestamp: number }>();

async function loadConstants(year: number, league: string): Promise<TeamConstants> {
  try {
    const constantsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/constants?year=${year}&league=${league}`);
    
    if (!constantsResponse.ok) {
      throw new Error(`Constants not available for ${year} ${league}`);
    }
    
    const constantsData = await constantsResponse.json();
    const constants = constantsData.constants;
    
    return {
      woba_scale: constants.woba_scale || 1.15,
      woba_fip: constants.woba_fip || 3.2,
      lg_woba: constants.lg_woba || 0.320,
      lg_r_pa: constants.lg_r_pa || 0.11,
      lg_fip: constants.lg_fip || 4.0,
      PF: constants.PF || 1.0
    };
  } catch (error) {
    console.warn(`Failed to load constants for ${year} ${league}, using defaults:`, error);
    // Return reasonable defaults
    return {
      woba_scale: 1.15,
      woba_fip: 3.2,
      lg_woba: 0.320,
      lg_r_pa: 0.11,
      lg_fip: 4.0,
      PF: 1.0
    };
  }
}

function determineLeague(team: string): 'central' | 'pacific' {
  const centralTeams = ['T', 'S', 'C', 'YS', 'D', 'G']; // Tigers, Swallows, Carp, DeNA, Dragons, Giants
  const pacificTeams = ['H', 'L', 'E', 'M', 'F', 'B']; // Hawks, Lions, Eagles, Marines, Fighters, Buffaloes
  
  if (centralTeams.includes(team)) return 'central';
  if (pacificTeams.includes(team)) return 'pacific';
  
  // Fallback - try to determine from first letter or common patterns
  if (['巨人', 'ヤクルト', '中日', '阪神', '広島', 'DeNA'].some(t => team.includes(t))) {
    return 'central';
  }
  
  return 'pacific'; // Default fallback
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
  
  const league = determineLeague(team);
  const cacheKey = `${year}_${team}_${league}`;
  const now = Date.now();
  
  // Check cache
  const cached = cache.get(cacheKey);
  const cacheExpiryMs = year === new Date().getFullYear() ? 10 * 60 * 1000 : 60 * 60 * 1000;
  
  if (cached && (now - cached.timestamp) < cacheExpiryMs) {
    return NextResponse.json(cached.data, {
      headers: {
        'Cache-Control': `s-maxage=${Math.floor(cacheExpiryMs / 1000)}, stale-while-revalidate=86400`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  try {
    const db = getDb();
    
    // Load constants
    const constants = await loadConstants(year, league);
    
    // Get all team data in parallel where possible
    const [standings, battingLeaders, pitchingLeaders, vsOpponents, summary, distributions, promotions, splits] = await Promise.all([
      Promise.resolve(getTeamStandings(db, year, league, team)),
      Promise.resolve(getTeamBattingLeaders(db, year, team, constants, 5)),
      Promise.resolve(getTeamPitchingLeaders(db, year, team, constants, 5)),
      Promise.resolve(getTeamVsOpponents(db, year, team)),
      Promise.resolve(getTeamSummary(db, year, team, constants)),
      Promise.resolve(getTeamDistributions(db, year, team, constants)),
      Promise.resolve(getTeamPromotions(db, year, team, constants)),
      Promise.resolve(getTeamSplits(db, year, team, constants))
    ]);
    
    db.close();
    
    // Find this team's standings
    const teamStanding = standings.find(s => s.team === team);
    if (!teamStanding) {
      return NextResponse.json({ 
        error: "Team not found",
        message: `No data found for team ${team} in ${year}`
      }, { status: 404 });
    }
    
    // Build response data
    const teamData: TeamPageData = {
      meta: {
        year,
        league,
        team,
        pf: constants.PF,
        updated_at: new Date().toISOString()
      },
      standings: teamStanding,
      summary,
      leaders: {
        hitters: battingLeaders,
        pitchers: pitchingLeaders
      },
      vs_opponent: vsOpponents,
      distributions: distributions.length > 0 ? distributions : undefined,
      promotions: promotions.length > 0 ? promotions : undefined,
      splits: splits.length > 0 ? splits : undefined,
      links: {
        season: `/seasons/${year}`,
        players: `/players?team=${team}&year=${year}`,
        records: `/records?year=${year}`
      },
      provenance: {
        source: "live_database",
        generated_at: new Date().toISOString(),
        cache_status: cached ? "hit" : "miss"
      }
    };
    
    // Cache the result
    cache.set(cacheKey, { data: teamData, timestamp: now });
    
    // Log analytics
    console.log(`Team page generated: ${year} ${team} (${league})`);
    
    return NextResponse.json(teamData, {
      headers: {
        'Cache-Control': `s-maxage=${Math.floor(cacheExpiryMs / 1000)}, stale-while-revalidate=86400`,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error: any) {
    console.error(`Team API error for ${year} ${team}:`, error);
    
    // Try to serve from static fallback if available
    try {
      const fallbackPath = `/data/teams/${year}/${team}.json`;
      const fallbackResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}${fallbackPath}`);
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        return NextResponse.json({
          ...fallbackData,
          provenance: {
            source: "static_fallback",
            generated_at: fallbackData.provenance?.generated_at || new Date().toISOString(),
            cache_status: "fallback"
          }
        });
      }
    } catch (fallbackError) {
      // Fallback failed, continue with error response
    }
    
    return NextResponse.json({
      error: "team_data_unavailable",
      message: "Failed to load team data",
      details: error.message
    }, { status: 500 });
  }
}

// Also support team list endpoint
export async function POST(req: NextRequest) {
  try {
    const { year, league } = await req.json();
    
    if (!year || !league) {
      return NextResponse.json({ error: "Year and league required" }, { status: 400 });
    }
    
    const db = getDb();
    const standings = getTeamStandings(db, year, league);
    db.close();
    
    return NextResponse.json({
      year,
      league,
      teams: standings.map(s => ({
        team: s.team,
        W: s.W,
        L: s.L,
        D: s.D,
        rank: s.rank
      }))
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: "failed_to_load_teams",
      message: error.message
    }, { status: 500 });
  }
}