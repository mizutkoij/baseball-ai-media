import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const teamNames: Record<string, { name: string; color: string }> = {
  // Central League
  'T': { name: '阪神タイガース', color: '#FFD700' },
  'S': { name: 'ヤクルトスワローズ', color: '#4CAF50' },
  'C': { name: '広島カープ', color: '#F44336' },
  'YS': { name: 'DeNAベイスターズ', color: '#2196F3' },
  'D': { name: '中日ドラゴンズ', color: '#2196F3' },
  'G': { name: '読売ジャイアンツ', color: '#FF9800' },
  // Pacific League
  'H': { name: 'ソフトバンクホークス', color: '#FFD700' },
  'L': { name: '西武ライオンズ', color: '#2196F3' },
  'E': { name: '楽天イーグルス', color: '#8B0000' },
  'M': { name: 'ロッテマリーンズ', color: '#000080' },
  'F': { name: '日本ハムファイターズ', color: '#4169E1' },
  'B': { name: 'オリックス', color: '#000080' }
};

// Mock function - in real implementation, you'd fetch from your API
async function getTeamData(year: string, team: string) {
  // This would fetch actual data from your team API
  // For now, returning mock data for the OG image
  return {
    standings: { W: 75, L: 68, D: 1, rank: 3, RD: 42 },
    summary: {
      batting: { wRC_plus: 108, OPS: 0.745 },
      pitching: { FIP: 3.85, ERA_minus: 95 }
    },
    meta: { league: 'central' as const }
  };
}

export async function GET(
  req: Request,
  { params }: { params: { year: string; team: string } }
) {
  try {
    const { year, team } = params;
    
    if (!year || !team) {
      return new Response('Missing year or team parameter', { status: 400 });
    }
    
    const teamInfo = teamNames[team];
    if (!teamInfo) {
      return new Response('Team not found', { status: 404 });
    }
    
    // Get team data (in real implementation, fetch from your API)
    const teamData = await getTeamData(year, team);
    
    const leagueName = teamData.meta.league === 'central' ? 'セ・リーグ' : 'パ・リーグ';
    const winPct = (teamData.standings.W + teamData.standings.L + teamData.standings.D) > 0 
      ? teamData.standings.W / (teamData.standings.W + teamData.standings.L + teamData.standings.D * 0.5) 
      : 0;

    const getRankEmoji = (rank: number) => {
      if (rank === 1) return '🏆';
      if (rank <= 3) return '🥉';
      return '';
    };

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
            marginBottom: '30px',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: teamInfo.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              ⚾
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                margin: 0,
                color: teamInfo.color,
              }}>
                {teamInfo.name}
              </h1>
              <p style={{
                fontSize: '16px',
                margin: '4px 0 0 0',
                color: '#cbd5e1',
              }}>
                {year}年 {leagueName} {teamData.standings.rank}位 {getRankEmoji(teamData.standings.rank)}
              </p>
            </div>
          </div>
          
          {/* Main Stats Grid */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '40px',
            marginBottom: '30px',
          }}>
            {/* Record */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(255, 255, 255, 0.2)',
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '8px',
              }}>
                {teamData.standings.W}-{teamData.standings.L}
                {teamData.standings.D > 0 && `-${teamData.standings.D}`}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#94a3b8',
                marginBottom: '4px',
              }}>
                戦績・勝率 .{Math.round(winPct * 1000).toString().padStart(3, '0')}
              </div>
              <div style={{
                fontSize: '12px',
                color: teamData.standings.RD >= 0 ? '#22c55e' : '#ef4444',
              }}>
                得失点差 {teamData.standings.RD > 0 ? '+' : ''}{teamData.standings.RD}
              </div>
            </div>
            
            {/* Batting */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(59, 130, 246, 0.3)',
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#3b82f6',
                marginBottom: '8px',
              }}>
                {teamData.summary.batting.wRC_plus}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#94a3b8',
                marginBottom: '4px',
              }}>
                wRC+ (打撃指標)
              </div>
              <div style={{
                fontSize: '12px',
                color: '#94a3b8',
              }}>
                OPS .{teamData.summary.batting.OPS.toFixed(3)}
              </div>
            </div>
            
            {/* Pitching */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(239, 68, 68, 0.3)',
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#ef4444',
                marginBottom: '8px',
              }}>
                {teamData.summary.pitching.ERA_minus}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#94a3b8',
                marginBottom: '4px',
              }}>
                ERA- (投手指標)
              </div>
              <div style={{
                fontSize: '12px',
                color: '#94a3b8',
              }}>
                FIP {teamData.summary.pitching.FIP.toFixed(2)}
              </div>
            </div>
          </div>
          
          {/* League Context */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#64748b',
          }}>
            <span>{leagueName} {teamData.standings.rank}位</span>
            <span>•</span>
            <span>勝率 .{Math.round(winPct * 1000).toString().padStart(3, '0')}</span>
            <span>•</span>
            <span>Baseball AI Media</span>
          </div>
          
          {/* Footer */}
          <div style={{
            textAlign: 'center',
            color: '#64748b',
            fontSize: '12px',
          }}>
            チーム詳細データ・主力選手・対戦成績をウェブサイトで確認
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
    
  } catch (error: any) {
    console.error('Team OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}