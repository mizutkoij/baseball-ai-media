import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = new URLSearchParams(request.url.split('?')[1] || '');
  const league = searchParams.get('league') || 'first';
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    // Return mock game of the day for Vercel compatibility
    console.warn('Game of the day API using mock data for Vercel compatibility');
    
    const mockResponse = {
      source: "mock_data",
      league: league,
      date: date,
      game_of_the_day: {
        game_id: "mock_game_1",
        date: date,
        start_time_jst: "18:00",
        venue: "東京ドーム",
        status: league === 'farm' ? 'scheduled' : 'live',
        inning: league === 'farm' ? null : '7回表',
        away_team: "阪神タイガース",
        home_team: "読売ジャイアンツ",
        away_score: league === 'farm' ? null : 3,
        home_score: league === 'farm' ? null : 2,
        selection_score: 145,
        links: {
          index: `/games/mock_game_1`,
          box: `/games/mock_game_1/box`,
          pbp: `/games/mock_game_1/pbp`
        }
      },
      selection_reason: "人気チーム対戦・プライムタイム・接戦",
      meta: {
        total_games_today: 6,
        criteria_weights: {
          live_game_bonus: 100,
          prime_time_bonus: 30,
          close_game_bonus: 25,
          popular_team_bonus: 20,
          weekend_bonus: 15
        }
      },
      ts: new Date().toISOString()
    };

    return NextResponse.json(mockResponse);

  } catch (error) {
    console.error('Error in game-of-the-day API:', error);
    
    return NextResponse.json({
      source: "error",
      league: league,
      date: date,
      game_of_the_day: null,
      selection_reason: "API error occurred",
      error: error instanceof Error ? error.message : 'Unknown error',
      ts: new Date().toISOString()
    }, { status: 500 });
  }
}