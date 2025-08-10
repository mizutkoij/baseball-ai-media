import { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import ShareButton from "@/components/ShareButton";
import { Trophy, Calendar, TrendingUp } from 'lucide-react';

export const metadata: Metadata = {
  title: "NPB 順位表 — Baseball AI Media",
  description: "セ・パ両リーグの最新順位。PF補正の理解導線つきで、チームページ・比較ページへ直行できます。",
  alternates: { canonical: "https://baseball-ai-media.vercel.app/standings" },
  openGraph: { title: "NPB 順位表", url: "https://baseball-ai-media.vercel.app/standings", type: "website" },
};

type TeamRow = {
  team_id: string; team_name: string;
  wins: number; losses: number; ties?: number;
  win_pct: number;
  wRC_plus?: number; ERA_minus?: number; pf?: number;
  link?: string;
};

type SeasonJson = {
  year: number;
  leagues: {
    central: TeamRow[];
    pacific: TeamRow[];
  };
};

function y(param?: string | string[]) {
  const n = Number(Array.isArray(param) ? param[0] : param);
  return Number.isFinite(n) ? n : new Date().getFullYear();
}

async function getSeason(year: number): Promise<SeasonJson | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/seasons/${year}/index.json`, {
      // 既存の生成JSONをISR的に活用（1h再検証）
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Page({ searchParams }: { searchParams: { year?: string } }) {
  const year = y(searchParams?.year);
  const data = await getSeason(year);

  const breadcrumb = [
    { "@type": "ListItem", position: 1, name: "ホーム", item: "https://baseball-ai-media.vercel.app/" },
    { "@type": "ListItem", position: 2, name: "順位表", item: "https://baseball-ai-media.vercel.app/standings" },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <JsonLd type="BreadcrumbList" data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumb }} />
      <JsonLd
        type="CollectionPage"
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `NPB順位表 ${year}`,
          mainEntityOfPage: `https://baseball-ai-media.vercel.app/standings?year=${year}`,
        }}
      />

      <header className="flex items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-600" />
            NPB 順位表（{year}）
          </h1>
          <p className="text-slate-600">
            セ・パ両リーグの最新順位とPF（パークファクター）補正値。チーム詳細・比較分析へ直接アクセス可能
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <form method="GET" action="/standings" className="flex items-center gap-2">
            <label className="text-sm text-slate-600 hidden sm:block">年:</label>
            <select
              name="year"
              defaultValue={year}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
              onChange={(e) => e.currentTarget.form?.submit()}
            >
              {Array.from({ length: 10 }).map((_, i) => {
                const yy = new Date().getFullYear() - i;
                return <option key={yy} value={yy}>{yy}</option>;
              })}
            </select>
          </form>
          
          <ShareButton 
            url={`https://baseball-ai-media.vercel.app/standings?year=${year}`}
            title={`NPB順位表 ${year}`}
            text={`${year}年のNPB順位表をチェック`}
            size="sm"
          />
        </div>
      </header>

      {!data ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-600">⚠️</span>
            <h3 className="font-medium text-amber-800">データ準備中</h3>
          </div>
          <p className="text-amber-700 mb-3">
            {year}年の順位データがまだありません。
          </p>
          <Link 
            href={`/seasons/${year}`}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            📊 {year}年シーズンデータを生成
          </Link>
        </div>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            <LeagueTable title="セ・リーグ" rows={data.leagues.central} year={year} />
            <LeagueTable title="パ・リーグ" rows={data.leagues.pacific} year={year} />
          </div>

          {/* クイックアクションパネル */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">📊 さらに詳しく分析</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link
                href={`/compare/teams?year=${year}&teams=T,H,C,G&pf=true`}
                className="flex items-center gap-3 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">⚖️</span>
                <div>
                  <div className="font-medium text-slate-900">チーム比較</div>
                  <div className="text-sm text-slate-600">PF補正込みで実力差を分析</div>
                </div>
              </Link>
              
              <Link
                href="/analytics"
                className="flex items-center gap-3 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">📈</span>
                <div>
                  <div className="font-medium text-slate-900">高度分析</div>
                  <div className="text-sm text-slate-600">wRC+・ERA-詳細データ</div>
                </div>
              </Link>
              
              <Link
                href="/matchups"
                className="flex items-center gap-3 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">⚔️</span>
                <div>
                  <div className="font-medium text-slate-900">対戦分析</div>
                  <div className="text-sm text-slate-600">チーム間相性・H2H成績</div>
                </div>
              </Link>
            </div>
          </div>
        </>
      )}

      <section className="bg-slate-50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">💡 順位表の読み方</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-slate-800 mb-2">基本指標</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li><strong>勝率</strong>: 勝利数 ÷ (勝利数 + 敗戦数)</li>
              <li><strong>PF (Park Factor)</strong>: 球場の得点環境。1.00が中立、&gt;1.00は打高</li>
              <li><strong>wRC+</strong>: 攻撃力指標。100がリーグ平均、110なら平均より10%上</li>
              <li><strong>ERA-</strong>: 投手力指標。100がリーグ平均、90なら平均より10%良</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-slate-800 mb-2">分析のコツ</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>勝率とPFが乖離する場合は本拠地の影響が大きい可能性</li>
              <li>
                <Link href="/compare/teams?pf=true" className="text-blue-600 hover:text-blue-800 underline">
                  PF補正ON
                </Link>
                で中立環境での実力を比較
              </li>
              <li>wRC+ &gt; 110 かつ ERA- &lt; 90 なら総合力が高い</li>
              <li>詳細は <Link href="/about/methodology" className="text-blue-600 hover:text-blue-800 underline">分析手法</Link> を参照</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

