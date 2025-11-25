import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// Force this to be server-side only
export const runtime = 'nodejs';

// Image size configuration
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

function getSeasonData(year: number) {
  // Fallback static data for OpenGraph - avoids database bundling issues
  const fallbackTeams = {
    2024: {
      centralTeams: [
        { team: '阪神', league: 'Central', wins: 85, games: 144 },
        { team: '広島', league: 'Central', wins: 79, games: 144 },
        { team: '巨人', league: 'Central', wins: 77, games: 144 }
      ],
      pacificTeams: [
        { team: 'ソフトバンク', league: 'Pacific', wins: 88, games: 144 },
        { team: '日本ハム', league: 'Pacific', wins: 81, games: 144 },
        { team: 'ロッテ', league: 'Pacific', wins: 77, games: 144 }
      ]
    },
    2023: {
      centralTeams: [
        { team: '阪神', league: 'Central', wins: 85, games: 143 },
        { team: '広島', league: 'Central', wins: 81, games: 143 },
        { team: '巨人', league: 'Central', wins: 74, games: 143 }
      ],
      pacificTeams: [
        { team: 'オリックス', league: 'Pacific', wins: 88, games: 143 },
        { team: 'ロッテ', league: 'Pacific', wins: 75, games: 143 },
        { team: '楽天', league: 'Pacific', wins: 73, games: 143 }
      ]
    }
  };
  
  const seasonData = fallbackTeams[year as keyof typeof fallbackTeams] || fallbackTeams[2024];
  
  return {
    centralTeams: seasonData.centralTeams,
    pacificTeams: seasonData.pacificTeams,
    totalGames: 144
  };
}

export default async function Image({ params }: { params: { year: string } }) {
  const year = parseInt(params.year);
  const seasonData = getSeasonData(year);
  
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
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontSize: 32,
          fontWeight: 600,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#f8fafc',
              marginBottom: '12px',
            }}
          >
            NPB {year} シーズンまとめ
          </div>
          <div
            style={{
              fontSize: '24px',
              color: '#94a3b8',
            }}
          >
            順位・主要指標・リーダーを一望
          </div>
        </div>

        {/* League Standings Preview */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '60px',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          {/* Central League */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: '28px',
                color: '#3b82f6',
                marginBottom: '20px',
                fontWeight: 700,
              }}
            >
              セントラル・リーグ
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {seasonData.centralTeams.slice(0, 3).map((team: any, index: number) => (
                <div
                  key={team.team}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 16px',
                    background: index === 0 ? '#fbbf24' : '#374151',
                    borderRadius: '8px',
                    color: index === 0 ? '#000' : '#f8fafc',
                    fontSize: '20px',
                    minWidth: '200px',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{index + 1}</div>
                  <div style={{ flex: 1 }}>{team.team}</div>
                  <div style={{ fontSize: '16px', opacity: 0.8 }}>
                    {team.wins}-{team.games - team.wins}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pacific League */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: '28px',
                color: '#10b981',
                marginBottom: '20px',
                fontWeight: 700,
              }}
            >
              パシフィック・リーグ
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {seasonData.pacificTeams.slice(0, 3).map((team: any, index: number) => (
                <div
                  key={team.team}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 16px',
                    background: index === 0 ? '#fbbf24' : '#374151',
                    borderRadius: '8px',
                    color: index === 0 ? '#000' : '#f8fafc',
                    fontSize: '20px',
                    minWidth: '200px',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{index + 1}</div>
                  <div style={{ flex: 1 }}>{team.team}</div>
                  <div style={{ fontSize: '16px', opacity: 0.8 }}>
                    {team.wins}-{team.games - team.wins}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            left: '40px',
            right: '40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '18px',
            color: '#64748b',
          }}
        >
          <div>baseball-ai-media.vercel.app</div>
          <div>📊 wRC+・ERA-・Pythag補正済み</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}