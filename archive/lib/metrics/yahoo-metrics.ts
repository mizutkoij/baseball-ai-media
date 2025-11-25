/**
 * Yahoo スクレイピング用 Prometheus メトリクス
 * レート制限・robots.txt・304率・429回数の監視
 */

import { register, Counter, Histogram, Gauge } from 'prom-client';

// カウンターメトリクス
export const sourceRequestsTotal = new Counter({
  name: 'source_requests_total',
  help: 'Total number of requests to external sources',
  labelNames: ['host', 'source', 'status_code']
});

export const source304Responses = new Counter({
  name: 'source_304_responses_total', 
  help: 'Total number of 304 Not Modified responses',
  labelNames: ['host', 'source']
});

export const source429Responses = new Counter({
  name: 'source_429_total',
  help: 'Total number of 429 rate limit responses', 
  labelNames: ['host', 'source']
});

export const pitchRowsIngestedTotal = new Counter({
  name: 'pitch_rows_ingested_total',
  help: 'Total number of pitch rows ingested',
  labelNames: ['level', 'source', 'confidence']
});

export const pitchRowsDuplicateTotal = new Counter({
  name: 'pitch_rows_duplicate_total',
  help: 'Total number of duplicate pitch rows (filtered out)',
  labelNames: ['level', 'source']
});

export const robotsChecksTotal = new Counter({
  name: 'robots_checks_total',
  help: 'Total number of robots.txt checks performed',
  labelNames: ['host', 'result']
});

