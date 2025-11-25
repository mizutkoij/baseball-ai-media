/**
 * NPB Baseball AI - Live Diff Watcher
 * 
 * 機能:
 * - details データの差分監視
 * - ファイルシステム変更検知
 * - LiveStateStore への自動更新配信
 * - 既存 canonical-writer との連携
 */

import { logger } from './logger';
// import { incrementCounter, recordHistogram } from './prometheus-metrics';

// Mock functions for metrics (replace with actual implementation)
const incrementCounter = (metric: string, labels?: any) => {};
const recordHistogram = (metric: string, value: number, labels?: any) => {};
import { getLiveStateStore, GameStateEvent } from './live-state';
import * as fs from 'fs/promises';
import * as path from 'path';
import chokidar from 'chokidar';

export interface DiffWatcherConfig {
  dataDir: string;
  watchPatterns: string[];
  debounceMs: number;
  maxRetries: number;
}

export interface DetailsDiff {
  added: any[];
  modified: any[];
  removed: string[]; // gameIds
  timestamp: string;
}

export class LiveDiffWatcher {
  private config: DiffWatcherConfig;
  private liveStateStore = getLiveStateStore();
  private watcher: any | null = null;
  private lastProcessedHashes = new Map<string, string>();
  private processing = false;
  
  constructor(config: Partial<DiffWatcherConfig> = {}) {
    this.config = {
      dataDir: config.dataDir || './data',
      watchPatterns: config.watchPatterns || [
        'details/date=*/latest.json',
        'games/date=*/latest.json'
      ],
      debounceMs: config.debounceMs || 1000,
      maxRetries: config.maxRetries || 3,
      ...config
    };

    this.setupEventHandlers();
  }

  /**
   * 差分監視開始
   */
  async startWatching(): Promise<void> {
    if (this.watcher) {
      logger.warn('Diff watcher already running');
      return;
    }

    logger.info('Starting live diff watcher', {
      dataDir: this.config.dataDir,
      watchPatterns: this.config.watchPatterns,
      debounceMs: this.config.debounceMs
    });

    try {
      // 初回の現状読み込み
      await this.performInitialScan();

      // ファイル監視開始
      const watchPaths = this.config.watchPatterns.map(pattern => 
        path.join(this.config.dataDir, pattern)
      );

      this.watcher = chokidar.watch(watchPaths, {
        ignoreInitial: true,
        persistent: true,
        usePolling: false,
        interval: 1000,
        depth: 10
      });

      // イベントハンドラー設定
      this.watcher
        .on('change', this.handleFileChange.bind(this))
        .on('add', this.handleFileChange.bind(this))
        .on('error', this.handleWatchError.bind(this));

      logger.info('Live diff watcher started successfully');

      incrementCounter('live_diff_watcher_starts_total', {
        result: 'success'
      });

    } catch (error) {
      logger.error('Failed to start diff watcher', {
        error: error instanceof Error ? error.message : String(error)
      });

      incrementCounter('live_diff_watcher_starts_total', {
        result: 'error'
      });

      throw error;
    }
  }

  /**
   * 差分監視停止
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      logger.info('Live diff watcher stopped');
    }
  }

  /**
   * 手動での差分チェック実行
   */
  async checkForUpdates(): Promise<DetailsDiff> {
    logger.debug('Manual diff check requested');
    
    const startTime = Date.now();
    const diff = await this.detectDetailsDiff();
    const duration = Date.now() - startTime;

    recordHistogram('live_diff_check_duration_seconds', duration / 1000, {
      trigger: 'manual'
    });

    if (diff.added.length > 0 || diff.modified.length > 0 || diff.removed.length > 0) {
      await this.processDiff(diff);
    }

    return diff;
  }

  // プライベートメソッド

  private setupEventHandlers(): void {
    this.liveStateStore.onStateChange(this.handleStateChangeEvent.bind(this));
  }

