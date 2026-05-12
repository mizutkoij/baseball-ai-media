import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity, Target, AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';
import PitchZoneHeatmap from './heatmap.client';
import EvLaScatter from './scatter.client';
import PitchMixChart from './mix.client';

// ISR — regenerate every 30 min
export const revalidate = 1800;

// Pre-render known reports at build time (best-effort)
export async function generateStaticParams() {
  const base = process.env.SCOUTING_API_URL || 'http://localhost:3001';
  try {
    const res = await fetch(`${base}/api/scouting-slugs`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.slugs ?? []).map((s: any) => ({
      pitcher: s.pitcher_slug,
      team: s.team_slug,
      date: s.game_date,
    }));
  } catch {
    return [];
  }
}

type Report = {
  pitcher_id_npbplus: number;
  opponent_team_id: number;
  game_date: string;
  pitcher_slug: string;
  team_slug: string;
  pitcher_name_ja: string;
  team_name_ja: string;
  season_year: number;
  generated_at: string;
  confidence: 'low' | 'medium' | 'high';
  payload: ReportPayload;
  og_image_url: string | null;
  headline: string;
  finding_count: number;
  meta_title: string;
  meta_description: string;
};

type ReportPayload = {
  meta: any;
  pitcher: {
    profile: any;
    arsenal: Array<{ pitchType: string; pct: string; avg_speed: string; max_speed: string; n: number }>;
    by_bat_side: Array<{ batSide: string; pitchType: string; pct: string; avg_speed: string }>;
    whiff_csw: any[];
    tracking: any[];
    barrels: any[];
    zones: any[];
    first_pitch: any[];
    k_pitch: any[];
  };
  opponent: {
    recent_lineup: any[];
    batting_stats: any[];
    vs_lhp: any[];
    vs_rhp: any[];
    tracking_history_vs_pitcher: any[];
  };
  model: {
    matchup_estimates: any[];
    primary_pitches: string[];
    put_away_pitch: string | null;
    barrel_zones_vs_l: number;
    barrel_zones_vs_r: number;
  };
  findings: Array<{
    priority: number;
    title: string;
    evidence: string;
    tags: string[];
    data: Record<string, any>;
  }>;
};

