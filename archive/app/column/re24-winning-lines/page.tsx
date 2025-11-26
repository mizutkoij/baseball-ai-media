/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import ArticleViewBeacon from "@/components/ArticleViewBeacon";
import ArticleCta from "@/components/ArticleCta";

export const metadata: Metadata = {
  title: "RE24で読む『勝ち筋』—昨日の采配を定量で振り返る",
  description:
    "RE24とWPAで『どの場面の一打・継投が勝敗を動かしたか』を定量化。NPBの試合を翌朝3分で振り返る実践ガイド。",
  alternates: { canonical: "https://baseball-ai-media.vercel.app/column/re24-winning-lines" },
  openGraph: {
    title: "RE24で読む『勝ち筋』—昨日の采配を定量で振り返る",
    description:
      "RE24とWPAで『どの場面の一打・継投が勝敗を動かしたか』を定量化。NPBの試合を翌朝3分で振り返る実践ガイド。",
    url: "https://baseball-ai-media.vercel.app/column/re24-winning-lines",
    type: "article",
    images: [{ url: "https://baseball-ai-media.vercel.app/icon.png" }],
  },
};

export default function Page() {
  const published = "2025-08-03";
  const modified = published;
  const url = "https://baseball-ai-media.vercel.app/column/re24-winning-lines";
  const breadcrumb = [
    { "@type": "ListItem", position: 1, name: "ホーム", item: "https://baseball-ai-media.vercel.app/" },
    { "@type": "ListItem", position: 2, name: "コラム", item: "https://baseball-ai-media.vercel.app/column" },
    { "@type": "ListItem", position: 3, name: "RE24で読む『勝ち筋』", item: url },
  ];

  return (
    <main className="prose prose-neutral max-w-3xl mx-auto px-4 py-10">
      <ArticleViewBeacon slug="re24-winning-lines" />
      <JsonLd
        type="BreadcrumbList"
        data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumb }}
      />
      <JsonLd
        type="Article"
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "RE24で読む『勝ち筋』—昨日の采配を定量で振り返る",
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
          keywords: ["RE24", "WPA", "NPB", "セイバーメトリクス", "勝敗分析"],
        }}
      />

      <h1>RE24で読む「勝ち筋」—昨日の采配を定量で振り返る</h1>
      <p>
        「どの一打が決め手だったのか？」「継投は適切だったのか？」を3分で把握する方法が
        <strong>RE24</strong>と<strong>WPA</strong>です。<Link href="/column/brief">Daily Brief</Link> と組み合わせれば、
        昨日の注目試合を定量的に振り返り、今日の観戦ポイントも作れます。
      </p>

      <h2>RE24とは？ ざっくり仕組み</h2>
      <p>
        RE24は「打席前後の期待得点（Run Expectancy）の差」を合計した指標。走者状況×アウトカウントに応じた
        期待得点テーブルを用いて、<em>その打席がどれだけ得点期待を増やしたか</em>を測ります。
        詳しい式は <Link href="/about/methodology">メソドロジー</Link> に掲載しています。
      </p>

      <h2>WPAとの役割分担</h2>
      <ul>
        <li>RE24 = 得点期待に与えた影響（<strong>攻撃の質</strong>の評価）</li>
        <li>WPA = 勝利確率に与えた影響（<strong>勝敗への寄与</strong>の評価）</li>
      </ul>
      <p>
        同じタイムリーでも、ビハインド終盤の一打はWPAが大きくなりがち。併用すると
        <Link href="/games">/games</Link> ページの「どの場面が山だったか」がハッキリします。
      </p>

      <h2>3分レビューの実践手順</h2>
      <ol>
        <li>
          <strong>試合を開く：</strong>
          <Link href="/today">今日の試合</Link> または <Link href="/column/brief">Daily Brief</Link> から
          「Game of the Day」をクリック。
        </li>
        <li>
          <strong>ハイライト抽出：</strong> 算出済みの「最高RE24打席」「最大WPA投球」を確認
          （なければ<span>ボックススコア</span>とイニングログで代替）。
        </li>
        <li>
          <strong>チーム比較：</strong> <Link href="/teams/compare?year=2024&teams=T,G,H,C&pf=true">
            /teams/compare
          </Link>
          でPF補正ONの実力差を把握。
        </li>
        <li>
          <strong>キープレイヤー深掘り：</strong> 該当選手の
          <Link href="/players">/players</Link> ページでwRC+推移や類似選手をチェック。
        </li>
      </ol>

      <h2>ケースで見る「勝ち筋」</h2>
      <p>
        例えば9回表、同点・無死一二塁。ここでの進塁打はRE24が大きく、後続の長打でWPAがドンと動く——
        <em>&quot;繋ぐ→決める&quot;</em>の二段ロジックが視覚化されます。投手側は「四球でRE24を盛らない」
        「ハーフスイングを取る球審傾向（将来対応予定）」といった現実的な対策にも結びつきます。
      </p>

      <h2>PF補正ONでズレを正す</h2>
      <p>
        球場の広さや風が違えば得点環境も変わります。<Link href="/teams/2024/T">チームページ</Link>の
        PFトグル、<Link href="/players/compare">選手比較</Link>のPF ON/OFFを切り替えると、
        球場による有利不利を補正した評価で昨日の見どころを再解釈できます。
      </p>

      <h2>まとめ</h2>
      <ul>
        <li>RE24は「攻撃の質」、WPAは「勝敗寄与」——両輪で読むのがコツ</li>
        <li>GOTD→/games→/compare→/players の回遊で"勝ち筋"が見える</li>
        <li>PF補正ONで球場差を中立化し、評価のブレを抑える</li>
      </ul>

      <hr />
      <div className="mt-6 flex flex-wrap gap-3">
        <ArticleCta slug="re24-winning-lines" to="/column/brief" position="footer">
          デイリーブリーフ
        </ArticleCta>
        <ArticleCta slug="re24-winning-lines" to="/teams/compare?year=2024&teams=T,H,C,G&pf=true" position="footer">
          上位4球団のPF補正比較
        </ArticleCta>
        <ArticleCta slug="re24-winning-lines" to="/column/opsplus-vs-wrcplus" position="footer">
          OPS+ vs wRC+ 徹底解説
        </ArticleCta>
      </div>
    </main>
  );
}
