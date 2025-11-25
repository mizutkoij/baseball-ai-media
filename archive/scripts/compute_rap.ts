#!/usr/bin/env npx tsx
/**
 * RAP (Relief Appearance Points) 計算スクリプト
 * NPB中継ぎ投手の連投負荷指標を日次生成
 */

import { computeTeamRAP, loadRAPHistory, saveRAPMetrics, debugRAPMetrics } from '../lib/rap';
import { logger } from '../lib/logger';
import fs from 'fs/promises';
import path from 'path';

const log = logger.child({ job: 'compute-rap' });

interface ComputeRAPOptions {
  date: string;
  baseDir?: string;
  teams?: string[];
  force?: boolean;
  debug?: boolean;
}

/**
 * 全チームのRAP指標を計算
 */
async function computeAllTeamsRAP(opts: ComputeRAPOptions): Promise<void> {
  const {
    date,
    baseDir = process.env.DATA_DIR ?? 'data',
    teams = ['G', 'T', 'C', 'D', 'S', 'YB', 'L', 'H', 'F', 'M', 'E', 'B'], // NPB全12球団
    force = false,
    debug = false
  } = opts;
  
  log.info({ date, teams: teams.length }, 'Starting RAP computation for all teams');
  
  // 出力ディレクトリ
  const outputDir = path.join(baseDir, 'derived', 'rap', `date=${date}`);
  const outputPath = path.join(outputDir, 'rap_metrics.json');
  
  // 既存チェック
  if (!force) {
    try {
      await fs.access(outputPath);
      log.info({ date, path: outputPath }, 'RAP metrics already exist, skipping (use --force to override)');
      return;
    } catch {
      // ファイルが存在しない場合は続行
    }
  }
  
  try {
    // 登板履歴データを読み込み
    const appearances = await loadRAPHistory(date, baseDir);
    
    if (appearances.length === 0) {
      log.warn({ date }, 'No appearance data found for RAP calculation');
      return;
    }
    
    log.info({ date, total_appearances: appearances.length }, 'Loaded appearance data');
    
    // 各チームのRAP計算
    const allMetrics = [];
    let totalPitchers = 0;
    
    for (const team of teams) {
      try {
        const teamMetrics = await computeTeamRAP(team, date, appearances);
        allMetrics.push(...teamMetrics);
        totalPitchers += teamMetrics.length;
        
        log.debug({
          team,
          pitchers: teamMetrics.length,
          high_risk: teamMetrics.filter(m => m.risk_level === 'high' || m.risk_level === 'danger').length
        }, 'Team RAP computed');
        
        // デバッグモード：高リスク投手の詳細表示
        if (debug) {
          const highRiskPitchers = teamMetrics.filter(m => m.risk_level === 'high' || m.risk_level === 'danger');
          for (const pitcher of highRiskPitchers) {
            debugRAPMetrics(pitcher);
          }
        }
        
      } catch (error) {
        log.error({ team, error: error.message }, 'Failed to compute RAP for team');
      }
    }
    
    if (allMetrics.length === 0) {
      log.warn({ date }, 'No RAP metrics computed');
      return;
    }
    
    // 結果を保存
    await saveRAPMetrics(date, allMetrics, baseDir);
    
    // サマリー出力
    const riskDistribution = {
      low: allMetrics.filter(m => m.risk_level === 'low').length,
      medium: allMetrics.filter(m => m.risk_level === 'medium').length,
      high: allMetrics.filter(m => m.risk_level === 'high').length,
      danger: allMetrics.filter(m => m.risk_level === 'danger').length
    };
    
    const topRAP = allMetrics
      .sort((a, b) => b.rap_plus_14d - a.rap_plus_14d)
      .slice(0, 5);
    
    log.info({
      date,
      total_pitchers: allMetrics.length,
      risk_distribution: riskDistribution,
      output_path: outputPath
    }, 'RAP computation completed');
    
    // コンソール出力
    console.log(`✅ ${date}: ${allMetrics.length} 投手のRAP指標を計算`);
    console.log('   リスク分布:');
    console.log(`     低リスク: ${riskDistribution.low}`);
    console.log(`     中リスク: ${riskDistribution.medium}`);
    console.log(`     高リスク: ${riskDistribution.high}`);
    console.log(`     危険: ${riskDistribution.danger}`);
    
    if (topRAP.length > 0) {
      console.log('   RAP+ 14日 上位5名:');
      topRAP.forEach((p, i) => {
        console.log(`     ${i + 1}. ${p.pitcher_id}: ${p.rap_plus_14d.toFixed(1)} (${p.risk_level})`);
      });
    }
    
  } catch (error) {
    log.error({ date, error: error.message }, 'RAP computation failed');
    throw error;
  }
}

