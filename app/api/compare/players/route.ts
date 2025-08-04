import { NextRequest } from "next/server";
// Database import moved to dynamic import in function

interface PlayerComparisonData {
  player_id: string;
  name: string;
  primary_pos: 'P' | 'B';
  years: Array<{
    year: number;
    team: string;
    league: string;
    // Batting stats
    games?: number;
    PA?: number;
    AB?: number;
    R?: number;
    H?: number;
    doubles?: number;
    triples?: number;
    HR?: number;
    RBI?: number;
    SB?: number;
    CS?: number;
    BB?: number;
    SO?: number;
    AVG?: number;
    OBP?: number;
    SLG?: number;
    OPS?: number;
    wRC_plus?: number;
    wRC_plus_neutral?: number;
    OPS_plus?: number;
    OPS_plus_neutral?: number;
    ISO?: number;
    BABIP?: number;
    K_pct?: number;
    BB_pct?: number;
    // Pitching stats
    W?: number;
    L?: number;
    ERA?: number;
    ERA_neutral?: number;
    WHIP?: number;
    IP?: number;
    H_allowed?: number;
    R_allowed?: number;
    ER?: number;
    BB_allowed?: number;
    SO_pitched?: number;
    HR_allowed?: number;
    FIP?: number;
    FIP_neutral?: number;
    ERA_minus?: number;
    ERA_minus_neutral?: number;
    FIP_minus?: number;
    FIP_minus_neutral?: number;
    K_9?: number;
    BB_9?: number;
    K_BB?: number;
    avg_pf?: number;
  }>;
  career_summary: {
    batting?: {
      total_years: number;
      total_games: number;
      total_PA: number;
      career_AVG: number;
      career_OPS: number;
      career_wRC_plus: number;
      career_wRC_plus_neutral?: number;
      best_year: { year: number; wRC_plus: number };
      peak_period: string;
    };
    pitching?: {
      total_years: number;
      total_games: number;
      total_IP: number;
      career_ERA: number;
      career_FIP: number;
      career_ERA_minus: number;
      career_ERA_minus_neutral?: number;
      best_year: { year: number; ERA_minus: number };
      peak_period: string;
    };
  };
}

interface ComparePlayersResponse {
  players: PlayerComparisonData[];
  comparison_summary: {
    batting?: {
      leaders: {
        wRC_plus: { player_id: string; name: string; value: number; year: number };
        OPS_plus: { player_id: string; name: string; value: number; year: number };
        ISO: { player_id: string; name: string; value: number; year: number };
        K_pct_low: { player_id: string; name: string; value: number; year: number };
      };
      trends: Array<{
        player_id: string;
        name: string;
        trend: 'improving' | 'declining' | 'stable';
        metric: string;
        description: string;
      }>;
    };
    pitching?: {
      leaders: {
        ERA_minus: { player_id: string; name: string; value: number; year: number };
        FIP_minus: { player_id: string; name: string; value: number; year: number };
        K_9: { player_id: string; name: string; value: number; year: number };
        WHIP: { player_id: string; name: string; value: number; year: number };
      };
      trends: Array<{
        player_id: string;
        name: string;
        trend: 'improving' | 'declining' | 'stable';
        metric: string;
        description: string;
      }>;
    };
    auto_summary: string;
  };
  pf_correction: boolean;
  year_range: {
    from: number;
    to: number;
  };
}

