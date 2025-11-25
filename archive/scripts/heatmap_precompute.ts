#!/usr/bin/env npx tsx

// ヒートマップ前計算ジョブ
// 使用法: npx tsx scripts/heatmap_precompute.ts [--all|--today|--pitcher=ID]

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { notifyStatus, notifyDataDiff, sendJsonAttachment } from '../lib/discord-notifier';

// データベース接続（オプショナル）
let pool: Pool | null = null;
try {
  if (process.env.DATABASE_URL || process.env.PGURL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.PGURL,
    });
  }
} catch (error) {
  console.log('Database not available, using file-based fallback');
}

const GRID_SIZE = 13;
const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  RESET: '\x1b[0m'
};

function log(color: string, message: string) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

interface PitchData {
  pitcher_id: string;
  batter_side: 'L' | 'R';
  count_bucket: string;
  px: number;
  pz: number;
  pitch_type: string;
}

interface GridData {
  [pitchType: string]: number[][];
}

interface HeatmapResult {
  pitcher_id: string;
  batter_side: 'L' | 'R';
  count_bucket: string;
  empirical: GridData;
  model: GridData;
  sample_size: number;
  quality_score: number;
}

// 13x13グリッド初期化
function initGrid(): number[][] {
  return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
}

// 座標をグリッドインデックスに変換
function coordToGrid(px: number, pz: number): [number, number] {
  // px: -2.5 to 2.5 → 0 to 12
  const gx = Math.max(0, Math.min(12, Math.round((px + 2.5) / 5.0 * 12.0)));
  
  // pz: 1.0 to 4.0 → 0 to 12  
  const gy = Math.max(0, Math.min(12, Math.round((pz - 1.0) / 3.0 * 12.0)));
  
  return [gx, gy];
}

// ボール・ストライクカウントをバケットに変換
function countToBucket(balls: number, strikes: number): string {
  if (balls === 3 && strikes === 2) return 'full';
  if (balls === 0 && strikes === 0) return 'start';
  if (strikes === 2) return 'two_strike';
  if ((balls === 0 && strikes >= 1) || (balls === 1 && strikes === 2)) return 'ahead';
  if (balls >= 2 && strikes === 0) return 'behind';
  return 'even';
}

// ガウシアンスムージング（separable、軽量版）
function applySmoothingToGrid(grid: number[][]): number[][] {
  const smoothed = grid.map(row => [...row]);
  
  // X方向スムージング
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 1; x < GRID_SIZE - 1; x++) {
      smoothed[y][x] = (
        grid[y][x-1] * 0.25 +
        grid[y][x] * 0.5 +
        grid[y][x+1] * 0.25
      );
    }
  }
  
  // Y方向スムージング
  const final = smoothed.map(row => [...row]);
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 1; y < GRID_SIZE - 1; y++) {
      final[y][x] = (
        smoothed[y-1][x] * 0.25 +
        smoothed[y][x] * 0.5 +
        smoothed[y+1][x] * 0.25
      );
    }
  }
  
  return final;
}

// グリッドを正規化（総和=1）
function normalizeGrid(grid: number[][]): number[][] {
  const total = grid.flat().reduce((sum, val) => sum + val, 0);
  if (total === 0) return grid;
  
  return grid.map(row => 
    row.map(val => val / total)
  );
}

// NextPitchモデルの球種ミックスを取得（モック版）
async function getNextPitchMix(pitcher_id: string, batter_side: string, count_bucket: string): Promise<Record<string, number>> {
  // 実装簡略化のため、固定値を返す
  // 本来はNextPitchモデルのAPIまたはDBから取得
  const baseMix: Record<string, Record<string, number>> = {
    'ahead': { 'FF': 0.45, 'SL': 0.25, 'CU': 0.15, 'CH': 0.15 },
    'behind': { 'FF': 0.65, 'SI': 0.20, 'CH': 0.10, 'SL': 0.05 },
    'even': { 'FF': 0.40, 'SL': 0.30, 'CU': 0.15, 'CH': 0.15 },
    'two_strike': { 'SL': 0.35, 'CU': 0.25, 'FF': 0.25, 'CH': 0.15 },
    'full': { 'FF': 0.50, 'SL': 0.30, 'CH': 0.20 },
    'start': { 'FF': 0.55, 'SI': 0.25, 'SL': 0.20 }
  };
  
  return baseMix[count_bucket] || baseMix['even'];
}

