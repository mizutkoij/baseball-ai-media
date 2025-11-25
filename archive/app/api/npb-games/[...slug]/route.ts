import { NextRequest, NextResponse } from 'next/server';
import { NPBDataAdapter } from '../../../../lib/npb-data-adapter';

// NPBゲームデータ取得API
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    const adapter = new NPBDataAdapter();
    const { slug } = params;
    
    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const [date, matchup] = slug;

    // 日付のみの場合は、その日の全試合を返す
    if (slug.length === 1) {
      const games = adapter.getGamesByDate(date);
      
      if (games.length === 0) {
        return NextResponse.json({ error: 'No games found for this date' }, { status: 404 });
      }
      
      return NextResponse.json(games);
    }

    // 日付とマッチアップの場合は、特定の試合を返す
    if (slug.length === 2) {
      const game = adapter.getGameData(date, matchup);
      
      if (!game) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }
      
      return NextResponse.json(game);
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  } catch (error) {
    console.error('NPB API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// データ統計情報取得API
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    const adapter = new NPBDataAdapter();
    const { slug } = params;
    
    if (slug?.[0] === 'stats') {
      const stats = adapter.getDataSourceStats();
      return NextResponse.json(stats);
    }

    if (slug?.[0] === 'dates') {
      const dates = adapter.getAvailableDates();
      return NextResponse.json({ dates });
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });

  } catch (error) {
    console.error('NPB Stats API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}