/**
 * NPB Baseball AI - Live Game State Management
 * 
 * 機能:
 * - 試合中の状況管理 (イニング、アウト、塁状況、スコア)
 * - details データからの差分検知・状態更新
 * - timeline.jsonl / latest.json 形式での保存
 * - 既存 canonical-writer との統合
 */

import { logger } from './logger';
// import { incrementCounter, recordHistogram } from './prometheus-metrics';

// Mock functions for metrics (replace with actual implementation)
const incrementCounter = (metric: string, labels?: any) => {};
const recordHistogram = (metric: string, value: number, labels?: any) => {};

export interface GameState {
  gameId: string;
  date: string;
  inning: number;
  top: boolean; // true=表, false=裏
  outs: 0 | 1 | 2;
  bases: number; // ビット表現: 1塁=1, 2塁=2, 3塁=4 (0-7)
  homeScore: number;
  awayScore: number;
  pitcher?: string;
  batter?: string;
  lastPlay?: string;
  timestamp: string;
  eventIndex: number; // 同一試合内でのイベント連番
}

export interface LivePrediction {
  gameId: string;
  timestamp: string;
  eventIndex: number;
  
  // ゲーム状況
  inning: number;
  top: boolean;
  outs: 0 | 1 | 2;
  bases: number;
  homeScore: number;
  awayScore: number;
  scoreDiff: number; // homeScore - awayScore
  
  // 予測結果
  home_win_probability: number;
  away_win_probability: number;
  prediction_confidence: 'high' | 'medium' | 'low';
  
  // 内部計算値
  pregame_weight: number; // プリゲーム予測の重み (1.0 → 0.0)
  state_weight: number;   // 状況予測の重み (0.0 → 1.0)  
  pregame_probability: number; // 元のプリゲーム予測
  state_probability: number;   // 現在状況予測
  
  // メタデータ
  model_version: string;
  prediction_type: 'live';
  processing_latency_ms: number;
}

export interface GameStateEvent {
  type: 'state_change' | 'inning_end' | 'game_end';
  gameId: string;
  oldState?: GameState;
  newState: GameState;
  timestamp: string;
}

export class LiveStateStore {
  private stateMap = new Map<string, GameState>();
  private eventHandlers: Array<(event: GameStateEvent) => void> = [];
  
  constructor() {
    logger.info('LiveStateStore initialized');
  }

  /**
   * 現在の試合状況を取得
   */
  getState(gameId: string): GameState | null {
    return this.stateMap.get(gameId) || null;
  }

  /**
   * 全ての進行中試合の状況を取得
   */
  getAllStates(): GameState[] {
    return Array.from(this.stateMap.values());
  }

  /**
   * 試合状況を更新 (冪等)
   */
  upsertState(newState: GameState): GameStateEvent | null {
    const oldState = this.stateMap.get(newState.gameId);
    
    // 同一eventIndexは重複処理しない (冪等性保証)
    if (oldState && oldState.eventIndex >= newState.eventIndex) {
      logger.debug('Skipping duplicate or older event', {
        gameId: newState.gameId,
        oldEventIndex: oldState.eventIndex,
        newEventIndex: newState.eventIndex
      });
      return null;
    }

    // 状態更新
    this.stateMap.set(newState.gameId, newState);

    // イベント生成
    const eventType = this.determineEventType(oldState, newState);
    const event: GameStateEvent = {
      type: eventType,
      gameId: newState.gameId,
      oldState,
      newState,
      timestamp: newState.timestamp
    };

    // イベントハンドラー呼び出し
    this.notifyEventHandlers(event);

    logger.debug('Game state updated', {
      gameId: newState.gameId,
      eventType,
      eventIndex: newState.eventIndex,
      inning: `${newState.inning}${newState.top ? '表' : '裏'}`,
      outs: newState.outs,
      bases: this.formatBases(newState.bases),
      score: `${newState.awayScore}-${newState.homeScore}`
    });

    incrementCounter('live_state_updates_total', {
      game_id: newState.gameId,
      event_type: eventType
    });

    return event;
  }

  /**
   * 試合状況を details データから構築
   */
  buildStateFromDetails(details: any): GameState {
    return {
      gameId: details.game_id,
      date: details.date,
      inning: details.inning || 1,
      top: details.top_bottom === 'top' || details.half === '表',
      outs: Math.min(2, Math.max(0, details.outs || 0)) as 0 | 1 | 2,
      bases: this.parseBases(details.bases || details.runners),
      homeScore: details.home_score || 0,
      awayScore: details.away_score || 0,
      pitcher: details.pitcher,
      batter: details.batter,
      lastPlay: details.last_play,
      timestamp: details.updated_at || new Date().toISOString(),
      eventIndex: details.event_index || this.generateEventIndex(details)
    };
  }

