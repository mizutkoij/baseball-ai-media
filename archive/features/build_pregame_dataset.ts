/**
 * Pregame Dataset Builder - プリゲーム勝率予測用特徴量構築
 * 
 * 機能:
 * - 既存 data/games, data/details から特徴テーブル生成
 * - チーム強度、先発投手、球場特性の特徴量算出
 * - DuckDB でバッチ処理 → Parquet 出力
 * - 段階的特徴量追加に対応
 */

import { logger } from '../lib/logger';
import { incrementCounter, recordHistogram } from '../lib/prometheus-metrics';
import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';

interface PregameFeatures {
  // 基本情報
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  venue: string;
  start_time: string;
  
  // ラベル（学習用）
  home_win: number; // 0 or 1
  
  // チーム強度特徴量（過去30試合）
  home_win_rate_30: number;
  away_win_rate_30: number;
  home_runs_scored_avg_30: number;
  away_runs_scored_avg_30: number;
  home_runs_allowed_avg_30: number;
  away_runs_allowed_avg_30: number;
  home_run_differential_30: number;
  away_run_differential_30: number;
  
  // チーム強度特徴量（過去10試合）
  home_win_rate_10: number;
  away_win_rate_10: number;
  home_runs_scored_avg_10: number;
  away_runs_scored_avg_10: number;
  home_runs_allowed_avg_10: number;
  away_runs_allowed_avg_10: number;
  
  // 先発投手特徴量
  home_pitcher_era: number;
  away_pitcher_era: number;
  home_pitcher_whip: number;
  away_pitcher_whip: number;
  home_pitcher_wins: number;
  away_pitcher_wins: number;
  home_pitcher_losses: number;
  away_pitcher_losses: number;
  home_pitcher_games_started: number;
  away_pitcher_games_started: number;
  home_pitcher_innings_pitched: number;
  away_pitcher_innings_pitched: number;
  
  // 先発投手フォーム（直近5試合）
  home_pitcher_era_5: number;
  away_pitcher_era_5: number;
  home_pitcher_days_rest: number;
  away_pitcher_days_rest: number;
  
  // 球場特性
  venue_home_advantage: number; // ホーム勝率 - 全体勝率
  venue_scoring_factor: number; // 球場得点倍率
  
  // 対戦成績（シーズン内）
  head_to_head_home_wins: number;
  head_to_head_total_games: number;
  
  // 時系列特徴量
  season_game_number: number; // シーズン何試合目か
  home_games_in_last_7_days: number;
  away_games_in_last_7_days: number;
  
  // カテゴリカル特徴量（ワンホット化）
  is_weekend: number; // 0 or 1
  is_evening_game: number; // 18時以降
  is_interleague: number; // 交流戦
  month: number; // 1-12
  day_of_week: number; // 1-7
}

interface TeamStats {
  team_id: string;
  date: string;
  win_rate: number;
  runs_scored_avg: number;
  runs_allowed_avg: number;
  run_differential: number;
  games_played: number;
}

interface PitcherStats {
  pitcher_name: string;
  team_id: string;
  date: string;
  era: number;
  whip: number;
  wins: number;
  losses: number;
  games_started: number;
  innings_pitched: number;
  last_start_date?: string;
}

export class PregameDatasetBuilder {
  private db: Database.Database;
  private outputDir: string;

  constructor(dbPath: string = './data/baseball.db', outputDir: string = './features') {
    this.db = new Database(dbPath);
    this.outputDir = outputDir;
    this.initializeTables();
  }

  private initializeTables() {
    // 特徴量計算用の一時テーブル作成
    this.db.exec(`
      -- チーム成績集計用テーブル
      CREATE TEMP TABLE IF NOT EXISTS team_rolling_stats AS
      SELECT 
        team_id,
        date,
        COUNT(*) OVER (
          PARTITION BY team_id 
          ORDER BY date 
          ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ) as games_count,
        AVG(CASE WHEN home_team = team_id THEN home_score ELSE away_score END) OVER (
          PARTITION BY team_id 
          ORDER BY date 
          ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ) as runs_scored_avg_30,
        AVG(CASE WHEN home_team = team_id THEN away_score ELSE home_score END) OVER (
          PARTITION BY team_id 
          ORDER BY date 
          ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ) as runs_allowed_avg_30
      FROM (
        SELECT date, home_team as team_id, home_score, away_score FROM games
        UNION ALL
        SELECT date, away_team as team_id, home_score, away_score FROM games
      ) team_games
      ORDER BY team_id, date;
    `);

    logger.info('Initialized temporary tables for feature calculation');
  }

