/**
 * Prometheusメトリクスシステム
 */

import { Counter, Histogram, Registry, collectDefaultMetrics, Gauge } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequests = new Counter({
  name: "http_requests_total",
  help: "HTTP requests",
  labelNames: ["method", "host", "status", "cache"],
  registers: [registry],
});

export const httpRetries = new Counter({
  name: "http_retries_total",
  help: "HTTP retries",
  labelNames: ["reason"], // rate_limit|5xx|network|other
  registers: [registry],
});

export const circuitOpen = new Counter({
  name: "circuit_breaker_open_total",
  help: "Circuit opened",
  labelNames: ["target"],
  registers: [registry],
});

export const scrapeJobs = new Counter({
  name: "scrape_jobs_total",
  help: "Job results",
  labelNames: ["job", "result"], // success|fail|skip
  registers: [registry],
});

export const scrapeLatency = new Histogram({
  name: "scrape_duration_seconds",
  help: "Job duration",
  labelNames: ["job"],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10, 20],
  registers: [registry],
});

export const itemsTotal = new Counter({
  name: "scrape_items_total",
  help: "Total items produced",
  labelNames: ["job"],
  registers: [registry],
});

export const cacheStats = new Counter({
  name: "http_cache_events_total",
  help: "Cache events",
  labelNames: ["event"], // hit|miss|store|revalidate
  registers: [registry],
});

export const snapshotsSaved = new Counter({
  name: "html_snapshots_saved_total",
  help: "Saved HTML snapshots",
  labelNames: ["reason"], // parse_error|validation_error
  registers: [registry],
});

export const nextRunsGauge = new Gauge({
  name: "scheduler_next_run_timestamp",
  help: "Next run epoch seconds (JST-aware at producer)",
  labelNames: ["job"],
  registers: [registry],
});

export const validationResults = new Counter({
  name: "data_validation_total",
  help: "Validation results by type",
  labelNames: ["type", "result"], // result: valid|error|warning
  registers: [registry],
});

export const sseConnections = new Gauge({
  name: "live_sse_connections",
  help: "Active SSE connections",
  registers: [registry],
});

export const liveSummaryRequests = new Counter({
  name: "live_summary_requests_total",
  help: "Live summary API requests",
  labelNames: ["status"], // success|fail|cache_hit
  registers: [registry],
});

export const liveLatestCacheHits = new Counter({
  name: "live_latest_cache_hits_total",
  help: "Live latest.json cache hits",
  labelNames: ["gameId", "hit"], // hit: true|false
  registers: [registry],
});

// ガードレール関連メトリクス
export const guardrailActions = new Counter({
  name: "guardrail_actions_total",
  help: "Guardrail actions taken",
  labelNames: ["action"], // feature_off|rollback|reload
  registers: [registry],
});

export const rollingLogloss10m = new Gauge({
  name: "rolling_logloss_10m",
  help: "Rolling 10-minute average log loss",
  registers: [registry],
});

export const rollingBrier10m = new Gauge({
  name: "rolling_brier_10m",
  help: "Rolling 10-minute average Brier score",
  registers: [registry],
});

// 球種予測関連メトリクス
export const nextPitchPredictEvents = new Counter({
  name: "nextpitch_predict_events_total",
  help: "Next pitch prediction events",
  labelNames: ["result"], // success|fail
  registers: [registry],
});

export const nextPitchPredictLatency = new Histogram({
  name: "nextpitch_predict_latency_ms",
  help: "Next pitch prediction latency in milliseconds",
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [registry],
});

// データ品質監視メトリクス
export const coveragePitchesTotal = new Gauge({
  name: "coverage_pitches_total",
  help: "Total pitch events captured per game",
  labelNames: ["gameId"],
  registers: [registry],
});

export const expectedPitchesTotal = new Gauge({
  name: "expected_pitches_total", 
  help: "Expected pitch events per game",
  labelNames: ["gameId"],
  registers: [registry],
});

export const pbpEventLag = new Histogram({
  name: "pbp_event_lag_seconds",
  help: "Play-by-play event lag in seconds",
  labelNames: ["gameId"],
  buckets: [5, 10, 15, 30, 60, 120, 300],
  registers: [registry],
});

export const missingPitchTypeTotal = new Counter({
  name: "missing_pitch_type_total",
  help: "Count of pitch events without type classification",
  labelNames: ["gameId", "source"],
  registers: [registry],
});

export const lineupConfirmedTotal = new Gauge({
  name: "lineup_confirmed_total",
  help: "Number of games with confirmed lineups",
  labelNames: ["date"],
  registers: [registry],
});

export const dataConsistencyErrors = new Counter({
  name: "data_consistency_errors_total",
  help: "Count of data consistency errors",
  labelNames: ["type", "gameId"], // type: count_progression, inning_sequence, etc.
  registers: [registry],
});

// GC/メモリー監視メトリクス
export const memoryUsage = new Gauge({
  name: "process_memory_usage_bytes",
  help: "Process memory usage in bytes",
  labelNames: ["type"], // rss, heapUsed, heapTotal, external
  registers: [registry],
});

export const gcDuration = new Histogram({
  name: "gc_duration_seconds",
  help: "Garbage collection duration in seconds",
  labelNames: ["type"], // major, minor, incremental
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

export const gcCount = new Counter({
  name: "gc_count_total",
  help: "Total garbage collection count",
  labelNames: ["type"], // major, minor, incremental
  registers: [registry],
});

export const eventLoopLag = new Histogram({
  name: "event_loop_lag_seconds",
  help: "Event loop lag in seconds",
  buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2],
  registers: [registry],
});

export const memoryPressure = new Gauge({
  name: "memory_pressure_status",
  help: "Memory pressure status (0=green, 1=yellow, 2=red)",
  registers: [registry],
});