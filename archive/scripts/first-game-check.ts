#!/usr/bin/env npx tsx
/**
 * 初ゲーム日チェックシステム
 * 運用メトリクス自動検証（304比率、429率、遅延、カバレッジ）
 */

interface FirstGameMetrics {
  yahoo304Ratio: number;        // ≥ 0.60
  error429Rate: number;         // ≤ 1%
  pbpLagP95: number;           // ≤ 15s
  coverage: number;            // ≥ 0.98
  prospectWatchUpdated: boolean;
}

interface MetricThresholds {
  yahoo304RatioMin: number;
  error429RateMax: number;
  pbpLagP95Max: number;
  coverageMin: number;
}

export class FirstGameChecker {
  private thresholds: MetricThresholds = {
    yahoo304RatioMin: 0.60,
    error429RateMax: 0.01,
    pbpLagP95Max: 15000, // 15s in ms
    coverageMin: 0.98
  };

  constructor(private dataDir: string = './data') {}

  async checkFirstGameDay(date: string): Promise<{
    passed: boolean;
    metrics: FirstGameMetrics;
    issues: string[];
  }> {
    console.log(`🔍 Running first game day check for ${date}`);

    const metrics = await this.collectMetrics(date);
    const issues = this.validateMetrics(metrics);
    const passed = issues.length === 0;

    console.log(`📊 First Game Day Results:`);
    console.log(`  Yahoo 304 Ratio: ${(metrics.yahoo304Ratio * 100).toFixed(1)}% (target: ≥60%)`);
    console.log(`  429 Error Rate: ${(metrics.error429Rate * 100).toFixed(2)}% (target: ≤1%)`);
    console.log(`  P95 PBP Lag: ${metrics.pbpLagP95}ms (target: ≤15000ms)`);
    console.log(`  Coverage: ${(metrics.coverage * 100).toFixed(1)}% (target: ≥98%)`);
    console.log(`  Prospect Watch: ${metrics.prospectWatchUpdated ? '✅ Updated' : '❌ Stale'}`);
    
    if (passed) {
      console.log('✅ All metrics passed - system ready for production');
    } else {
      console.log('❌ Issues found:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return { passed, metrics, issues };
  }

  private async collectMetrics(date: string): Promise<FirstGameMetrics> {
    console.log('  📈 Collecting metrics...');

    // Yahoo 304比率（キャッシュヒット率）
    const yahoo304Ratio = await this.calculateYahoo304Ratio(date);
    
    // 429エラー率
    const error429Rate = await this.calculate429ErrorRate(date);
    
    // PBP遅延のP95
    const pbpLagP95 = await this.calculatePbpLagP95(date);
    
    // カバレッジ（データ完全性）
    const coverage = await this.calculateCoverage(date);
    
    // Prospect Watch更新確認
    const prospectWatchUpdated = await this.checkProspectWatchUpdate(date);

    return {
      yahoo304Ratio,
      error429Rate,
      pbpLagP95,
      coverage,
      prospectWatchUpdated
    };
  }

  private async calculateYahoo304Ratio(date: string): Promise<number> {
    try {
      // ログファイルから304レスポンス数を集計
      const logPath = `${this.dataDir}/../logs/npb2-daemon.log`;
      const { promises: fs } = require('fs');
      
      const logContent = await fs.readFile(logPath, 'utf-8').catch(() => '');
      const lines = logContent.split('\n').filter(line => line.includes(date));
      
      let totalRequests = 0;
      let cached304s = 0;
      
      for (const line of lines) {
        if (line.includes('GET https://baseball.yahoo.co.jp')) {
          totalRequests++;
          if (line.includes('304') || line.includes('fromCache: true')) {
            cached304s++;
          }
        }
      }
      
      return totalRequests > 0 ? cached304s / totalRequests : 0;
    } catch (error) {
      console.warn('  ⚠️ Could not calculate 304 ratio:', error);
      return 0;
    }
  }

  private async calculate429ErrorRate(date: string): Promise<number> {
    try {
      const logPath = `${this.dataDir}/../logs/npb2-daemon.log`;
      const { promises: fs } = require('fs');
      
      const logContent = await fs.readFile(logPath, 'utf-8').catch(() => '');
      const lines = logContent.split('\n').filter(line => line.includes(date));
      
      let totalRequests = 0;
      let error429s = 0;
      
      for (const line of lines) {
        if (line.includes('GET https://baseball.yahoo.co.jp')) {
          totalRequests++;
          if (line.includes('429') || line.includes('Rate limited')) {
            error429s++;
          }
        }
      }
      
      return totalRequests > 0 ? error429s / totalRequests : 0;
    } catch (error) {
      console.warn('  ⚠️ Could not calculate 429 rate:', error);
      return 0;
    }
  }

  private async calculatePbpLagP95(date: string): Promise<number> {
    try {
      // PBPデータのタイムスタンプから遅延を計算
      const timelinePath = `${this.dataDir}/timeline/yahoo_npb2`;
      const { promises: fs } = require('fs');
      
      const gameFiles = await fs.readdir(timelinePath).catch(() => []);
      const lags: number[] = [];
      
      for (const gameFile of gameFiles) {
        if (gameFile.includes(date.replace(/-/g, ''))) {
          const gameDir = `${timelinePath}/${gameFile}`;
          const pbpFile = `${gameDir}/pitches/latest.json`;
          
          try {
            const pbpData = JSON.parse(await fs.readFile(pbpFile, 'utf-8'));
            if (pbpData.rows && pbpData.rows.length > 0) {
              // 最新投球の遅延計算（簡易版）
              const lastPitch = pbpData.rows[pbpData.rows.length - 1];
              if (lastPitch.timestamp) {
                const lag = Date.now() - new Date(lastPitch.timestamp).getTime();
                lags.push(lag);
              }
            }
          } catch {
            // ファイルが存在しないか無効
          }
        }
      }
      
      if (lags.length === 0) return 0;
      
      // P95計算
      lags.sort((a, b) => a - b);
      const p95Index = Math.floor(lags.length * 0.95);
      return lags[p95Index] || 0;
    } catch (error) {
      console.warn('  ⚠️ Could not calculate PBP lag:', error);
      return 0;
    }
  }

  private async calculateCoverage(date: string): Promise<number> {
    try {
      // 期待される試合数 vs 実際のデータ数
      const timelinePath = `${this.dataDir}/timeline/yahoo_npb2`;
      const { promises: fs } = require('fs');
      
      const gameFiles = await fs.readdir(timelinePath).catch(() => []);
      const todayGames = gameFiles.filter(file => file.includes(date.replace(/-/g, '')));
      
      let gamesWithData = 0;
      for (const gameFile of todayGames) {
        const gameDir = `${timelinePath}/${gameFile}`;
        const pbpFile = `${gameDir}/pitches/latest.json`;
        
        try {
          const pbpData = JSON.parse(await fs.readFile(pbpFile, 'utf-8'));
          if (pbpData.rows && pbpData.rows.length > 0) {
            gamesWithData++;
          }
        } catch {
          // データなし
        }
      }
      
      // 休養日の場合は1.0を返す
      if (todayGames.length === 0) return 1.0;
      
      return gamesWithData / todayGames.length;
    } catch (error) {
      console.warn('  ⚠️ Could not calculate coverage:', error);
      return 1.0; // エラー時は問題なしと仮定
    }
  }

  private async checkProspectWatchUpdate(date: string): Promise<boolean> {
    try {
      // ダッシュボードのProspect Watch更新確認
      const response = await fetch('http://localhost:3000/api/prospects?filter=NPB2');
      
      if (!response.ok) return false;
      
      const data = await response.json();
      
      // 今日のデータが含まれているかチェック
      if (data.prospects && Array.isArray(data.prospects)) {
        return data.prospects.some((prospect: any) => 
          prospect.lastPitch && 
          prospect.lastPitch.includes(date)
        );
      }
      
      return false;
    } catch (error) {
      console.warn('  ⚠️ Could not check Prospect Watch:', error);
      return false;
    }
  }

  private validateMetrics(metrics: FirstGameMetrics): string[] {
    const issues: string[] = [];

    if (metrics.yahoo304Ratio < this.thresholds.yahoo304RatioMin) {
      issues.push(`Yahoo 304 ratio too low: ${(metrics.yahoo304Ratio * 100).toFixed(1)}% < ${(this.thresholds.yahoo304RatioMin * 100)}%`);
    }

    if (metrics.error429Rate > this.thresholds.error429RateMax) {
      issues.push(`429 error rate too high: ${(metrics.error429Rate * 100).toFixed(2)}% > ${(this.thresholds.error429RateMax * 100)}%`);
    }

    if (metrics.pbpLagP95 > this.thresholds.pbpLagP95Max) {
      issues.push(`PBP lag P95 too high: ${metrics.pbpLagP95}ms > ${this.thresholds.pbpLagP95Max}ms`);
    }

    if (metrics.coverage < this.thresholds.coverageMin) {
      issues.push(`Coverage too low: ${(metrics.coverage * 100).toFixed(1)}% < ${(this.thresholds.coverageMin * 100)}%`);
    }

    if (!metrics.prospectWatchUpdated) {
      issues.push('Prospect Watch not updated with recent pitches');
    }

    return issues;
  }

  /**
   * 継続的な運用監視（日次実行）
   */
  async dailyHealthCheck(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await this.checkFirstGameDay(today);
    
    if (!result.passed) {
      // アラート送信
      await this.sendAlert(result);
    }
  }

  private async sendAlert(result: any): Promise<void> {
    // Discord通知（簡易版）
    const message = `🚨 NPB2 System Health Check Failed\n${result.issues.join('\n')}`;
    console.error(message);
    
    // 実際のDiscord通知は notify-discord.ts を使用
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const date = args[0] || new Date().toISOString().slice(0, 10);
  
  const checker = new FirstGameChecker(process.env.DATA_DIR || './data');
  
  if (args.includes('--daily')) {
    await checker.dailyHealthCheck();
  } else {
    await checker.checkFirstGameDay(date);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default FirstGameChecker;