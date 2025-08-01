import { ImageResponse } from 'next/og';
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
    
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            color: 'white',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '40px',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              ⚾
            </div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 'bold',
              margin: 0,
            }}>
              選手比較
            </h1>
          </div>
          
          {/* Players Comparison */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '1000px',
            padding: '0 60px',
          }}>
            {/* Player 1 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '16px',
              padding: '32px',
              margin: '0 20px',
            }}>
              <h2 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                margin: '0 0 8px 0',
                color: '#60a5fa',
                textAlign: 'center',
              }}>
                {player1.name}
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#cbd5e1',
                margin: '0 0 24px 0',
              }}>
                {(player1.primary_pos as string) === 'P' ? '投手' : '野手'} | 現役
              </p>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '100%',
              }}>
                {player1Stats.map((stat, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '16px',
                  }}>
                    <span style={{ color: '#94a3b8' }}>{stat.label}:</span>
                    <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* VS */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#fbbf24',
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#0f172a',
            }}>
              VS
            </div>
            
            {/* Player 2 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '32px',
              margin: '0 20px',
            }}>
              <h2 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                margin: '0 0 8px 0',
                color: '#f87171',
                textAlign: 'center',
              }}>
                {player2.name}
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#cbd5e1',
                margin: '0 0 24px 0',
              }}>
                {(player2.primary_pos as string) === 'P' ? '投手' : '野手'} | 現役
              </p>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '100%',
              }}>
                {player2Stats.map((stat, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '16px',
                  }}>
                    <span style={{ color: '#94a3b8' }}>{stat.label}:</span>
                    <span style={{ fontWeight: 'bold', color: '#f87171' }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div style={{
            marginTop: '40px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '14px',
          }}>
            Baseball AI Media - 詳細比較をウェブサイトで確認
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
    
  } catch (error: any) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}