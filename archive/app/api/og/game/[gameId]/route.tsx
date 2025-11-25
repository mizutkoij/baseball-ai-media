// app/api/og/game/[gameId]/route.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: { gameId: string } }
) {
  const gameId = params.gameId;
  
  // Game IDから基本情報を解析
  const parseGameId = (id: string) => {
    if (id.includes('_')) {
      const [datePart, ...teamsPart] = id.split('_');
      return {
        date: datePart,
        teams: teamsPart.join(' vs ') || 'NPB試合'
      };
    }
    return {
      date: new Date().toISOString().slice(0, 10),
      teams: 'NPB試合'
    };
  };
  
  const { date, teams } = parseGameId(gameId);
  
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
          backgroundImage: 'linear-gradient(45deg, #0f172a 0%, #1e293b 100%)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 40,
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginRight: 20,
            }}
          >
            ⚾
          </div>
          <div
            style={{
              fontSize: 32,
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            Baseball AI Media
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 40,
          }}
        >
          <div
            style={{
              fontSize: 64,
              color: 'white',
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            {teams}
          </div>
          
          <div
            style={{
              fontSize: 28,
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            {date} - 試合詳細
          </div>
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 40,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '20px 24px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 16, color: '#e2e8f0' }}>勝率変動</div>
          </div>
          
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '20px 24px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>🎯</div>
            <div style={{ fontSize: 16, color: '#e2e8f0' }}>次球予測</div>
          </div>
          
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '20px 24px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
            <div style={{ fontSize: 16, color: '#e2e8f0' }}>ライブ更新</div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              backgroundColor: '#22c55e',
              borderRadius: '50%',
            }}
          ></div>
          <div
            style={{
              fontSize: 14,
              color: '#94a3b8',
            }}
          >
            リアルタイム分析
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}