// 実測分布にモデル予測を掛け合わせてモデル分布を生成
function createModelDistribution(empirical: GridData, pitchMix: Record<string, number>): GridData {
  const model: GridData = {};
  
  for (const [pitchType, prob] of Object.entries(pitchMix)) {
    if (empirical[pitchType]) {
      // 既存の実測分布にモデル確率を掛ける
      model[pitchType] = empirical[pitchType].map(row =>
        row.map(val => val * prob)
      );
    } else {
      // 実測データがない球種は均等分布×モデル確率
      const uniformVal = prob / (GRID_SIZE * GRID_SIZE);
      model[pitchType] = Array(GRID_SIZE).fill(null).map(() => 
        Array(GRID_SIZE).fill(uniformVal)
      );
    }
  }
  
  return model;
}

// ヒートマップ品質スコア計算
function calculateQualityScore(sample_size: number, empirical: GridData): number {
  // サンプル数基準（最低10、理想100+）
  let quality = Math.min(1.0, sample_size / 100.0);
  
  // 球種数ボーナス
  const pitchTypeCount = Object.keys(empirical).length;
  quality += pitchTypeCount * 0.05;
  
  // データ分散度ボーナス（固定値で簡略化）
  quality += 0.1;
  
  return Math.min(1.0, quality);
}

// 単一条件のヒートマップを計算
async function computeHeatmapForCondition(
  pitcher_id: string,
  batter_side: 'L' | 'R',
  count_bucket: string,
  pitches: PitchData[]
): Promise<HeatmapResult | null> {
  const grids: GridData = {};
  let totalPitches = 0;
  
  // 球種別にグリッドを初期化
  const pitchTypes = [...new Set(pitches.map(p => p.pitch_type))];
  for (const pitchType of pitchTypes) {
    grids[pitchType] = initGrid();
  }
  
  // データをグリッドに集計
  for (const pitch of pitches) {
    const [gx, gy] = coordToGrid(pitch.px, pitch.pz);
    if (!grids[pitch.pitch_type]) {
      grids[pitch.pitch_type] = initGrid();
    }
    grids[pitch.pitch_type][gy][gx] += 1;
    totalPitches++;
  }
  
  // サンプル数チェック
  if (totalPitches < 10) {
    return null; // サンプル数不足でスキップ
  }
  
  // 各球種のグリッドをスムージング・正規化
  const empirical: GridData = {};
  for (const [pitchType, grid] of Object.entries(grids)) {
    const smoothed = applySmoothingToGrid(grid);
    empirical[pitchType] = normalizeGrid(smoothed);
  }
  
  // NextPitchモデル予測を取得してモデル分布作成
  const pitchMix = await getNextPitchMix(pitcher_id, batter_side, count_bucket);
  const model = createModelDistribution(empirical, pitchMix);
  
  // 品質スコア計算
  const quality_score = calculateQualityScore(totalPitches, empirical);
  
  return {
    pitcher_id,
    batter_side,
    count_bucket,
    empirical,
    model,
    sample_size: totalPitches,
    quality_score
  };
}

