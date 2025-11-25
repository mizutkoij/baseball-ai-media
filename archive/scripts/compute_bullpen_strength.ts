#!/usr/bin/env npx tsx
/**
 * ブルペン強度事前計算スクリプト
 * 日次バッチでチーム別ブルペン指標を生成・キャッシュ
 */

import { computeBullpenRatings, getAllBullpenRatings } from '../lib/relief-strength';
import { logger } from '../lib/logger';
import fs from 'fs/promises';
import path from 'path';

const log = logger.child({ job: 'compute-bullpen' });

interface ComputeOptions {
  date: string;
  baseDir?: string;
  lookbackDays?: number;
  minApp?: number;
  halfLifeDays?: number;
  metric?: 'kbb_pct' | 'fip_proxy';
  leagueZScoreCap?: number;
  force?: boolean; // 既存キャッシュを上書き
}

/**
 * 単一日付のブルペン強度を計算
 */
async function computeForDate(opts: ComputeOptions): Promise<void> {
  const {
    date,
    baseDir = process.env.DATA_DIR ?? 'data',
    lookbackDays = 14,
    minApp = 6,
    halfLifeDays = 7,
    metric = 'kbb_pct',
    leagueZScoreCap = 2.0,
    force = false
  } = opts;
  
  log.info({ date, lookbackDays, metric }, 'Starting bullpen strength computation');
  
  // 出力ディレクトリ
  const outputDir = path.join(baseDir, 'derived', 'bullpen', `date=${date}`);
  const outputPath = path.join(outputDir, 'ratings.json');
  
  // 既存チェック
  if (!force) {
    try {
      await fs.access(outputPath);
      log.info({ date, path: outputPath }, 'Bullpen ratings already exist, skipping (use --force to override)');
      return;
    } catch {
      // ファイルが存在しない場合は続行
    }
  }
  
  try {
    // ブルペン評価を計算
    const ratings = await computeBullpenRatings({
      date,
      baseDir,
      params: {
        lookback_days: lookbackDays,
        min_app: minApp,
        half_life_days: halfLifeDays,
        metric,
        league_zscore_cap: leagueZScoreCap
      }
    });
    
    if (ratings.length === 0) {
      log.warn({ date }, 'No bullpen ratings computed - insufficient data');
      return;
    }
    
    // 出力ディレクトリ作成
    await fs.mkdir(outputDir, { recursive: true });
    
    // メタデータ付きで保存
    const output = {
      date,
      generated_at: new Date().toISOString(),
      parameters: {
        lookback_days: lookbackDays,
        min_app: minApp,
        half_life_days: halfLifeDays,
        metric,
        league_zscore_cap: leagueZScoreCap
      },
      ratings
    };
    
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    
    // サマリー出力
    const summary = ratings.map(r => ({
      team: r.team,
      rating: r.rating01.toFixed(3),
      z_score: r.z.toFixed(3),
      appearances: r.n
    }));
    
    log.info({
      date,
      teams_computed: ratings.length,
      output_path: outputPath,
      summary
    }, 'Bullpen strength computation completed');
    
    // コンソール出力
    console.log(`✅ ${date}: ${ratings.length} teams computed`);
    console.log('   Team ratings (0-1 scale):');
    summary.forEach(s => {
      console.log(`   ${s.team}: ${s.rating} (z=${s.z_score}, n=${s.appearances})`);
    });
    
  } catch (error) {
    log.error({ date, error: error.message }, 'Bullpen strength computation failed');
    throw error;
  }
}

/**
 * 日付範囲でバッチ計算
 */
async function computeForDateRange(
  startDate: string,
  endDate: string,
  options: Omit<ComputeOptions, 'date'>
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
  
  log.info({ startDate, endDate, total_dates: dates.length }, 'Starting batch computation');
  
  let successful = 0;
  let failed = 0;
  
  for (const date of dates) {
    try {
      await computeForDate({ ...options, date });
      successful++;
    } catch (error) {
      log.error({ date, error: error.message }, 'Date computation failed');
      failed++;
    }
  }
  
  console.log(`\n📊 Batch computation summary:`);
  console.log(`   Successful: ${successful}/${dates.length}`);
  console.log(`   Failed: ${failed}/${dates.length}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * 今日の日付を取得
 */
function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // JST = UTC+9
  return jst.toISOString().substring(0, 10).replace(/-/g, '');
}

/**
 * CLI引数解析
 */
function parseArgs(): ComputeOptions & { dateRange?: { start: string; end: string } } {
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
    } else if (arg.startsWith('--lookback=')) {
      options.lookbackDays = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--min-app=')) {
      options.minApp = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--half-life=')) {
      options.halfLifeDays = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--metric=')) {
      options.metric = arg.split('=')[1] as 'kbb_pct' | 'fip_proxy';
    } else if (arg.startsWith('--z-cap=')) {
      options.leagueZScoreCap = parseFloat(arg.split('=')[1]);
    } else if (arg === '--force') {
      options.force = true;
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
  console.log('NPB Bullpen Strength Computation');
  console.log('');
  console.log('Usage:');
  console.log('  Single date:');
  console.log('    npx tsx scripts/compute_bullpen_strength.ts --date=YYYY-MM-DD');
  console.log('    npx tsx scripts/compute_bullpen_strength.ts --today');
  console.log('');
  console.log('  Date range:');
  console.log('    npx tsx scripts/compute_bullpen_strength.ts --start=YYYY-MM-DD --end=YYYY-MM-DD');
  console.log('');
  console.log('Options:');
  console.log('  --base-dir=PATH      Data directory (default: data)');
  console.log('  --lookback=DAYS      Lookback period (default: 14)');
  console.log('  --min-app=NUM        Minimum appearances (default: 6)');
  console.log('  --half-life=DAYS     Decay half-life (default: 7)');
  console.log('  --metric=TYPE        kbb_pct or fip_proxy (default: kbb_pct)');
  console.log('  --z-cap=NUM          Z-score cap (default: 2.0)');
  console.log('  --force              Overwrite existing files');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/compute_bullpen_strength.ts --today');
  console.log('  npx tsx scripts/compute_bullpen_strength.ts --date=2025-08-12');
  console.log('  npx tsx scripts/compute_bullpen_strength.ts --start=2025-08-01 --end=2025-08-12');
  console.log('  npx tsx scripts/compute_bullpen_strength.ts --date=2025-08-12 --metric=fip_proxy --force');
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
      
      await computeForDateRange(
        options.dateRange.start.replace(/-/g, ''),
        options.dateRange.end.replace(/-/g, ''),
        options
      );
      
    } else if (options.date) {
      // 単一日付処理
      await computeForDate(options);
      
    } else {
      throw new Error('Either --date or --start/--end must be specified');
    }
    
    console.log('\n🎉 Bullpen strength computation completed successfully');
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}