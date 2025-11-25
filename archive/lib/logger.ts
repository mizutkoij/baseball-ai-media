/**
 * 構造化ログシステム - 相関ID/必須フィールド固定
 * 
 * 機能:
 * - 必須フィールドの統一（runId, job, date, status）
 * - 相関IDによるリクエスト追跡
 * - JSON Lines対応
 * - 環境変数によるレベル制御
 */

import pino from "pino";

export type LogCtx = {
  runId?: string;    // 実行ID（相関追跡用）
  job?: string;      // ジョブ名（starters|games|details|scheduler）
  date?: string;     // 対象日（YYYY-MM-DD）
  gameId?: string;   // 試合ID
  url?: string;      // 対象URL（HTTP関連）
  stage?: string;    // 処理段階（parse|validate|store）
};

export type LogStatus = 'start' | 'success' | 'fail' | 'skip' | 'retry';

// Pinoロガー設定
export const logger = pino.default ? pino.default({
  level: process.env.LOG_LEVEL ?? "info",
  base: null, // pid/hostname省略（メトリクスと相関取りやすく）
  timestamp: (pino.default || pino).stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
}) : pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

// コンテキスト付きロガー
export const withCtx = (ctx: LogCtx) => logger.child(ctx);

// 標準化されたログ出力ヘルパー
export function logJobEvent(
  ctx: LogCtx,
  status: LogStatus,
  data: {
    duration_ms?: number;
    items?: number;
    retries?: number;
    warn_count?: number;
    error_code?: string;
    error?: string;
    [key: string]: any;
  } = {}
) {
  const log = withCtx(ctx);
  const logData = { status, ...data };
  
  switch (status) {
    case 'start':
      log.info(logData, 'Job started');
      break;
    case 'success':
      log.info(logData, 'Job completed successfully');
      break;
    case 'fail':
      log.error(logData, 'Job failed');
      break;
    case 'skip':
      log.warn(logData, 'Job skipped');
      break;
    case 'retry':
      log.warn(logData, 'Job retrying');
      break;
  }
}

// HTTP関連の標準化ログ
export function logHttpEvent(
  ctx: LogCtx,
  event: 'request' | 'response' | 'retry' | 'cache_hit' | 'cache_miss' | 'circuit_open',
  data: {
    method?: string;
    status?: number;
    duration_ms?: number;
    cache?: boolean;
    retries?: number;
    error?: string;
    [key: string]: any;
  } = {}
) {
  const log = withCtx(ctx);
  const logData = { event, ...data };
  
  switch (event) {
    case 'request':
      log.debug(logData, 'HTTP request initiated');
      break;
    case 'response':
      if (data.status && data.status >= 400) {
        log.warn(logData, 'HTTP error response');
      } else {
        log.debug(logData, 'HTTP response received');
      }
      break;
    case 'retry':
      log.warn(logData, 'HTTP request retry');
      break;
    case 'cache_hit':
      log.debug(logData, 'HTTP cache hit');
      break;
    case 'cache_miss':
      log.debug(logData, 'HTTP cache miss');
      break;
    case 'circuit_open':
      log.error(logData, 'Circuit breaker opened');
      break;
  }
}

// 1行=1イベント のJSON Linesフォーマット
export function toJsonl(obj: unknown): string {
  return JSON.stringify(obj) + "\n";
}

// 分類コード生成（エラー分類用）
export function classifyError(error: any): string {
  if (!error) return 'unknown';
  
  if (error.code) return error.code;
  if (error.message) {
    if (error.message.includes('timeout')) return 'timeout';
    if (error.message.includes('ENOTFOUND')) return 'dns_error';
    if (error.message.includes('ECONNREFUSED')) return 'connection_refused';
    if (error.message.includes('CIRCUIT_BREAKER')) return 'circuit_open';
    if (error.message.includes('fetch')) return 'fetch_error';
    if (error.message.includes('parse')) return 'parse_error';
    if (error.message.includes('validation')) return 'validation_error';
  }
  
  return 'unknown';
}

// 実行ID生成ヘルパー
export function generateRunId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// デバッグ用：現在のログレベル確認
export function getLogLevel(): string {
  return logger.level;
}

// 開発時の便利関数
export function debugDump(obj: any, label: string = 'DEBUG'): void {
  if (logger.level === 'debug') {
    logger.debug({ label, data: obj }, 'Debug dump');
  }
}