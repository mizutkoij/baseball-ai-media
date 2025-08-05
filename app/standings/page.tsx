import { Suspense } from 'react';
import LeagueStandings from '@/components/LeagueStandings';
import { Trophy, Calendar, TrendingUp } from 'lucide-react';

export const metadata = {
  title: 'NPB順位表 2025年 | リアルタイム順位・勝率・ゲーム差',
  description: 'NPB（セ・パ両リーグ）の最新順位表。勝率、ゲーム差、直近成績、プレーオフ進出圏を一覧表示。リアルタイム更新で常に最新情報を提供。',
  keywords: 'NPB, 順位表, セントラルリーグ, パシフィックリーグ, 勝率, ゲーム差, プレーオフ, クライマックスシリーズ',
  openGraph: {
    title: 'NPB順位表 2025年 | NPB AI Analytics',
    description: 'セ・パ両リーグの最新順位表とプレーオフ進出状況',
    type: 'website',
  },
};

function StandingsHero() {
  return (
    <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 flex items-center justify-center gap-3">
            <Trophy className="w-12 h-12 text-yellow-400" />
            NPB順位表
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
            セントラル・リーグとパシフィック・リーグの最新順位と詳細成績。
            勝率、ゲーム差、直近10試合成績、プレーオフ進出圏を一目で確認できます。
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>2024年シーズン</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span>リアルタイム更新</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>プレーオフ進出圏表示</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlayoffExplanation() {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6 mb-8">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-600" />
        2024年プレーオフ制度
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">クライマックスシリーズ進出</h4>
          <ul className="text-sm text-slate-700 space-y-2">
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              <span><strong>1位:</strong> リーグ優勝（CS決勝から）</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <span><strong>2位:</strong> CS決勝進出</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <span><strong>3位:</strong> CS決勝進出</span>
            </li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">ワイルドカード制度</h4>
          <ul className="text-sm text-slate-700 space-y-2">
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span><strong>4位・5位:</strong> ワイルドカードゲーム</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
              <span><strong>6位:</strong> シーズン終了</span>
            </li>
          </ul>
          <p className="text-xs text-slate-600 mt-3">
            ※ワイルドカード勝者がCS決勝へ進出
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StandingsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <StandingsHero />
      
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PlayoffExplanation />
        
        <Suspense fallback={
          <div className="space-y-6">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-8 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-6"></div>
                <div className="space-y-4">
                  {[...Array(6)].map((_, j) => (
                    <div key={j} className="flex justify-between">
                      <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        }>
          <LeagueStandings year={2025} showBoth={true} />
        </Suspense>
      </section>
    </div>
  );
}