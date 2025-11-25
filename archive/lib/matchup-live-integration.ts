import { predictMatchup, isMatchupModelAvailable } from "./matchup-predictor";
import { makeRowFromLive, type MatchupContext } from "./matchup-feature-mapper";
import { appendJsonl, writeLatest } from "./live-writer";
import { logger } from "./logger";

const log = logger.child({ job: "matchup-live" });

// メトリクス（mock implementation）
const matchupPredictEvents = {
  inc: (labels: { result: "success" | "fail" }) => {
    // TODO: 実際のPrometheusメトリクスに置き換え
    log.debug({ ...labels }, "matchup prediction event");
  }
};

const matchupPredictLatency = {
  startTimer: () => {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      log.debug({ duration_ms: duration }, "matchup prediction latency");
    };
  }
};

export interface PlateAppearanceEvent {
  gameId: string;
  date: string;
  baseDir: string;
  state: {
    inning: number;
    top: boolean;
    outs: 0 | 1 | 2;
    bases?: { first?: boolean; second?: boolean; third?: boolean };
    basesCode?: number;
    homeScore: number;
    awayScore: number;
    pa_seq?: number;
    count?: { balls: number; strikes: number };
  };
  context: MatchupContext;
  sse?: (event: { event: string; data: any }) => void;
}

export async function onPlateAppearanceStart(event: PlateAppearanceEvent): Promise<void> {
  const endTimer = matchupPredictLatency.startTimer();
  
  try {
    // モデルが利用できない場合はスキップ（勝率配信は継続）
    if (!isMatchupModelAvailable()) {
      log.debug({ gameId: event.gameId }, "Matchup model not available, skipping prediction");
      return;
    }
    
    // 特徴量行を構築
    const row = makeRowFromLive(event.state, event.context);
    
    // 予測実行（1件バッチ）
    const [p_reach] = await predictMatchup([row]);
    
    // 信頼度計算
    const confidence_score = Math.abs(p_reach - 0.5);
    const conf = confidence_score >= 0.20 ? "high" : 
                 confidence_score >= 0.10 ? "medium" : "low";
    
    // イベント構築
    const matchupEvent = {
      ts: new Date().toISOString(),
      gameId: event.gameId,
      pa_seq: event.state.pa_seq ?? 1,
      batterId: event.context.batterId ?? "unknown",
      pitcherId: event.context.pitcherId ?? "unknown",
      p_reach: Number(p_reach.toFixed(6)),
      conf,
      features: row
    };
    
    // 保存
    const timelineDir = `predictions/matchup/date=${event.date}/${event.gameId}`;
    await appendJsonl(event.baseDir, `${timelineDir}/timeline.jsonl`, matchupEvent);
    await writeLatest(event.baseDir, `${timelineDir}/latest.json`, matchupEvent);
    
    // SSE配信
    if (event.sse) {
      event.sse({
        event: "matchup",
        data: matchupEvent
      });
    }
    
    matchupPredictEvents.inc({ result: "success" });
    
    log.info({
      gameId: event.gameId,
      batter: event.context.batterId,
      pitcher: event.context.pitcherId,
      p_reach: p_reach.toFixed(3),
      confidence: conf
    }, "Matchup prediction completed");
    
  } catch (error) {
    matchupPredictEvents.inc({ result: "fail" });
    log.warn({
      gameId: event.gameId,
      error: error.message
    }, "Matchup prediction failed, skipping");
    
    // 失敗は握りつぶして勝率配信は継続
  } finally {
    endTimer();
  }
}

/**
 * PA開始の判定（カウント0-0の瞬間）
 */
export function isPlateAppearanceStart(
  currentState: any,
  previousState?: any
): boolean {
  // カウントが0-0になった瞬間を検出
  const currentCount = currentState.count;
  const previousCount = previousState?.count;
  
  if (!currentCount) return false;
  
  // 現在が0-0かつ、前回が0-0以外だった場合（新PA開始）
  const isCurrentClean = currentCount.balls === 0 && currentCount.strikes === 0;
  const wasPreviousClean = previousCount?.balls === 0 && previousCount?.strikes === 0;
  
  return isCurrentClean && !wasPreviousClean;
}