// ヒストグラムメトリクス
export const yahooRequestDuration = new Histogram({
  name: 'yahoo_request_duration_seconds',
  help: 'Duration of Yahoo requests in seconds',
  labelNames: ['host', 'endpoint_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

export const yahooPollInterval = new Histogram({
  name: 'yahoo_poll_interval_seconds',
  help: 'Current polling interval for Yahoo endpoints',
  labelNames: ['game_id', 'level'],
  buckets: [5, 8, 10, 15, 20, 30, 45, 60]
});

// ゲージメトリクス
export const activeMonitoringTasks = new Gauge({
  name: 'active_monitoring_tasks',
  help: 'Number of active live monitoring tasks',
  labelNames: ['level', 'status']
});

export const source304Ratio = new Gauge({
  name: 'source_304_ratio',
  help: 'Ratio of 304 responses over total responses (last 10 minutes)',
  labelNames: ['host', 'source']
});

export const consecutiveNoUpdates = new Gauge({
  name: 'consecutive_no_updates',
  help: 'Number of consecutive polling cycles without new data',
  labelNames: ['game_id', 'level']
});

export const lastUpdateAge = new Gauge({
  name: 'last_update_age_seconds',
  help: 'Seconds since last data update for each game',
  labelNames: ['game_id', 'level']
});

export const backfillProgress = new Gauge({
  name: 'backfill_progress_ratio',
  help: 'Backfill completion ratio (0-1)',
  labelNames: ['level', 'date_range']
});

/**
 * Yahoo メトリクス記録クラス
 */
export class YahooMetricsRecorder {
  private static instance: YahooMetricsRecorder;
  
  private constructor() {}
  
  static getInstance(): YahooMetricsRecorder {
    if (!YahooMetricsRecorder.instance) {
      YahooMetricsRecorder.instance = new YahooMetricsRecorder();
    }
    return YahooMetricsRecorder.instance;
  }
  
  /**
   * HTTPリクエストの記録
   */
  recordRequest(
    host: string, 
    source: 'yahoo' | 'baseballdata' | 'npb',
    statusCode: number, 
    durationSeconds: number,
    endpointType: 'schedule' | 'score' | 'pitch' | 'robots' = 'score'
  ): void {
    sourceRequestsTotal.inc({ host, source, status_code: statusCode });
    yahooRequestDuration.observe({ host, endpoint_type: endpointType }, durationSeconds);
    
    if (statusCode === 304) {
      source304Responses.inc({ host, source });
    } else if (statusCode === 429) {
      source429Responses.inc({ host, source });
    }
  }
  
  /**
   * 投球データ取り込みの記録
   */
  recordPitchIngestion(
    level: 'NPB1' | 'NPB2',
    source: 'yahoo' | 'baseballdata',
    newRows: number,
    duplicateRows: number,
    confidence: 'high' | 'medium' | 'low'
  ): void {
    if (newRows > 0) {
      pitchRowsIngestedTotal.inc({ level, source, confidence }, newRows);
    }
    if (duplicateRows > 0) {
      pitchRowsDuplicateTotal.inc({ level, source }, duplicateRows);
    }
  }
  
  /**
   * robots.txt チェックの記録
   */
  recordRobotsCheck(host: string, allowed: boolean): void {
    const result = allowed ? 'allowed' : 'disallowed';
    robotsChecksTotal.inc({ host, result });
  }
  
  /**
   * ライブ監視状態の更新
   */
  updateMonitoringStatus(
    gameId: string,
    level: 'NPB1' | 'NPB2',
    status: 'active' | 'paused' | 'stopped',
    consecutiveNoUpdateCount: number = 0,
    lastUpdateTime?: Date
  ): void {
    // タスク状態
    activeMonitoringTasks.set({ level, status }, 1);
    
    // 連続無更新回数
    consecutiveNoUpdates.set({ game_id: gameId, level }, consecutiveNoUpdateCount);
    
    // 最終更新からの経過時間
    if (lastUpdateTime) {
      const ageSeconds = (Date.now() - lastUpdateTime.getTime()) / 1000;
      lastUpdateAge.set({ game_id: gameId, level }, ageSeconds);
    }
  }
  
  /**
   * ポーリング間隔の記録
   */
  recordPollInterval(gameId: string, level: 'NPB1' | 'NPB2', intervalSeconds: number): void {
    yahooPollInterval.observe({ game_id: gameId, level }, intervalSeconds);
  }
  
  /**
   * 304率の計算・更新（定期実行推奨）
   */
  update304Ratios(): void {
    // 過去10分間の304率を計算
    // 実装は既存のメトリクス収集システムに依存
    
    // Yahoo
    const yahooTotal = sourceRequestsTotal.get().values?.filter(
      metric => metric.labels.host === 'baseball.yahoo.co.jp'
    ).reduce((sum, metric) => sum + metric.value, 0) || 0;
    
    const yahoo304 = source304Responses.get().values?.filter(
      metric => metric.labels.host === 'baseball.yahoo.co.jp'
    ).reduce((sum, metric) => sum + metric.value, 0) || 0;
    
    if (yahooTotal > 0) {
      source304Ratio.set({ host: 'baseball.yahoo.co.jp', source: 'yahoo' }, yahoo304 / yahooTotal);
    }
  }
  
  /**
   * バックフィル進捗の更新
   */
  updateBackfillProgress(
    level: 'NPB1' | 'NPB2',
    dateRange: string,
    completedGames: number,
    totalGames: number
  ): void {
    const ratio = totalGames > 0 ? completedGames / totalGames : 0;
    backfillProgress.set({ level, date_range: dateRange }, ratio);
  }
  
  /**
   * アラート条件のチェック
   */
  checkAlertConditions(): {
    alerts: Array<{ severity: 'warning' | 'critical', message: string }>;
    status: 'healthy' | 'degraded' | 'critical';
  } {
    const alerts: Array<{ severity: 'warning' | 'critical', message: string }> = [];
    
    // 429回数チェック
    const recent429s = source429Responses.get().values?.reduce((sum, metric) => sum + metric.value, 0) || 0;
    if (recent429s > 0) {
      alerts.push({
        severity: recent429s > 5 ? 'critical' : 'warning',
        message: `${recent429s} rate limit responses in monitoring period`
      });
    }
    
    // 304率チェック
    const current304Ratio = source304Ratio.get().values?.find(
      metric => metric.labels.host === 'baseball.yahoo.co.jp'
    )?.value || 0;
    
    if (current304Ratio < 0.6) {
      alerts.push({
        severity: current304Ratio < 0.3 ? 'critical' : 'warning', 
        message: `Low 304 ratio: ${(current304Ratio * 100).toFixed(1)}% (expected >60%)`
      });
    }
    
    // 連続無更新チェック
    const maxNoUpdates = Math.max(...(consecutiveNoUpdates.get().values?.map(m => m.value) || [0]));
    if (maxNoUpdates > 10) {
      alerts.push({
        severity: maxNoUpdates > 20 ? 'critical' : 'warning',
        message: `Game with ${maxNoUpdates} consecutive polling cycles without updates`
      });
    }
    
    // 全体ステータス判定
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (alerts.some(a => a.severity === 'critical')) {
      status = 'critical';
    } else if (alerts.length > 0) {
      status = 'degraded';
    }
    
    return { alerts, status };
  }
  
  /**
   * メトリクス詳細取得
   */
  getDetailedMetrics(): any {
    return {
      requests: {
        total: sourceRequestsTotal.get(),
        duration: yahooRequestDuration.get(),
        rateLimited: source429Responses.get(),
        notModified: source304Responses.get()
      },
      ingestion: {
        pitchRows: pitchRowsIngestedTotal.get(),
        duplicates: pitchRowsDuplicateTotal.get()
      },
      monitoring: {
        activeTasks: activeMonitoringTasks.get(),
        noUpdates: consecutiveNoUpdates.get(),
        lastUpdateAge: lastUpdateAge.get()
      },
      health: {
        ratio304: source304Ratio.get(),
        robotsChecks: robotsChecksTotal.get()
      }
    };
  }
}

// メトリクス自動更新タスク
export function startMetricsUpdateTask(intervalMs: number = 60000): NodeJS.Timeout {
  const recorder = YahooMetricsRecorder.getInstance();
  
  return setInterval(() => {
    try {
      recorder.update304Ratios();
      
      const healthCheck = recorder.checkAlertConditions();
      if (healthCheck.alerts.length > 0) {
        console.warn('Yahoo scraping health alerts:', healthCheck.alerts);
      }
      
    } catch (error) {
      console.error('Failed to update Yahoo metrics:', error);
    }
  }, intervalMs);
}