function LeagueTable({ title, rows, year }: { title: string; rows: TeamRow[]; year: number }) {
  const sorted = [...(rows ?? [])].sort((a, b) => b.win_pct - a.win_pct);
  
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-100">
            <tr className="text-left text-sm text-slate-600">
              <th className="px-6 py-3 font-medium">順位</th>
              <th className="px-6 py-3 font-medium">チーム</th>
              <th className="px-6 py-3 font-medium text-center">勝</th>
              <th className="px-6 py-3 font-medium text-center">敗</th>
              <th className="px-6 py-3 font-medium text-center">分</th>
              <th className="px-6 py-3 font-medium text-center">勝率</th>
              <th className="px-6 py-3 font-medium text-center hidden md:table-cell">PF</th>
              <th className="px-6 py-3 font-medium text-center hidden lg:table-cell">wRC+</th>
              <th className="px-6 py-3 font-medium text-center hidden lg:table-cell">ERA-</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sorted.map((t, i) => (
              <tr key={t.team_id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                    i < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Link
                    href={`/teams/${year}/${t.team_id}`}
                    className="inline-flex items-center gap-3 font-medium text-slate-900 hover:text-blue-600 transition-colors"
                  >
                    <span 
                      className="inline-block w-4 h-4 rounded-full border border-slate-300" 
                      style={{ backgroundColor: teamColor(t.team_id) }}
                    />
                    {t.team_name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-center font-medium">{t.wins}</td>
                <td className="px-6 py-4 text-center font-medium">{t.losses}</td>
                <td className="px-6 py-4 text-center text-slate-500">{t.ties ?? 0}</td>
                <td className="px-6 py-4 text-center">
                  <span className="font-mono font-semibold">
                    {t.win_pct.toFixed(3).slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center hidden md:table-cell">
                  {t.pf ? (
                    <span className={`font-mono ${Math.abs(t.pf - 1) > 0.05 ? 
                      t.pf > 1 ? 'text-red-600' : 'text-blue-600' : 
                      'text-slate-600'
                    }`}>
                      {t.pf.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center hidden lg:table-cell">
                  {t.wRC_plus ? (
                    <span className={`font-mono ${
                      t.wRC_plus > 105 ? 'text-green-600' : 
                      t.wRC_plus < 95 ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      {t.wRC_plus}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center hidden lg:table-cell">
                  {t.ERA_minus ? (
                    <span className={`font-mono ${
                      t.ERA_minus < 95 ? 'text-green-600' : 
                      t.ERA_minus > 105 ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      {t.ERA_minus}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          * PFは球場影響の目安。詳細は{" "}
          <Link href="/column/park-factors" className="text-blue-600 hover:text-blue-800 underline">
            PFガイド
          </Link>{" "}
          を参照
        </p>
      </div>
    </section>
  );
}

// チームカラー辞書 - 既存の定義があればそれを使用
function teamColor(teamId: string): string {
  const colorMap: Record<string, string> = {
    // セリーグ
    T: "#FFCC00",  // 阪神タイガース（黄色）
    G: "#FF6A00",  // 読売ジャイアンツ（オレンジ）
    C: "#C20000",  // 広島カープ（赤）
    DB: "#007AC3", // DeNAベイスターズ（青）
    S: "#1F8A70",  // ヤクルトスワローズ（緑）
    D: "#0C3C89",  // 中日ドラゴンズ（紺）
    
    // パリーグ
    H: "#000000",  // ソフトバンクホークス（黒）
    L: "#004098",  // 西武ライオンズ（青）
    E: "#6C1D45",  // 楽天イーグルス（臙脂）
    M: "#222222",  // ロッテマリーンズ（黒）
    F: "#0074C0",  // 日本ハムファイターズ（青）
    Bs: "#001E61", // オリックスバファローズ（紺）
  };
  
  return colorMap[teamId] ?? "#6B7280";
}