import Link from "next/link";
import { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import ArticleViewBeacon from "@/components/ArticleViewBeacon";
import ArticleCta from "@/components/ArticleCta";

export const metadata: Metadata = {
  title: "OPS+ と wRC+ の違い—NPBではどちらを使うべき？",
  description:
    "似て非なるOPS+とwRC+。NPBの年別係数・パークファクターを踏まえ、どちらをどの目的で使うべきかを整理します。",
  alternates: { canonical: "https://baseball-ai-media.vercel.app/column/opsplus-vs-wrcplus" },
  openGraph: {
    title: "OPS+ と wRC+ の違い—NPBではどちらを使うべき？",
    description:
      "似て非なるOPS+とwRC+。NPBの年別係数・パークファクターを踏まえ、どちらをどの目的で使うべきかを整理します。",
    url: "https://baseball-ai-media.vercel.app/column/opsplus-vs-wrcplus",
    type: "article",
    images: [{ url: "https://baseball-ai-media.vercel.app/icon.png" }],
  },
};

export default function Page() {
  const published = "2025-08-03";
  const modified = published;
  const url = "https://baseball-ai-media.vercel.app/column/opsplus-vs-wrcplus";
  const breadcrumb = [
    { "@type": "ListItem", position: 1, name: "ホーム", item: "https://baseball-ai-media.vercel.app/" },
    { "@type": "ListItem", position: 2, name: "コラム", item: "https://baseball-ai-media.vercel.app/column" },
    { "@type": "ListItem", position: 3, name: "OPS+ と wRC+ の違い", item: url },
  ];

  return (
    <main className="prose prose-neutral max-w-3xl mx-auto px-4 py-10">
      <ArticleViewBeacon slug="opsplus-vs-wrcplus" />
      <JsonLd
        type="BreadcrumbList"
        data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumb }}
      />
      <JsonLd
        type="Article"
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "OPS+ と wRC+ の違い—NPBではどちらを使うべき？",
          datePublished: published,
          dateModified: modified,
          author: { "@type": "Organization", name: "Baseball AI Media" },
          publisher: {
            "@type": "Organization",
            name: "Baseball AI Media",
            logo: { "@type": "ImageObject", url: "https://baseball-ai-media.vercel.app/icon.png" },
          },
          mainEntityOfPage: url,
          image: ["https://baseball-ai-media.vercel.app/icon.png"],
          articleSection: "Analytics",
          keywords: ["OPS+", "wRC+", "NPB", "PF補正", "セイバーメトリクス"],
        }}
      />

      <h1>OPS+ と wRC+ の違い—NPBではどちらを使うべき？</h1>
      <p>
        どちらも「リーグ平均=100」に正規化した<strong>相対評価指標</strong>ですが、作りが違います。
        本稿では、<Link href="/about/methodology">当サイトの年別係数</Link>と
        <Link href="/teams">PF（Park Factor）補正</Link>を踏まえて、目的別の使い分けを提案します。
      </p>

      <h2>定義の違い（超要点）</h2>
      <ul>
        <li>
          <strong>OPS+</strong>：<em>OPS</em>をリーグ・球場環境で補正し比率化。単純で直感的、長所は「軽さ」。
        </li>
        <li>
          <strong>wRC+</strong>：<em>wOBA</em>をベースに「得点価値」で重み付けし、リーグ平均=100化。
          四球や長打の<strong>得点寄与</strong>をより正確に反映。
        </li>
      </ul>

      <h2>NPBで起きやすい評価のズレ</h2>
      <p>
        日本の球場はサイズ・風・屋根の有無が多様で、同じOPSでも得点価値が異なる場面が多い。
        <strong>PF補正ON</strong>＋<strong>wRC+</strong>で「攻撃の実質価値」を掴むのが王道です。
      </p>

      <h2>実務的な使い分け</h2>
      <ol>
        <li>
          <strong>速報・俯瞰</strong>：<em>OPS+</em>（軽い/直感的）。比較ページの「パッと比較」に向きます。
        </li>
        <li>
          <strong>実力評価・移籍判断</strong>：<em>wRC+</em>（正確）。PF ONにして
          <Link href="/players/compare">選手比較</Link>でキャリア推移を確認。
        </li>
        <li>
          <strong>打順最適化</strong>：<em>wRC+</em>と<strong>出塁率</strong>の併用。
          詳細は <Link href="/column/batting-order-optimization">打順最適化のコラム</Link> へ。
        </li>
      </ol>

      <h2>PF補正トグルの実戦ガイド</h2>
      <p>
        <Link href="/teams/2024/T">チームページ</Link>や
        <Link href="/players/compare">比較ページ</Link>のPFトグルをONにすると、
        「本拠地バフ/デバフ」を中立化できます。屋外×広い球場の打者はPF ONで強く出ることが多く、
        ドーム×狭い球場の打者はOFFとの差が小さく見えることもあります。
      </p>

      <h2>結論：場面で使い分ける</h2>
      <ul>
        <li>速報・簡易比較 → <strong>OPS+</strong></li>
        <li>実力評価・編成判断 → <strong>wRC+</strong>（PF ON 推奨）</li>
        <li>学習・説明用途 → 両指標を併記し、乖離理由を言語化</li>
      </ul>

      <hr />
      <div className="mt-6 flex flex-wrap gap-3">
        <ArticleCta slug="opsplus-vs-wrcplus" to="/players/compare" position="footer">
          選手を比較
        </ArticleCta>
        <ArticleCta slug="opsplus-vs-wrcplus" to="/teams/compare?year=2024&teams=T,H,C,G&pf=true" position="footer">
          上位4球団のPF補正比較
        </ArticleCta>
        <ArticleCta slug="opsplus-vs-wrcplus" to="/about/methodology" position="footer">
          係数の定義を読む
        </ArticleCta>
      </div>
    </main>
  );
}