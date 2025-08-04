import { ImageResponse } from 'next/og';
import { TEAM_COLORS } from '@/lib/teamColors';

export const runtime = 'edge';

const validateTeams = (value: string | null) => {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, 4); // 4チームまで
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = (searchParams.get('year') ?? '').replace(/[^\d]/g, '') || new Date().getFullYear().toString();
    const pf = (searchParams.get('pf') ?? 'false') === 'true';
    const teams = validateTeams(searchParams.get('teams'));

    const title = `NPB Team Compare ${year}`;
    const subtitle = `PF補正: ${pf ? 'ON（中立化）' : 'OFF（生データ）'}`;

    const chips = teams.map((t, index) => {
      const color = TEAM_COLORS[t] ?? { primary: '#e5e7eb', text: '#111827', name: t };
      return (
        <div
          key={t}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 20px',
            borderRadius: '999px',
            backgroundColor: color.primary,
            color: color.text,
            fontSize: '32px',
            fontWeight: '700',
            marginRight: index < teams.length - 1 ? '16px' : '0',
            minWidth: '80px',
          }}
        >
          {t}
        </div>
      );
    });

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #e2e8f0 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '60px',
              width: '100%',
              height: '100%',
              justifyContent: 'space-between',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  fontSize: '36px', 
                  color: '#1e293b',
                  fontWeight: '600'
                }}
              >
                <span style={{ marginRight: '12px' }}>⚾</span>
                Baseball AI Media
              </div>
              <div 
                style={{ 
                  fontSize: '24px', 
                  color: '#64748b',
                  backgroundColor: '#f1f5f9',
                  padding: '8px 16px',
                  borderRadius: '8px'
                }}
              >
                {subtitle}
              </div>
            </div>

            {/* Main Content */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div 
                style={{ 
                  fontSize: '64px', 
                  fontWeight: '800', 
                  color: '#0f172a',
                  marginBottom: '32px',
                  textAlign: 'center'
                }}
              >
                {title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {chips}
              </div>
              {teams.length > 0 && (
                <div 
                  style={{ 
                    fontSize: '20px', 
                    color: '#475569',
                    marginTop: '24px',
                    textAlign: 'center'
                  }}
                >
                  {teams.map(t => TEAM_COLORS[t]?.name || t).join(' vs ')}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '16px' }}>
              <div>NPB高度分析 • セイバーメトリクス</div>
              <div>© {year} Baseball AI Media</div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: { 
          'Cache-Control': 'public, max-age=3600, immutable',
          'Content-Type': 'image/png'
        }
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    
    // Fallback response
    return new Response('Failed to generate OG image', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}