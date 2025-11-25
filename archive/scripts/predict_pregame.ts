/**
 * NPB Baseball AI - Pregame Prediction Runner
 * 
 * 機能:
 * - 試合開始60分前のプリゲーム勝率予測実行
 * - 既存スケジューラーとの統合
 * - 予測結果の保存（canonical形式）
 * - メトリクス記録
 * - 異常値検知・校正
 */

import { logger } from '../lib/logger';
import { incrementCounter, recordHistogram } from '../lib/prometheus-metrics';
import { getPregamePredictor, PredictionResult, PregameFeatures } from '../lib/predictor';
import { PregameDatasetBuilder } from '../features/build_pregame_dataset';
import { writeCanonicalSet } from '../lib/canonical-writer';
import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';

interface GameWithFeatures {
  game_id: string;
  date: string;
  start_time: string;
  home_team: string;
  away_team: string;
  venue: string;
  features: PregameFeatures;
  minutes_until_start: number;
}

interface PredictionOutput {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  venue: string;
  start_time: string;
  home_win_probability: number;
  prediction_confidence: string;
  model_version: string;
  predicted_at: string;
  features_used: number;
  calibrated: boolean;
  minutes_before_start: number;
  prediction_type: 'pregame';
  // 詳細分析用（オプション）
  feature_summary?: {
    home_team_strength: number; // 最近のパフォーマンス指標
    away_team_strength: number;
    pitcher_matchup_advantage: number; // -1 to 1
    venue_advantage: number;
    recent_form_factor: number;
  };
}

export class PregamePredictionRunner {
  private db: Database.Database;
  private predictor = getPregamePredictor();
  private dataDir: string;

  constructor(dbPath: string = './data/baseball.db', dataDir: string = './data') {
    this.db = new Database(dbPath);
    this.dataDir = dataDir;
  }

  /**
   * 今日の予測対象試合を取得
   */
  private getTodaysGames(targetDate?: string): GameWithFeatures[] {
    const date = targetDate || new Date().toISOString().split('T')[0];
    
    const games = this.db.prepare(`
      SELECT 
        g.game_id,
        g.date,
        g.start_time,
        g.home_team,
        g.away_team,
        g.venue
      FROM games g
      WHERE g.date = ?
        AND g.home_score IS NULL  -- 未完了の試合のみ
      ORDER BY g.start_time
    `).all(date);

    logger.info('Found games for prediction', {
      date,
      gameCount: games.length,
      games: games.map(g => ({ 
        gameId: g.game_id, 
        matchup: `${g.away_team} @ ${g.home_team}`, 
        startTime: g.start_time 
      }))
    });

    return games.map(game => ({
      ...game,
      features: this.buildGameFeatures(game),
      minutes_until_start: this.calculateMinutesUntilStart(game.date, game.start_time)
    }));
  }

