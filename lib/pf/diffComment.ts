type Dir = "up" | "down" | "flat";

/**
 * PF補正前後の指標差分を分析し、ユーザー向けコメントを生成
 * 
 * @param metric - 指標名 (wRC+, OPS+, ERA-, FIP-)
 * @param raw - 補正前の値
 * @param neutral - 補正後の値
 * @param pf - パークファクター
 * @param threshold - 「ほぼ同等」とみなす閾値 (デフォルト1.5%)
 * @returns コメントテキスト、方向性、変化率
 */
export function pfDiffComment(
  metric: string, 
  raw: number, 
  neutral: number, 
  pf: number, 
  threshold = 0.015
) {
  const delta = neutral - raw; // +: PF補正で評価↑（打撃系）、投手系は逆向きに注意
  const pct = raw ? delta / Math.abs(raw) : 0;
  const dir: Dir = Math.abs(pct) < threshold ? "flat" : pct > 0 ? "up" : "down";
  const sign = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
  const pfHint = pf > 1.02 ? "打高傾向" : pf < 0.98 ? "投高傾向" : "中立";
  const pctStr = `${(Math.abs(pct) * 100).toFixed(1)}%`;

  // 投手指標（ERA-, FIP-）は数値が下がる方が良いので表現を調整
  const verb =
    metric === "ERA-" || metric === "FIP-"
      ? dir === "up" ? "悪化" : dir === "down" ? "改善" : "同等"
      : dir === "up" ? "上方補正" : dir === "down" ? "下方補正" : "ほぼ同等";

  const text = `${metric}: PF補正で${verb} ${sign}（差分 ${pctStr}, 球場:${pfHint}）`;
  
  return { text, dir, pct: Math.abs(pct) };
}