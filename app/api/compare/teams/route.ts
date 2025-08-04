import { NextRequest } from "next/server";
// Database import moved to dynamic import in function

interface TeamComparisonData {
  team_code: string;
  team_name: string;
  league: 'central' | 'pacific';
  year: number;
  
  // Team standings
  wins: number;
  losses: number;
  pct: number;
  rank: number;
  games_back: number;
  
  // Batting stats (team totals)
  team_batting: {
    games: number;
    PA: number;
    AB: number;
    R: number;
    H: number;
    HR: number;
    RBI: number;
    BB: number;
    SO: number;
    AVG: number;
    OBP: number;
    SLG: number;
    OPS: number;
    wRC_plus: number;
    wRC_plus_neutral?: number;
    OPS_plus: number;
    OPS_plus_neutral?: number;
    ISO: number;
    BABIP: number;
    K_pct: number;
    BB_pct: number;
  };
  
  // Pitching stats (team totals)
  team_pitching: {
    games: number;
    IP: number;
    H_allowed: number;
    R_allowed: number;
    ER: number;
    BB_allowed: number;
    SO_pitched: number;
    HR_allowed: number;
    ERA: number;
    ERA_neutral?: number;
    WHIP: number;
    FIP: number;
    FIP_neutral?: number;
    ERA_minus: number;
    ERA_minus_neutral?: number;
    FIP_minus: number;
    FIP_minus_neutral?: number;
    K_9: number;
    BB_9: number;
    K_pct: number;
    BB_pct: number;
  };
  
  // Home/Away splits
  home_away_split: {
    home: {
      wins: number;
      losses: number;
      pct: number;
      runs_scored: number;
      runs_allowed: number;
    };
    away: {
      wins: number;
      losses: number;  
      pct: number;
      runs_scored: number;
      runs_allowed: number;
    };
  };
  
  // Park factor
  avg_park_factor: number;
}

interface CompareTeamsResponse {
  teams: TeamComparisonData[];
  comparison_summary: {
    batting_leaders: {
      wRC_plus: { team: string; value: number; rank_change?: number };
      OPS_plus: { team: string; value: number; rank_change?: number };
      ISO: { team: string; value: number; rank_change?: number };
      K_pct_low: { team: string; value: number; rank_change?: number };
    };
    pitching_leaders: {
      ERA_minus: { team: string; value: number; rank_change?: number };
      FIP_minus: { team: string; value: number; rank_change?: number };
      K_pct: { team: string; value: number; rank_change?: number };
      WHIP: { team: string; value: number; rank_change?: number };
    };
    pf_correction_effects: Array<{
      team: string;
      metric: string;
      original_rank: number;
      corrected_rank: number;
      rank_change: number;
      comment: string;
    }>;
    auto_summary: string;
  };
  pf_correction: boolean;
  year: number;
  league_context: {
    central_avg_wRC_plus: number;
    pacific_avg_wRC_plus: number;
    central_avg_ERA_minus: number;
    pacific_avg_ERA_minus: number;
  };
}

const TEAM_NAMES: Record<string, string> = {
  'G': '読売ジャイアンツ',
  'T': '阪神タイガース', 
  'C': '広島東洋カープ',
  'YS': '横浜DeNAベイスターズ',
  'D': '中日ドラゴンズ',
  'S': '東京ヤクルトスワローズ',
  'H': 'ソフトバンクホークス',
  'L': '埼玉西武ライオンズ',
  'E': '東北楽天ゴールデンイーグルス',
  'M': '千葉ロッテマリーンズ',
  'F': '北海道日本ハムファイターズ',
  'B': 'オリックス・バファローズ'
};

const LEAGUE_MAPPING: Record<string, 'central' | 'pacific'> = {
  'G': 'central', 'T': 'central', 'C': 'central', 'YS': 'central', 'D': 'central', 'S': 'central',
  'H': 'pacific', 'L': 'pacific', 'E': 'pacific', 'M': 'pacific', 'F': 'pacific', 'B': 'pacific'
};

