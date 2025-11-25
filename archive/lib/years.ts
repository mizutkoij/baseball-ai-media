export function getRankingYears(): number[] {
  // 直近10年。必要なら DB/JSON から動的取得に差し替え可
  const end = new Date().getFullYear();
  const start = end - 9;
  const out: number[] = [];
  for (let y = start; y <= end; y++) out.push(y);
  return out;
}

export function normalizeYear(input?: string | null, fallback?: number) {
  const n = Number(input);
  return Number.isFinite(n) && String(n).length === 4 ? n : (fallback ?? new Date().getFullYear());
}