  /**
   * 個別試合の特徴量を構築
   */
  private buildGameFeatures(game: any): PregameFeatures {
    // 基本的な特徴量を取得（簡略版 - 実際は PregameDatasetBuilder と同じロジック）
    const homeTeamStats = this.getTeamRecentStats(game.home_team, game.date, 30);
    const awayTeamStats = this.getTeamRecentStats(game.away_team, game.date, 30);
    const homeTeamStats10 = this.getTeamRecentStats(game.home_team, game.date, 10);
    const awayTeamStats10 = this.getTeamRecentStats(game.away_team, game.date, 10);
    
    const homePitcher = this.getExpectedPitcher(game.home_team, game.date);
    const awayPitcher = this.getExpectedPitcher(game.away_team, game.date);
    
    const venueStats = this.getVenueStats(game.venue, game.date);
    const headToHead = this.getHeadToHeadStats(game.home_team, game.away_team, game.date);
    
    const gameDate = new Date(game.date);
    const recentGames = this.getRecentGamesCount(game.home_team, game.away_team, game.date);

    return {
      home_team: game.home_team,
      away_team: game.away_team,
      venue: game.venue,
      
      // チーム成績（30試合）
      home_win_rate_30: homeTeamStats.win_rate,
      away_win_rate_30: awayTeamStats.win_rate,
      home_runs_scored_avg_30: homeTeamStats.runs_scored_avg,
      away_runs_scored_avg_30: awayTeamStats.runs_scored_avg,
      home_runs_allowed_avg_30: homeTeamStats.runs_allowed_avg,
      away_runs_allowed_avg_30: awayTeamStats.runs_allowed_avg,
      home_run_differential_30: homeTeamStats.run_differential,
      away_run_differential_30: awayTeamStats.run_differential,
      
      // チーム成績（10試合）
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
      home_pitcher_era_5: this.getPitcherRecentERA(game.home_team, game.date, 5),
      away_pitcher_era_5: this.getPitcherRecentERA(game.away_team, game.date, 5),
      home_pitcher_days_rest: this.getPitcherDaysRest(game.home_team, game.date),
      away_pitcher_days_rest: this.getPitcherDaysRest(game.away_team, game.date),
      
      // 球場・対戦
      venue_home_advantage: venueStats.home_advantage,
      venue_scoring_factor: venueStats.scoring_factor,
      head_to_head_home_wins: headToHead.home_wins,
      head_to_head_total_games: headToHead.total_games,
      
      // 時系列
      season_game_number: this.getSeasonGameNumber(game.date),
      home_games_in_last_7_days: recentGames.home_games,
      away_games_in_last_7_days: recentGames.away_games,
      
      // カテゴリカル
      is_weekend: gameDate.getDay() === 0 || gameDate.getDay() === 6 ? 1 : 0,
      is_evening_game: this.parseStartTime(game.start_time) >= 18 ? 1 : 0,
      is_interleague: this.isInterleague(game.home_team, game.away_team) ? 1 : 0,
      month: gameDate.getMonth() + 1,
      day_of_week: gameDate.getDay() + 1
    };
  }

  /**
   * 試合開始までの分数を計算
   */
  private calculateMinutesUntilStart(date: string, startTime: string): number {
    const gameDateTime = new Date(`${date}T${startTime}:00+09:00`); // JST
    const now = new Date();
    return Math.round((gameDateTime.getTime() - now.getTime()) / (1000 * 60));
  }

  /**
   * プリゲーム予測の実行判定
   */
  private shouldPredict(game: GameWithFeatures): boolean {
    const minutesUntilStart = game.minutes_until_start;
    
    // 試合開始60分前±10分の範囲で実行
    if (minutesUntilStart >= 50 && minutesUntilStart <= 70) {
      return true;
    }
    
    // 既に予測済みかチェック
    const existingPrediction = this.checkExistingPrediction(game.game_id, game.date);
    if (existingPrediction) {
      logger.debug('Prediction already exists', {
        gameId: game.game_id,
        existingAt: existingPrediction
      });
      return false;
    }
    
    return false;
  }

  /**
   * 既存予測のチェック
   */
  private checkExistingPrediction(gameId: string, date: string): string | null {
    try {
      const predictionPath = path.join(this.dataDir, 'predictions', 'pregame', `date=${date}`, 'latest.json');
      const content = JSON.parse(require('fs').readFileSync(predictionPath, 'utf-8'));
      const existing = content.find((p: any) => p.game_id === gameId);
      return existing ? existing.predicted_at : null;
    } catch {
      return null;
    }
  }