async function fetchReport(
  pitcher: string,
  team: string,
  date: string,
): Promise<Report | null> {
  const base = process.env.SCOUTING_API_URL || 'http://localhost:3001';
  try {
    const res = await fetch(`${base}/api/scouting/${pitcher}/${team}/${date}`, {
      next: { revalidate: 1800 },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Upstream error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[scouting] fetchReport failed:', err);
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { pitcher: string; team: string; date: string } },
): Promise<Metadata> {
  const r = await fetchReport(params.pitcher, params.team, params.date);
  if (!r) return { title: 'スカウティングレポート | YakyuLab' };
  return {
    title: r.meta_title,
    description: r.meta_description,
    openGraph: {
      title: r.meta_title,
      description: r.meta_description,
      images: r.og_image_url ? [{ url: r.og_image_url, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: r.meta_title,
      description: r.meta_description,
      images: r.og_image_url ? [r.og_image_url] : undefined,
    },
  };
}

const PRIORITY_BADGE: Record<number, string> = {
  1: 'bg-red-100 text-red-800 border-red-300',
  2: 'bg-orange-100 text-orange-800 border-orange-300',
  3: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  4: 'bg-gray-100 text-gray-700 border-gray-300',
};

export default async function ScoutingDetail({
  params,
}: {
  params: { pitcher: string; team: string; date: string };
}) {
  const report = await fetchReport(params.pitcher, params.team, params.date);
  if (!report) notFound();

  const { payload } = report;

  return (
    <main className="container mx-auto max-w-6xl px-4 py-6">
      <nav className="text-sm text-gray-500 mb-4 flex items-center gap-1">
        <Link href="/scouting" className="hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          スカウティング一覧
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">
          {report.pitcher_name_ja}
          <span className="text-gray-400 mx-3">vs</span>
          {report.team_name_ja}
        </h1>
        <p className="text-gray-500">{report.game_date} 試合用 • {report.season_year}シーズンデータ</p>
        <p className="mt-3 text-gray-700">{report.headline}</p>
      </header>

      {/* 戦略ハイライト */}
      {payload.findings && payload.findings.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-orange-600" />
            戦略ハイライト
          </h2>
          <ol className="space-y-3">
            {payload.findings.map((f, i) => (
              <li
                key={i}
                className={`rounded-lg border-l-4 p-4 bg-white ${PRIORITY_BADGE[f.priority] ?? PRIORITY_BADGE[4]}`}
              >
                <div className="flex items-start gap-3">
                  <span className="font-bold text-lg">{i + 1}.</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-1">
                      {f.title}
                      <span className="text-xs ml-2 px-2 py-0.5 rounded bg-white/70 border">
                        優先度 {f.priority}
                      </span>
                    </h3>
                    <p className="text-sm text-gray-700">{f.evidence}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 球種構成 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">球種構成</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border bg-white p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2">球種</th>
                  <th className="py-2 text-right">割合</th>
                  <th className="py-2 text-right">平均</th>
                  <th className="py-2 text-right">最速</th>
                </tr>
              </thead>
              <tbody>
                {payload.pitcher.arsenal.map((row) => (
                  <tr key={row.pitchType} className="border-t">
                    <td className="py-2 font-medium">{row.pitchType}</td>
                    <td className="py-2 text-right">{row.pct}%</td>
                    <td className="py-2 text-right">{row.avg_speed} km/h</td>
                    <td className="py-2 text-right">{row.max_speed} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-gray-500 mt-3">
              主球種: {payload.model.primary_pitches.join(', ') || '—'}
              {payload.model.put_away_pitch && ` / 決め球: ${payload.model.put_away_pitch}`}
            </div>
          </div>
          <PitchMixChart byBatSide={payload.pitcher.by_bat_side} />
        </div>
      </section>

      {/* ヒートマップ */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">球種別 投球コースヒートマップ</h2>
        <PitchZoneHeatmap zones={payload.pitcher.zones} />
      </section>

      {/* トラッキング */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-600" />
          トラッキング (EV × LA × Distance)
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          被弾質。EV が高くても LA が低ければゴロ、+8〜+32°のバレルゾーンが長打圏。
          対左: バレル {payload.model.barrel_zones_vs_l} 件 / 対右: {payload.model.barrel_zones_vs_r} 件
        </p>
        <EvLaScatter barrels={payload.pitcher.barrels} />

        <div className="mt-4 rounded-lg border bg-white p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">球種</th>
                <th className="py-2">対打席</th>
                <th className="py-2 text-right">BIP</th>
                <th className="py-2 text-right">平均EV</th>
                <th className="py-2 text-right">平均LA</th>
                <th className="py-2 text-right">飛距離</th>
              </tr>
            </thead>
            <tbody>
              {payload.pitcher.tracking.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2 font-medium">{row.pitch_type}</td>
                  <td className="py-2">{row.bat_side}</td>
                  <td className="py-2 text-right">{row.bip}</td>
                  <td className="py-2 text-right">{row.avg_ev} km/h</td>
                  <td className="py-2 text-right">{row.avg_la}°</td>
                  <td className="py-2 text-right">{row.avg_dist} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 相手チーム — 対左/対右 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">
          {report.team_name_ja} 打者陣 — 対{payload.pitcher.profile?.pitch_hand === '左' ? '左' : '右'}投手成績
        </h2>
        <div className="rounded-lg border bg-white p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">打者</th>
                <th className="py-2">打席</th>
                <th className="py-2 text-right">PA</th>
                <th className="py-2 text-right">AVG</th>
                <th className="py-2 text-right">HR</th>
                <th className="py-2 text-right">K</th>
              </tr>
            </thead>
            <tbody>
              {(payload.pitcher.profile?.pitch_hand === '左'
                ? payload.opponent.vs_lhp
                : payload.opponent.vs_rhp
              ).slice(0, 15).map((row: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="py-2 font-medium">{row.fullName}</td>
                  <td className="py-2">{row.bats}</td>
                  <td className="py-2 text-right">{row.pa}</td>
                  <td className="py-2 text-right">{row.avg}</td>
                  <td className="py-2 text-right">{row.hr}</td>
                  <td className="py-2 text-right">{row.so}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="text-xs text-gray-400 mt-12 pt-6 border-t flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>
          自動生成: {new Date(report.generated_at).toLocaleString('ja-JP')} • 信頼度: {report.confidence} •
          トラッキングは2025+のみ
        </span>
      </footer>
    </main>
  );
}
