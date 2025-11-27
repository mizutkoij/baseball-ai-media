import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const date = params.date;

    // Return mock games data for Vercel compatibility
    console.warn(`Games by date (${date}) snapshot loading disabled for Vercel compatibility`);

    // Mock data with the requested date
    const mockGamesData = {
      source: "mock_data",
      date: date,
      games: [
        {
          game_id: `${date.replace(/-/g, '')}_G-T_01`,
          date: date,
          start_time_jst: "18:00",
          status: "scheduled",
          venue: "東京ドーム",
          away_team: "阪神",
          home_team: "巨人",
          away_score: null,
          home_score: null,
          home_pitcher: null,
          away_pitcher: null
        },
        {
          game_id: `${date.replace(/-/g, '')}_DB-C_01`,
          date: date,
          start_time_jst: "18:00",
          status: "scheduled",
          venue: "横浜スタジアム",
          away_team: "広島",
          home_team: "DeNA",
          away_score: null,
          home_score: null,
          home_pitcher: null,
          away_pitcher: null
        },
        {
          game_id: `${date.replace(/-/g, '')}_D-S_01`,
          date: date,
          start_time_jst: "18:00",
          status: "scheduled",
          venue: "バンテリンドーム",
          away_team: "ヤクルト",
          home_team: "中日",
          away_score: null,
          home_score: null,
          home_pitcher: null,
          away_pitcher: null
        }
      ],
      ts: new Date().toISOString()
    };

    return NextResponse.json(mockGamesData);

  } catch (error) {
    console.error('Error in games by-date API:', error);

    return NextResponse.json({
      source: "error",
      date: params.date,
      games: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      ts: new Date().toISOString()
    }, { status: 500 });
  }
}
