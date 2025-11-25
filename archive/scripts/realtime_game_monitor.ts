#!/usr/bin/env npx tsx

/**
 * リアルタイム試合監視システム
 * - 継続的な試合状況更新
 * - ライブスコア監視
 * - 重要な試合展開の検出と通知
 * - 既存データベースとの統合
 */

import fs from 'fs/promises';
import path from 'path';
import { ComprehensiveGameScraper, ComprehensiveGameData } from './comprehensive_game_detail_scraper';

interface LiveGameState {
  game_id: string;
  last_updated: Date;
  monitoring_active: boolean;
  update_count: number;
  significant_changes: SignificantChange[];
  current_state: GameSnapshot;
  previous_state?: GameSnapshot;
}

interface GameSnapshot {
  home_score: number;
  away_score: number;
  inning: number;
  half: 'top' | 'bottom';
  outs: number;
  runners: string[];
  last_play: string;
  win_probability?: number;
}

interface SignificantChange {
  timestamp: Date;
  change_type: 'score' | 'inning' | 'big_play' | 'momentum_shift';
  description: string;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  before_state: Partial<GameSnapshot>;
  after_state: Partial<GameSnapshot>;
}

class RealtimeGameMonitor {
  private scraper: ComprehensiveGameScraper;
  private activeGames: Map<string, LiveGameState> = new Map();
  private monitoringInterval: number = 30000; // 30秒間隔
  private isMonitoring: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.scraper = new ComprehensiveGameScraper();
  }

  /**
   * リアルタイム監視を開始
   */
  async startRealtimeMonitoring(gameIds?: string[]): Promise<void> {
    console.log('🚀 リアルタイム試合監視開始');

    if (this.isMonitoring) {
      console.log('⚠️  既に監視中です');
      return;
    }

    try {
      // 監視対象試合の初期化
      await this.initializeActiveGames(gameIds);

      if (this.activeGames.size === 0) {
        console.log('📭 監視対象の試合がありません');
        return;
      }

      console.log(`📺 監視対象: ${this.activeGames.size}試合`);
      this.displayActiveGames();

      // 定期監視の開始
      this.isMonitoring = true;
      this.startPeriodicUpdates();

      console.log(`⏰ ${this.monitoringInterval/1000}秒間隔で監視中...`);

      // 継続的な監視を実行
      await this.runContinuousMonitoring();

    } catch (error) {
      console.error('❌ リアルタイム監視開始エラー:', error);
      await this.stopMonitoring();
      throw error;
    }
  }

  /**
   * 監視対象試合の初期化
   */
  private async initializeActiveGames(gameIds?: string[]): Promise<void> {
    console.log('🔍 本日の試合を検索中...');

    // 本日の全試合を取得
    const todaysGames = await this.getTodaysLiveGames();
    
    // フィルタリング（指定がある場合）
    const targetGames = gameIds 
      ? todaysGames.filter(game => gameIds.includes(game.gameId))
      : todaysGames;

    // ライブまたは開始予定の試合のみを監視対象とする
    const liveGames = targetGames.filter(game => 
      game.status === 'live' || 
      game.status === 'scheduled' ||
      this.isGameStartingSoon(game)
    );

    console.log(`🎯 監視対象選定: ${liveGames.length}/${todaysGames.length}試合`);

    // 各試合の監視状態を初期化
    for (const game of liveGames) {
      const initialSnapshot = this.createGameSnapshot(game);
      
      const liveState: LiveGameState = {
        game_id: game.gameId,
        last_updated: new Date(),
        monitoring_active: true,
        update_count: 0,
        significant_changes: [],
        current_state: initialSnapshot
      };

      this.activeGames.set(game.gameId, liveState);
      console.log(`  📋 ${game.awayTeam} vs ${game.homeTeam} - 監視開始`);
    }
  }

  /**
   * 定期的な更新処理を開始
   */
  private startPeriodicUpdates(): void {
    this.intervalId = setInterval(async () => {
      try {
        await this.updateAllActiveGames();
      } catch (error) {
        console.error('定期更新エラー:', error);
      }
    }, this.monitoringInterval);
  }

  /**
   * 全監視対象試合の状態更新
   */
  private async updateAllActiveGames(): Promise<void> {
    const updatePromises = Array.from(this.activeGames.keys()).map(gameId =>
      this.updateSingleGame(gameId)
    );

    await Promise.all(updatePromises);

    // 監視終了判定
    await this.checkMonitoringCompletion();
  }

  /**
   * 単一試合の状態更新
   */
  private async updateSingleGame(gameId: string): Promise<void> {
    const liveState = this.activeGames.get(gameId);
    if (!liveState || !liveState.monitoring_active) return;

    try {
      // 最新の試合データを取得
      const updatedGame = await this.fetchUpdatedGameData(gameId);
      const newSnapshot = this.createGameSnapshot(updatedGame);

      // 変更点の検出
      const changes = this.detectSignificantChanges(
        liveState.current_state, 
        newSnapshot,
        gameId
      );

      // 状態を更新
      liveState.previous_state = { ...liveState.current_state };
      liveState.current_state = newSnapshot;
      liveState.last_updated = new Date();
      liveState.update_count++;
      liveState.significant_changes.push(...changes);

      // 重要な変更がある場合は通知
      if (changes.length > 0) {
        await this.notifySignificantChanges(gameId, changes);
      }

      // 試合終了チェック
      if (updatedGame.status === 'final') {
        liveState.monitoring_active = false;
        console.log(`🏁 試合終了: ${updatedGame.awayTeam} vs ${updatedGame.homeTeam}`);
        await this.finalizeGameMonitoring(gameId);
      }

    } catch (error) {
      console.error(`試合更新エラー (${gameId}):`, error);
      // エラーが続く場合は監視を停止
      liveState.update_count++;
      if (liveState.update_count > 10) {
        liveState.monitoring_active = false;
        console.log(`⚠️  試合監視停止: ${gameId} (エラー多発)`);
      }
    }
  }

  /**
   * 重要な変更点の検出
   */
  private detectSignificantChanges(
    oldState: GameSnapshot, 
    newState: GameSnapshot, 
    gameId: string
  ): SignificantChange[] {
    const changes: SignificantChange[] = [];
    const now = new Date();

    // 得点変化
    if (oldState.home_score !== newState.home_score || oldState.away_score !== newState.away_score) {
      changes.push({
        timestamp: now,
        change_type: 'score',
        description: `得点変化: ${oldState.away_score}-${oldState.home_score} → ${newState.away_score}-${newState.home_score}`,
        impact_level: 'high',
        before_state: { home_score: oldState.home_score, away_score: oldState.away_score },
        after_state: { home_score: newState.home_score, away_score: newState.away_score }
      });
    }

    // イニング変化
    if (oldState.inning !== newState.inning || oldState.half !== newState.half) {
      changes.push({
        timestamp: now,
        change_type: 'inning',
        description: `${newState.inning}回${newState.half === 'top' ? '表' : '裏'}開始`,
        impact_level: 'medium',
        before_state: { inning: oldState.inning, half: oldState.half },
        after_state: { inning: newState.inning, half: newState.half }
      });
    }

    // 大きなプレイの検出
    if (newState.last_play && newState.last_play !== oldState.last_play) {
      const impactLevel = this.assessPlayImpact(newState.last_play);
      if (impactLevel !== 'low') {
        changes.push({
          timestamp: now,
          change_type: 'big_play',
          description: `注目プレイ: ${newState.last_play}`,
          impact_level: impactLevel,
          before_state: { last_play: oldState.last_play },
          after_state: { last_play: newState.last_play }
        });
      }
    }

    // 勝利確率の大幅変化
    if (oldState.win_probability && newState.win_probability) {
      const probabilityChange = Math.abs(newState.win_probability - oldState.win_probability);
      if (probabilityChange > 0.15) { // 15%以上の変化
        changes.push({
          timestamp: now,
          change_type: 'momentum_shift',
          description: `勝利確率変化: ${(oldState.win_probability * 100).toFixed(1)}% → ${(newState.win_probability * 100).toFixed(1)}%`,
          impact_level: 'high',
          before_state: { win_probability: oldState.win_probability },
          after_state: { win_probability: newState.win_probability }
        });
      }
    }

    return changes;
  }

  /**
   * 重要な変更の通知
   */
  private async notifySignificantChanges(gameId: string, changes: SignificantChange[]): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    console.log(`\n🔔 ${gameId} 重要な変更検出:`);
    for (const change of changes) {
      const icon = this.getChangeIcon(change.change_type, change.impact_level);
      console.log(`  ${icon} ${change.description}`);
    }

    // 高影響度の変更は即座にファイル保存
    const highImpactChanges = changes.filter(c => c.impact_level === 'high' || c.impact_level === 'critical');
    if (highImpactChanges.length > 0) {
      await this.saveGameStateSnapshot(gameId);
    }
  }

  /**
   * 試合監視の完了処理
   */
  private async finalizeGameMonitoring(gameId: string): Promise<void> {
    const liveState = this.activeGames.get(gameId);
    if (!liveState) return;

    // 最終監視レポートの生成
    const finalReport = {
      game_id: gameId,
      monitoring_duration: new Date().getTime() - liveState.last_updated.getTime(),
      total_updates: liveState.update_count,
      significant_changes: liveState.significant_changes.length,
      final_state: liveState.current_state,
      changes_summary: this.summarizeChanges(liveState.significant_changes)
    };

    // レポート保存
    const outputDir = './data/realtime_monitoring';
    await fs.mkdir(outputDir, { recursive: true });
    
    const reportFile = path.join(outputDir, `final_report_${gameId}_${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(reportFile, JSON.stringify(finalReport, null, 2), 'utf-8');

    console.log(`📊 最終レポート保存: ${reportFile}`);
  }

  /**
   * 継続的な監視メインループ
   */
  private async runContinuousMonitoring(): Promise<void> {
    console.log('🔄 継続監視モード開始 (Ctrl+Cで終了)');
    
    // 終了シグナルのハンドリング
    process.on('SIGINT', async () => {
      console.log('\n🛑 監視終了要求を受信');
      await this.stopMonitoring();
      process.exit(0);
    });

    // 監視が継続中は待機
    while (this.isMonitoring && this.hasActiveGames()) {
      await this.delay(5000); // 5秒間隔でチェック
    }

    console.log('📋 全試合の監視が完了しました');
    await this.stopMonitoring();
  }

  /**
   * 監視終了
   */
  private async stopMonitoring(): Promise<void> {
    console.log('🛑 リアルタイム監視終了中...');
    
    this.isMonitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // 監視中の試合の最終データを保存
    for (const gameId of this.activeGames.keys()) {
      await this.saveGameStateSnapshot(gameId);
    }

    // 全体サマリーの生成
    await this.generateMonitoringSummary();

    console.log('✅ リアルタイム監視終了完了');
  }

  // ヘルパーメソッド
  private async getTodaysLiveGames(): Promise<ComprehensiveGameData[]> {
    // 実装: 本日のライブ試合を取得
    return [];
  }

  private isGameStartingSoon(game: any): boolean {
    // 実装: 試合開始時刻チェック
    return false;
  }

  private createGameSnapshot(game: any): GameSnapshot {
    return {
      home_score: game.homeScore || 0,
      away_score: game.awayScore || 0,
      inning: game.current_inning || 1,
      half: game.current_half || 'top',
      outs: game.outs || 0,
      runners: game.runners || [],
      last_play: game.last_play || '',
      win_probability: game.win_probability || 0.5
    };
  }

  private async fetchUpdatedGameData(gameId: string): Promise<any> {
    // 実装: 最新の試合データを取得
    return {};
  }

  private assessPlayImpact(play: string): 'low' | 'medium' | 'high' | 'critical' {
    if (play.includes('ホームラン') || play.includes('本塁打')) return 'critical';
    if (play.includes('タイムリー') || play.includes('得点')) return 'high';
    if (play.includes('エラー') || play.includes('盗塁')) return 'medium';
    return 'low';
  }

  private getChangeIcon(type: string, impact: string): string {
    const icons = {
      'score': impact === 'critical' ? '🔥' : '⚾',
      'inning': '📊',
      'big_play': '✨',
      'momentum_shift': '🔄'
    };
    return icons[type as keyof typeof icons] || '📋';
  }

  private async saveGameStateSnapshot(gameId: string): Promise<void> {
    const state = this.activeGames.get(gameId);
    if (!state) return;

    const outputDir = './data/realtime_monitoring/snapshots';
    await fs.mkdir(outputDir, { recursive: true });

    const snapshotFile = path.join(outputDir, `${gameId}_${Date.now()}.json`);
    await fs.writeFile(snapshotFile, JSON.stringify(state, null, 2), 'utf-8');
  }

  private summarizeChanges(changes: SignificantChange[]): any {
    return {
      total: changes.length,
      by_type: changes.reduce((acc, change) => {
        acc[change.change_type] = (acc[change.change_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      by_impact: changes.reduce((acc, change) => {
        acc[change.impact_level] = (acc[change.impact_level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  private async checkMonitoringCompletion(): Promise<void> {
    const activeCount = Array.from(this.activeGames.values())
      .filter(game => game.monitoring_active).length;
    
    if (activeCount === 0) {
      console.log('📋 全試合終了 - 監視完了');
      this.isMonitoring = false;
    }
  }

  private hasActiveGames(): boolean {
    return Array.from(this.activeGames.values())
      .some(game => game.monitoring_active);
  }

  private displayActiveGames(): void {
    console.log('\n📺 監視対象試合一覧:');
    for (const [gameId, state] of this.activeGames) {
      console.log(`  🏟️  ${gameId} - 更新数: ${state.update_count}`);
    }
  }

  private async generateMonitoringSummary(): Promise<void> {
    const summary = {
      session_end: new Date().toISOString(),
      total_games_monitored: this.activeGames.size,
      total_updates: Array.from(this.activeGames.values())
        .reduce((sum, game) => sum + game.update_count, 0),
      total_significant_changes: Array.from(this.activeGames.values())
        .reduce((sum, game) => sum + game.significant_changes.length, 0)
    };

    const outputDir = './data/realtime_monitoring';
    await fs.mkdir(outputDir, { recursive: true });
    
    const summaryFile = path.join(outputDir, `monitoring_summary_${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');

    console.log(`📊 監視サマリー: ${summaryFile}`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * メイン実行
 */
async function main() {
  try {
    const monitor = new RealtimeGameMonitor();
    
    const gameIds = process.argv.slice(2);
    console.log('🚀 NPBリアルタイム試合監視システム開始');
    
    await monitor.startRealtimeMonitoring(gameIds.length > 0 ? gameIds : undefined);
    
  } catch (error) {
    console.error('❌ リアルタイム監視エラー:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { RealtimeGameMonitor, LiveGameState, SignificantChange };