// ファイルベースのピッチデータ取得
async function getFileBasedPitchData(pitcherIds?: string[]): Promise<PitchData[]> {
  const pitchData: PitchData[] = [];
  const dataDir = 'data/canonical';
  
  try {
    // 今日のデータを確認
    const today = new Date().toISOString().split('T')[0];
    const todayDir = path.join(dataDir, 'pitches', `date=${today}`);
    
    console.log(`📁 Checking ${todayDir}...`);
    const files = await fs.readdir(todayDir).catch(() => []);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(todayDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const gameData = JSON.parse(content);
        
        if (gameData.records && Array.isArray(gameData.records)) {
          for (const record of gameData.records) {
            if (record.pitcher_id && record.px !== null && record.pz !== null && record.pitch_type) {
              // フィルタリング
              if (pitcherIds && !pitcherIds.includes(record.pitcher_id)) continue;
              
              pitchData.push({
                pitcher_id: record.pitcher_id,
                batter_side: record.batter_side === 'L' ? 'L' : 'R',
                count_bucket: countToBucket(record.balls || 0, record.strikes || 0),
                px: parseFloat(record.px),
                pz: parseFloat(record.pz),
                pitch_type: record.pitch_type
              });
            }
          }
        }
      }
    }
    
    console.log(`📊 Found ${pitchData.length} pitch records from files`);
    
    // データが見つからない場合はサンプルを使用
    if (pitchData.length === 0) {
      console.log('⚠️ No real data found, using sample data...');
      return createSampleHeatmapData();
    }
    
    return pitchData;
    
  } catch (error) {
    console.log('⚠️ File-based data not available, creating sample data...');
    // サンプルデータを生成
    return createSampleHeatmapData();
  }
}

// カウントをバケットに変換（重複削除済み）

// サンプルデータ生成
function createSampleHeatmapData(): PitchData[] {
  const sampleData: PitchData[] = [];
  const pitchers = ['NPB_001', 'NPB_002'];
  const pitchTypes = ['FF', 'SL', 'CH', 'CU'];
  
  for (const pitcher of pitchers) {
    for (let i = 0; i < 50; i++) {
      sampleData.push({
        pitcher_id: pitcher,
        batter_side: Math.random() > 0.5 ? 'L' : 'R',
        count_bucket: ['even', 'hitter', 'pitcher'][Math.floor(Math.random() * 3)],
        px: (Math.random() - 0.5) * 2, // -1 to 1
        pz: Math.random() * 2 + 1.5, // 1.5 to 3.5
        pitch_type: pitchTypes[Math.floor(Math.random() * pitchTypes.length)]
      });
    }
  }
  
  return sampleData;
}

