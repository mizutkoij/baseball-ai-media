import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NPB Team Comparison | Baseball AI Media',
  description: 'NPB team performance comparison tool with park factor (PF) adjustments for fair analysis. Compare teams using advanced metrics like wRC+, ERA-, FIP.',
  keywords: 'NPB, baseball, team comparison, sabermetrics, wRC+, ERA-, FIP-, park factors',
  openGraph: {
    title: 'NPB Team Comparison',
    description: 'Detailed team performance comparison',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'NPB Team Comparison',
    description: 'Detailed team performance comparison',
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