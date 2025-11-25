#!/usr/bin/env npx tsx
/**
 * Discord通知システム
 * 本番環境でのシステム状態・アラートを通知
 */

import { promises as fs } from 'fs';

interface DiscordMessage {
  content?: string;
  embeds?: Array<{
    title: string;
    description?: string;
    color: number;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
    timestamp?: string;
    footer?: {
      text: string;
    };
  }>;
}

class DiscordNotifier {
  private webhookUrl: string;
  
  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || 
      process.env.WEBHOOK_DISCORD_URL || 
      'https://discord.com/api/webhooks/1405095686776688650/kD5MDFn9x6xscV8Gg5_vrUO8K-9-eaToPmPZtLM3un-E_acj2BNi-k9xxWka_5NPxd-M';
  }
  
  async sendMessage(message: DiscordMessage): Promise<boolean> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
      });
      
      return response.ok;
    } catch (error) {
      console.error('Discord通知失敗:', error);
      return false;
    }
  }
  
  async notifySystemStart(): Promise<boolean> {
    const message: DiscordMessage = {
      embeds: [{
        title: '🚀 NPBファーム収集システム開始',
        description: '本番環境でのデータ収集を開始しました',
        color: 0x00ff00, // Green
        fields: [
          { name: 'サーバー', value: '100.88.12.26', inline: true },
          { name: 'モード', value: 'NPB2ファームのみ', inline: true },
          { name: 'レート制限', value: '30秒間隔', inline: true }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'baseball-ai-media システム' }
      }]
    };
    
    return await this.sendMessage(message);
  }
  
  async notifySystemStop(reason?: string): Promise<boolean> {
    const message: DiscordMessage = {
      embeds: [{
        title: '🛑 NPBファーム収集システム停止',
        description: reason || '収集システムが停止しました',
        color: 0xff0000, // Red
        timestamp: new Date().toISOString(),
        footer: { text: 'baseball-ai-media システム' }
      }]
    };
    
    return await this.sendMessage(message);
  }
  
  async notifyAlert(alertType: string, details: string, severity: 'info' | 'warning' | 'critical' = 'warning'): Promise<boolean> {
    const colors = {
      info: 0x0099ff,     // Blue
      warning: 0xffaa00,   // Orange  
      critical: 0xff0000   // Red
    };
    
    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨'
    };
    
    const message: DiscordMessage = {
      embeds: [{
        title: `${icons[severity]} ${alertType}`,
        description: details,
        color: colors[severity],
        timestamp: new Date().toISOString(),
        footer: { text: `baseball-ai-media ${severity.toUpperCase()}` }
      }]
    };
    
    return await this.sendMessage(message);
  }
  
  async notifyDailyReport(stats: {
    totalPitches: number;
    gamesProcessed: number;
    averageVelocity: number;
    dataQuality: number;
    uptime: string;
  }): Promise<boolean> {
    const message: DiscordMessage = {
      embeds: [{
        title: '📊 NPBファーム収集日次レポート',
        color: 0x0099ff,
        fields: [
          { name: '投球データ', value: `${stats.totalPitches.toLocaleString()}球`, inline: true },
          { name: '試合数', value: `${stats.gamesProcessed}試合`, inline: true },
          { name: '平均球速', value: `${stats.averageVelocity.toFixed(1)}km/h`, inline: true },
          { name: 'データ品質', value: `${stats.dataQuality}%`, inline: true },
          { name: '稼働時間', value: stats.uptime, inline: true },
          { name: 'ダッシュボード', value: '[NPB2タブ](http://100.88.12.26:3000?filter=NPB2)', inline: true }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: '毎日9時に自動送信' }
      }]
    };
    
    return await this.sendMessage(message);
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const notifier = new DiscordNotifier();
  
  if (args.includes('--help')) {
    console.log(`
Discord通知 使用方法:
  npx tsx scripts/notify-discord.ts --start          # システム開始通知
  npx tsx scripts/notify-discord.ts --stop [reason]  # システム停止通知
  npx tsx scripts/notify-discord.ts --alert <type> <details> [severity]  # アラート通知
  npx tsx scripts/notify-discord.ts --daily-report   # 日次レポート通知
  npx tsx scripts/notify-discord.ts --test           # テスト通知

環境変数:
  WEBHOOK_DISCORD_URL=https://discord.com/api/webhooks/...
    `);
    return;
  }
  
  try {
    if (args.includes('--start')) {
      const success = await notifier.notifySystemStart();
      console.log(`システム開始通知: ${success ? '✅' : '❌'}`);
      
    } else if (args.includes('--stop')) {
      const reason = args[args.indexOf('--stop') + 1];
      const success = await notifier.notifySystemStop(reason);
      console.log(`システム停止通知: ${success ? '✅' : '❌'}`);
      
    } else if (args.includes('--alert')) {
      const alertIndex = args.indexOf('--alert');
      const type = args[alertIndex + 1] || 'Unknown';
      const details = args[alertIndex + 2] || 'No details provided';
      const severity = (args[alertIndex + 3] as any) || 'warning';
      
      const success = await notifier.notifyAlert(type, details, severity);
      console.log(`アラート通知: ${success ? '✅' : '❌'}`);
      
    } else if (args.includes('--daily-report')) {
      // モックデータ（実際は各種メトリクスから取得）
      const stats = {
        totalPitches: 15647,
        gamesProcessed: 12,
        averageVelocity: 140.2,
        dataQuality: 94,
        uptime: '23h 45m'
      };
      
      const success = await notifier.notifyDailyReport(stats);
      console.log(`日次レポート通知: ${success ? '✅' : '❌'}`);
      
    } else if (args.includes('--test')) {
      const success = await notifier.sendMessage({
        content: '🧪 NPBファームシステム テスト通知 - 100.88.12.26から送信'
      });
      console.log(`テスト通知: ${success ? '✅' : '❌'}`);
      
    } else {
      console.log('使用方法: --help で詳細を確認してください');
    }
    
  } catch (error) {
    console.error('Discord通知エラー:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}