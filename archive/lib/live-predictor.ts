// lib/live-predictor.ts
import { logger } from "./logger";
import { mixPregameState, mixPregameStateWithWeightAdjustment, ewma, confidence } from "./we-mixer";
import { loadLiveParams, phaseOf } from "./live-params";
import { applyCalib } from "./calibration";
import { appendLiveEvent } from "./live-writer";
import { getBullpenRating } from "./relief-strength";
import { adjustWEWithBullpen } from "./we-bullpen-adjust";
import { getPitcherFatigueIndex } from "./fatigue-index";
import { adjustWEWithFatigue } from "./we-fatigue-adjust";
import { getLineupSignal } from "./lineup-signal";
import { lineupWeightDelta, lineupPriorShift, applyPriorShift, type LineupAdjustmentMeta } from "./prior-lineup-adjust";
import reliefParamsJson from "../config/relief-params.json";
import fatigueParamsJson from "../config/fatigue-params.json";
import lineupParamsJson from "../config/lineup-params.json";
import { onPlateAppearanceStart, isPlateAppearanceStart } from "./matchup-live-integration";

// Mock metrics for now (replace with actual prometheus-metrics when available)
const liveLatency = {
  startTimer: (labels: any) => () => {}, // Mock timer
};
const liveEvents = {
  inc: (labels: any) => {}, // Mock counter
};

const withCtx = (ctx: any) => logger.child(ctx);

export type GameState = {
  gameId: string; inning: number; top: boolean; outs: 0|1|2;
  bases: number; homeScore: number; awayScore: number; ts: string;
};

export type WELookup = (s: GameState) => { p_home: number; conf: "high"|"medium"|"low" };
export type PregameLookup = (gameId: string) => number | undefined;

function jstIso(d = new Date()) {
  // 表示はISOだが、生成はシステム時刻でOK（metricsは秒）
  return d.toISOString();
}

