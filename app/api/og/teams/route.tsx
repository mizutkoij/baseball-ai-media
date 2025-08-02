import { ImageResponse } from 'next/server';
import { NextRequest } from 'next/server';

// export const runtime = 'edge'; // Temporarily disabled for testing

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

    return new Response(
      JSON.stringify({
        message: "OG image generation temporarily disabled for build compatibility",
        teams: teamData.map(t => t?.name).filter(Boolean).join(", "),
        year,
        pfCorrection
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}