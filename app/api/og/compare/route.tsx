import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const validatePlayerIds = (value: string | null) => {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ).slice(0, 4); // 4選手まで
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const yearFrom = searchParams.get('year_from') || new Date().getFullYear().toString();
    const yearTo = searchParams.get('year_to') || yearFrom;
    const pf = (searchParams.get('pf') ?? 'false') === 'true';
    const playerIds = validatePlayerIds(searchParams.get('ids'));

    const title = yearFrom === yearTo 
      ? `NPB Player Compare ${yearFrom}`
      : `NPB Player Compare ${yearFrom}-${yearTo}`;
    const subtitle = `PF補正: ${pf ? 'ON（中立化）' : 'OFF（生データ）'}`;

    // Mock player names for display
    const playerNames = playerIds.map((id, index) => 
      `選手${String.fromCharCode(65 + index)}`
    );

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
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
              
              {playerNames.length > 0 && (
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', justifyContent: 'center' }}>
                  {playerNames.map((name, index) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div 
                        style={{
                          width: '120px',
                          height: '120px',
                          borderRadius: '50%',
                          backgroundColor: index % 2 === 0 ? '#3b82f6' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '36px',
                          fontWeight: '700',
                          color: 'white',
                          marginBottom: '16px'
                        }}
                      >
                        {name.charAt(name.length - 1)}
                      </div>
                      <div style={{ fontSize: '24px', color: '#374151', fontWeight: '600' }}>
                        {name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {playerNames.length > 1 && (
                <div 
                  style={{ 
                    fontSize: '20px', 
                    color: '#475569',
                    marginTop: '32px',
                    textAlign: 'center'
                  }}
                >
                  {playerNames.join(' vs ')}の詳細比較
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '16px' }}>
              <div>NPB選手分析 • セイバーメトリクス</div>
              <div>© {yearTo} Baseball AI Media</div>
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
    
    return new Response('Failed to generate OG image', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}