// Discord通知システム - データ取得の見える化と安全な転送
import { setTimeout as sleep } from 'timers/promises';
import { createHash } from 'crypto';
import { Blob } from 'buffer';

type Level = 'info' | 'success' | 'warn' | 'error';
type QueueItem =
  | { kind: 'embed'; content: any; webhook: string }
  | { kind: 'json'; filename: string; obj: unknown; webhook: string };

const STATUS_WEBHOOK = process.env.DISCORD_WEBHOOK_STATUS || '';
const DATA_WEBHOOK = process.env.DISCORD_WEBHOOK_DATA || '';
const ALERTS_WEBHOOK = process.env.DISCORD_WEBHOOK_ALERTS || '';

const q: QueueItem[] = [];
let running = false;

function color(level: Level) {
  return { info: 0x95a5a6, success: 0x2ecc71, warn: 0xf1c40f, error: 0xe74c3c }[level];
}

async function postJson(webhook: string, payload: any) {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) {
    const after = Number(res.headers.get('x-ratelimit-reset-after') ?? '2');
    await sleep(Math.ceil(after * 1000));
    return postJson(webhook, payload);
  }
  if (!res.ok) throw new Error(`Discord ${res.status}`);
}

async function postAttachment(webhook: string, filename: string, obj: unknown) {
  const fd = new FormData();
  const payload = { content: `📎 \`${filename}\`` };
  fd.append('payload_json', JSON.stringify(payload));
  const json = JSON.stringify(obj, null, 2);
  fd.append('file', new Blob([json], { type: 'application/json' }), filename);

  const res = await fetch(webhook, { method: 'POST', body: fd as any });
  if (res.status === 429) {
    const after = Number(res.headers.get('x-ratelimit-reset-after') ?? '2');
    await sleep(Math.ceil(after * 1000));
    return postAttachment(webhook, filename, obj);
  }
  if (!res.ok) throw new Error(`Discord ${res.status}`);
}

async function worker() {
  if (running) return;
  running = true;
  while (q.length) {
    const item = q.shift()!;
    try {
      if (item.kind === 'embed') {
        await postJson(item.webhook, item.content);
      } else {
        await postAttachment(item.webhook, item.filename, item.obj);
      }
      // Discord 一般レート: 1–2 req/sec 程度。安全に 300ms スロットル。
      await sleep(300);
    } catch (e) {
      console.error('Discord notification failed:', e);
      // 失敗は再キュー（最大3回等にしてもOK）
      await sleep(1000);
      if (q.length < 100) { // 無限ループ防止
        q.push(item);
      }
    }
  }
  running = false;
}

function enqueue(item: QueueItem) {
  q.push(item);
  worker();
}

/**
 * ステータス/アラート通知（embed形式）
 */
export function notifyStatus(title: string, msg: string, level: Level = 'info', fields?: Record<string, string>) {
  if (!STATUS_WEBHOOK) return;
  const embed = {
    embeds: [
      {
        title,
        description: msg,
        color: color(level),
        timestamp: new Date().toISOString(),
        fields: fields
          ? Object.entries(fields).map(([name, value]) => ({ name, value, inline: true }))
          : undefined,
      },
    ],
  };
  enqueue({ kind: 'embed', content: embed, webhook: STATUS_WEBHOOK });
}

/**
 * JSONデータを添付ファイルで送信（データ転送用）
 */
export function sendJsonAttachment(basename: string, obj: unknown, webhook?: string) {
  const hook = webhook || DATA_WEBHOOK;
  if (!hook) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '');
  const hash = createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 8);
  const filename = `${basename}_${ts}_${hash}.json`;
  enqueue({ kind: 'json', filename, obj, webhook: hook });
}

/**
 * 2000字制限内に収まるよう、短いJSONはメッセージ本文で送りたいとき
 */
export function sendJsonInline(label: string, obj: unknown, webhook?: string) {
  const hook = webhook || DATA_WEBHOOK;
  if (!hook) return;
  const body = '```json\n' + JSON.stringify(obj, null, 2).slice(0, 1800) + '\n```';
  enqueue({ kind: 'embed', webhook: hook, content: { content: `📦 ${label}\n${body}` } });
}

/**
 * ライブ一球を"毎回"送りつつレート安全に：1秒で束ねて1メッセージ
 */
let liveBuffer: any[] = [];
let liveTimer: NodeJS.Timeout | null = null;
export function sendLiveEventBuffered(event: unknown, flushMs = 1000) {
  liveBuffer.push(event);
  if (liveTimer) return;
  liveTimer = setTimeout(() => {
    const chunk = liveBuffer.splice(0, liveBuffer.length);
    liveTimer = null;
    // 文字数に応じて複数に分割
    const text = chunk.map(e => JSON.stringify(e)).join('\n');
    if (text.length < 1800) {
      sendJsonInline(`live-events x${chunk.length}`, chunk);
    } else {
      sendJsonAttachment(`live-events_x${chunk.length}`, chunk);
    }
  }, flushMs);
}

/**
 * データ取得の進捗状況をまとめて通知
 */
