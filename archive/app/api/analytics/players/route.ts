import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface ComprehensivePlayerData {
  player_id: string;
  name: string;
  team: string;
  entry_year: number;
  season_stats?: any;
  current_season_stats?: any;
  stats_comparison?: any;
  update_status?: any;
  integrated_stats?: any;
  insights?: any;
  game_performances?: any;
}

/**
 * 包括的選手分析データAPI
 * GET /api/analytics/players
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId');
    const team = url.searchParams.get('team');
    const entryYear = url.searchParams.get('entryYear');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // 2025年現在シーズンデータを読み込み
    const currentSeasonData = await loadCurrentSeasonData();
    
    // 詳細統計データを読み込み
    const detailedStatsData = await loadDetailedStatsData();

    // 統合分析データを読み込み
    const integratedData = await loadIntegratedAnalyticsData();

    // データをマージ
    let players = mergePlayerData(currentSeasonData, detailedStatsData, integratedData);

    // フィルタリング
    if (playerId) {
      players = players.filter(p => p.player_id === playerId);
    }
    
    if (team) {
      players = players.filter(p => p.team === team);
    }
    
    if (entryYear) {
      players = players.filter(p => p.entry_year === parseInt(entryYear));
    }

    // 制限適用
    players = players.slice(0, limit);

    // レスポンス用データの整形
    const formattedPlayers = players.map(player => ({
      player_id: player.player_id,
      name: cleanPlayerName(player.name),
      team: player.team,
      entry_year: player.entry_year,
      current_stats: player.current_season_stats || player.season_stats,
      historical_stats: player.season_stats,
      performance_comparison: player.stats_comparison,
      update_status: {
        last_updated: player.update_status?.last_updated || new Date().toISOString(),
        has_current_data: player.update_status?.has_current_data || false,
        data_quality: calculateDataQuality(player)
      },
      analytics: {
        batting_metrics: extractBattingMetrics(player),
        trend_indicators: extractTrendIndicators(player),
        team_contribution: calculateTeamContribution(player)
      }
    }));

    return NextResponse.json({
      success: true,
      data: formattedPlayers,
      meta: {
        total_players: formattedPlayers.length,
        data_sources: ['current_season_2025', 'detailed_stats', 'integrated_analytics'],
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics Players API Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch player analytics data',
      data: []
    }, { status: 500 });
  }
}

/**
 * 現在シーズンデータの読み込み
 */
async function loadCurrentSeasonData(): Promise<ComprehensivePlayerData[]> {
  const files = [
    'data/current_season_2025/current_season_2021_entrants_2025-08-09.json',
    'data/current_season_2025/current_season_2022_entrants_2025-08-09.json'
  ];

  const allData: ComprehensivePlayerData[] = [];

  for (const filePath of files) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        allData.push(...data);
      }
    } catch (error) {
      console.warn(`Failed to load ${filePath}:`, error);
    }
  }

  return allData;
}

/**
 * 詳細統計データの読み込み
 */
async function loadDetailedStatsData(): Promise<ComprehensivePlayerData[]> {
  const files = [
    'data/detailed_stats/detailed_stats_2021/stats_only_2021.json',
    'data/detailed_stats/detailed_stats_2022/stats_only_2022.json'
  ];

  const allData: ComprehensivePlayerData[] = [];

  for (const filePath of files) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        allData.push(...data);
      }
    } catch (error) {
      console.warn(`Failed to load detailed stats ${filePath}:`, error);
    }
  }

  return allData;
}

/**
 * 統合分析データの読み込み
 */
async function loadIntegratedAnalyticsData(): Promise<ComprehensivePlayerData[]> {
  try {
    const analyticsDir = path.join(process.cwd(), 'data/integrated_analytics');
    const files = await fs.readdir(analyticsDir);
    const integratedFiles = files.filter(f => f.includes('integrated_players_'));
    
    if (integratedFiles.length === 0) return [];
    
    // 最新のファイルを使用
    const latestFile = integratedFiles.sort().reverse()[0];
    const filePath = path.join(analyticsDir, latestFile);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Failed to load integrated analytics data:', error);
    return [];
  }
}

/**
 * プレイヤーデータのマージ
 */
