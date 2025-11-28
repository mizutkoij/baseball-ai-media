import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamPage({ params }: PageProps) {
  const resolvedParams = await params;
  const teamId = resolvedParams.teamId;
  
  const dataDir = path.join(process.cwd(), 'public', 'data', 'players', 'detailed', teamId);
  
  if (!fs.existsSync(dataDir)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
            ← ホームへ戻る
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">{teamId}</h1>
          <p className="text-slate-400">2025シーズン 選手一覧</p>
        </div>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  const detailedDir = path.join(process.cwd(), 'public', 'data', 'players', 'detailed');
  if (!fs.existsSync(detailedDir)) return [];
  
  const teams = fs.readdirSync(detailedDir).filter(item => {
    const itemPath = path.join(detailedDir, item);
    return fs.statSync(itemPath).isDirectory();
  });

  return teams.map(team => ({ teamId: team }));
}