  /**
   * プリゲーム予測の実行
   */
  async runPregamePredictions(targetDate?: string, force: boolean = false): Promise<PredictionOutput[]> {
    const correlationId = `pregame-${Date.now()}`;
    const date = targetDate || new Date().toISOString().split('T')[0];

    logger.info('Starting pregame predictions', {
      correlationId,
      date,
      force
    });

    const startTime = Date.now();

    try {
      // 今日の試合を取得
      const games = this.getTodaysGames(date);
      
      if (games.length === 0) {
        logger.info('No games found for prediction', { correlationId, date });
        return [];
      }

      // 予測対象の絞り込み
      const targetGames = force ? games : games.filter(game => this.shouldPredict(game));
      
      if (targetGames.length === 0) {
        logger.info('No games meet prediction timing criteria', {
          correlationId,
          totalGames: games.length,
          timingInfo: games.map(g => ({
            gameId: g.game_id,
            minutesUntilStart: g.minutes_until_start
          }))
        });
        return [];
      }

      logger.info('Running predictions for games', {
        correlationId,
        targetGames: targetGames.length,
        games: targetGames.map(g => ({
          gameId: g.game_id,
          matchup: `${g.away_team} @ ${g.home_team}`,
          minutesUntilStart: g.minutes_until_start
        }))
      });

      // 予測実行
      const predictions: PredictionOutput[] = [];
      
      for (const game of targetGames) {
        try {
          const prediction = await this.predictor.predict(game.features, game.game_id);
          
          const output: PredictionOutput = {
            game_id: game.game_id,
            date: game.date,
            home_team: game.home_team,
            away_team: game.away_team,
            venue: game.venue,
            start_time: game.start_time,
            home_win_probability: prediction.home_win_probability,
            prediction_confidence: prediction.prediction_confidence,
            model_version: prediction.model_version,
            predicted_at: prediction.predicted_at,
            features_used: prediction.features_used,
            calibrated: prediction.calibrated,
            minutes_before_start: game.minutes_until_start,
            prediction_type: 'pregame',
            feature_summary: {
              home_team_strength: (game.features.home_win_rate_10 + game.features.home_run_differential_30 / 5) / 2,
              away_team_strength: (game.features.away_win_rate_10 + game.features.away_run_differential_30 / 5) / 2,
              pitcher_matchup_advantage: (game.features.away_pitcher_era - game.features.home_pitcher_era) / 5,
              venue_advantage: game.features.venue_home_advantage,
              recent_form_factor: (game.features.home_win_rate_10 - game.features.away_win_rate_10)
            }
          };
          
          predictions.push(output);

          incrementCounter('pregame_predictions_total', {
            home_team: game.home_team,
            away_team: game.away_team,
            confidence: prediction.prediction_confidence
          });

          logger.info('Pregame prediction completed', {
            correlationId,
            gameId: game.game_id,
            matchup: `${game.away_team} @ ${game.home_team}`,
            probability: prediction.home_win_probability.toFixed(3),
            confidence: prediction.prediction_confidence
          });

        } catch (error) {
          logger.error('Pregame prediction failed for game', {
            correlationId,
            gameId: game.game_id,
            matchup: `${game.away_team} @ ${game.home_team}`,
            error: error instanceof Error ? error.message : String(error)
          });

          incrementCounter('pregame_prediction_errors_total', {
            home_team: game.home_team,
            away_team: game.away_team
          });
        }
      }

      // 予測結果の保存
      if (predictions.length > 0) {
        await this.savePredictions(predictions, date);
      }

      const duration = Date.now() - startTime;

      recordHistogram('pregame_predictions_duration_seconds', duration / 1000, {
        game_count: predictions.length.toString()
      });

      logger.info('Pregame predictions completed', {
        correlationId,
        totalGames: games.length,
        predictionsRun: predictions.length,
        averageProbability: predictions.length > 0 
          ? (predictions.reduce((sum, p) => sum + p.home_win_probability, 0) / predictions.length).toFixed(3)
          : 'N/A',
        duration
      });

      return predictions;

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Pregame predictions failed', {
        correlationId,
        date,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      incrementCounter('pregame_prediction_runs_total', { result: 'error' });
      throw error;
    }
  }