  /**
   * プリゲーム特徴量データセットの構築
   */
  async buildDataset(
    startDate: string = '2020-01-01',
    endDate: string = new Date().toISOString().split('T')[0],
    minGamesForStats: number = 10
  ): Promise<string> {
    const correlationId = `dataset-build-${Date.now()}`;
    
    logger.info('Starting pregame dataset building', {
      correlationId,
      startDate,
      endDate,
      minGamesForStats
    });

    const startTime = Date.now();

    try {
      // 出力ディレクトリ作成
      await fs.mkdir(this.outputDir, { recursive: true });

      // 基本的な試合データを取得
      const games = this.getGamesData(startDate, endDate, minGamesForStats);
      logger.info(`Found ${games.length} games for feature building`, { correlationId });

      if (games.length === 0) {
        throw new Error('No games found in specified date range');
      }

      // 特徴量を段階的に計算
      const features: PregameFeatures[] = [];
      let processed = 0;

      for (const game of games) {
        try {
          const gameFeatures = await this.buildGameFeatures(game);
          features.push(gameFeatures);
          processed++;

          if (processed % 100 === 0) {
            logger.info(`Processed ${processed}/${games.length} games`, {
              correlationId,
              progress: (processed / games.length * 100).toFixed(1) + '%'
            });
          }
        } catch (error) {
          logger.warn('Failed to build features for game', {
            correlationId,
            gameId: game.game_id,
            error: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }

      // 特徴量の統計情報
      const stats = this.calculateFeatureStats(features);
      logger.info('Feature statistics calculated', { correlationId, stats });

      // Parquet形式で出力
      const outputPath = await this.saveDataset(features, 'pregame_features');
      
      const duration = Date.now() - startTime;
      
      recordHistogram('feature_build_duration_seconds', duration / 1000, {
        dataset_type: 'pregame',
        games_count: features.length.toString()
      });

      incrementCounter('feature_datasets_created_total', {
        type: 'pregame',
        format: 'parquet'
      });

      logger.info('Pregame dataset building completed', {
        correlationId,
        outputPath,
        totalFeatures: features.length,
        duration
      });

      return outputPath;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Pregame dataset building failed', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      incrementCounter('feature_build_errors_total', { type: 'pregame' });
      throw error;
    }
  }

  /**
   * 基本的な試合データを取得
   */
  private getGamesData(startDate: string, endDate: string, minGames: number): any[] {
    return this.db.prepare(`
      SELECT 
        g.game_id,
        g.date,
        g.home_team,
        g.away_team,
        g.venue,
        g.start_time,
        g.home_score,
        g.away_score,
        CASE WHEN g.home_score > g.away_score THEN 1 ELSE 0 END as home_win,
        ROW_NUMBER() OVER (ORDER BY g.date, g.game_id) as season_game_number
      FROM games g
      WHERE g.date >= ? AND g.date <= ?
        AND g.home_score IS NOT NULL 
        AND g.away_score IS NOT NULL
        -- 十分な試合データがある期間のみ
        AND g.date >= (
          SELECT MIN(date) + INTERVAL ${minGames} DAY 
          FROM games 
          WHERE date >= ?
        )
      ORDER BY g.date, g.game_id
    `).all(startDate, endDate, startDate);
  }

  /**
   * 個別試合の特徴量を構築
   */
  private async buildGameFeatures(game: any): Promise<PregameFeatures> {
    // チーム強度特徴量を取得
    const [homeTeamStats30, awayTeamStats30] = await Promise.all([
      this.getTeamStats(game.home_team, game.date, 30),
      this.getTeamStats(game.away_team, game.date, 30)
    ]);

    const [homeTeamStats10, awayTeamStats10] = await Promise.all([
      this.getTeamStats(game.home_team, game.date, 10),
      this.getTeamStats(game.away_team, game.date, 10)
    ]);

    // 先発投手情報を取得
    const [homePitcher, awayPitcher] = await Promise.all([
      this.getPitcherStats(game.home_team, game.date),
      this.getPitcherStats(game.away_team, game.date)
    ]);

    // 球場特性を取得
    const venueStats = this.getVenueStats(game.venue, game.date);

    // 対戦成績を取得
    const headToHead = this.getHeadToHeadStats(game.home_team, game.away_team, game.date);

    // 時系列特徴量を計算
    const gameDate = new Date(game.date);
    const recentGames = this.getRecentGamesCount(game.home_team, game.away_team, game.date, 7);

    const features: PregameFeatures = {
      // 基本情報
      game_id: game.game_id,
      date: game.date,
      home_team: game.home_team,
      away_team: game.away_team,
      venue: game.venue,
      start_time: game.start_time,
      
      // ラベル
      home_win: game.home_win,
      
      // チーム強度（30試合）
      home_win_rate_30: homeTeamStats30.win_rate,
      away_win_rate_30: awayTeamStats30.win_rate,
      home_runs_scored_avg_30: homeTeamStats30.runs_scored_avg,
      away_runs_scored_avg_30: awayTeamStats30.runs_scored_avg,
      home_runs_allowed_avg_30: homeTeamStats30.runs_allowed_avg,
      away_runs_allowed_avg_30: awayTeamStats30.runs_allowed_avg,
      home_run_differential_30: homeTeamStats30.run_differential,
      away_run_differential_30: awayTeamStats30.run_differential,
      
      // チーム強度（10試合）
      home_win_rate_10: homeTeamStats10.win_rate,
      away_win_rate_10: awayTeamStats10.win_rate,
      home_runs_scored_avg_10: homeTeamStats10.runs_scored_avg,
      away_runs_scored_avg_10: awayTeamStats10.runs_scored_avg,
      home_runs_allowed_avg_10: homeTeamStats10.runs_allowed_avg,
      away_runs_allowed_avg_10: awayTeamStats10.runs_allowed_avg,
      
      // 先発投手
      home_pitcher_era: homePitcher?.era ?? 4.0,
      away_pitcher_era: awayPitcher?.era ?? 4.0,
      home_pitcher_whip: homePitcher?.whip ?? 1.3,
      away_pitcher_whip: awayPitcher?.whip ?? 1.3,
      home_pitcher_wins: homePitcher?.wins ?? 0,
      away_pitcher_wins: awayPitcher?.wins ?? 0,
      home_pitcher_losses: homePitcher?.losses ?? 0,
      away_pitcher_losses: awayPitcher?.losses ?? 0,
      home_pitcher_games_started: homePitcher?.games_started ?? 0,
      away_pitcher_games_started: awayPitcher?.games_started ?? 0,
      home_pitcher_innings_pitched: homePitcher?.innings_pitched ?? 0,
      away_pitcher_innings_pitched: awayPitcher?.innings_pitched ?? 0,
      
      // 先発投手フォーム
      home_pitcher_era_5: this.getPitcherRecentForm(game.home_team, game.date, 5),
      away_pitcher_era_5: this.getPitcherRecentForm(game.away_team, game.date, 5),
      home_pitcher_days_rest: this.getPitcherDaysRest(game.home_team, game.date),
      away_pitcher_days_rest: this.getPitcherDaysRest(game.away_team, game.date),
      
      // 球場特性
      venue_home_advantage: venueStats.home_advantage,
      venue_scoring_factor: venueStats.scoring_factor,
      
      // 対戦成績
      head_to_head_home_wins: headToHead.home_wins,
      head_to_head_total_games: headToHead.total_games,
      
      // 時系列
      season_game_number: game.season_game_number,
      home_games_in_last_7_days: recentGames.home_games,
      away_games_in_last_7_days: recentGames.away_games,
      
      // カテゴリカル
      is_weekend: gameDate.getDay() === 0 || gameDate.getDay() === 6 ? 1 : 0,
      is_evening_game: this.parseTime(game.start_time) >= 18 ? 1 : 0,
      is_interleague: this.isInterleague(game.home_team, game.away_team) ? 1 : 0,
      month: gameDate.getMonth() + 1,
      day_of_week: gameDate.getDay() + 1
    };

    return features;
  }

  /**
   * チーム成績統計の取得
   */
  private getTeamStats(teamId: string, beforeDate: string, days: number): TeamStats {
    const result = this.db.prepare(`
      WITH team_games AS (
        SELECT 
          date,
          CASE WHEN home_team = ? THEN 1 ELSE 0 END as is_home,
          CASE WHEN home_team = ? THEN home_score ELSE away_score END as runs_scored,
          CASE WHEN home_team = ? THEN away_score ELSE home_score END as runs_allowed,
          CASE WHEN (home_team = ? AND home_score > away_score) 
               OR (away_team = ? AND away_score > home_score) THEN 1 ELSE 0 END as win
        FROM games 
        WHERE (home_team = ? OR away_team = ?)
          AND date < ?
          AND home_score IS NOT NULL
        ORDER BY date DESC
        LIMIT ?
      )
      SELECT 
        COUNT(*) as games_played,
        AVG(CAST(win as FLOAT)) as win_rate,
        AVG(runs_scored) as runs_scored_avg,
        AVG(runs_allowed) as runs_allowed_avg,
        AVG(runs_scored - runs_allowed) as run_differential
      FROM team_games
    `).get(teamId, teamId, teamId, teamId, teamId, teamId, teamId, beforeDate, days);

    return {
      team_id: teamId,
      date: beforeDate,
      win_rate: result?.win_rate ?? 0.5,
      runs_scored_avg: result?.runs_scored_avg ?? 4.0,
      runs_allowed_avg: result?.runs_allowed_avg ?? 4.0,
      run_differential: result?.run_differential ?? 0.0,
      games_played: result?.games_played ?? 0
    };
  }

  /**
   * 先発投手統計の取得
   */
  private getPitcherStats(teamId: string, beforeDate: string): PitcherStats | null {
    // 直近の先発投手情報を取得（簡略実装）
    const result = this.db.prepare(`
      SELECT 
        pitcher_name,
        AVG(era) as era,
        AVG(whip) as whip,
        SUM(wins) as wins,
        SUM(losses) as losses,
        COUNT(*) as games_started,
        SUM(innings_pitched) as innings_pitched
      FROM starters s
      WHERE s.team = ? AND s.date < ?
      GROUP BY pitcher_name
      ORDER BY MAX(s.date) DESC
      LIMIT 1
    `).get(teamId, beforeDate);

    if (!result) return null;

    return {
      pitcher_name: result.pitcher_name,
      team_id: teamId,
      date: beforeDate,
      era: result.era ?? 4.0,
      whip: result.whip ?? 1.3,
      wins: result.wins ?? 0,
      losses: result.losses ?? 0,
      games_started: result.games_started ?? 0,
      innings_pitched: result.innings_pitched ?? 0
    };
  }

  /**
   * 先発投手の直近フォーム取得
   */
  private getPitcherRecentForm(teamId: string, beforeDate: string, games: number): number {
    const result = this.db.prepare(`
      SELECT AVG(era) as recent_era
      FROM starters s
      WHERE s.team = ? AND s.date < ?
      ORDER BY s.date DESC
      LIMIT ?
    `).get(teamId, beforeDate, games);

    return result?.recent_era ?? 4.0;
  }

  /**
   * 先発投手の休養日数取得
   */
  private getPitcherDaysRest(teamId: string, beforeDate: string): number {
    const result = this.db.prepare(`
      SELECT 
        julianday(?) - julianday(MAX(date)) as days_rest
      FROM starters s
      WHERE s.team = ?
    `).get(beforeDate, teamId);

    return Math.max(result?.days_rest ?? 5, 0);
  }

  /**
   * 球場統計の取得
   */
  private getVenueStats(venue: string, beforeDate: string): { home_advantage: number; scoring_factor: number } {
    const result = this.db.prepare(`
      WITH venue_games AS (
        SELECT 
          venue,
          CASE WHEN home_score > away_score THEN 1 ELSE 0 END as home_win,
          (home_score + away_score) as total_runs
        FROM games 
        WHERE venue = ? AND date < ?
          AND home_score IS NOT NULL
      ),
      overall_stats AS (
        SELECT 
          AVG(CASE WHEN home_score > away_score THEN 1.0 ELSE 0.0 END) as overall_home_win_rate,
          AVG(home_score + away_score) as overall_runs_per_game
        FROM games 
        WHERE date < ? AND home_score IS NOT NULL
      )
      SELECT 
        AVG(CAST(v.home_win as FLOAT)) - o.overall_home_win_rate as home_advantage,
        AVG(v.total_runs) / o.overall_runs_per_game as scoring_factor
      FROM venue_games v, overall_stats o
    `).get(venue, beforeDate, beforeDate);

    return {
      home_advantage: result?.home_advantage ?? 0.0,
      scoring_factor: result?.scoring_factor ?? 1.0
    };
  }

  /**
   * 対戦成績の取得
   */
  private getHeadToHeadStats(homeTeam: string, awayTeam: string, beforeDate: string): { home_wins: number; total_games: number } {
    const result = this.db.prepare(`
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN home_score > away_score THEN 1 ELSE 0 END) as home_wins
      FROM games 
      WHERE home_team = ? AND away_team = ?
        AND date < ? 
        AND date >= date(?, '-1 year')
        AND home_score IS NOT NULL
    `).get(homeTeam, awayTeam, beforeDate, beforeDate);

    return {
      home_wins: result?.home_wins ?? 0,
      total_games: result?.total_games ?? 0
    };
  }

  /**
   * 直近試合数の取得
   */
  private getRecentGamesCount(homeTeam: string, awayTeam: string, beforeDate: string, days: number): { home_games: number; away_games: number } {
    const homeResult = this.db.prepare(`
      SELECT COUNT(*) as games
      FROM games 
      WHERE (home_team = ? OR away_team = ?)
        AND date < ? 
        AND date >= date(?, '-${days} days')
    `).get(homeTeam, homeTeam, beforeDate, beforeDate);

    const awayResult = this.db.prepare(`
      SELECT COUNT(*) as games
      FROM games 
      WHERE (home_team = ? OR away_team = ?)
        AND date < ? 
        AND date >= date(?, '-${days} days')
    `).get(awayTeam, awayTeam, beforeDate, beforeDate);

    return {
      home_games: homeResult?.games ?? 0,
      away_games: awayResult?.games ?? 0
    };
  }

  /**
   * 特徴量統計の計算
   */
  private calculateFeatureStats(features: PregameFeatures[]): any {
    if (features.length === 0) return {};

    const numericFeatures = [
      'home_win_rate_30', 'away_win_rate_30', 'home_runs_scored_avg_30',
      'home_pitcher_era', 'away_pitcher_era', 'venue_home_advantage'
    ];

    const stats: any = {};
    
    for (const feature of numericFeatures) {
      const values = features.map(f => (f as any)[feature]).filter(v => v != null);
      if (values.length > 0) {
        stats[feature] = {
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          std: Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - stats[feature]?.mean || 0, 2), 0) / values.length)
        };
      }
    }

    return {
      total_samples: features.length,
      positive_rate: features.filter(f => f.home_win === 1).length / features.length,
      feature_stats: stats
    };
  }

