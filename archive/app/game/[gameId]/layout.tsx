// app/game/[gameId]/layout.tsx
import { Metadata } from 'next';

interface GameLayoutProps {
  children: React.ReactNode;
  params: { gameId: string };
}

export async function generateMetadata({ params }: { params: { gameId: string } }): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://baseball-ai-media.vercel.app';
  const gameId = params.gameId;
  
  // Game IDからチーム名を推測（簡易版）
  const matchTitle = gameId.includes('_') ? 
    `${gameId.split('_')[0]} 試合詳細` : 
    `${gameId} - 試合詳細`;
    
  const description = `NPB試合の詳細情報、リアルタイム勝率変動、次球予測を提供。SSEによるライブ更新対応。`;
  
  return {
    title: `${matchTitle} | Baseball AI Media`,
    description,
    keywords: ['NPB', '試合詳細', 'ライブ', 'リアルタイム', '次球予測', '勝率変動'],
    authors: [{ name: 'Baseball AI Media Team' }],
    robots: 'index, follow',
    
    openGraph: {
      title: matchTitle,
      description,
      type: 'website',
      locale: 'ja_JP',
      url: `${baseUrl}/game/${gameId}`,
      siteName: 'Baseball AI Media',
      images: [
        {
          url: `${baseUrl}/api/og/game/${gameId}`,
          width: 1200,
          height: 630,
          alt: matchTitle,
        },
      ],
    },
    
    twitter: {
      card: 'summary_large_image',
      title: matchTitle,
      description,
      images: [`${baseUrl}/api/og/game/${gameId}`],
    },
    
    alternates: {
      canonical: `${baseUrl}/game/${gameId}`,
    },
  };
}

export default function GameLayout({ children }: GameLayoutProps) {
  return children;
}