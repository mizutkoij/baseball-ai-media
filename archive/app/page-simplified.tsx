import Link from "next/link";
import { Calendar, Trophy, TrendingUp, BarChart3, Users, Globe } from "lucide-react";
import TodaysGames from "../components/TodaysGames";
import LeagueSelector from "../components/LeagueSelector";
import { Suspense } from "react";

// Force dynamic rendering to prevent build-time API calls
export const dynamic = 'force-dynamic';

export default function HomePage({ searchParams }: { searchParams: { filter?: string; league?: string } }) {
  const isNPB2Mode = searchParams?.filter === 'NPB2';
  const currentLeague = (searchParams?.league || 'npb') as 'npb' | 'mlb' | 'kbo' | 'international';
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 mb-8">
          <LeagueSelector currentLeague={currentLeague} showDescription={false} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6">
        
        {/* 今日の試合 - 最上部 */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              📅 今日の試合
            </h2>
            <p className="text-xl text-slate-400">
              リアルタイム更新で最新の試合状況をお届け
            </p>
          </div>
          <TodaysGames />
        </div>

        {/* 試合日程ボタン */}
        <div className="mb-12 text-center">
          <Link
            href="/games"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            <Calendar className="w-6 h-6" />
            試合日程を見る
          </Link>
        </div>

        {/* 順位表 */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">順位表</h2>
            </div>
            <div className="text-center">
              <Link
                href="/standings"
                className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 rounded-lg transition-colors"
              >
                セ・リーグ / パ・リーグ順位を見る
              </Link>
            </div>
          </div>
        </div>

        {/* 打撃ランキング */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <h2 className="text-2xl font-bold text-white">打撃ランキング TOP5</h2>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 打率 */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-3">打率</h3>
                <div className="space-y-2">
                  {[
                    { name: "村上 宗隆", team: "ヤクルト", stat: ".312" },
                    { name: "岡本 和真", team: "巨人", stat: ".308" },
                    { name: "佐野 恵太", team: "DeNA", stat: ".305" },
                    { name: "山田 哲人", team: "ヤクルト", stat: ".301" },
                    { name: "大山 悠輔", team: "阪神", stat: ".298" }
                  ].map((player, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{i + 1}. {player.name}</span>
                      <span className="text-green-400 font-bold">{player.stat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ホームラン */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-3">ホームラン</h3>
                <div className="space-y-2">
                  {[
                    { name: "村上 宗隆", team: "ヤクルト", stat: "28" },
                    { name: "岡本 和真", team: "巨人", stat: "26" },
                    { name: "柳田 悠岐", team: "ソフトバンク", stat: "24" },
                    { name: "大山 悠輔", team: "阪神", stat: "22" },
                    { name: "山川 穂高", team: "西武", stat: "21" }
                  ].map((player, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{i + 1}. {player.name}</span>
                      <span className="text-orange-400 font-bold">{player.stat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 打点 */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-3">打点</h3>
                <div className="space-y-2">
                  {[
                    { name: "村上 宗隆", team: "ヤクルト", stat: "82" },
                    { name: "岡本 和真", team: "巨人", stat: "78" },
                    { name: "柳田 悠岐", team: "ソフトバンク", stat: "74" },
                    { name: "大山 悠輔", team: "阪神", stat: "71" },
                    { name: "佐野 恵太", team: "DeNA", stat: "68" }
                  ].map((player, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{i + 1}. {player.name}</span>
                      <span className="text-blue-400 font-bold">{player.stat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* OPS */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-3">OPS</h3>
                <div className="space-y-2">
                  {[
                    { name: "村上 宗隆", team: "ヤクルト", stat: "1.012" },
                    { name: "岡本 和真", team: "巨人", stat: ".987" },
                    { name: "柳田 悠岐", team: "ソフトバンク", stat: ".965" },
                    { name: "大山 悠輔", team: "阪神", stat: ".942" },
                    { name: "佐野 恵太", team: "DeNA", stat: ".928" }
                  ].map((player, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{i + 1}. {player.name}</span>
                      <span className="text-purple-400 font-bold">{player.stat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <Link
                href="/rankings"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors"
              >
                全打撃ランキングを見る
              </Link>
            </div>
          </div>
        </div>

        {/* 投手指標 */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-red-500" />
              <h2 className="text-2xl font-bold text-white">投手指標 TOP5</h2>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 防御率 */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-3">防御率</h3>
                <div className="space-y-2">
                  {[
                    { name: "山本 由伸", team: "オリックス", stat: "1.89" },
                    { name: "佐々木朗希", team: "ロッテ", stat: "2.12" },
                    { name: "今永 昇太", team: "DeNA", stat: "2.24" },
                    { name: "戸郷 翔征", team: "巨人", stat: "2.38" },
                    { name: "高橋 宏斗", team: "中日", stat: "2.45" }
                  ].map((player, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{i + 1}. {player.name}</span>
                      <span className="text-red-400 font-bold">{player.stat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 勝利数 */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-3">勝利数</h3>
                <div className="space-y-2">
                  {[
                    { name: "山本 由伸", team: "オリックス", stat: "14" },
                    { name: "今永 昇太", team: "DeNA", stat: "12" },
                    { name: "戸郷 翔征", team: "巨人", stat: "11" },
                    { name: "佐々木朗希", team: "ロッテ", stat: "10" },
                    { name: "高橋 宏斗", team: "中日", stat: "9" }
                  ].map((player, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{i + 1}. {player.name}</span>
                      <span className="text-yellow-400 font-bold">{player.stat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* セーブ数 */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-3">セーブ数</h3>
                <div className="space-y-2">
                  {[
                    { name: "栗林 良吏", team: "広島", stat: "28" },
                    { name: "湯浅 京己", team: "阪神", stat: "25" },
                    { name: "森 唯斗", team: "ソフトバンク", stat: "23" },
                    { name: "松井 裕樹", team: "楽天", stat: "21" },
                    { name: "伊勢 大夢", team: "DeNA", stat: "19" }
                  ].map((player, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{i + 1}. {player.name}</span>
                      <span className="text-cyan-400 font-bold">{player.stat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 奪三振 */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-3">奪三振</h3>
                <div className="space-y-2">
                  {[
                    { name: "佐々木朗希", team: "ロッテ", stat: "156" },
                    { name: "山本 由伸", team: "オリックス", stat: "142" },
                    { name: "今永 昇太", team: "DeNA", stat: "138" },
                    { name: "戸郷 翔征", team: "巨人", stat: "128" },
                    { name: "高橋 宏斗", team: "中日", stat: "118" }
                  ].map((player, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{i + 1}. {player.name}</span>
                      <span className="text-indigo-400 font-bold">{player.stat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <Link
                href="/rankings?category=pitching"
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors"
              >
                全投手ランキングを見る
              </Link>
            </div>
          </div>
        </div>

        {/* 最新コラム */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-pink-500" />
              <h2 className="text-2xl font-bold text-white">最新コラム</h2>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/column/opsplus-vs-wrcplus" className="group">
                <div className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 mb-2">
                    OPS+とwRC+の違いを解説
                  </h3>
                  <p className="text-slate-400 text-sm">
                    現代野球で重要な指標の違いと使い分けについて詳しく解説します。
                  </p>
                  <div className="text-xs text-slate-500 mt-3">2025年8月19日</div>
                </div>
              </Link>

              <Link href="/column/re24-winning-lines" className="group">
                <div className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 mb-2">
                    RE24で見る勝利への貢献度
                  </h3>
                  <p className="text-slate-400 text-sm">
                    得点期待値の変化量で測る選手の真の価値を分析します。
                  </p>
                  <div className="text-xs text-slate-500 mt-3">2025年8月18日</div>
                </div>
              </Link>

              <Link href="/column/sabermetrics-basics" className="group">
                <div className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 mb-2">
                    セイバーメトリクス入門
                  </h3>
                  <p className="text-slate-400 text-sm">
                    データ野球の基礎知識から応用まで、初心者にも分かりやすく解説。
                  </p>
                  <div className="text-xs text-slate-500 mt-3">2025年8月17日</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* 他リーグへのボタン */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-white">他リーグの情報</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Link
                href="/?league=mlb"
                className="group p-6 bg-gradient-to-br from-red-600/20 to-blue-600/20 border border-red-500/30 rounded-xl hover:border-red-500/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🇺🇸</div>
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-red-400 mb-2">
                      MLB (メジャーリーグ)
                    </h3>
                    <p className="text-slate-400 text-sm">
                      アメリカンリーグ・ナショナルリーグの最新情報と統計
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/?league=kbo"
                className="group p-6 bg-gradient-to-br from-blue-600/20 to-red-600/20 border border-blue-500/30 rounded-xl hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🇰🇷</div>
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 mb-2">
                      KBO (韓国プロ野球)
                    </h3>
                    <p className="text-slate-400 text-sm">
                      韓国プロ野球リーグの詳細データと分析情報
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}