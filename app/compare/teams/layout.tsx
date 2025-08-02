import type { Metadata } from 'next';
import { currentSeasonYear } from '@/lib/time';
import { TEAM_COLORS } from '@/lib/teamColors';
import { absUrl } from '@/lib/absUrl';

function sortedUniqueTeams(raw: string | string[] | undefined) {
  const arr = (typeof raw === 'string' ? raw.split(',') : raw ?? [])
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(arr)).sort();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const year = String(params.year ?? currentSeasonYear());
  const pf = String(params.pf ?? 'true') === 'true';
  const teams = sortedUniqueTeams(params.teams).slice(0, 4);
  
  const teamNames = teams.map(code => TEAM_COLORS[code]?.name || code);
  const title = teams.length > 0 
    ? `${teamNames.join(' vs ')} チーム比較 ${year}年｜Baseball AI Media`
    : `NPB チーム比較 ${year}年｜Baseball AI Media`;
  
  const description = teams.length > 0
    ? `${year}年NPB ${teamNames.join('・')}の詳細比較。PF補正${pf ? 'ON（中立化環境）' : 'OFF（生データ）'}で公正な分析。wRC+、ERA-、FIP等の高度指標で真の実力を比較。`
    : `${year}年NPBチーム比較ツール。球場補正（PF）対応で公正な分析が可能。`;

  const ogImageUrl = teams.length > 0
    ? absUrl(`/api/og/teams?year=${encodeURIComponent(year)}&pf=${pf}&teams=${encodeURIComponent(teams.join(','))}`)
    : absUrl('/api/og/teams');

  return {
    title,
    description,
    keywords: [
      'NPB', 'プロ野球', 'チーム比較', 'セイバーメトリクス',
      'wRC+', 'ERA-', 'FIP-', '球場補正', year + '年',
      ...teamNames
    ].join(', '),
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'ja_JP',
      url: absUrl(`/compare/teams?year=${year}&pf=${pf}&teams=${teams.join(',')}`),
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function CompareTeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}