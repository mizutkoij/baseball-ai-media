import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation during build
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Parse parameters
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const team = searchParams.get('team'); // Optional team filter
  const league = searchParams.get('league'); // 'central', 'pacific', or null for both
  const limit = parseInt(searchParams.get('limit') || '50');
  const sort = searchParams.get('sort') || 'era'; // sorting column
  const order = searchParams.get('order') || 'asc'; // 'asc' or 'desc'
  
  try {
    // Return mock pitching stats instead of querying database
    console.log('Returning mock pitching stats data');
    
    // Generate mock players based on filters
    const mockPlayers = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      player_id: `mock_pitcher_${i + 1}`,
      name: `投手${i + 1}`,
      team: team || ['YG', 'T', 'C', 'DB', 'S', 'D', 'H', 'F', 'L', 'M', 'B', 'E'][i % 12],
      year,
      games: Math.floor(Math.random() * 30) + 25,
      wins: Math.floor(Math.random() * 12) + 3,
      losses: Math.floor(Math.random() * 10) + 2,
      saves: Math.floor(Math.random() * 30),
      era: Math.round((2.50 + Math.random() * 2.00) * 100) / 100,
      innings_pitched: Math.round((50 + Math.random() * 150) * 10) / 10,
      hits_allowed: Math.floor(Math.random() * 150) + 80,
      runs_allowed: Math.floor(Math.random() * 80) + 40,
      earned_runs: Math.floor(Math.random() * 70) + 35,
      walks: Math.floor(Math.random() * 60) + 25,
      strikeouts: Math.floor(Math.random() * 120) + 80,
      home_runs_allowed: Math.floor(Math.random() * 15) + 5,
      whip: Math.round((1.00 + Math.random() * 0.50) * 100) / 100,
      team_name: 'モックチーム',
      team_league: league || (i % 2 === 0 ? 'central' : 'pacific'),
      updated_at: new Date().toISOString()
    }));
    
    const response = {
      year,
      league,
      team,
      sort_by: sort,
      sort_order: order,
      limit,
      players: mockPlayers,
      summary: {
        total_players: mockPlayers.length,
        league_averages: {
          era: 3.45,
          wins: 8.2,
          strikeouts: 145.3,
          saves: 12.8
        },
        leaders: {
          era: 2.15,
          wins: 18,
          strikeouts: 245,
          saves: 42
        }
      },
      last_updated: new Date().toISOString(),
      source: 'mock_data'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in pitching stats API:', error);
    
    // Return mock data as fallback
    const mockPlayers = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      player_id: `mock_pitcher_${i + 1}`,
      name: `投手${i + 1}`,
      team: ['YG', 'T', 'C', 'DB', 'S', 'D', 'H', 'F', 'L', 'M', 'B', 'E'][i % 12],
      year,
      games: Math.floor(Math.random() * 30) + 25,
      wins: Math.floor(Math.random() * 12) + 3,
      losses: Math.floor(Math.random() * 10) + 2,
      saves: Math.floor(Math.random() * 30),
      era: Math.round((2.50 + Math.random() * 2.00) * 100) / 100,
      innings_pitched: Math.round((50 + Math.random() * 150) * 10) / 10,
      hits_allowed: Math.floor(Math.random() * 150) + 80,
      runs_allowed: Math.floor(Math.random() * 80) + 40,
      earned_runs: Math.floor(Math.random() * 70) + 35,
      walks: Math.floor(Math.random() * 60) + 25,
      strikeouts: Math.floor(Math.random() * 120) + 80,
      home_runs_allowed: Math.floor(Math.random() * 15) + 5,
      whip: Math.round((1.00 + Math.random() * 0.50) * 100) / 100,
      team_name: 'モックチーム',
      team_league: i % 2 === 0 ? 'central' : 'pacific',
      updated_at: new Date().toISOString()
    }));

    const mockResponse = {
      year,
      league,
      team,
      sort_by: sort,
      sort_order: order,
      limit,
      players: mockPlayers,
      summary: {
        total_players: mockPlayers.length,
        league_averages: {
          era: 3.45,
          wins: 8.2,
          strikeouts: 145.3,
          saves: 12.8
        },
        leaders: {
          era: 2.15,
          wins: 18,
          strikeouts: 245,
          saves: 42
        }
      },
      last_updated: new Date().toISOString(),
      source: 'mock_fallback'
    };
    
    return NextResponse.json(mockResponse);
  }
}