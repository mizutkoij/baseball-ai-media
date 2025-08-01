import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// Image size configuration
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

// Simple database connection for OG generation
const DatabaseLib = require('better-sqlite3');
const path = require('path');

function getSeasonData(year: number) {
  try {
    const dbPath = process.env.DB_HISTORY || './data/db_history.db';
    const db = new DatabaseLib(dbPath);
    
    // Get top 3 teams from each league for OG display
    const teams = db.prepare(`
      SELECT 
        b.team,
        b.league,
        COUNT(*) as games,
        SUM(CASE 
          WHEN (g.home_team = b.team AND g.home_score > g.away_score) OR 
               (g.away_team = b.team AND g.away_score > g.home_score) 
          THEN 1 ELSE 0 
        END) as wins
      FROM box_batting b
      JOIN games g ON b.game_id = g.game_id
      WHERE g.game_id LIKE '${year}%' AND g.status = 'final'
      GROUP BY b.team, b.league
      HAVING games > 0
      ORDER BY b.league, (wins * 1.0 / games) DESC
    `).all();
    
    db.close();
    
    const centralTeams = teams.filter((t: any) => t.league === 'Central').slice(0, 3);
    const pacificTeams = teams.filter((t: any) => t.league === 'Pacific').slice(0, 3);
    
    return { centralTeams, pacificTeams, totalGames: teams.length };
  } catch (error) {
    console.error('Failed to fetch season data for OG:', error);
    return { centralTeams: [], pacificTeams: [], totalGames: 0 };
  }
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