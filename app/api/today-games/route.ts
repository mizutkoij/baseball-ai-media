import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = new URLSearchParams(request.url.split('?')[1] || '');
  const league = searchParams.get('league') || 'first';
  const provider = searchParams.get('provider') || 'auto';

  try {
    // Return mock data for Vercel compatibility
    console.warn('Today games snapshot loading disabled for Vercel compatibility');
    
    if (false) { // Disabled filesystem access
      const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      
      // Transform NPB data to match existing API format
      const transformedData = {
        source: data.source || "snapshot",
        provider: data.provider || "npb",
        league: league,
        games: data.games || data.data?.length || 0,
        ts: data.updated_at || new Date().toISOString(),
        wpa_threshold: 0.08, // Default threshold
        data: (data.data || []).map((game: any) => ({
          game_id: game.game_id,
          date: game.date,
          start_time_jst: game.start_time_jst,
          status: game.status,
          inning: game.inning,
          away_team: game.away_team,
          home_team: game.home_team,
          away_score: game.away_score,
          home_score: game.home_score,
          venue: game.venue,
          tv: null, // NPB data doesn't include TV info yet
          league: game.league,
          highlights_count: 0, // No highlights in basic NPB data
          last_highlight_ts: null,
        }))
      };

      return NextResponse.json(transformedData);
    }

    // Fallback to mock data if no snapshot exists
    const mockData = {
      source: "mock",
      provider: "system",
      league: league,
      games: 0,
      ts: new Date().toISOString(),
      wpa_threshold: 0.08,
      data: []
    };

    return NextResponse.json(mockData);

  } catch (error) {
    console.error('Error in today-games API:', error);
    
    return NextResponse.json({
      source: "error",
      provider: "system", 
      league: league,
      games: 0,
      ts: new Date().toISOString(),
      wpa_threshold: 0.08,
      data: [],
      error: "Failed to load game data"
    }, { status: 500 });
  }
}