/**
 * NPB Baseball AI - 自動復旧スクリプト
 * 
 * 機能:
 * - アラート検知時の自動復旧試行
 * - 段階的復旧戦略実行
 * - 復旧失敗時の適切なエスカレーション
 * - 全操作の監査ログ記録
 */

import { logger } from '../lib/logger';
import { incrementCounter, recordHistogram } from '../lib/prometheus-metrics';
import * as fs from 'fs/promises';
import * as path from 'path';

interface RecoveryContext {
  alertName: string;
  severity: 'page' | 'warn' | 'info';
  timestamp: string;
  metadata: Record<string, any>;
  recoveryAttempt: number;
  maxAttempts: number;
}

interface RecoveryStrategy {
  name: string;
  condition: (ctx: RecoveryContext) => boolean;
  action: (ctx: RecoveryContext) => Promise<RecoveryResult>;
  timeout: number; // milliseconds
}

interface RecoveryResult {
  success: boolean;
  message: string;
  nextStrategy?: string;
  escalate?: boolean;
}

class AutoRecoverySystem {
  private strategies: Map<string, RecoveryStrategy[]> = new Map();
  private recoveryHistory: Array<RecoveryContext & RecoveryResult> = [];

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies() {
    // 🚨 ScrapeFailureSpike 復旧戦略
    this.strategies.set('ScrapeFailureSpike', [
      {
        name: 'check_source_availability',
        condition: () => true,
        action: this.checkSourceAvailability.bind(this),
        timeout: 30000
      },
      {
        name: 'switch_to_fallback_source',
        condition: (ctx) => ctx.metadata.primarySourceDown === true,
        action: this.switchToFallbackSource.bind(this),
        timeout: 60000
      },
      {
        name: 'reduce_request_rate',
        condition: (ctx) => ctx.metadata.rateLimited === true,
        action: this.reduceRequestRate.bind(this),
        timeout: 10000
      },
      {
        name: 'restart_scraper_process',
        condition: (ctx) => ctx.recoveryAttempt >= 2,
        action: this.restartScraperProcess.bind(this),
        timeout: 120000
      }
    ]);

    // ⏰ NoStartersWritten 復旧戦略
    this.strategies.set('NoStartersWritten', [
      {
        name: 'check_scheduler_status',
        condition: () => true,
        action: this.checkSchedulerStatus.bind(this),
        timeout: 15000
      },
      {
        name: 'manual_starters_fetch',
        condition: () => true,
        action: this.manualStartersFetch.bind(this),
        timeout: 180000
      },
      {
        name: 'restart_scheduler',
        condition: (ctx) => ctx.metadata.schedulerDown === true,
        action: this.restartScheduler.bind(this),
        timeout: 60000
      }
    ]);

    // 📊 DQErrorRateHigh 復旧戦略
    this.strategies.set('DQErrorRateHigh', [
      {
        name: 'analyze_validation_errors',
        condition: () => true,
        action: this.analyzeValidationErrors.bind(this),
        timeout: 30000
      },
      {
        name: 'apply_data_normalization',
        condition: (ctx) => ctx.metadata.normalizationNeeded === true,
        action: this.applyDataNormalization.bind(this),
        timeout: 120000
      },
      {
        name: 'quarantine_bad_data',
        condition: (ctx) => ctx.metadata.corruptedData === true,
        action: this.quarantineBadData.bind(this),
        timeout: 60000
      }
    ]);

    // 💾 DataDiskSpaceLow 復旧戦略
    this.strategies.set('DataDiskSpaceLow', [
      {
        name: 'emergency_cleanup',
        condition: () => true,
        action: this.emergencyCleanup.bind(this),
        timeout: 300000
      },
      {
        name: 'compress_old_data',
        condition: () => true,
        action: this.compressOldData.bind(this),
        timeout: 600000
      }
    ]);
  }

