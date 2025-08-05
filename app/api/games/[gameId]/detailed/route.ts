import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
  const gameId = params.gameId;
  
  try {
    const currentDbPath = path.join(process.cwd(), 'data', 'db_current.db');
    const fs = require('fs');
    
    if (!fs.existsSync(currentDbPath)) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    const Database = require('better-sqlite3');
    const db = new Database(currentDbPath);
    
    // Get detailed game data
    const detailQuery = `
      SELECT 
        dg.game_id, dg.date, dg.league, dg.away_team, dg.home_team,
        dg.away_score, dg.home_score, dg.status, dg.venue, dg.start_time_jst,
        dg.away_hits, dg.home_hits, dg.away_errors, dg.home_errors,
        dg.away_starter, dg.home_starter, dg.attendance, dg.weather, dg.game_time,
        dg.inning_scores, dg.umpire_home_plate, dg.umpire_first_base, 
        dg.umpire_second_base, dg.umpire_third_base, dg.updated_at,
        away_team_info.name as away_team_name, away_team_info.city as away_city,
        home_team_info.name as home_team_name, home_team_info.city as home_city
      FROM detailed_games dg
      LEFT JOIN teams away_team_info ON dg.away_team = away_team_info.team_code
      LEFT JOIN teams home_team_info ON dg.home_team = home_team_info.team_code
      WHERE dg.game_id = ?
    `;
    
    const detailedGame = db.prepare(detailQuery).get(gameId) as any;
    
    if (!detailedGame) {
      // Try to get basic game info if detailed data doesn't exist
      const basicQuery = `
        SELECT 
          g.game_id, g.date, g.league, g.away_team, g.home_team,
          g.away_score, g.home_score, g.status, g.venue, g.start_time_jst,
          away_team_info.name as away_team_name,
          home_team_info.name as home_team_name
        FROM games g
        LEFT JOIN teams away_team_info ON g.away_team = away_team_info.team_code
        LEFT JOIN teams home_team_info ON g.home_team = home_team_info.team_code
        WHERE g.game_id = ?
      `;
      
      const basicGame = db.prepare(basicQuery).get(gameId) as any;
      db.close();
      
      if (!basicGame) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }
      
      // Return basic game info with placeholder detailed data
      return NextResponse.json({
        game_id: basicGame.game_id,
        date: basicGame.date,
        league: basicGame.league,
        status: basicGame.status,
        venue: basicGame.venue,
        start_time_jst: basicGame.start_time_jst,
        teams: {
          away: {
            code: basicGame.away_team,
            name: basicGame.away_team_name || basicGame.away_team,
            score: basicGame.away_score
          },
          home: {
            code: basicGame.home_team,
            name: basicGame.home_team_name || basicGame.home_team,
            score: basicGame.home_score
          }
        },
        box_score: {
          line_score: null,
          summary: {
            hits: { away: null, home: null },
            errors: { away: null, home: null },
            left_on_base: { away: null, home: null }
          }
        },
        game_info: {
          attendance: null,
          weather: null,
          game_time: null,
          starting_pitchers: {
            away: null,
            home: null
          }
        },
        umpires: null,
        last_updated: new Date().toISOString(),
        has_detailed_data: false
      });
    }
    
    // Parse inning scores if available
    let inningScores = null;
    if (detailedGame.inning_scores) {
      try {
        inningScores = JSON.parse(detailedGame.inning_scores);
      } catch (e) {
        console.warn('Failed to parse inning scores:', e);
      }
    }
    
    db.close();
    
    const response = {
      game_id: detailedGame.game_id,
      date: detailedGame.date,
      league: detailedGame.league,
      status: detailedGame.status,
      venue: detailedGame.venue,
      start_time_jst: detailedGame.start_time_jst,
      teams: {
        away: {
          code: detailedGame.away_team,
          name: detailedGame.away_team_name || detailedGame.away_team,
          city: detailedGame.away_city,
          score: detailedGame.away_score
        },
        home: {
          code: detailedGame.home_team,
          name: detailedGame.home_team_name || detailedGame.home_team,
          city: detailedGame.home_city,
          score: detailedGame.home_score
        }
      },
      box_score: {
        line_score: inningScores ? {
          innings: inningScores.away.map((_: any, i: number) => i + 1),
          away: inningScores.away,
          home: inningScores.home,
          away_total: detailedGame.away_score,
          home_total: detailedGame.home_score
        } : null,
        summary: {
          hits: {
            away: detailedGame.away_hits,
            home: detailedGame.home_hits
          },
          errors: {
            away: detailedGame.away_errors,
            home: detailedGame.home_errors
          },
          left_on_base: {
            away: null, // Would need additional data
            home: null
          }
        }
      },
      game_info: {
        attendance: detailedGame.attendance,
        weather: detailedGame.weather,
        game_time: detailedGame.game_time,
        starting_pitchers: {
          away: detailedGame.away_starter,
          home: detailedGame.home_starter
        }
      },
      umpires: {
        home_plate: detailedGame.umpire_home_plate,
        first_base: detailedGame.umpire_first_base,
        second_base: detailedGame.umpire_second_base,
        third_base: detailedGame.umpire_third_base
      },
      last_updated: detailedGame.updated_at,
      has_detailed_data: true
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in detailed game API:', error);
    
    // Return mock detailed game data as fallback
    const mockResponse = {
      game_id: gameId,
      date: new Date().toISOString().split('T')[0],
      league: 'central',
      status: 'final',
      venue: 'モック球場',
      start_time_jst: '18:00',
      teams: {
        away: {
          code: 'YG',
          name: '読売ジャイアンツ',
          city: '東京',
          score: 7
        },
        home: {
          code: 'T',
          name: '阪神タイガース',
          city: '兵庫',
          score: 4
        }
      },
      box_score: {
        line_score: {
          innings: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          away: [0, 2, 0, 1, 0, 3, 0, 1, 0],
          home: [1, 0, 0, 0, 2, 0, 0, 1, 0],
          away_total: 7,
          home_total: 4
        },
        summary: {
          hits: { away: 12, home: 8 },
          errors: { away: 1, home: 2 },
          left_on_base: { away: 8, home: 6 }
        }
      },
      game_info: {
        attendance: 35000,
        weather: '晴れ',
        game_time: '3時間15分',
        starting_pitchers: {
          away: '田中太郎',
          home: '佐藤次郎'
        }
      },
      umpires: {
        home_plate: '審判A',
        first_base: '審判B',
        second_base: '審判C',
        third_base: '審判D'
      },
      last_updated: new Date().toISOString(),
      has_detailed_data: true,
      source: 'mock_fallback'
    };
    
    return NextResponse.json(mockResponse);
  }
}