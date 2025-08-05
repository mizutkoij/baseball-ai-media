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
  const sort = searchParams.get('sort') || 'batting_average'; // sorting column
  const order = searchParams.get('order') || 'desc'; // 'asc' or 'desc'
  
  try {
    // Return mock batting stats instead of querying database
    console.log('Returning mock batting stats data');
    
    // Generate mock players based on filters
    const mockPlayers = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      player_id: `mock_player_${i + 1}`,
      name: `選手${i + 1}`,
      team: team || ['YG', 'T', 'C', 'DB', 'S', 'D', 'H', 'F', 'L', 'M', 'B', 'E'][i % 12],
      position: ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'C', 'DH'][i % 9],
      year,
      games: Math.floor(Math.random() * 50) + 100,
      at_bats: Math.floor(Math.random() * 200) + 300,
      hits: Math.floor(Math.random() * 100) + 80,
      runs: Math.floor(Math.random() * 60) + 40,
      rbis: Math.floor(Math.random() * 80) + 50,
      doubles: Math.floor(Math.random() * 25) + 15,
      triples: Math.floor(Math.random() * 5) + 1,
      home_runs: Math.floor(Math.random() * 25) + 10,
      walks: Math.floor(Math.random() * 60) + 30,
      strikeouts: Math.floor(Math.random() * 100) + 80,
      stolen_bases: Math.floor(Math.random() * 20) + 5,
      batting_average: Math.round((0.200 + Math.random() * 0.150) * 1000) / 1000,
      on_base_percentage: Math.round((0.250 + Math.random() * 0.150) * 1000) / 1000,
      slugging_percentage: Math.round((0.300 + Math.random() * 0.200) * 1000) / 1000,
      ops: Math.round((0.650 + Math.random() * 0.250) * 1000) / 1000,
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
          batting_average: 0.265,
          home_runs: 18.5,
          rbis: 72.3
        },
        leaders: {
          batting_average: 0.342,
          home_runs: 45,
          rbis: 125
        }
      },
      last_updated: new Date().toISOString(),
      source: 'mock_data'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in batting stats API:', error);
    
    // Return mock data as fallback
    const mockPlayers = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      player_id: `mock_player_${i + 1}`,
      name: `選手${i + 1}`,
      team: ['YG', 'T', 'C', 'DB', 'S', 'D', 'H', 'F', 'L', 'M', 'B', 'E'][i % 12],
      position: ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'C', 'DH'][i % 9],
      year,
      games: Math.floor(Math.random() * 50) + 100,
      at_bats: Math.floor(Math.random() * 200) + 300,
      hits: Math.floor(Math.random() * 100) + 80,
      runs: Math.floor(Math.random() * 60) + 40,
      rbis: Math.floor(Math.random() * 80) + 50,
      doubles: Math.floor(Math.random() * 25) + 15,
      triples: Math.floor(Math.random() * 5) + 1,
      home_runs: Math.floor(Math.random() * 25) + 10,
      walks: Math.floor(Math.random() * 60) + 30,
      strikeouts: Math.floor(Math.random() * 100) + 80,
      stolen_bases: Math.floor(Math.random() * 20) + 5,
      batting_average: Math.round((0.200 + Math.random() * 0.150) * 1000) / 1000,
      on_base_percentage: Math.round((0.250 + Math.random() * 0.150) * 1000) / 1000,
      slugging_percentage: Math.round((0.300 + Math.random() * 0.200) * 1000) / 1000,
      ops: Math.round((0.650 + Math.random() * 0.250) * 1000) / 1000,
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
          batting_average: 0.265,
          home_runs: 18.5,
          rbis: 72.3
        },
        leaders: {
          batting_average: 0.342,
          home_runs: 45,
          rbis: 125
        }
      },
      last_updated: new Date().toISOString(),
      source: 'mock_fallback'
    };
    
    return NextResponse.json(mockResponse);
  }
}