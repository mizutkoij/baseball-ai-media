#!/usr/bin/env python3
import os, json, argparse, numpy as np, pandas as pd, lightgbm as lgb
from sklearn.metrics import log_loss
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

PITCHES = ["FF","SL","CU","CH","SF","FC","SI","SC","OTHER"]

ap = argparse.ArgumentParser()
ap.add_argument("--data", default="data/ml/nextpitch/train_latest.parquet")
ap.add_argument("--out",  default="models/nextpitch")
ap.add_argument("--time-split", type=float, default=0.8)
ap.add_argument("--opset", type=int, default=17)
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)

# 読み込み
ext = os.path.splitext(args.data)[1]
df = pd.read_parquet(args.data) if ext==".parquet" else pd.read_csv(args.data)
FEATURES = ["b_hand","p_hand","balls","strikes","outs","bases","inning","top","scoreDiff",
            "leverage","last1","last2","mix_ff","mix_bb","mix_sl","mix_ch","mix_fk","mix_cv","mix_cut","mix_sin"]
X = df[FEATURES].astype("float32").values
y = df["y"].astype("int64").values

# 時系列分割
cut = int(len(df)*args.time_split)
Xtr, Xva = X[:cut], X[cut:]
ytr, yva = y[:cut], y[cut:]

clf = lgb.LGBMClassifier(objective="multiclass", num_class=len(PITCHES),
                         n_estimators=500, learning_rate=0.05, num_leaves=64,
                         subsample=0.9, colsample_bytree=0.9, min_child_samples=40)
clf.fit(Xtr, ytr, eval_set=[(Xva,yva)], eval_metric="multi_logloss", verbose=False)

# 検証
probs = clf.predict_proba(Xva)  # shape [N, K]
logloss = float(log_loss(yva, probs, labels=list(range(len(PITCHES)))))

# Top-1
top1 = float((probs.argmax(1) == yva).mean())

# 温度スケーリング（multiclass）：p^(1/T) を再正規化
def temp_calibrate(P, T):
  P = np.clip(P, 1e-8, 1-1e-8)
  Q = P ** (1.0/max(1e-3,T))
  return Q / Q.sum(axis=1, keepdims=True)

bestT, bestLL = 1.0, logloss
for T in np.linspace(0.6, 2.0, 15):
  q = temp_calibrate(probs, T)
  ll = float(log_loss(yva, q, labels=list(range(len(PITCHES)))))
  if ll < bestLL: bestLL, bestT = ll, T
calib = {"mode":"temperature", "T": float(bestT)}

# ECE（Expected Calibration Error）
def ece(P, y, M=10):
  conf = P.max(1)
  preds = P.argmax(1)
  bins = np.linspace(0,1,M+1)
  e=0.0; n=len(y)
  for i in range(M):
    I = (conf>=bins[i]) & (conf<bins[i+1])
    if I.sum()==0: continue
    acc = (preds[I]==y[I]).mean()
    c   = conf[I].mean()
    e  += (I.sum()/n) * abs(acc - c)
  return float(e)
ece_raw  = ece(probs, yva)
ece_temp = ece(temp_calibrate(probs, bestT), yva)

report = {
  "n_valid": int(len(yva)),
  "logloss_raw": logloss,
  "logloss_temp": bestLL,
  "top1_raw": top1,
  "ece_raw": ece_raw,
  "ece_temp": ece_temp,
  "classes": PITCHES,
  "pass": (top1 >= 0.35)
}
with open(os.path.join(args.out,"report.json"),"w") as f: json.dump(report, f, indent=2)
with open(os.path.join(args.out,"features.json"),"w") as f: json.dump(FEATURES, f)

# ONNX 変換
onnx = convert_sklearn(clf, initial_types=[("input", FloatTensorType([None, len(FEATURES)]))],
target_opset=args.opset)
with open(os.path.join(args.out,"model.onnx"),"wb") as f: f.write(onnx.SerializeToString())
with open(os.path.join(args.out,"calibration.json"),"w") as f: json.dump(calib, f, indent=2)

print(json.dumps(report, indent=2))