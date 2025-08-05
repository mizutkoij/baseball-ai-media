import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NPBチーム比較 | Baseball AI Media',
  description: 'NPBチーム成績比較ツール。球場補正（PF）対応で公正な分析が可能。wRC+、ERA-、FIP等の高度指標でチーム力を比較。',
  keywords: 'NPB, プロ野球, チーム比較, セイバーメトリクス, wRC+, ERA-, FIP-, 球場補正',
  openGraph: {
    title: 'NPBチーム比較',
    description: 'チーム成績を詳細比較',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary',
    title: 'NPBチーム比較',
    description: 'チーム成績を詳細比較',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CompareTeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}