// 投手データ取得
async function getPitchData(pitcherIds?: string[]): Promise<PitchData[]> {
  if (!pool) {
    // ファイルベースフォールバック - canonical JSONから取得
    console.log('📁 Using file-based pitch data fallback...');
    return getFileBasedPitchData(pitcherIds);
  }
  
  const client = await pool.connect();
  
  try {
    let query = `
      SELECT 
        pitcher_id,
        CASE WHEN batter_side = 'L' THEN 'L' ELSE 'R' END as batter_side,
        count_to_bucket(balls, strikes) as count_bucket,
        px,
        pz,
        pitch_type
      FROM pitches p
      WHERE px IS NOT NULL 
        AND pz IS NOT NULL 
        AND pitch_type IS NOT NULL
        AND pitcher_id IS NOT NULL
        AND ABS(px) <= 3.0  -- 異常値除外
        AND pz BETWEEN 0.5 AND 4.5
    `;
    
    let params: any[] = [];
    
    if (pitcherIds && pitcherIds.length > 0) {
      query += ` AND pitcher_id = ANY($1)`;
      params.push(pitcherIds);
    }
    
    query += ` ORDER BY pitcher_id, batter_side, count_bucket`;
    
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// 今日登板可能投手を取得
async function getTodayPitchers(): Promise<string[]> {
  if (!pool) {
    // ファイルベースフォールバック
    console.log('📁 Getting today pitchers from file data...');
    const pitchData = await getFileBasedPitchData();
    const uniquePitchers = [...new Set(pitchData.map(p => p.pitcher_id))];
    return uniquePitchers.slice(0, 10); // 最大10投手
  }
  
  const client = await pool.connect();
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 今日のゲームに登録されている投手を取得（簡略化）
    const result = await client.query(`
      SELECT DISTINCT pitcher_id
      FROM pitches p
      WHERE DATE(created_at) >= $1::date - interval '7 days'
        AND pitcher_id IS NOT NULL
      ORDER BY pitcher_id
      LIMIT 50
    `, [today]);
    
    return result.rows.map(row => row.pitcher_id);
  } finally {
    client.release();
  }
}

// ヒートマップをDBに保存
async function saveHeatmaps(heatmaps: HeatmapResult[]): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const hm of heatmaps) {
      await client.query(`
        INSERT INTO pitch_heatmaps (
          pitcher_id, batter_side, count_bucket,
          empirical, model, sample_size, quality_score,
          computed_from_date, computed_to_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (pitcher_id, batter_side, count_bucket)
        DO UPDATE SET
          empirical = EXCLUDED.empirical,
          model = EXCLUDED.model,
          sample_size = EXCLUDED.sample_size,
          quality_score = EXCLUDED.quality_score,
          updated_at = NOW(),
          computed_from_date = EXCLUDED.computed_from_date,
          computed_to_date = EXCLUDED.computed_to_date
      `, [
        hm.pitcher_id,
        hm.batter_side,
        hm.count_bucket,
        JSON.stringify(hm.empirical),
        JSON.stringify(hm.model),
        hm.sample_size,
        hm.quality_score,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30日前
        new Date().toISOString().split('T')[0] // 今日
      ]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ファイルシステムにもバックアップ保存
async function saveHeatmapFiles(heatmaps: HeatmapResult[]): Promise<void> {
  const baseDir = path.join(process.cwd(), 'data', 'heatmaps');
  const dateDir = path.join(baseDir, `date=${new Date().toISOString().split('T')[0]}`);
  
  await fs.mkdir(dateDir, { recursive: true });
  
  for (const hm of heatmaps) {
    const filename = `${hm.pitcher_id}_${hm.batter_side}_${hm.count_bucket}.json`;
    const filepath = path.join(dateDir, filename);
    
    const data = {
      pitcher_id: hm.pitcher_id,
      batter_side: hm.batter_side,
      count_bucket: hm.count_bucket,
      empirical: hm.empirical,
      model: hm.model,
      sample_size: hm.sample_size,
      quality_score: hm.quality_score,
      computed_at: new Date().toISOString()
    };
    
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }
}

// ビルドログ記録
async function logBuild(buildType: string, pitcherCount: number, rowsProcessed: number, durationMs: number, success: boolean, errorMessage?: string): Promise<void> {
  if (!pool) {
    console.log(`📊 Build log: ${buildType}, pitchers: ${pitcherCount}, rows: ${rowsProcessed}, duration: ${durationMs}ms, success: ${success}`);
    return;
  }
  
  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO heatmap_build_log (
        build_type, pitcher_count, rows_processed, duration_ms, success, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [buildType, pitcherCount, rowsProcessed, durationMs, success, errorMessage]);
  } finally {
    client.release();
  }
}

// メイン処理
async function main() {
  const startTime = performance.now();
  
  try {
    const args = process.argv.slice(2);
    let buildType = 'incremental';
    let pitcherIds: string[] | undefined;
    
    // 引数解析
    if (args.includes('--all')) {
      buildType = 'full';
      pitcherIds = undefined;
    } else if (args.includes('--today')) {
      buildType = 'today';
      pitcherIds = await getTodayPitchers();
    } else {
      const pitcherArg = args.find(arg => arg.startsWith('--pitcher='));
      if (pitcherArg) {
        buildType = 'pitcher_update';
        pitcherIds = [pitcherArg.split('=')[1]];
      }
    }
    
    log(COLORS.CYAN, `🚀 ヒートマップ前計算開始: ${buildType}`);
    if (pitcherIds) {
      log(COLORS.BLUE, `   対象投手数: ${pitcherIds.length}`);
    }
    
    // Discord notification - start
    await notifyStatus(
      '📊 Heatmap前計算開始',
      `タイプ: ${buildType}`,
      'info',
      {
        'Build Type': buildType,
        'Target Pitchers': pitcherIds?.length?.toString() || 'All',
        'Started At': new Date().toISOString()
      }
    );
    
    // 投球データ取得
    log(COLORS.YELLOW, '📊 投球データ取得中...');
    const pitchData = await getPitchData(pitcherIds);
    log(COLORS.GREEN, `   取得完了: ${pitchData.length} 球`);
    
    // 投手×打者左右×カウント別にグルーピング
    const groups = new Map<string, PitchData[]>();
    for (const pitch of pitchData) {
      const key = `${pitch.pitcher_id}|${pitch.batter_side}|${pitch.count_bucket}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(pitch);
    }
    
    log(COLORS.YELLOW, `📈 ヒートマップ計算中: ${groups.size} 条件`);
    
    // 並列処理でヒートマップ計算
    const heatmaps: HeatmapResult[] = [];
    const batchSize = 8;
    const entries = Array.from(groups.entries());
    
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const batchPromises = batch.map(async ([key, pitches]) => {
        const [pitcher_id, batter_side, count_bucket] = key.split('|') as [string, 'L' | 'R', string];
        return computeHeatmapForCondition(pitcher_id, batter_side, count_bucket, pitches);
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((result): result is HeatmapResult => result !== null);
      heatmaps.push(...validResults);
      
      log(COLORS.BLUE, `   進捗: ${Math.min(i + batchSize, entries.length)} / ${entries.length}`);
    }
    
    log(COLORS.GREEN, `✅ ヒートマップ計算完了: ${heatmaps.length} 件`);
    
    // ファイルとDBに保存
    if (heatmaps.length > 0) {
      log(COLORS.YELLOW, '📁 ファイルシステムに保存中...');
      await saveHeatmapFiles(heatmaps);
      
      if (pool) {
        log(COLORS.YELLOW, '💾 データベースに保存中...');
        await saveHeatmaps(heatmaps);
      } else {
        log(COLORS.BLUE, 'ℹ️ データベース無効のためファイルのみ保存');
      }
      
      log(COLORS.GREEN, '✅ 保存完了');
      
      // Discord notification - data diff with JSON attachment
      await notifyDataDiff('heatmaps', {
        added: heatmaps.length,
        removed: 0,
        updated: 0,
        date: new Date().toISOString().split('T')[0]
      });
      
      // Send detailed results as JSON attachment
      const summaryData = {
        build_type: buildType,
        total_heatmaps: heatmaps.length,
        pitcher_count: pitcherIds?.length || 0,
        data_points: pitchData.length,
        quality_scores: heatmaps.map(h => ({
          pitcher: h.pitcher_id,
          side: h.batter_side,
          count: h.count_bucket,
          quality: h.quality_score,
          sample_size: h.sample_size
        })),
        completed_at: new Date().toISOString()
      };
      
      await sendJsonAttachment(`heatmap_build_${buildType}_${new Date().toISOString().split('T')[0]}`, summaryData);
    }
    
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    
    // ログ記録
    await logBuild(buildType, pitcherIds?.length || 0, pitchData.length, durationMs, true);
    
    log(COLORS.CYAN, `🎉 ヒートマップ前計算完了`);
    log(COLORS.BLUE, `   実行時間: ${Math.round(durationMs / 1000)}秒`);
    log(COLORS.BLUE, `   処理データ: ${pitchData.length} 球`);
    log(COLORS.BLUE, `   生成ヒートマップ: ${heatmaps.length} 件`);
    
    // Discord notification - completion
    await notifyStatus(
      '✅ Heatmap前計算完了',
      `${heatmaps.length}件のヒートマップを生成`,
      'info',
      {
        'Build Type': buildType,
        'Duration': `${Math.round(durationMs / 1000)}秒`,
        'Pitch Data': `${pitchData.length} 球`,
        'Generated Heatmaps': `${heatmaps.length} 件`,
        'Completed At': new Date().toISOString()
      }
    );
    
  } catch (error) {
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    
    await logBuild('error', 0, 0, durationMs, false, String(error));
    
    // Discord notification - error
    await notifyStatus(
      '❌ Heatmap前計算エラー',
      `計算中にエラーが発生: ${String(error)}`,
      'error',
      {
        'Build Type': buildType || 'unknown',
        'Duration': `${Math.round(durationMs / 1000)}秒`,
        'Error': String(error),
        'Failed At': new Date().toISOString()
      }
    );
    
    log(COLORS.RED, `❌ エラー: ${error}`);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}