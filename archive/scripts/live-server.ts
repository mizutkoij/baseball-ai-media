// scripts/live-server.ts
import { createLiveServer } from "../server/live-api";
import { logger } from "../lib/logger";

const port = Number(process.env.LIVE_PORT ?? process.env.PORT ?? 8787);
const baseDir = process.env.DATA_DIR ?? "data";

const log = logger.child({ job: "live-server" });

createLiveServer(port, baseDir).then(() => {
  console.log(`🚀 Live API Server running on http://localhost:${port}`);
  console.log(`📡 Available endpoints:`);
  console.log(`   GET /health`);
  console.log(`   GET /metrics (Prometheus)`);
  console.log(`   GET /heatmap/:gameId (Pitch Heatmap) 🔥`);
  console.log(`   GET /dash (Live Dashboard UI) 🎯`);
  console.log(`   GET /live/games/today`);
  console.log(`   GET /live/summary (All games overview)`);
  console.log(`   GET /live/:gameId`);
  console.log(`   GET /live/:gameId?stale=5 (Cached)`);
  console.log(`   GET /live/:gameId/stream (SSE)`);
  console.log(`📊 Data directory: ${baseDir}`);
  console.log(`💡 Try: http://localhost:${port}/dash`);
}).catch((e) => {
  log.error({ status: "fail", error: e?.message });
  console.error("💥 Server startup failed:", e?.message);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down Live API server...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down Live API server...");
  process.exit(0);
});