#!/usr/bin/env npx tsx
/**
 * 事前ウォーマー: 主要ページのプリフェッチで初回体感速度改善
 */

import { q } from "../app/lib/db";

export class CacheWarmer {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://100.88.12.26:3000';
  }

  /**
   * 起動後のプリフェッチ実行
   */
  async warmupCache(): Promise<void> {
    console.log('🔥 Starting cache warmup...');
    
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 10);
    const dayAfter = new Date(Date.now() + 2*24*60*60*1000).toISOString().slice(0, 10);
    const day3After = new Date(Date.now() + 3*24*60*60*1000).toISOString().slice(0, 10);

    const dates = [yesterday, today, tomorrow, dayAfter, day3After];
    const levels = ['NPB1', 'NPB2'];

    // 1. 主要ゲーム一覧ページ (今日±3日分)
    console.log('📅 Warming up games pages...');
    for (const date of dates) {
      for (const level of levels) {
        await this.prefetchWithRetry(`/games?level=${level}&date=${date}`, `Games ${level} ${date}`);
        await this.sleep(100); // API制限対策
      }
    }

    // 2. 当日予定の試合詳細ページ
    console.log('🎮 Warming up game detail pages...');
    await this.warmupGameDetails(today);
    
    // 3. 主要API路線
    console.log('🔌 Warming up API endpoints...');
    for (const date of dates.slice(1, 4)) { // 今日±1日のみ
      for (const level of levels) {
        await this.prefetchWithRetry(`/api/games/by-date/${date}?level=${level}`, `API ${level} ${date}`);
        await this.sleep(50);
      }
    }

    console.log('✅ Cache warmup completed!');
  }

  /**
   * 当日の試合詳細ページを事前取得
   */
  private async warmupGameDetails(date: string): Promise<void> {
    try {
      // DBから当日の試合ID一覧を取得
      const games = await q<{ game_id: string }>(`
        select game_id from games where date = $1
        union
        select game_id from schedules where date = $1
        limit 10
      `, [date]);

      for (const game of games) {
        await this.prefetchWithRetry(`/game/${game.game_id}`, `Game ${game.game_id}`);
        await this.sleep(200);
      }
      
    } catch (error) {
      console.warn('Failed to warmup game details:', error);
    }
  }

  /**
   * リトライ機能付きプリフェッチ
   */
  private async prefetchWithRetry(path: string, description: string, maxRetries = 2): Promise<void> {
    const url = `${this.baseUrl}${path}`;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const start = Date.now();
        const response = await fetch(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'CacheWarmer/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });

        const duration = Date.now() - start;
        
        if (response.ok) {
          console.log(`✅ ${description} (${response.status}, ${duration}ms)`);
          return;
        } else {
          console.log(`⚠️ ${description} (${response.status}, ${duration}ms)`);
          if (attempt <= maxRetries) {
            await this.sleep(1000 * attempt); // 指数バックオフ
            continue;
          }
        }
        
      } catch (error) {
        console.log(`❌ ${description} - ${error}`);
        if (attempt <= maxRetries) {
          await this.sleep(1000 * attempt);
          continue;
        }
      }
    }
  }

  /**
   * 定期ウォーマー（cron用）
   */
  async scheduledWarmup(): Promise<void> {
    console.log('🕐 Running scheduled warmup...');
    
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 10);
    
    // 重要ページのみを定期更新
    const priorities = [
      `/games?level=NPB2&date=${today}`,
      `/games?level=NPB1&date=${today}`,
      `/games?level=NPB2&date=${tomorrow}`,
      `/api/games/by-date/${today}?level=NPB2`,
      '/api/health'
    ];
    
    for (const path of priorities) {
      await this.prefetchWithRetry(path, `Scheduled ${path}`, 1);
      await this.sleep(200);
    }
    
    console.log('✅ Scheduled warmup completed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'warmup';
  
  const warmer = new CacheWarmer();
  
  if (command === 'warmup') {
    await warmer.warmupCache();
  } else if (command === 'scheduled') {
    await warmer.scheduledWarmup();
  } else {
    console.log('Usage: npx tsx scripts/cache-warmer.ts [warmup|scheduled]');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default CacheWarmer;