function mergePlayerData(
  currentData: ComprehensivePlayerData[],
  detailedData: ComprehensivePlayerData[],
  integratedData: ComprehensivePlayerData[]
): ComprehensivePlayerData[] {
  const playerMap = new Map<string, ComprehensivePlayerData>();

  // 詳細データを基準に開始
  for (const player of detailedData) {
    playerMap.set(player.player_id, { ...player });
  }

  // 現在シーズンデータをマージ
  for (const player of currentData) {
    const existing = playerMap.get(player.player_id);
    if (existing) {
      playerMap.set(player.player_id, {
        ...existing,
        current_season_stats: player.current_season_stats,
        stats_comparison: player.stats_comparison,
        update_status: player.update_status
      });
    } else {
      playerMap.set(player.player_id, player);
    }
  }

  // 統合分析データをマージ
  for (const player of integratedData) {
    const existing = playerMap.get(player.player_id);
    if (existing) {
      playerMap.set(player.player_id, {
        ...existing,
        integrated_stats: (player as any).integrated_stats,
        insights: (player as any).insights,
        game_performances: (player as any).game_performances
      });
    }
  }

  return Array.from(playerMap.values());
}

/**
 * 選手名のクリーニング
 */
function cleanPlayerName(name: string): string {
  return name
    .replace(/\d{4}年度版\s*/, '')
    .replace(/【.*?】.*$/, '')
    .trim();
}

/**
 * データ品質の計算
 */
function calculateDataQuality(player: ComprehensivePlayerData): number {
  let score = 0;
  let maxScore = 0;

  // 基本データの存在チェック
  maxScore += 20;
  if (player.name && player.player_id) score += 20;

  // 現在シーズンデータの存在チェック
  maxScore += 30;
  if (player.current_season_stats) score += 30;

  // 歴史データの存在チェック
  maxScore += 25;
  if (player.season_stats) score += 25;

  // 比較データの存在チェック
  maxScore += 15;
  if (player.stats_comparison) score += 15;

  // 更新状態の確認
  maxScore += 10;
  if (player.update_status?.has_current_data) score += 10;

  return Math.round((score / maxScore) * 100);
}

/**
 * 打撃指標の抽出
 */
function extractBattingMetrics(player: ComprehensivePlayerData): any {
  const currentStats = player.current_season_stats || player.season_stats;
  
  if (!currentStats) return null;

  return {
    batting_average: currentStats.batting_average || 0,
    on_base_percentage: currentStats.on_base_percentage || 0,
    slugging_percentage: currentStats.slugging_percentage || 0,
    ops: currentStats.ops || 0,
    home_runs: currentStats.home_runs || 0,
    rbis: currentStats.rbis || 0,
    games: currentStats.games || 0,
    at_bats: currentStats.at_bats || 0,
    hits: currentStats.hits || 0
  };
}

/**
 * トレンド指標の抽出
 */
function extractTrendIndicators(player: ComprehensivePlayerData): any {
  if (!player.stats_comparison) return null;

  const comparison = player.stats_comparison;
  
  return {
    batting_average_change: comparison.avg_diff || 0,
    power_change: comparison.hr_diff || 0,
    production_change: comparison.rbi_diff || 0,
    overall_change: comparison.ops_diff || 0,
    improvement_indicators: comparison.improvement_indicators || [],
    trend_direction: determineTrendDirection(comparison)
  };
}

/**
 * チーム貢献度の計算
 */
function calculateTeamContribution(player: ComprehensivePlayerData): any {
  const stats = player.current_season_stats || player.season_stats;
  
  if (!stats) return null;

  // 基本的な貢献度計算
  const offensiveContribution = (stats.ops || 0) * (stats.games || 0);
  const gameImpact = stats.home_runs * 1.5 + stats.rbis * 1.0;
  
  return {
    offensive_contribution: Math.round(offensiveContribution * 100) / 100,
    game_impact_score: Math.round(gameImpact * 100) / 100,
    games_contribution: stats.games || 0,
    consistency_rating: calculateConsistencyRating(stats)
  };
}

/**
 * トレンド方向の判定
 */
function determineTrendDirection(comparison: any): 'improving' | 'declining' | 'stable' {
  if (!comparison) return 'stable';

  const positiveChanges = [
    comparison.avg_diff > 0.010,
    comparison.hr_diff > 2,
    comparison.rbi_diff > 5,
    comparison.ops_diff > 0.020
  ].filter(Boolean).length;

  const negativeChanges = [
    comparison.avg_diff < -0.010,
    comparison.hr_diff < -2,
    comparison.rbi_diff < -5,
    comparison.ops_diff < -0.020
  ].filter(Boolean).length;

  if (positiveChanges > negativeChanges) return 'improving';
  if (negativeChanges > positiveChanges) return 'declining';
  return 'stable';
}

/**
 * 一貫性評価の計算
 */
function calculateConsistencyRating(stats: any): number {
  if (!stats || !stats.games) return 0;
  
  // 出場試合数に基づく基本評価
  const gameConsistency = Math.min(stats.games / 50, 1.0);
  
  // 成績の安定性（簡易計算）
  const performanceStability = (stats.batting_average || 0) > 0.200 ? 0.8 : 0.4;
  
  return Math.round((gameConsistency + performanceStability) * 5 * 100) / 100;
}