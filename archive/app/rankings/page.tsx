import { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import ShareButton from "@/components/ShareButton";
import YearTabs from "@/components/YearTabs";
import MetricTabs from "@/components/MetricTabs";
import { getRankingYears, normalizeYear } from "@/lib/years";
import { normalizeMetric, METRIC_TITLES } from "@/lib/metrics";

// 動的メタデータ生成（年度対応）
export async function generateMetadata({
  searchParams,
}: {
  searchParams: { year?: string; metric?: string | string[] };
}): Promise<Metadata> {
  const years = getRankingYears();
  const currentYear = years[years.length - 1];
  const year = normalizeYear(searchParams?.year, currentYear);
  const metric = normalizeMetric(searchParams?.metric);

  const title = `${METRIC_TITLES[metric]}（${year}年） — Baseball AI Media`;
  const url = `https://baseball-ai-media.vercel.app/rankings?year=${year}&metric=${metric}`;
  const description = `${year}年の${METRIC_TITLES[metric]}。wRC+・OPS+・ERA-・FIP-などの主要指標TOP20を網羅。PF補正の解説や選手比較への導線も完備。`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { 
      title, 
      description,
      url, 
      type: "website",
      images: [{ url: "https://baseball-ai-media.vercel.app/icon.png" }],
    },
  };
}

type Batter = { player_id:string; name:string; team_id:string; wRC_plus?:number; OPS_plus?:number; HR?:number; };
type Pitcher = { player_id:string; name:string; team_id:string; ERA_minus?:number; FIP_minus?:number; K_per_9?:number; };
type SeasonJson = {
  year:number;
  leaders?: { batters?: Batter[]; pitchers?: Pitcher[] };
  // フォールバック（無い場合は空配列に）
};

function y(v?: string|string[]) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : new Date().getFullYear();
}

async function getSeason(year:number): Promise<SeasonJson|null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/seasons/${year}/index.json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function topN<T>(arr: (T|undefined)[] = [], key: (x:T)=>number|undefined, n=20) {
  return (arr.filter(Boolean) as T[])
    .map(x => ({ x, v: key(x as T) ?? -Infinity }))
    .filter(r => Number.isFinite(r.v))
    .sort((a,b)=>b.v-a.v)
    .slice(0,n)
    .map(r=>r.x);
}

