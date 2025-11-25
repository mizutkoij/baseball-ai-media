/**
 * Metrics Smoke Tests - Corrected and Final
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "http";
import { startMetricsServer, stopMetricsServer } from "../scripts/metrics-server";
import { registry, scrapeJobs, scrapeLatency } from "../lib/prometheus-metrics";
import { Counter, Histogram } from "prom-client";

describe("Metrics Smoke Tests", () => {
  const testPort = 19999;
  let serverUrl: string;
  let server: http.Server;

  beforeAll(async () => {
    server = await startMetricsServer(testPort);
    serverUrl = `http://localhost:${testPort}`;
  });

  afterAll(async () => {
    await stopMetricsServer();
  });

  describe("server health", () => {
    it("responds to health check endpoint", async () => {
      const response = await fetch(`${serverUrl}/health`);
      expect(response.status).toBe(200);
      const health = await response.json();
      expect(health).toEqual(
        expect.objectContaining({
          status: "healthy",
          timestamp: expect.any(String),
          uptime: expect.any(Number),
        })
      );
    });
  });

  describe("metrics endpoint", () => {
    it("serves Prometheus metrics format", async () => {
      const response = await fetch(`${serverUrl}/metrics`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/plain');
      const metricsText = await response.text();
      expect(metricsText).toContain('# HELP');
      expect(metricsText).toContain('# TYPE');
    });

    it("includes default Node.js metrics", async () => {
      const metricsText = await (await fetch(`${serverUrl}/metrics`)).text();
      expect(metricsText).toContain('process_cpu_user_seconds_total');
      expect(metricsText).toContain('nodejs_heap_size_total_bytes');
    });

    it("includes custom NPB metrics", async () => {
      scrapeJobs.inc({ job: 'test', result: 'success' });
      scrapeLatency.observe({ job: 'test' }, 1.23);
      
      const metricsText = await (await fetch(`${serverUrl}/metrics`)).text();
      expect(metricsText).toContain('scrape_jobs_total{job="test",result="success"}');
      expect(metricsText).toContain('scrape_duration_seconds_sum{job="test"}');
    });
  });

  describe("metrics accuracy", () => {
    it("correctly increments counter metrics", async () => {
      const testCounter = new Counter({ name: "test_counter_accuracy_2", help: "help" });
      testCounter.inc();
      testCounter.inc();
      const val = await testCounter.get();
      expect(val.values[0].value).toBe(2);
    });

    it("correctly records histogram metrics", async () => {
      const testHistogram = new Histogram({ name: "test_histogram_accuracy_2", help: "help", buckets: [1, 5] });
      testHistogram.observe(3);
      const val = await testHistogram.get();
      expect(val.values.find(v => v.metricName === 'test_histogram_accuracy_2_sum')?.value).toBe(3);
      expect(val.values.find(v => v.metricName === 'test_histogram_accuracy_2_count')?.value).toBe(1);
    });
  });

  describe("error handling", () => {
    it("handles malformed requests gracefully", async () => {
      const response = await fetch(`${serverUrl}/nonexistent`);
      expect(response.status).toBe(404);
    });
  });

  describe("performance", () => {
    it("responds to metrics requests quickly", async () => {
      const startTime = Date.now();
      const response = await fetch(`${serverUrl}/metrics`);
      const duration = Date.now() - startTime;
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it("handles concurrent metric requests", async () => {
      const requests = Array.from({ length: 10 }, () => fetch(`${serverUrl}/metrics`));
      const responses = await Promise.all(requests);
      responses.forEach(response => expect(response.status).toBe(200));
    });
  });

  describe("content validation", () => {
    it("produces valid Prometheus exposition format", async () => {
      const metricsText = await (await fetch(`${serverUrl}/metrics`)).text();
      const lines = metricsText.split('\n');
      for (const line of lines) {
        if (line.trim() === '' || line.startsWith('#')) continue;
        expect(line).toMatch(/^[\w:]+(\{[^}]*\})?\s+[\d\-.+eEaN]+$/);
      }
    });

    it("includes required metric metadata", async () => {
      const metricsText = await (await fetch(`${serverUrl}/metrics`)).text();
      expect(metricsText).toContain('# HELP process_cpu_user_seconds_total');
      expect(metricsText).toContain('# TYPE process_cpu_user_seconds_total counter');
    });
  });
});