// Mock data generator for development
function generateMockTeamComparison(teamCodes: string[], year: number, pfCorrection: boolean): CompareTeamsResponse {
  const validTeams = teamCodes.filter(code => TEAM_NAMES[code]);
  
  const mockTeams: TeamComparisonData[] = validTeams.map((teamCode, index) => {
    const teamName = TEAM_NAMES[teamCode];
    const league = LEAGUE_MAPPING[teamCode];
    const parkFactor = 0.95 + Math.random() * 0.1; // 0.95 - 1.05
    
    // Generate realistic team stats
    const wins = 60 + Math.floor(Math.random() * 25);
    const losses = 143 - wins;
    const pct = wins / (wins + losses);
    
    const battingStats = {
      games: 143,
      PA: 5800 + Math.floor(Math.random() * 400),
      AB: 5200 + Math.floor(Math.random() * 300),
      R: 550 + Math.floor(Math.random() * 200),
      H: 1350 + Math.floor(Math.random() * 200),
      HR: 120 + Math.floor(Math.random() * 80),
      RBI: 520 + Math.floor(Math.random() * 180),
      BB: 450 + Math.floor(Math.random() * 150),
      SO: 1200 + Math.floor(Math.random() * 300),
      AVG: 0.245 + Math.random() * 0.040,
      OBP: 0.315 + Math.random() * 0.040,
      SLG: 0.390 + Math.random() * 0.080,
      OPS: 0.705 + Math.random() * 0.120,
      wRC_plus: 85 + Math.floor(Math.random() * 30),
      wRC_plus_neutral: pfCorrection ? (85 + Math.floor(Math.random() * 30)) + Math.floor(Math.random() * 20) - 10 : undefined,
      OPS_plus: 85 + Math.floor(Math.random() * 30),
      OPS_plus_neutral: pfCorrection ? (85 + Math.floor(Math.random() * 30)) + Math.floor(Math.random() * 20) - 10 : undefined,
      ISO: 0.140 + Math.random() * 0.060,
      BABIP: 0.290 + Math.random() * 0.030,
      K_pct: 20 + Math.random() * 8,
      BB_pct: 8 + Math.random() * 4
    };

    const pitchingStats = {
      games: 143,
      IP: 1280 + Math.floor(Math.random() * 40),
      H_allowed: 1250 + Math.floor(Math.random() * 200),
      R_allowed: 580 + Math.floor(Math.random() * 200),
      ER: 520 + Math.floor(Math.random() * 180),
      BB_allowed: 420 + Math.floor(Math.random() * 120),
      SO_pitched: 1150 + Math.floor(Math.random() * 300),
      HR_allowed: 125 + Math.floor(Math.random() * 60),
      ERA: 3.50 + Math.random() * 1.20,
      ERA_neutral: pfCorrection ? (3.50 + Math.random() * 1.20) + (Math.random() - 0.5) * 0.4 : undefined,
      WHIP: 1.25 + Math.random() * 0.25,
      FIP: 3.80 + Math.random() * 1.00,
      FIP_neutral: pfCorrection ? (3.80 + Math.random() * 1.00) + (Math.random() - 0.5) * 0.3 : undefined,
      ERA_minus: 90 + Math.floor(Math.random() * 20),
      ERA_minus_neutral: pfCorrection ? (90 + Math.floor(Math.random() * 20)) + Math.floor(Math.random() * 15) - 7 : undefined,
      FIP_minus: 95 + Math.floor(Math.random() * 15),
      FIP_minus_neutral: pfCorrection ? (95 + Math.floor(Math.random() * 15)) + Math.floor(Math.random() * 12) - 6 : undefined,
      K_9: 8.0 + Math.random() * 2.0,
      BB_9: 2.8 + Math.random() * 1.2,
      K_pct: 21 + Math.random() * 6,
      BB_pct: 7.5 + Math.random() * 2.5
    };

    return {
      team_code: teamCode,
      team_name: teamName,
      league,
      year,
      wins,
      losses,
      pct,
      rank: index + 1, // Simplified ranking
      games_back: index * 3,
      team_batting: battingStats,
      team_pitching: pitchingStats,
      home_away_split: {
        home: {
          wins: Math.floor(wins * 0.55),
          losses: Math.floor(losses * 0.45),
          pct: 0.520 + Math.random() * 0.080,
          runs_scored: Math.floor(battingStats.R * 0.52),
          runs_allowed: Math.floor(pitchingStats.R_allowed * 0.48)
        },
        away: {
          wins: wins - Math.floor(wins * 0.55),
          losses: losses - Math.floor(losses * 0.45),
          pct: 0.480 + Math.random() * 0.080,
          runs_scored: Math.floor(battingStats.R * 0.48),
          runs_allowed: Math.floor(pitchingStats.R_allowed * 0.52)
        }
      },
      avg_park_factor: parkFactor
    };
  });

  // Generate comparison summary
  const battingLeader = mockTeams.reduce((best, team) => 
    (pfCorrection && team.team_batting.wRC_plus_neutral ? team.team_batting.wRC_plus_neutral : team.team_batting.wRC_plus) > 
    (pfCorrection && best.team_batting.wRC_plus_neutral ? best.team_batting.wRC_plus_neutral : best.team_batting.wRC_plus) ? team : best
  );

  const pitchingLeader = mockTeams.reduce((best, team) => 
    (pfCorrection && team.team_pitching.ERA_minus_neutral ? team.team_pitching.ERA_minus_neutral : team.team_pitching.ERA_minus) < 
    (pfCorrection && best.team_pitching.ERA_minus_neutral ? best.team_pitching.ERA_minus_neutral : best.team_pitching.ERA_minus) ? team : best
  );

  // Generate PF correction effects
  const pfEffects = pfCorrection ? mockTeams.map((team, index) => ({
    team: team.team_name,
    metric: 'wRC+',
    original_rank: index + 1,
    corrected_rank: index + 1 + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 2),
    rank_change: Math.random() > 0.5 ? 1 : -1,
    comment: Math.random() > 0.5 ? 'PF補正で順位上昇' : 'PF補正で順位下降'
  })) : [];

  const autoSummary = `${year}年のwRC+トップは${battingLeader.team_name}（${Math.round(pfCorrection && battingLeader.team_batting.wRC_plus_neutral ? battingLeader.team_batting.wRC_plus_neutral : battingLeader.team_batting.wRC_plus)}）。投手では${pitchingLeader.team_name}がERA-最優秀。${pfCorrection ? 'PF補正により順位変動あり。' : ''}`;

  return {
    teams: mockTeams,
    comparison_summary: {
      batting_leaders: {
        wRC_plus: { 
          team: battingLeader.team_name, 
          value: Math.round(pfCorrection && battingLeader.team_batting.wRC_plus_neutral ? battingLeader.team_batting.wRC_plus_neutral : battingLeader.team_batting.wRC_plus),
          rank_change: pfCorrection ? Math.floor(Math.random() * 3) - 1 : undefined
        },
        OPS_plus: { team: battingLeader.team_name, value: battingLeader.team_batting.OPS_plus },
        ISO: { team: battingLeader.team_name, value: Math.round(battingLeader.team_batting.ISO * 1000) / 1000 },
        K_pct_low: { team: mockTeams[0].team_name, value: Math.round(mockTeams[0].team_batting.K_pct * 10) / 10 }
      },
      pitching_leaders: {
        ERA_minus: { 
          team: pitchingLeader.team_name, 
          value: Math.round(pfCorrection && pitchingLeader.team_pitching.ERA_minus_neutral ? pitchingLeader.team_pitching.ERA_minus_neutral : pitchingLeader.team_pitching.ERA_minus),
          rank_change: pfCorrection ? Math.floor(Math.random() * 3) - 1 : undefined
        },
        FIP_minus: { team: pitchingLeader.team_name, value: pitchingLeader.team_pitching.FIP_minus },
        K_pct: { team: pitchingLeader.team_name, value: Math.round(pitchingLeader.team_pitching.K_pct * 10) / 10 },
        WHIP: { team: mockTeams[0].team_name, value: Math.round(mockTeams[0].team_pitching.WHIP * 100) / 100 }
      },
      pf_correction_effects: pfEffects,
      auto_summary: autoSummary
    },
    pf_correction: pfCorrection,
    year,
    league_context: {
      central_avg_wRC_plus: 100,
      pacific_avg_wRC_plus: 98,
      central_avg_ERA_minus: 102,
      pacific_avg_ERA_minus: 98
    }
  };
}