/**
 * 日付範囲でのバッチ計算
 */
async function computeRAPForDateRange(
  startDate: string,
  endDate: string,
  options: Omit<ComputeRAPOptions, 'date'>
): Promise<void> {
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    throw new Error('Start date must be before end date');
  }
  
  const dates: string[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(current.toISOString().substring(0, 10).replace(/-/g, ''));
    current.setDate(current.getDate() + 1);
  }
  
  log.info({ startDate, endDate, total_dates: dates.length }, 'Starting batch RAP computation');
  
  let successful = 0;
  let failed = 0;
  
  for (const date of dates) {
    try {
      await computeAllTeamsRAP({ ...options, date });
      successful++;
    } catch (error) {
      log.error({ date, error: error.message }, 'Date computation failed');
      failed++;
    }
  }
  
  console.log(`\n📊 バッチRAP計算結果:`);
  console.log(`   成功: ${successful}/${dates.length}`);
  console.log(`   失敗: ${failed}/${dates.length}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * 今日の日付を取得（JST）
 */
function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // JST = UTC+9
  return jst.toISOString().substring(0, 10).replace(/-/g, '');
}

/**
 * CLI引数解析
 */
function parseArgs(): ComputeRAPOptions & { dateRange?: { start: string; end: string } } {
  const args = process.argv.slice(2);
  const options: any = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--date=')) {
      options.date = arg.split('=')[1];
    } else if (arg.startsWith('--start=')) {
      options.dateRange = options.dateRange || {};
      options.dateRange.start = arg.split('=')[1];
    } else if (arg.startsWith('--end=')) {
      options.dateRange = options.dateRange || {};
      options.dateRange.end = arg.split('=')[1];
    } else if (arg.startsWith('--base-dir=')) {
      options.baseDir = arg.split('=')[1];
    } else if (arg.startsWith('--teams=')) {
      options.teams = arg.split('=')[1].split(',');
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--today') {
      options.date = getTodayJST();
    }
  }
  
  return options;
}

/**
 * ヘルプメッセージ
 */
function showHelp(): void {
  console.log('NPB Relief Appearance Points (RAP) Computation');
  console.log('');
  console.log('Usage:');
  console.log('  Single date:');
  console.log('    npx tsx scripts/compute_rap.ts --date=YYYY-MM-DD');
  console.log('    npx tsx scripts/compute_rap.ts --today');
  console.log('');
  console.log('  Date range:');
  console.log('    npx tsx scripts/compute_rap.ts --start=YYYY-MM-DD --end=YYYY-MM-DD');
  console.log('');
  console.log('Options:');
  console.log('  --base-dir=PATH      Data directory (default: data)');
  console.log('  --teams=G,T,C,...    Specific teams (default: all NPB teams)');
  console.log('  --force              Overwrite existing files');
  console.log('  --debug              Show detailed output for high-risk pitchers');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/compute_rap.ts --today');
  console.log('  npx tsx scripts/compute_rap.ts --date=2025-08-12 --debug');
  console.log('  npx tsx scripts/compute_rap.ts --start=2025-08-01 --end=2025-08-12');
  console.log('  npx tsx scripts/compute_rap.ts --date=2025-08-12 --teams=G,T --force');
}

/**
 * メイン実行
 */
async function main(): Promise<void> {
  const options = parseArgs();
  
  // ヘルプまたは引数なし
  if (process.argv.length <= 2 || process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    return;
  }
  
  try {
    if (options.dateRange) {
      // 日付範囲処理
      if (!options.dateRange.start || !options.dateRange.end) {
        throw new Error('Both --start and --end must be specified for date range');
      }
      
      await computeRAPForDateRange(
        options.dateRange.start.replace(/-/g, ''),
        options.dateRange.end.replace(/-/g, ''),
        options
      );
      
    } else if (options.date) {
      // 単一日付処理
      await computeAllTeamsRAP(options);
      
    } else {
      throw new Error('Either --date or --start/--end must be specified');
    }
    
    console.log('\n🎉 RAP計算が正常に完了しました');
    
  } catch (error) {
    console.error(`❌ エラー: ${error.message}`);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main().catch(error => {
    console.error('💥 予期しないエラー:', error);
    process.exit(1);
  });
}