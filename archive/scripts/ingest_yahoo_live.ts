#!/usr/bin/env npx tsx
/**
 * Yahoo! ライブデータ取り込みスクリプト
 * NPB1 (1軍) + NPB2 (ファーム) 両対応
 * 優先度キュー + 動的間隔調整
 */

import { YahooNPB1Connector } from '../lib/connectors/yahoo-ichigun';
import { YahooNPB2Connector } from '../lib/connectors/yahoo-farm';
import { calculateDynamicInterval } from '../lib/connectors/polite-http-client';
import { promises as fs } from 'fs';
import * as path from 'path';

interface LiveTask {
  id: string;
  type: 'NPB1' | 'NPB2_EAST' | 'NPB2_WEST';
  gameId: string;
  priority: number;
  lastUpdate: Date | null;
  consecutiveNoUpdates: number;
  nextCheck: Date;
}

interface LiveMonitorConfig {
  contactEmail: string;
  maxConcurrent: number;
  baseIntervals: {
    npb1: number;       // 1軍のベース間隔
    npb2: number;       // ファームのベース間隔
  };
  priorityWeights: {
    npb1Live: number;
    npb1Scheduled: number;
    npb2Live: number;
    npb2Scheduled: number;
  };
  monitoring: {
    maxNoUpdateCycles: number;  // 何回連続で更新なしなら監視停止
    pauseThreshold: number;     // この時間(秒)経過したら一時停止
  };
}

const DEFAULT_CONFIG: LiveMonitorConfig = {
  contactEmail: 'contact@example.com',
  maxConcurrent: 1, // 1ホスト並列制限
  baseIntervals: {
    npb1: 15,  // 15秒
    npb2: 30   // 30秒（ファームは低頻度）
  },
  priorityWeights: {
    npb1Live: 10,        // 1軍ライブ（最高優先度）
    npb1Scheduled: 7,    // 1軍予定
    npb2Live: 5,         // ファームライブ  
    npb2Scheduled: 3     // ファーム予定
  },
  monitoring: {
    maxNoUpdateCycles: 10,  // 10回連続更新なしで停止
    pauseThreshold: 3600    // 1時間経過で一時停止
  }
};

export class YahooLiveIngester {
  private npb1Connector: YahooNPB1Connector;
  private npb2Connector: YahooNPB2Connector;
  private activeTasks = new Map<string, LiveTask>();
  private isRunning = false;
  private config: LiveMonitorConfig;
  private metricsFile: string;
  
  constructor(config: Partial<LiveMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.npb1Connector = new YahooNPB1Connector(this.config.contactEmail);
    this.npb2Connector = new YahooNPB2Connector(this.config.contactEmail);
    this.metricsFile = path.join('data', 'metrics', 'yahoo_live_metrics.json');
    
    // メトリクスディレクトリ作成
    fs.mkdir(path.dirname(this.metricsFile), { recursive: true }).catch(() => {});
  }
  
  /**
   * 指定日のライブ監視開始
   */
  async startLiveMonitoring(date: string): Promise<void> {
    console.log(`🚀 Starting Yahoo live monitoring for ${date}`);
    console.log(`Configuration: NPB1=${this.config.baseIntervals.npb1}s, NPB2=${this.config.baseIntervals.npb2}s`);
    
    this.isRunning = true;
    
    // 初期タスク発見
    await this.discoverGames(date);
    
    if (this.activeTasks.size === 0) {
      console.log(`📭 No active games found for ${date}`);
      return;
    }
    
    console.log(`📋 Monitoring ${this.activeTasks.size} games:`, 
                Array.from(this.activeTasks.values()).map(t => `${t.type}:${t.gameId}`));
    
    // メインループ
    while (this.isRunning && this.activeTasks.size > 0) {
      await this.processNextTask();
      await this.sleep(1000); // 1秒間隔でタスクをチェック
    }
    
    console.log('🏁 Live monitoring completed');
  }
  
  /**
   * 試合発見・タスク初期化
   */
  private async discoverGames(date: string): Promise<void> {
    try {
      // NPB1 ゲーム発見
      const npb1Games = await this.npb1Connector.getGamesForDate(date);
      for (const game of npb1Games) {
        if (game.status === 'live' || game.status === 'scheduled') {
          const priority = game.status === 'live' ? 
            this.config.priorityWeights.npb1Live : 
            this.config.priorityWeights.npb1Scheduled;
          
          this.activeTasks.set(`NPB1_${game.gameId}`, {
            id: `NPB1_${game.gameId}`,
            type: 'NPB1',
            gameId: game.gameId,
            priority,
            lastUpdate: null,
            consecutiveNoUpdates: 0,
            nextCheck: new Date()
          });
        }
      }
      
      // NPB2 ゲーム発見
      const npb2Games = await this.npb2Connector.getFarmGamesForDate(date);
      for (const game of npb2Games) {
        if (game.status === 'live' || game.status === 'scheduled') {
          const priority = game.status === 'live' ? 
            this.config.priorityWeights.npb2Live : 
            this.config.priorityWeights.npb2Scheduled;
          
          const taskType = game.farmLeague === 'EAST' ? 'NPB2_EAST' : 'NPB2_WEST';
          
          this.activeTasks.set(`${taskType}_${game.gameId}`, {
            id: `${taskType}_${game.gameId}`,
            type: taskType,
            gameId: game.gameId,
            priority,
            lastUpdate: null,
            consecutiveNoUpdates: 0,
            nextCheck: new Date()
          });
        }
      }
      
    } catch (error) {
      console.error('Failed to discover games:', error);
    }
  }
  