export async function GET(req: NextRequest) {
  try {
    // Build-time safety guard
    if (process.env.NODE_ENV === 'production' && (!process.env.VERCEL_URL && !process.env.RUNTIME)) {
      return new Response('API not available during build', { status: 503 });
    }

    // Dynamic import to prevent build-time database connection
    const { query, unionQuery } = await import('@/lib/db');
    
    // Original code continues
    const { searchParams } = new URL(req.url);
    const teamsParam = searchParams.get("teams");
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const pfCorrection = searchParams.get("pf") === "true";

    // Validation and fallback processing
    if (!teamsParam) {
      return Response.json({
        error: "Missing teams parameter",
        message: "Please provide comma-separated team codes (e.g., ?teams=G,T,C,H)",
        available_teams: Object.keys(TEAM_NAMES)
      }, { status: 400 });
    }

    let teamCodes = teamsParam.split(',').map(code => code.trim().toUpperCase()).filter(Boolean);
    
    // Remove duplicates
    teamCodes = Array.from(new Set(teamCodes));
    
    // Filter out invalid team codes
    const validTeamCodes = teamCodes.filter(code => TEAM_NAMES[code]);
    const invalidCodes = teamCodes.filter(code => !TEAM_NAMES[code]);
    
    if (validTeamCodes.length === 0) {
      return Response.json({
        error: "No valid team codes provided",
        message: "Please provide valid NPB team codes",
        invalid_codes: invalidCodes,
        available_teams: Object.keys(TEAM_NAMES)
      }, { status: 400 });
    }

    if (validTeamCodes.length > 6) {
      return Response.json({
        error: "Too many teams",
        message: "Maximum 6 teams can be compared at once",
        provided_count: validTeamCodes.length
      }, { status: 400 });
    }

    // Generate comparison data
    const comparisonData = generateMockTeamComparison(validTeamCodes, year, pfCorrection);

    // Add warnings for invalid/duplicate teams
    const response = {
      ...comparisonData,
      ...(invalidCodes.length > 0 && {
        warnings: {
          invalid_team_codes: invalidCodes,
          message: `Invalid team codes ignored: ${invalidCodes.join(', ')}`
        }
      })
    };

    return Response.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error("Compare teams API error:", error);
    return Response.json({
      error: "Internal server error",
      message: "Failed to fetch team comparison data"
    }, { status: 500 });
  }
}

