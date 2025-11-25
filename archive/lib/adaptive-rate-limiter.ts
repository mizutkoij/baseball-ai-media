/**
 * Adaptive Rate Limiter - 適応的レート制限システム
 * 
 * 機能:
 * - 429エラー検知による自動QPS調整
 * - ドメイン別レート制限管理
 * - 指数バックオフ＋ジッター
 * - サーキットブレーカー連携
 */

import { logger } from './logger';
import { incrementCounter, recordHistogram } from './prometheus-metrics';

interface DomainConfig {
  domain: string;
  initialQps: number;
  minQps: number;
  maxQps: number;
  backoffMultiplier: number;
  recoveryMultiplier: number;
  circuitBreakerThreshold: number;
}

interface RequestAttempt {
  timestamp: number;
  status: number;
  duration: number;
  rateLimited: boolean;
}

interface DomainState {
  config: DomainConfig;
  currentQps: number;
  requestHistory: RequestAttempt[];
  lastRequest: number;
  consecutiveErrors: number;
  rateLimitedSince?: number;
  circuitBreakerOpen: boolean;
  lastBackoffIncrease: number;
  adaptationScore: number; // 0-1 の学習スコア
}

export class AdaptiveRateLimiter {
  private domains = new Map<string, DomainState>();
  private globalEnabled = true;
  
  // デフォルト設定
  private readonly defaultConfig: Omit<DomainConfig, 'domain'> = {
    initialQps: 1.0,
    minQps: 0.1,
    maxQps: 5.0,
    backoffMultiplier: 0.5,
    recoveryMultiplier: 1.2,
    circuitBreakerThreshold: 5
  };

  constructor() {
    this.initializeKnownDomains();
  }

  private initializeKnownDomains() {
    // NPB公式サイト（保守的）
    this.configureDomain('npb.jp', {
      initialQps: 0.5,  // 2秒間隔
      minQps: 0.1,      // 最小10秒間隔
      maxQps: 2.0,      // 最大0.5秒間隔
      backoffMultiplier: 0.3,
      recoveryMultiplier: 1.1,
      circuitBreakerThreshold: 3
    });

    // BaseballData（やや積極的）
    this.configureDomain('baseballdata.jp', {
      initialQps: 1.0,
      minQps: 0.2,
      maxQps: 3.0,
      backoffMultiplier: 0.5,
      recoveryMultiplier: 1.3,
      circuitBreakerThreshold: 5
    });
  }

  /**
   * ドメイン設定
   */
  configureDomain(domain: string, config: Partial<Omit<DomainConfig, 'domain'>>): void {
    const fullConfig: DomainConfig = {
      domain,
      ...this.defaultConfig,
      ...config
    };

    const existingState = this.domains.get(domain);
    
    this.domains.set(domain, {
      config: fullConfig,
      currentQps: existingState?.currentQps ?? fullConfig.initialQps,
      requestHistory: existingState?.requestHistory ?? [],
      lastRequest: existingState?.lastRequest ?? 0,
      consecutiveErrors: existingState?.consecutiveErrors ?? 0,
      circuitBreakerOpen: existingState?.circuitBreakerOpen ?? false,
      lastBackoffIncrease: existingState?.lastBackoffIncrease ?? 0,
      adaptationScore: existingState?.adaptationScore ?? 0.5
    });

    logger.info('Domain configuration updated', {
      domain,
      config: fullConfig
    });
  }

  /**
   * リクエスト前の遅延制御
   */
  async waitForPermission(url: string): Promise<void> {
    if (!this.globalEnabled) {
      return;
    }

    const domain = this.extractDomain(url);
    const state = this.getOrCreateDomainState(domain);

    // サーキットブレーカーチェック
    if (state.circuitBreakerOpen) {
      const backoffDuration = this.calculateCircuitBreakerBackoff(state);
      
      if (Date.now() - (state.rateLimitedSince || 0) < backoffDuration) {
        logger.debug('Circuit breaker open, blocking request', {
          domain,
          backoffRemaining: backoffDuration - (Date.now() - (state.rateLimitedSince || 0))
        });
        
        throw new Error(`Circuit breaker open for ${domain}`);
      } else {
        // 半開状態に移行
        logger.info('Circuit breaker transitioning to half-open', { domain });
        state.circuitBreakerOpen = false;
        state.consecutiveErrors = 0;
      }
    }

    // QPS制限による遅延
    const timeSinceLastRequest = Date.now() - state.lastRequest;
    const requiredInterval = 1000 / state.currentQps;
    
    if (timeSinceLastRequest < requiredInterval) {
      const delay = requiredInterval - timeSinceLastRequest;
      const jitter = Math.random() * 0.1 * delay; // 10%のジッター
      const totalDelay = delay + jitter;
      
      logger.debug('Rate limit delay applied', {
        domain,
        delay: totalDelay,
        currentQps: state.currentQps
      });
      
      recordHistogram('rate_limiter_delay_seconds', totalDelay / 1000, {
        domain
      });
      
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }

    state.lastRequest = Date.now();
  }