  /**
   * データセットの保存
   */
  private async saveDataset(features: PregameFeatures[], fileName: string): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0];
    const outputPath = path.join(this.outputDir, `${fileName}_${timestamp}.json`);
    
    // JSON形式で保存（後でParquet変換）
    await fs.writeFile(outputPath, JSON.stringify(features, null, 0));
    
    // CSV形式も出力（Python MLライブラリ互換性のため）
    const csvPath = outputPath.replace('.json', '.csv');
    await this.saveAsCSV(features, csvPath);
    
    logger.info('Dataset saved', {
      jsonPath: outputPath,
      csvPath,
      samples: features.length
    });

    return outputPath;
  }

  /**
   * CSV形式での保存
   */
  private async saveAsCSV(features: PregameFeatures[], filePath: string): Promise<void> {
    if (features.length === 0) return;

    const headers = Object.keys(features[0]);
    const csvContent = [
      headers.join(','),
      ...features.map(feature => 
        headers.map(header => (feature as any)[header]).join(',')
      )
    ].join('\n');

    await fs.writeFile(filePath, csvContent);
  }

  // ユーティリティメソッド

  private parseTime(timeString: string): number {
    if (!timeString) return 15; // デフォルト15時
    const [hours] = timeString.split(':').map(Number);
    return hours;
  }

  private isInterleague(homeTeam: string, awayTeam: string): boolean {
    const clTeams = ['G', 'T', 'DB', 'S', 'C', 'D'];
    const plTeams = ['H', 'F', 'L', 'Bs', 'M', 'E'];
    
    const homeLeague = clTeams.includes(homeTeam) ? 'CL' : 'PL';
    const awayLeague = clTeams.includes(awayTeam) ? 'CL' : 'PL';
    
    return homeLeague !== awayLeague;
  }

  /**
   * リソースのクリーンアップ
   */
  close(): void {
    this.db.close();
  }
}

// CLI実行用エントリーポイント
if (require.main === module) {
  const builder = new PregameDatasetBuilder();
  
  const startDate = process.argv[2] || '2020-01-01';
  const endDate = process.argv[3] || new Date().toISOString().split('T')[0];
  
  builder.buildDataset(startDate, endDate)
    .then(outputPath => {
      console.log(`✅ Dataset built successfully: ${outputPath}`);
      builder.close();
    })
    .catch(error => {
      console.error('❌ Dataset building failed:', error);
      builder.close();
      process.exit(1);
    });
}

export { PregameDatasetBuilder, PregameFeatures };