import { InferenceSession, Tensor } from "onnxruntime-node";
import fs from "fs/promises";
import path from "path";

export type NPFeatureRow = Record<string, number>;
type Calib = { mode:"temperature"; T:number };

let session: InferenceSession | null = null;
let FEATURES: string[] = [];
let CLASSES: string[] = [];
let CALIB: Calib = {mode:"temperature", T:1};

export async function initNextPitch(modelDir="models/nextpitch"){
  if (session) return;
  
  FEATURES = JSON.parse(await fs.readFile(path.join(modelDir,"features.json"),"utf-8"));
  
  try { 
    CLASSES = JSON.parse(await fs.readFile(path.join(modelDir,"classes.json"),"utf-8")); 
  } catch {
    const rep = JSON.parse(await fs.readFile(path.join(modelDir,"report.json"),"utf-8"));
    CLASSES = rep.classes || [];
  }
  
  try { 
    CALIB = JSON.parse(await fs.readFile(path.join(modelDir,"calibration.json"),"utf-8")); 
  } catch {}
  
  session = await InferenceSession.create(path.join(modelDir,"model.onnx"), {
    executionProviders:["cpu"] 
  });
}

function tempScale(probs: number[], T: number){
  const q = probs.map(p => Math.max(1e-8, Math.min(1-1e-8, p)) ** (1/Math.max(1e-3,T)));
  const s = q.reduce((a,b)=>a+b,0);
  return q.map(x => x/s);
}

export async function predictNextPitch(rows: NPFeatureRow[], modelDir?: string){
  await initNextPitch(modelDir);
  if (!session) throw new Error("nextpitch model not loaded");
  
  const X = new Float32Array(rows.flatMap(r => FEATURES.map(k => Number((r as any)[k] ?? 0))));
  const tensor = new Tensor("float32", X, [rows.length, FEATURES.length]);
  const out = await session.run({ input: tensor });
  
  const key = Object.keys(out)[0];
  const flat = Array.from(out[key].data as Float32Array); // N×K
  const K = CLASSES.length || 9;
  const probs2d = Array.from({length: rows.length}, (_,i)=> flat.slice(i*K,(i+1)*K));
  
  return probs2d.map(arr => {
    const p = tempScale(arr, CALIB?.T ?? 1);
    const idx = p.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]);
    const top1 = idx[0];
    const top3 = idx.slice(0,3);
    
    return { 
      probs: p, 
      top1: {pitch: CLASSES[top1[1]] ?? String(top1[1]), prob: top1[0]},
      top3: top3.map(([v,i]) => ({pitch: CLASSES[i] ?? String(i), prob: v})) 
    };
  });
}