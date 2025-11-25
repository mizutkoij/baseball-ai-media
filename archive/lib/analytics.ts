/**
 * Analytics追跡ユーティリティ
 * GA4/Plausible両対応 + 重複発火防止とイベント統一管理
 */

type EventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    plausible?: (event: string, opts?: { props?: EventParams }) => void;
  }
}

const AB = process.env.NEXT_PUBLIC_AB_VERSION ?? "A";

export function trackEvent(name: string, params: EventParams = {}) {
  // 1) GA4
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
  // 2) Plausible
  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    window.plausible(name, { props: params });
  }
  
  // デバッグ出力（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Analytics:', name, params);
  }
}

export function trackArticleCTA(slug: string, to: string, extra?: EventParams) {
  trackEvent("article_cta_click", {
    slug,
    to,
    ab: AB,
    ...extra,
  });
}

export function trackArticleView(slug: string, extra?: EventParams) {
  trackEvent("article_view", { slug, ab: AB, ...extra });
}

// Legacy support
export function track(event: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  
  // Google Analytics
  if ((window as any).gtag) {
    (window as any).gtag('event', event, {
      ...payload,
      timestamp: Date.now()
    });
  }
  
  // Plausible
  if ((window as any).plausible) {
    (window as any).plausible(event, { props: payload });
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