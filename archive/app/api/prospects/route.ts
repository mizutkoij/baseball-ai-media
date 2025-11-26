import { NextRequest, NextResponse } from 'next/server';

/**
 * Prospect Watch API
 * ファーム選手の昇格候補データを取得
 */

interface ProspectQueryParams {
  farmLeague?: 'EAST' | 'WEST';
  position?: string;
  limit?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params: ProspectQueryParams = {
      farmLeague: searchParams.get('farmLeague') as 'EAST' | 'WEST' || undefined,
      position: searchParams.get('position') || undefined,
      limit: parseInt(searchParams.get('limit') || '10')
    };

    // DB接続（実際の実装では適切なDB接続を使用）
    const prospects = await fetchProspectData(params);

    return NextResponse.json({
      success: true,
      prospects,
      meta: {
        total: prospects.length,
        farmLeague: params.farmLeague || 'ALL',
        position: params.position || 'ALL'
      }
    });

  } catch (error) {
    console.error('Prospects API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prospect data' },
      { status: 500 }
    );
  }
}

async function fetchProspectData(params: ProspectQueryParams) {
  // 実際の実装では以下のSQLクエリを使用
  const sql = `
    WITH pitcher_stats AS (
      SELECT 
        p.pitcher_name,
        g.farm_league,
        COUNT(*) as total_pitches,
        COUNT(DISTINCT p.game_id) as games_count,
        AVG(p.speed_kmh) as avg_velocity,
        COUNT(*) FILTER (WHERE p.zone LIKE '%ストライク%') * 100.0 / COUNT(*) as strike_rate,
        MODE() WITHIN GROUP (ORDER BY p.pitch_type) as dominant_pitch,
        ARRAY_AGG(DISTINCT p.pitch_type) as pitch_types,
        MAX(p.timestamp) as last_seen,
        STDDEV(p.speed_kmh) as velocity_consistency
      FROM pitch_events p
      JOIN games g ON p.game_id = g.game_id
      WHERE g.level = 'NPB2'
        AND p.timestamp > CURRENT_DATE - INTERVAL '60 days'
        AND p.pitcher_name IS NOT NULL
        AND p.speed_kmh > 0
        ${params.farmLeague ? `AND g.farm_league = '${params.farmLeague}'` : ''}
      GROUP BY p.pitcher_name, g.farm_league
      HAVING COUNT(*) >= 50  -- 最低50球以上
    ),
    promotion_scores AS (
      SELECT 
        pitcher_name,
        farm_league,
        -- 球速スコア (140km/h基準で正規化)
        LEAST(100, (avg_velocity / 140.0) * 100) as velocity_score,
        -- 制球スコア (ストライク率65%基準)
        LEAST(100, (strike_rate / 65.0) * 100) as control_score,
        -- 球種多様性スコア (5球種以上で満点)
        LEAST(100, (array_length(pitch_types, 1) / 5.0) * 100) as variety_score,
        -- 安定性スコア (球速のばらつきが少ないほど高い)
        GREATEST(0, 100 - (velocity_consistency * 10)) as consistency_score,
        -- 傾向分析（直近10登板 vs 過去10登板）
        CASE 
          WHEN recent_avg_velocity > past_avg_velocity THEN 'improving'
          WHEN recent_avg_velocity < past_avg_velocity THEN 'declining'
          ELSE 'stable'
        END as trend
      FROM (
        SELECT 
          ps.*,
          -- 直近10登板の平均球速
          (SELECT AVG(speed_kmh) 
           FROM pitch_events p2 
           JOIN games g2 ON p2.game_id = g2.game_id
           WHERE p2.pitcher_name = ps.pitcher_name 
             AND g2.farm_league = ps.farm_league
             AND p2.timestamp > CURRENT_DATE - INTERVAL '20 days'
          ) as recent_avg_velocity,
          -- 過去10登板の平均球速  
          (SELECT AVG(speed_kmh)
           FROM pitch_events p3
           JOIN games g3 ON p3.game_id = g3.game_id
           WHERE p3.pitcher_name = ps.pitcher_name
             AND g3.farm_league = ps.farm_league
             AND p3.timestamp BETWEEN CURRENT_DATE - INTERVAL '40 days' 
                                 AND CURRENT_DATE - INTERVAL '20 days'
          ) as past_avg_velocity
        FROM pitcher_stats ps
      ) stats_with_trend
    )
    SELECT 
      ps.pitcher_name,
      ps.farm_league,
      ps.avg_velocity,
      ps.strike_rate,
      ps.dominant_pitch,
      ps.games_count,
      ps.last_seen,
      prs.velocity_score,
      prs.control_score,
      prs.variety_score,
      prs.consistency_score,
      prs.trend,
      -- 総合スコア
      (prs.velocity_score + prs.control_score + prs.variety_score + prs.consistency_score) / 4 as overall_score
    FROM pitcher_stats ps
    JOIN promotion_scores prs ON ps.pitcher_name = prs.pitcher_name 
                              AND ps.farm_league = prs.farm_league
    ORDER BY overall_score DESC, ps.last_seen DESC
    LIMIT ${params.limit || 10}
  `;

  // モックデータ（実際の実装時は上記SQLクエリを実行）
  const mockProspects = [
    {
      playerId: 'farm_001',
      playerName: '田中 太郎',
      position: '投手',
      farmTeam: '読売ジャイアンツ',
      farmLeague: 'EAST' as const,
      recentPerformance: [
        {
          date: '2025-08-10',
          gameId: 'farm_game_001',
          opponent: 'ヤクルト',
          pitchMix: [
            { type: 'ストレート', percentage: 45, velocity: 142 },
            { type: 'スライダー', percentage: 25, velocity: 128 },
            { type: 'カーブ', percentage: 20, velocity: 118 },
            { type: 'チェンジアップ', percentage: 10, velocity: 132 }
          ],
          zone: [
            { zone: '外角低め', accuracy: 85, count: 12 },
            { zone: '内角高め', accuracy: 75, count: 8 },
            { zone: '真ん中低め', accuracy: 90, count: 15 }
          ],
          results: {
            innings: 6.0,
            pitches: 87,
            strikes: 58,
            strikeouts: 7,
            era: 2.35
          }
        }
      ],
      comparison: {
        farmStats: {
          period: '2025年1-7月',
          games: 15,
          avgVelocity: 141,
          strikeRate: 64,
          dominantPitch: 'ストレート'
        },
        npb1Stats: {
          period: '2025年8月',
          games: 3,
          avgVelocity: 143,
          strikeRate: 67,
          dominantPitch: 'ストレート'
        }
      },
      promotionScore: {
        overall: 78,
        velocity: 85,
        control: 72,
        variety: 75,
        consistency: 80,
        trend: 'improving' as const
      }
    },
    {
      playerId: 'farm_002', 
      playerName: '佐藤 二郎',
      position: '投手',
      farmTeam: '阪神タイガース',
      farmLeague: 'WEST' as const,
      recentPerformance: [
        {
          date: '2025-08-09',
          gameId: 'farm_game_002',
          opponent: '広島',
          pitchMix: [
            { type: 'ストレート', percentage: 40, velocity: 145 },
            { type: 'フォーク', percentage: 30, velocity: 135 },
            { type: 'スライダー', percentage: 20, velocity: 132 },
            { type: 'カットボール', percentage: 10, velocity: 141 }
          ],
          zone: [
            { zone: '外角低め', accuracy: 88, count: 14 },
            { zone: '内角低め', accuracy: 82, count: 10 },
            { zone: '真ん中高め', accuracy: 70, count: 6 }
          ],
          results: {
            innings: 7.0,
            pitches: 95,
            strikes: 68,
            strikeouts: 9,
            era: 1.89
          }
        }
      ],
      promotionScore: {
        overall: 85,
        velocity: 92,
        control: 78,
        variety: 85,
        consistency: 85,
        trend: 'stable' as const
      }
    }
  ];

  // フィルタリング
  let filteredProspects = mockProspects;
  
  if (params.farmLeague) {
    filteredProspects = filteredProspects.filter(p => p.farmLeague === params.farmLeague);
  }
  
  if (params.position && params.position !== 'ALL') {
    filteredProspects = filteredProspects.filter(p => p.position === params.position);
  }

  return filteredProspects.slice(0, params.limit || 10);
}