export default async function Page({ searchParams }: { searchParams: { year?: string; metric?: string | string[] } }) {
  const years = getRankingYears();
  const currentYear = years[years.length - 1];
  const year = normalizeYear(searchParams?.year, currentYear);
  const metric = normalizeMetric(searchParams?.metric);
  const data = await getSeason(year);

  const batters = data?.leaders?.batters ?? [];
  const pitchers = data?.leaders?.pitchers ?? [];

  const wr = topN(batters, b=>b.wRC_plus, 20);
  const ops = topN(batters, b=>b.OPS_plus, 20);
  const hr  = topN(batters, b=>b.HR, 20);

  const era = topN(pitchers, p=>p.ERA_minus ? -p.ERA_minus : undefined, 20); // 小さいほど良い→符号反転
  const fip = topN(pitchers, p=>p.FIP_minus ? -p.FIP_minus : undefined, 20);
  const k9  = topN(pitchers, p=>p.K_per_9, 20);

  const breadcrumb = [
    { "@type":"ListItem", position:1, name:"ホーム", item:"https://baseball-ai-media.vercel.app/" },
    { "@type":"ListItem", position:2, name:"リーダーズ", item:"https://baseball-ai-media.vercel.app/rankings" },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <JsonLd type="BreadcrumbList" data={{ "@context":"https://schema.org","@type":"BreadcrumbList", itemListElement: breadcrumb }} />
      <JsonLd type="CollectionPage" data={{ "@context":"https://schema.org","@type":"CollectionPage", name:`NPB リーダーズ ${year}` }} />

      <header className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              NPB リーダーズ（{year}）
            </h1>
            <p className="text-slate-600">
              wRC+・ERA-等の主要指標TOP20。PF補正の影響と選手比較への導線付き
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <ShareButton 
              url={`https://baseball-ai-media.vercel.app/rankings?year=${year}&metric=${metric}`}
              title={`${METRIC_TITLES[metric]} ${year}`}
              text={`${year}年の${METRIC_TITLES[metric]}`}
              size="sm"
            />
          </div>
        </div>
        
        {/* 年度タブ */}
        <YearTabs years={years} activeYear={year} />
        
        {/* 指標タブ */}
        <div className="mt-4">
          <MetricTabs
            active={metric}
            available={["batting", "pitching"]}
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
            {year}年のランキングデータがまだありません。
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
          {metric === "batting" && (
            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              <Section title="🏏 打者 wRC+ TOP20" hint="* PF補正ON推奨（実力評価向け）">
                <SimpleTable rows={wr} cols={[
                  { k:"name", label:"選手"},
                  { k:"team_id", label:"球団"},
                  { k:"wRC_plus", label:"wRC+"},
                ]} year={year} kind="batter"/>
              </Section>

              <Section title="📊 打者 OPS+ / HR TOP20">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">OPS+ TOP20</h4>
                    <SimpleTable rows={ops} cols={[
                      {k:"name",label:"選手"},
                      {k:"team_id",label:"球団"},
                      {k:"OPS_plus",label:"OPS+"}
                    ]} year={year} kind="batter"/>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">本塁打 TOP20</h4>
                    <SimpleTable rows={hr} cols={[
                      {k:"name",label:"選手"},
                      {k:"team_id",label:"球団"},
                      {k:"HR",label:"HR"}
                    ]} year={year} kind="batter"/>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {metric === "pitching" && (
            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              <Section title="⚾ 投手 ERA- TOP20" hint="* 小さいほど良い">
                <SimpleTable rows={era} cols={[
                  { k:"name", label:"選手"},
                  { k:"team_id", label:"球団"},
                  { k:"ERA_minus", label:"ERA-"},
                ]} year={year} kind="pitcher"/>
              </Section>

              <Section title="🎯 投手 FIP- / K/9 TOP20">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">FIP- TOP20</h4>
                    <SimpleTable rows={fip} cols={[
                      {k:"name",label:"選手"},
                      {k:"team_id",label:"球団"},
                      {k:"FIP_minus",label:"FIP-"}
                    ]} year={year} kind="pitcher"/>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">K/9 TOP20</h4>
                    <SimpleTable rows={k9} cols={[
                      {k:"name",label:"選手"},
                      {k:"team_id",label:"球団"},
                      {k:"K_per_9",label:"K/9"}
                    ]} year={year} kind="pitcher"/>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {metric === "fielding" && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-6 mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-600">⚡</span>
                <h3 className="font-medium text-blue-800">守備指標準備中</h3>
              </div>
              <p className="text-blue-700">
                守備指標の詳細データは現在準備中です。お楽しみに！
              </p>
            </div>
          )}

          {/* さらに詳しく分析パネル */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">🔍 さらに詳しく分析</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link
                href="/players/compare"
                className="flex items-center gap-3 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">⚖️</span>
                <div>
                  <div className="font-medium text-slate-900">選手比較ツール</div>
                  <div className="text-sm text-slate-600">年別推移・PF補正比較</div>
                </div>
              </Link>
              
              <Link
                href="/analytics"
                className="flex items-center gap-3 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">📈</span>
                <div>
                  <div className="font-medium text-slate-900">高度分析</div>
                  <div className="text-sm text-slate-600">137名詳細データ</div>
                </div>
              </Link>
              
              <Link
                href="/standings"
                className="flex items-center gap-3 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">🏆</span>
                <div>
                  <div className="font-medium text-slate-900">チーム順位</div>
                  <div className="text-sm text-slate-600">チーム別成績・PF影響</div>
                </div>
              </Link>
            </div>
          </div>
        </>
      )}

      <section className="bg-slate-50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">💡 指標の読み方</h2>
        
        {metric === "batting" && (
          <div>
            <h3 className="font-medium text-slate-800 mb-2">打者指標</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li><strong>wRC+</strong>: 得点創出力（PF補正推奨）。100=平均、120=平均より20%上</li>
              <li><strong>OPS+</strong>: 出塁率＋長打率の相対化。軽量で直感的</li>
              <li><strong>HR</strong>: 本塁打数。球場・気候の影響大</li>
            </ul>
          </div>
        )}

        {metric === "pitching" && (
          <div>
            <h3 className="font-medium text-slate-800 mb-2">投手指標</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li><strong>ERA-</strong>: 防御率の相対化。100=平均、90=平均より10%良</li>
              <li><strong>FIP-</strong>: 守備独立系投手評価。運の要素を除外</li>
              <li><strong>K/9</strong>: 9イニングあたり奪三振数</li>
            </ul>
          </div>
        )}

        {metric === "fielding" && (
          <div>
            <h3 className="font-medium text-slate-800 mb-2">守備指標</h3>
            <p className="text-sm text-slate-600">
              守備指標の詳細解説は準備中です。
            </p>
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="text-sm text-slate-600">
            詳しい定義は{" "}
            <Link href="/about/methodology" className="text-blue-600 hover:text-blue-800 underline">
              分析手法
            </Link>
            、個別推移は{" "}
            <Link href="/players/compare" className="text-blue-600 hover:text-blue-800 underline">
              選手比較
            </Link>
            {" "}を参照してください。
          </p>
        </div>
      </section>
    </main>
  );
}

function Section({ title, hint, children }:{title:string; hint?:string; children:React.ReactNode}) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {hint && <span className="text-xs text-slate-500">{hint}</span>}
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

function SimpleTable({ rows, cols, year, kind }:{
  rows:any[]; cols:{k:string;label:string}[]; year:number; kind:"batter"|"pitcher";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-slate-500">
          <tr className="[&>th]:px-3 [&>th]:py-2 text-left border-b border-slate-200">
            {cols.map(c=> <th key={c.k} className="font-medium">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.slice(0, 10).map((r,i)=> (
            <tr key={`${r.player_id}-${i}`} className="[&>td]:px-3 [&>td]:py-2 hover:bg-slate-50">
              <td>
                <Link 
                  href={`/players/${r.player_id}`} 
                  className="font-medium text-slate-900 hover:text-blue-600 transition-colors underline decoration-dotted"
                >
                  {r.name}
                </Link>
              </td>
              <td>
                <Link 
                  href={`/teams/${year}/${r.team_id}`} 
                  className="text-blue-600 hover:text-blue-800 transition-colors font-mono text-xs"
                >
                  {r.team_id}
                </Link>
              </td>
              {cols.slice(2).map(c=> (
                <td key={c.k} className="font-mono">
                  {r[c.k] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {rows.length > 10 && (
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            TOP10表示中（全{rows.length}名）
          </p>
        </div>
      )}
    </div>
  );
}