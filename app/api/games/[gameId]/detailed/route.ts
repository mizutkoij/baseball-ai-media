import { NextRequest, NextResponse } from 'next/server';

// Add runtime config to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
  const gameId = params.gameId;
  
  try {
    // Return mock detailed game data for Vercel compatibility
    console.warn('Detailed game data using mock data for Vercel compatibility');
    
    const mockDetailedGame = {
      game: {
        game_id: gameId,
        date: "2025-08-05",
        start_time_jst: "18:00",
        venue: "東京ドーム",
        status: "final",
        home_team: "読売ジャイアンツ",
        away_team: "阪神タイガース",
        home_score: 5,
        away_score: 3,
        innings: 9
      },
      detailed_stats: {
        batting: [
          {
            team: "away",
            player_name: "選手1",
            position: "CF",
            ab: 4,
            h: 2,
            r: 1,
            rbi: 1,
            bb: 0,
            so: 1,
            avg: 0.285
          },
          {
            team: "home", 
            player_name: "選手2",
            position: "1B",
            ab: 3,
            h: 1,
            r: 2,
            rbi: 2,
            bb: 1,
            so: 0,
            avg: 0.312
          }
        ],
        pitching: [
          {
            team: "away",
            player_name: "投手1",
            ip: 6.0,
            h: 7,
            r: 4,
            er: 4,
            bb: 2,
            so: 5,
            era: 3.24
          },
          {
            team: "home",
            player_name: "投手2", 
            ip: 7.0,
            h: 5,
            r: 3,
            er: 3,
            bb: 1,
            so: 8,
            era: 2.87
          }
        ]
      },
      play_by_play: [
        { inning: 1, description: "1回表：三振、ゴロ、フライ" },
        { inning: 1, description: "1回裏：ヒット、盗塁成功、タイムリーヒット" }
      ],
      source: "mock_data"
    };
    
    return NextResponse.json(mockDetailedGame);
    
  } catch (error) {
    console.error('Error in detailed game API:', error);
    return NextResponse.json({
      error: 'Failed to load detailed game data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}