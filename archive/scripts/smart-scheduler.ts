#!/usr/bin/env npx tsx

/**
 * スマートスケジューラー
 * 
 * 機能:
 * - 5分間隔で起動し、その時点で何を実行すべきかを判定
 * - 試合有無に応じた可変間隔スケジューリング
 * - メトリクス更新（次回実行時刻予告）
 * - 冪等実行（重複実行時は安全にスキップ）
 */

import { planFor, isWithinWindow, isDueForExecution, getNextExecutionTime } from '../lib/schedule-policy';
import { nextRunsGauge, scrapeJobs } from '../lib/prometheus-metrics';
import { withCtx, generateRunId, logJobEvent } from '../lib/logger';
import { exec as _exec } from 'child_process';
import { promisify } from 'util';

const exec = promisify(_exec);

// 環境変数
const DATA_DIR = process.env.DATA_DIR ?? 'data';
const TZ = 'Asia/Tokyo';
const DRY_RUN = process.env.DRY_RUN === 'true';
const VERBOSE = process.env.VERBOSE === 'true';

/**
 * 現在のJST時刻情報を取得
 */
function getCurrentJSTTime() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const parts = fmt.formatToParts(now);
  const getValue = (type: string) => parts.find(p => p.type === type)?.value || '';

  return {
    date: `${getValue('year')}-${getValue('month')}-${getValue('day')}`,
    time: `${getValue('hour')}:${getValue('minute')}`,
    seconds: `${getValue('hour')}:${getValue('minute')}:${getValue('second')}`,
    epochSec: Math.floor(now.getTime() / 1000),
    epochMs: now.getTime(),
  };
}

/**
 * コマンドを実行
 */
async function executeCommand(cmd: string, jobType: string, runId: string): Promise<boolean> {
  const logger = withCtx({ runId, job: jobType });
  
  logJobEvent(
    { runId, job: jobType },
    'start',
    { cmd }
  );
  
  if (DRY_RUN) {
    logger.info({ cmd, dryRun: true }, 'Would execute command (dry run)');
    scrapeJobs.inc({ job: jobType, result: 'success' });
    return true;
  }

  try {
    const { stdout, stderr } = await exec(cmd, {
      env: {
        ...process.env,
        DATA_DIR,
      },
      timeout: 10 * 60 * 1000, // 10分タイムアウト
    });

    if (stdout && VERBOSE) {
      process.stdout.write(stdout);
    }
    
    if (stderr) {
      logger.warn({ stderr }, 'Command stderr output');
    }

    scrapeJobs.inc({ job: jobType, result: 'success' });
    logJobEvent(
      { runId, job: jobType },
      'success',
      { cmd }
    );
    
    return true;
    
  } catch (error: any) {
    scrapeJobs.inc({ job: jobType, result: 'fail' });
    logJobEvent(
      { runId, job: jobType },
      'fail',
      { 
        cmd,
        error: error?.message,
        error_code: error?.code,
      }
    );
    
    return false;
  }
}

/**
 * 実行すべきジョブを決定
 */
interface JobDecision {
  jobType: string;
  command: string;
  reason: string;
  shouldExecute: boolean;
}

async function decideJobs(plan: any, currentTime: string, epochSec: number): Promise<JobDecision[]> {
  const decisions: JobDecision[] = [];
  
  // Pre-game window: Starters (予告先発)
  if (isWithinWindow(plan.pre, currentTime)) {
    decisions.push({
      jobType: 'starters',
      command: 'npm run scrape:afternoon-starters',
      reason: `Pre-game starters update (every ${plan.pre.everyMin}min)`,
      shouldExecute: isDueForExecution(plan.pre, epochSec),
    });
  }
  
  // Pregame Predictions: 60分前に実行
  if (plan.hasGames) {
    const gameStartTimes = plan.gameWindows?.map((w: any) => w.startTime) || [];
    const { shouldRunPregamePrediction } = await import('../lib/schedule-policy');
    const predictionDecision = shouldRunPregamePrediction(currentTime, gameStartTimes);
    
    if (predictionDecision.shouldRun) {
      decisions.push({
        jobType: 'pregame_prediction',
        command: 'npm run predict:pregame',
        reason: predictionDecision.reason,
        shouldExecute: true,
      });
    }
  }
  
  // Live window: Games (試合結果・スコア)
  if (isWithinWindow(plan.live, currentTime)) {
    decisions.push({
      jobType: 'games',
      command: 'npm run scrape:morning-update',
      reason: `Live game updates (every ${plan.live.everyMin}min)`,
      shouldExecute: isDueForExecution(plan.live, epochSec),
    });
  }
  
  // Post-game window: Details (詳細データ)
  if (isWithinWindow(plan.post, currentTime)) {
    decisions.push({
      jobType: 'details',
      command: 'npm run scrape:evening-results', // この名前は実際のコマンドに合わせて調整
      reason: `Post-game details (every ${plan.post.everyMin}min)`,
      shouldExecute: isDueForExecution(plan.post, epochSec),
    });
  }

  return decisions;
}