  /**
   * 差分検知による一括状態更新
   */
  processDiffUpdate(gameUpdates: any[]): GameStateEvent[] {
    const events: GameStateEvent[] = [];

    for (const update of gameUpdates) {
      try {
        const newState = this.buildStateFromDetails(update);
        const event = this.upsertState(newState);
        
        if (event) {
          events.push(event);
        }
      } catch (error) {
        logger.error('Failed to process game state update', {
          gameId: update.game_id,
          error: error instanceof Error ? error.message : String(error)
        });

        incrementCounter('live_state_errors_total', {
          game_id: update.game_id || 'unknown',
          error_type: 'parse_error'
        });
      }
    }

    if (events.length > 0) {
      logger.info('Processed game state diff update', {
        updatedGames: events.length,
        totalActiveGames: this.stateMap.size
      });
    }

    return events;
  }

  /**
   * イベントハンドラーの登録
   */
  onStateChange(handler: (event: GameStateEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  /**
   * 試合終了時のクリーンアップ
   */
  cleanupCompletedGames(completedGameIds: string[]): void {
    for (const gameId of completedGameIds) {
      if (this.stateMap.delete(gameId)) {
        logger.info('Cleaned up completed game state', { gameId });
      }
    }
  }

  // プライベートメソッド

  private determineEventType(oldState: GameState | undefined, newState: GameState): GameStateEvent['type'] {
    if (!oldState) {
      return 'state_change';
    }

    // 試合終了判定
    if (newState.inning >= 9 && !newState.top && newState.homeScore !== newState.awayScore) {
      return 'game_end';
    }
    if (newState.inning >= 9 && newState.homeScore > newState.awayScore && newState.top) {
      return 'game_end'; // サヨナラ
    }

    // イニング終了判定
    if (oldState.inning !== newState.inning || oldState.top !== newState.top) {
      return 'inning_end';
    }

    return 'state_change';
  }

  private parseBases(basesData: any): number {
    if (typeof basesData === 'number') {
      return Math.max(0, Math.min(7, basesData));
    }

    if (typeof basesData === 'string') {
      // "1,3" や "満塁" などの文字列解析
      let bases = 0;
      if (basesData.includes('1') || basesData.includes('一')) bases |= 1;
      if (basesData.includes('2') || basesData.includes('二')) bases |= 2;
      if (basesData.includes('3') || basesData.includes('三')) bases |= 4;
      if (basesData.includes('満') || basesData.includes('loaded')) bases = 7;
      return bases;
    }

    if (Array.isArray(basesData)) {
      // [1, 3] のような配列形式
      let bases = 0;
      for (const base of basesData) {
        if (base === 1) bases |= 1;
        if (base === 2) bases |= 2;
        if (base === 3) bases |= 4;
      }
      return bases;
    }

    return 0; // デフォルト: ランナーなし
  }

  private formatBases(bases: number): string {
    if (bases === 0) return '___';
    
    const positions = [];
    if (bases & 1) positions.push('1塁');
    if (bases & 2) positions.push('2塁'); 
    if (bases & 4) positions.push('3塁');
    
    if (positions.length === 3) return '満塁';
    return positions.join(',') || '___';
  }

  private generateEventIndex(details: any): number {
    // イニング、アウト、塁状況からユニークなインデックスを生成
    const inning = details.inning || 1;
    const top = details.top_bottom === 'top' || details.half === '表' ? 1 : 0;
    const outs = details.outs || 0;
    const bases = this.parseBases(details.bases || details.runners);
    
    // 簡易的な連番生成 (より精密にはタイムスタンプやプレイ番号を使用)
    return (inning * 1000) + (top * 100) + (outs * 10) + bases;
  }

  private notifyEventHandlers(event: GameStateEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Event handler failed', {
          gameId: event.gameId,
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * デバッグ情報の出力
   */
  getDebugInfo(): any {
    return {
      activeGames: this.stateMap.size,
      eventHandlers: this.eventHandlers.length,
      games: Array.from(this.stateMap.entries()).map(([gameId, state]) => ({
        gameId,
        inning: `${state.inning}${state.top ? '表' : '裏'}`,
        score: `${state.awayScore}-${state.homeScore}`,
        lastUpdate: state.timestamp,
        eventIndex: state.eventIndex
      }))
    };
  }
}

// シングルトンインスタンス
let _liveStateStore: LiveStateStore | null = null;

export function getLiveStateStore(): LiveStateStore {
  if (!_liveStateStore) {
    _liveStateStore = new LiveStateStore();
  }
  return _liveStateStore;
}