  /**
   * リクエスト後の結果記録・QPS調整
   */
  recordRequestResult(url: string, status: number, duration: number): void {
    if (!this.globalEnabled) {
      return;
    }

    const domain = this.extractDomain(url);
    const state = this.getOrCreateDomainState(domain);
    const rateLimited = this.isRateLimitStatus(status);

    // リクエスト履歴に記録
    const attempt: RequestAttempt = {
      timestamp: Date.now(),
      status,
      duration,
      rateLimited
    };

    state.requestHistory.push(attempt);
    
    // 履歴サイズ管理（直近100件）
    if (state.requestHistory.length > 100) {
      state.requestHistory = state.requestHistory.slice(-100);
    }

    // メトリクス記録
    incrementCounter('rate_limiter_requests_total', {
      domain,
      status: status.toString(),
      rate_limited: rateLimited.toString()
    });

    recordHistogram('rate_limiter_request_duration_seconds', duration / 1000, {
      domain,
      status: status.toString()
    });

    // QPS調整ロジック
    if (rateLimited) {
      this.handleRateLimit(state, attempt);
    } else if (this.isSuccessStatus(status)) {
      this.handleSuccess(state, attempt);
    } else if (this.isErrorStatus(status)) {
      this.handleError(state, attempt);
    }

    // 学習アルゴリズム更新
    this.updateAdaptationScore(state, attempt);

    logger.debug('Request result recorded', {
      domain,
      status,
      duration,
      rateLimited,
      currentQps: state.currentQps,
      adaptationScore: state.adaptationScore
    });
  }

  /**
   * レート制限検知時の処理
   */
  private handleRateLimit(state: DomainState, attempt: RequestAttempt): void {
    const previousQps = state.currentQps;
    
    // QPS を積極的に下げる
    state.currentQps = Math.max(
      state.currentQps * state.config.backoffMultiplier,
      state.config.minQps
    );
    
    state.consecutiveErrors++;
    state.rateLimitedSince = attempt.timestamp;
    state.lastBackoffIncrease = attempt.timestamp;

    // サーキットブレーカー判定
    if (state.consecutiveErrors >= state.config.circuitBreakerThreshold) {
      state.circuitBreakerOpen = true;
      
      logger.warn('Circuit breaker opened due to rate limiting', {
        domain: state.config.domain,
        consecutiveErrors: state.consecutiveErrors,
        previousQps,
        currentQps: state.currentQps
      });

      incrementCounter('rate_limiter_circuit_breaker_total', {
        domain: state.config.domain,
        reason: 'rate_limit'
      });
    }

    incrementCounter('rate_limiter_backoff_total', {
      domain: state.config.domain,
      reason: 'rate_limit'
    });

    logger.info('QPS reduced due to rate limiting', {
      domain: state.config.domain,
      previousQps,
      currentQps: state.currentQps,
      consecutiveErrors: state.consecutiveErrors
    });
  }

  /**
   * 成功レスポンス時の処理
   */
  private handleSuccess(state: DomainState, attempt: RequestAttempt): void {
    state.consecutiveErrors = 0;
    state.rateLimitedSince = undefined;

    // 回復条件チェック
    const timeSinceLastBackoff = attempt.timestamp - state.lastBackoffIncrease;
    const recoveryInterval = this.calculateRecoveryInterval(state);

    if (timeSinceLastBackoff > recoveryInterval && state.currentQps < state.config.maxQps) {
      const previousQps = state.currentQps;
      
      // 適応スコアに基づく慎重な回復
      const recoveryRate = state.config.recoveryMultiplier * (0.5 + state.adaptationScore * 0.5);
      state.currentQps = Math.min(
        state.currentQps * recoveryRate,
        state.config.maxQps
      );

      logger.info('QPS increased after successful requests', {
        domain: state.config.domain,
        previousQps,
        currentQps: state.currentQps,
        adaptationScore: state.adaptationScore,
        timeSinceBackoff: timeSinceLastBackoff
      });

      incrementCounter('rate_limiter_recovery_total', {
        domain: state.config.domain
      });
    }
  }

  /**
   * エラーレスポンス時の処理
   */
  private handleError(state: DomainState, attempt: RequestAttempt): void {
    state.consecutiveErrors++;

    // 連続エラーが多い場合は予防的にQPSを下げる
    if (state.consecutiveErrors >= 3) {
      const previousQps = state.currentQps;
      state.currentQps = Math.max(
        state.currentQps * 0.8, // 20%削減
        state.config.minQps
      );

      logger.warn('QPS reduced due to consecutive errors', {
        domain: state.config.domain,
        previousQps,
        currentQps: state.currentQps,
        consecutiveErrors: state.consecutiveErrors
      });
    }
  }

