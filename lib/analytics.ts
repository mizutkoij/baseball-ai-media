/**
 * Analytics追跡ユーティリティ
 * 重複発火防止とイベント統一管理
 */

export function track(event: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  
  // Google Analytics
  if ((window as any).gtag) {
    (window as any).gtag('event', event, {
      ...payload,
      timestamp: Date.now()
    });
  }
  
  // デバッグ出力（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Analytics:', event, payload);
  }
}

// 重複発火防止のためのセッション管理
const sessionEvents = new Set<string>();

export function trackOnce(event: string, payload?: Record<string, unknown>) {
  const key = `${event}_${JSON.stringify(payload)}`;
  
  if (sessionEvents.has(key)) {
    return; // 既に発火済み
  }
  
  sessionEvents.add(key);
  track(event, payload);
}

// ページビュー専用（重複防止込み）
export function trackPageView(page: string, additionalData?: Record<string, unknown>) {
  trackOnce('page_view', {
    page,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    ...additionalData
  });
}

// 比較系イベント専用
export function trackComparison(type: 'teams' | 'players', data: {
  items: string[];
  year?: number;
  pf?: boolean;
  source?: string;
}) {
  track(`compare_${type}_view`, {
    item_count: data.items.length,
    items: data.items.join(','),
    year: data.year,
    pf_correction: data.pf,
    source: data.source || 'direct'
  });
}