export async function predictAndPersistLive(opts: {
  date: string; baseDir?: string;
  state: GameState;
  weLookup: WELookup;
  pregameProb: number | undefined; // ホーム勝率（なければ 0.5）
  lastSmoothed?: number;           // latest.json から拾えれば渡す
  previousState?: GameState;       // PA開始検知用
  sse?: (event: { event: string; data: any }) => void; // SSE配信用
}) {
  const baseDir = opts.baseDir ?? (process.env.DATA_DIR ?? "data");
  const { state } = opts;
  const log = withCtx({ job:"live", gameId: state.gameId });

  const end = liveLatency.startTimer({ gameId: state.gameId });
  try {
    const params = await loadLiveParams();
    const pPregame = opts.pregameProb ?? 0.5;
    const { p_home: pState, conf: srcConf } = opts.weLookup(state);

    // ブルペン強度による微調整（差し込み）
    const reliefParams = reliefParamsJson as any;
    let pStateAdjusted = pState;
    
    if (reliefParams.enable) {
      try {
        // gameId例: "20250812_G-T_01" -> home=G, away=T
        const gameIdParts = state.gameId.split('_');
        if (gameIdParts.length >= 2) {
          const teamPart = gameIdParts[1]; // "G-T"
          const teams = teamPart.split('-');
          if (teams.length === 2) {
            const [awayTeam, homeTeam] = teams;
            
            // ブルペン評価を並行取得
            const [ratingHome, ratingAway] = await Promise.all([
              getBullpenRating({ 
                date: opts.date, 
                team: homeTeam, 
                baseDir, 
                params: reliefParams 
              }),
              getBullpenRating({ 
                date: opts.date, 
                team: awayTeam, 
                baseDir, 
                params: reliefParams 
              })
            ]);
            
            const zHome = ratingHome?.z ?? 0;
            const zAway = ratingAway?.z ?? 0;
            
            // WE微調整適用
            pStateAdjusted = adjustWEWithBullpen(
              pState,
              zHome,
              zAway,
              state.inning,
              reliefParams.beta,
              reliefParams.max_shift,
              reliefParams.late_inning_curve
            );
            
            if (Math.abs(pStateAdjusted - pState) > 0.001) {
              log.debug({
                home_team: homeTeam,
                away_team: awayTeam,
                z_home: zHome.toFixed(3),
                z_away: zAway.toFixed(3),
                p_original: pState.toFixed(4),
                p_adjusted: pStateAdjusted.toFixed(4),
                shift: (pStateAdjusted - pState).toFixed(4)
              }, 'Bullpen adjustment applied');
            }
          }
        }
      } catch (error) {
        log.warn({ error: error.message }, 'Bullpen adjustment failed, using original p_state');
        pStateAdjusted = pState;
      }
    }

    // 投手疲労による微調整（第2段階）
    const fatigueParams = fatigueParamsJson as any;
    let pStateFinal = pStateAdjusted;
    
    if (fatigueParams.enable) {
      try {
        // 現在投球中の投手を特定（簡易版：ホーム/アウェイから推定）
        // 実際は現在の投手IDが必要だが、まずは基本実装
        const isHomeTeamPitching = !state.top; // 表はアウェイ攻撃=ホーム投球
        
        // 仮の投手ID（実際はゲーム詳細から取得）
        const mockPitcherId = isHomeTeamPitching ? "home_pitcher" : "away_pitcher";
        
        // 疲労指数取得
        const fatigueIndex = await getPitcherFatigueIndex(
          mockPitcherId,
          opts.date,
          baseDir
        );
        
        // 疲労による微調整
        pStateFinal = adjustWEWithFatigue(
          pStateAdjusted,
          fatigueIndex.fatigue_index,
          state.inning,
          isHomeTeamPitching,
          fatigueParams.max_shift,
          fatigueParams.late_inning_curve
        );
        
        if (Math.abs(pStateFinal - pStateAdjusted) > 0.001) {
          log.debug({
            pitcher_id: mockPitcherId,
            is_home_pitching: isHomeTeamPitching,
            fatigue_index: fatigueIndex.fatigue_index.toFixed(3),
            confidence: fatigueIndex.confidence,
            p_pre_fatigue: pStateAdjusted.toFixed(4),
            p_post_fatigue: pStateFinal.toFixed(4),
            fatigue_shift: (pStateFinal - pStateAdjusted).toFixed(4)
          }, 'Fatigue adjustment applied');
        }
        
      } catch (error) {
        log.warn({ error: error.message }, 'Fatigue adjustment failed, using previous p_state');
        pStateFinal = pStateAdjusted;
      }
    }

    // 先発オーダー微調整（差し込み）
    const lineupParams = lineupParamsJson as any;
    let pPregameEff = pPregame;
    let wExtra = 0;
    let lineupMeta: LineupAdjustmentMeta | null = null;

    if (lineupParams?.enable) {
      try {
        const sig = await getLineupSignal(baseDir, opts.date, state.gameId);
        
        // Weight調整
        if (lineupParams.mode === "weight" || lineupParams.mode === "both") {
          wExtra = lineupWeightDelta(state.inning, sig.status, lineupParams.weight);
        }
        
        // Prior調整
        if (lineupParams.mode === "prior" || lineupParams.mode === "both") {
          const starAbsences = 0; // ★ 最初は0固定（将来: lineup比較で算出）
          const shift = lineupPriorShift(sig.status, starAbsences, lineupParams.prior, sig.completeness);
          
          if (Math.abs(shift) > 0.001) {
            pPregameEff = applyPriorShift(pPregame, shift);
          }
          
          lineupMeta = {
            weightDelta: wExtra,
            priorShift: shift,
            originalPrior: pPregame,
            adjustedPrior: pPregameEff,
            lineupStatus: sig.status,
            completeness: sig.completeness,
            inning: state.inning
          };
        }
        
        if (Math.abs(wExtra) > 0.001 || Math.abs(pPregameEff - pPregame) > 0.001) {
          log.debug({
            lineup_status: sig.status,
            completeness: sig.completeness.toFixed(3),
            weight_delta: wExtra.toFixed(4),
            prior_shift: lineupMeta?.priorShift?.toFixed(4) ?? 0,
            p_pregame_original: pPregame.toFixed(4),
            p_pregame_adjusted: pPregameEff.toFixed(4)
          }, 'Lineup adjustment applied');
        }
        
      } catch (error) {
        log.warn({ error: error.message }, 'Lineup adjustment failed, using original pregame');
        pPregameEff = pPregame;
        wExtra = 0;
      }
    }
    
    const { p: pMixed, w } = await mixPregameStateWithWeightAdjustment(pPregameEff, pStateFinal, state.inning, state.outs, wExtra);
    
    // Detect score events for adaptive smoothing
    const isScoreEvent = opts.lastSmoothed != null && Math.abs(pMixed - opts.lastSmoothed) > 0.05;
    const pSmooth = await ewma(opts.lastSmoothed, pMixed, isScoreEvent);
    
    // Apply calibration if enabled
    const phase = phaseOf(state.inning);
    const pCalib = applyCalib(pSmooth, phase, {
      mode: params.calibration.mode,
      by_phase: params.calibration.by_phase,
      params: params.calibration.params ?? {}
    });

    const finalConf = await confidence(pState, pCalib, srcConf);

    const ev = {
      ts: jstIso(),
      gameId: state.gameId,
      inning: state.inning, top: state.top, outs: state.outs, bases: state.bases,
      homeScore: state.homeScore, awayScore: state.awayScore,
      scoreDiff: state.homeScore - state.awayScore,
      p_pregame: pPregame, 
      p_pregame_adjusted: pPregameEff, // lineup調整後
      p_state: pState, 
      p_state_adjusted: pStateAdjusted, // ブルペン調整後
      p_state_final: pStateFinal, // 疲労調整後
      w,
      w_extra: wExtra, // lineup重み調整
      p_home_raw: pMixed,
      p_home: pCalib, p_away: 1 - pCalib,
      conf: finalConf,
      lineup_meta: lineupMeta, // lineup調整メタデータ
    };

    const res = await appendLiveEvent(baseDir, opts.date, ev);
    liveEvents.inc({ result: res.action === "write" ? "success" : "skip" });
    log.info({ status: res.action, inning: state.inning, top: state.top, outs: state.outs, p_home: ev.p_home.toFixed(3), w: Number(w.toFixed(2)) });
    
    // 【C1-1c差し込み】PA開始検知→対決予測
    if (opts.previousState && isPlateAppearanceStart(state, opts.previousState)) {
      // 基本的なコンテキスト情報を構築（実際の実装では詳細データから取得）
      const mockContext = {
        batterId: "mock_batter", // 実際はstate.currentBatter等から取得
        pitcherId: "mock_pitcher", // 実際はstate.currentPitcher等から取得
        b_hand: 1 as (0 | 1), // デフォルト右打ち
        p_hand: 1 as (0 | 1), // デフォルト右投げ
        // その他の特徴量はデフォルト値を使用
      };
      
      onPlateAppearanceStart({
        gameId: state.gameId,
        date: opts.date,
        baseDir,
        state: {
          inning: state.inning,
          top: state.top,
          outs: state.outs,
          basesCode: state.bases,
          homeScore: state.homeScore,
          awayScore: state.awayScore,
          pa_seq: 1, // 実際はPA通算数
          count: { balls: 0, strikes: 0 } // PA開始時点
        },
        context: mockContext,
        sse: opts.sse
      });
    }
    
    return { ok: true, ...res, latest: ev };
  } catch (e: any) {
    liveEvents.inc({ result: "fail" });
    log.error({ status:"fail", error: e?.message });
    return { ok: false, error: e?.message };
  } finally {
    end();
  }
}