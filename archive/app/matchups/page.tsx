import { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import ShareButton from "@/components/ShareButton";
import StartingPitchers from "@/components/StartingPitchers";

export const metadata: Metadata = {
  title: "対戦分析（直近10試合） — Baseball AI Media",
  description: "指定2球団の直近10試合H2H、得失点、直近フォーム、簡易PFコメントを表示。",
  alternates: { canonical: "https://baseball-ai-media.vercel.app/matchups" },
  openGraph: { title: "対戦分析", url: "https://baseball-ai-media.vercel.app/matchups", type: "website" },
};

type Game = {
  game_id:string; date:string; home_team:string; away_team:string;
  home_runs:number; away_runs:number; league?:string; pf_hint?:number;
};

function y(v?: string|string[]) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : new Date().getFullYear();
}
function parseTeams(v?: string|string[]) {
  const s = (Array.isArray(v) ? v[0] : v)?.split(",") ?? [];
  return Array.from(new Set(s.map(x=>x.trim()).filter(Boolean))).slice(0,2);
}

async function getSchedule(year:number, t1?:string, t2?:string): Promise<Game[]> {
  const qs = new URLSearchParams({ year:String(year), teams: [t1,t2].filter(Boolean).join(",") });
  // 既存拡張APIを優先（あなたの環境に合わせてあります）
  const url = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/schedule?${qs.toString()}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.games ?? [];
  } catch { return []; }
}

function h2h(g:Game[], t1:string, t2:string) {
  const between = g.filter(x =>
    (x.home_team===t1 && x.away_team===t2) || (x.home_team===t2 && x.away_team===t1)
  ).slice(0, 10); // 直近10
  const sum = between.reduce((a,x)=>{
    const t1Runs = x.home_team===t1 ? x.home_runs : x.away_runs;
    const t2Runs = x.home_team===t2 ? x.home_runs : x.away_runs;
    a.t1 += t1Runs; a.t2 += t2Runs;
    const t1Win = t1Runs>t2Runs;
    a.w1 += t1Win?1:0; a.w2 += t1Win?0:1;
    return a;
  }, { t1:0, t2:0, w1:0, w2:0 });
  return { between, sum };
}

