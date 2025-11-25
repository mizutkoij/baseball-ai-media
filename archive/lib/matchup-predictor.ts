import { InferenceSession, Tensor } from "onnxruntime-node";
import fs from "fs/promises";
import path from "path";

type Calib = { type: "none" | "platt" | "temperature"; coef?: number; intercept?: number; temperature?: number };
export type MatchupRow = Record<string, number>;

let session: InferenceSession | null = null;
let features: string[] = [];
let calib: Calib = { type: "none" };

export async function initMatchup(modelDir = "models/matchup") {
  if (session) return;
  
  try {
    const onnxPath = path.join(modelDir, "model.onnx");
    const featsPath = path.join(modelDir, "features.json");
    const calibPath = path.join(modelDir, "calibration.json");

    // 特徴量リスト読み込み
    features = JSON.parse(await fs.readFile(featsPath, "utf-8"));
    
    // キャリブレーション設定読み込み（オプショナル）
    try {
      calib = JSON.parse(await fs.readFile(calibPath, "utf-8"));
    } catch {
      calib = { type: "none" };
    }
    
    // ONNXモデル読み込み
    session = await InferenceSession.create(onnxPath, { 
      executionProviders: ["cpu"] 
    });
    
    console.log(`✅ Matchup model loaded: ${features.length} features, calibration: ${calib.type}`);
  } catch (error) {
    console.warn(`⚠️  Matchup model initialization failed: ${error.message}`);
    throw error;
  }
}

function applyCalibration(p: number): number {
  if (calib?.type === "platt" && calib.coef && calib.intercept) {
    const logit = Math.log(Math.max(1e-15, Math.min(1 - 1e-15, p)) / (1 - Math.max(1e-15, Math.min(1 - 1e-15, p))));
    const calibrated_logit = calib.coef * logit + calib.intercept;
    return 1 / (1 + Math.exp(-calibrated_logit));
  }
  
  if (calib?.type === "temperature" && calib.temperature) {
    const logit = Math.log(Math.max(1e-15, Math.min(1 - 1e-15, p)) / (1 - Math.max(1e-15, Math.min(1 - 1e-15, p))));
    const calibrated_logit = logit / Math.max(1e-3, calib.temperature);
    return 1 / (1 + Math.exp(-calibrated_logit));
  }
  
  return p;
}

export async function predictMatchup(rows: MatchupRow[], modelDir?: string): Promise<number[]> {
  await initMatchup(modelDir);
  
  if (!session) {
    throw new Error("Matchup model session not loaded");
  }
  
  // 特徴量行列を構築（欠損値は0で補完）
  const X = new Float32Array(
    rows.flatMap(row => 
      features.map(feature => {
        const value = (row as any)[feature];
        return Number(value ?? 0);
      })
    )
  );
  
  const tensor = new Tensor("float32", X, [rows.length, features.length]);
  const output = await session.run({ input: tensor });
  
  // 出力テンソルの最初のキーから確率を取得
  const outputKey = Object.keys(output)[0];
  const rawProbs = Array.from(output[outputKey].data as Float32Array);
  
  // キャリブレーション適用 & クリッピング
  const probs = rawProbs.map(p =>
    Math.min(0.99, Math.max(0.01, applyCalibration(p)))
  );
  
  return probs;
}

export function isMatchupModelAvailable(): boolean {
  return session !== null;
}