  /**
   * 予測結果の保存
   */
  private async savePredictions(predictions: PredictionOutput[], date: string): Promise<void> {
    try {
      const result = await writeCanonicalSet({
        baseDir: this.dataDir,
        kind: 'predictions',
        date,
        records: predictions,
        skipOnNoChange: true
      });

      logger.info('Predictions saved', {
        date,
        action: result.action,
        items: result.items,
        hash: result.hash?.slice(0, 8)
      });

      incrementCounter('pregame_predictions_saved_total', {
        action: result.action,
        count: result.items.toString()
      });

    } catch (error) {
      logger.error('Failed to save predictions', {
        date,
        predictionCount: predictions.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // データ取得メソッド群（簡略実装）

  private getTeamRecentStats(teamId: string, beforeDate: string, days: number): any {
    const result = this.db.prepare(`
      WITH team_games AS (
        SELECT 
          date,
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
        AVG(CAST(win as FLOAT)) as win_rate,
        AVG(runs_scored) as runs_scored_avg,
        AVG(runs_allowed) as runs_allowed_avg,
        AVG(runs_scored - runs_allowed) as run_differential
      FROM team_games
    `).get(teamId, teamId, teamId, teamId, teamId, teamId, beforeDate, days);

    return {
      win_rate: result?.win_rate ?? 0.5,
      runs_scored_avg: result?.runs_scored_avg ?? 4.0,
      runs_allowed_avg: result?.runs_allowed_avg ?? 4.0,
      run_differential: result?.run_differential ?? 0.0
    };
  }

  private getExpectedPitcher(teamId: string, gameDate: string): any {
    // 先発投手ローテーションから推定（簡略実装）
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
    `).get(teamId, gameDate);

    return result ? {
      era: result.era ?? 4.0,
      whip: result.whip ?? 1.3,
      wins: result.wins ?? 0,
      losses: result.losses ?? 0,
      games_started: result.games_started ?? 0,
      innings_pitched: result.innings_pitched ?? 0
    } : null;
  }

  private getVenueStats(venue: string, beforeDate: string): any {
    // 簡略実装
    return {
      home_advantage: 0.05,
      scoring_factor: 1.0
    };
  }

  private getHeadToHeadStats(homeTeam: string, awayTeam: string, beforeDate: string): any {
    // 簡略実装
    return {
      home_wins: 0,
      total_games: 0
    };
  }

  private getRecentGamesCount(homeTeam: string, awayTeam: string, beforeDate: string): any {
    // 簡略実装
    return {
      home_games: 3,
      away_games: 4
    };
  }

  private getPitcherRecentERA(teamId: string, beforeDate: string, games: number): number {
    return 4.0; // 簡略実装
  }

  private getPitcherDaysRest(teamId: string, beforeDate: string): number {
    return 5; // 簡略実装
  }

  private getSeasonGameNumber(date: string): number {
    const startOfSeason = new Date(date.substring(0, 4) + '-03-01');
    const gameDate = new Date(date);
    const daysSinceStart = Math.floor((gameDate.getTime() - startOfSeason.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(daysSinceStart / 3)); // 概算
  }

  private parseStartTime(timeString: string): number {
    if (!timeString) return 15;
    const [hours] = timeString.split(':').map(Number);
    return hours;
  }

  private isInterleague(homeTeam: string, awayTeam: string): boolean {
    const clTeams = ['G', 'T', 'DB', 'S', 'C', 'D'];
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
  const runner = new PregamePredictionRunner();
  
  const command = process.argv[2] || 'run';
  const targetDate = process.argv[3];
  const force = process.argv.includes('--force');

  async function main() {
    try {
      switch (command) {
        case 'run':
          const predictions = await runner.runPregamePredictions(targetDate, force);
          console.log(`✅ Completed ${predictions.length} pregame predictions`);
          predictions.forEach(p => {
            console.log(`   ${p.away_team} @ ${p.home_team}: ${p.home_win_probability.toFixed(3)} (${p.prediction_confidence})`);
          });
          break;

        case 'health':
          const predictor = getPregamePredictor();
          const health = await predictor.healthCheck();
          console.log('🔍 Predictor Health:', health);
          break;

        case 'info':
          const info = getPregamePredictor();
          await info.initialize();
          const modelInfo = info.getModelInfo();
          console.log('📊 Model Info:', JSON.stringify(modelInfo, null, 2));
          break;

        default:
          console.error('Usage: npx tsx scripts/predict_pregame.ts <run|health|info> [date] [--force]');
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ Prediction failed:', error);
      process.exit(1);
    } finally {
      runner.close();
    }
  }

  main();
}

export { PregamePredictionRunner, PredictionOutput };