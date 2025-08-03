import { NextRequest } from 'next/server';
import { getPlayerDensityData } from '@/lib/playerDensityGuard';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = params.id;
    
    // First, get basic player info from the JSON file
    const playerResponse = await fetch(`${request.nextUrl.origin}/data/players/players/${playerId}.json`);
    
    if (!playerResponse.ok) {
      return Response.json({ error: 'Player not found' }, { status: 404 });
    }
    
    const player = await playerResponse.json();
    
    // Get density data using the server-side function
    const densityData = await getPlayerDensityData(player);
    
    return Response.json(densityData, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 minute cache
      },
    });
  } catch (error) {
    console.error('Player density API error:', error);
    
    // Return fallback data structure
    return Response.json({
      has2024Data: false,
      summary2024: 'データ取得中です。しばらくお待ちください。',
      coreMetrics: {},
      fallbackData: {
        recentGames: [],
        simpleBio: '選手情報を読み込み中です。',
        fallbackMetrics: {
          '状態': '読み込み中',
          '確認中': '...',
          '準備中': '...'
        }
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Short cache for fallback
      },
    });
  }
}