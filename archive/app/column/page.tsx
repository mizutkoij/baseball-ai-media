import Link from "next/link";
import { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import ShareButton from "@/components/ShareButton";

export const metadata: Metadata = {
  title: "コラム一覧 — Baseball AI Media",
  description: "RE24の実践ガイドやOPS+とwRC+の使い分けなど、NPB分析の読み物をまとめました。",
  alternates: { canonical: "https://baseball-ai-media.vercel.app/column" },
  openGraph: {
    title: "コラム一覧 — Baseball AI Media",
    description: "NPBの\"使える分析\"を短時間で学べる記事をまとめました。",
    url: "https://baseball-ai-media.vercel.app/column",
    type: "website",
  },
};

const articles = [
  {
    slug: "re24-winning-lines",
    title: "RE24で読む『勝ち筋』—昨日の采配を定量で振り返る",
    desc: "RE24とWPAで\"どの場面が勝敗を動かしたか\"を3分で復習。",
    published: "2025-08-03",
    tags: ["RE24", "WPA", "試合分析"],
  },
  {
    slug: "opsplus-vs-wrcplus",
    title: "OPS+ と wRC+ の違い—NPBではどちらを使うべき？",
    desc: "速報はOPS+／評価はwRC+（PF ON推奨）。目的別の使い分けを整理。",
    published: "2025-08-03",
    tags: ["OPS+", "wRC+", "指標解説"],
  },
];

export default function ColumnIndexPage() {
  const url = "https://baseball-ai-media.vercel.app/column";
  const breadcrumb = [
    { "@type": "ListItem", position: 1, name: "ホーム", item: "https://baseball-ai-media.vercel.app/" },
    { "@type": "ListItem", position: 2, name: "コラム", item: url },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <JsonLd type="BreadcrumbList" data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumb }} />
      <JsonLd
        type="CollectionPage"
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "コラム一覧",
          mainEntity: articles.map(a => ({
            "@type": "Article",
            headline: a.title,
            mainEntityOfPage: `https://baseball-ai-media.vercel.app/column/${a.slug}`,
            datePublished: a.published,
            keywords: a.tags.join(", ")
          })),
        }}
      />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">コラム一覧</h1>
        <p className="text-slate-600">
          NPBの"使える分析"を短時間で学べる記事をまとめました。セイバーメトリクスの実践的な活用方法から指標の使い分けまで、
          データ分析の実務に役立つ情報を提供しています。
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {articles.map(article => (
          <article key={article.slug} className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg transition-shadow">
            <div className="mb-3">
              <div className="flex flex-wrap gap-2 mb-2">
                {article.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">
                    {tag}
                  </span>
                ))}
              </div>
              <time className="text-xs text-slate-500">{article.published}</time>
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-3 leading-tight">
              <Link href={`/column/${article.slug}`} className="hover:text-blue-600 transition-colors">
                {article.title}
              </Link>
            </h2>
            
            <p className="text-slate-600 mb-4 leading-relaxed">
              {article.desc}
            </p>
            
            <div className="flex items-center justify-between">
              <Link 
                href={`/column/${article.slug}`}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                読む
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              
              <ShareButton 
                url={`https://baseball-ai-media.vercel.app/column/${article.slug}`}
                title={article.title}
                text={article.desc}
                size="sm"
                enableShortUrl={true}
              />
            </div>
          </article>
        ))}
      </div>

      {/* 関連リンク */}
      <div className="mt-12 bg-slate-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">さらに詳しく分析</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/analytics" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
            <span>📊</span>
            高度分析ダッシュボード
          </Link>
          <Link href="/players/compare" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
            <span>⚖️</span>
            選手比較ツール
          </Link>
          <Link href="/about/methodology" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
            <span>🔬</span>
            分析手法・係数一覧
          </Link>
        </div>
      </div>
    </main>
  );
}