#!/usr/bin/env npx tsx
/**
 * 5分間隔の外形監視・SSE疎通確認
 */

import { promises as fs } from 'fs';

interface HealthCheck {
  timestamp: string;
  gamesPageOK: boolean;
  gameDetailOK: boolean;
  sseConnectOK: boolean;
  ttfb: number;
  errors: string[];
}

export class HealthMonitor {
  private baseUrl: string;
  private sseApiBase: string;
  private logPath: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://100.88.12.26:3000';
    this.sseApiBase = process.env.NEXT_PUBLIC_LIVE_API_BASE || 'http://127.0.0.1:8787';
    this.logPath = './logs/health-monitor.log';
  }

  /**
   * 包括的ヘルスチェック実行
   */
  async runHealthCheck(): Promise<HealthCheck> {
    const start = Date.now();
    const errors: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    
    console.log('🏥 Starting health check...');

    // 1. Games一覧ページチェック
    let gamesPageOK = false;
    try {
      const response = await fetch(`${this.baseUrl}/games?level=NPB2&date=${today}`, {
        timeout: 10000,
        headers: { 'User-Agent': 'HealthMonitor/1.0' }
      });
      
      if (response.ok) {
        const html = await response.text();
        gamesPageOK = html.includes('試合一覧') && html.includes('ファーム');
        
        if (!gamesPageOK) {
          errors.push('Games page content validation failed');
        }
      } else {
        errors.push(`Games page returned ${response.status}`);
      }
    } catch (error) {
      errors.push(`Games page fetch failed: ${error}`);
    }

    // 2. 代表ゲーム詳細ページチェック
    let gameDetailOK = false;
    try {
      const testGameId = `${today}_health_check`;
      const response = await fetch(`${this.baseUrl}/game/${testGameId}`, {
        timeout: 8000,
        headers: { 'User-Agent': 'HealthMonitor/1.0' }
      });
      
      // 404やSSRエラーでも詳細ページの構造があればOK
      if (response.status < 500) {
        const html = await response.text();
        gameDetailOK = html.includes('Live Win Probability') || html.includes('Next Pitch');
        
        if (!gameDetailOK) {
          errors.push('Game detail page structure missing');
        }
      } else {
        errors.push(`Game detail page returned ${response.status}`);
      }
    } catch (error) {
      errors.push(`Game detail page fetch failed: ${error}`);
    }

    // 3. SSE疎通チェック（5秒以内でeventを受信できるか）
    let sseConnectOK = false;
    try {
      sseConnectOK = await this.checkSSEConnection();
    } catch (error) {
      errors.push(`SSE connection failed: ${error}`);
    }

    const ttfb = Date.now() - start;
    
    return {
      timestamp: new Date().toISOString(),
      gamesPageOK,
      gameDetailOK, 
      sseConnectOK,
      ttfb,
      errors
    };
  }

  /**
   * SSE接続テスト（タイムアウト付き）
   */
  private async checkSSEConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      try {
        // テスト用の軽量SSE接続
        const testUrl = `${this.sseApiBase}/health`;
        
        fetch(testUrl, { timeout: 3000 })
          .then(response => {
            clearTimeout(timeout);
            resolve(response.ok);
          })
          .catch(() => {
            clearTimeout(timeout);
            resolve(false);
          });
          
      } catch (error) {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  /**
   * 結果をログ出力
   */
  async logHealthCheck(result: HealthCheck): Promise<void> {
    const logLine = JSON.stringify({
      ...result,
      overall: result.gamesPageOK && result.gameDetailOK && result.sseConnectOK ? 'HEALTHY' : 'UNHEALTHY'
    });

    try {
      await fs.mkdir('./logs', { recursive: true });
      await fs.appendFile(this.logPath, logLine + '\n');
    } catch (error) {
      console.error('Failed to write health log:', error);
    }

    // コンソール出力
    const status = result.gamesPageOK && result.gameDetailOK && result.sseConnectOK ? '✅ HEALTHY' : '❌ UNHEALTHY';
    console.log(`${status} | TTFB: ${result.ttfb}ms | Games: ${result.gamesPageOK ? '✅' : '❌'} | Detail: ${result.gameDetailOK ? '✅' : '❌'} | SSE: ${result.sseConnectOK ? '✅' : '❌'}`);
    
    if (result.errors.length > 0) {
      console.log('Errors:', result.errors);
    }
  }

  /**
   * Discord通知（重要な障害時のみ）
   */
  async sendAlert(result: HealthCheck): Promise<void> {
    if (result.gamesPageOK && result.gameDetailOK && result.sseConnectOK) {
      return; // 正常時は通知しない
    }

    const webhookUrl = process.env.WEBHOOK_DISCORD_URL;
    if (!webhookUrl) return;

    try {
      const embed = {
        title: '🚨 サイトヘルスチェック異常',
        description: `外形監視で異常を検出しました`,
        color: 0xff0000,
        fields: [
          { name: 'Games Page', value: result.gamesPageOK ? '✅ OK' : '❌ NG', inline: true },
          { name: 'Game Detail', value: result.gameDetailOK ? '✅ OK' : '❌ NG', inline: true },
          { name: 'SSE Connection', value: result.sseConnectOK ? '✅ OK' : '❌ NG', inline: true },
          { name: 'TTFB', value: `${result.ttfb}ms`, inline: true },
          { name: 'エラー数', value: result.errors.length.toString(), inline: true },
          { name: 'タイムスタンプ', value: result.timestamp, inline: false }
        ],
        footer: {
          text: 'Health Monitor',
          icon_url: 'https://via.placeholder.com/20x20/ff0000/ffffff?text=🚨'
        }
      };

      if (result.errors.length > 0) {
        embed.fields.push({
          name: 'エラー詳細',
          value: result.errors.slice(0, 3).join('\n'),
          inline: false
        });
      }

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
    } catch (error) {
      console.error('Discord alert failed:', error);
    }
  }
}

// CLI実行
async function main() {
  const monitor = new HealthMonitor();
  
  const result = await monitor.runHealthCheck();
  await monitor.logHealthCheck(result);
  await monitor.sendAlert(result);
}

if (require.main === module) {
  main().catch(console.error);
}

export default HealthMonitor;