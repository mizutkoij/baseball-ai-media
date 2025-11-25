/**
 * Metrics Smoke Tests - Phase 6: Testing/DX
 * 
 * 機能:
 * - Prometheusメトリクスサーバー動作確認
 * - メトリクス出力形式検証
 * - ヘルスチェック機能確認
 * - 基本的なメトリクス値検証
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startMetricsServer, stopMetricsServer } from "../lib/prometheus-metrics";
import { incrementCounter, recordHistogram } from "../lib/prometheus-metrics";

describe("Metrics Smoke Tests", () => {
  const testPort = 19999; // テスト専用ポート
  let serverUrl: string;

  beforeAll(async () => {
    // テスト用メトリクスサーバー起動
    await startMetricsServer(testPort);
    serverUrl = `http://localhost:${testPort}`;
  });

  afterAll(async () => {
    // サーバー停止
    await stopMetricsServer();
  });

  describe("server health", () => {
    it("responds to health check endpoint", async () => {
      const response = await fetch(`${serverUrl}/health`);
      
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health).toEqual({
        status: "ok",
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String)
      });
    });

    it("provides readiness check", async () => {
      const response = await fetch(`${serverUrl}/ready`);
      
      expect(response.status).toBe(200);
      
      const ready = await response.json();
      expect(ready).toEqual({
        ready: true,
        checks: {
          metrics: "ok"
        }
      });
    });
  });

  describe("metrics endpoint", () => {
    it("serves Prometheus metrics format", async () => {
      const response = await fetch(`${serverUrl}/metrics`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/plain');
      
      const metricsText = await response.text();
      
      // Prometheus形式の基本構造を検証
      expect(metricsText).toContain('# HELP');
      expect(metricsText).toContain('# TYPE');
      
      // スナップショット検証 (値は動的なので構造のみ)
      const structuralLines = metricsText
        .split('\n')
        .filter(line => line.startsWith('# '))
        .slice(0, 10); // 最初の10個のメタデータ行
      
      expect(structuralLines).toMatchSnapshot('metrics-structure');
    });

    it("includes default Node.js metrics", async () => {
      const response = await fetch(`${serverUrl}/metrics`);
      const metricsText = await response.text();
      
      // 基本的なNode.jsメトリクスの存在確認
      expect(metricsText).toContain('process_cpu_user_seconds_total');
      expect(metricsText).toContain('nodejs_heap_size_total_bytes');
      expect(metricsText).toContain('nodejs_heap_size_used_bytes');
      expect(metricsText).toContain('nodejs_version_info');
    });

    it("includes custom NPB metrics", async () => {
      // カスタムメトリクスを作成
      incrementCounter('npb_scraper_requests_total', { source: 'test', status: 'success' });
      recordHistogram('npb_scraper_duration_seconds', 1.23, { operation: 'test' });
      
      const response = await fetch(`${serverUrl}/metrics`);
      const metricsText = await response.text();
      
      // カスタムメトリクスの存在確認
      expect(metricsText).toContain('npb_scraper_requests_total');
      expect(metricsText).toContain('npb_scraper_duration_seconds');
      
      // ラベルが含まれていることを確認
      expect(metricsText).toContain('source="test"');
      expect(metricsText).toContain('status="success"');
      expect(metricsText).toContain('operation="test"');
    });
  });

  describe("metrics accuracy", () => {
    it("correctly increments counter metrics", async () => {
      const metricName = 'test_counter_total';
      const labels = { test: 'accuracy', component: 'counter' };
      
      // 初期値取得
      const initialResponse = await fetch(`${serverUrl}/metrics`);
      const initialText = await initialResponse.text();
      const initialValue = extractMetricValue(initialText, metricName, labels);
      
      // カウンターをインクリメント
      incrementCounter(metricName, labels);
      incrementCounter(metricName, labels);
      incrementCounter(metricName, labels);
      
      // 値の確認
      const finalResponse = await fetch(`${serverUrl}/metrics`);
      const finalText = await finalResponse.text();
      const finalValue = extractMetricValue(finalText, metricName, labels);
      
      // 3回インクリメントされていることを確認
      expect(finalValue).toBe(initialValue + 3);
    });

    it("correctly records histogram metrics", async () => {
      const metricName = 'test_histogram_seconds';
      const labels = { test: 'accuracy', component: 'histogram' };
      
      // ヒストグラム値を記録
      const testValues = [0.1, 0.5, 1.0, 2.0, 5.0];
      testValues.forEach(value => recordHistogram(metricName, value, labels));
      
      const response = await fetch(`${serverUrl}/metrics`);
      const metricsText = await response.text();
      
      // ヒストグラムのバケット確認
      expect(metricsText).toMatch(new RegExp(`${metricName}_bucket.*le="1"`));
      expect(metricsText).toMatch(new RegExp(`${metricName}_bucket.*le="5"`));
      expect(metricsText).toMatch(new RegExp(`${metricName}_sum`));
      expect(metricsText).toMatch(new RegExp(`${metricName}_count`));
      
      // カウント数の確認
      const countValue = extractMetricValue(metricsText, `${metricName}_count`, labels);
      expect(countValue).toBe(testValues.length);
    });
  });

  describe("error handling", () => {
    it("handles malformed requests gracefully", async () => {
      // 存在しないエンドポイント
      const response = await fetch(`${serverUrl}/nonexistent`);
      expect(response.status).toBe(404);
    });

    it("maintains metrics during high load", async () => {
      // 大量のメトリクス更新
      const promises = Array.from({ length: 100 }, (_, i) => {
        return Promise.resolve().then(() => {
          incrementCounter('load_test_counter_total', { 
            iteration: i.toString(),
            batch: 'high_load' 
          });
          recordHistogram('load_test_histogram_seconds', Math.random() * 10, {
            operation: 'load_test'
          });
        });
      });
      
      await Promise.all(promises);
      
      // メトリクスが正常に取得できることを確認
      const response = await fetch(`${serverUrl}/metrics`);
      expect(response.status).toBe(200);
      
      const metricsText = await response.text();
      expect(metricsText).toContain('load_test_counter_total');
      expect(metricsText).toContain('load_test_histogram_seconds');
    });
  });

  describe("performance", () => {
    it("responds to metrics requests quickly", async () => {
      const startTime = Date.now();
      const response = await fetch(`${serverUrl}/metrics`);
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // 500ms以内
    });

    it("handles concurrent metric requests", async () => {
      // 同時リクエストテスト
      const concurrentRequests = Array.from({ length: 10 }, () => 
        fetch(`${serverUrl}/metrics`)
      );
      
      const responses = await Promise.all(concurrentRequests);
      
      // すべてのリクエストが成功することを確認
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe("content validation", () => {
    it("produces valid Prometheus exposition format", async () => {
      const response = await fetch(`${serverUrl}/metrics`);
      const metricsText = await response.text();
      
      const lines = metricsText.split('\n');
      
      // 各行の形式を検証
      for (const line of lines.slice(0, 50)) { // 最初の50行をチェック
        if (line.trim() === '') continue; // 空行はスキップ
        
        if (line.startsWith('#')) {
          // コメント行の形式チェック
          expect(line).toMatch(/^# (HELP|TYPE) \w+/);
        } else {
          // メトリクス行の形式チェック
          expect(line).toMatch(/^[\w:]+(\{[^}]*\})?\s+[\d\-.+eE]+$/);
        }
      }
    });

    it("includes required metric metadata", async () => {
      const response = await fetch(`${serverUrl}/metrics`);
      const metricsText = await response.text();
      
      // 必要なメタデータが存在することを確認
      expect(metricsText).toContain('# HELP process_cpu_user_seconds_total');
      expect(metricsText).toContain('# TYPE process_cpu_user_seconds_total counter');
    });
  });
});

/**
 * メトリクステキストから特定のメトリクス値を抽出
 */
function extractMetricValue(
  metricsText: string, 
  metricName: string, 
  labels?: Record<string, string>
): number {
  const lines = metricsText.split('\n');
  
  // ラベル文字列を構築
  let labelString = '';
  if (labels && Object.keys(labels).length > 0) {
    const labelPairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    labelString = `{${labelPairs}}`;
  }
  
  // メトリクス行を検索
  const pattern = new RegExp(`^${metricName}${labelString}\\s+([\\d\\.\\-+eE]+)$`);
  
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }
  
  return 0; // 見つからない場合は0を返す
}