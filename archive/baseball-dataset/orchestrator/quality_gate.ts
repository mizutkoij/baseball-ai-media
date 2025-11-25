#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { DedupeRegistry } from '../registry/dedupe_registry';

export interface QualityGateConfig {
  runGoldenTests: boolean;
  runInvariants: boolean;
  qualityThreshold: number;
  notifyDiscord: boolean;
  failOpen: boolean; // true = 警告のみ、false = エラーで停止
}

export interface QualityReport {
  timestamp: string;
  totalGames: number;
  passedTests: number;
  failedTests: number;
  qualityScore: number;
  invariantViolations: string[];
  recommendations: string[];
  status: 'PASS' | 'WARN' | 'FAIL';
}

export class QualityGate {
  private registry: DedupeRegistry;
  private config: QualityGateConfig;
  
  constructor(config: Partial<QualityGateConfig> = {}) {
    this.config = {
      runGoldenTests: true,
      runInvariants: true,
      qualityThreshold: 70,
      notifyDiscord: false,
      failOpen: true,
      ...config
    };
    this.registry = new DedupeRegistry();
  }
  
  /**
   * 品質ゲートを実行
   */
  async runQualityGate(): Promise<QualityReport> {
    const report: QualityReport = {
      timestamp: new Date().toISOString(),
      totalGames: 0,
      passedTests: 0,
      failedTests: 0,
      qualityScore: 0,
      invariantViolations: [],
      recommendations: [],
      status: 'PASS'
    };
    
    console.log('🔍 Starting Quality Gate...');
    
    try {
      // レジストリ統計を取得
      const stats = this.registry.getStats();
      report.totalGames = stats.totalGames;
      report.qualityScore = stats.averageQuality;
      
      console.log(`📊 Registry Stats: ${stats.totalGames} games, avg quality: ${stats.averageQuality}%`);
      
      // 1. ゴールデンテスト実行
      if (this.config.runGoldenTests) {
        const goldenResults = await this.runGoldenTests();
        report.passedTests += goldenResults.passed;
        report.failedTests += goldenResults.failed;
        
        if (goldenResults.failed > 0) {
          report.status = 'WARN';
          report.recommendations.push(`${goldenResults.failed} golden tests failed - check sample data quality`);
        }
      }
      
      // 2. データ不変条件チェック
      if (this.config.runInvariants) {
        const invariantResults = await this.runInvariantChecks();
        report.invariantViolations = invariantResults.violations;
        
        if (invariantResults.violations.length > 0) {
          report.status = 'WARN';
          report.recommendations.push('Data invariant violations detected - review data integrity');
        }
      }
      
      // 3. 品質スコアチェック
      if (report.qualityScore < this.config.qualityThreshold) {
        report.status = 'FAIL';
        report.recommendations.push(`Average quality score (${report.qualityScore}%) below threshold (${this.config.qualityThreshold}%)`);
      }
      
      // 4. 低品質ゲームの特定
      const lowQualityGames = this.registry.getLowQualityGames(this.config.qualityThreshold);
      if (lowQualityGames.length > 0) {
        report.recommendations.push(`${lowQualityGames.length} games below quality threshold`);
        
        // 詳細ログ
        console.log(`🟡 Low Quality Games (${lowQualityGames.length}):`);
        for (const game of lowQualityGames.slice(0, 5)) { // 最初の5件のみ表示
          console.log(`   ${game.canonicalGameId}: score=${game.qualityScore}%, issues=${game.issues}`);
        }
        if (lowQualityGames.length > 5) {
          console.log(`   ... and ${lowQualityGames.length - 5} more`);
        }
      }
      
      // 5. 重複率チェック
      if (stats.duplicateRate > 5.0) {
        report.status = 'WARN';
        report.recommendations.push(`High duplicate rate: ${stats.duplicateRate}%`);
      }
      
      // 6. 最終判定
      if (report.status === 'FAIL' && !this.config.failOpen) {
        throw new Error('Quality gate failed - see report for details');
      }
      
      console.log(`${this.getStatusEmoji(report.status)} Quality Gate ${report.status}: ${report.passedTests}/${report.passedTests + report.failedTests} tests passed`);
      
      // レポート保存
      this.saveQualityReport(report);
      
      // Discord通知
      if (this.config.notifyDiscord && (report.status === 'WARN' || report.status === 'FAIL')) {
        await this.notifyDiscord(report);
      }
      
    } catch (error) {
      report.status = 'FAIL';
      report.recommendations.push(`Quality gate execution failed: ${error}`);
      console.error('❌ Quality Gate failed:', error);
      
      if (!this.config.failOpen) {
        throw error;
      }
    }
    
    return report;
  }
  