export function notifyDataProgress(source: string, stats: {
  total?: number;
  fetched?: number;
  errors?: number;
  duration?: string;
  url?: string;
  status?: number;
  etag?: string;
}) {
  const fields: Record<string, string> = {};
  if (stats.total !== undefined) fields['Total'] = String(stats.total);
  if (stats.fetched !== undefined) fields['Fetched'] = String(stats.fetched);
  if (stats.errors !== undefined) fields['Errors'] = String(stats.errors);
  if (stats.duration) fields['Duration'] = stats.duration;
  if (stats.status) fields['Status'] = String(stats.status);
  if (stats.etag) fields['ETag'] = stats.etag.slice(0, 10) + '...';
  
  const level: Level = stats.errors ? 'warn' : 'success';
  notifyStatus(`🔎 ${source} fetch`, stats.url || 'Data fetched', level, fields);
}

/**
 * 差分データの通知
 */
export function notifyDataDiff(kind: string, diff: {
  added?: any[];
  removed?: any[];
  updated?: any[];
  date?: string;
}) {
  const added = diff.added?.length || 0;
  const removed = diff.removed?.length || 0;
  const updated = diff.updated?.length || 0;
  
  if (added + removed + updated === 0) return; // 変更なしはスキップ
  
  const fields = {
    'Added': String(added),
    'Removed': String(removed), 
    'Updated': String(updated)
  };
  
  if (diff.date) fields['Date'] = diff.date;
  
  notifyStatus(`📥 ${kind} updated`, `Changes detected`, 'success', fields);
  
  // 実際の差分データも添付で送信
  if (diff.added?.length || diff.removed?.length || diff.updated?.length) {
    sendJsonAttachment(`diff_${kind}_${diff.date || 'latest'}`, diff);
  }
}

/**
 * エラー/レート制限の通知
 */
export function notifyError(title: string, error: unknown, context?: Record<string, string>) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  notifyStatus(`❌ ${title}`, errorMsg, 'error', context);
}

export function notifyRateLimit(source: string, retryAfter: number, url?: string) {
  notifyStatus(`⚠️ Rate limited`, `${source} - backing off`, 'warn', {
    'Retry After': `${retryAfter}s`,
    'URL': url?.slice(0, 50) || '-'
  });
}

export function notifyCircuitBreaker(source: string, action: 'opened' | 'closed', failureCount?: number) {
  const emoji = action === 'opened' ? '🧯' : '✅';
  const level: Level = action === 'opened' ? 'error' : 'info';
  const fields = failureCount ? { 'Failures': String(failureCount) } : undefined;
  
  notifyStatus(`${emoji} Circuit ${action}`, `${source} circuit breaker ${action}`, level, fields);
}

/**
 * システム起動/停止の通知
 */
export function notifySystemEvent(event: 'startup' | 'shutdown' | 'restart', component: string, details?: Record<string, string>) {
  const emoji = { startup: '🚀', shutdown: '🛑', restart: '🔄' }[event];
  const level: Level = event === 'shutdown' ? 'warn' : 'info';
  
  notifyStatus(`${emoji} System ${event}`, `${component} ${event}`, level, details);
}

/**
 * パフォーマンス/品質メトリクスの通知
 */
export function notifyMetrics(title: string, metrics: Record<string, number | string>) {
  const fields = Object.fromEntries(
    Object.entries(metrics).map(([k, v]) => [k, String(v)])
  );
  
  notifyStatus(`📊 ${title}`, 'Performance metrics', 'info', fields);
}

/**
 * 緊急アラート通知（ALERTS専用チャンネル、@hereメンション付き）
 */
export function notifyAlert(title: string, message: string, level: 'warn' | 'error' = 'error', context?: Record<string, string>) {
  if (!ALERTS_WEBHOOK) {
    // ALERTSチャンネルがない場合はSTATUSにフォールバック
    notifyStatus(`🚨 ${title}`, `@here ${message}`, level, context);
    return;
  }
  
  const fields = context
    ? Object.entries(context).map(([name, value]) => ({ name, value, inline: true }))
    : undefined;
  
  const embed = {
    content: '@here', // メンション付き
    embeds: [
      {
        title: `🚨 ${title}`,
        description: message,
        color: level === 'error' ? 0xe74c3c : 0xf1c40f,
        timestamp: new Date().toISOString(),
        fields
      }
    ]
  };
  
  enqueue({ kind: 'embed', content: embed, webhook: ALERTS_WEBHOOK });
}

/**
 * 重大なデータ品質問題の通知
 */
export function notifyDataQualityAlert(source: string, issue: string, severity: 'high' | 'critical', details?: Record<string, string>) {
  const emoji = severity === 'critical' ? '🚨' : '⚠️';
  notifyAlert(
    `${emoji} Data Quality Issue`,
    `${source}: ${issue}`,
    severity === 'critical' ? 'error' : 'warn',
    { Severity: severity, Source: source, ...details }
  );
}

/**
 * システム停止レベルの緊急アラート
 */
export function notifySystemFailure(component: string, error: string, impact: string) {
  notifyAlert(
    'System Failure',
    `${component} has failed: ${error}\n\nImpact: ${impact}`,
    'error',
    {
      Component: component,
      Impact: impact,
      'Requires': 'Immediate attention'
    }
  );
}