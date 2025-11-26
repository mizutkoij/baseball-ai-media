import { NextRequest, NextResponse } from 'next/server';

// External API server URL - update this after deployment
const API_SERVER_URL = process.env.NEXT_PUBLIC_STATS_API_URL || 'http://133.18.111.227:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';
    const team = searchParams.get('team');
    const playerName = searchParams.get('name');

    if (!team || !playerName) {
      return NextResponse.json(
        { error: 'team and name parameters are required' },
        { status: 400 }
      );
    }

    // Proxy request to external API server
    const apiUrl = `${API_SERVER_URL}/api/players/${params.id}/detailed-stats?year=${year}&team=${encodeURIComponent(team)}&name=${encodeURIComponent(playerName)}`;

    console.log(`Proxying request to: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 5 minutes
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const stats = await response.json();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error proxying player detailed stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch player stats from API server',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