  /**
   * 機械学習ベースの適応スコア更新
   */
  private updateAdaptationScore(state: DomainState, attempt: RequestAttempt): void {
    const recentHistory = state.requestHistory.slice(-20); // 直近20件
    if (recentHistory.length < 10) return;

    // 成功率計算
    const successRate = recentHistory.filter(r => this.isSuccessStatus(r.status)).length / recentHistory.length;
    
    // レート制限率計算
    const rateLimitRate = recentHistory.filter(r => r.rateLimited).length / recentHistory.length;
    
    // 平均レスポンス時間
    const avgResponseTime = recentHistory.reduce((sum, r) => sum + r.duration, 0) / recentHistory.length;
    
    // 適応スコア更新（0-1の範囲）
    // 高い成功率、低いレート制限率、適切なレスポンス時間で高スコア
    const newScore = (
      successRate * 0.5 +
      (1 - rateLimitRate) * 0.3 +
      (avgResponseTime < 5000 ? 0.2 : 0.1) // 5秒以下なら良好
    );
    
    // 移動平均で更新
    state.adaptationScore = state.adaptationScore * 0.8 + newScore * 0.2;

    recordHistogram('rate_limiter_adaptation_score', state.adaptationScore, {
      domain: state.config.domain
    });
  }

  /**
   * サーキットブレーカーのバックオフ時間計算
   */
  private calculateCircuitBreakerBackoff(state: DomainState): number {
    const baseBackoff = 60000; // 1分
    const errorFactor = Math.min(state.consecutiveErrors, 10);
    return baseBackoff * Math.pow(2, errorFactor / 3); // 指数バックオフ
  }

  /**
   * QPS回復間隔の計算
   */
  private calculateRecoveryInterval(state: DomainState): number {
    const baseInterval = 30000; // 30秒
    const adaptationFactor = 2 - state.adaptationScore; // 適応スコアが高いほど早く回復
    return baseInterval * adaptationFactor;
  }

  /**
   * ドメイン状態の取得または作成
   */
  private getOrCreateDomainState(domain: string): DomainState {
    let state = this.domains.get(domain);
    
    if (!state) {
      const config: DomainConfig = {
        domain,
        ...this.defaultConfig
      };
      
      state = {
        config,
        currentQps: config.initialQps,
        requestHistory: [],
        lastRequest: 0,
        consecutiveErrors: 0,
        circuitBreakerOpen: false,
        lastBackoffIncrease: 0,
        adaptationScore: 0.5
      };
      
      this.domains.set(domain, state);
    }
    
    return state;
  }

  /**
   * URLからドメインを抽出
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      // フォールバック: 簡単な正規表現
      const match = url.match(/https?:\/\/([^\/]+)/);
      return match ? match[1] : 'unknown';
    }
  }

  /**
   * レート制限ステータスコード判定
   */
  private isRateLimitStatus(status: number): boolean {
    return status === 429 || status === 503 || status === 509;
  }

  /**
   * 成功ステータスコード判定
   */
  private isSuccessStatus(status: number): boolean {
    return status >= 200 && status < 300;
  }

  /**
   * エラーステータスコード判定
   */
  private isErrorStatus(status: number): boolean {
    return status >= 400 && status < 600;
  }

  /**
   * 現在の状態取得（監視・デバッグ用）
   */
  getStatus(): Array<{
    domain: string;
    currentQps: number;
    circuitBreakerOpen: boolean;
    consecutiveErrors: number;
    adaptationScore: number;
    recentSuccessRate: number;
    lastRequest: string;
  }> {
    return Array.from(this.domains.entries()).map(([domain, state]) => {
      const recentHistory = state.requestHistory.slice(-10);
      const recentSuccessRate = recentHistory.length > 0 
        ? recentHistory.filter(r => this.isSuccessStatus(r.status)).length / recentHistory.length
        : 0;

      return {
        domain,
        currentQps: state.currentQps,
        circuitBreakerOpen: state.circuitBreakerOpen,
        consecutiveErrors: state.consecutiveErrors,
        adaptationScore: state.adaptationScore,
        recentSuccessRate,
        lastRequest: state.lastRequest > 0 
          ? new Date(state.lastRequest).toISOString()
          : 'never'
      };
    });
  }

  /**
   * 強制的なQPS設定（緊急時用）
   */
  forceQps(domain: string, qps: number): void {
    const state = this.getOrCreateDomainState(domain);
    state.currentQps = Math.max(Math.min(qps, state.config.maxQps), state.config.minQps);
    state.consecutiveErrors = 0;
    state.circuitBreakerOpen = false;

    logger.warn('QPS forcibly set', {
      domain,
      qps: state.currentQps
    });
  }

  /**
   * 全体の有効/無効切り替え
   */
  setEnabled(enabled: boolean): void {
    this.globalEnabled = enabled;
    logger.info('Rate limiter enabled status changed', { enabled });
  }

  /**
   * ドメイン状態のリセット
   */
  resetDomain(domain: string): void {
    const state = this.domains.get(domain);
    if (state) {
      state.currentQps = state.config.initialQps;
      state.consecutiveErrors = 0;
      state.circuitBreakerOpen = false;
      state.requestHistory = [];
      state.adaptationScore = 0.5;
      state.rateLimitedSince = undefined;
      state.lastBackoffIncrease = 0;

      logger.info('Domain state reset', { domain });
    }
  }
}

// シングルトンインスタンス
export const adaptiveRateLimiter = new AdaptiveRateLimiter();