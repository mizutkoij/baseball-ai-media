/**
 * A/B Testing System
 * 
 * Quick-Win A/B テスト用の軽量フラグシステム
 * 環境変数 NEXT_PUBLIC_AB_ プレフィックスで制御
 */

export interface ABTestConfig {
  testName: string;
  variant: 'A' | 'B';
  description: string;
  enabled: boolean;
}

export interface ABTestResult {
  testName: string;
  variant: 'A' | 'B';
  isEnabled: boolean;
}

// A/Bテスト設定の定義
const AB_TEST_CONFIGS: Record<string, ABTestConfig> = {
  TODAY_HIGHLIGHTS_ORDER: {
    testName: 'today_highlights_order',
    variant: (process.env.NEXT_PUBLIC_AB_TODAY_HIGHLIGHTS_ORDER as 'A' | 'B') || 'A',
    description: 'TodayHighlightsFixed の順序: A=GOTD→Brief, B=Brief→GOTD',
    enabled: process.env.NEXT_PUBLIC_AB_TODAY_HIGHLIGHTS_ORDER !== undefined
  },
  SHARE_BUTTON_POSITION: {
    testName: 'share_button_position',
    variant: (process.env.NEXT_PUBLIC_AB_SHARE_BUTTON_POSITION as 'A' | 'B') || 'A',
    description: 'Compare ページ ShareButton: A=カード上部, B=カード下部',
    enabled: process.env.NEXT_PUBLIC_AB_SHARE_BUTTON_POSITION !== undefined
  },
  RELATED_NAV_LAYOUT: {
    testName: 'related_nav_layout',
    variant: (process.env.NEXT_PUBLIC_AB_RELATED_NAV_LAYOUT as 'A' | 'B') || 'A',
    description: 'RelatedNavigation レイアウト: A=3列グリッド, B=2列＋サイドバー',
    enabled: process.env.NEXT_PUBLIC_AB_RELATED_NAV_LAYOUT !== undefined
  }
};

/**
 * 特定のA/Bテストの設定を取得
 */
export function getABTestConfig(testName: keyof typeof AB_TEST_CONFIGS): ABTestResult {
  const config = AB_TEST_CONFIGS[testName];
  
  if (!config) {
    console.warn(`A/B Test not found: ${testName}`);
    return {
      testName: testName as string,
      variant: 'A',
      isEnabled: false
    };
  }

  return {
    testName: config.testName,
    variant: config.variant,
    isEnabled: config.enabled
  };
}

/**
 * 全てのA/Bテスト設定を取得
 */
export function getAllABTestConfigs(): Record<string, ABTestResult> {
  const results: Record<string, ABTestResult> = {};
  
  for (const [key, config] of Object.entries(AB_TEST_CONFIGS)) {
    results[key] = {
      testName: config.testName,
      variant: config.variant,
      isEnabled: config.enabled
    };
  }
  
  return results;
}

/**
 * A/Bテストのアナリティクストラッキング
 */
export function trackABTestView(testName: string, variant: 'A' | 'B'): void {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'ab_test_view', {
      event_category: 'ab_testing',
      event_label: testName,
      custom_variant: variant,
      custom_test_name: testName
    });
  }
}

/**
 * A/Bテストのコンバージョントラッキング
 */
export function trackABTestConversion(
  testName: string, 
  variant: 'A' | 'B', 
  conversionType: string,
  value?: number
): void {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'ab_test_conversion', {
      event_category: 'ab_testing',
      event_label: `${testName}_${conversionType}`,
      custom_variant: variant,
      custom_test_name: testName,
      custom_conversion_type: conversionType,
      value: value || 1
    });
  }
}

/**
 * React Hook: A/Bテストの使用
 */
export function useABTest(testName: keyof typeof AB_TEST_CONFIGS): ABTestResult {
  const config = getABTestConfig(testName);
  
  // コンポーネントマウント時にビューをトラッキング
  React.useEffect(() => {
    if (config.isEnabled) {
      trackABTestView(config.testName, config.variant);
    }
  }, [config.testName, config.variant, config.isEnabled]);
  
  return config;
}

/**
 * コンディショナルレンダリング用のユーティリティ
 */
export function renderVariant<T>(
  testResult: ABTestResult,
  variantA: T,
  variantB: T,
  fallback?: T
): T {
  if (!testResult.isEnabled) {
    return fallback !== undefined ? fallback : variantA;
  }
  
  return testResult.variant === 'A' ? variantA : variantB;
}

/**
 * CSS クラス名の条件付き適用
 */
export function getVariantClassName(
  testResult: ABTestResult,
  classNameA: string,
  classNameB: string,
  fallbackClassName?: string
): string {
  if (!testResult.isEnabled) {
    return fallbackClassName !== undefined ? fallbackClassName : classNameA;
  }
  
  return testResult.variant === 'A' ? classNameA : classNameB;
}

/**
 * デバッグ用: A/Bテストの現在状態を表示
 */
export function getABTestDebugInfo(): string {
  const allConfigs = getAllABTestConfigs();
  const activeTests = Object.entries(allConfigs)
    .filter(([_, config]) => config.isEnabled);
  
  if (activeTests.length === 0) {
    return 'No active A/B tests';
  }
  
  return activeTests
    .map(([name, config]) => `${name}: ${config.variant}`)
    .join(', ');
}

// React import for useEffect
import { useEffect } from 'react';
const React = { useEffect };