  private async performInitialScan(): Promise<void> {
    logger.info('Performing initial scan for existing games');

    try {
      const today = new Date().toISOString().split('T')[0];
      const diff = await this.detectDetailsDiff(today);
      
      if (diff.added.length > 0 || diff.modified.length > 0) {
        await this.processDiff(diff);
        logger.info('Initial scan completed', {
          gamesFound: diff.added.length + diff.modified.length
        });
      }
    } catch (error) {
      logger.warn('Initial scan failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleFileChange(filePath: string): Promise<void> {
    if (this.processing) {
      logger.debug('Skipping file change during processing', { filePath });
      return;
    }

    logger.debug('File change detected', { filePath });

    // デバウンス処理
    setTimeout(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        logger.error('Failed to process file change', {
          filePath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, this.config.debounceMs);
  }

  private handleWatchError(error: Error): void {
    logger.error('File watcher error', {
      error: error.message
    });

    incrementCounter('live_diff_watcher_errors_total', {
      error_type: 'watch_error'
    });
  }

  private async detectDetailsDiff(targetDate?: string): Promise<DetailsDiff> {
    const date = targetDate || new Date().toISOString().split('T')[0];
    const diff: DetailsDiff = {
      added: [],
      modified: [],
      removed: [],
      timestamp: new Date().toISOString()
    };

    try {
      // details の最新データを読み込み
      const detailsPath = path.join(this.config.dataDir, 'details', `date=${date}`, 'latest.json');
      
      if (await this.fileExists(detailsPath)) {
        const detailsContent = await fs.readFile(detailsPath, 'utf-8');
        const currentHash = this.calculateHash(detailsContent);
        const lastHash = this.lastProcessedHashes.get(detailsPath);

        if (currentHash !== lastHash) {
          const details = JSON.parse(detailsContent);
          
          if (Array.isArray(details)) {
            for (const detail of details) {
              if (this.isActiveGame(detail)) {
                diff.modified.push(detail);
              }
            }
          }

          this.lastProcessedHashes.set(detailsPath, currentHash);
        }
      }

      // games データも同様にチェック
      const gamesPath = path.join(this.config.dataDir, 'games', `date=${date}`, 'latest.json');
      
      if (await this.fileExists(gamesPath)) {
        const gamesContent = await fs.readFile(gamesPath, 'utf-8');
        const currentHash = this.calculateHash(gamesContent);
        const lastHash = this.lastProcessedHashes.get(gamesPath);

        if (currentHash !== lastHash) {
          const games = JSON.parse(gamesContent);
          
          if (Array.isArray(games)) {
            for (const game of games) {
              if (this.isActiveGame(game)) {
                // games テーブルからは基本情報のみ
                diff.added.push({
                  game_id: game.game_id,
                  date: game.date,
                  home_team: game.home_team,
                  away_team: game.away_team,
                  home_score: game.home_score,
                  away_score: game.away_score,
                  inning: game.inning,
                  status: game.status
                });
              }
            }
          }

          this.lastProcessedHashes.set(gamesPath, currentHash);
        }
      }

    } catch (error) {
      logger.error('Failed to detect details diff', {
        date,
        error: error instanceof Error ? error.message : String(error)
      });

      incrementCounter('live_diff_detection_errors_total', {
        date
      });
    }

    return diff;
  }

  private async processDiff(diff: DetailsDiff): Promise<void> {
    if (this.processing) {
      logger.debug('Already processing diff, skipping');
      return;
    }

    this.processing = true;
    const startTime = Date.now();

    try {
      logger.info('Processing details diff', {
        added: diff.added.length,
        modified: diff.modified.length,
        removed: diff.removed.length
      });

      // 追加・更新されたゲームを処理
      const allUpdates = [...diff.added, ...diff.modified];
      const events = this.liveStateStore.processDiffUpdate(allUpdates);

      // 削除されたゲームをクリーンアップ
      if (diff.removed.length > 0) {
        this.liveStateStore.cleanupCompletedGames(diff.removed);
      }

      const duration = Date.now() - startTime;

      recordHistogram('live_diff_processing_duration_seconds', duration / 1000, {
        updates_count: allUpdates.length.toString()
      });

      incrementCounter('live_diff_processed_total', {
        result: 'success',
        updates: allUpdates.length.toString()
      });

      logger.info('Diff processing completed', {
        eventsGenerated: events.length,
        processingTime: duration
      });

    } catch (error) {
      logger.error('Failed to process diff', {
        error: error instanceof Error ? error.message : String(error)
      });

      incrementCounter('live_diff_processed_total', {
        result: 'error',
        updates: '0'
      });

      throw error;
    } finally {
      this.processing = false;
    }
  }

  private handleStateChangeEvent(event: GameStateEvent): void {
    logger.debug('State change event handled', {
      gameId: event.gameId,
      eventType: event.type,
      newState: {
        inning: `${event.newState.inning}${event.newState.top ? '表' : '裏'}`,
        score: `${event.newState.awayScore}-${event.newState.homeScore}`,
        outs: event.newState.outs
      }
    });

    incrementCounter('live_state_events_handled_total', {
      game_id: event.gameId,
      event_type: event.type
    });
  }

  private isActiveGame(gameData: any): boolean {
    // 進行中または終了直後の試合かを判定
    const status = gameData.status?.toLowerCase();
    
    if (status === 'playing' || status === 'live' || status === 'in_progress') {
      return true;
    }

    if (status === 'final' || status === 'completed') {
      // 終了から1時間以内は追跡継続（遅延更新対応）
      const endTime = new Date(gameData.end_time || gameData.updated_at);
      const now = new Date();
      const hoursSinceEnd = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60);
      return hoursSinceEnd <= 1;
    }

    // スコアが入っている試合は進行中とみなす
    return (gameData.home_score > 0 || gameData.away_score > 0) && !status?.includes('postponed');
  }

  private calculateHash(content: string): string {
    // 簡易ハッシュ関数 (本格運用時は crypto.createHash を使用)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash.toString();
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 監視状態の取得
   */
  getWatcherStatus(): any {
    return {
      isWatching: this.watcher !== null,
      processing: this.processing,
      watchedPaths: this.config.watchPatterns,
      trackedFiles: this.lastProcessedHashes.size,
      liveGamesCount: this.liveStateStore.getAllStates().length
    };
  }
}

// シングルトンインスタンス
let _liveDiffWatcher: LiveDiffWatcher | null = null;

export function getLiveDiffWatcher(config?: Partial<DiffWatcherConfig>): LiveDiffWatcher {
  if (!_liveDiffWatcher) {
    _liveDiffWatcher = new LiveDiffWatcher(config);
  }
  return _liveDiffWatcher;
}