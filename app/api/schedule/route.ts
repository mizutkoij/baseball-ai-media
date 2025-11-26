import { NextRequest, NextResponse } from 'next/server';

// Add runtime config to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = new URLSearchParams(request.url.split('?')[1] || '');
  
  // Parse parameters
  const from = searchParams.get('from') || new Date().toISOString().split('T')[0];
  const to = searchParams.get('to') || from;
  const league = searchParams.get('league') || 'first';
  const status = searchParams.get('status'); // Optional status filter
  const team = searchParams.get('team'); // Team filter for team-specific schedules
  
  try {
    // Always return mock data for Vercel compatibility
    console.log('Using mock schedule data for Vercel compatibility');

    // Generate mock schedule data
    const mockGames = [];
    const currentDate = new Date();
    
    // Generate a few mock games
    for (let i = 0; i < 5; i++) {
      const gameDate = new Date(currentDate);
      gameDate.setDate(gameDate.getDate() + i);
      const dateStr = gameDate.toISOString().split('T')[0];
      
      mockGames.push({
        game_id: `mock_game_${i + 1}`,
        date: dateStr,
        start_time_jst: '18:00',
        venue: i % 2 === 0 ? '甲子園球場' : '東京ドーム',
        status: i === 0 ? 'live' : 'scheduled',
        inning: i === 0 ? '7回表' : null,
        away_team: i % 2 === 0 ? '巨人' : '阪神',
        home_team: i % 2 === 0 ? '阪神' : '巨人',
        away_score: i === 0 ? 3 : null,
        home_score: i === 0 ? 2 : null,
        league: 'central',
        links: {
          index: `/games/mock_game_${i + 1}`,
          box: `/games/mock_game_${i + 1}/box`,
          pbp: `/games/mock_game_${i + 1}/pbp`
        }
      });
    }

    // Filter by team if specified
    const filteredGames = team 
      ? mockGames.filter(game => game.away_team === team || game.home_team === team)
      : mockGames;

    // Filter by status if specified
    const statusFilteredGames = status
      ? filteredGames.filter(game => game.status === status)
      : filteredGames;

    // Group games by date
    const gamesByDate: { [key: string]: any[] } = {};
    statusFilteredGames.forEach(game => {
      if (!gamesByDate[game.date]) {
        gamesByDate[game.date] = [];
      }
      gamesByDate[game.date].push(game);
    });

    // Convert to expected format
    const days = Object.keys(gamesByDate).map(date => ({
      date,
      games: gamesByDate[date]
    }));

    const summary = {
      scheduled: statusFilteredGames.filter(g => g.status === 'scheduled').length,
      in_progress: statusFilteredGames.filter(g => g.status === 'live').length,
      final: statusFilteredGames.filter(g => g.status === 'final').length,
      postponed: statusFilteredGames.filter(g => g.status === 'postponed').length
    };

    return NextResponse.json({
      days,
      total_games: statusFilteredGames.length,
      date_range: { from, to },
      summary,
      source: 'mock_data_vercel_compatibility'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error("Schedule API error:", error);
    return NextResponse.json({
      error: "Internal server error",
      message: "Failed to fetch schedule data"
    }, { status: 500 });
  }
}