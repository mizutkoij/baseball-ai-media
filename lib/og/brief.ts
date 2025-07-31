// lib/og/brief.ts
// OGP画像生成機能（プレースホルダー実装）

export interface BriefOGData {
  date: string;
  gotd: {
    away_team: string;
    home_team: string;
    away_score?: number;
    home_score?: number;
  } | null;
  leaders: {
    player_name: string;
    team: string;
    metric_name: string;
    metric_value: number;
  }[];
  summary: {
    total_games: number;
    completed_games: number;
  };
}

/**
 * デイリーブリーフ用OGP画像を生成
 * 
 * 実装予定機能:
 * - Canvas APIまたは@vercel/ogを使用した画像生成
 * - 試合スコア + 注目選手名 + 小さなスパークライン
 * - Baseball AI Mediaブランディング
 * 
 * @param briefData ブリーフデータ
 * @param outputPath 出力先パス
 */
export async function buildBriefOgImage(briefData: BriefOGData, outputPath: string): Promise<void> {
  try {
    // TODO: 実際のOGP画像生成を実装
    // 現在はプレースホルダーSVGを生成
    
    const formattedDate = formatDateForDisplay(briefData.date);
    const gotdText = briefData.gotd 
      ? `${briefData.gotd.away_team} vs ${briefData.gotd.home_team}`
      : '試合データなし';
    
    const scoreText = briefData.gotd && 
      briefData.gotd.away_score !== undefined && 
      briefData.gotd.home_score !== undefined
      ? `${briefData.gotd.away_score}-${briefData.gotd.home_score}`
      : '';

    const leaderText = briefData.leaders[0] 
      ? `注目: ${briefData.leaders[0].player_name} (${briefData.leaders[0].team})`
      : '';

    // プレースホルダーSVG生成
    const svgContent = generateOGSvg({
      date: formattedDate,
      matchup: gotdText,
      score: scoreText,
      leader: leaderText,
      gameCount: `${briefData.summary.completed_games}/${briefData.summary.total_games}試合`
    });

    // SVGファイルとして保存（実際の実装ではPNG変換が必要）
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath.replace('.png', '.svg'), svgContent);
    
    console.log(`OGP image placeholder generated: ${outputPath}`);
    
  } catch (error) {
    console.error('OGP image generation failed:', error);
    throw error;
  }
}

/**
 * 日付フォーマット
 */
function formatDateForDisplay(dateStr: string): string {
  if (dateStr.length === 10) {
    // YYYY-MM-DD format
    const [year, month, day] = dateStr.split('-');
    return `${year}/${parseInt(month)}/${parseInt(day)}`;
  } else if (dateStr.length === 8) {
    // YYYYMMDD format
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}/${parseInt(month)}/${parseInt(day)}`;
  }
  return dateStr;
}

/**
 * OGP用SVG生成（プレースホルダー）
 */
function generateOGSvg({
  date,
  matchup,
  score,
  leader,
  gameCount
}: {
  date: string;
  matchup: string;
  score: string;
  leader: string;
  gameCount: string;
}): string {
  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  
  <rect width="1200" height="630" fill="url(#bgGradient)"/>
  
  <!-- Border -->
  <rect x="20" y="20" width="1160" height="590" fill="none" stroke="#334155" stroke-width="2" rx="12"/>
  
  <!-- Title -->
  <text x="60" y="100" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff">
    Baseball AI Media
  </text>
  
  <!-- Date -->
  <text x="60" y="150" font-family="Arial, sans-serif" font-size="32" fill="#64748b">
    ${date} デイリーブリーフ
  </text>
  
  <!-- Main Content Area -->
  <rect x="60" y="180" width="1080" height="300" fill="#1e293b" rx="8" opacity="0.8"/>
  
  <!-- Game of the Day -->
  <text x="100" y="230" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#fbbf24">
    🏆 今日の注目試合
  </text>
  
  <text x="100" y="270" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#ffffff">
    ${matchup}
  </text>
  
  ${score ? `
  <text x="100" y="320" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="#3b82f6">
    ${score}
  </text>
  ` : ''}
  
  <!-- Leader -->
  ${leader ? `
  <text x="100" y="380" font-family="Arial, sans-serif" font-size="20" fill="#10b981">
    ${leader}
  </text>
  ` : ''}
  
  <!-- Game Count -->
  <text x="100" y="420" font-family="Arial, sans-serif" font-size="18" fill="#64748b">
    ${gameCount}
  </text>
  
  <!-- Logo/Brand -->
  <circle cx="1050" cy="120" r="40" fill="#3b82f6" opacity="0.2"/>
  <text x="1050" y="130" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#3b82f6">
    ⚾
  </text>
  
  <!-- Footer -->
  <text x="60" y="580" font-family="Arial, sans-serif" font-size="16" fill="#64748b">
    NPB独自分析 • 完全独立データ • baseball-ai-media.vercel.app
  </text>
</svg>
  `.trim();
}

/**
 * 実際の画像生成実装例（将来の実装用）
 * 
 * 以下のライブラリを検討:
 * - @vercel/og: Vercel Edge Runtime用OG画像生成
 * - canvas: Node.js Canvas API
 * - sharp: 高性能画像処理
 * - puppeteer: ブラウザベース画像生成
 */

/*
// @vercel/og を使用した実装例
import { ImageResponse } from '@vercel/og';

export async function generateBriefOG(briefData: BriefOGData) {
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
          backgroundImage: 'linear-gradient(45deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 'bold', color: 'white' }}>
          Baseball AI Media
        </div>
        <div style={{ fontSize: 32, color: '#64748b', marginTop: 20 }}>
          {formatDateForDisplay(briefData.date)} デイリーブリーフ
        </div>
        {briefData.gotd && (
          <div style={{ fontSize: 36, color: 'white', marginTop: 40 }}>
            {briefData.gotd.away_team} vs {briefData.gotd.home_team}
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
*/