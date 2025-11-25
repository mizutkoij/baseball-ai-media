import type { Metric } from "@/components/MetricTabs";

export function normalizeMetric(input?: string | string[] | null): Metric {
  const v = Array.isArray(input) ? input[0] : input;
  if (v === "batting" || v === "pitching" || v === "fielding") return v;
  return "batting";
}

export const METRIC_TITLES: Record<Metric, string> = {
  batting: "打者リーダーズ",
  pitching: "投手リーダーズ",
  fielding: "守備リーダーズ",
};