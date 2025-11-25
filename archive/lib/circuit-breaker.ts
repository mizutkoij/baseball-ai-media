/**
 * HTTP Circuit Breaker - 微障害で踏み抜かない保護システム
 * 
 * 状態遷移:
 * - closed: 正常動作、失敗カウント
 * - open: 障害時、すべてのリクエストを即座に拒否
 * - half: 復旧テスト中、1リクエストのみ許可
 */

import { notifyCircuitBreaker, notifyError } from './discord-notifier';

export type CBState = 'closed' | 'open' | 'half';

export interface CircuitBreakerOptions {
  threshold: number;        // 失敗回数しきい値
  cooldownMs: number;      // オープン状態の継続時間
  successThreshold?: number; // half→closedに必要な成功回数
}

export class CircuitBreaker {
  private failCount = 0;
  private state: CBState = 'closed';
  private openedAt = 0;
  private successCount = 0;

  constructor(private opts: CircuitBreakerOptions = {
    threshold: 5,
    cooldownMs: 30_000,
    successThreshold: 2
  }) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    // オープン状態：クールダウン期間中はすべて拒否
    if (this.state === 'open' && Date.now() - this.openedAt < this.opts.cooldownMs) {
      throw new Error('CB_OPEN: Circuit breaker is open');
    }

    // オープン→ハーフ状態移行（クールダウン期間経過）
    if (this.state === 'open' && Date.now() - this.openedAt >= this.opts.cooldownMs) {
      this.state = 'half';
      this.successCount = 0;
    }

    // ハーフ状態：1リクエストのみ許可
    if (this.state === 'half' && this.successCount > 0) {
      throw new Error('CB_HALF: Circuit breaker is testing, please wait');
    }

    try {
      const result = await fn();

      // 成功時の処理
      if (this.state === 'closed') {
        this.failCount = 0;
      } else if (this.state === 'half') {
        this.successCount++;
        if (this.successCount >= (this.opts.successThreshold || 2)) {
          this.state = 'closed';
          this.failCount = 0;
          
          // Discord通知: サーキットブレーカークローズ（復旧）
          notifyCircuitBreaker('HTTP Client', 'closed');
        }
      }

      return result;
    } catch (error) {
      // 失敗時の処理
      if (this.state === 'closed') {
        this.failCount++;
        if (this.failCount >= this.opts.threshold) {
          this.state = 'open';
          this.openedAt = Date.now();
          
          // Discord通知: サーキットブレーカーオープン
          notifyCircuitBreaker('HTTP Client', 'opened', this.failCount);
        }
      } else if (this.state === 'half') {
        this.state = 'open';
        this.openedAt = Date.now();
        this.failCount = this.opts.threshold; // リセット
      }

      throw error;
    }
  }

  getState(): { state: CBState; failCount: number; openedAt: number } {
    return {
      state: this.state,
      failCount: this.failCount,
      openedAt: this.openedAt,
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failCount = 0;
    this.successCount = 0;
    this.openedAt = 0;
  }
}

// NPB専用サーキットブレーカー（シングルトン）
export const npbCircuitBreaker = new CircuitBreaker({
  threshold: 3,           // NPBサイトは敏感なので少なめ
  cooldownMs: 60_000,     // 1分待機
  successThreshold: 1     // 1回成功で復旧
});