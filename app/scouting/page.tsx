import Link from 'next/link';
import { Activity, Calendar, TrendingUp, Target } from 'lucide-react';

export const metadata = {
  title: 'スカウティングレポート | YakyuLab',
  description: 'NPB先発投手の対戦相手別データ駆動スカウティング。球種・配球・トラッキングデータから攻略ポイントを抽出。',
};

// ISR — pre-render at build then revalidate every 30 min
export const revalidate = 1800;

type ListEntry = {
  pitcher_slug: string;
  team_slug: string;
  pitcher_name_ja: string;
  team_name_ja: string;
  game_date: string;
  headline: string;
  confidence: 'low' | 'medium' | 'high';
  finding_count: number;
  og_image_url: string | null;
  generated_at: string;
};

async function fetchReports(): Promise<ListEntry[]> {
  const base = process.env.SCOUTING_API_URL || 'http://localhost:3001';
  try {
    const res = await fetch(`${base}/api/scouting?limit=30`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reports ?? [];
  } catch {
    return [];
  }
}

const CONFIDENCE_BADGE: Record<ListEntry['confidence'], string> = {
  high: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-600',
};

export default async function ScoutingIndex() {
  const reports = await fetchReports();

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Target className="w-7 h-7 text-orange-600" />
          スカウティングレポート
        </h1>
        <p className="text-gray-600 mt-2">
          NPB 先発投手 × 対戦相手の攻略レポート。球種構成・打席別配球・トラッキングデータ（打球速度・角度・距離）を統合し、戦略ポイントを抽出します。
        </p>
      </header>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>まだレポートがありません。先発投手のスケジュール反映後に自動生成されます。</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <Link
              key={`${r.pitcher_slug}-${r.team_slug}-${r.game_date}`}
              href={`/scouting/${r.pitcher_slug}/vs/${r.team_slug}/${r.game_date}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-lg font-semibold">
                  {r.pitcher_name_ja}
                  <span className="text-gray-400 mx-2">vs</span>
                  {r.team_name_ja}
                </h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${CONFIDENCE_BADGE[r.confidence]}`}>
                  {r.confidence}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {r.game_date}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {r.finding_count} 戦略ポイント
                </span>
              </div>

              <p className="text-sm text-gray-700 line-clamp-2">{r.headline}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