/**
 * メトリクス更新（次回実行予想時刻）
 */
function updateMetrics(plan: any, epochSec: number) {
  try {
    const nextStarters = getNextExecutionTime(plan.pre, epochSec);
    const nextGames = getNextExecutionTime(plan.live, epochSec);
    const nextDetails = getNextExecutionTime(plan.post, epochSec);
    
    nextRunsGauge.set({ job: 'starters' }, nextStarters);
    nextRunsGauge.set({ job: 'games' }, nextGames);
    nextRunsGauge.set({ job: 'details' }, nextDetails);
    
    if (VERBOSE) {
      const formatTime = (epoch: number) => new Date(epoch * 1000).toLocaleString('ja-JP', { timeZone: TZ });
      console.log(`📊 Next execution times:`);
      console.log(`   Starters: ${formatTime(nextStarters)}`);
      console.log(`   Games: ${formatTime(nextGames)}`);
      console.log(`   Details: ${formatTime(nextDetails)}`);
    }
  } catch (error) {
    console.error('Failed to update metrics:', error);
  }
}

/**
 * バックフィル機能（欠損データの補完）
 */
async function runBackfill(days: number) {
  const runId = generateRunId();
  const logger = withCtx({ runId, job: 'backfill' });
  
  logger.info({ days }, 'Starting backfill operation');
  
  const today = new Date();
  const results = [];
  
  for (let i = 1; i <= days; i++) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    
    try {
      const plan = await planFor(dateStr, DATA_DIR);
      
      if (plan.hasGames) {
        logger.info({ date: dateStr, games: plan.gameCount }, 'Backfilling game day');
        
        // 詳細データの取得（post処理相当）
        const success = await executeCommand(
          'npm run scrape:evening-results',
          'backfill-details',
          runId
        );
        
        results.push({ date: dateStr, success });
      } else {
        logger.debug({ date: dateStr }, 'Skipping non-game day');
      }
      
    } catch (error) {
      logger.error({ date: dateStr, error: String(error) }, 'Backfill failed for date');
      results.push({ date: dateStr, success: false });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  logger.info({ 
    total: results.length,
    successful: successCount,
    failed: results.length - successCount
  }, 'Backfill operation completed');
  
  return results;
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  const runId = generateRunId();
  const logger = withCtx({ runId, job: 'smart-scheduler' });
  
  // バックフィルモード
  if (args.includes('--backfill')) {
    const daysIndex = args.indexOf('--backfill') + 1;
    const days = daysIndex < args.length ? parseInt(args[daysIndex]) : 7;
    
    if (isNaN(days) || days <= 0) {
      console.error('Invalid backfill days. Usage: --backfill <days>');
      process.exit(1);
    }
    
    await runBackfill(days);
    return;
  }
  
  // 通常のスケジュール判定モード
  const now = getCurrentJSTTime();
  
  if (VERBOSE) {
    console.log(`🕒 Smart Scheduler running at ${now.seconds} JST (${now.date})`);
    if (DRY_RUN) console.log('🧪 DRY RUN MODE - Commands will not be executed');
  }
  
  try {
    // 当日のスケジュール計画を取得
    const plan = await planFor(now.date, DATA_DIR);
    
    if (VERBOSE) {
      console.log(`📅 Plan: ${plan.hasGames ? `${plan.gameCount} games` : 'No games'} (confidence: ${plan.confidence})`);
    }
    
    // メトリクス更新
    updateMetrics(plan, now.epochSec);
    
    // 実行すべきジョブを決定
    const jobDecisions = await decideJobs(plan, now.time, now.epochSec);
    const executableJobs = jobDecisions.filter(d => d.shouldExecute);
    
    if (VERBOSE || executableJobs.length > 0) {
      console.log(`🎯 Job decisions at ${now.time}:`);
      jobDecisions.forEach(decision => {
        const status = decision.shouldExecute ? '▶️ EXECUTE' : '⏸️ SKIP';
        console.log(`   ${status} ${decision.jobType}: ${decision.reason}`);
      });
    }
    
    // ジョブ実行
    if (executableJobs.length > 0) {
      logger.info({ 
        jobs: executableJobs.map(j => j.jobType),
        time: now.time 
      }, 'Executing scheduled jobs');
      
      const results = [];
      for (const job of executableJobs) {
        const success = await executeCommand(job.command, job.jobType, runId);
        results.push({ jobType: job.jobType, success });
      }
      
      const successCount = results.filter(r => r.success).length;
      logger.info({
        total: results.length,
        successful: successCount,
        failed: results.length - successCount
      }, 'Job execution completed');
      
    } else if (VERBOSE) {
      console.log('😴 No jobs to execute at this time');
    }
    
  } catch (error) {
    logger.error({ error: String(error) }, 'Smart scheduler failed');
    console.error('💥 Smart scheduler error:', error);
    process.exit(1);
  }
}

// CLI実行時のエラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Main execution failed:', error);
    process.exit(1);
  });
}

export { main as runSmartScheduler };