export default async function Page({ searchParams }:{ searchParams:{ year?:string; teams?:string }}) {
  const year = y(searchParams?.year);
  const [t1, t2] = parseTeams(searchParams?.teams);
  const breadcrumb = [
    { "@type":"ListItem", position:1, name:"ホーム", item:"https://baseball-ai-media.vercel.app/" },
    { "@type":"ListItem", position:2, name:"対戦分析", item:"https://baseball-ai-media.vercel.app/matchups" },
  ];

  const games = (t1 && t2) ? await getSchedule(year, t1, t2) : [];
  const { between, sum } = (t1 && t2) ? h2h(games, t1, t2) : { between:[], sum:{t1:0,t2:0,w1:0,w2:0} };
  const pfNote = between.length ? pfComment(between) : null;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <JsonLd type="BreadcrumbList" data={{ "@context":"https://schema.org","@type":"BreadcrumbList", itemListElement: breadcrumb }} />
      
      <header className="flex items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            対戦分析（直近10試合）
          </h1>
          <p className="text-slate-600">
            2チーム間の直近H2H成績、得失点差、PF影響を簡易分析
          </p>
        </div>
        
        <ShareButton 
          url={`https://baseball-ai-media.vercel.app/matchups${t1 && t2 ? `?year=${year}&teams=${t1},${t2}` : ''}`}
          title="NPB対戦分析"
          text={t1 && t2 ? `${t1} vs ${t2} の直近対戦成績` : "NPB対戦分析ツール"}
          size="sm"
        />
      </header>

      {/* 検索フォーム */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">📊 対戦チーム選択</h2>
        <form method="GET" action="/matchups" className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-sm font-medium text-slate-700 mb-2">年度</label>
            <select 
              name="year" 
              defaultValue={year} 
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              {Array.from({length:10}).map((_,i)=> {
                const yy = new Date().getFullYear()-i; 
                return <option key={yy} value={yy}>{yy}</option>;
              })}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              チーム（2つカンマ区切り）
            </label>
            <input 
              name="teams" 
              placeholder="例: G,H (巨人vs阪神)" 
              defaultValue={searchParams?.teams ?? ""} 
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors">
            分析開始
          </button>
        </form>
      </div>

      {!t1 || !t2 ? (
        <Preset year={year}/>
      ) : between.length===0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-600">⚠️</span>
            <h3 className="font-medium text-amber-800">データが見つかりません</h3>
          </div>
          <p className="text-amber-700">
            {year}年の {t1} vs {t2} の対戦データが見つかりません。
          </p>
        </div>
      ) : (
        <>
          {/* 対戦サマリ */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {t1} vs {t2} — 直近{between.length}試合サマリ
              </h2>
              <div className="text-sm text-slate-500">
                {year}年
              </div>
            </div>
            
            <div className="grid sm:grid-cols-3 gap-6">
              <StatCard 
                label={`${t1} 勝利`} 
                value={sum.w1} 
                color="text-blue-600"
              />
              <StatCard 
                label={`${t2} 勝利`} 
                value={sum.w2} 
                color="text-red-600"
              />
              <StatCard 
                label="得点差" 
                value={`${sum.t1 > sum.t2 ? '+' : ''}${sum.t1 - sum.t2}`}
                color={sum.t1 > sum.t2 ? "text-green-600" : sum.t1 < sum.t2 ? "text-red-600" : "text-slate-600"}
                subtitle={`${sum.t1} - ${sum.t2}`}
              />
            </div>
            
            {pfNote && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-slate-800 mb-1">🏟️ PF影響メモ</h4>
                <p className="text-sm text-slate-700">{pfNote}</p>
              </div>
            )}
          </div>

          {/* 詳細試合一覧 */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-8">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">直近{between.length}試合一覧</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-100">
                  <tr className="text-left text-sm text-slate-600">
                    <th className="px-6 py-3 font-medium">日付</th>
                    <th className="px-6 py-3 font-medium">カード</th>
                    <th className="px-6 py-3 font-medium text-center">スコア</th>
                    <th className="px-6 py-3 font-medium">予告先発</th>
                    <th className="px-6 py-3 font-medium">詳細</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {between.map(g=> {
                    const card = `${g.away_team} @ ${g.home_team}`;
                    const score = `${g.away_runs}-${g.home_runs}`;
                    const winner = g.home_runs > g.away_runs ? g.home_team : 
                                  g.away_runs > g.home_runs ? g.away_team : null;
                    
                    return (
                      <tr key={g.game_id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm">
                          {g.date?.slice(0,10) || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {card}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-mono font-semibold">
                            {score}
                          </span>
                          {winner && (
                            <div className="text-xs text-slate-500 mt-1">
                              {winner} 勝利
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <StartingPitchers 
                            gameId={g.game_id} 
                            home={g.home_team} 
                            away={g.away_team}
                            compact={true}
                          />
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Link 
                            href={`/games/${g.game_id}`}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            試合詳細
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* さらに詳しく分析パネル */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">🔍 さらに詳しく分析</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link
                href={`/teams/compare?year=${year}&teams=${[t1,t2].join(",")}&pf=true`}
                className="flex items-center gap-3 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">⚖️</span>
                <div>
                  <div className="font-medium text-slate-900">チーム詳細比較</div>
                  <div className="text-sm text-slate-600">PF補正・セイバー指標</div>
                </div>
              </Link>
              
              <Link
                href="/standings"
                className="flex items-center gap-3 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">🏆</span>
                <div>
                  <div className="font-medium text-slate-900">順位表</div>
                  <div className="text-sm text-slate-600">全チーム順位・勝率</div>
                </div>
              </Link>
              
              <Link
                href="/analytics"
                className="flex items-center gap-3 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl">📊</span>
                <div>
                  <div className="font-medium text-slate-900">高度分析</div>
                  <div className="text-sm text-slate-600">選手・チーム統計</div>
                </div>
              </Link>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({label, value, color = "text-slate-900", subtitle}:{
  label:string; value:number|string; color?:string; subtitle?:string;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-4 text-center">
      <div className="text-sm text-slate-600 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function Preset({ year }:{ year:number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">🔥 人気の対戦カード</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <PresetCard 
          title="巨人 × 阪神" 
          subtitle="伝統の一戦"
          href={`/matchups?year=${year}&teams=G,T`}
        />
        <PresetCard 
          title="阪神 × オリックス" 
          subtitle="関西ダービー"
          href={`/matchups?year=${year}&teams=T,Bs`}
        />
        <PresetCard 
          title="ソフトバンク × 西武" 
          subtitle="九州 vs 埼玉"
          href={`/matchups?year=${year}&teams=H,L`}
        />
        <PresetCard 
          title="ヤクルト × 中日" 
          subtitle="セ・リーグライバル"
          href={`/matchups?year=${year}&teams=S,D`}
        />
        <PresetCard 
          title="DeNA × 広島" 
          subtitle="新旧の力"
          href={`/matchups?year=${year}&teams=DB,C`}
        />
        <PresetCard 
          title="日ハム × ロッテ" 
          subtitle="若手育成対決"
          href={`/matchups?year=${year}&teams=F,M`}
        />
      </div>
      
      <div className="mt-6 text-sm text-slate-600">
        <p>
          💡 <strong>使い方:</strong> 上のカードをクリックするか、フォームにチーム略称を入力（G,T,H,L,S,D,C,DB,Bs,F,M,E）
        </p>
      </div>
    </div>
  );
}

function PresetCard({title, subtitle, href}: {title:string; subtitle:string; href:string}) {
  return (
    <Link 
      href={href}
      className="block p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
    >
      <div className="font-medium text-slate-900 mb-1">{title}</div>
      <div className="text-sm text-slate-600">{subtitle}</div>
    </Link>
  );
}

function pfComment(g: Game[]): string | null {
  // 雑なヒント：開催球場のPFヒント平均（無ければコメント省略）
  const vals = g.map(x=>x.pf_hint).filter((n):n is number=> Number.isFinite(n));
  if (!vals.length) return null;
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
  if (avg>1.03) return "やや打高環境。wRC+での比較が有効。";
  if (avg<0.97) return "やや投高環境。ERA-やFIP-での比較が有効。";
  return "概ね中立。PF ON/OFFの両方で確認すると安心。";
}