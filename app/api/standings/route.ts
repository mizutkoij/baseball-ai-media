import { NextRequest } from "next/server";
// Database import moved to dynamic import in function

interface TeamStanding {
  team_code: string;
  team_name: string;
  league: 'central' | 'pacific';
  wins: number;
  losses: number;
  draws: number;
  games_played: number;
  win_pct: number;
  games_back: number;
  rank: number;
  last_10: string; // e.g., "7-3"
  streak: string; // e.g., "W3", "L1"
  home_record: string; // e.g., "35-25"
  away_record: string; // e.g., "40-30"
  vs_central: string; // e.g., "45-35"
  vs_pacific: string; // e.g., "40-40"
  runs_scored: number;
  runs_allowed: number;
  run_diff: number;
}

interface StandingsResponse {
  central: TeamStanding[];
  pacific: TeamStanding[];
  last_updated: string;
  season: number;
  games_remaining: number;
  playoff_format: {
    central: {
      cs_teams: number;
      wildcard_teams: number;
    };
    pacific: {
      cs_teams: number;
      wildcard_teams: number;
    };
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

// Mock data generator for development
function generateMockStandings(year: number): StandingsResponse {
  const centralTeams = ['T', 'G', 'C', 'YS', 'D', 'S'];
  const pacificTeams = ['H', 'B', 'M', 'L', 'F', 'E'];
  
  const generateLeagueStandings = (teams: string[], league: 'central' | 'pacific'): TeamStanding[] => {
    return teams.map((teamCode, index) => {
      const wins = Math.max(50, 85 - index * 8 + Math.floor(Math.random() * 10));
      const losses = Math.max(40, 55 + index * 6 + Math.floor(Math.random() * 8));
      const draws = Math.floor(Math.random() * 8);
      const games_played = wins + losses + draws;
      const win_pct = wins / (wins + losses);
      const games_back = index === 0 ? 0 : index * 3.5 + Math.random() * 2;
      
      // Generate realistic additional stats
      const home_wins = Math.floor(wins * (0.52 + Math.random() * 0.08));
      const home_losses = Math.floor(losses * (0.48 + Math.random() * 0.08));
      const away_wins = wins - home_wins;
      const away_losses = losses - home_losses;
      
      const runs_scored = 450 + Math.floor(Math.random() * 200);
      const runs_allowed = 450 + Math.floor(Math.random() * 200);
      
      // Generate last 10 games record
      const last_10_wins = Math.floor(Math.random() * 8) + 2;
      const last_10_losses = 10 - last_10_wins;
      
      // Generate streak
      const streak_length = Math.floor(Math.random() * 4) + 1;
      const streak_type = Math.random() > 0.5 ? 'W' : 'L';
      
      return {
        team_code: teamCode,
        team_name: TEAM_NAMES[teamCode],
        league,
        wins,
        losses,
        draws,
        games_played,
        win_pct: Number(win_pct.toFixed(3)),
        games_back: Math.max(0, Number(games_back.toFixed(1))),
        rank: index + 1,
        last_10: `${last_10_wins}-${last_10_losses}`,
        streak: `${streak_type}${streak_length}`,
        home_record: `${home_wins}-${home_losses}`,
        away_record: `${away_wins}-${away_losses}`,
        vs_central: league === 'central' ? `${Math.floor(wins * 0.6)}-${Math.floor(losses * 0.6)}` : `${Math.floor(wins * 0.4)}-${Math.floor(losses * 0.4)}`,
        vs_pacific: league === 'pacific' ? `${Math.floor(wins * 0.6)}-${Math.floor(losses * 0.6)}` : `${Math.floor(wins * 0.4)}-${Math.floor(losses * 0.4)}`,
        runs_scored,
        runs_allowed,
        run_diff: runs_scored - runs_allowed
      };
    }).sort((a, b) => {
      if (a.win_pct !== b.win_pct) return b.win_pct - a.win_pct;
      return b.run_diff - a.run_diff; // Tiebreaker by run differential
    }).map((team, index) => ({ ...team, rank: index + 1, games_back: index === 0 ? 0 : Math.round(((teams[0] ? 85 : team.wins) - team.wins) * 0.5 * 10) / 10 }));
  };

  return {
    central: generateLeagueStandings(centralTeams, 'central'),
    pacific: generateLeagueStandings(pacificTeams, 'pacific'),
    last_updated: new Date().toISOString(),
    season: year,
    games_remaining: Math.max(0, 143 - Math.floor(Math.random() * 50)),
    playoff_format: {
      central: {
        cs_teams: 3,
        wildcard_teams: 2
      },
      pacific: {
        cs_teams: 3,
        wildcard_teams: 2
      }
    }
  };
}

export async function GET(req: NextRequest) {
  try {
    // Build-time safety guard
    if (process.env.NODE_ENV === 'production' && (!process.env.VERCEL_URL && !process.env.RUNTIME)) {
      return new Response('API not available during build', { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const league = searchParams.get("league"); // 'central', 'pacific', or null for both

    // Try to get real data from database
    try {
      const path = await import('path');
      const currentDbPath = path.join(process.cwd(), 'data', 'db_current.db');
      const fs = await import('fs');
      
      if (fs.existsSync(currentDbPath)) {
        const Database = require('better-sqlite3');
        const db = new Database(currentDbPath);
        
        // Build query based on league filter
        let leagueCondition = '';
        const params = [year];
        
        if (league === 'central') {
          leagueCondition = "AND league = 'central'";
        } else if (league === 'pacific') {
          leagueCondition = "AND league = 'pacific'";
        }
        
        const query = `
          SELECT 
            ts.team, ts.league, ts.rank, ts.wins, ts.losses, ts.draws, 
            ts.win_percentage, ts.games_behind, ts.streak, ts.last_10, 
            ts.home_record, ts.away_record, ts.updated_at,
            t.name as team_name, t.city, t.stadium
          FROM team_standings ts
          LEFT JOIN teams t ON ts.team = t.team_code
          WHERE ts.year = ? ${leagueCondition}
          ORDER BY ts.league, ts.rank
        `;
        
        const standings = db.prepare(query).all(...params);
        
        if (standings.length > 0) {
          // Format the data to match the expected structure
          const central = standings.filter((s: any) => s.league === 'central').map((s: any) => ({
            team_code: s.team,
            team_name: s.team_name || TEAM_NAMES[s.team] || s.team,
            league: s.league,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws || 0,
            games_played: s.wins + s.losses + (s.draws || 0),
            win_pct: s.win_percentage,
            games_back: s.games_behind,
            rank: s.rank,
            last_10: s.last_10 || '0-0',
            streak: s.streak || '-',
            home_record: s.home_record || '0-0',
            away_record: s.away_record || '0-0',
            vs_central: '0-0', // Would need to calculate from game data
            vs_pacific: '0-0', // Would need to calculate from game data
            runs_scored: 0, // Would need to calculate from game data
            runs_allowed: 0, // Would need to calculate from game data
            run_diff: 0 // Would need to calculate from game data
          }));
          
          const pacific = standings.filter((s: any) => s.league === 'pacific').map((s: any) => ({
            team_code: s.team,
            team_name: s.team_name || TEAM_NAMES[s.team] || s.team,
            league: s.league,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws || 0,
            games_played: s.wins + s.losses + (s.draws || 0),
            win_pct: s.win_percentage,
            games_back: s.games_behind,
            rank: s.rank,
            last_10: s.last_10 || '0-0',
            streak: s.streak || '-',
            home_record: s.home_record || '0-0',
            away_record: s.away_record || '0-0',
            vs_central: '0-0',
            vs_pacific: '0-0',
            runs_scored: 0,
            runs_allowed: 0,
            run_diff: 0
          }));
          
          db.close();
          
          const response = {
            central,
            pacific,
            last_updated: standings[0]?.updated_at || new Date().toISOString(),
            season: year,
            games_remaining: 143 - Math.floor((central[0]?.games_played || 0)),
            playoff_format: {
              central: { cs_teams: 3, wildcard_teams: 2 },
              pacific: { cs_teams: 3, wildcard_teams: 2 }
            }
          };

          // Filter by league if specified
          const filteredResponse = league 
            ? { 
                [league]: response[league as keyof typeof response],
                last_updated: response.last_updated,
                season: response.season,
                games_remaining: response.games_remaining,
                playoff_format: response.playoff_format
              }
            : response;

          return Response.json(filteredResponse, {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
          });
        }
        
        db.close();
      }
    } catch (dbError) {
      console.error("Database error, falling back to mock data:", dbError);
    }

    // Fallback to mock data
    const standings = generateMockStandings(year);

    // Filter by league if specified
    const response = league 
      ? { 
          [league]: standings[league as keyof typeof standings],
          last_updated: standings.last_updated,
          season: standings.season,
          games_remaining: standings.games_remaining,
          playoff_format: standings.playoff_format,
          source: 'mock_fallback'
        }
      : { ...standings, source: 'mock_fallback' };

    return Response.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error("Standings API error:", error);
    return Response.json({
      error: "Internal server error",
      message: "Failed to fetch standings data"
    }, { status: 500 });
  }
}

// Actual database implementation (commented out for now)
/*
async function getStandings(year: number, league?: string): Promise<StandingsResponse> {
  const sql = `
    WITH team_records AS (
      SELECT 
        t.team_code,
        t.team_name,
        t.league,
        COUNT(CASE WHEN 
          (g.home_team = t.team_code AND g.home_score > g.away_score) OR
          (g.away_team = t.team_code AND g.away_score > g.home_score)
        THEN 1 END) as wins,
        COUNT(CASE WHEN 
          (g.home_team = t.team_code AND g.home_score < g.away_score) OR
          (g.away_team = t.team_code AND g.away_score < g.home_score)
        THEN 1 END) as losses,
        COUNT(CASE WHEN g.home_score = g.away_score THEN 1 END) as draws,
        COUNT(*) as games_played,
        SUM(CASE WHEN g.home_team = t.team_code THEN g.home_score ELSE g.away_score END) as runs_scored,
        SUM(CASE WHEN g.home_team = t.team_code THEN g.away_score ELSE g.home_score END) as runs_allowed
      FROM teams t
      LEFT JOIN games g ON (g.home_team = t.team_code OR g.away_team = t.team_code)
      WHERE strftime('%Y', g.date) = ? AND g.status = 'completed'
      ${league ? 'AND t.league = ?' : ''}
      GROUP BY t.team_code, t.team_name, t.league
    ),
    standings AS (
      SELECT 
        *,
        CASE WHEN wins + losses > 0 THEN ROUND(CAST(wins AS FLOAT) / (wins + losses), 3) ELSE 0 END as win_pct,
        runs_scored - runs_allowed as run_diff,
        ROW_NUMBER() OVER (PARTITION BY league ORDER BY 
          CASE WHEN wins + losses > 0 THEN CAST(wins AS FLOAT) / (wins + losses) ELSE 0 END DESC,
          runs_scored - runs_allowed DESC
        ) as rank
      FROM team_records
    )
    SELECT * FROM standings
    ORDER BY league, rank
  `;
  
  const params = league ? [year.toString(), league] : [year.toString()];
  const results = await unionQuery<TeamStanding>(sql, params);
  
  // Process results and calculate games back, streaks, etc.
  // ...
  
  return processedStandings;
}
*/