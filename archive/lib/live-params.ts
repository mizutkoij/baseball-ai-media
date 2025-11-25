import fs from "fs/promises";

let cache: any = null;

export async function loadLiveParams(path = process.env.LIVE_PARAMS ?? "config/live-params.json") {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(path, "utf-8"));
  } catch {
    cache = { 
      mix: { w_min: 0.2, w_max: 0.95, curve: "linear" }, 
      smooth: { alpha_base: 0.3, alpha_score_event: 0.55 }, 
      clip: { lo: 0.02, hi: 0.98 }, 
      calibration: { mode: "none", by_phase: false, params: {} }, 
      confidence: { high: 0.15, medium: 0.08 } 
    };
  }
  return cache;
}

export function phaseOf(inning: number): "early" | "mid" | "late" {
  return inning <= 3 ? "early" : inning <= 6 ? "mid" : "late";
}

export function clearCache() {
  cache = null;
}