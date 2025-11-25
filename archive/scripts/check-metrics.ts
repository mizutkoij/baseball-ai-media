#!/usr/bin/env npx tsx
/**
 * 運用メトリクス確認スクリプト
 * 304比率、429レート、投球データ増加をチェック
 */

import { promises as fs } from 'fs';
import * as path from 'path';

interface MetricsResult {
  yahoo304Ratio: number;
  yahoo429Count: number;
  pitchIngestedTotal: number;
  timestamp: string;
  status: 'pass' | 'warning' | 'fail';
  issues: string[];
}

async function checkOperationalMetrics(): Promise<MetricsResult> {
  const result: MetricsResult = {
    yahoo304Ratio: 0,
    yahoo429Count: 0,
    pitchIngestedTotal: 0,
    timestamp: new Date().toISOString(),
    status: 'pass',
    issues: []
  };

  try {
    // メトリクスファイルから読み取り（実際の環境では prometheus endpointから）
    const metricsFiles = [
      'data/metrics/yahoo-metrics.json',
      'data/timeline/stats.json'
    ];
    
    for (const file of metricsFiles) {
      if (await fileExists(file)) {
        const content = await fs.readFile(file, 'utf-8');
        const metrics = JSON.parse(content);
        
        // 304比率確認
        if (metrics.yahoo304Ratio !== undefined) {
          result.yahoo304Ratio = metrics.yahoo304Ratio;
          if (result.yahoo304Ratio < 0.6) {
            result.issues.push(`304比率が低い: ${result.yahoo304Ratio.toFixed(2)} < 0.6`);
            result.status = 'warning';
          }
        }
        
        // 429エラー確認
        if (metrics.yahoo429Count !== undefined) {
          result.yahoo429Count = metrics.yahoo429Count;
          if (result.yahoo429Count > 10) { // 1%相当
            result.issues.push(`429エラーが多い: ${result.yahoo429Count}`);
            result.status = 'warning';
          }
        }
        
        // 投球データ確認
        if (metrics.pitchIngestedTotal !== undefined) {
          result.pitchIngestedTotal = metrics.pitchIngestedTotal;
        }
      }
    }
    
    // タイムラインファイルから直近活動確認
    const timelineDirs = ['data/timeline/yahoo_npb1', 'data/timeline/yahoo_npb2'];
    let recentActivity = false;
    
    for (const dir of timelineDirs) {
      if (await dirExists(dir)) {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.endsWith('_timeline.jsonl')) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            const ageMs = Date.now() - stat.mtime.getTime();
            
            if (ageMs < 3600000) { // 1時間以内
              recentActivity = true;
              
              // ファイルサイズから投球数概算
              const lines = (await fs.readFile(filePath, 'utf-8')).split('\n').length;
              result.pitchIngestedTotal += lines;
            }
          }
        }
      }
    }
    
    if (!recentActivity) {
      result.issues.push('過去1時間の活動なし');
      result.status = 'warning';
    }
    
    if (result.issues.length > 2) {
      result.status = 'fail';
    }
    
  } catch (error) {
    result.issues.push(`メトリクス読み取りエラー: ${error}`);
    result.status = 'fail';
  }

  return result;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔍 運用メトリクス確認中...');
  
  const result = await checkOperationalMetrics();
  
  console.log('\n📊 メトリクス結果:');
  console.log(`ステータス: ${result.status.toUpperCase()}`);
  console.log(`304比率: ${result.yahoo304Ratio.toFixed(3)} (合格: ≥0.6)`);
  console.log(`429エラー: ${result.yahoo429Count} (合格: ≤10)`);
  console.log(`投球データ: ${result.pitchIngestedTotal}件`);
  console.log(`確認時刻: ${result.timestamp}`);
  
  if (result.issues.length > 0) {
    console.log('\n⚠️ 検出された問題:');
    result.issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  // 運用アラート判定
  if (result.status === 'fail') {
    console.log('\n🚨 即座に対応が必要です');
    process.exit(1);
  } else if (result.status === 'warning') {
    console.log('\n⚠️ 監視を強化してください');
    process.exit(0);
  } else {
    console.log('\n✅ すべて正常');
  }
  
  // Discord通知（1行サマリ）
  const statusEmoji = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
  const summaryMessage = `${statusEmoji} NPBファーム監視: ${result.status.toUpperCase()} - 投球${result.pitchIngestedTotal}件, 304比率${result.yahoo304Ratio.toFixed(2)}`;
  
  try {
    const { execSync } = require('child_process');
    execSync(`npx tsx scripts/notify-discord.ts --alert "監視サマリ" "${summaryMessage}" info`);
    console.log('📱 Discord通知送信済み');
  } catch (error) {
    console.log('📱 Discord通知スキップ（環境未設定）');
  }
  
  process.exit(result.status === 'fail' ? 1 : 0);
}

if (require.main === module) {
  main().catch(console.error);
}