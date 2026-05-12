import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'YakyuLab スカウティングレポート';

async function fetchReport(pitcher: string, team: string, date: string) {
  const base = process.env.SCOUTING_API_URL || 'http://localhost:3001';
  try {
    const res = await fetch(`${base}/api/scouting/${pitcher}/${team}/${date}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function OpengraphImage({
  params,
}: {
  params: { pitcher: string; team: string; date: string };
}) {
  const r = await fetchReport(params.pitcher, params.team, params.date);

  const title = r ? `${r.pitcher_name_ja} 攻略レポート` : 'スカウティングレポート';
  const subtitle = r ? `vs ${r.team_name_ja} · ${r.game_date}` : 'YakyuLab';
  const topFinding = r?.payload?.findings?.[0]?.title ?? '';
  const findingCount = r ? `${r.finding_count} 戦略ポイント` : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0c2340',
          color: 'white',
          padding: 60,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 24, opacity: 0.8 }}>
          {'🎯 YakyuLab Scouting'}
        </div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 800 }}>{title}</div>
        <div style={{ display: 'flex', fontSize: 32, opacity: 0.85 }}>{subtitle}</div>
        <div
          style={{
            display: 'flex',
            fontSize: 34,
            fontWeight: 700,
            background: 'rgba(255,255,255,0.1)',
            borderLeft: '6px solid #f97316',
            padding: '20px 28px',
            borderRadius: 8,
          }}
        >
          {topFinding || ' '}
        </div>
        <div style={{ display: 'flex', fontSize: 22, opacity: 0.8 }}>
          {findingCount}
        </div>
      </div>
    ),
    size,
  );
}