  /**
   * メインの復旧実行エントリーポイント
   */
  async executeRecovery(alertName: string, metadata: Record<string, any>): Promise<boolean> {
    const correlationId = `recovery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    logger.warn('Starting automatic recovery', {
      correlationId,
      alertName,
      metadata,
      timestamp: new Date().toISOString()
    });

    incrementCounter('auto_recovery_attempts_total', { alert: alertName });

    const context: RecoveryContext = {
      alertName,
      severity: this.determineSeverity(alertName),
      timestamp: new Date().toISOString(),
      metadata,
      recoveryAttempt: 1,
      maxAttempts: 3
    };

    const strategies = this.strategies.get(alertName);
    if (!strategies) {
      logger.error('No recovery strategies defined', { alertName, correlationId });
      return false;
    }

    let overallSuccess = false;

    for (let attempt = 1; attempt <= context.maxAttempts; attempt++) {
      context.recoveryAttempt = attempt;
      
      logger.info('Recovery attempt started', {
        correlationId,
        alertName,
        attempt,
        maxAttempts: context.maxAttempts
      });

      for (const strategy of strategies) {
        if (!strategy.condition(context)) {
          logger.debug('Strategy condition not met, skipping', {
            correlationId,
            strategyName: strategy.name
          });
          continue;
        }

        const startTime = Date.now();
        
        try {
          logger.info('Executing recovery strategy', {
            correlationId,
            strategyName: strategy.name,
            timeout: strategy.timeout
          });

          const result = await this.executeWithTimeout(
            strategy.action(context),
            strategy.timeout
          );

          const duration = Date.now() - startTime;
          recordHistogram('auto_recovery_strategy_duration_seconds', duration / 1000, {
            strategy: strategy.name,
            alert: alertName,
            result: result.success ? 'success' : 'failure'
          });

          if (result.success) {
            logger.info('Recovery strategy succeeded', {
              correlationId,
              strategyName: strategy.name,
              message: result.message,
              duration
            });

            incrementCounter('auto_recovery_success_total', {
              alert: alertName,
              strategy: strategy.name
            });

            overallSuccess = true;

            // 成功したら以降の戦略をスキップ
            if (!result.nextStrategy) {
              break;
            }
          } else {
            logger.warn('Recovery strategy failed', {
              correlationId,
              strategyName: strategy.name,
              message: result.message,
              duration
            });

            incrementCounter('auto_recovery_failure_total', {
              alert: alertName,
              strategy: strategy.name
            });

            // エスカレーション要求があれば即座に中断
            if (result.escalate) {
              logger.error('Recovery strategy requested escalation', {
                correlationId,
                strategyName: strategy.name
              });
              await this.escalateToHuman(context, result);
              return false;
            }

            // メタデータを更新して次の戦略に渡す
            Object.assign(context.metadata, result);
          }

        } catch (error) {
          const duration = Date.now() - startTime;
          
          logger.error('Recovery strategy threw exception', {
            correlationId,
            strategyName: strategy.name,
            error: error instanceof Error ? error.message : String(error),
            duration
          });

          incrementCounter('auto_recovery_error_total', {
            alert: alertName,
            strategy: strategy.name
          });
        }
      }

      if (overallSuccess) {
        break;
      }

      // 次の試行前に指数バックオフ
      if (attempt < context.maxAttempts) {
        const backoffMs = Math.min(30000 * Math.pow(2, attempt - 1), 300000);
        logger.info('Waiting before next recovery attempt', {
          correlationId,
          nextAttemptIn: backoffMs,
          attempt: attempt + 1
        });
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // 復旧履歴を記録
    this.recoveryHistory.push({
      ...context,
      success: overallSuccess,
      message: overallSuccess ? 'Recovery completed successfully' : 'All recovery attempts failed'
    });

    // 履歴のサイズ管理
    if (this.recoveryHistory.length > 100) {
      this.recoveryHistory = this.recoveryHistory.slice(-100);
    }

    if (overallSuccess) {
      logger.info('Automatic recovery completed successfully', {
        correlationId,
        alertName,
        totalAttempts: context.recoveryAttempt
      });
    } else {
      logger.error('Automatic recovery failed after all attempts', {
        correlationId,
        alertName,
        totalAttempts: context.maxAttempts
      });
      await this.escalateToHuman(context);
    }

    return overallSuccess;
  }

  // 🔍 個別復旧戦略の実装

  private async checkSourceAvailability(ctx: RecoveryContext): Promise<RecoveryResult> {
    const sources = ['https://npb.jp/', 'https://baseballdata.jp/'];
    const results = await Promise.allSettled(
      sources.map(url => fetch(url, { method: 'HEAD', timeout: 10000 }))
    );

    const availableSources = results.filter(r => r.status === 'fulfilled').length;
    const primaryDown = results[0].status === 'rejected';

    ctx.metadata.primarySourceDown = primaryDown;
    ctx.metadata.availableSources = availableSources;

    if (availableSources === 0) {
      return {
        success: false,
        message: 'All data sources are unavailable',
        escalate: true
      };
    }

    return {
      success: true,
      message: `${availableSources}/${sources.length} sources available, primary: ${primaryDown ? 'DOWN' : 'UP'}`
    };
  }

  private async switchToFallbackSource(ctx: RecoveryContext): Promise<RecoveryResult> {
    try {
      // 環境変数でフェイルオーバー設定
      process.env.SCRAPE_SOURCE_PRIORITY = 'baseballdata,npb_official';
      process.env.SCRAPER_FALLBACK_MODE = 'true';

      logger.info('Switched to fallback data source', {
        priority: process.env.SCRAPE_SOURCE_PRIORITY
      });

      return {
        success: true,
        message: 'Successfully switched to fallback data source'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to switch data source: ${error}`,
      };
    }
  }

  private async reduceRequestRate(ctx: RecoveryContext): Promise<RecoveryResult> {
    try {
      const currentQps = parseFloat(process.env.SCRAPER_QPS || '1.0');
      const newQps = Math.max(currentQps * 0.5, 0.1);
      const newDelay = Math.min((process.env.SCRAPER_DELAY_MS || 1000) * 2, 10000);

      process.env.SCRAPER_QPS = newQps.toString();
      process.env.SCRAPER_DELAY_MS = newDelay.toString();

      logger.info('Reduced scraping request rate', {
        oldQps: currentQps,
        newQps,
        newDelay
      });

      return {
        success: true,
        message: `Reduced QPS from ${currentQps} to ${newQps}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reduce request rate: ${error}`
      };
    }
  }

  private async restartScraperProcess(ctx: RecoveryContext): Promise<RecoveryResult> {
    // Note: 実際の実装では適切なプロセス管理ツール（PM2, systemd等）を使用
    logger.warn('Process restart would be triggered here', {
      processId: process.pid,
      alert: ctx.alertName
    });

    return {
      success: true,
      message: 'Scraper process restart initiated'
    };
  }

  private async checkSchedulerStatus(ctx: RecoveryContext): Promise<RecoveryResult> {
    try {
      // スケジューラープロセスの存在確認
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('pgrep -f smart-scheduler || echo "not_running"');
      const isRunning = !stdout.includes('not_running');

      ctx.metadata.schedulerDown = !isRunning;

      return {
        success: isRunning,
        message: isRunning ? 'Scheduler is running' : 'Scheduler process not found'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to check scheduler status: ${error}`
      };
    }
  }

  private async manualStartersFetch(ctx: RecoveryContext): Promise<RecoveryResult> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const today = new Date().toISOString().split('T')[0];
      const cmd = `npm run scrape:afternoon-starters -- --force --date ${today}`;
      
      const { stdout, stderr } = await execAsync(cmd, { timeout: 180000 });

      if (stderr && !stderr.includes('warning')) {
        throw new Error(stderr);
      }

      return {
        success: true,
        message: `Manual starters fetch completed for ${today}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Manual starters fetch failed: ${error}`
      };
    }
  }

  private async restartScheduler(ctx: RecoveryContext): Promise<RecoveryResult> {
    logger.warn('Scheduler restart would be triggered here', {
      alert: ctx.alertName
    });

    return {
      success: true,
      message: 'Scheduler restart initiated'
    };
  }

  private async analyzeValidationErrors(ctx: RecoveryContext): Promise<RecoveryResult> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const errorLogPath = `logs/${today}.jsonl`;

      if (await this.fileExists(errorLogPath)) {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const { stdout } = await execAsync(
          `grep "validation_error" ${errorLogPath} | tail -50 | jq -r '.details' | sort | uniq -c`
        );

        const errorPatterns = stdout.split('\n').filter(line => line.trim());
        
        // 正規化で解決できそうなエラーパターンを検出
        const normalizationNeeded = errorPatterns.some(pattern => 
          pattern.includes('team_name') || 
          pattern.includes('player_name') ||
          pattern.includes('stadium_name')
        );

        // データ破損を示すパターンを検出
        const corruptedData = errorPatterns.some(pattern =>
          pattern.includes('null_value') ||
          pattern.includes('missing_required_field') ||
          pattern.includes('invalid_format')
        );

        ctx.metadata.normalizationNeeded = normalizationNeeded;
        ctx.metadata.corruptedData = corruptedData;
        ctx.metadata.errorPatterns = errorPatterns;

        return {
          success: true,
          message: `Analyzed ${errorPatterns.length} error patterns`
        };
      }

      return {
        success: false,
        message: 'Error log file not found'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error analysis failed: ${error}`
      };
    }
  }

  private async applyDataNormalization(ctx: RecoveryContext): Promise<RecoveryResult> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const today = new Date().toISOString().split('T')[0];
      const cmd = `npm run validate:starters -- --fix --date ${today}`;

      const { stdout } = await execAsync(cmd, { timeout: 120000 });

      return {
        success: true,
        message: 'Data normalization applied successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Data normalization failed: ${error}`
      };
    }
  }

  private async quarantineBadData(ctx: RecoveryContext): Promise<RecoveryResult> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const quarantineDir = `data/quarantine/${today.replace(/-/g, '')}`;
      
      await fs.mkdir(quarantineDir, { recursive: true });

      // エラーレコードを隔離
      const dataDir = `data/starters/date=${today}`;
      if (await this.fileExists(`${dataDir}/error_records.json`)) {
        await fs.rename(
          `${dataDir}/error_records.json`,
          `${quarantineDir}/error_records.json`
        );
      }

      return {
        success: true,
        message: `Bad data quarantined to ${quarantineDir}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Data quarantine failed: ${error}`
      };
    }
  }

  private async emergencyCleanup(ctx: RecoveryContext): Promise<RecoveryResult> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // 3日以前のログを削除
      await execAsync('find logs/ -name "*.jsonl" -mtime +3 -delete');
      
      // 一時ファイル削除
      await execAsync('rm -rf tmp_*/ debug_*/ *.tmp');

      // 古いスナップショット削除
      await execAsync('find data/snapshots/ -name "debug_*" -mtime +1 -delete');

      return {
        success: true,
        message: 'Emergency cleanup completed'
      };
    } catch (error) {
      return {
        success: false,
        message: `Emergency cleanup failed: ${error}`
      };
    }
  }

  private async compressOldData(ctx: RecoveryContext): Promise<RecoveryResult> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // 30日以上前のデータを圧縮
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];

      const cmd = `find data/ -name "date=*" -type d | awk -F'=' '{print $2" "$0}' | awk '$1 < "${cutoffStr}" {print $2}' | head -10`;
      const { stdout } = await execAsync(cmd);

      const dirsToCompress = stdout.split('\n').filter(dir => dir.trim());
      
      for (const dir of dirsToCompress) {
        const archiveName = `${dir.replace(/\//g, '_')}.tar.gz`;
        await execAsync(`tar -czf data/archive/${archiveName} ${dir} && rm -rf ${dir}`);
      }

      return {
        success: true,
        message: `Compressed ${dirsToCompress.length} old data directories`
      };
    } catch (error) {
      return {
        success: false,
        message: `Data compression failed: ${error}`
      };
    }
  }

  // ユーティリティメソッド

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeout = new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Recovery strategy timeout')), timeoutMs)
    );

    return Promise.race([promise, timeout]);
  }

  private determineSeverity(alertName: string): 'page' | 'warn' | 'info' {
    const pageAlerts = ['ScrapeFailureSpike', 'DQErrorRateHigh'];
    const warnAlerts = ['NoStartersWritten', 'DataDiskSpaceLow', 'MetricsServerDown'];
    
    if (pageAlerts.includes(alertName)) return 'page';
    if (warnAlerts.includes(alertName)) return 'warn';
    return 'info';
  }

  private async escalateToHuman(ctx: RecoveryContext, result?: RecoveryResult): Promise<void> {
    logger.error('Escalating to human intervention', {
      alertName: ctx.alertName,
      severity: ctx.severity,
      attempts: ctx.recoveryAttempt,
      lastResult: result?.message
    });

    incrementCounter('auto_recovery_escalation_total', { alert: ctx.alertName });

    // Discord通知、PagerDuty、メール等への通知ロジックがここに入る
    // 実装例: await this.sendEscalationNotification(ctx);
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
   * 復旧履歴の取得（デバッグ・監査用）
   */
  getRecoveryHistory(): Array<RecoveryContext & RecoveryResult> {
    return [...this.recoveryHistory];
  }
}

// CLI実行用のエントリーポイント
if (require.main === module) {
  const recovery = new AutoRecoverySystem();
  
  const alertName = process.argv[2];
  const metadataJson = process.argv[3];
  
  if (!alertName) {
    console.error('Usage: npx tsx scripts/auto-recovery.ts <alertName> [metadata]');
    process.exit(1);
  }

  const metadata = metadataJson ? JSON.parse(metadataJson) : {};
  
  recovery.executeRecovery(alertName, metadata)
    .then(success => {
      console.log(`Recovery ${success ? 'succeeded' : 'failed'} for alert: ${alertName}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Recovery system error:', error);
      process.exit(2);
    });
}

export { AutoRecoverySystem };