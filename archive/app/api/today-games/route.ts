import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = new URLSearchParams(request.url.split('?')[1] || '');
  const league = searchParams.get('league') || 'first';
  const provider = searchParams.get('provider') || 'auto';

  try {
    // Return mock today's games data for Vercel compatibility
    console.warn('Today games snapshot loading disabled for Vercel compatibility');
    
    const mockTodayGames = {
      source: "mock_data",
      provider: "npb_mock",
      league: league,
      games: 6,
      ts: new Date().toISOString(),
      wpa_threshold: 0.08,
      data: [
        {
          game_id: "mock_game_1",
          date: new Date().toISOString().split('T')[0],
          start_time_jst: "18:00",
          status: league === 'farm' ? 'scheduled' : 'live',
          inning: league === 'farm' ? null : '7回表',
          venue: "東京ドーム",
          away_team: "阪神タイガース",
          home_team: "読売ジャイアンツ",
          away_score: league === 'farm' ? null : 3,
          home_score: league === 'farm' ? null : 2,
          attendance: 45000,
          weather: "晴れ",
          temperature: "28°C",
          links: {
            index: "/games/mock_game_1",
            box: "/games/mock_game_1/box",
            pbp: "/games/mock_game_1/pbp"
          }
        },
        {
          game_id: "mock_game_2", 
          date: new Date().toISOString().split('T')[0],
          start_time_jst: "18:00",
          status: "scheduled",
          inning: null,
          venue: "甲子園球場",
          away_team: "横浜DeNAベイスターズ",
          home_team: "阪神タイガース",
          away_score: null,
          home_score: null,
          attendance: null,
          weather: "曇り",
          temperature: "26°C",
          links: {
            index: "/games/mock_game_2",
            box: "/games/mock_game_2/box", 
            pbp: "/games/mock_game_2/pbp"
          }
        },
        {
          game_id: "mock_game_3",
          date: new Date().toISOString().split('T')[0],
          start_time_jst: "14:00",
          status: "final",
          inning: "試合終了",
          venue: "ナゴヤドーム",
          away_team: "広島東洋カープ",
          home_team: "中日ドラゴンズ",
          away_score: 4,
          home_score: 7,
          attendance: 28000,
          weather: "ドーム",
          temperature: "25°C",
          links: {
            index: "/games/mock_game_3",
            box: "/games/mock_game_3/box",
            pbp: "/games/mock_game_3/pbp"
          }
        }
      ]
    };

    return NextResponse.json(mockTodayGames);

  } catch (error) {
    console.error('Error in today-games API:', error);
    
    return NextResponse.json({
      source: "error",
      provider: provider,
      league: league,
      games: 0,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      ts: new Date().toISOString()
    }, { status: 500 });
  }
}