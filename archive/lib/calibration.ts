// mode: "platt" -> p' = σ(a*logit(p)+b), "temperature" -> p' = σ(logit(p)/T)
export type Calib = { 
  mode: "none" | "platt" | "temperature"; 
  by_phase: boolean; 
  params: any; 
};

export function applyCalib(p: number, phase: "early" | "mid" | "late", calib: Calib): number {
  if (!calib || calib.mode === "none") return p;
  
  const EPS = 1e-6;
  const clampedP = Math.min(1 - EPS, Math.max(EPS, p));
  const z = Math.log(clampedP / (1 - clampedP));
  
  if (calib.mode === "platt") {
    const { a, b } = calib.params[phase] ?? calib.params["all"] ?? { a: 1, b: 0 };
    const z2 = a * z + b;
    return 1 / (1 + Math.exp(-z2));
  } else if (calib.mode === "temperature") {
    const { T, b } = calib.params[phase] ?? calib.params["all"] ?? { T: 1, b: 0 };
    const z2 = z / Math.max(1e-3, T) + b;
    return 1 / (1 + Math.exp(-z2));
  }
  
  return p;
}