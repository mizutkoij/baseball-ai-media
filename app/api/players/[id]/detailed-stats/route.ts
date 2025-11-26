import { NextRequest, NextResponse } from 'next/server';
import { loadPlayerDetailedStats } from '@/lib/player-stats-loader';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '2025');
    const team = searchParams.get('team');
    const playerName = searchParams.get('name');

    if (!team || !playerName) {
      return NextResponse.json(
        { error: 'team and name parameters are required' },
        { status: 400 }
      );
    }

    const stats = loadPlayerDetailedStats(year, team, playerName);

    if (!stats) {
      return NextResponse.json(
        { error: 'Player stats not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error loading player detailed stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