  /**
   * ゴールデンテストを実行
   */
  private async runGoldenTests(): Promise<{ passed: number; failed: number }> {
    console.log('🧪 Running golden tests...');
    
    try {
      // 既存のテストコマンドを実行
      const output = execSync('npm run test:golden 2>&1', { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '../..'),
        timeout: 60000 // 1分タイムアウト
      });
      
      // テスト結果を解析
      const passedMatch = output.match(/(\d+) passed/);
      const failedMatch = output.match(/(\d+) failed/);
      
      const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      
      console.log(`✅ Golden tests: ${passed} passed, ${failed} failed`);
      
      return { passed, failed };
      
    } catch (error: any) {
      console.warn('⚠️ Golden tests failed to run:', error.message);
      
      // エラー出力からテスト結果を抽出を試行
      const errorOutput = error.stdout || error.stderr || '';
      const failedMatch = errorOutput.match(/(\d+) failed/);
      const passed = 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 1;
      
      return { passed, failed };
    }
  }
  
  /**
   * データ不変条件をチェック
   */
  private async runInvariantChecks(): Promise<{ violations: string[] }> {
    console.log('🔍 Checking data invariants...');
    
    const violations: string[] = [];
    
    try {
      // 1. スコア整合性チェック
      const games = this.registry.getGamesByDateRange(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10)
      );
      
      for (const game of games) {
        // ゲームデータファイルが存在するかチェック
        const gameDir = path.join(__dirname, '../data/games', game.canonicalGameId);
        const metaPath = path.join(gameDir, 'meta.json');
        const boxPath = path.join(gameDir, 'box.json');
        
        if (!existsSync(metaPath)) {
          violations.push(`Missing meta.json for ${game.canonicalGameId}`);
        }
        
        // ボックススコアの整合性チェック
        if (existsSync(boxPath)) {
          try {
            const boxData = require(boxPath);
            
            // 基本的な整合性チェック
            if (boxData.teams?.home?.runs < 0 || boxData.teams?.away?.runs < 0) {
              violations.push(`Negative runs in ${game.canonicalGameId}`);
            }
            
            if (boxData.teams?.home?.hits < 0 || boxData.teams?.away?.hits < 0) {
              violations.push(`Negative hits in ${game.canonicalGameId}`);
            }
            
            // 選手データの整合性
            const homePlayers = boxData.players?.home?.length || 0;
            const awayPlayers = boxData.players?.away?.length || 0;
            
            if (homePlayers > 0 && homePlayers < 9) {
              violations.push(`Insufficient home players (${homePlayers}) in ${game.canonicalGameId}`);
            }
            
            if (awayPlayers > 0 && awayPlayers < 9) {
              violations.push(`Insufficient away players (${awayPlayers}) in ${game.canonicalGameId}`);
            }
            
          } catch (error) {
            violations.push(`Invalid JSON in box.json for ${game.canonicalGameId}`);
          }
        }
      }
      
      // 2. 重複ゲームチェック
      if (games.length > 0) {
        const gamesByDate = games.reduce((acc, game) => {
          acc[game.dateISO] = (acc[game.dateISO] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        for (const [date, count] of Object.entries(gamesByDate)) {
          if (count > 12) { // NPBの1日最大試合数（セ6+パ6）を超える
            violations.push(`Excessive games on ${date}: ${count} (expected ≤12)`);
          }
        }
      }
      
      // 3. データ品質分布チェック
      const lowQualityCount = this.registry.getLowQualityGames(50).length;
      const totalGames = this.registry.getStats().totalGames;
      
      if (totalGames > 0 && (lowQualityCount / totalGames) > 0.1) {
        violations.push(`High proportion of low-quality games: ${lowQualityCount}/${totalGames} (${Math.round(lowQualityCount/totalGames*100)}%)`);
      }
      
    } catch (error) {
      violations.push(`Invariant check failed: ${error}`);
    }
    
    if (violations.length > 0) {
      console.log(`⚠️ Found ${violations.length} invariant violations`);
      violations.slice(0, 3).forEach(v => console.log(`   ${v}`));
      if (violations.length > 3) {
        console.log(`   ... and ${violations.length - 3} more`);
      }
    } else {
      console.log('✅ All invariants satisfied');
    }
    
    return { violations };
  }
  
  /**
   * Discord通知を送信
   */
  private async notifyDiscord(report: QualityReport): Promise<void> {
    try {
      // 既存のDiscord通知システムを利用
      const { notifyDiscord } = await import('../../lib/discord-notifier');
      
      const message = this.formatDiscordMessage(report);
      await notifyDiscord(message);
      
    } catch (error) {
      console.warn('⚠️ Failed to send Discord notification:', error);
    }
  }
  
  /**
   * Discord用メッセージフォーマット
   */
  private formatDiscordMessage(report: QualityReport): string {
    const emoji = this.getStatusEmoji(report.status);
    const lines = [
      `${emoji} **Quality Gate ${report.status}**`,
      `📊 ${report.totalGames} games, avg quality: ${report.qualityScore.toFixed(1)}%`,
      `🧪 Tests: ${report.passedTests} passed, ${report.failedTests} failed`
    ];
    
    if (report.invariantViolations.length > 0) {
      lines.push(`⚠️ ${report.invariantViolations.length} invariant violations`);
    }
    
    if (report.recommendations.length > 0) {
      lines.push('**Recommendations:**');
      report.recommendations.slice(0, 3).forEach(rec => lines.push(`• ${rec}`));
    }
    
    return lines.join('\n');
  }
  
  /**
   * ステータス絵文字を取得
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'PASS': return '✅';
      case 'WARN': return '⚠️';
      case 'FAIL': return '❌';
      default: return '❓';
    }
  }
  
  /**
   * 品質レポートを保存
   */
  private saveQualityReport(report: QualityReport): void {
    const reportDir = path.join(__dirname, '../../.reports/quality');
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().slice(0, 10);
    const reportPath = path.join(reportDir, `quality-${timestamp}.json`);
    
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📝 Quality report saved: ${reportPath}`);
  }
  
  /**
   * リソースクリーンアップ
   */
  cleanup(): void {
    this.registry.close();
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const config: Partial<QualityGateConfig> = {
    runGoldenTests: !args.includes('--no-golden'),
    runInvariants: !args.includes('--no-invariants'),
    qualityThreshold: parseInt(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1] || '70'),
    notifyDiscord: args.includes('--notify'),
    failOpen: !args.includes('--fail-fast')
  };
  
  const gate = new QualityGate(config);
  
  try {
    const report = await gate.runQualityGate();
    
    console.log(`\n${gate.getStatusEmoji(report.status)} Quality Gate Result: ${report.status}`);
    console.log(`📊 Summary: ${report.totalGames} games, ${report.qualityScore.toFixed(1)}% avg quality`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }
    
    // 終了コード設定（CI/CD用）
    process.exit(report.status === 'FAIL' && !config.failOpen ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Quality gate execution failed:', error);
    process.exit(1);
  } finally {
    gate.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}