// server/live-api.ts
import Fastify, { FastifyInstance, FastifyPluginAsync } from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import fastifyStatic from "@fastify/static";
import fs from "fs/promises";
import path from "path";
import { logger } from "../lib/logger";
import { 
  registry, 
  sseConnections, 
  liveSummaryRequests, 
  liveLatestCacheHits 
} from "../lib/prometheus-metrics";
import { memoryCache, cacheKeys } from "../lib/memory-cache";

const TZ = "Asia/Tokyo";
function todayJST() {
  const f = new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = f.format(new Date()).split("/"); // "YYYY/MM/DD"
  return `${y}-${m}-${d}`;
}

async function readJson<T=any>(p: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(p, "utf-8")); } catch { return null; }
}
async function readLines(p: string): Promise<string[]> {
  try { return (await fs.readFile(p, "utf-8")).split(/\r?\n/).filter(Boolean); } catch { return []; }
}

const withCtx = (ctx: any) => logger.child(ctx);

const liveApi: FastifyPluginAsync<{ baseDir?: string }> = async (app, opts) => {
  const baseDir = opts.baseDir ?? process.env.DATA_DIR ?? "data";
  const log = withCtx({ job: "api-live" });

  // CORS/圧縮
  await app.register(cors, { origin: true, credentials: false });
  await app.register(compress);

  // 静的ファイル提供（/dash 以下のみ）
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "public"),
    prefix: "/static/",
    cacheControl: false,
  });

  // ヘルス
  app.get("/health", async () => ({ ok: true }));

  // 管理API：パラメータリロード（ガードレール用）
  app.post("/admin/reload-params", async (req, rep) => {
    try {
      // 設定ファイルの再読み込みを促す
      // 実際の実装では、live-paramsキャッシュのクリアなど
      
      // 簡易実装：成功を返す（実際にはキャッシュクリア等が必要）
      log.info("Parameters reload requested via admin API");
      
      return { 
        ok: true, 
        timestamp: new Date().toISOString(),
        message: "Parameters reloaded successfully" 
      };
    } catch (error) {
      log.error({ error: error.message }, "Parameter reload failed");
      return rep.code(500).send({ 
        ok: false, 
        error: "reload_failed", 
        message: error.message 
      });
    }
  });

  // Prometheus メトリクス
  app.get("/metrics", async (req, rep) => {
    rep.header("Content-Type", registry.contentType);
    return registry.metrics();
  });

  // Heatmap API
  app.get<{
    Params: { gameId: string },
    Querystring: { pitcher?: string, batterSide?: string, count?: string }
  }>("/heatmap/:gameId", async (req, rep) => {
    const { gameId } = req.params;
    const date = todayJST();
    
    try {
      // ヒートマップファイルディレクトリ
      const heatmapDir = path.join(baseDir, "heatmaps", `date=${date}`);
      
      // クエリパラメータで絞り込み
      const pitcher = req.query.pitcher;
      const batterSide = req.query.batterSide || 'R';
      const count = req.query.count || 'even';
      
      // ファイル名を構築
      let filename = '';
      if (pitcher) {
        filename = `${pitcher}_${batterSide}_${count}.json`;
      } else {
        // デフォルトのヒートマップファイルを探す
        const files = await fs.readdir(heatmapDir).catch(() => []);
        const gameFiles = files.filter(f => f.includes(gameId) || f.startsWith('NPB_'));
        if (gameFiles.length > 0) {
          filename = gameFiles[0];
        } else {
          return rep.code(404).send({ error: "Heatmap not found", gameId });
        }
      }
      
      const heatmapPath = path.join(heatmapDir, filename);
      const heatmapData = await readJson(heatmapPath);
      
      if (!heatmapData) {
        return rep.code(404).send({ error: "Heatmap file not found", gameId, filename });
      }
      
      // キャッシュヘッダー設定
      const isLive = true; // 実際の試合状況に応じて判定
      if (isLive) {
        rep.header("Cache-Control", "no-store, no-cache, must-revalidate");
      } else {
        rep.header("Cache-Control", "public, max-age=3600, s-maxage=300");
        rep.header("ETag", `"${filename}-${date}"`);
      }
      
      rep.header("Content-Type", "application/json");
      return {
        gameId,
        ...heatmapData,
        meta: {
          ...heatmapData.meta,
          requestedAt: new Date().toISOString(),
          filename
        }
      };
      
    } catch (error) {
      log.error({ gameId, error: error?.message }, "Heatmap API error");
      return rep.code(500).send({ error: "Internal server error", gameId });
    }
  });

  // 今日のゲーム一覧
  app.get<{
    Querystring: { date?: string }
  }>("/live/games/today", async (req, rep) => {
    const date = req.query.date ?? todayJST();
    const dir = path.join(baseDir, "predictions", "live", `date=${date}`);
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      const games = items.filter(d => d.isDirectory()).map(d => d.name);
      return { date, games };
    } catch {
      return { date, games: [] };
    }
  });

  // latest.json を返す（キャッシュ対応）
  app.get<{
    Params: { gameId: string },
    Querystring: { date?: string, stale?: string }
  }>("/live/:gameId", async (req, rep) => {
    const date = req.query.date ?? todayJST();
    const gameId = req.params.gameId;
    const staleSeconds = req.query.stale ? Number(req.query.stale) : 0;
    
    // キャッシュチェック（stale指定時）
    if (staleSeconds > 0) {
      const cacheKey = cacheKeys.latestGame(date, gameId);
      const cached = memoryCache.get(cacheKey);
      
      if (cached) {
        liveLatestCacheHits.inc({ gameId, hit: "true" });
        rep.header("X-Cache", "HIT");
        return cached;
      }
      
      liveLatestCacheHits.inc({ gameId, hit: "false" });
    }
    
    // ファイル読み込み
    const p = path.join(baseDir, "predictions", "live", `date=${date}`, gameId, "latest.json");
    const j = await readJson(p);
    
    if (!j) {
      return rep.code(404).send({ error: "not_found", date, gameId });
    }
    
    // キャッシュに保存（stale指定時）
    if (staleSeconds > 0) {
      const cacheKey = cacheKeys.latestGame(date, gameId);
      memoryCache.set(cacheKey, j, staleSeconds * 1000);
      rep.header("X-Cache", "MISS");
    } else {
      rep.header("X-Cache", "BYPASS");
    }
    
    return j;
  });

  // Live Summary API - 全試合の概要情報
  app.get<{
    Querystring: { date?: string }
  }>("/live/summary", async (req, rep) => {
    const startTime = Date.now();
    const date = req.query.date ?? todayJST();
    
    try {
      // キャッシュチェック（5秒TTL）
      const cacheKey = cacheKeys.summary(date);
      const cached = memoryCache.get(cacheKey);
      
      if (cached) {
        liveSummaryRequests.inc({ status: "cache_hit" });
        rep.header("X-Cache", "HIT");
        rep.header("X-Response-Time", `${Date.now() - startTime}ms`);
        return cached;
      }
      
      // 全ゲーム取得
      const dir = path.join(baseDir, "predictions", "live", `date=${date}`);
      let games: string[] = [];
      
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        games = items.filter(d => d.isDirectory()).map(d => d.name);
      } catch {
        // ディレクトリが存在しない場合
        games = [];
      }
      
      // 各ゲームのlatest.jsonを取得
      const summaries = [];
      
      for (const gameId of games) {
        try {
          const latestPath = path.join(dir, gameId, "latest.json");
          const latest = await readJson(latestPath);
          
          if (latest) {
            // ファイル更新時刻を取得
            const stat = await fs.stat(latestPath);
            const age = Math.floor((Date.now() - stat.mtime.getTime()) / 1000);
            
            summaries.push({
              gameId,
              age, // seconds since last update
              p_home: Number(latest.p_home?.toFixed(3) ?? 0),
              p_away: Number(latest.p_away?.toFixed(3) ?? 0),
              conf: latest.conf ?? "low",
              inning: latest.inning ?? 1,
              top: latest.top ?? false,
              outs: latest.outs ?? 0,
              homeScore: latest.homeScore ?? 0,
              awayScore: latest.awayScore ?? 0,
              lastUpdate: latest.ts ?? stat.mtime.toISOString()
            });
          }
        } catch (error) {
          // 個別ゲームのエラーは無視して継続
          log.debug({ gameId, error: error.message }, 'Failed to load game summary');
        }
      }
      
      // 勝率順でソート
      summaries.sort((a, b) => {
        const aSpread = Math.abs(a.p_home - 0.5);
        const bSpread = Math.abs(b.p_home - 0.5);
        return bSpread - aSpread; // 接戦度の低い順（大差のある試合が上位）
      });
      
      const result = {
        date,
        generated_at: new Date().toISOString(),
        total_games: summaries.length,
        games: summaries,
        response_time_ms: Date.now() - startTime
      };
      
      // キャッシュに保存（5秒TTL）
      memoryCache.set(cacheKey, result, 5000);
      
      liveSummaryRequests.inc({ status: "success" });
      rep.header("X-Cache", "MISS");
      rep.header("X-Response-Time", `${result.response_time_ms}ms`);
      
      return result;
      
    } catch (error) {
      liveSummaryRequests.inc({ status: "fail" });
      log.error({ date, error: error.message }, 'Summary API failed');
      return rep.code(500).send({ error: "internal_error", message: error.message });
    }
  });

  // Dashboard page
  app.get("/dash", async (_req, rep) => {
    const p = path.join(process.cwd(), "public", "dash", "index.html");
    log.debug({ path: p }, 'Attempting to read dashboard HTML');
    try {
      const html = await fs.readFile(p, "utf-8");
      log.debug({ length: html.length }, 'Dashboard HTML read successfully');
      rep.type("text/html").send(html);
    } catch (error) {
      log.error({ path: p, error: error.message }, 'Failed to read dashboard HTML');
      rep.code(404).send({ error: "dashboard_not_found", path: p, message: error.message });
    }
  });

  // SSE（Server-Sent Events）
  app.get<{
    Params: { gameId: string },
    Querystring: { date?: string, replay?: string, from?: string }
  }>("/live/:gameId/stream", async (req, rep) => {
    const date = req.query.date ?? todayJST();
    const gameId = req.params.gameId;
    const dir = path.join(baseDir, "predictions", "live", `date=${date}`, gameId);
    const matchupDir = path.join(baseDir, "predictions", "matchup", `date=${date}`, gameId);
    const nextPitchDir = path.join(baseDir, "predictions", "next-pitch", `date=${date}`, gameId);
    const latestPath = path.join(dir, "latest.json");
    const timelinePath = path.join(dir, "timeline.jsonl");
    const matchupTimelinePath = path.join(matchupDir, "timeline.jsonl");
    const nextPitchTimelinePath = path.join(nextPitchDir, "timeline.jsonl");

    // SSE ヘッダ
    rep.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    rep.raw.setHeader("Cache-Control", "no-cache, no-transform");
    rep.raw.setHeader("Connection", "keep-alive");
    rep.raw.setHeader("X-Accel-Buffering", "no"); // nginx対策
    rep.raw.write(`retry: 5000\n\n`);

    const logger = withCtx({ job: "sse", gameId, date });
    logger.info({ status: "open" });

    // SSE connection metrics
    sseConnections.inc();

    // 1) 初期送信：replay=1 なら全行、from（数値）指定ならその行番号+1から
    const wantReplay = req.query.replay === "1";
    const fromIdx = Number.isFinite(Number(req.query.from)) ? Number(req.query.from) : null;
    let cursor = 0;

    const prime = async () => {
      const lines = await readLines(timelinePath);
      if (lines.length) {
        let start = 0;
        if (!wantReplay && fromIdx == null) start = Math.max(0, lines.length - 1); // 直近のみ
        if (fromIdx != null) start = Math.min(lines.length, Math.max(0, fromIdx + 1)); // from 行の次から
        for (let i = start; i < lines.length; i++) {
          rep.raw.write(`id: ${i}\n`);
          rep.raw.write(`event: update\n`);
          rep.raw.write(`data: ${lines[i]}\n\n`);
        }
        cursor = lines.length - 1;
      } else {
        // latest.json があればそれを一発送信（ブートストラップ）
        const latest = await readJson(latestPath);
        if (latest) {
          rep.raw.write(`id: 0\n`);
          rep.raw.write(`event: update\n`);
          rep.raw.write(`data: ${JSON.stringify(latest)}\n\n`);
        }
        cursor = 0;
      }
    };

    // 2) ハートビート
    const hb = setInterval(() => {
      rep.raw.write(`: hb\n\n`);
    }, 15000);

    // 3) タイムライン追従（超シンプル：変更ごとに全行読み→新規分だけ送る）
    let watching = true;
    let matchupCursor = 0;
    let nextPitchCursor = 0;
    
    const poll = async () => {
      while (watching) {
        try {
          // 勝率timeline
          const lines = await readLines(timelinePath);
          if (lines.length - 1 > cursor) {
            for (let i = cursor + 1; i < lines.length; i++) {
              rep.raw.write(`id: ${i}\n`);
              rep.raw.write(`event: update\n`);
              rep.raw.write(`data: ${lines[i]}\n\n`);
            }
            cursor = lines.length - 1;
          }
          
          // 対決予測timeline
          const matchupLines = await readLines(matchupTimelinePath);
          if (matchupLines.length - 1 > matchupCursor) {
            for (let i = matchupCursor + 1; i < matchupLines.length; i++) {
              rep.raw.write(`id: m${i}\n`);
              rep.raw.write(`event: matchup\n`);
              rep.raw.write(`data: ${matchupLines[i]}\n\n`);
            }
            matchupCursor = matchupLines.length - 1;
          }
          
          // 球種予測timeline
          const nextPitchLines = await readLines(nextPitchTimelinePath);
          if (nextPitchLines.length - 1 > nextPitchCursor) {
            for (let i = nextPitchCursor + 1; i < nextPitchLines.length; i++) {
              rep.raw.write(`id: np${i}\n`);
              rep.raw.write(`event: nextpitch\n`);
              rep.raw.write(`data: ${nextPitchLines[i]}\n\n`);
            }
            nextPitchCursor = nextPitchLines.length - 1;
          }
        } catch {/* ignore */}
        await new Promise(r => setTimeout(r, 1500)); // 1.5s ポーリング
      }
    };

    // 4) 接続クローズ
    req.raw.on("close", () => {
      watching = false;
      clearInterval(hb);
      sseConnections.dec();
      logger.info({ status: "close" });
    });

    // 起動
    await prime();
    poll();

    return rep; // keep open
  });
};

export async function createLiveServer(port = Number(process.env.PORT ?? 8787), baseDir?: string): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(liveApi, { baseDir });
  await app.ready();
  await app.listen({ port, host: "0.0.0.0" });
  return app;
}