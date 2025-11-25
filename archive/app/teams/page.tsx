import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function TeamsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            ホームに戻る
          </Link>
        </div>

        <div className="text-center mb-12">
          <Users className="w-16 h-16 text-cyan-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">Baseball AI Media</h1>
          <p className="text-xl text-slate-300 mb-8">NPBのデータ分析と統計情報</p>
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">🤖 Vercel環境で動作中</h2>
            <p className="text-slate-400 mb-4">現在、日本語NPBサイトがVercelで正常にデプロイされています。</p>
            <p className="text-slate-400">モックデータを使用して全機能をテスト可能です。</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg text-center font-medium transition-colors">
            ホームページ
          </Link>
          <Link href="/standings" className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg text-center font-medium transition-colors">
            順位表
          </Link>
          <Link href="/schedule" className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg text-center font-medium transition-colors">
            試合日程
          </Link>
        </div>
      </div>
    </div>
  );
}