// Mock data generator for development
function generateMockComparison(playerIds: string[], pfCorrection: boolean, yearFrom: number, yearTo: number): ComparePlayersResponse {
  const mockPlayers: PlayerComparisonData[] = playerIds.map((playerId, index) => {
    const isBatter = index < 2; // First 2 are batters, rest are pitchers
    const playerName = `選手${String.fromCharCode(65 + index)}`; // Player A, B, C...
    
    const years = [];
    for (let year = yearFrom; year <= yearTo; year++) {
      const baseStats = {
        year,
        team: ['G', 'T', 'C', 'YS', 'D', 'S'][Math.floor(Math.random() * 6)],
        league: 'NPB',
        avg_pf: 1.0 + (Math.random() - 0.5) * 0.2, // 0.9 - 1.1
      };

      if (isBatter) {
        years.push({
          ...baseStats,
          games: 120 + Math.floor(Math.random() * 20),
          PA: 450 + Math.floor(Math.random() * 100),
          AB: 400 + Math.floor(Math.random() * 80),
          R: 60 + Math.floor(Math.random() * 40),
          H: 120 + Math.floor(Math.random() * 60),
          HR: 15 + Math.floor(Math.random() * 25),
          RBI: 60 + Math.floor(Math.random() * 40),
          BB: 40 + Math.floor(Math.random() * 30),
          SO: 80 + Math.floor(Math.random() * 40),
          AVG: 0.250 + Math.random() * 0.100,
          OBP: 0.320 + Math.random() * 0.080,
          SLG: 0.400 + Math.random() * 0.200,
          wRC_plus: 90 + Math.floor(Math.random() * 60),
          wRC_plus_neutral: pfCorrection ? (90 + Math.floor(Math.random() * 60)) + Math.floor(Math.random() * 20) - 10 : undefined,
          OPS_plus: 90 + Math.floor(Math.random() * 60),
          OPS_plus_neutral: pfCorrection ? (90 + Math.floor(Math.random() * 60)) + Math.floor(Math.random() * 20) - 10 : undefined,
          ISO: 0.150 + Math.random() * 0.100,
          BABIP: 0.280 + Math.random() * 0.060,
          K_pct: 15 + Math.random() * 15,
          BB_pct: 8 + Math.random() * 8,
        });
      } else {
        years.push({
          ...baseStats,
          games: 25 + Math.floor(Math.random() * 10),
          W: 8 + Math.floor(Math.random() * 8),
          L: 6 + Math.floor(Math.random() * 8),
          IP: 150 + Math.floor(Math.random() * 50),
          ERA: 3.00 + Math.random() * 2.00,
          ERA_neutral: pfCorrection ? (3.00 + Math.random() * 2.00) + (Math.random() - 0.5) * 0.5 : undefined,
          WHIP: 1.20 + Math.random() * 0.40,
          FIP: 3.50 + Math.random() * 1.50,
          FIP_neutral: pfCorrection ? (3.50 + Math.random() * 1.50) + (Math.random() - 0.5) * 0.3 : undefined,
          ERA_minus: 80 + Math.floor(Math.random() * 40),
          ERA_minus_neutral: pfCorrection ? (80 + Math.floor(Math.random() * 40)) + Math.floor(Math.random() * 20) - 10 : undefined,
          FIP_minus: 85 + Math.floor(Math.random() * 30),
          FIP_minus_neutral: pfCorrection ? (85 + Math.floor(Math.random() * 30)) + Math.floor(Math.random() * 20) - 10 : undefined,
          K_9: 7.0 + Math.random() * 4.0,
          BB_9: 2.5 + Math.random() * 2.0,
          SO_pitched: 140 + Math.floor(Math.random() * 60),
        });
      }
    }

    return {
      player_id: playerId,
      name: playerName,
      primary_pos: isBatter ? 'B' : 'P',
      years,
      career_summary: isBatter ? {
        batting: {
          total_years: years.length,
          total_games: years.reduce((sum, y) => sum + (y.games || 0), 0),
          total_PA: years.filter(y => 'PA' in y).reduce((sum, y) => sum + ((y as any).PA || 0), 0),
          career_AVG: years.filter(y => 'AVG' in y).reduce((sum, y) => sum + ((y as any).AVG || 0), 0) / years.length,
          career_OPS: years.filter(y => 'OBP' in y && 'SLG' in y).reduce((sum, y) => sum + (((y as any).OBP || 0) + ((y as any).SLG || 0)), 0) / years.length,
          career_wRC_plus: years.filter(y => 'wRC_plus' in y).reduce((sum, y) => sum + ((y as any).wRC_plus || 0), 0) / years.length,
          career_wRC_plus_neutral: pfCorrection ? years.filter(y => 'wRC_plus_neutral' in y).reduce((sum, y) => sum + ((y as any).wRC_plus_neutral || 0), 0) / years.length : undefined,
          best_year: years.filter(y => 'wRC_plus' in y).reduce((best, y) => (((y as any).wRC_plus || 0) > best.wRC_plus ? { year: y.year, wRC_plus: (y as any).wRC_plus || 0 } : best), { year: yearFrom, wRC_plus: 0 }),
          peak_period: `${yearFrom}-${yearTo}`
        }
      } : {
        pitching: {
          total_years: years.length,
          total_games: years.reduce((sum, y) => sum + (y.games || 0), 0),
          total_IP: years.filter(y => 'IP' in y).reduce((sum, y) => sum + ((y as any).IP || 0), 0),
          career_ERA: years.filter(y => 'ERA' in y).reduce((sum, y) => sum + ((y as any).ERA || 0), 0) / years.length,
          career_FIP: years.filter(y => 'FIP' in y).reduce((sum, y) => sum + ((y as any).FIP || 0), 0) / years.length,
          career_ERA_minus: years.filter(y => 'ERA_minus' in y).reduce((sum, y) => sum + ((y as any).ERA_minus || 0), 0) / years.length,
          career_ERA_minus_neutral: pfCorrection ? years.filter(y => 'ERA_minus_neutral' in y).reduce((sum, y) => sum + ((y as any).ERA_minus_neutral || 0), 0) / years.length : undefined,
          best_year: years.filter(y => 'ERA_minus' in y).reduce((best, y) => (((y as any).ERA_minus || 200) < best.ERA_minus ? { year: y.year, ERA_minus: (y as any).ERA_minus || 200 } : best), { year: yearFrom, ERA_minus: 200 }),
          peak_period: `${yearFrom}-${yearTo}`
        }
      }
    };
  });

  // Generate auto summary
  const batters = mockPlayers.filter(p => p.primary_pos === 'B');
  const pitchers = mockPlayers.filter(p => p.primary_pos === 'P');
  
  let autoSummary = '';
  if (batters.length > 0) {
    const topBatter = batters.reduce((best, p) => 
      (p.career_summary.batting?.career_wRC_plus || 0) > (best.career_summary.batting?.career_wRC_plus || 0) ? p : best
    );
    autoSummary += `${yearFrom}–${yearTo}でwRC+トップは${topBatter.name}（${Math.round(topBatter.career_summary.batting?.career_wRC_plus || 0)}）。`;
  }
  if (pitchers.length > 0) {
    const topPitcher = pitchers.reduce((best, p) => 
      (p.career_summary.pitching?.career_ERA_minus || 200) < (best.career_summary.pitching?.career_ERA_minus || 200) ? p : best
    );
    autoSummary += `投手では${topPitcher.name}がERA-（${Math.round(topPitcher.career_summary.pitching?.career_ERA_minus || 0)}）で最優秀。`;
  }

  return {
    players: mockPlayers,
    comparison_summary: {
      ...(batters.length > 0 && {
        batting: {
          leaders: {
            wRC_plus: { player_id: batters[0].player_id, name: batters[0].name, value: 142, year: yearTo },
            OPS_plus: { player_id: batters[0].player_id, name: batters[0].name, value: 138, year: yearTo },
            ISO: { player_id: batters[0].player_id, name: batters[0].name, value: 0.220, year: yearTo },
            K_pct_low: { player_id: batters[0].player_id, name: batters[0].name, value: 12.5, year: yearTo },
          },
          trends: [{
            player_id: batters[0].player_id,
            name: batters[0].name,
            trend: 'improving',
            metric: 'K%',
            description: 'K%改善で上昇傾向'
          }]
        }
      }),
      ...(pitchers.length > 0 && {
        pitching: {
          leaders: {
            ERA_minus: { player_id: pitchers[0].player_id, name: pitchers[0].name, value: 75, year: yearTo },
            FIP_minus: { player_id: pitchers[0].player_id, name: pitchers[0].name, value: 82, year: yearTo },
            K_9: { player_id: pitchers[0].player_id, name: pitchers[0].name, value: 10.2, year: yearTo },
            WHIP: { player_id: pitchers[0].player_id, name: pitchers[0].name, value: 1.15, year: yearTo },
          },
          trends: [{
            player_id: pitchers[0].player_id,
            name: pitchers[0].name,
            trend: 'improving',
            metric: 'FIP',
            description: 'FIP向上により安定感増'
          }]
        }
      }),
      auto_summary: autoSummary
    },
    pf_correction: pfCorrection,
    year_range: { from: yearFrom, to: yearTo }
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
    
    const { searchParams } = new URL(req.url);
    const playerIds = searchParams.get("players");
    const pfCorrection = searchParams.get("pf") === "true";
    const yearFrom = parseInt(searchParams.get("from") || "2022");
    const yearTo = parseInt(searchParams.get("to") || "2024");

    // Validation
    if (!playerIds) {
      return Response.json({
        error: "Missing players parameter",
        message: "Please provide comma-separated player IDs"
      }, { status: 400 });
    }

    const playerIdArray = playerIds.split(',').map(id => id.trim()).filter(Boolean);
    
    if (playerIdArray.length === 0 || playerIdArray.length > 5) {
      return Response.json({
        error: "Invalid number of players",
        message: "Please provide 1-5 player IDs"
      }, { status: 400 });
    }

    // For now, use mock data
    // In production, this would query the actual database
    const comparisonData = generateMockComparison(playerIdArray, pfCorrection, yearFrom, yearTo);

    return Response.json(comparisonData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error("Compare players API error:", error);
    return Response.json({
      error: "Internal server error",
      message: "Failed to fetch player comparison data"
    }, { status: 500 });
  }
}

// Actual database implementation (commented out for now)
/*
async function getPlayerComparison(playerIds: string[], pfCorrection: boolean, yearFrom: number, yearTo: number): Promise<ComparePlayersResponse> {
  const placeholders = playerIds.map(() => '?').join(',');
  
  const sql = `
    WITH player_seasons AS (
      SELECT 
        p.player_id,
        p.name,
        p.primary_pos,
        strftime('%Y', g.date) as year,
        b.team,
        b.league,
        COUNT(DISTINCT g.game_id) as games,
        SUM(b.AB) as AB,
        SUM(b.R) as R,
        SUM(b.H) as H,
        SUM(b.singles_2B) as doubles,
        SUM(b.singles_3B) as triples,
        SUM(b.HR) as HR,
        SUM(b.RBI) as RBI,
        SUM(b.BB) as BB,
        SUM(b.SO) as SO,
        -- Calculate advanced stats
        CASE WHEN SUM(b.AB) > 0 THEN ROUND(CAST(SUM(b.H) AS FLOAT) / SUM(b.AB), 3) ELSE 0 END as AVG,
        -- Add more calculated fields...
        AVG(pf.home_factor) as avg_pf
      FROM players p
      JOIN box_batting b ON p.player_id = b.player_id
      JOIN games g ON b.game_id = g.game_id
      LEFT JOIN park_factors pf ON g.venue = pf.venue AND strftime('%Y', g.date) = pf.year
      WHERE p.player_id IN (${placeholders})
      AND CAST(strftime('%Y', g.date) AS INTEGER) BETWEEN ? AND ?
      GROUP BY p.player_id, p.name, p.primary_pos, strftime('%Y', g.date), b.team, b.league
      
      UNION ALL
      
      SELECT 
        p.player_id,
        p.name,
        p.primary_pos,
        strftime('%Y', g.date) as year,
        bp.team,
        bp.league,
        COUNT(DISTINCT g.game_id) as games,
        NULL as AB, NULL as R, NULL as H, NULL as doubles, NULL as triples, NULL as HR, NULL as RBI, NULL as BB, NULL as SO, NULL as AVG,
        SUM(bp.IP) as IP,
        SUM(bp.H) as H_allowed,
        SUM(bp.ER) as ER,
        -- Add pitching stats...
        AVG(pf.home_factor) as avg_pf
      FROM players p
      JOIN box_pitching bp ON p.player_id = bp.player_id
      JOIN games g ON bp.game_id = g.game_id
      LEFT JOIN park_factors pf ON g.venue = pf.venue AND strftime('%Y', g.date) = pf.year
      WHERE p.player_id IN (${placeholders})
      AND CAST(strftime('%Y', g.date) AS INTEGER) BETWEEN ? AND ?
      GROUP BY p.player_id, p.name, p.primary_pos, strftime('%Y', g.date), bp.team, bp.league
    )
    SELECT * FROM player_seasons
    ORDER BY player_id, year
  `;
  
  const params = [...playerIds, yearFrom, yearTo, ...playerIds, yearFrom, yearTo];
  const results = await unionQuery<any>(sql, params);
  
  // Process results into the required format...
  // This would involve complex data transformation and calculation
  
  return comparisonData;
}
*/