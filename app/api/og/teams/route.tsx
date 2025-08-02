import { ImageResponse } from 'next/server';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const TEAM_COLORS: Record<string, { primary: string; secondary: string; name: string }> = {
  'G': { primary: '#FF6600', secondary: '#000000', name: '読売ジャイアンツ' },
  'T': { primary: '#FFE100', secondary: '#000000', name: '阪神タイガース' },
  'C': { primary: '#FF0000', secondary: '#FFFFFF', name: '広島東洋カープ' },
  'YS': { primary: '#003DA5', secondary: '#FFFFFF', name: '横浜DeNAベイスターズ' },
  'D': { primary: '#002E8B', secondary: '#FFFFFF', name: '中日ドラゴンズ' },
  'S': { primary: '#006837', secondary: '#FFFFFF', name: '東京ヤクルトスワローズ' },
  'H': { primary: '#F8B500', secondary: '#000000', name: 'ソフトバンクホークス' },
  'L': { primary: '#1E22AA', secondary: '#FFFFFF', name: '埼玉西武ライオンズ' },
  'E': { primary: '#8B0000', secondary: '#FFFFFF', name: '東北楽天ゴールデンイーグルス' },
  'M': { primary: '#000000', secondary: '#FFFFFF', name: '千葉ロッテマリーンズ' },
  'F': { primary: '#003366', secondary: '#FFFFFF', name: '北海道日本ハムファイターズ' },
  'B': { primary: '#333366', secondary: '#FFFFFF', name: 'オリックス・バファローズ' }
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teams = searchParams.get('teams')?.split(',') || [];
    const year = searchParams.get('year') || '2024';
    const pfCorrection = searchParams.get('pf') === 'true';

    if (teams.length === 0) {
      return new Response('Teams parameter required', { status: 400 });
    }

    const teamData = teams.slice(0, 4).map((teamCode, index) => {
      const team = TEAM_COLORS[teamCode.toUpperCase()];
      if (!team) return null;
      
      // Mock data for OG image
      const wRC_plus = 85 + Math.floor(Math.random() * 30);
      const ERA_minus = 90 + Math.floor(Math.random() * 20);
      
      return {
        code: teamCode.toUpperCase(),
        name: team.name,
        colors: team,
        rank: index + 1,
        wRC_plus: pfCorrection ? wRC_plus + Math.floor(Math.random() * 20) - 10 : wRC_plus,
        ERA_minus: pfCorrection ? ERA_minus + Math.floor(Math.random() * 15) - 7 : ERA_minus
      };
    }).filter(Boolean);

    return new ImageResponse(
      (
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: 'white',
            position: 'relative'
          }}
        >
          {/* Header */}
          <div
            style={{
              position: 'absolute',
              top: '40px',
              left: '50px',
              right: '50px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
              NPB チーム比較
            </div>
            <div style={{ fontSize: '24px', opacity: 0.9 }}>
              {year}年 {pfCorrection ? '• PF補正適用' : ''}
            </div>
          </div>

          {/* Team Cards */}
          <div
            style={{
              display: 'flex',
              gap: '20px',
              marginTop: '40px',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}
          >
            {teamData.map((team) => (
              <div
                key={team.code}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: '24px',
                  minWidth: '240px',
                  textAlign: 'center',
                  border: `3px solid ${team.colors.primary}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                {/* Team Name */}
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    color: team.colors.primary
                  }}
                >
                  {team.name}
                </div>
                
                {/* Rank */}
                <div
                  style={{
                    fontSize: '14px',
                    opacity: 0.8,
                    marginBottom: '16px'
                  }}
                >
                  #{team.rank}位
                </div>

                {/* Metrics */}
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60A5FA' }}>
                      {team.wRC_plus}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>wRC+</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34D399' }}>
                      {team.ERA_minus}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>ERA-</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              fontSize: '16px',
              opacity: 0.8,
              textAlign: 'center'
            }}
          >
            🔗 npb-ai.com でさらに詳しい分析を見る
          </div>

          {/* Watermark */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              fontSize: '14px',
              opacity: 0.6'
            }}
          >
            NPB AI Analytics
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}