  /**
   * 優先度に基づく次タスク処理
   */
  private async processNextTask(): Promise<void> {
    const now = new Date();
    
    // 処理可能なタスクをフィルタ
    const availableTasks = Array.from(this.activeTasks.values())
      .filter(task => task.nextCheck <= now)
      .sort((a, b) => b.priority - a.priority); // 優先度降順
    
    if (availableTasks.length === 0) {
      return; // 処理可能なタスクなし
    }
    
    const task = availableTasks[0];
    
    try {
      await this.processTask(task);
    } catch (error) {
      console.error(`Failed to process task ${task.id}:`, error);
      
      // エラー時は次回チェック時間を延長
      task.nextCheck = new Date(now.getTime() + 60000); // 1分後
      task.consecutiveNoUpdates += 1;
    }
  }
  
  /**
   * 個別タスク処理
   */
  private async processTask(task: LiveTask): Promise<void> {
    const now = new Date();
    let hasUpdate = false;
    
    try {
      if (task.type === 'NPB1') {
        // NPB1 処理
        const indexes = await this.npb1Connector.getValidIndexes(task.gameId);
        
        for (const index of indexes) {
          const result = await this.npb1Connector.ingestPitchData(task.gameId, index);
          if (result.newRows > 0) {
            hasUpdate = true;
            console.log(`🔄 NPB1 ${task.gameId}:${index} - ${result.newRows} new pitches`);
          }
        }
        
      } else {
        // NPB2 処理
        const farmLeague = task.type === 'NPB2_EAST' ? 'EAST' : 'WEST';
        
        // ファームは簡略化してindex=1のみ処理
        const result = await this.npb2Connector.ingestFarmPitchData(
          task.gameId, '1', farmLeague, 'medium'
        );
        
        if (result.newRows > 0) {
          hasUpdate = true;
          console.log(`🔄 ${task.type} ${task.gameId} - ${result.newRows} new pitches`);
        }
      }
      
      // タスク状態更新
      if (hasUpdate) {
        task.lastUpdate = now;
        task.consecutiveNoUpdates = 0;
        
        // 更新があった場合は短間隔に調整
        const nextInterval = task.type === 'NPB1' ? 8 : 15; // 1軍8秒、ファーム15秒
        task.nextCheck = new Date(now.getTime() + nextInterval * 1000);
        
      } else {
        task.consecutiveNoUpdates += 1;
        
        // 動的間隔計算
        const baseInterval = task.type === 'NPB1' ? 
          this.config.baseIntervals.npb1 : 
          this.config.baseIntervals.npb2;
        
        const dynamicInterval = calculateDynamicInterval(task.lastUpdate, now);
        const actualInterval = Math.max(baseInterval, dynamicInterval);
        
        task.nextCheck = new Date(now.getTime() + actualInterval * 1000);
        
        console.log(`⏱️ ${task.id} - no updates, next check in ${actualInterval}s`);
      }
      
      // 監視停止判定
      if (task.consecutiveNoUpdates >= this.config.monitoring.maxNoUpdateCycles) {
        console.log(`🛑 Stopping monitoring for ${task.id} (${task.consecutiveNoUpdates} cycles without update)`);
        this.activeTasks.delete(task.id);
      }
      
      // 一時停止判定  
      if (task.lastUpdate) {
        const elapsed = (now.getTime() - task.lastUpdate.getTime()) / 1000;
        if (elapsed > this.config.monitoring.pauseThreshold) {
          console.log(`⏸️ Pausing monitoring for ${task.id} (${elapsed}s since last update)`);
          this.activeTasks.delete(task.id);
        }
      }
      
    } catch (error) {
      console.error(`Task processing error for ${task.id}:`, error);
      throw error;
    }
  }
  
  /**
   * 監視メトリクス記録
   */
  private async recordMetrics(): Promise<void> {
    const metrics = {
      timestamp: new Date().toISOString(),
      activeTasks: this.activeTasks.size,
      tasksByType: {
        npb1: Array.from(this.activeTasks.values()).filter(t => t.type === 'NPB1').length,
        npb2East: Array.from(this.activeTasks.values()).filter(t => t.type === 'NPB2_EAST').length,
        npb2West: Array.from(this.activeTasks.values()).filter(t => t.type === 'NPB2_WEST').length
      },
      nextChecks: Array.from(this.activeTasks.values()).map(t => ({
        id: t.id,
        nextCheck: t.nextCheck.toISOString(),
        consecutiveNoUpdates: t.consecutiveNoUpdates
      }))
    };
    
    try {
      await fs.appendFile(this.metricsFile, JSON.stringify(metrics) + '\n');
    } catch (error) {
      console.warn('Failed to record metrics:', error);
    }
  }
  
  /**
   * 監視停止
   */
  stop(): void {
    console.log('🛑 Stopping live monitoring...');
    this.isRunning = false;
  }
  
  /**
   * 現在の監視状況
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      activeTasks: this.activeTasks.size,
      tasks: Array.from(this.activeTasks.values()).map(t => ({
        id: t.id,
        type: t.type,
        priority: t.priority,
        lastUpdate: t.lastUpdate?.toISOString(),
        consecutiveNoUpdates: t.consecutiveNoUpdates,
        nextCheck: t.nextCheck.toISOString()
      }))
    };
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const date = args[0] || new Date().toISOString().split('T')[0];
  const contactEmail = process.env.CONTACT_EMAIL || 'contact@example.com';
  
  console.log(`Yahoo Live Ingestion starting for ${date}`);
  console.log(`Contact: ${contactEmail}`);
  
  const ingester = new YahooLiveIngester({ contactEmail });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    ingester.stop();
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    ingester.stop();
  });
  
  try {
    await ingester.startLiveMonitoring(date);
  } catch (error) {
    console.error('Live monitoring failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}