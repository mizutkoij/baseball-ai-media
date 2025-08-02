import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Edge runtime doesn't support better-sqlite3, so we'll fetch from API instead
async function getPlayersData(ids: string[]) {
  // In production, this would fetch from your API
  // For now, return mock data for OG generation
  return [
    { 
      player_id: ids[0] || 'player1', 
      name: '選手A', 
      primary_pos: 'B' as const,
      batting: { avg: 0.285, HR: 25, OPS_plus_simple: 120 }
    },
    { 
      player_id: ids[1] || 'player2', 
      name: '選手B', 
      primary_pos: 'B' as const,
      batting: { avg: 0.310, HR: 18, OPS_plus_simple: 115 }
    }
  ];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    
    if (!idsParam) {
      return new Response('Missing ids parameter', { status: 400 });
    }
    
    const ids = idsParam.split(',').map(id => id.trim()).filter(id => id);
    if (ids.length !== 2) {
      return new Response('Exactly 2 player IDs required', { status: 400 });
    }
    
    // Get player data (using mock data for edge runtime)
    const players = await getPlayersData(ids);
    
    if (players.length !== 2) {
      return new Response('Players not found', { status: 404 });
    }
    
    const [player1, player2] = players;
    
    // Get key stats to display
    const getKeyStats = (player: any) => {
      if (player.primary_pos === 'P') {
        return [
          { label: '防御率', value: player.防御率?.toFixed(2) || '-' },
          { label: 'WHIP', value: player.WHIP?.toFixed(3) || '-' },
          { label: 'ERA-', value: player.ERA_minus || '-' },
          { label: '勝利', value: player.勝利 || '-' },
        ];
      } else {
        return [
          { label: '打率', value: player.打率?.toFixed(3) || '-' },
          { label: '本塁打', value: player.本塁打 || '-' },
          { label: 'OPS+', value: player.OPS_plus_simple || '-' },
          { label: 'wRC+', value: player.wRC_plus_simple || '-' },
        ];
      }
    };
    
    const player1Stats = getKeyStats(player1);
    const player2Stats = getKeyStats(player2);
    
    return new Response(
      JSON.stringify({
        message: "OG image generation temporarily disabled for build compatibility",
        players: [player1.name, player2.name],
        stats: {
          player1: player1Stats,
          player2: player2Stats
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
  } catch (error: any) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}