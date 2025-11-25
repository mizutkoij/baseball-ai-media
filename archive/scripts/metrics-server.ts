#!/usr/bin/env npx tsx

/**
 * Prometheusメトリクスサーバー
 * 
 * 機能:
 * - /metrics エンドポイントでPrometheus形式のメトリクス公開
 * - ヘルスチェック
 * - graceful shutdown
 */

import * as http from "http";
import { registry } from "../lib/prometheus-metrics";
import { logger } from "../lib/logger";

const port = Number(process.env.METRICS_PORT ?? 9464);
const host = process.env.METRICS_HOST ?? "127.0.0.1";

// リクエストハンドラ
const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (req.url === "/metrics") {
      // Prometheusメトリクス
      res.setHeader("Content-Type", registry.contentType);
      const metrics = await registry.metrics();
      res.end(metrics);
      
      logger.debug({
        path: "/metrics",
        method: req.method,
        duration_ms: Date.now() - startTime,
        response_size: Buffer.byteLength(metrics, 'utf8'),
      }, 'Metrics served');
      
    } else if (req.url === "/health") {
      // ヘルスチェック
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      };
      
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(health, null, 2));
      
      logger.debug({
        path: "/health",
        method: req.method,
        duration_ms: Date.now() - startTime,
      }, 'Health check served');
      
    } else if (req.url === "/") {
      // ルートページ
      const info = `
<!DOCTYPE html>
<html>
<head><title>NPB Scraper Metrics</title></head>
<body>
<h1>NPB Scraper Metrics Server</h1>
<ul>
<li><a href="/metrics">Prometheus Metrics</a></li>
<li><a href="/health">Health Check</a></li>
</ul>
<p>Server uptime: ${Math.floor(process.uptime())}s</p>
<p>Memory usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB</p>
</body>
</html>`;
      
      res.setHeader("Content-Type", "text/html");
      res.end(info);
      
    } else {
      // 404
      res.statusCode = 404;
      res.end("Not Found");
      
      logger.warn({
        path: req.url,
        method: req.method,
        status: 404,
        duration_ms: Date.now() - startTime,
      }, 'Not found');
    }
  } catch (error) {
    res.statusCode = 500;
    res.end("Internal Server Error");
    
    logger.error({
      path: req.url,
      method: req.method,
      status: 500,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }, 'Metrics server error');
  }
});

// サーバー起動
server.listen(port, host, () => {
  logger.info({
    port,
    host,
    pid: process.pid,
    endpoints: ["/metrics", "/health"],
  }, `Metrics server started on ${host}:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info({}, 'SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info({}, 'Metrics server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info({}, 'SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info({}, 'Metrics server closed');
    process.exit(0);
  });
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  logger.error({
    error: error.message,
    stack: error.stack,
  }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({
    error: String(reason),
  }, 'Unhandled promise rejection');
  process.exit(1);
});

export { server };