import { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface SeasonLayoutProps {
  children: React.ReactNode;
  params: { year: string };
}

export async function generateMetadata({ 
  params 
}: { 
  params: { year: string } 
}): Promise<Metadata> {
  const year = parseInt(params.year);
  
  // Validate year - extended range for A-1 mass content
  if (isNaN(year) || year < 2016 || year > 2025) {
    notFound();
  }

  return {
    title: `${year}年シーズン総括 | NPB AI Analytics`,
    description: `NPB ${year}年シーズンの完全分析 - wRC+、ERA-、ピタゴラス勝率による客観的評価。順位表、主要指標、個人タイトル争いを一望。`,
    openGraph: {
      title: `NPB ${year} シーズンまとめ`,
      description: `順位・主要指標・リーダーを一望`,
      type: 'article',
      publishedTime: `${year}-03-01T00:00:00.000Z`,
      modifiedTime: new Date().toISOString(),
      section: 'Sports',
      tags: ['NPB', '野球', 'セイバーメトリクス', `${year}年`, 'シーズン総括'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `NPB ${year} シーズンまとめ`,
      description: `順位・主要指標・リーダーを一望`,
    },
    alternates: {
      canonical: `https://baseball-ai-media.vercel.app/seasons/${year}`,
    },
  };
}

export default function SeasonLayout({ children, params }: SeasonLayoutProps) {
  const year = parseInt(params.year);
  
  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsSeason',
    name: `NPB ${year} シーズンまとめ`,
    sport: 'Baseball',
    startDate: `${year}-03-01`,
    endDate: `${year}-11-30`,
    url: `https://baseball-ai-media.vercel.app/seasons/${year}`,
    description: '順位・主要指標・リーダーを集約したシーズンカプセル',
    competitor: [
      { '@type': 'SportsTeam', name: '巨人' },
      { '@type': 'SportsTeam', name: '阪神' },
      { '@type': 'SportsTeam', name: '中日' },
      { '@type': 'SportsTeam', name: '広島' },
      { '@type': 'SportsTeam', name: 'ヤクルト' },
      { '@type': 'SportsTeam', name: 'DeNA' },
      { '@type': 'SportsTeam', name: 'ソフトバンク' },
      { '@type': 'SportsTeam', name: '日本ハム' },
      { '@type': 'SportsTeam', name: '西武' },
      { '@type': 'SportsTeam', name: 'ロッテ' },
      { '@type': 'SportsTeam', name: 'オリックス' },
      { '@type': 'SportsTeam', name: '楽天' },
    ],
    organizer: {
      '@type': 'SportsOrganization',
      name: '日本野球機構',
      alternateName: 'NPB',
    },
    publisher: {
      '@type': 'Organization',
      name: 'NPB AI Analytics',
      url: 'https://baseball-ai-media.vercel.app',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}

// Enable ISR with 24-hour revalidation
export const revalidate = 60 * 60 * 24; // 24 hours

// Generate static params for all years (2016-2025)
export async function generateStaticParams() {
  const YEARS = Array.from({ length: 2025 - 2016 + 1 }, (_, i) => 2016 + i);
  return YEARS.map((year) => ({ year: year.toString() }));
}