// Actual database implementation (commented out for now)
/*
async function getTeamComparison(teamCodes: string[], year: number, pfCorrection: boolean): Promise<CompareTeamsResponse> {
  const placeholders = teamCodes.map(() => '?').join(',');
  
  const sql = `
    WITH team_batting_stats AS (
      SELECT 
        b.team,
        COUNT(DISTINCT g.game_id) as games,
        SUM(b.AB) as AB,
        SUM(b.R) as R,
        SUM(b.H) as H,
        SUM(b.HR) as HR,
        SUM(b.RBI) as RBI,
        SUM(b.BB) as BB,
        SUM(b.SO) as SO,
        AVG(team_pf.wRC_plus) as wRC_plus,
        AVG(team_pf.wRC_plus_neutral) as wRC_plus_neutral,
        -- Calculate other advanced metrics...
        AVG(pf.home_factor) as avg_pf
      FROM box_batting b
      JOIN games g ON b.game_id = g.game_id  
      LEFT JOIN park_factors pf ON g.venue = pf.venue AND strftime('%Y', g.date) = pf.year
      WHERE b.team IN (${placeholders})
      AND strftime('%Y', g.date) = ?
      GROUP BY b.team
    ),
    team_pitching_stats AS (
      SELECT 
        p.team,
        COUNT(DISTINCT g.game_id) as games,
        SUM(p.IP) as IP,
        SUM(p.ER) as ER,
        SUM(p.H) as H_allowed,
        -- Calculate pitching metrics...
        AVG(team_pf.ERA_minus) as ERA_minus,
        AVG(team_pf.ERA_minus_neutral) as ERA_minus_neutral
      FROM box_pitching p
      JOIN games g ON p.game_id = g.game_id
      WHERE p.team IN (${placeholders})
      AND strftime('%Y', g.date) = ?
      GROUP BY p.team
    )
    SELECT 
      tbs.*,
      tps.*,
      standings.wins,
      standings.losses,
      standings.pct,
      standings.rank
    FROM team_batting_stats tbs
    JOIN team_pitching_stats tps ON tbs.team = tps.team
    LEFT JOIN team_standings standings ON tbs.team = standings.team AND standings.year = ?
    ORDER BY standings.rank ASC
  `;
  
  const params = [...teamCodes, year, ...teamCodes, year, year];
  const results = await unionQuery<any>(sql, params);
  
  // Process results and calculate comparisons...
  
  return comparisonData;
}
*/