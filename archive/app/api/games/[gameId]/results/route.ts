import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';

const DB_PATH = process.env.COMPREHENSIVE_DB_PATH || './comprehensive_baseball_database.db';

interface PitchStats {
  total_pitches: number;
  unique_pitchers: number;
  unique_batters: number;
  max_inning: number;
}

interface PitcherStat {
  pitcher_name: string;
  pitches_thrown: number;
  strikes: number;
  balls: number;
  hits_allowed: number;
  home_runs_allowed: number;
  walks_allowed: number;
  strikeouts: number;
  avg_velocity: number;
  first_inning: number;
  last_inning: number;
}

interface BatterStat {
  batter_name: string;
  plate_appearances: number;
  hits: number;
  home_runs: number;
  walks: number;
  strikeouts: number;
  rbis: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const db = new Database(DB_PATH);

    // 試合基本情報
    const gameInfo = db.prepare(`
      SELECT * FROM games WHERE game_id = ?
    `).get(params.gameId);

    if (!gameInfo) {
      db.close();
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // 一球速報から試合統計を計算
    const pitchStats = db.prepare(`
      SELECT 
        COUNT(*) as total_pitches,
        COUNT(DISTINCT pitcher_name) as unique_pitchers,
        COUNT(DISTINCT batter_name) as unique_batters,
        MAX(inning) as max_inning
      FROM pitch_by_pitch 
      WHERE game_id = ?
    `).get(params.gameId) as PitchStats | undefined;

    // 投手別統計
    const pitcherStats = db.prepare(`
      SELECT 
        pitcher_name,
        COUNT(*) as pitches_thrown,
        COUNT(CASE WHEN result LIKE '%ストライク%' OR result LIKE '%空振り%' THEN 1 END) as strikes,
        COUNT(CASE WHEN result LIKE '%ボール%' THEN 1 END) as balls,
        COUNT(CASE WHEN result LIKE '%ヒット%' OR result LIKE '%安打%' THEN 1 END) as hits_allowed,
        COUNT(CASE WHEN result LIKE '%本塁打%' OR result LIKE '%ホームラン%' THEN 1 END) as home_runs_allowed,
        COUNT(CASE WHEN result LIKE '%四球%' OR result LIKE '%敬遠%' THEN 1 END) as walks_allowed,
        COUNT(CASE WHEN result LIKE '%三振%' THEN 1 END) as strikeouts,
        AVG(CASE WHEN velocity > 0 THEN velocity END) as avg_velocity,
        MIN(inning) as first_inning,
        MAX(inning) as last_inning
      FROM pitch_by_pitch 
      WHERE game_id = ? 
      GROUP BY pitcher_name
      ORDER BY MIN(inning), COUNT(*) DESC
    `).all(params.gameId) as PitcherStat[];

    // 打者別統計
    const batterStats = db.prepare(`
      SELECT 
        batter_name,
        COUNT(DISTINCT inning || side || outs) as plate_appearances,
        COUNT(CASE WHEN result LIKE '%ヒット%' OR result LIKE '%安打%' THEN 1 END) as hits,
        COUNT(CASE WHEN result LIKE '%本塁打%' OR result LIKE '%ホームラン%' THEN 1 END) as home_runs,
        COUNT(CASE WHEN result LIKE '%四球%' OR result LIKE '%敬遠%' THEN 1 END) as walks,
        COUNT(CASE WHEN result LIKE '%三振%' THEN 1 END) as strikeouts,
        COUNT(CASE WHEN result LIKE '%打点%' THEN 1 END) as rbis
      FROM pitch_by_pitch 
      WHERE game_id = ? 
      GROUP BY batter_name
      ORDER BY COUNT(*) DESC
    `).all(params.gameId) as BatterStat[];

    // イニング別得点（模擬データ - 実際の実装では別途スコアデータが必要）
    const inningScores = {
      away: [0, 1, 0, 0, 2, 0, 1, 0, 0],
      home: [1, 0, 2, 1, 0, 0, 0, 1, 0]
    };

    const finalScore = {
      away: inningScores.away.reduce((sum, score) => sum + score, 0),
      home: inningScores.home.reduce((sum, score) => sum + score, 0)
    };

    // レスポンス構築
    const results = {
      game_info: gameInfo,
      final_score: finalScore,
      inning_scores: inningScores,
      game_stats: {
        total_pitches: pitchStats?.total_pitches || 0,
        unique_pitchers: pitchStats?.unique_pitchers || 0,
        unique_batters: pitchStats?.unique_batters || 0,
        max_inning: pitchStats?.max_inning || 9
      },
      pitcher_statistics: pitcherStats.map((pitcher: PitcherStat) => ({
        player_name: pitcher.pitcher_name,
        pitches_thrown: pitcher.pitches_thrown,
        strikes: pitcher.strikes,
        balls: pitcher.balls,
        hits_allowed: pitcher.hits_allowed,
        home_runs_allowed: pitcher.home_runs_allowed,
        walks_allowed: pitcher.walks_allowed,
        strikeouts: pitcher.strikeouts,
        avg_velocity: pitcher.avg_velocity ? Math.round(pitcher.avg_velocity) : null,
        innings_range: `${pitcher.first_inning}-${pitcher.last_inning}回`
      })),
      batter_statistics: batterStats.map((batter: BatterStat) => ({
        player_name: batter.batter_name,
        plate_appearances: batter.plate_appearances,
        hits: batter.hits,
        home_runs: batter.home_runs,
        walks: batter.walks,
        strikeouts: batter.strikeouts,
        rbis: batter.rbis,
        batting_average: batter.plate_appearances > 0 ? 
          (batter.hits / Math.max(batter.plate_appearances - batter.walks, 1)).toFixed(3) : '.000'
      })),
      has_pitch_data: (pitchStats?.total_pitches || 0) > 0
    };

    db.close();

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Game results API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}